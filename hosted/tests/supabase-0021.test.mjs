// 0021 (26.11.26 joining without typing): Add a device signs the phone in as the person themselves, through the server
// function only (service key); Connect this PC from the website hands the program a one-time grant it shows before
// using; codes are hashed, work once and run out; anonymous people and Helpers cannot make them; the rollback removes it.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const ANA = "00000000-0000-0000-0000-0000000002a1"; // owner, email
const BEN = "00000000-0000-0000-0000-0000000002a2"; // helper, email
const ANON = "00000000-0000-0000-0000-0000000002a3"; // a device-only person
const KEY = "pc-key-aaaabbbbccccddddeeeeffff00001111";
const KEY2 = "pc-key-2222333344445555666677778888999900";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

let db, as, denied, org;
const one = async (p) => (await p).rows[0];

async function pc(sql, params, key = KEY) {
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify({ "x-framedecks-computer": key, "x-forwarded-for": "203.0.113.7" })}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
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
async function anonymousUser(uid, sql, params) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ is_anonymous: true })}', false)`);
  try {
    return await as(uid, sql, params);
  } finally {
    await db.exec("select set_config('request.jwt.claims', '{}', false)");
  }
}

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({ [ANA]: "ana@church.org", [BEN]: "ben@church.org", [ANON]: null }));
  await db.exec("grant execute on function public.device_code_redeem(text, text, text) to service_role");
  org = (await one(as(ANA, "insert into organizations(name, created_by) values ('Grace Church', $1) returning id", [ANA]))).id;
  await db.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'member'), ($1, $3, 'member') on conflict do nothing", [org, BEN, ANON]);
});
after(() => db?.close());

test("Connect this PC: an owner's grant, shown by the program before it is used, once", async () => {
  await assert.rejects(as(BEN, "select pc_grant_create($1)", [org]), /owners and admins/, "a Helper cannot");
  await assert.rejects(anonymousUser(ANON, "select pc_grant_create($1)", [org]), /owners and admins/);
  const g = (await one(as(ANA, "select pc_grant_create($1) as r", [org]))).r;
  assert.match(g.code, /^[A-HJ-NP-Z2-9]{8}$/);
  const stored = await one(db.query("select * from join_codes where kind = 'grant'"));
  assert.notEqual(stored.code_hash, g.code, "kept as a hash only");
  const peek = (await one(anon("select pc_grant_peek($1) as r", [g.code.toLowerCase()]))).r;
  assert.deepEqual(peek, { status: "grant", team: "Grace Church", by: "a••@church.org" });
  await assert.rejects(anon("select pc_link_with_grant($1, 'PC', 'nothex')", [g.code]), /Bad key/);
  const r = (await one(anon("select pc_link_with_grant($1, 'CHURCH-PC', $2) as r", [g.code, sha(KEY)]))).r;
  assert.equal(r.status, "linked");
  assert.equal(r.organizationId, org);
  const computer = await one(db.query("select * from computers where id = $1", [r.computerId]));
  assert.equal(computer.key_hash, sha(KEY));
  assert.equal(computer.created_by, ANA, "the PC belongs to whoever sent it");
  assert.equal((await one(anon("select pc_link_with_grant($1, 'X', $2) as r", [g.code, sha(KEY2)]))).r.status, "wrong", "works once");
  assert.equal((await one(anon("select pc_grant_peek($1) as r", [g.code]))).r.status, "expired");
  assert.equal((await one(anon("select pc_grant_peek('ZZZZZZZZ') as r"))).r.status, "unknown");
});

test("Add a device on the PC: a code that signs the phone in as the person who connected it", async () => {
  const c = (await one(pc("select pc_device_code_create() as r"))).r;
  assert.equal(c.status, "ok");
  assert.equal(c.who, "a••@church.org");
  const secs = (new Date(c.expiresAt) - Date.now()) / 1000;
  assert.ok(secs > 100 && secs <= 121, "2 minutes");
  const peek = (await one(anon("select join_code_peek($1) as r", [c.code]))).r;
  assert.deepEqual(peek, { status: "self", team: "Grace Church", who: "a••@church.org", byPc: true });
  // only the server function may use it
  await assert.rejects(anon("select device_code_redeem($1)", [c.code]));
  assert.ok(await denied(BEN, "select device_code_redeem($1)", [c.code]));
  // join_with_code (the anonymous way) never uses a self code
  assert.equal((await one(anonymousUser(ANON, "select join_with_code($1) as r", [c.code]))).r.status, "wrong");
  const r = (await one(service("select device_code_redeem($1, '198.51.100.4', 'Ana iPhone') as r", [c.code]))).r;
  assert.equal(r.status, "ok");
  assert.equal(r.email, "ana@church.org");
  assert.equal(r.userId, ANA);
  assert.equal(r.organizationName, "Grace Church");
  assert.equal((await one(service("select device_code_redeem($1) as r", [c.code]))).r.status, "expired", "works once");
  const ev = await one(db.query("select * from security_events where user_id = $1 and action = 'signed-in-by-code'", [ANA]));
  assert.equal(ev.detail.via, "pc");
  assert.equal(ev.detail.name, "Ana iPhone");
});

test("wrong codes are counted per network and stop after 60 in an hour", async () => {
  for (let i = 0; i < 60; i++) await service("select device_code_redeem('WRONG' || $1, '192.0.2.50')", [String(i)]);
  assert.equal((await one(service("select device_code_redeem('AAAAAAAA', '192.0.2.50') as r"))).r.status, "too-many");
  assert.equal((await one(service("select device_code_redeem('AAAAAAAA', '192.0.2.51') as r"))).r.status, "wrong", "another network is not blocked");
});

test("from a signed-in browser: email people only, for their own account", async () => {
  const c = (await one(as(BEN, "select device_code_create($1) as r", [org]))).r;
  assert.equal(c.who, "b••@church.org");
  const r = (await one(service("select device_code_redeem($1) as r", [c.code]))).r;
  assert.equal(r.email, "ben@church.org");
  await assert.rejects(anonymousUser(ANON, "select device_code_create($1)", [org]), /email/);
  const other = (await one(as(ANA, "insert into organizations(name, created_by) values ('Other', $1) returning id", [ANA]))).id;
  await assert.rejects(as(BEN, "select device_code_create($1)", [other]), /email/, "only a team you are in");
});

test("a PC connected by a device without an email says so; someone who left can no longer be signed in", async () => {
  await db.query("insert into computers (organization_id, name, key_hash, created_by) values ($1, 'OLD-PC', $2, $3)", [org, sha(KEY2), ANON]);
  assert.deepEqual((await one(pc("select pc_device_code_create() as r", [], KEY2))).r, { status: "no-person" });
  const c = (await one(as(BEN, "select device_code_create($1) as r", [org]))).r;
  await db.query("delete from memberships where organization_id = $1 and user_id = $2", [org, BEN]);
  assert.equal((await one(service("select device_code_redeem($1) as r", [c.code]))).r.status, "expired");
});

test("the rollback removes it and 0018's peek is back", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0021_passwordless_down.sql", import.meta.url), "utf8"));
  const left = await db.query(
    "select proname from pg_proc where proname in ('device_code_create','pc_device_code_create','device_code_redeem','pc_grant_create','pc_grant_peek','pc_link_with_grant','code_person','masked_email')",
  );
  assert.equal(left.rows.length, 0);
  assert.equal((await one(db.query("select count(*)::int as n from join_codes where kind in ('self','grant')"))).n, 0);
  assert.equal((await one(anon("select join_code_peek('NOPE1234') as r"))).r.status, "unknown");
});
