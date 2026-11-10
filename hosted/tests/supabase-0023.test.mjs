// 0023 (26.11.36 new-device alerts): connecting a PC (link code or grant) and a device joining a team (a code, being
// allowed, Add a device signing a phone in as you) each write one alert; owners and admins see the last 30 days, newest
// first; Helpers and other teams see nothing; only the service key takes an alert, once; the rollback removes it all.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const ANA = "00000000-0000-0000-0000-0000000023a1"; // owner
const BEN = "00000000-0000-0000-0000-0000000023a2"; // admin
const CAL = "00000000-0000-0000-0000-0000000023a3"; // helper
const PHONE = "00000000-0000-0000-0000-0000000023a4"; // a device-only person
const DAN = "00000000-0000-0000-0000-0000000023a5"; // owner of another team
const KEY = "pc-key-0023aaaabbbbccccddddeeeeffff0000";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

let db, as, denied, org, other;
const one = async (p) => (await p).rows[0];

async function role(name, sql, params, claims = {}) {
  await db.exec(`set role ${name}; select set_config('request.uid', '', false);
    select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claims', '{}', false)");
  }
}
const anon = (sql, params) => role("anon", sql, params);
const service = (sql, params) => role("service_role", sql, params);
async function anonymousUser(uid, sql, params) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ is_anonymous: true })}', false)`);
  try {
    return await as(uid, sql, params);
  } finally {
    await db.exec("select set_config('request.jwt.claims', '{}', false)");
  }
}
const recent = async (uid, team = org) => (await as(uid, "select * from device_alerts_recent($1)", [team])).rows;
const alerts = async () => (await db.query("select * from device_alerts order by id")).rows;

before(async () => {
  ({ db, as, denied } = await supabaseStandIn({
    [ANA]: "ana@church.org", [BEN]: "ben@church.org", [CAL]: "cal@church.org", [PHONE]: null, [DAN]: "dan@other.org",
  }));
  await db.exec("grant execute on function public.device_code_redeem(text, text, text) to service_role");
  await db.exec("grant execute on function public.device_alert_take(bigint), public.device_alert_release(bigint) to service_role");
  org = (await one(as(ANA, "insert into organizations(name, created_by) values ('Grace Church', $1) returning id", [ANA]))).id;
  other = (await one(as(DAN, "insert into organizations(name, created_by) values ('Other Church', $1) returning id", [DAN]))).id;
  await db.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member') on conflict do nothing", [org, BEN, CAL]);
});
after(() => db?.close());

test("a new workspace has no alerts; the table is closed to everyone", async () => {
  assert.deepEqual(await alerts(), [], "making a team or adding members directly is not a new device");
  assert.ok(await denied(ANA, "select * from device_alerts"));
  assert.ok(await denied(ANA, "insert into device_alerts (organization_id, kind, device_name) values ($1, 'pc', 'X')", [org]));
  await assert.rejects(anon("select * from device_alerts"));
  const rls = (await one(db.query("select relrowsecurity as on from pg_class where relname = 'device_alerts'"))).on;
  assert.equal(rls, true);
});

test("Connect this PC with a grant writes a PC alert", async () => {
  const g = (await one(as(ANA, "select pc_grant_create($1) as r", [org]))).r;
  const r = (await one(anon("select pc_link_with_grant($1, 'Office PC', $2) as r", [g.code, sha(KEY)]))).r;
  assert.equal(r.status, "linked");
  const [a] = await alerts();
  assert.deepEqual([a.organization_id, a.kind, a.device_name, a.sent_at], [org, "pc", "Office PC", null]);
});

test("a PC linked with a link code (0003) writes a PC alert too", async () => {
  await db.query("insert into computers (organization_id, name, key_hash, created_by) values ($1, 'Hall PC', $2, $3)", [org, sha("k2"), ANA]);
  assert.equal((await alerts()).at(-1).device_name, "Hall PC");
});

test("a device joining with a code and Add a device each write a device alert", async () => {
  const invite = (await one(as(ANA, "select invite_create($1, 'member') as r", [org]))).r;
  const joined = (await one(anonymousUser(PHONE, "select join_with_code($1, 'Lobby iPad') as r", [invite.code]))).r;
  assert.equal(joined.status, "joined");
  assert.deepEqual((await alerts()).at(-1).device_name, "Lobby iPad");
  const self = (await one(as(BEN, "select device_code_create($1) as r", [org]))).r;
  assert.equal((await one(service("select device_code_redeem($1, '198.51.100.4', 'Ben iPhone') as r", [self.code]))).r.status, "ok");
  const last = (await alerts()).at(-1);
  assert.deepEqual([last.kind, last.device_name], ["device", "Ben iPhone"]);
  assert.equal((await alerts()).filter((a) => a.organization_id === other).length, 0, "another team gets nothing");
});

test("owners and admins see the last 30 days, newest first, at most 20; Helpers and outsiders cannot", async () => {
  const mine = await recent(ANA);
  assert.deepEqual(mine.map((a) => a.device_name), ["Ben iPhone", "Lobby iPad", "Hall PC", "Office PC"]);
  assert.deepEqual(Object.keys(mine[0]).sort(), ["created_at", "device_name", "id", "kind"]);
  assert.equal((await recent(BEN)).length, 4, "an admin too");
  await assert.rejects(recent(CAL), /owners and admins/);
  await assert.rejects(recent(DAN), /owners and admins/);
  await assert.rejects(anonymousUser(PHONE, "select * from device_alerts_recent($1)", [org]), /owners and admins/);
  await db.query("update device_alerts set created_at = now() - interval '31 days' where device_name = 'Office PC'");
  assert.equal((await recent(ANA)).length, 3, "older than 30 days is not shown");
  for (let i = 0; i < 25; i++) await db.query("select device_alert_add($1, 'device', $2)", [org, `Phone ${i}`]);
  const many = await recent(ANA);
  assert.equal(many.length, 20);
  assert.equal(many[0].device_name, "Phone 24");
});

test("only the service key takes an alert, once, with the owners' and admins' emails", async () => {
  const id = (await alerts()).find((a) => a.device_name === "Hall PC").id;
  await assert.rejects(anon("select device_alert_take($1)", [id]));
  assert.ok(await denied(ANA, "select device_alert_take($1)", [id]));
  assert.ok(await denied(ANA, "select device_alert_release($1)", [id]));
  const r = (await one(service("select device_alert_take($1) as r", [id]))).r;
  assert.equal(r.status, "ok");
  assert.deepEqual([r.kind, r.deviceName, r.workspace], ["pc", "Hall PC", "Grace Church"]);
  assert.deepEqual([...r.to].sort(), ["ana@church.org", "ben@church.org"], "not the Helper, not a device without an email");
  assert.deepEqual((await one(service("select device_alert_take($1) as r", [id]))).r, { status: "done" }, "a second webhook sends nothing");
  await service("select device_alert_release($1)", [id]);
  assert.equal((await one(service("select device_alert_take($1) as r", [id]))).r.status, "ok", "given back after a failed send");
  assert.deepEqual((await one(service("select device_alert_take(999999) as r"))).r, { status: "done" });
});

test("the rollback removes it all and PCs still connect", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0023_device_alerts_down.sql", import.meta.url), "utf8"));
  assert.equal((await one(db.query("select to_regclass('public.device_alerts') as t"))).t, null);
  const left = await db.query("select proname from pg_proc where proname like 'device_alert%'");
  assert.equal(left.rows.length, 0);
  await db.query("insert into computers (organization_id, name, key_hash, created_by) values ($1, 'After PC', $2, $3)", [org, sha("k3"), ANA]);
});
