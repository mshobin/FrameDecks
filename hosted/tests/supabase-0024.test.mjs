// 0024 (26.11.38 the email code is the main way in): after an email code opens the workspace, email_sign_in writes one
// sign-in alert per session (at most 10 a day), emailed to that person alone; anonymous devices and people with no team
// write nothing; owners' and admins' list of new devices leaves sign-ins out; the rollback puts 0023 back.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const ANA = "00000000-0000-0000-0000-0000000024a1"; // owner
const CAL = "00000000-0000-0000-0000-0000000024a3"; // helper with an email
const PHONE = "00000000-0000-0000-0000-0000000024a4"; // a device that joined by scanning: no email
const NEW = "00000000-0000-0000-0000-0000000024a5"; // an email but no team yet
const S1 = "00000000-0000-0000-0000-00000000aaa1";
const S2 = "00000000-0000-0000-0000-00000000aaa2";

let db, as, org;
const one = async (p) => (await p).rows[0];
async function inSession(uid, session, sql, params) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ session_id: session })}', false)`);
  try {
    return await as(uid, sql, params);
  } finally {
    await db.exec("select set_config('request.jwt.claims', '{}', false)");
  }
}
const signIn = async (uid, session, name = "Chrome on Windows", shared = false) =>
  (await one(inSession(uid, session, "select email_sign_in($1, $2) as r", [name, shared]))).r;
const alerts = async () => (await db.query("select * from device_alerts order by id")).rows;
async function service(sql, params) {
  await db.exec("set role service_role");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

before(async () => {
  ({ db, as } = await supabaseStandIn({ [ANA]: "ana@church.org", [CAL]: "cal@church.org", [PHONE]: null, [NEW]: "new@church.org" }));
  org = (await one(as(ANA, "insert into organizations(name, created_by) values ('Grace Church', $1) returning id", [ANA]))).id;
  await db.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'member'), ($1, $3, 'member') on conflict do nothing", [org, CAL, PHONE]);
});
after(() => db?.close());

test("an email sign-in writes one alert for the person, once per session", async () => {
  assert.deepEqual(await signIn(CAL, S1), { status: "ok" });
  assert.deepEqual(await signIn(CAL, S1), { status: "done" }, "the same session again writes nothing");
  const [a] = await alerts();
  assert.deepEqual([a.kind, a.device_name, a.user_id, a.organization_id], ["signin", "Chrome on Windows", CAL, org]);
  assert.deepEqual(await signIn(CAL, S2, "Edge on Windows", true), { status: "ok" });
  assert.equal((await alerts()).at(-1).device_name, "Edge on Windows (someone else's computer)");
});

test("no email or no team: nothing", async () => {
  const before = (await alerts()).length;
  assert.deepEqual(await signIn(PHONE, S1), { status: "no-email" });
  assert.deepEqual(await signIn(NEW, S1), { status: "no-team" });
  assert.equal((await alerts()).length, before);
});

test("at most 10 a day for one person", async () => {
  for (let i = 0; i < 12; i++) await signIn(ANA, `00000000-0000-0000-0000-0000000bb${String(i).padStart(3, "0")}`);
  assert.equal((await alerts()).filter((a) => a.user_id === ANA).length, 10);
  assert.equal((await signIn(ANA, "00000000-0000-0000-0000-0000000cc001")).status, "enough");
});

test("the sign-in email goes to the person alone; the owners' list leaves sign-ins out", async () => {
  const id = (await alerts()).find((a) => a.user_id === CAL).id;
  const r = (await one(service("select device_alert_take($1) as r", [id]))).r;
  assert.deepEqual([r.kind, r.workspace, r.to], ["signin", "Grace Church", ["cal@church.org"]]);
  await db.query("select device_alert_add($1, 'device', 'Lobby iPad')", [org]);
  const list = (await as(ANA, "select * from device_alerts_recent($1)", [org])).rows;
  assert.deepEqual(list.map((x) => x.device_name), ["Lobby iPad"]);
  const pc = (await alerts()).at(-1).id;
  assert.deepEqual((await one(service("select device_alert_take($1) as r", [pc]))).r.to, ["ana@church.org"], "a device still goes to owners and admins");
});

test("only signed-in people call it, and only the service key takes an alert", async () => {
  await db.exec("set role anon");
  try {
    await assert.rejects(db.query("select email_sign_in('x', false)"));
  } finally {
    await db.exec("reset role");
  }
  await assert.rejects(as(CAL, "select device_alert_take(1)"));
});

test("the rollback puts 0023 back", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0024_email_sign_in_down.sql", import.meta.url), "utf8"));
  assert.equal((await alerts()).filter((a) => a.kind === "signin").length, 0);
  assert.equal((await one(db.query("select to_regproc('public.email_sign_in') as p"))).p, null);
  await assert.rejects(db.query("insert into device_alerts (organization_id, kind, device_name) values ($1, 'signin', 'X')", [org]));
  await db.query("select device_alert_add($1, 'pc', 'Hall PC')", [org]);
  assert.equal((await as(ANA, "select * from device_alerts_recent($1)", [org])).rows[0].device_name, "Hall PC");
});
