// 0029 (26.11.58, release sign-off cloud hardening): a code made by a PC signs the phone in only after the account
// holder's emailed 6-digit code (wrong digits never use the code; five end it); codes made on the website work as
// before; only owners and admins see members' emails; a removed Trusted Device's session cannot join a live channel;
// /connect says whether the PC asked from this browser's network; deleting an account takes its device names out of
// the change log; the sweep removes old anonymous sign-ins that are in no team. The rollback restores 0021's
// behaviour and deletes codes still waiting for the emailed code.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const ANA = "00000000-0000-0000-0000-0000000029a1"; // owner, connected the PC
const BEN = "00000000-0000-0000-0000-0000000029a2"; // helper
const CAL = "00000000-0000-0000-0000-0000000029a3"; // admin
const DEE = "00000000-0000-0000-0000-0000000029a4"; // helper who deletes their account
const KEY = "pc-key-0029-aaaabbbbccccddddeeeeffff0000";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

let db, as, denied, org;
const one = async (p) => (await p).rows[0];

async function withHeaders(headers, run) {
  await db.exec(`select set_config('request.headers', '${JSON.stringify(headers)}', false)`);
  try {
    return await run();
  } finally {
    await db.exec("select set_config('request.headers', '', false)");
  }
}
async function pc(sql, params) {
  await db.exec("set role anon; select set_config('request.uid', '', false)");
  try {
    return await withHeaders({ "x-framedecks-computer": KEY, "x-forwarded-for": "203.0.113.29" }, () => db.query(sql, params));
  } finally {
    await db.exec("reset role");
  }
}
async function anon(sql, params) {
  await db.exec("set role anon; select set_config('request.uid', '', false)");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function service(sql, params) {
  await db.exec("set role service_role");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function withSession(sid, run) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ session_id: sid })}', false)`);
  try {
    return await run();
  } finally {
    await db.exec("select set_config('request.jwt.claims', '{}', false)");
  }
}
const redeem = (code, net = "198.51.100.29") => service("select device_code_redeem($1, $2, 'Ana iPhone') as r", [code, net]).then((x) => x.rows[0].r);
const confirm = (code, ok, net = "198.51.100.29") =>
  service("select device_code_confirm($1, $2, 'Ana iPhone', $3) as r", [code, net, ok]).then((x) => x.rows[0].r);

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({ [ANA]: "ana@church.org", [BEN]: "ben@church.org", [CAL]: "cal@church.org", [DEE]: "dee@church.org" }));
  org = (await one(as(ANA, "insert into organizations(name, created_by) values ('Grace Church', $1) returning id", [ANA]))).id;
  await db.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'member'), ($1, $3, 'admin'), ($1, $4, 'member')", [org, BEN, CAL, DEE]);
  await db.query("insert into computers (organization_id, name, key_hash, created_by) values ($1, 'CHURCH-PC', $2, $3)", [org, sha(KEY), ANA]);
});
after(() => db?.close());

test("a PC's code waits for the account holder's emailed code and is not used before", async () => {
  const c = (await one(pc("select pc_device_code_create() as r"))).r;
  const ask = await redeem(c.code);
  assert.deepEqual(ask, { status: "confirm", email: "ana@church.org", who: "a••@church.org", send: true });
  assert.equal((await one(anon("select join_code_peek($1) as r", [c.code]))).r.status, "self", "not used yet");
  const left = (await one(db.query("select extract(epoch from expires_at - now()) as s from join_codes where code_hash = code_hash($1)", [c.code]))).s;
  assert.ok(left > 590 && left <= 601, `10 minutes to read the email (${left})`);
  assert.equal((await redeem(c.code)).send, false, "at most one email a minute");
  assert.deepEqual((await one(service("select device_code_confirm_email($1, '198.51.100.29') as r", [c.code]))).r,
    { status: "confirm", email: "ana@church.org" });
  const ok = await confirm(c.code, true);
  assert.equal(ok.status, "ok");
  assert.equal(ok.userId, ANA);
  assert.equal(ok.organizationName, "Grace Church");
  assert.equal((await confirm(c.code, true)).status, "expired", "works once");
  assert.equal((await redeem(c.code)).status, "expired");
  const ev = await one(db.query("select detail from security_events where user_id = $1 and action = 'signed-in-by-code' order by at desc limit 1", [ANA]));
  assert.equal(ev.detail.via, "pc");
  assert.equal(ev.detail.confirmed, true);
});

test("wrong 6-digit codes never use the scanned code; the fifth wrong one ends it", async () => {
  const c = (await one(pc("select pc_device_code_create() as r"))).r;
  assert.equal((await redeem(c.code)).status, "confirm");
  for (let i = 1; i <= 4; i++) {
    assert.deepEqual(await confirm(c.code, false), { status: "otp-wrong", left: 5 - i });
    assert.equal((await one(anon("select join_code_peek($1) as r", [c.code]))).r.status, "self", "still usable");
  }
  assert.deepEqual(await confirm(c.code, false), { status: "otp-used-up", left: 0 });
  assert.equal((await confirm(c.code, true)).status, "expired", "a right code after five wrong ones is too late");
  const counted = (await one(db.query("select count(*)::int as n from join_failures where who = 'net:' || sha256_hex('source:198.51.100.29')"))).n;
  assert.ok(counted >= 5, "wrong tries count against the network");
});

test("the confirming step cannot be skipped or guessed", async () => {
  const c = (await one(pc("select pc_device_code_create() as r"))).r;
  assert.equal((await confirm(c.code, true)).status, "wrong", "no email was asked for yet");
  assert.equal((await one(service("select device_code_confirm_email($1) as r", [c.code]))).r.status, "wrong");
  assert.equal((await one(service("select device_code_confirm_email('NOPE2929') as r"))).r.status, "wrong");
  assert.equal((await one(anon("select join_code_peek($1) as r", [c.code]))).r.status, "self");
  for (const sql of ["select device_code_confirm($1, null, null, true)", "select device_code_confirm_email($1)", "select device_code_redeem($1)"]) {
    await assert.rejects(anon(sql, [c.code]), sql);
    assert.ok(await denied(ANA, sql, [c.code]), sql);
  }
  for (let i = 0; i < 60; i++) await service("select device_code_confirm_email('WRONG' || $1, '192.0.2.29')", [String(i)]);
  assert.equal((await one(service("select device_code_confirm_email($1, '192.0.2.29') as r", [c.code]))).r.status, "too-many");
});

test("a code made on the website by a signed-in person works as before, with no extra step", async () => {
  const c = (await one(as(BEN, "select device_code_create($1) as r", [org]))).r;
  const r = await redeem(c.code, "198.51.100.30");
  assert.equal(r.status, "ok");
  assert.equal(r.email, "ben@church.org");
  assert.equal((await one(anon("select join_code_peek($1) as r", [c.code]))).r.status, "expired");
});

test("only owners and admins see members' emails; everyone sees their own", async () => {
  const seen = async (uid) => (await as(uid, "select user_id, email from workspace_members($1)", [org])).rows;
  for (const uid of [ANA, CAL]) {
    assert.deepEqual((await seen(uid)).map((m) => m.email).sort(), ["ana@church.org", "ben@church.org", "cal@church.org", "dee@church.org"]);
  }
  const helper = await seen(BEN);
  assert.equal(helper.length, 4, "the same rows");
  assert.deepEqual(helper.filter((m) => m.email !== null).map((m) => [m.user_id, m.email]), [[BEN, "ben@church.org"]]);
});

test("a removed Trusted Device's session cannot join the live channel", async () => {
  const sid = "00000000-0000-0000-0000-00000000c0de";
  const topic = `live:${org}`;
  const allowed = () => withSession(sid, () => as(ANA, "select live_topic_allowed($1) as ok", [topic])).then((x) => x.rows[0].ok);
  await withSession(sid, () => as(ANA, "select trust_device('Ana laptop')"));
  assert.equal(await allowed(), true);
  await db.query("update trusted_devices set revoked_at = now() where session_id = $1", [sid]);
  assert.equal(await allowed(), false);
  assert.equal((await as(ANA, "select live_topic_allowed($1) as ok", [topic])).rows[0].ok, true, "another session is not affected");
});

test("/connect says whether the PC asked from this browser's network", async () => {
  const key = sha("another-pc-key-0029");
  await db.exec("set role anon");
  let code;
  try {
    code = await withHeaders({ "x-forwarded-for": "198.51.100.77" }, () => db.query("select computer_link_start('Hall PC', $1) as c", [key])).then((x) => x.rows[0].c);
  } finally {
    await db.exec("reset role");
  }
  const peek = (headers) => withHeaders(headers, () => as(CAL, "select computer_link_peek($1) as r", [code])).then((x) => x.rows[0].r);
  const same = await peek({ "x-forwarded-for": "198.51.100.77, 10.0.0.1" });
  assert.equal(same.status, "pending");
  assert.equal(same.sameNetwork, true);
  assert.ok(same.ageSeconds >= 0 && same.ageSeconds < 60);
  assert.equal((await peek({ "x-forwarded-for": "192.0.2.200" })).sameNetwork, false);
  assert.equal((await as(CAL, "select computer_link_peek($1) as r", [code])).rows[0].r.sameNetwork, null, "unknown without an address");
});

test("deleting an account takes its device names out of the change log", async () => {
  const sid = "00000000-0000-0000-0000-00000000dee1";
  await withSession(sid, () => as(DEE, "select trust_device('Dee''s phone at home')"));
  const before = await db.query("select detail from audit_log where action = 'device.trusted' and detail->>'name' = 'Dee''s phone at home'");
  assert.equal(before.rows.length, 1, "the change log had the name");
  assert.equal((await one(as(DEE, "select delete_my_account() as r"))).r.deleted, true);
  assert.equal((await db.query("select 1 from audit_log where detail::text like '%Dee''s phone%'")).rows.length, 0);
  assert.equal((await db.query("select 1 from audit_log where action = 'device.trusted' and detail->>'name' = 'A device' and actor is null")).rows.length, 1,
    "the entry stays, without the name or the person");
});

test("the sweep removes anonymous sign-ins older than 30 days that are in no team, and nothing else", async () => {
  await db.exec("alter table auth.users add column if not exists is_anonymous boolean not null default false; alter table auth.users add column if not exists created_at timestamptz not null default now()");
  const id = (n) => `00000000-0000-0000-0000-0000000029${n}`;
  const add = (n, anonymous, days, email = null) =>
    db.query("insert into auth.users (id, email, is_anonymous, created_at) values ($1, $2, $3, now() - make_interval(days => $4))", [id(n), email, anonymous, days]);
  await add("b1", true, 45);                  // old, in no team: removed
  await add("b2", true, 45);                  // old helper phone in a team: kept
  await add("b3", true, 5);                   // new: kept
  await add("b4", false, 400, "old@x.org");   // an email person: kept
  await add("b5", true, 45);                  // started a team (left it since): kept
  await db.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'member')", [org, id("b2")]);
  const other = (await one(db.query("insert into organizations (name, created_by) values ('Left behind', $1) returning id", [id("b5")]))).id;
  await db.query("delete from memberships where organization_id = $1", [other]); // it left; the team still names it
  await db.query("select public.members_phones_sweep()");
  const left = (await db.query("select id from auth.users where id::text like '%0029b%' order by id")).rows.map((r) => r.id);
  assert.deepEqual(left, [id("b2"), id("b3"), id("b4"), id("b5")]);
  assert.equal((await db.query("select 1 from memberships where user_id = $1", [id("b2")])).rows.length, 1, "the helper phone is still in its team");
});

test("the rollback restores 0021's behaviour and deletes codes still waiting for the emailed code", async () => {
  const waiting = (await one(pc("select pc_device_code_create() as r"))).r;
  assert.equal((await redeem(waiting.code)).status, "confirm");
  await db.exec(readFileSync(new URL("../supabase/rollback/0029_cloud_hardening_down.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select proname from pg_proc where proname in ('device_code_confirm','device_code_confirm_email','request_source_matches')")).rows.length, 0);
  assert.equal((await one(db.query("select count(*)::int as n from join_codes where code_hash = code_hash($1)", [waiting.code]))).n, 0);
  await db.exec("grant execute on function public.device_code_redeem(text, text, text) to service_role");
  const c = (await one(pc("select pc_device_code_create() as r"))).r;
  assert.equal((await redeem(c.code, "198.51.100.31")).status, "ok");
  const emails = (await as(BEN, "select email from workspace_members($1)", [org])).rows.map((m) => m.email);
  assert.ok(emails.includes("ana@church.org"), "members see emails again");
});
