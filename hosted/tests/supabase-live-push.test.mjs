import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

// 0016 live push (docs/architecture/live-push.md): the doorbell for PCs, the private channel for the Live page.
const OWNER = "00000000-0000-0000-0000-0000000001c1";
const RUNNER = "00000000-0000-0000-0000-0000000001c2";
const VIEWER = "00000000-0000-0000-0000-0000000001c3";
const OUTSIDER = "00000000-0000-0000-0000-0000000001c4";

let db;
let as;
let denied;
let org;
let pc;
const key = randomBytes(32).toString("base64url");
const otherKey = randomBytes(32).toString("base64url");
const hash = (k) => createHash("sha256").update(k, "utf8").digest("hex");

async function asComputer(k, sql, params) {
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify({ "x-framedecks-computer": k })}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
  }
}
const hello = (control = false, k = key) =>
  asComputer(k, "select computer_hello($1) as r", [control]).then((r) => r.rows[0].r);
const messages = () => db.query("select topic, event, payload, private from realtime.messages order by id").then((r) => r.rows);
const clear = () => db.query("delete from realtime.messages");
const send = (uid, op, args = {}) =>
  as(uid, "select remote_send($1, $2, $3::jsonb) as id", [pc, op, JSON.stringify(args)]).then((r) => r.rows[0].id);

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({
    [OWNER]: "owner@church.org",
    [RUNNER]: "runner@church.org",
    [VIEWER]: "viewer@church.org",
    [OUTSIDER]: "x@else.org",
  }));
  org = (await as(OWNER, "insert into organizations(name, created_by) values ('Evening Study', $1) returning id", [OWNER])).rows[0].id;
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'member'), ($1, $3, 'member')", [org, RUNNER, VIEWER]);
  await db.query("update memberships set can_run_services = true where user_id = $1", [RUNNER]);
  pc = (await db.query("insert into computers(organization_id, name, key_hash) values ($1, 'CHURCH-PC', $2) returning id", [org, hash(key)])).rows[0].id;
});

after(async () => {
  await db?.close();
});

test("a linked PC learns its workspace's bell, and nobody else can ask", async () => {
  const h = await hello();
  assert.equal(h.push, true);
  assert.match(h.bell, /^[0-9a-f]{64}$/);
  assert.equal(h.watched, false);
  assert.equal(h.seq, 0);
  assert.equal((await hello()).bell, h.bell, "the same bell every time");
  await assert.rejects(hello(false, otherKey));
  assert.ok(await denied(RUNNER, "select computer_hello(false)"));
  assert.ok(await denied(OWNER, "select * from workspace_bells"));
});

test("a phone's command rings the PC's bell with no data but which PC it is for", async () => {
  const { bell } = await hello();
  await clear();
  await send(RUNNER, "next");
  const rung = await messages();
  assert.deepEqual(rung, [{ topic: `bell:${bell}`, event: "cmd", payload: { pc }, private: false }]);
});

test("taking and answering a command tells the Live page's private channel, and so does a new status", async () => {
  await send(RUNNER, "next");
  await clear();
  const taken = (await asComputer(key, "select remote_take() as r")).rows[0].r;
  await asComputer(key, "select remote_report($1::jsonb)", [JSON.stringify([{ id: taken[0].id, result: "done" }])]);
  await asComputer(key, "select remote_publish($1::jsonb)", [JSON.stringify({ frame: null, count: 0, push: true })]);
  const got = await messages();
  assert.ok(got.every((m) => m.topic === `live:${org}` && m.private && m.payload.pc === pc), JSON.stringify(got));
  const results = got.filter((m) => m.event === "result");
  assert.ok(results.length >= 2, "taken, then answered");
  assert.ok(results.some((m) => m.payload.id === taken[0].id));
  assert.equal(got.at(-1).event, "status");
});

test("a sync push rings once, however many records it carries", async () => {
  const { bell } = await hello();
  await clear();
  const changes = ["a", "b", "c"].map((id) => ({ kind: "frame", id, baseRev: 0, body: { name: id } }));
  await asComputer(key, "select sync_push($1, $2::jsonb)", [org, JSON.stringify(changes)]);
  assert.deepEqual(await messages(), [{ topic: `bell:${bell}`, event: "sync", payload: {}, private: false }]);
  assert.equal((await hello()).seq, 3, "an asleep PC compares this with its cursor");
});

test("the Live page wakes a PC: only people who may run services, and it rings at most about once a minute", async () => {
  const { bell } = await hello();
  await clear();
  assert.ok(await denied(VIEWER, "select remote_watch($1)", [pc]));
  assert.ok(await denied(OUTSIDER, "select remote_watch($1)", [pc]));
  await as(RUNNER, "select remote_watch($1)", [pc]);
  await as(RUNNER, "select remote_watch($1)", [pc]);
  assert.deepEqual(await messages(), [{ topic: `bell:${bell}`, event: "watch", payload: { pc }, private: false }]);
  assert.equal((await hello()).watched, true);
});

test("live_computers says which PCs take commands, for people who may run services only", async () => {
  await hello(true);
  const rows = (await as(RUNNER, "select id, control_seen_at, push from live_computers($1)", [org])).rows;
  assert.equal(rows.length, 1);
  assert.ok(rows[0].control_seen_at);
  assert.equal(rows[0].push, true);
  assert.equal((await as(VIEWER, "select * from live_computers($1)", [org])).rows.length, 0);
  await hello(false);
  assert.equal((await as(RUNNER, "select control_seen_at from live_computers($1)", [org])).rows[0].control_seen_at, null);
});

test("only people who may run services can listen on live:<workspace>", async () => {
  await clear();
  await asComputer(key, "select remote_publish($1::jsonb)", [JSON.stringify({ frame: null, count: 0 })]);
  const listen = async (uid, topic) => {
    await db.query("select set_config('realtime.topic', $1, false)", [topic]);
    try {
      return (await as(uid, "select event from realtime.messages")).rows.length;
    } finally {
      await db.query("select set_config('realtime.topic', '', false)");
    }
  };
  assert.equal(await listen(RUNNER, `live:${org}`), 1);
  assert.equal(await listen(OWNER, `live:${org}`), 1);
  assert.equal(await listen(VIEWER, `live:${org}`), 0);
  assert.equal(await listen(OUTSIDER, `live:${org}`), 0);
  assert.equal(await listen(RUNNER, "live:not-a-workspace"), 0);
  assert.equal(await listen(RUNNER, `bell:${(await hello()).bell}`), 0, "the bell is not a private channel");
});

test("if Realtime fails, commands and syncs still work", async () => {
  await db.exec("alter function realtime.send(jsonb, text, text, boolean) rename to send_away");
  try {
    const id = await send(RUNNER, "previous");
    assert.ok(id);
    await asComputer(key, "select sync_push($1, $2::jsonb)", [org, JSON.stringify([{ kind: "frame", id: "z", baseRev: 0, body: {} }])]);
  } finally {
    await db.exec("alter function realtime.send_away(jsonb, text, text, boolean) rename to send");
  }
});

test("the switch turns push off for everyone: no bell, no rings", async () => {
  await db.query("update live_push set enabled = false");
  try {
    await clear();
    const h = await hello();
    assert.equal(h.push, false);
    assert.equal(h.bell, null);
    await send(RUNNER, "next");
    assert.deepEqual(await messages(), []);
  } finally {
    await db.query("update live_push set enabled = true");
  }
});

test("unlinking a PC gives the workspace a new bell", async () => {
  const before = (await hello()).bell;
  const spare = randomBytes(32).toString("base64url");
  const gone = (await db.query("insert into computers(organization_id, name, key_hash) values ($1, 'OLD', $2) returning id", [org, hash(spare)])).rows[0].id;
  await db.query("update computers set revoked_at = now() where id = $1", [gone]);
  const after = (await hello()).bell;
  assert.notEqual(after, before);
  await assert.rejects(hello(false, spare));
});
