// 0028 (release sign-off items 2-6): one network that guessed wrong never blocks phones with the right code; room and
// prayer codes have 8 characters; an IPv6 address counts as its /64 and sources are hashed with a daily key; only the
// owner invites or removes an admin; closing a room removes its poll and answers, and the sweep clears rooms and walls
// that timed out. The rollback restores the earlier functions and rules.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000028a1";
const ADMIN = "00000000-0000-0000-0000-0000000028a2";
const MEMBER = "00000000-0000-0000-0000-0000000028a3";
const ADMIN2 = "00000000-0000-0000-0000-0000000028a4";
const KEY = "pc-key-codes-0123456789abcdef0123456789abcd";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

let db;
let as;
let org;
let pcId;
const one = async (p) => (await p).rows[0];
async function call(sql, params, headers) {
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify(headers)}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
  }
}
const pc = (sql, params) => call(sql, params, { "x-framedecks-computer": KEY, "x-forwarded-for": "198.51.100.28" });
const phone = (sql, params, ip = "203.0.113.28") => call(sql, params, { "x-forwarded-for": ip });

before(async () => {
  ({ db, as } = await supabaseStandIn({ [OWNER]: "owner@x.org", [ADMIN]: "admin@x.org", [MEMBER]: "member@x.org", [ADMIN2]: "admin2@x.org" }));
  org = (await as(OWNER, "insert into organizations(name, created_by) values ('Grace Church', $1) returning id", [OWNER])).rows[0].id;
  await as(OWNER, "insert into memberships(organization_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member'), ($1, $4, 'admin')", [org, ADMIN, MEMBER, ADMIN2]);
  pcId = (await one(db.query("insert into public.computers (organization_id, name, key_hash) values ($1, 'CHURCH-PC', $2) returning id", [org, sha(KEY)]))).id;
});
after(() => db?.close());

let room;
let wall;

test("room and prayer codes have 8 characters", async () => {
  room = (await one(pc("select pc_room_open(3) as r"))).r.code;
  wall = (await one(pc("select pc_prayer_open(3) as r"))).r.code;
  assert.match(room, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.match(wall, /^[A-HJ-NP-Z2-9]{8}$/);
});

test("one network's wrong guesses never block phones that have the right code", async () => {
  const net = "192.0.2.28";                                       // the church Wi-Fi: every phone shares it
  for (let i = 0; i < 60; i++) await phone("select prayer_peek($1)", [`ZZZZZZ${i}`], net);
  await assert.rejects(phone("select prayer_peek($1)", ["ZZZZZZZZ"], net), /Too many wrong codes/, "a wrong code is still limited");
  assert.equal((await one(phone("select prayer_peek($1) as r", [wall], net))).r.status, "open", "the right code still works");
  assert.deepEqual((await one(phone("select prayer_send($1, 'Pray for our families') as r", [wall], net))).r, { sent: true });
  await pc("select pc_room_response_open('Ready?', 'yesno')");
  assert.equal((await one(phone("select room_respond($1, 'phone-28-0123456789', 0) as r", [room], net))).r.status, "in");
  await pc("select pc_room_answers_open('What stood out?')");
  assert.equal((await one(phone("select room_answer($1, 'phone-28-0123456789', 'Grace') as r", [room], net))).r.status, "in");
  await assert.rejects(phone("select room_respond('ZZZZZZZZ', 'phone-28-0123456789', 0)", [], net), /Too many wrong codes/);
});

test("an unknown code to prayer_send is an answer, so the wrong guess is counted", async () => {
  const net = "192.0.2.29";
  assert.deepEqual((await one(phone("select prayer_send('QQQQQQQQ', 'Hello') as r", [], net))).r, { sent: false, status: "closed" });
  const counted = (await one(db.query("select count(*)::int as n from public.join_failures where who like 'net:%'"))).n;
  assert.ok(counted > 0, "the failure stayed recorded");
});

test("an IPv6 address counts as its /64, and sources are hashed with today's key", async () => {
  // as the functions that use it do (they run as the database owner)
  const src = async (ip) => {
    await db.exec(`select set_config('request.headers', '${JSON.stringify({ "x-forwarded-for": "IP" })}'::text, false)`.replace("IP", ip));
    try {
      return (await one(db.query("select public.request_source() as s"))).s;
    } finally {
      await db.exec("select set_config('request.headers', '', false)");
    }
  };
  const a = await src("2001:db8:1:2:aaaa::1");
  const b = await src("2001:db8:1:2:bbbb::9");
  const c = await src("2001:db8:1:3::1");
  assert.equal(a, b, "same /64, same source");
  assert.notEqual(a, c);
  assert.notEqual(await src("203.0.113.9"), sha("source:203.0.113.9"), "never the plain hash of the address");
  const days = (await db.query("select day from public.request_salts order by day")).rows.length;
  assert.ok(days >= 8, "keys for today and the week ahead");
  await db.query("insert into public.request_salts (day, salt) values (current_date - 5, 'old') on conflict do nothing");
  await db.query("select public.request_salts_keep()");
  assert.equal(Number((await one(db.query("select count(*) as n from public.request_salts where day < current_date - 1"))).n), 0, "old keys are deleted");
});

test("only the owner invites or removes an admin; admins handle members", async () => {
  await assert.rejects(as(ADMIN, "insert into invitations(organization_id, email, role, invited_by) values ($1, 'a@new.org', 'admin', $2)", [org, ADMIN]), /row-level security/);
  await as(ADMIN, "insert into invitations(organization_id, email, role, invited_by) values ($1, 'm@new.org', 'member', $2)", [org, ADMIN]);
  await as(OWNER, "insert into invitations(organization_id, email, role, invited_by) values ($1, 'b@new.org', 'admin', $2)", [org, OWNER]);
  assert.equal((await as(ADMIN, "delete from memberships where organization_id = $1 and user_id = $2 returning 1", [org, ADMIN2])).rows.length, 0, "an admin cannot remove another admin");
  assert.equal((await as(ADMIN, "delete from memberships where organization_id = $1 and user_id = $2 returning 1", [org, MEMBER])).rows.length, 1, "an admin removes a member");
  assert.equal((await as(OWNER, "delete from memberships where organization_id = $1 and user_id = $2 returning 1", [org, ADMIN2])).rows.length, 1, "the owner removes an admin");
  assert.equal((await as(ADMIN, "delete from memberships where organization_id = $1 and user_id = $2 returning 1", [org, ADMIN])).rows.length, 1, "anyone may leave");
});

test("closing a room removes its poll, votes, prompt and answers", async () => {
  await pc("select pc_room_close()");
  for (const t of ["room_responses", "room_answer_prompts", "room_slides"]) {
    assert.equal(Number((await one(db.query(`select count(*) as n from public.${t} where computer_id = $1`, [pcId]))).n), 0, t);
  }
});

test("the sweep clears rooms and walls that timed out", async () => {
  const code = (await one(pc("select pc_room_open(3) as r"))).r.code;
  await pc("select pc_room_publish($1::jsonb, $2::jsonb, true)", [JSON.stringify({ frame: "Welcome" }), JSON.stringify({ text: "Notes" })]);
  await pc("select pc_room_answers_open('Anything?')");
  await phone("select room_answer($1, 'phone-29-0123456789', 'Yes')", [code]);
  const w = (await one(pc("select pc_prayer_open(3) as r"))).r.code;
  await phone("select prayer_send($1, 'Pray for me')", [w], "203.0.113.77");
  await db.query("update public.member_rooms set closes_at = now() - interval '1 minute' where computer_id = $1", [pcId]);
  await db.query("update public.prayer_walls set closes_at = now() - interval '1 minute' where computer_id = $1", [pcId]);
  await db.query("select public.members_phones_sweep()");
  const r = await one(db.query("select screen, notes, closed_at is not null as closed from public.member_rooms where computer_id = $1", [pcId]));
  assert.deepEqual(r, { screen: {}, notes: null, closed: true });
  for (const t of ["room_answer_prompts", "prayer_requests"]) {
    assert.equal(Number((await one(db.query(`select count(*) as n from public.${t} where computer_id = $1`, [pcId]))).n), 0, t);
  }
});

test("the rollback restores the earlier functions and rules", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0028_codes_limits_retention_down.sql", import.meta.url), "utf8"));
  assert.equal((await one(db.query("select to_regclass('public.request_salts') as t"))).t, null);
  assert.equal((await one(db.query("select to_regprocedure('public.members_phones_sweep()') as f"))).f, null);
  assert.match((await one(pc("select pc_room_open(3) as r"))).r.code, /^[A-HJ-NP-Z2-9]{6}$/);
});
