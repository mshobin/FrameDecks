// 0015 (9.8 Trusted Devices): a device token is kept only as a hash, a removed or expired device is refused before any
// request runs, link requests are limited and logged without the address, device events reach the workspace's audit
// log, workspace syncs are logged at most every 10 minutes, and the rollback removes it all.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

import { supabaseStandIn } from "./pglite-supabase.mjs";

const ANA = "00000000-0000-0000-0000-0000000000e1";
const BEN = "00000000-0000-0000-0000-0000000000e2";
const S1 = "00000000-0000-0000-0000-00000000aa01";
const S2 = "00000000-0000-0000-0000-00000000aa02";
const sha = (v) => createHash("sha256").update(v, "utf8").digest("hex");

let db, as, org;

// as(uid) with a session id in the token's claims, the way Supabase passes it
async function inSession(uid, session, sql, params) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify(session ? { session_id: session } : {})}', false)`);
  try {
    return await as(uid, sql, params);
  } finally {
    await db.exec("select set_config('request.jwt.claims', '', false)");
  }
}
async function anon(sql, params, headers = {}) {
  await db.exec(`set role anon; select set_config('request.uid', '', false);
    select set_config('request.headers', '${JSON.stringify(headers)}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.headers', '', false)");
  }
}

before(async () => {
  ({ db, as } = await supabaseStandIn({ [ANA]: "ana@x.org", [BEN]: "ben@x.org" }));
  org = (await as(ANA, "insert into organizations(name, created_by) values ('Team', $1) returning id", [ANA])).rows[0].id;
});

after(() => db?.close());

test("Trust This Device: a token is returned once and only its hash is kept", async () => {
  const r = (await inSession(ANA, S1, "select trust_device('Ana laptop') as r")).rows[0].r;
  assert.match(r.token, /^[A-Za-z0-9_-]{60,}$/);
  const row = (await db.query("select * from trusted_devices where id = $1", [r.id])).rows[0];
  assert.equal(row.token_hash, sha(r.token));
  assert.ok(!JSON.stringify(row).includes(r.token), "the token itself is not stored");
  assert.equal(row.session_id, S1);
  const days = (new Date(row.expires_at) - new Date(row.trusted_at)) / 86400000;
  assert.ok(Math.abs(days - 180) < 0.01, "trusted for 180 days");
  assert.equal((await inSession(ANA, S1, "select device_check($1) as s", [r.token])).rows[0].s, "trusted");
  assert.equal((await inSession(BEN, S2, "select device_check($1) as s", [r.token])).rows[0].s, "unknown", "another person's token");
  const list = (await inSession(ANA, S1, "select * from device_list()")).rows;
  assert.equal(list.length, 1);
  assert.equal(list[0].current, true);
  assert.equal(list[0].name, "Ana laptop");
});

test("the API roles cannot read the tables or call the internal functions", async () => {
  await assert.rejects(as(ANA, "select * from trusted_devices"));
  await assert.rejects(as(ANA, "select * from security_events"));
  await assert.rejects(as(ANA, "select security_log($1, 'device.trusted', null, '{}')", [ANA]));
  await assert.rejects(anon("select trust_device('x')"));
  await assert.rejects(anon("select device_list()"));
});

test("Manage Devices: removing a device refuses its session at once and logs it in the workspace", async () => {
  const r = (await inSession(ANA, S2, "select trust_device('Ana phone') as r")).rows[0].r;
  await inSession(ANA, S2, "select check_trusted_session()");       // allowed while trusted
  await assert.rejects(inSession(BEN, S1, "select device_revoke($1)", [r.id]), /Not allowed/, "only its owner");
  await inSession(ANA, S1, "select device_revoke($1)", [r.id]);
  await assert.rejects(inSession(ANA, S2, "select check_trusted_session()"), /no longer trusted/);
  assert.equal((await inSession(ANA, S2, "select device_check($1) as s", [r.token])).rows[0].s, "revoked");
  await inSession(ANA, S1, "select check_trusted_session()");       // the other device is unaffected
  await anon("select check_trusted_session()");                     // PCs and the anonymous key are unaffected
  assert.ok(!(await inSession(ANA, S1, "select * from device_list()")).rows.some((d) => d.id === r.id));
  const audit = (await db.query("select action from audit_log where organization_id = $1 order by id", [org])).rows.map((x) => x.action);
  assert.ok(audit.includes("device.trusted") && audit.includes("device.revoked"));
});

test("after 180 days a trusted device must be revalidated with a new link", async () => {
  const r = (await inSession(ANA, S1, "select trust_device('Old laptop') as r")).rows[0].r;
  await db.query("update trusted_devices set expires_at = now() - interval '1 minute' where id = $1", [r.id]);
  assert.equal((await inSession(ANA, S1, "select device_check($1) as s", [r.token])).rows[0].s, "expired");
  await assert.rejects(inSession(ANA, S1, "select check_trusted_session()"), /no longer trusted/);
  const ev = (await inSession(ANA, S1, "select action from security_event_list(50)")).rows.map((x) => x.action);
  assert.ok(ev.includes("device.expired"));
});

test("link requests: logged without the address, limited per address, and shown to that person afterwards", async () => {
  for (let i = 0; i < 10; i++) await anon("select magic_link_requested('ben@x.org')", [], { "x-forwarded-for": `198.51.100.${i}` });
  await assert.rejects(anon("select magic_link_requested('BEN@x.org ')"), /Too many/);
  await assert.rejects(anon("select magic_link_requested('not an email')"), /Enter an email/);
  const stored = (await db.query("select email_hash from security_events where action = 'link.requested' limit 1")).rows[0].email_hash;
  assert.equal(stored, sha("email:ben@x.org"));
  await inSession(BEN, S2, "select magic_link_used()");
  await inSession(BEN, S2, "select magic_link_used()");             // once per session
  const ev = (await inSession(BEN, S2, "select action from security_event_list(50)")).rows.map((x) => x.action);
  assert.equal(ev.filter((a) => a === "link.used").length, 1);
  assert.equal(ev.filter((a) => a === "link.requested").length, 10);
  assert.ok(!(await inSession(ANA, S1, "select action from security_event_list(50)")).rows.some((x) => x.action === "link.requested"),
    "another person never sees them");
});

test("workspace syncs reach the audit log at most every 10 minutes", async () => {
  await as(ANA, "select sync_push($1, $2::jsonb)", [org, JSON.stringify([{ kind: "frame", id: "s1", baseRev: 0, body: { name: "A" } }])]);
  await as(ANA, "select sync_push($1, $2::jsonb)", [org, JSON.stringify([{ kind: "frame", id: "s2", baseRev: 0, body: { name: "B" } }])]);
  const n = (await db.query("select count(*)::int as n from audit_log where organization_id = $1 and action = 'workspace.synced'", [org])).rows[0].n;
  assert.equal(n, 1);
});

test("rollback removes 0015 and leaves workspaces as they were", async () => {
  await db.exec(readFileSync(new URL("../supabase/rollback/0015_trusted_devices_down.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select to_regclass('public.trusted_devices') as t")).rows[0].t, null);
  assert.equal((await db.query("select count(*)::int as n from organizations")).rows[0].n, 1);
  await as(ANA, "select sync_push($1, $2::jsonb)", [org, JSON.stringify([{ kind: "frame", id: "s3", baseRev: 0, body: { name: "C" } }])]);
});
