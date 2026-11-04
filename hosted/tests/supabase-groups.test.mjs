import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

// Migration step 8 (M-D6): member groups for owners and admins, in the cloud only.
const OWNER = "00000000-0000-0000-0000-0000000000e1";
const ADMIN = "00000000-0000-0000-0000-0000000000e2";
const MEMBER = "00000000-0000-0000-0000-0000000000e3";
const OUTSIDER = "00000000-0000-0000-0000-0000000000e4";

let db;
let as;
let denied;
let org;
let other;

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({
    [OWNER]: "owner@church.org",
    [ADMIN]: "admin@church.org",
    [MEMBER]: "member@church.org",
    [OUTSIDER]: "x@else.org",
  }));
  org = (await as(OWNER, "insert into organizations(name, created_by) values ('Evening Study', $1) returning id", [OWNER])).rows[0].id;
  other = (await as(OUTSIDER, "insert into organizations(name, created_by) values ('Elsewhere', $1) returning id", [OUTSIDER])).rows[0].id;
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member')", [org, ADMIN, MEMBER]);
});

after(() => db?.close());

const makeGroup = (uid, name, workspace = org) =>
  as(uid, "insert into member_groups(organization_id, name) values ($1, $2) returning id", [workspace, name]).then((r) => r.rows[0].id);

test("owners and admins make, rename and remove groups; names are unique in a workspace whatever their case", async () => {
  const leaders = await makeGroup(ADMIN, "Leaders");
  assert.ok(await denied(OWNER, "insert into member_groups(organization_id, name) values ($1, 'leaders')", [org]));
  assert.ok(await denied(OWNER, "insert into member_groups(organization_id, name) values ($1, ' Padded ')", [org]));
  assert.ok(await denied(OWNER, "insert into member_groups(organization_id, name) values ($1, '')", [org]));
  await as(OWNER, "update member_groups set name = 'Group leaders' where id = $1", [leaders]);
  const log = await db.query("select action, detail from audit_log where organization_id = $1 and action like 'group.%' order by id", [org]);
  assert.deepEqual(log.rows.map((r) => r.action), ["group.created", "group.renamed"]);
  assert.deepEqual(log.rows[1].detail, { from: "Leaders", to: "Group leaders" });
  assert.equal((await makeGroup(OUTSIDER, "Leaders", other)).length, 36, "another workspace may use the same name");
});

test("plain members and outsiders cannot see or change groups", async () => {
  assert.equal((await as(MEMBER, "select * from member_groups")).rows.length, 0);
  assert.equal((await as(OUTSIDER, "select * from member_groups where organization_id = $1", [org])).rows.length, 0);
  assert.ok(await denied(MEMBER, "insert into member_groups(organization_id, name) values ($1, 'Mine')", [org]));
  assert.equal((await as(MEMBER, "delete from member_groups returning id")).rows.length, 0);
});

test("people are added to and removed from a group, only within its own workspace", async () => {
  const choir = await makeGroup(OWNER, "Choir");
  await as(ADMIN, "insert into member_group_members(organization_id, group_id, member_id) values ($1, $2, 'm1'), ($1, $2, 'm2')", [org, choir]);
  assert.ok(await denied(ADMIN, "insert into member_group_members(organization_id, group_id, member_id) values ($1, $2, 'm1')", [org, choir]));
  assert.ok(await denied(OUTSIDER, "insert into member_group_members(organization_id, group_id, member_id) values ($1, $2, 'm3')", [other, choir]),
    "a group cannot be filled from another workspace");
  assert.equal((await as(MEMBER, "select * from member_group_members")).rows.length, 0);
  await as(ADMIN, "delete from member_group_members where group_id = $1 and member_id = 'm2'", [choir]);
  const left = await as(OWNER, "select member_id from member_group_members where group_id = $1", [choir]);
  assert.deepEqual(left.rows, [{ member_id: "m1" }]);
  await as(OWNER, "delete from member_groups where id = $1", [choir]);
  assert.equal((await db.query("select count(*)::int as n from member_group_members where group_id = $1", [choir])).rows[0].n, 0);
});

test("deleting a workspace deletes its groups; the undo script leaves the rest working", async () => {
  await as(OUTSIDER, "delete from organizations where id = $1", [other]);
  assert.equal((await db.query("select count(*)::int as n from member_groups where organization_id = $1", [other])).rows[0].n, 0);
  await db.exec(readFileSync(new URL("../supabase/rollback/0008_member_groups_down.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select to_regclass('public.member_groups') as t")).rows[0].t, null);
  await as(OWNER, "delete from organizations where id = $1", [org]);
});
