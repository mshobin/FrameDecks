import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

// Phase 5 (docs/architecture/remote-control-design.md): phones leave commands, the linked PC takes them with its key.
const OWNER = "00000000-0000-0000-0000-0000000000c1";
const RUNNER = "00000000-0000-0000-0000-0000000000c2";
const VIEWER = "00000000-0000-0000-0000-0000000000c3";
const OUTSIDER = "00000000-0000-0000-0000-0000000000c4";

let db;
let as;
let denied;
let org;
let pc;
let otherPc;
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
async function computerDenied(k, sql, params) {
  try {
    await asComputer(k, sql, params);
    return false;
  } catch {
    return true;
  }
}
const send = (uid, op, args = {}, computer = pc) =>
  as(uid, "select remote_send($1, $2, $3::jsonb) as id", [computer, op, JSON.stringify(args)]).then((r) => r.rows[0].id);
const take = (k = key) => asComputer(k, "select remote_take() as r").then((r) => r.rows[0].r);
const age = (seconds) => db.query(`update remote_commands set created_at = now() - interval '${seconds} seconds' where taken_at is null`);

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({
    [OWNER]: "owner@church.org",
    [RUNNER]: "runner@church.org",
    [VIEWER]: "viewer@church.org",
    [OUTSIDER]: "x@else.org",
  }));
  org = (await as(OWNER, "insert into organizations(name, created_by) values ('Evening Study', $1) returning id", [OWNER])).rows[0].id;
  const other = (await as(OUTSIDER, "insert into organizations(name, created_by) values ('Elsewhere', $1) returning id", [OUTSIDER]))
    .rows[0].id;
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'member'), ($1, $3, 'member')", [org, RUNNER, VIEWER]);
  await as(OWNER, "insert into profiles(user_id, display_name) values ($1, 'Shobin')", [OWNER]);
  pc = (await db.query("insert into computers(organization_id, name, key_hash) values ($1, 'CHURCH-PC', $2) returning id", [org, hash(key)])).rows[0].id;
  otherPc = (await db.query("insert into computers(organization_id, name, key_hash) values ($1, 'OTHER', $2) returning id", [other, hash(otherKey)]))
    .rows[0].id;
});

after(() => db?.close());

test("owners and admins may run services; a member only once an admin allows it", async () => {
  assert.ok(await send(OWNER, "next"));
  assert.ok(await denied(RUNNER, "select remote_send($1, 'next')", [pc]));
  const selfGrant = await as(RUNNER, "update memberships set can_run_services = true where user_id = $1 returning 1", [RUNNER]);
  assert.equal(selfGrant.rows.length, 0, "a member cannot give themselves the permission");
  await as(OWNER, "update memberships set can_run_services = true where organization_id = $1 and user_id = $2", [org, RUNNER]);
  assert.ok(await send(RUNNER, "previous"));
  assert.ok(await denied(VIEWER, "select remote_send($1, 'next')", [pc]));
  assert.ok(await denied(OUTSIDER, "select remote_send($1, 'next')", [pc]));
  assert.ok(await denied(OWNER, "select remote_send($1, 'next')", [otherPc]), "not another workspace's PC");
});

test("only the listed actions, with small arguments", async () => {
  assert.ok(await denied(OWNER, "select remote_send($1, 'delete_everything')", [pc]));
  assert.ok(await denied(OWNER, "select remote_send($1, 'go_live', $2::jsonb)", [pc, JSON.stringify({ x: "y".repeat(2000) })]));
  assert.ok(await send(OWNER, "go_live", { frame: "sc_1" }));
});

test("the PC takes its own commands once, oldest first, with who sent them", async () => {
  const first = await take();
  assert.deepEqual(first.map((c) => [c.op, c.by]), [["next", "Shobin"], ["previous", "runner@church.org"], ["go_live", "Shobin"]]);
  assert.deepEqual(first[2].args, { frame: "sc_1" });
  assert.deepEqual(await take(), [], "never twice");
  assert.deepEqual(await take(otherKey), [], "another PC gets nothing of this one");
  assert.ok(await computerDenied(randomBytes(32).toString("base64url"), "select remote_take()"));
});

test("late commands are answered 'expired', never run", async () => {
  await send(OWNER, "hide_all");
  await age(11);
  assert.deepEqual(await take(), []);
  assert.equal((await db.query("select result from remote_commands where op = 'hide_all'")).rows[0].result, "expired");
});

test("a command whose sender lost the permission is refused at the PC's turn", async () => {
  await send(RUNNER, "blackout", { on: true });
  await as(OWNER, "update memberships set can_run_services = false where organization_id = $1 and user_id = $2", [org, RUNNER]);
  assert.deepEqual(await take(), []);
  assert.equal((await db.query("select result from remote_commands where op = 'blackout'")).rows[0].result, "refused");
});

test("the PC reports results and publishes its status; only people who may run services read them", async () => {
  const id = await send(OWNER, "question", { show: true });
  await take();
  await asComputer(key, "select remote_report($1::jsonb)", [JSON.stringify([{ id, result: "done" }])]);
  await asComputer(key, "select remote_publish($1::jsonb)", [JSON.stringify({ frame: "Prayer", number: 3, blackout: false })]);
  assert.equal((await as(OWNER, "select result from remote_commands where id = $1", [id])).rows[0].result, "done");
  assert.equal((await as(OWNER, "select status from remote_status")).rows[0].status.frame, "Prayer");
  assert.equal((await as(VIEWER, "select * from remote_status")).rows.length, 0);
  assert.equal((await as(VIEWER, "select * from remote_commands")).rows.length, 0);
  assert.equal((await as(OUTSIDER, "select * from remote_status")).rows.length, 0);
  await asComputer(otherKey, "select remote_report($1::jsonb)", [JSON.stringify([{ id, result: "hacked" }])]);
  assert.equal((await as(OWNER, "select result from remote_commands where id = $1", [id])).rows[0].result, "done", "another PC cannot answer");
  assert.ok(await denied(OWNER, "insert into remote_status(computer_id, organization_id, status) values ($1, $2, '{}')", [pc, org]));
});

test("the Live page lists the PCs with their status for people who may run services only (0005)", async () => {
  const rows = (await as(OWNER, "select * from remote_computers($1)", [org])).rows;
  assert.deepEqual(rows.map((r) => [r.name, r.status?.frame]), [["CHURCH-PC", "Prayer"]]);
  assert.ok(rows[0].server_now, "the server's clock, so a phone with a wrong clock still sees online/offline right");
  assert.equal((await as(VIEWER, "select * from remote_computers($1)", [org])).rows.length, 0);
  assert.equal((await as(OUTSIDER, "select * from remote_computers($1)", [org])).rows.length, 0);
  await as(OWNER, "update memberships set can_run_services = true where organization_id = $1 and user_id = $2", [org, VIEWER]);
  assert.equal((await as(VIEWER, "select * from remote_computers($1)", [org])).rows.length, 1);
  await as(OWNER, "update memberships set can_run_services = false where organization_id = $1 and user_id = $2", [org, VIEWER]);
});

test("a revoked PC can neither take, report nor publish, and receives no new commands", async () => {
  await db.query("update computers set revoked_at = now() where id = $1", [pc]);
  assert.ok(await computerDenied(key, "select remote_take()"));
  assert.ok(await computerDenied(key, "select remote_publish('{}'::jsonb)"));
  assert.ok(await denied(OWNER, "select remote_send($1, 'next')", [pc]));
  assert.equal((await as(OWNER, "select * from remote_computers($1)", [org])).rows.length, 0, "no longer listed");
});

test("the anonymous role without a key cannot send or take", async () => {
  await db.exec("select set_config('request.uid', '', false); set role anon");
  try {
    await assert.rejects(db.query("select remote_send($1, 'next')", [pc]));
    await assert.rejects(db.query("select remote_take()"));
    await assert.rejects(db.query("select * from remote_commands"));
  } finally {
    await db.exec("reset role");
  }
});
