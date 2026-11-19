// 0031 (26.11.65 member details stay on the church's PC): a new workspace keeps them local; workspaces made before 0031
// keep sharing; the database stores no member record (and no history of one) while a workspace keeps them local, from a
// PC or from the website, while plans still sync; sync_pull says whether they are shared; only the owner (not an admin)
// changes it, never by editing the workspace directly; turning it off removes member records, their history and group
// assignments at once and is written to the audit log; the rollback removes it all.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000031a1";
const ADMIN = "00000000-0000-0000-0000-0000000031a2";
const KEY = "pc-key-members-local-0123456789abcdef0123";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

let db, as, denied, org;
const one = async (p) => (await p).rows[0];

async function pc(sql, params) {
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify({ "x-framedecks-computer": KEY })}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
  }
}
const pull = async () => (await one(pc("select sync_pull($1, 0, 500) as r", [org]))).r;
const push = async (changes) => (await one(pc("select sync_push($1, $2::jsonb) as r", [org, JSON.stringify(changes)]))).r;
const rows = async (kind) =>
  (await one(db.query("select count(*)::int as n from public.entities where organization_id = $1 and kind = $2", [org, kind]))).n;
const history = async () =>
  (await one(db.query("select count(*)::int as n from public.entity_history where organization_id = $1 and kind = 'member'", [org]))).n;
const person = (id, name, baseRev = 0) => ({ kind: "member", id, baseRev, body: { id, name, phone: "+965 5000 0000" } });

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({ [OWNER]: "owner@x.org", [ADMIN]: "admin@x.org" }));
  org = (await as(OWNER, "insert into organizations(name, created_by) values ('Grace Church', $1) returning id", [OWNER])).rows[0].id;
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'admin')", [org, ADMIN]);
  await db.query("insert into public.computers (organization_id, name, key_hash) values ($1, 'CHURCH-PC', $2)", [org, sha(KEY)]);
});
after(() => db?.close());

test("workspaces made before 0031 keep sharing; the migration sets them all to shared", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0031_members_local.sql", import.meta.url), "utf8");
  assert.match(sql, /add column members_shared boolean not null default false;\nupdate public\.organizations set members_shared = true;/);
});

test("a new workspace keeps member details on its PC, even if it asks otherwise", async () => {
  assert.equal((await one(db.query("select members_shared from organizations where id = $1", [org]))).members_shared, false);
  const other = await as(OWNER, "insert into organizations(name, created_by, members_shared) values ('Try', $1, true) returning members_shared", [OWNER]);
  assert.equal(other.rows[0].members_shared, false);
  assert.equal((await pull()).membersShared, false);
});

test("while local, the database stores no member record from the PC or the website, and plans still sync", async () => {
  const answer = await push([person("m1", "Mary"), { kind: "frame", id: "sc_1", baseRev: 0, body: { id: "sc_1", name: "Welcome" } }]);
  assert.equal(answer.results.length, 2, "the batch goes through");
  assert.equal(await rows("member"), 0);
  assert.equal(await rows("frame"), 1);
  await as(ADMIN, "select sync_push($1, $2::jsonb)", [org, JSON.stringify([person("m2", "John")])]);
  assert.equal(await rows("member"), 0);
  assert.deepEqual((await pull()).entities.map((e) => e.kind), ["frame"]);
});

test("only the owner changes it: not an admin, not by editing the workspace", async () => {
  assert.ok(await denied(ADMIN, "select set_members_shared($1, true)", [org]));
  assert.ok(await denied(ADMIN, "update organizations set members_shared = true where id = $1", [org]));
  assert.ok(await denied(OWNER, "update organizations set members_shared = true where id = $1", [org]));
  await as(ADMIN, "update organizations set name = 'Grace Church Kuwait' where id = $1", [org]);   // the name still can
  await assert.rejects(pc("select set_members_shared($1, true)", [org]));
});

test("shared: member records sync and the PC is told", async () => {
  assert.deepEqual((await as(OWNER, "select set_members_shared($1, true) as r", [org])).rows[0].r, { shared: true, removed: 0 });
  assert.equal((await pull()).membersShared, true);
  await push([person("m1", "Mary")]);
  await push([person("m1", "Mary Ann", 1)]);
  assert.equal(await rows("member"), 1);
  assert.equal(await history(), 1);
  assert.ok((await pull()).entities.some((e) => e.kind === "member"));
  const g = (await as(OWNER, "insert into member_groups(organization_id, name) values ($1, 'Youth') returning id", [org])).rows[0].id;
  await as(OWNER, "insert into member_group_members(organization_id, group_id, member_id) values ($1, $2, 'm1')", [org, g]);
});

test("turning it off removes member records, their history and group assignments at once, and is audited", async () => {
  assert.deepEqual((await as(OWNER, "select set_members_shared($1, false) as r", [org])).rows[0].r, { shared: false, removed: 1 });
  assert.equal(await rows("member"), 0);
  assert.equal(await history(), 0);
  assert.equal((await one(db.query("select count(*)::int as n from member_group_members where organization_id = $1", [org]))).n, 0);
  assert.equal((await one(db.query("select count(*)::int as n from member_groups where organization_id = $1", [org]))).n, 1, "group names stay");
  assert.equal(await rows("frame"), 1, "plans stay");
  const log = await db.query("select action, detail from audit_log where organization_id = $1 and action = 'workspace.members_shared' order by id", [org]);
  assert.deepEqual(log.rows.map((r) => r.detail.to), [true, false]);
  assert.equal((await pull()).membersShared, false);
});

test("rollback removes 0031 and sync_pull answers as before", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0031_members_local_down.sql", import.meta.url), "utf8"));
  const left = await db.query("select count(*)::int as n from pg_proc where proname in ('set_members_shared', 'entities_members_local', 'guard_members_shared')");
  assert.equal(left.rows[0].n, 0);
  const col = await db.query("select count(*)::int as n from information_schema.columns where table_name = 'organizations' and column_name = 'members_shared'");
  assert.equal(col.rows[0].n, 0);
  const page = await pull();
  assert.equal("membersShared" in page, false);
  await push([person("m3", "Ruth")]);
  assert.equal(await rows("member"), 1, "member records sync again as before 0031");
});
