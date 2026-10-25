import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000000a1";
const ADMIN = "00000000-0000-0000-0000-0000000000a2";
const INVITEE = "00000000-0000-0000-0000-0000000000a3";
const OUTSIDER = "00000000-0000-0000-0000-0000000000a4";

let db;
let as;
let denied;
let org;

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({
    [OWNER]: "owner@church.org",
    [ADMIN]: "admin@church.org",
    [INVITEE]: "Invitee@Church.org",
    [OUTSIDER]: "outsider@else.org",
  }));
  org = (await as(OWNER, "insert into organizations(name, created_by) values ('BSF Study', $1) returning id", [OWNER]))
    .rows[0].id;
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'admin')", [org, ADMIN]);
});

after(() => db?.close());

const invite = (uid, email, role = "member") =>
  as(uid, "insert into invitations(organization_id, email, role, invited_by) values ($1, $2, $3, $4) returning id", [
    org,
    email,
    role,
    uid,
  ]);

test("only owners and admins invite, as themselves, never as owner, with a valid lower-case email", async () => {
  assert.ok(await denied(OUTSIDER, "insert into invitations(organization_id, email, invited_by) values ($1, 'x@y.org', $2)", [org, OUTSIDER]));
  assert.ok(await denied(ADMIN, "insert into invitations(organization_id, email, invited_by) values ($1, 'x@y.org', $2)", [org, OWNER]));
  assert.ok(await denied(OWNER, "insert into invitations(organization_id, email, role, invited_by) values ($1, 'x@y.org', 'owner', $2)", [org, OWNER]));
  assert.ok(await denied(OWNER, "insert into invitations(organization_id, email, invited_by) values ($1, 'not-an-email', $2)", [org, OWNER]));
  assert.ok(await denied(OWNER, "insert into invitations(organization_id, email, invited_by) values ($1, 'Upper@Case.org', $2)", [org, OWNER]));
  assert.equal((await invite(ADMIN, "invitee@church.org")).rows.length, 1);
  assert.ok(await denied(OWNER, "insert into invitations(organization_id, email, invited_by) values ($1, 'invitee@church.org', $2)", [org, OWNER]));
});

test("the invitee sees their invitation with the workspace name; outsiders and plain members do not", async () => {
  const mine = await as(INVITEE, "select organization_name, role from my_invitations()");
  assert.deepEqual(mine.rows, [{ organization_name: "BSF Study", role: "member" }]);
  assert.equal((await as(OUTSIDER, "select * from my_invitations()")).rows.length, 0);
  assert.equal((await as(OUTSIDER, "select * from invitations")).rows.length, 0);
  assert.equal((await as(ADMIN, "select * from invitations")).rows.length, 1);
});

test("only the invitee can accept, once, and joins with the invited role", async () => {
  const id = (await as(INVITEE, "select id from my_invitations()")).rows[0].id;
  assert.ok(await denied(OUTSIDER, "select accept_invitation($1)", [id]));
  assert.equal((await as(INVITEE, "select accept_invitation($1) as org", [id])).rows[0].org, org);
  const role = await as(INVITEE, "select role from memberships where organization_id = $1 and user_id = $2", [org, INVITEE]);
  assert.equal(role.rows[0]?.role, "member");
  assert.equal((await as(INVITEE, "select * from my_invitations()")).rows.length, 0);
  assert.ok(await denied(INVITEE, "select accept_invitation($1)", [id]));
});

test("members see each other's names and emails; outsiders see nobody", async () => {
  await as(OWNER, "insert into profiles(user_id, display_name) values ($1, 'Shobin')", [OWNER]);
  const members = await as(INVITEE, "select email, role, display_name from workspace_members($1)", [org]);
  assert.deepEqual(
    members.rows.map((m) => [m.email, m.role, m.display_name]),
    [
      ["owner@church.org", "owner", "Shobin"],
      ["admin@church.org", "admin", null],
      ["Invitee@Church.org", "member", null],
    ],
  );
  assert.equal((await as(OUTSIDER, "select * from workspace_members($1)", [org])).rows.length, 0);
});

test("the invitee or an admin can cancel an invitation; an outsider cannot", async () => {
  const pending = (await invite(OWNER, "later@church.org")).rows[0].id;
  assert.equal((await as(OUTSIDER, "delete from invitations where id = $1 returning id", [pending])).rows.length, 0);
  assert.equal((await as(ADMIN, "delete from invitations where id = $1 returning id", [pending])).rows.length, 1);
  await invite(OWNER, "outsider@else.org");
  assert.equal((await as(OUTSIDER, "delete from invitations where organization_id = $1 returning id", [org])).rows.length, 1);
});

test("admins remove members but never the owner; anyone may leave", async () => {
  const removeOwner = "delete from memberships where organization_id = $1 and user_id = $2 returning 1";
  assert.equal((await as(ADMIN, removeOwner, [org, OWNER])).rows.length, 0);
  assert.equal((await as(INVITEE, removeOwner, [org, ADMIN])).rows.length, 0);
  assert.equal((await as(ADMIN, removeOwner, [org, INVITEE])).rows.length, 1);
  assert.equal((await as(ADMIN, removeOwner, [org, ADMIN])).rows.length, 1);
});

test("the anonymous role cannot call the invitation functions", async () => {
  await db.exec("set role anon");
  try {
    await assert.rejects(db.query("select * from my_invitations()"));
    await assert.rejects(db.query("select * from workspace_members($1)", [org]));
  } finally {
    await db.exec("reset role");
  }
});
