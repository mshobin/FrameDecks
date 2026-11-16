// 0027 (release sign-off, safe fixes): unlinking a PC closes its members' room and prayer wall at once and removes what
// they held; every SECURITY DEFINER function searches public then pg_temp; Download my data lists your Trusted Devices
// and security events; deleting an account removes the link requests made with its address; the rollback undoes the
// unlink trigger and returns the export and delete functions to their earlier versions.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000027a1";
const KEY = "pc-key-signoff-0123456789abcdef0123456789ab";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

let db;
let as;
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
const pc = (sql, params) => call(sql, params, { "x-framedecks-computer": KEY, "x-forwarded-for": "198.51.100.27" });
const phone = (sql, params) => call(sql, params, { "x-forwarded-for": "203.0.113.27" });

before(async () => {
  ({ db, as } = await supabaseStandIn({ [OWNER]: "owner@x.org" }));
  const org = (await one(db.query("insert into public.organizations (name, created_by) values ('Grace Church', $1) returning id", [OWNER]))).id;
  await db.query("insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'owner') on conflict do nothing", [org, OWNER]);
  pcId = (await one(db.query("insert into public.computers (organization_id, name, key_hash, created_by) values ($1, 'CHURCH-PC', $2, $3) returning id", [org, sha(KEY), OWNER]))).id;
});
after(() => db?.close());

test("unlinking a PC closes its members' room and prayer wall and removes what they held", async () => {
  const room = (await one(pc("select pc_room_open(3) as r"))).r.code;
  await pc("select pc_room_publish($1::jsonb, $2::jsonb, true)", [JSON.stringify({ frame: "Welcome" }), JSON.stringify({ text: "Notes" })]);
  await pc("select pc_room_response_open('Ready?', 'yesno')");
  await pc("select pc_room_answers_open('What stood out?')");
  const wall = (await one(pc("select pc_prayer_open(3) as r"))).r.code;
  await phone("select prayer_send($1, 'Please pray for my family')", [wall]);
  assert.equal((await one(phone("select room_view($1, 0) as r", [room]))).r.status, "open");

  await db.query("update public.computers set revoked_at = now() where id = $1", [pcId]);

  assert.equal((await one(phone("select room_view($1, 0) as r", [room]))).r.status, "closed", "phones see the room closed at once");
  const left = await one(db.query("select screen, notes from public.member_rooms where computer_id = $1", [pcId]));
  assert.deepEqual(left, { screen: {}, notes: null }, "the screen words and notes are gone");
  for (const t of ["room_slides", "room_responses", "room_answer_prompts", "prayer_requests"]) {
    assert.equal(Number((await one(db.query(`select count(*) as n from public.${t} where computer_id = $1`, [pcId]))).n), 0, t);
  }
  assert.deepEqual((await one(phone("select prayer_send($1, 'Another request') as r", [wall]))).r, { sent: false, status: "closed" }, "the wall is closed (0028 answers instead of failing)");
});

test("every SECURITY DEFINER function searches public then pg_temp", async () => {
  const bad = (await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and array_to_string(p.proconfig, ',') like '%search_path=public%'
      and array_to_string(p.proconfig, ',') not like '%pg_temp%'`)).rows.map((r) => r.proname);
  assert.deepEqual(bad, []);
});

test("Download my data lists your Trusted Devices and security events", async () => {
  await db.query("insert into public.trusted_devices (user_id, name, token_hash) values ($1, 'My laptop', $2)", [OWNER, sha("t")]);
  await db.query("insert into public.security_events (user_id, action) values ($1, 'device.trusted')", [OWNER]);
  await db.query("insert into public.security_events (email_hash, action) values ($1, 'link.requested')", [sha("email:owner@x.org")]);
  const d = (await as(OWNER, "select export_my_data() as d")).rows[0].d;
  assert.deepEqual(d.trustedDevices.map((t) => t.name), ["My laptop"]);
  assert.deepEqual(d.securityEvents.map((e) => e.action).sort(), ["device.trusted", "link.requested"]);
  assert.ok(!JSON.stringify(d).includes(sha("t")), "never the token hash");
});

test("deleting an account removes the link requests made with its address", async () => {
  await db.query("insert into public.security_events (email_hash, action) values ($1, 'link.requested')", [sha("email:someone@else.org")]);
  await as(OWNER, "select delete_my_account()");
  assert.equal(Number((await one(db.query("select count(*) as n from public.security_events where email_hash = $1", [sha("email:owner@x.org")]))).n), 0);
  assert.equal(Number((await one(db.query("select count(*) as n from public.security_events where email_hash = $1", [sha("email:someone@else.org")]))).n), 1, "other people's stay");
});

test("the rollback removes the unlink trigger and keeps export and delete working", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0027_signoff_safe_down.sql", import.meta.url), "utf8"));
  assert.equal(Number((await one(db.query("select count(*) as n from pg_trigger where tgname = 'rooms_close_on_revoke'"))).n), 0);
  const src = (await one(db.query("select prosrc from pg_proc where proname = 'export_my_data'"))).prosrc;
  assert.ok(!src.includes("trustedDevices"), "the export is back to its 0011 version");
});
