import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

// 7.0 (0011_accounts_legal.sql): accepting the terms, exporting your data, deleting your account without ever
// leaving a workspace without an owner.
const ALICE = "00000000-0000-0000-0000-0000000000e1"; // owner of "Alone" (only her) and co-owner of "Shared"
const BOB = "00000000-0000-0000-0000-0000000000e2"; // owner of "Shared" too
const CAROL = "00000000-0000-0000-0000-0000000000e3"; // sole owner of "Busy", with Dan as a member
const DAN = "00000000-0000-0000-0000-0000000000e4";

let db;
let as;
let denied;
const orgId = async (name) =>
  (await db.query("select id from organizations where name = $1", [name]))
    .rows[0]?.id;

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({
    [ALICE]: "alice@x.org",
    [BOB]: "bob@x.org",
    [CAROL]: "carol@x.org",
    [DAN]: "dan@x.org",
  }));
  await as(
    ALICE,
    "insert into organizations(name, created_by) values ('Alone', $1)",
    [ALICE],
  );
  await as(
    ALICE,
    "insert into organizations(name, created_by) values ('Shared', $1)",
    [ALICE],
  );
  await db.query(
    "insert into memberships(organization_id, user_id, role) values ($1, $2, 'owner')",
    [await orgId("Shared"), BOB],
  );
  await as(
    CAROL,
    "insert into organizations(name, created_by) values ('Busy', $1)",
    [CAROL],
  );
  await db.query(
    "insert into memberships(organization_id, user_id, role) values ($1, $2, 'member')",
    [await orgId("Busy"), DAN],
  );
  await as(
    ALICE,
    "insert into invitations(organization_id, email, invited_by) values ($1, 'carol@x.org', $2)",
    [await orgId("Shared"), ALICE],
  );
});

after(() => db?.close());

test("accepting the terms records the version and time, for yourself only", async () => {
  await as(ALICE, "select accept_terms('2026-10-29')");
  const row = (
    await db.query(
      "select terms_version, terms_accepted_at from profiles where user_id = $1",
      [ALICE],
    )
  ).rows[0];
  assert.equal(row.terms_version, "2026-10-29");
  assert.ok(row.terms_accepted_at);
  assert.ok(await denied(ALICE, "select accept_terms('yes please')"));
  await db.exec("set role anon; select set_config('request.uid','',false)");
  try {
    await assert.rejects(db.query("select accept_terms('2026-10-29')"));
  } finally {
    await db.exec("reset role");
  }
});

test("the export holds your account, workspaces, invitations and log, and nobody else's", async () => {
  const data = (await as(ALICE, "select export_my_data() as d")).rows[0].d;
  assert.equal(data.account.email, "alice@x.org");
  assert.deepEqual(data.workspaces.map((w) => [w.name, w.role]).sort(), [
    ["Alone", "owner"],
    ["Shared", "owner"],
  ]);
  assert.equal(data.invitationsSent.length, 1);
  assert.equal(data.profile.terms_version, "2026-10-29");
  assert.ok(data.changeLog.length >= 2);
  const carol = (await as(CAROL, "select export_my_data() as d")).rows[0].d;
  assert.equal(carol.invitationsReceived.length, 1);
  assert.ok(!JSON.stringify(carol).includes("alice@x.org"));
});

test("a sole owner of a workspace with other people cannot delete the account until someone else is an owner", async () => {
  await assert.rejects(
    as(CAROL, "select delete_my_account()"),
    /Make someone else an owner of Busy first/,
  );
  assert.ok(await orgId("Busy"));
  await db.query(
    "update memberships set role = 'owner' where organization_id = $1 and user_id = $2",
    [await orgId("Busy"), DAN],
  );
  const r = (await as(CAROL, "select delete_my_account() as r")).rows[0].r;
  assert.deepEqual(r, { deleted: true, workspacesDeleted: 0 });
  const busy = (
    await db.query("select created_by from organizations where name = 'Busy'")
  ).rows[0];
  assert.equal(busy.created_by, DAN);
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from auth.users where id = $1",
        [CAROL],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from invitations where email = 'carol@x.org'",
      )
    ).rows[0].n,
    0,
  );
});

test("deleting an account removes the workspaces only you were in, hands shared ones on, and leaves the log nameless", async () => {
  const shared = await orgId("Shared");
  const r = (await as(ALICE, "select delete_my_account() as r")).rows[0].r;
  assert.deepEqual(r, { deleted: true, workspacesDeleted: 1 });
  assert.equal(await orgId("Alone"), undefined);
  assert.equal(
    (
      await db.query("select created_by from organizations where id = $1", [
        shared,
      ])
    ).rows[0].created_by,
    BOB,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from memberships where user_id = $1",
        [ALICE],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from profiles where user_id = $1",
        [ALICE],
      )
    ).rows[0].n,
    0,
  );
  const mentions = (
    await db.query(
      "select count(*)::int as n from audit_log where actor = $1 or target = $2",
      [ALICE, ALICE],
    )
  ).rows[0].n;
  assert.equal(mentions, 0);
  assert.ok(
    (
      await db.query(
        "select count(*)::int as n from audit_log where organization_id = $1",
        [shared],
      )
    ).rows[0].n > 0,
  );
});

test("the three functions are for signed-in people only", async () => {
  const grants = (
    await db.query(
      "select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon from pg_proc p where p.proname in ('accept_terms','export_my_data','delete_my_account')",
    )
  ).rows;
  assert.equal(grants.length, 3);
  for (const g of grants) assert.equal(g.anon, false, g.proname);
});
