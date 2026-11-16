// 0019 (26.11.23 Prayer requests wall): the church PC opens a wall and shows a code; people in the meeting send a
// request with only the code (no account); the PC takes them in and the cloud forgets them; a closed or replaced
// code stops working; one network is limited; wrong codes are limited like join codes; the rollback removes it all.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const OWNER = "00000000-0000-0000-0000-0000000002b1";
const KEY = "pc-key-prayer-0123456789abcdef0123456789ab";
const OTHER_KEY = "pc-key-other-0123456789abcdef0123456789ab";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

let db;
const one = async (p) => (await p).rows[0];

// the PC (anon key + its key header) or a phone in the meeting (anon, from an address)
async function call(sql, params, headers) {
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify(headers)}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
  }
}
const pc = (sql, params, key = KEY) => call(sql, params, { "x-framedecks-computer": key, "x-forwarded-for": "198.51.100.1" });
const phone = (sql, params, ip = "203.0.113.7") => call(sql, params, { "x-forwarded-for": ip });

before(async () => {
  ({ db } = await supabaseStandIn({ [OWNER]: "owner@x.org" }));
  const org = (await one(db.query("insert into public.organizations (name, created_by) values ('Grace Church', $1) returning id", [OWNER]))).id;
  await db.query("insert into public.computers (organization_id, name, key_hash) values ($1, 'CHURCH-PC', $2), ($1, 'HALL-PC', $3)",
    [org, sha(KEY), sha(OTHER_KEY)]);
});
after(() => db?.close());

let code;

test("the PC opens a wall; a phone sees it is open and sends a request with only the code", async () => {
  await assert.rejects(phone("select pc_prayer_open()"), /not connected/);
  code = (await one(pc("select pc_prayer_open(3) as r"))).r.code;
  assert.match(code, /^[A-Z0-9]{8}$/, "0028: codes have 8 characters");
  const peek = (await one(phone("select prayer_peek($1) as r", [code.toLowerCase()]))).r;
  assert.deepEqual(peek, { status: "open", team: "Grace Church" });
  const sent = (await one(phone("select prayer_send($1, $2, $3) as r", [code, "  Pray for my mother's surgery on Friday \u0007 ", "Mary"]))).r;
  assert.deepEqual(sent, { sent: true });
  await phone("select prayer_send($1, $2)", [code, "For peace at work"]);
});

test("a phone can read nothing back, and no table is reachable directly", async () => {
  await assert.rejects(phone("select * from public.prayer_requests"), /permission denied/);
  await assert.rejects(phone("select * from public.prayer_walls"), /permission denied/);
  await assert.rejects(phone("select prayer_wall_of($1)", [code]), /permission denied/);
});

test("only this PC takes its requests in, and the cloud forgets them at that moment", async () => {
  assert.equal((await pc("select * from pc_prayer_take()", [], OTHER_KEY)).rows.length, 0, "another PC sees none");
  const rows = (await pc("select * from pc_prayer_take()")).rows;
  assert.deepEqual(rows.map((r) => [r.body, r.name]), [["Pray for my mother's surgery on Friday", "Mary"], ["For peace at work", null]]);
  assert.equal((await one(db.query("select count(*)::int as n from public.prayer_requests"))).n, 0);
  assert.equal((await pc("select * from pc_prayer_take()")).rows.length, 0);
});

test("empty requests are refused, and one network is limited to 5 in 10 minutes", async () => {
  await assert.rejects(phone("select prayer_send($1, $2)", [code, "  "]), /Write your prayer request/);
  for (let i = 0; i < 5; i++) await phone("select prayer_send($1, $2)", [code, `Request ${i}`], "203.0.113.50");
  await assert.rejects(phone("select prayer_send($1, $2)", [code, "One more"], "203.0.113.50"), /wait a few minutes/);
  await phone("select prayer_send($1, $2)", [code, "From another phone"], "203.0.113.51");
  assert.equal((await pc("select * from pc_prayer_take()")).rows.length, 6);
});

test("a new code replaces the old one; a closed wall takes nothing", async () => {
  const fresh = (await one(pc("select pc_prayer_open() as r"))).r.code;
  assert.equal((await one(phone("select prayer_peek($1) as r", [code]))).r.status, "unknown");
  await pc("select pc_prayer_close()");
  assert.equal((await one(phone("select prayer_peek($1) as r", [fresh]))).r.status, "closed");
  assert.deepEqual((await one(phone("select prayer_send($1, $2) as r", [fresh, "Hello"]))).r, { sent: false, status: "closed" }, "0028: an answer, so the wrong guess is counted");
});

test("wrong codes are limited like join codes", async () => {
  for (let i = 0; i < 60; i++) await phone("select prayer_peek($1)", [`ZZZZ${i}`], "192.0.2.77");
  await assert.rejects(phone("select prayer_peek($1)", ["ZZZZZZ"], "192.0.2.77"), /Too many wrong codes/);
});

test("rollback removes 0019", async () => {
  // rollbacks run newest first: 0028 (codes, limits, sweep) changed the wall's functions
  await db.exec(readFileSync(new URL("../supabase/rollback/0028_codes_limits_retention_down.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/rollback/0019_prayer_wall_down.sql", import.meta.url), "utf8"));
  const left = (await db.query("select count(*)::int as n from pg_proc where proname like '%prayer%'")).rows[0].n;
  assert.equal(left, 0);
  assert.equal((await db.query("select to_regclass('public.prayer_requests') as t")).rows[0].t, null);
  assert.equal((await db.query("select count(*)::int as n from public.computers")).rows[0].n, 2, "PCs untouched");
});
