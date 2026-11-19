import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000000b1";
const MEMBER = "00000000-0000-0000-0000-0000000000b2";
const OTHER = "00000000-0000-0000-0000-0000000000b3";

let db;
let as;
let denied;
let org;
let otherOrg;
const pcKey = randomBytes(32).toString("base64url");
let pcId;

const hash = (key) => createHash("sha256").update(key, "utf8").digest("hex");

// Calls as a linked PC: the anon role with the computer key in the request headers, as PostgREST passes them.
async function asComputer(key, sql, params) {
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify({ "x-framedecks-computer": key })}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
  }
}

async function computerDenied(key, sql, params) {
  try {
    await asComputer(key, sql, params);
    return false;
  } catch {
    return true;
  }
}

const push = (run, changes) => run("select sync_push($1, $2::jsonb) as r", [org, JSON.stringify(changes)]).then((x) => x.rows[0].r);
const pull = (run, since = 0, max = 500) => run("select sync_pull($1, $2, $3) as r", [org, since, max]).then((x) => x.rows[0].r);
const pcRun = (sql, params) => asComputer(pcKey, sql, params);
const ownerRun = (sql, params) => as(OWNER, sql, params);
const memberRun = (sql, params) => as(MEMBER, sql, params);

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({ [OWNER]: "owner@church.org", [MEMBER]: "member@church.org", [OTHER]: "x@else.org" }));
  org = (await as(OWNER, "insert into organizations(name, created_by) values ('Evening Study', $1) returning id", [OWNER])).rows[0].id;
  otherOrg = (await as(OTHER, "insert into organizations(name, created_by) values ('Elsewhere', $1) returning id", [OTHER])).rows[0].id;
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'member')", [org, MEMBER]);
  // 0031: a new workspace keeps member details on its PC; these tests are about a workspace that shares them
  await as(OWNER, "select set_members_shared($1, true)", [org]);
});

after(() => db?.close());

test("linking: the PC sends only its key's hash, an admin approves the code, the PC learns its workspace once", async () => {
  await db.exec("set role anon");
  let code;
  try {
    code = (await db.query("select computer_link_start('Church PC', $1) as code", [hash(pcKey)])).rows[0].code;
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
    assert.equal((await db.query("select computer_link_poll($1) as r", [pcKey])).rows[0].r.status, "pending");
    await assert.rejects(db.query("select * from computer_links"));
  } finally {
    await db.exec("reset role");
  }
  assert.ok(await denied(MEMBER, "select computer_link_approve($1, $2)", [code, org]));
  assert.ok(await denied(OWNER, "select computer_link_approve('WRONG234', $1)", [org]));
  pcId = (await as(OWNER, "select computer_link_approve($1, $2) as id", [code.slice(0, 4) + " " + code.slice(4).toLowerCase(), org])).rows[0].id;
  assert.ok(pcId);
  assert.ok(await denied(OWNER, "select computer_link_approve($1, $2)", [code, org]), "a code works once");

  await db.exec("set role anon");
  try {
    const answer = (await db.query("select computer_link_poll($1) as r", [pcKey])).rows[0].r;
    assert.deepEqual(answer, { status: "approved", computerId: pcId, organizationId: org, organizationName: "Evening Study" });
    assert.equal((await db.query("select computer_link_poll($1) as r", [pcKey])).rows[0].r.status, "unknown");
  } finally {
    await db.exec("reset role");
  }
  const stored = await db.query("select key_hash from computers where id = $1", [pcId]);
  assert.equal(stored.rows[0].key_hash, hash(pcKey));
  assert.equal((await as(OWNER, "select name from computers")).rows[0].name, "Church PC");
  assert.equal((await as(MEMBER, "select * from computers")).rows.length, 0);
});

test("0010: an owner or admin sees which PC asked and how long ago, by the code from the link", async () => {
  const key = randomBytes(32).toString("base64url");
  await db.exec("set role anon");
  let code;
  try {
    code = (await db.query("select computer_link_start('Hall PC', $1) as code", [hash(key)])).rows[0].code;
    await assert.rejects(db.query("select computer_link_peek($1)", [code]), "the anonymous role cannot look codes up");
  } finally {
    await db.exec("reset role");
  }
  const seen = (await as(OWNER, "select computer_link_peek($1) as r", [code.toLowerCase()])).rows[0].r;
  assert.equal(seen.status, "pending");
  assert.equal(seen.name, "Hall PC");
  assert.ok(seen.ageSeconds >= 0 && seen.ageSeconds < 60, String(seen.ageSeconds));
  assert.equal((await as(OWNER, "select computer_link_peek('NOTACODE') as r")).rows[0].r.status, "unknown");
  await db.query("update computer_links set expires_at = now() - interval '1 second' where code_hash = sha256_hex($1)", [code]);
  assert.equal((await as(OWNER, "select computer_link_peek($1) as r", [code])).rows[0].r.status, "expired");
  // looking up does not approve anything: the PC is still waiting (expired now), nothing was linked
  assert.equal((await as(OWNER, "select count(*)::int as n from computers where name = 'Hall PC'")).rows[0].n, 0);
});

test("the linked PC pushes new records and pulls them back in seq order", async () => {
  const r = await push(pcRun, [
    { kind: "frame", id: "sc_1", baseRev: 0, body: { name: "Welcome", notes: "Script" } },
    { kind: "order", id: "order", baseRev: 0, body: { scenes: ["sc_1"] } },
    { kind: "member", id: "m1", baseRev: 0, body: { name: "Ruth", birthDate: "1990-04-02" } },
  ]);
  assert.deepEqual(r.results.map((x) => [x.status, x.rev]), [["ok", 1], ["ok", 1], ["ok", 1]]);
  const seqs = r.results.map((x) => x.seq);
  assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
  assert.equal(r.seq, seqs.at(-1));
  const all = await pull(pcRun);
  assert.deepEqual(all.entities.map((e) => e.id), ["sc_1", "order", "m1"]);
  assert.equal(all.entities[0].updatedBy, `computer:${pcId}`);
  assert.equal(all.more, false);
  assert.equal(all.seq, r.seq);
});

test("a stale baseRev is a conflict that stores nothing; changes in one call stand alone", async () => {
  const r = await push(pcRun, [
    { kind: "frame", id: "sc_1", baseRev: 0, body: { name: "Other" } },
    { kind: "frame", id: "sc_2", baseRev: 0, body: { name: "Prayer" } },
  ]);
  assert.equal(r.results[0].status, "conflict");
  assert.deepEqual(r.results[0].current, { rev: 1, deleted: false, body: { name: "Welcome", notes: "Script" }, updatedBy: `computer:${pcId}` });
  assert.equal(r.results[1].status, "ok");
  const sc1 = await db.query("select rev, body from entities where id = 'sc_1'");
  assert.equal(sc1.rows[0].rev, 1);
});

test("updates and deletes bump rev, keep the old version in history, and pull from a cursor sees only newer", async () => {
  const before = (await pull(pcRun)).seq;
  await push(pcRun, [{ kind: "frame", id: "sc_1", baseRev: 1, body: { name: "Welcome!" } }]);
  await push(pcRun, [{ kind: "frame", id: "sc_2", baseRev: 1, deleted: true }]);
  const newer = await pull(pcRun, before);
  assert.deepEqual(newer.entities.map((e) => [e.id, e.rev, e.deleted, e.body]), [
    ["sc_1", 2, false, { name: "Welcome!" }],
    ["sc_2", 2, true, null],
  ]);
  const history = await as(OWNER, "select id, rev, body from entity_history order by id");
  assert.deepEqual(history.rows.map((h) => [h.id, h.rev]), [["sc_1", 1], ["sc_2", 1]]);
});

test("paging: max_rows limits a pull and the cursor continues where it stopped", async () => {
  const first = await pull(pcRun, 0, 2);
  assert.equal(first.entities.length, 2);
  assert.equal(first.more, true);
  const rest = await pull(pcRun, first.seq, 500);
  assert.equal(rest.more, false);
  assert.equal(first.entities.length + rest.entities.length, (await pull(pcRun)).entities.length);
});

test("members of the workspace read records; member records only for owners and admins", async () => {
  const asMember = await pull(memberRun);
  assert.ok(asMember.entities.some((e) => e.kind === "frame"));
  assert.ok(!asMember.entities.some((e) => e.kind === "member"));
  assert.equal(asMember.seq, (await pull(ownerRun)).seq, "the cursor still moves past hidden records");
  assert.ok((await pull(ownerRun)).entities.some((e) => e.kind === "member"));
  assert.equal((await as(MEMBER, "select * from entities where kind = 'member'")).rows.length, 0);
  assert.equal((await as(OWNER, "select * from entities where kind = 'member'")).rows.length, 1);
  assert.equal((await as(MEMBER, "select * from entity_history where kind = 'member'")).rows.length, 0);
});

test("plain members cannot push; outsiders and other workspaces see nothing", async () => {
  assert.ok(await denied(MEMBER, "select sync_push($1, $2::jsonb)", [org, JSON.stringify([{ kind: "frame", id: "x", baseRev: 0, body: {} }])]));
  assert.ok(await denied(OTHER, "select sync_pull($1)", [org]));
  assert.equal((await as(OTHER, "select * from entities")).rows.length, 0);
  assert.ok(await computerDenied(pcKey, "select sync_pull($1)", [otherOrg]));
  assert.ok(await computerDenied(randomBytes(32).toString("base64url"), "select sync_pull($1)", [org]));
  assert.ok(await computerDenied("", "select sync_pull($1)", [org]));
});

test("owners and admins can push too (editing in the companion later)", async () => {
  const r = await push(ownerRun, [{ kind: "meeting", id: "meeting", baseRev: 0, body: { title: "Tuesday" } }]);
  assert.equal(r.results[0].status, "ok");
  assert.equal((await pull(ownerRun)).entities.find((e) => e.kind === "meeting").updatedBy, `user:${OWNER}`);
});

test("bad changes are refused whole: unknown kind, missing body, too many, too large", async () => {
  const bad = [
    [{ kind: "media", id: "x", baseRev: 0, body: {} }],
    [{ kind: "frame", id: "x", baseRev: 0 }],
    Array.from({ length: 201 }, (_, i) => ({ kind: "frame", id: `f${i}`, baseRev: 0, body: {} })),
    [{ kind: "frame", id: "big", baseRev: 0, body: { text: "x".repeat(300 * 1024) } }],
    [],
  ];
  for (const changes of bad) {
    assert.ok(await computerDenied(pcKey, "select sync_push($1, $2::jsonb)", [org, JSON.stringify(changes)]), JSON.stringify(changes).slice(0, 60));
  }
  assert.equal((await db.query("select count(*)::int as n from entities where id in ('x', 'big')")).rows[0].n, 0);
});

test("0009: the PC's last-seen time is written at most once a minute, not on every sync call", async () => {
  const seen = async () => (await db.query("select last_seen_at from computers where id = $1", [pcId])).rows[0].last_seen_at;
  await db.query("update computers set last_seen_at = now() - interval '5 minutes' where id = $1", [pcId]);
  await pull(pcRun);
  const first = await seen();
  assert.ok(Date.now() - new Date(first).getTime() < 60_000, "an old time is refreshed");
  await db.query("update computers set last_seen_at = now() - interval '10 seconds' where id = $1", [pcId]);
  const recent = await seen();
  await pull(pcRun);
  await pull(pcRun);
  assert.equal(String(await seen()), String(recent), "a recent time is left alone (no write per call)");
  // The undo script brings back the 0003 behaviour, and 0009 applies again cleanly
  const sql = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  await db.exec(sql("../supabase/rollback/0009_seen_throttle_down.sql"));
  await pull(pcRun);
  assert.notEqual(String(await seen()), String(recent), "after the undo every call writes again");
  await db.exec(sql("../supabase/migrations/0009_seen_throttle.sql"));
  assert.ok(await pull(pcRun));
});

test("a revoked PC is refused at once; only admins or the PC itself can revoke", async () => {
  assert.ok(await denied(MEMBER, "select computer_revoke($1)", [pcId]));
  assert.ok(await denied(OTHER, "select computer_revoke($1)", [pcId]));
  await asComputer(pcKey, "select computer_revoke($1)", [pcId]);
  assert.ok(await computerDenied(pcKey, "select sync_pull($1)", [org]));
  assert.ok((await as(OWNER, "select revoked_at from computers where id = $1", [pcId])).rows[0].revoked_at);
});

test("the anonymous role without a key gets nothing and cannot approve links", async () => {
  await db.exec("select set_config('request.uid', '', false); set role anon");
  try {
    await assert.rejects(db.query("select sync_pull($1)", [org]));
    await assert.rejects(db.query("select * from entities"));
    await assert.rejects(db.query("select computer_link_approve('ABCDEFGH', $1)", [org]));
    await assert.rejects(db.query("select request_computer()"));
  } finally {
    await db.exec("reset role");
  }
});

const oldPcKey = randomBytes(32).toString("base64url");     // a PC on 8.4 (0012's tests)
const oldPc = (sql, params) => asComputer(oldPcKey, sql, params);
test("0012: a PC that does not know the meeting list cannot remove it; a change with a list is stored as sent", async () => {
  await db.query("insert into computers(organization_id, name, key_hash) values ($1, 'Hall PC', $2)", [org, hash(oldPcKey)]);
  const rev = async (kind) => (await db.query("select rev from entities where organization_id = $1 and kind = $2", [org, kind])).rows[0]?.rev ?? 0;
  const list = [{ id: "m1", name: "Tuesday", date: "2026-11-03", notes: "" }, { id: "m2", name: "Sunday", date: "", notes: "" }];
  const first = await push(ownerRun, [{ kind: "meeting", id: "meeting", baseRev: await rev("meeting"), body: { title: "Tuesday", meetings: list } }]);
  assert.equal(first.results[0].status, "ok");
  // an 8.4 PC sends the record back without the list (and with a change of its own)
  const older = await push(oldPc, [{ kind: "meeting", id: "meeting", baseRev: await rev("meeting"), body: { title: "Tuesday", notes: "from the PC" } }]);
  assert.equal(older.results[0].status, "ok");
  let row = (await db.query("select body from entities where organization_id = $1 and kind = 'meeting'", [org])).rows[0].body;
  assert.deepEqual(row.meetings, list, "the list stays");
  assert.equal(row.notes, "from the PC", "the PC's own change is kept");
  // an empty list is treated the same; a new list replaces the old one
  await push(oldPc, [{ kind: "meeting", id: "meeting", baseRev: await rev("meeting"), body: { title: "Tuesday", meetings: [] } }]);
  row = (await db.query("select body from entities where organization_id = $1 and kind = 'meeting'", [org])).rows[0].body;
  assert.equal(row.meetings.length, 2);
  await push(ownerRun, [{ kind: "meeting", id: "meeting", baseRev: await rev("meeting"), body: { title: "Sunday", meetings: [list[1]] } }]);
  row = (await db.query("select body from entities where organization_id = $1 and kind = 'meeting'", [org])).rows[0].body;
  assert.deepEqual(row.meetings, [list[1]]);
  // other records are untouched by it
  await push(ownerRun, [{ kind: "brand", id: "brand", baseRev: await rev("brand"), body: { meeting: "x", meetings: [1] } }]);
  await push(ownerRun, [{ kind: "brand", id: "brand", baseRev: await rev("brand"), body: { meeting: "y" } }]);
  row = (await db.query("select body from entities where organization_id = $1 and kind = 'brand'", [org])).rows[0].body;
  assert.deepEqual(row, { meeting: "y" });
  assert.equal((await ownerRun("select meetings_supported() as ok")).rows[0].ok, true);
});

test("0012 undo: the trigger and the check are gone, syncing works as before", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0012_meetings_down.sql", import.meta.url), "utf8"));
  const cur = (await db.query("select rev from entities where organization_id = $1 and kind = 'meeting'", [org])).rows[0].rev;
  await push(oldPc, [{ kind: "meeting", id: "meeting", baseRev: cur, body: { title: "Sunday" } }]);
  const row = (await db.query("select body from entities where organization_id = $1 and kind = 'meeting'", [org])).rows[0].body;
  assert.equal(row.meetings, undefined);
  assert.ok(await denied(OWNER, "select meetings_supported()"));
  await db.exec(readFileSync(new URL("../supabase/migrations/0012_meetings.sql", import.meta.url), "utf8"));
});
