import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

// Migration step 1 (docs/project/history/migration-plan.md): the audit log of people and computers, written only by triggers.
const OWNER = "00000000-0000-0000-0000-0000000000d1";
const ADMIN = "00000000-0000-0000-0000-0000000000d2";
const MEMBER = "00000000-0000-0000-0000-0000000000d3";
const INVITEE = "00000000-0000-0000-0000-0000000000d4";
const OUTSIDER = "00000000-0000-0000-0000-0000000000d5";

let db;
let as;
let denied;
let org;
const key = randomBytes(32).toString("base64url");
const hash = (k) => createHash("sha256").update(k, "utf8").digest("hex");
const log = async () =>
  (await db.query("select actor, action, target, detail from audit_log where organization_id = $1 order by id", [org])).rows;
const last = async () => (await log()).at(-1);

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({
    [OWNER]: "owner@church.org",
    [ADMIN]: "admin@church.org",
    [MEMBER]: "member@church.org",
    [INVITEE]: "invitee@church.org",
    [OUTSIDER]: "x@else.org",
  }));
  org = (await as(OWNER, "insert into organizations(name, created_by) values ('BSF Study', $1) returning id", [OWNER])).rows[0].id;
});

after(() => db?.close());

test("creating a workspace logs its owner joining", async () => {
  assert.deepEqual(await log(), [{ actor: OWNER, action: "member.joined", target: OWNER, detail: { role: "owner" } }]);
});

test("members joining, role changes, Can run services and removals are logged with who did it", async () => {
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member')", [org, ADMIN, MEMBER]);
  await as(ADMIN, "update memberships set can_run_services = true where organization_id = $1 and user_id = $2", [org, MEMBER]);
  assert.deepEqual(await last(), { actor: ADMIN, action: "member.can_run_services", target: MEMBER, detail: { to: true } });
  await as(OWNER, "update memberships set role = 'admin' where organization_id = $1 and user_id = $2", [org, MEMBER]);
  assert.deepEqual(await last(), { actor: OWNER, action: "member.role_changed", target: MEMBER, detail: { from: "member", to: "admin" } });
  const before = (await log()).length;
  await as(OWNER, "update memberships set role = 'admin' where organization_id = $1 and user_id = $2", [org, MEMBER]);
  assert.equal((await log()).length, before, "an update that changes nothing is not logged");
  await as(OWNER, "delete from memberships where organization_id = $1 and user_id = $2", [org, MEMBER]);
  assert.deepEqual(await last(), { actor: OWNER, action: "member.removed", target: MEMBER, detail: { role: "admin" } });
});

test("invitations sent, accepted and cancelled are logged", async () => {
  await as(ADMIN, "insert into invitations(organization_id, email, invited_by) values ($1, 'invitee@church.org', $2)", [org, ADMIN]);
  assert.deepEqual(await last(), { actor: ADMIN, action: "invitation.sent", target: "invitee@church.org", detail: { role: "member" } });
  const id = (await as(INVITEE, "select id from my_invitations()")).rows[0].id;
  await as(INVITEE, "select accept_invitation($1)", [id]);
  const tail = (await log()).slice(-2).map((r) => [r.actor, r.action, r.target]);
  assert.deepEqual(tail, [
    [INVITEE, "member.joined", INVITEE],
    [INVITEE, "invitation.removed", "invitee@church.org"],
  ]);
});

test("a computer linked, and unlinked by itself, is logged", async () => {
  const code = (await db.query("select computer_link_start('Church PC', $1) as code", [hash(key)])).rows[0].code;
  const pc = (await as(OWNER, "select computer_link_approve($1, $2) as id", [code, org])).rows[0].id;
  assert.deepEqual(await last(), { actor: OWNER, action: "computer.linked", target: pc, detail: { name: "Church PC" } });
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify({ "x-framedecks-computer": key })}', false)`);
  try {
    await db.query("select computer_revoke($1)", [pc]);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
  }
  assert.deepEqual(await last(), { actor: null, action: "computer.revoked", target: pc, detail: { name: "Church PC" } });
  const n = (await log()).length;
  await as(OWNER, "select computer_revoke($1)", [pc]);
  assert.equal((await log()).length, n, "revoking twice logs once");
});

test("only owners and admins read the log; nobody can write, change or delete it", async () => {
  assert.ok((await as(ADMIN, "select * from audit_log")).rows.length > 0);
  assert.equal((await as(INVITEE, "select * from audit_log")).rows.length, 0);
  assert.equal((await as(OUTSIDER, "select * from audit_log")).rows.length, 0);
  assert.ok(await denied(OWNER, "insert into audit_log(organization_id, action) values ($1, 'fake')", [org]));
  assert.ok(await denied(OWNER, "update audit_log set action = 'x'"));
  assert.ok(await denied(OWNER, "delete from audit_log"));
  assert.ok(await denied(OWNER, "select audit_write($1, 'fake', null, '{}'::jsonb)", [org]));
});

test("entries older than a year are dropped as new ones arrive", async () => {
  await db.query("update audit_log set at = now() - interval '400 days' where organization_id = $1 and action = 'member.joined'", [org]);
  await as(OWNER, "insert into invitations(organization_id, email, invited_by) values ($1, 'later@church.org', $2)", [org, OWNER]);
  assert.ok((await log()).every((r) => r.action !== "member.joined"));
});

test("deleting a workspace still works and takes its log with it", async () => {
  const other = (await as(OUTSIDER, "insert into organizations(name, created_by) values ('Gone', $1) returning id", [OUTSIDER])).rows[0].id;
  await as(OUTSIDER, "delete from organizations where id = $1", [other]);
  assert.equal((await db.query("select count(*)::int as n from audit_log where organization_id = $1", [other])).rows[0].n, 0);
});

test("the rollback script removes the log and leaves the rest working", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0006_audit_log_down.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select to_regclass('public.audit_log') as t")).rows[0].t, null);
  await as(OWNER, "insert into memberships(organization_id, user_id) values ($1, $2)", [org, MEMBER]);
  await as(OWNER, "delete from organizations where id = $1", [org]);
});
