// 0018 (26.11.12 Scan to join): a device joins a team by a code shown by the church PC or a device already in, or is
// allowed by one; a brand-new phone at a brand-new PC starts the team; codes are hashed, work once and run out; roles
// follow the owner rules; wrong codes are limited; one Devices list with Remove; a recovery code hands the team to a
// new device; anonymous people cannot start empty teams; the rollback removes it all.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const PHONE = "00000000-0000-0000-0000-0000000001a1";   // anonymous: the owner's phone
const WORK = "00000000-0000-0000-0000-0000000001a2";    // anonymous: a work browser
const HELPER = "00000000-0000-0000-0000-0000000001a3";  // anonymous: a helper
const NEWPHONE = "00000000-0000-0000-0000-0000000001a4"; // anonymous: after every device was lost
const ANA = "00000000-0000-0000-0000-0000000001a5";     // an email user with her own team
const STRANGER = "00000000-0000-0000-0000-0000000001a6";
const KEY = "pc-key-0123456789abcdef0123456789abcdef";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

let db, as;

async function claims(c) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify(c)}', false)`);
}
// a device-only person (Supabase anonymous sign-in: is_anonymous in the token)
async function dev(uid, sql, params) {
  await claims({ is_anonymous: true });
  try {
    return await as(uid, sql, params);
  } finally {
    await claims({});
  }
}
const one = async (p) => (await p).rows[0];
async function pc(sql, params, key = KEY) {
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify({ "x-framedecks-computer": key, "x-forwarded-for": "203.0.113.9" })}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
  }
}

before(async () => {
  ({ db, as } = await supabaseStandIn({ [PHONE]: null, [WORK]: null, [HELPER]: null, [NEWPHONE]: null, [ANA]: "ana@x.org", [STRANGER]: null }));
});
after(() => db?.close());

let org;

test("a new phone at a new PC: the PC's code starts a team the phone owns, after the Terms", async () => {
  const code = (await one(pc("select computer_link_start('CHURCH-PC', $1) as c", [sha(KEY)]))).c;
  const peek = (await one(pc("select join_code_peek($1) as r", [code.toLowerCase().replace(/(.{4})/, "$1-")]))).r;
  assert.deepEqual(peek, { status: "pc", pc: "CHURCH-PC" }, "typed in any case, with a dash");
  await assert.rejects(dev(PHONE, "select join_with_code($1, 'Shobin iPhone')", [code]), /Terms/);
  await dev(PHONE, "select accept_terms('2026-10-01')");
  const r = (await one(dev(PHONE, "select join_with_code($1, 'Shobin iPhone') as r", [code]))).r;
  assert.equal(r.status, "linked");
  assert.equal(r.organizationName, "My Workspace");
  org = r.organizationId;
  assert.equal((await one(db.query("select role from memberships where organization_id = $1 and user_id = $2", [org, PHONE]))).role, "owner");
  const poll = (await one(pc("select computer_link_poll($1) as r", [KEY]))).r;
  assert.equal(poll.status, "approved");
  assert.equal(poll.organizationId, org);
  assert.equal((await one(dev(PHONE, "select join_with_code($1) as r", [code]))).r.status, "wrong", "works once");
});

test("anonymous people cannot start empty teams by hand; email users still can", async () => {
  await assert.rejects(dev(STRANGER, "insert into organizations(name, created_by) values ('Spam', $1)", [STRANGER]));
  await as(ANA, "insert into organizations(name, created_by) values ('Ana team', $1)", [ANA]);
});

test("Add a device on the PC: an Admin code, hashed, once, for 2 minutes", async () => {
  const inv = (await one(pc("select pc_invite_create('admin') as r"))).r;
  assert.match(inv.code, /^[A-HJ-NP-Z2-9]{8}$/);
  const secs = (new Date(inv.expiresAt) - Date.now()) / 1000;
  assert.ok(secs > 100 && secs <= 121, "2 minutes");
  const stored = await one(db.query("select * from join_codes where kind = 'invite' order by created_at desc limit 1"));
  assert.equal(stored.code_hash, sha(inv.code));
  assert.ok(!JSON.stringify(stored).includes(inv.code), "the code itself is not stored");
  assert.deepEqual((await one(pc("select join_code_peek($1) as r", [inv.code]))).r,
    { status: "invite", team: "My Workspace", role: "admin", byPc: true });
  const r = (await one(dev(WORK, "select join_with_code($1, 'Work laptop') as r", [inv.code]))).r;
  assert.equal(r.status, "joined");
  assert.equal(r.role, "admin");
  assert.equal((await one(dev(HELPER, "select join_with_code($1) as r", [inv.code]))).r.status, "wrong", "works once");
  await db.query("update join_codes set expires_at = now() - interval '1 second' where kind = 'invite'");
  const old = (await one(pc("select pc_invite_create('member') as r"))).r;
  await db.query("update join_codes set expires_at = now() - interval '1 second' where code_hash = $1", [sha(old.code)]);
  assert.equal((await one(dev(HELPER, "select join_with_code($1) as r", [old.code]))).r.status, "wrong", "runs out");
  await assert.rejects(pc("select pc_invite_create('owner')"), /Unknown role/);
  await assert.rejects(pc("select pc_invite_create('admin')", [], "not-a-real-key-0123456789abcdef0123"), /not connected/);
});

test("Invite someone: the owner adds Admins or Helpers, an admin only Helpers", async () => {
  await assert.rejects(dev(WORK, "select invite_create($1, 'admin')", [org]), /owner can add an Admin/);
  const h = (await one(dev(WORK, "select invite_create($1, 'member') as r", [org]))).r;
  assert.equal((await one(dev(HELPER, "select join_with_code($1, 'Helper phone') as r", [h.code]))).r.role, "member");
  await assert.rejects(dev(HELPER, "select invite_create($1, 'member')", [org]), /owner can add an Admin/, "Helpers cannot invite");
  await assert.rejects(dev(STRANGER, "select invite_create($1, 'member')", [org]));
  const a = (await one(dev(PHONE, "select invite_create($1, 'admin') as r", [org]))).r;
  assert.equal(a.role, "admin");
});

test("a new browser shows its code and a device that is in, or the PC, allows it", async () => {
  const req = (await one(dev(STRANGER, "select join_request_create('Office PC') as r"))).r;
  assert.equal((await one(dev(STRANGER, "select join_request_status($1) as r", [req.code]))).r.status, "pending");
  assert.equal((await one(dev(HELPER, "select join_request_status($1) as r", [req.code]))).r.status, "unknown", "only its own");
  const peek = (await one(dev(PHONE, "select join_request_peek($1) as r", [req.code]))).r;
  assert.equal(peek.device, "Office PC");
  await assert.rejects(dev(HELPER, "select join_request_allow($1, $2, 'member')", [req.code, org]), /owner can add/);
  await dev(PHONE, "select join_request_allow($1, $2, 'member')", [req.code, org]);
  const st = (await one(dev(STRANGER, "select join_request_status($1) as r", [req.code]))).r;
  assert.equal(st.status, "allowed");
  assert.equal(st.organizationId, org);
  assert.equal((await one(dev(PHONE, "select join_request_allow($1, $2, 'member') as r", [req.code, org]))).r.status, "wrong");

  const req2 = (await one(dev(NEWPHONE, "select join_request_create('Tablet') as r"))).r;
  const ok = (await one(pc("select pc_join_request_allow($1, 'member') as r", [req2.code]))).r;
  assert.equal(ok.device, "Tablet");
  assert.equal((await one(dev(NEWPHONE, "select join_request_status($1) as r", [req2.code]))).r.status, "allowed");
});

test("one Devices list for the team, and Remove follows the owner rules", async () => {
  const list = (await dev(HELPER, "select * from workspace_devices($1)", [org])).rows;
  assert.ok(list.some((d) => d.kind === "pc" && d.name === "CHURCH-PC"));
  assert.ok(list.some((d) => d.kind === "person" && d.name === "Work laptop" && d.role === "admin"));
  assert.ok(list.some((d) => d.is_me && d.name === "Helper phone"));
  await assert.rejects(as(ANA, "select * from workspace_devices($1)", [org]), /Not allowed/);
  assert.ok((await pc("select * from pc_devices()")).rows.some((d) => d.kind === "pc" && d.is_me));

  await assert.rejects(dev(HELPER, "select device_remove($1, $2)", [org, WORK]), /Not allowed/, "a Helper cannot remove an Admin");
  await assert.rejects(dev(WORK, "select device_remove($1, $2)", [org, PHONE]), /owner cannot be removed/);
  await assert.rejects(pc("select pc_device_remove($1)", [PHONE]), /Not allowed/, "nor from the PC");
  await dev(WORK, "select device_remove($1, $2)", [org, STRANGER]);          // an admin removes a Helper
  await pc("select pc_device_remove($1)", [NEWPHONE]);                       // the PC removes a device
  const t = await dev(PHONE, "select trust_device('x') as r");                 // a trusted device record...
  await dev(HELPER, "select device_remove($1, $2)", [org, HELPER]);          // ...anyone may leave
  const after = (await dev(PHONE, "select * from workspace_devices($1)", [org])).rows.map((d) => d.name);
  assert.ok(!after.includes("Office PC") && !after.includes("Tablet") && !after.includes("Helper phone"));
  assert.ok(t.rows[0].r.token);
  await assert.rejects(dev(HELPER, "select * from workspace_devices($1)", [org]), /Not allowed/, "gone at once");
});

test("a recovery code (owner only) makes a new device the owner, once", async () => {
  await assert.rejects(dev(WORK, "select recovery_code_create($1)", [org]), /owner/);
  const code = (await one(dev(PHONE, "select recovery_code_create($1) as c", [org]))).c;
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
  const status = (await one(dev(WORK, "select recovery_status($1) as r", [org]))).r;
  assert.equal(status.hasCode, true);
  assert.equal(status.ownerHasEmail, false);
  assert.equal(status.iAmOwner, false);
  const r = (await one(dev(NEWPHONE, "select recover_team($1, 'New phone') as r", [code.toLowerCase()]))).r;
  assert.equal(r.status, "recovered");
  const roles = Object.fromEntries((await db.query("select user_id, role from memberships where organization_id = $1", [org])).rows.map((x) => [x.user_id, x.role]));
  assert.equal(roles[NEWPHONE], "owner");
  assert.equal(roles[PHONE], "admin", "the old owner stays as an Admin");
  assert.equal((await one(dev(STRANGER, "select recover_team($1) as r", [code]))).r.status, "wrong", "works once");
});

test("wrong codes are counted and limited per device (5 recovery tries, 20 join tries an hour)", async () => {
  // STRANGER already used one recovery try above
  for (let i = 0; i < 4; i++) assert.equal((await one(dev(STRANGER, "select recover_team('AAAA-AAAA-AAAA-AAAA') as r"))).r.status, "wrong");
  await assert.rejects(dev(STRANGER, "select recover_team('AAAA-AAAA-AAAA-AAAA')"), /Too many/);
  const before = (await one(db.query("select count(*)::int as n from join_failures where who = $1", [`user:${HELPER}`]))).n;
  for (let i = before; i < 20; i++) assert.equal((await one(dev(HELPER, "select join_with_code('ZZZZZZZZ') as r"))).r.status, "wrong");
  await assert.rejects(dev(HELPER, "select join_with_code('ZZZZZZZZ')"), /Too many/);
});

test("the API roles cannot read the tables or call the internal functions", async () => {
  await assert.rejects(dev(PHONE, "select * from join_codes"));
  await assert.rejects(dev(PHONE, "select * from recovery_codes"));
  await assert.rejects(dev(PHONE, "select * from join_failures"));
  await assert.rejects(dev(PHONE, "select join_team($1, $2, 'admin', 'x', 'y')", [org, STRANGER]));
  await assert.rejects(dev(PHONE, "select leave_team($1, $2, null)", [org, WORK]));
  await assert.rejects(pc("select invite_create($1, 'member')", [org]), undefined, "anon cannot use the person functions");
});

test("rollback removes 0018 and leaves the team as it was", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0018_scan_to_join_down.sql", import.meta.url), "utf8"));
  const left = (await db.query("select count(*)::int as n from pg_proc where proname in ('join_with_code','invite_create','recover_team','workspace_devices')")).rows[0].n;
  assert.equal(left, 0);
  assert.equal((await db.query("select to_regclass('public.join_codes') as t")).rows[0].t, null);
  assert.equal((await one(db.query("select role from memberships where organization_id = $1 and user_id = $2", [org, NEWPHONE]))).role, "owner");
});
