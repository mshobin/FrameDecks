// 0013: a team's owner cannot be demoted or removed by an admin, a membership stays with its person and team, only the
// owner changes roles or adds people directly, and the website's own membership writes still work. The rollback
// restores 0001's rules.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000000a1";
const ADMIN = "00000000-0000-0000-0000-0000000000a2";
const MEMBER = "00000000-0000-0000-0000-0000000000a3";
const OUTSIDER = "00000000-0000-0000-0000-0000000000a4";
const NEWCOMER = "00000000-0000-0000-0000-0000000000a5";

let db, as, denied, org, other;

const role = async (uid, o = org) =>
  (await db.query("select role from memberships where organization_id = $1 and user_id = $2", [o, uid])).rows[0]?.role;

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({
    [OWNER]: "owner@example.org", [ADMIN]: "admin@example.org", [MEMBER]: "member@example.org",
    [OUTSIDER]: "outsider@example.org", [NEWCOMER]: "new@example.org",
  }));
  org = (await as(OWNER, "insert into organizations(name, created_by) values ('Team', $1) returning id", [OWNER])).rows[0].id;
  other = (await as(OUTSIDER, "insert into organizations(name, created_by) values ('Other', $1) returning id", [OUTSIDER])).rows[0].id;
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member')", [org, ADMIN, MEMBER]);
});

after(() => db?.close());

test("an admin can neither demote nor remove the owner (the audit's attack)", async () => {
  const demoted = await as(ADMIN, "update memberships set role = 'member' where organization_id = $1 and user_id = $2 returning 1", [org, OWNER]);
  assert.equal(demoted.rows.length, 0, "the owner's row is out of reach");
  const removed = await as(ADMIN, "delete from memberships where organization_id = $1 and user_id = $2 returning 1", [org, OWNER]);
  assert.equal(removed.rows.length, 0);
  assert.equal(await role(OWNER), "owner");
  assert.equal((await as(ADMIN, "update memberships set can_run_services = true where organization_id = $1 and user_id = $2 returning 1", [org, OWNER])).rows.length, 0);
});

test("the owner cannot demote themselves into a team without an owner", async () => {
  assert.equal((await as(OWNER, "update memberships set role = 'admin' where organization_id = $1 and user_id = $2 returning 1", [org, OWNER])).rows.length, 0);
  assert.equal(await role(OWNER), "owner");
});

test("a membership stays with its person and its team", async () => {
  assert.ok(await denied(OWNER, "update memberships set user_id = $3 where organization_id = $1 and user_id = $2", [org, MEMBER, OUTSIDER]));
  assert.ok(await denied(OWNER, "update memberships set organization_id = $3 where organization_id = $1 and user_id = $2", [org, MEMBER, other]));
  assert.ok(await denied(ADMIN, "update memberships set user_id = $3 where organization_id = $1 and user_id = $2", [org, MEMBER, ADMIN]));
  assert.equal(await role(MEMBER), "member");
});

test("only the owner changes roles; admins keep Can run services and removing non-owners", async () => {
  assert.ok(await denied(ADMIN, "update memberships set role = 'admin' where organization_id = $1 and user_id = $2", [org, MEMBER]));
  assert.equal(await role(MEMBER), "member");
  // the website's own writes (workspace-members.tsx): Can run services, as an admin and as the owner
  assert.equal((await as(ADMIN, "update memberships set can_run_services = true where organization_id = $1 and user_id = $2 returning 1", [org, MEMBER])).rows.length, 1);
  assert.equal((await as(OWNER, "update memberships set can_run_services = false where organization_id = $1 and user_id = $2 returning 1", [org, MEMBER])).rows.length, 1);
  // the owner promotes and demotes, but never makes another owner through the website
  await as(OWNER, "update memberships set role = 'admin' where organization_id = $1 and user_id = $2", [org, MEMBER]);
  assert.equal(await role(MEMBER), "admin");
  await as(OWNER, "update memberships set role = 'member' where organization_id = $1 and user_id = $2", [org, MEMBER]);
  assert.ok(await denied(OWNER, "update memberships set role = 'owner' where organization_id = $1 and user_id = $2", [org, MEMBER]));
  assert.equal(await role(MEMBER), "member");
});

test("only the owner adds someone directly; an admin invites instead", async () => {
  assert.ok(await denied(ADMIN, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'member')", [org, NEWCOMER]));
  assert.ok(await denied(MEMBER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'member')", [org, NEWCOMER]));
  assert.ok(await denied(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'owner')", [org, NEWCOMER]));
  assert.equal(await role(NEWCOMER), undefined);
  // the invitation route still works (accept_invitation runs as the database owner)
  const inv = (await as(ADMIN, "insert into invitations(organization_id, email, role, invited_by) values ($1, 'new@example.org', 'member', $2) returning id",
    [org, ADMIN])).rows[0];
  await as(NEWCOMER, "select accept_invitation($1)", [inv.id]);
  assert.equal(await role(NEWCOMER), "member");
});

test("leaving and removing still work as before", async () => {
  assert.equal((await as(NEWCOMER, "delete from memberships where organization_id = $1 and user_id = $2 returning 1", [org, NEWCOMER])).rows.length, 1);
  assert.equal((await as(ADMIN, "delete from memberships where organization_id = $1 and user_id = $2 returning 1", [org, MEMBER])).rows.length, 1);
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'member')", [org, MEMBER]);
});

test("the database's own work is not affected (deleting an account hands a team on)", async () => {
  await db.query("update memberships set role = 'owner' where organization_id = $1 and user_id = $2", [other, OUTSIDER]);
  assert.equal(await role(OUTSIDER, other), "owner");
});

test("the rollback restores 0001's rules", async () => {
  // rollbacks run newest first: 0028's admin rules use is_org_owner
  await db.exec(readFileSync(new URL("../supabase/rollback/0028_codes_limits_retention_down.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/rollback/0013_protect_owner_down.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select to_regprocedure('public.is_org_owner(uuid)') as f")).rows[0].f, null);
  assert.equal((await as(ADMIN, "update memberships set role = 'admin' where organization_id = $1 and user_id = $2 returning 1", [org, MEMBER])).rows.length, 1,
    "admins change roles again, as before 0013");
  assert.equal((await as(ADMIN, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'member') returning 1", [org, NEWCOMER])).rows.length, 1);
});
