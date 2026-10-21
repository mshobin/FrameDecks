// Pairing and trusted devices (docs/architecture/pairing-protocol.md §2, §3).
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { sha256 } from "../src/crypto";
import type { Env } from "../src/env";
import { call, fakeKey, newEmail, newIp, pairDevice, PHONE, post, RUNTIME, signIn } from "./helpers";

const E = env as unknown as Env;

const decode = (jwt: string) => JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));

/** A PC and a phone of one person, and a started pairing. */
async function started() {
  const email = newEmail();
  const pc = await signIn(email, RUNTIME);
  const phone = await signIn(email, { type: "browser" });
  const pcKey = fakeKey();
  const s = await post("/v1/pairing", { pcKey }, { token: pc.access });
  expect(s.status).toBe(201);
  return { email, pc, phone, rid: pc.runtime!.id, pcKey, start: s.body as { id: string; code: string; token: string; expiresAt: number } };
}

const claim = (data: Record<string, unknown>, token: string, ip = newIp()) =>
  post("/v1/pairing/claim", { device: PHONE, deviceKey: fakeKey(), ...data }, { token, ip });

/** A code that is not `code`. */
const wrong = (code: string) => String((Number(code) + 1) % 1000000).padStart(6, "0");

async function auditActions(ws: string, action: string) {
  const { results } = await E.DB.prepare("SELECT actor_type, actor_id, detail FROM audit_log WHERE workspace_id = ? AND action = ? ORDER BY id")
    .bind(ws, action).all<{ actor_type: string; actor_id: string; detail: string }>();
  return results.map((r) => ({ ...r, detail: JSON.parse(r.detail) }));
}

describe("POST /v1/pairing", () => {
  it("starts a 5-minute request with a 6-digit code and a 16-byte token, stored only as hashes", async () => {
    const before = Date.now();
    const { start, rid } = await started();
    expect(start.code).toMatch(/^\d{6}$/);
    expect(start.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(start.expiresAt).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
    expect(start.expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
    const row = await E.DB.prepare("SELECT * FROM pairing_requests WHERE id = ?").bind(start.id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ runtime_id: rid, status: "open", attempts: 0, credential_delivered: 0 });
    expect(JSON.stringify(row)).not.toContain(start.token);
    expect(JSON.stringify(row)).not.toContain(`"${start.code}"`);
    expect(row!.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.code_salt).toBeTruthy();
  });

  it("ends the PC's other open request", async () => {
    const { pc, start, phone } = await started();
    const again = await post("/v1/pairing", { pcKey: fakeKey() }, { token: pc.access });
    expect(again.status).toBe(201);
    expect((await call(`/v1/pairing/${start.id}`, { token: pc.access })).body.status).toBe("expired");
    expect((await call(`/v1/pairing/${again.body.id}`, { token: pc.access })).body.status).toBe("open");
    expect((await claim({ token: start.token }, phone.access)).status).toBe(410);
  });

  it("is for runtimes only, and needs a 32-byte key", async () => {
    const { pc, phone } = await started();
    const r = await post("/v1/pairing", { pcKey: fakeKey() }, { token: phone.access });
    expect(r.status).toBe(403);
    expect((await post("/v1/pairing", { pcKey: "short" }, { token: pc.access })).body.error.code).toBe("bad_key");
    expect((await post("/v1/pairing", {}, { token: pc.access })).status).toBe(400);
    expect((await post("/v1/pairing", { pcKey: fakeKey() })).status).toBe(401);
  });

  it("allows 30 an hour per runtime", async () => {
    const pc = await signIn(newEmail(), RUNTIME);
    for (let i = 0; i < 30; i++) expect((await post("/v1/pairing", { pcKey: fakeKey() }, { token: pc.access })).status).toBe(201);
    const r = await post("/v1/pairing", { pcKey: fakeKey() }, { token: pc.access });
    expect(r.status).toBe(429);
    expect(r.body.error.retryAfter).toBeGreaterThan(0);
  });
});

describe("POST /v1/pairing/claim", () => {
  it("claims with the QR token and answers the PC's key; the PC then sees the device and its key", async () => {
    const { pc, phone, rid, pcKey, start } = await started();
    const deviceKey = fakeKey();
    const r = await claim({ token: start.token, deviceKey }, phone.access);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ id: start.id, runtime: { id: rid, name: "Church PC" }, pcKey, expiresAt: start.expiresAt });

    const seen = await call(`/v1/pairing/${start.id}`, { token: pc.access });
    expect(seen.body).toEqual({ id: start.id, status: "claimed", expiresAt: start.expiresAt, device: PHONE, deviceKey });
    // the claimer sees the status, but not the key or the device details
    const mine = await call(`/v1/pairing/${start.id}`, { token: phone.access });
    expect(mine.body).toEqual({ id: start.id, status: "claimed", expiresAt: start.expiresAt });
    // used: a second claim fails
    expect((await claim({ token: start.token }, phone.access)).body.error.code).toBe("pair_expired");
  });

  it("claims with the 6-digit code among the workspace's open requests", async () => {
    const { phone, rid, start } = await started();
    const r = await claim({ code: start.code }, phone.access);
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(start.id);
    expect(r.body.runtime.id).toBe(rid);
  });

  it("a code is looked up only in the claimer's own workspace", async () => {
    const { start } = await started();
    const stranger = await signIn(newEmail(), { type: "browser" });
    const r = await claim({ code: start.code }, stranger.access);
    expect(r.status).toBe(410);
    expect(r.body.error.code).toBe("pair_expired");
  });

  it("a wrong code answers 400 code_wrong; the fifth ends the request (410 pair_expired)", async () => {
    const { pc, phone, start } = await started();
    for (let i = 1; i <= 4; i++) {
      const r = await claim({ code: wrong(start.code) }, phone.access);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe("code_wrong");
    }
    const fifth = await claim({ code: wrong(start.code) }, phone.access);
    expect(fifth.status).toBe(410);
    expect(fifth.body.error.code).toBe("pair_expired");
    const row = await E.DB.prepare("SELECT attempts, status FROM pairing_requests WHERE id = ?").bind(start.id).first();
    expect(row).toEqual({ attempts: 5, status: "expired" });
    // even the right code is too late now
    expect((await claim({ code: start.code }, phone.access)).status).toBe(410);
    expect((await call(`/v1/pairing/${start.id}`, { token: pc.access })).body.status).toBe("expired");
  });

  it("a wrong code counts against every open request of the workspace", async () => {
    const email = newEmail();
    const a = await signIn(email, RUNTIME);
    const b = await signIn(email, { ...RUNTIME, name: "Laptop", platform: "macos" });
    const phone = await signIn(email, { type: "browser" });
    const sa = (await post("/v1/pairing", { pcKey: fakeKey() }, { token: a.access })).body;
    const sb = (await post("/v1/pairing", { pcKey: fakeKey() }, { token: b.access })).body;
    let bad = "000000";
    while (bad === sa.code || bad === sb.code) bad = wrong(bad);
    expect((await claim({ code: bad }, phone.access)).status).toBe(400);
    const { results } = await E.DB.prepare("SELECT attempts FROM pairing_requests WHERE id IN (?, ?)").bind(sa.id, sb.id).all<{ attempts: number }>();
    expect(results.map((r) => r.attempts)).toEqual([1, 1]);
  });

  it("an expired request cannot be claimed, and reads as expired", async () => {
    const { pc, phone, start } = await started();
    await E.DB.prepare("UPDATE pairing_requests SET expires_at = ? WHERE id = ?").bind(Date.now() - 1, start.id).run();
    expect((await claim({ token: start.token }, phone.access)).body.error.code).toBe("pair_expired");
    expect((await claim({ code: start.code }, phone.access)).body.error.code).toBe("pair_expired");
    expect((await call(`/v1/pairing/${start.id}`, { token: pc.access })).body.status).toBe("expired");
  });

  it("a claimed request that expires before approval cannot be approved", async () => {
    const { pc, phone, start } = await started();
    expect((await claim({ token: start.token }, phone.access)).status).toBe(200);
    await E.DB.prepare("UPDATE pairing_requests SET expires_at = ? WHERE id = ?").bind(Date.now() - 1, start.id).run();
    expect((await call(`/v1/pairing/${start.id}`, { token: phone.access })).body.status).toBe("expired");
    const r = await post(`/v1/pairing/${start.id}/approve`, {}, { token: pc.access });
    expect(r.status).toBe(410);
  });

  it("refuses someone outside the PC's workspace, a runtime, a device, and no token", async () => {
    const { pc, start } = await started();
    const stranger = await signIn(newEmail(), { type: "browser" });
    const r = await claim({ token: start.token }, stranger.access);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("forbidden");
    expect((await claim({ token: start.token }, pc.access)).status).toBe(403);
    const paired = await pairDevice();
    const byDevice = await claim({ token: start.token }, paired.credential.access);
    expect(byDevice.status).toBe(403);
    expect((await post("/v1/pairing/claim", { token: start.token, deviceKey: fakeKey() })).status).toBe(401);
    // the request is still open for its owner
    expect((await call(`/v1/pairing/${start.id}`, { token: pc.access })).body.status).toBe("open");
  });

  it("needs the phone's key, and a token or a code", async () => {
    const { phone, start } = await started();
    expect((await post("/v1/pairing/claim", { token: start.token, device: PHONE }, { token: phone.access, ip: newIp() })).body.error.code).toBe("bad_key");
    expect((await claim({}, phone.access)).status).toBe(400);
    expect((await claim({ token: "nope" }, phone.access)).status).toBe(410);
  });

  it("allows 10 a minute per user and 30 an hour per IP", async () => {
    const { phone } = await started();
    for (let i = 0; i < 10; i++) expect((await claim({ token: `x${i}` }, phone.access)).status).toBe(410);
    const r = await claim({ token: "x" }, phone.access);
    expect(r.status).toBe(429);

    const other = await signIn(newEmail(), { type: "browser" });
    const ip = newIp();
    const key = `pair-claim:ip:${(await sha256(`fd-ip:${ip}`)).slice(0, 32)}`;
    const HOUR = 60 * 60 * 1000;
    await E.DB.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 30)").bind(key, Math.floor(Date.now() / HOUR) * HOUR).run();
    expect((await claim({ token: "y" }, other.access, ip)).status).toBe(429);
    expect((await claim({ token: "y" }, other.access, newIp())).status).toBe(410);
  });
});

describe("GET /v1/pairing/{id}, approve and reject", () => {
  it("approve makes the device; the claimer collects its credential exactly once", async () => {
    const { pc, phone, rid, start } = await started();
    expect((await post(`/v1/pairing/${start.id}/approve`, {}, { token: pc.access })).body.error.code).toBe("not_claimed");
    await claim({ token: start.token }, phone.access);
    expect((await post(`/v1/pairing/${start.id}/approve`, { role: "owner" }, { token: pc.access })).body.error.code).toBe("bad_role");
    expect((await post(`/v1/pairing/${start.id}/approve`, {}, { token: phone.access })).status).toBe(403);

    const ok = await post(`/v1/pairing/${start.id}/approve`, { role: "viewer" }, { token: pc.access });
    expect(ok.status).toBe(200);
    const device = ok.body.device;
    expect(device).toMatchObject({ name: "iPhone", platform: "iOS", browser: "Safari", role: "viewer", lastUsedAt: null, revoked: false });
    expect(typeof device.id).toBe("string");
    expect(device.approvedAt).toBeGreaterThan(0);
    const row = await E.DB.prepare("SELECT runtime_id, user_id, role, approved_at FROM devices WHERE id = ?").bind(device.id).first();
    expect(row).toMatchObject({ runtime_id: rid, user_id: phone.user.id, role: "viewer" });
    // approving again: used
    expect((await post(`/v1/pairing/${start.id}/approve`, {}, { token: pc.access })).status).toBe(410);

    // the PC sees approved, with no credential
    const pcView = await call(`/v1/pairing/${start.id}`, { token: pc.access });
    expect(pcView.body.status).toBe("approved");
    expect(pcView.body.credential).toBeUndefined();

    const first = await call(`/v1/pairing/${start.id}`, { token: phone.access });
    expect(first.body.status).toBe("approved");
    const cred = first.body.credential;
    expect(cred).toMatchObject({ device: { id: device.id, role: "viewer", name: "iPhone" }, runtime: { id: rid, name: "Church PC" } });
    expect(typeof cred.refresh).toBe("string");
    expect(cred.accessExpiresAt).toBeGreaterThan(Date.now());
    const claims = decode(cred.access);
    expect(claims).toMatchObject({ typ: "device", sub: device.id, rid, role: "viewer", ws: phone.workspace.id, uid: phone.user.id });
    expect(claims.exp - claims.iat).toBe(600);

    const second = await call(`/v1/pairing/${start.id}`, { token: phone.access });
    expect(second.body).toEqual({ id: start.id, status: "approved", expiresAt: start.expiresAt });
    const families = await E.DB.prepare("SELECT COUNT(*) AS n FROM refresh_tokens WHERE subject_type = 'device' AND subject_id = ?").bind(device.id).first<{ n: number }>();
    expect(families!.n).toBe(1);
  });

  it("the role defaults to operator", async () => {
    const { pc, phone, start } = await started();
    await claim({ code: start.code }, phone.access);
    const ok = await call(`/v1/pairing/${start.id}/approve`, { method: "POST", token: pc.access });
    expect(ok.status).toBe(200);
    expect(ok.body.device.role).toBe("operator");
  });

  it("reject ends the request; the claimer sees rejected and gets nothing", async () => {
    const { pc, phone, start } = await started();
    await claim({ token: start.token }, phone.access);
    const r = await call(`/v1/pairing/${start.id}/reject`, { method: "POST", token: pc.access });
    expect(r.status).toBe(204);
    expect((await call(`/v1/pairing/${start.id}`, { token: phone.access })).body).toEqual({ id: start.id, status: "rejected", expiresAt: start.expiresAt });
    expect((await post(`/v1/pairing/${start.id}/approve`, {}, { token: pc.access })).status).toBe(410);
    expect((await call(`/v1/pairing/${start.id}/reject`, { method: "POST", token: pc.access })).status).toBe(410);
  });

  it("only the runtime that started it and the user who claimed it can see it", async () => {
    const { email, pc, phone, start } = await started();
    const sameAccountOtherBrowser = await signIn(email, { type: "browser" });
    // before the claim, the person has not claimed it: not visible
    expect((await call(`/v1/pairing/${start.id}`, { token: phone.access })).status).toBe(404);
    await claim({ token: start.token }, phone.access);
    const laptop = await signIn(email, { ...RUNTIME, name: "Laptop" });
    const stranger = await signIn(newEmail(), { type: "browser" });
    expect((await call(`/v1/pairing/${start.id}`, { token: laptop.access })).status).toBe(404);
    expect((await call(`/v1/pairing/${start.id}`, { token: stranger.access })).status).toBe(404);
    expect((await post(`/v1/pairing/${start.id}/approve`, {}, { token: laptop.access })).status).toBe(404);
    expect((await call(`/v1/pairing/${start.id}`, { token: pc.access })).status).toBe(200);
    // the same person (the claimer) on another sign-in sees it too
    expect((await call(`/v1/pairing/${start.id}`, { token: sameAccountOtherBrowser.access })).status).toBe(200);
    expect((await call("/v1/pairing/p_unknown", { token: pc.access })).status).toBe(404);
  });

  it("writes pair_started, pair_claimed, pair_approved and pair_rejected to the audit log", async () => {
    const { pc, phone, rid, pairingId, device } = await pairDevice();
    const ws = phone.workspace.id;
    expect(await auditActions(ws, "pair_started")).toEqual([{ actor_type: "runtime", actor_id: rid, detail: { pairing: pairingId } }]);
    expect(await auditActions(ws, "pair_claimed")).toEqual([{
      actor_type: "user", actor_id: phone.user.id, detail: { pairing: pairingId, runtime: rid, method: "token", device: "iPhone" },
    }]);
    expect(await auditActions(ws, "pair_approved")).toEqual([{
      actor_type: "runtime", actor_id: rid, detail: { pairing: pairingId, device: device.id, role: "operator", user: phone.user.id },
    }]);
    const s = (await post("/v1/pairing", { pcKey: fakeKey() }, { token: pc.access })).body;
    await call(`/v1/pairing/${s.id}/reject`, { method: "POST", token: pc.access });
    expect(await auditActions(ws, "pair_rejected")).toEqual([{ actor_type: "runtime", actor_id: rid, detail: { pairing: s.id } }]);
  });
});

describe("device tokens", () => {
  it("refresh rotates and detects reuse", async () => {
    const { credential, device, rid } = await pairDevice();
    const r = await post("/v1/auth/refresh", { refresh: credential.refresh });
    expect(r.status).toBe(200);
    expect(decode(r.body.access)).toMatchObject({ typ: "device", sub: device.id, rid, role: "operator" });
    expect(r.body.refresh).not.toBe(credential.refresh);
    const again = await post("/v1/auth/refresh", { refresh: credential.refresh });
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe("token_reused");
    expect((await post("/v1/auth/refresh", { refresh: r.body.refresh })).status).toBe(401);   // the family is gone
  });

  it("a device token may not call anything but refresh, its own ticket and deleting itself", async () => {
    const { credential, device, rid, pc } = await pairDevice();
    const t = credential.access;
    for (const [method, path] of [["GET", "/v1/me"], ["GET", "/v1/sync"], ["GET", "/v1/relay/runtimes"], ["GET", `/v1/devices?runtime=${rid}`],
      ["PATCH", `/v1/devices/${device.id}`], ["GET", "/v1/audit"], ["POST", "/v1/pairing"], ["DELETE", `/v1/runtimes/${rid}`]]) {
      const r = await call(path, { method, token: t, body: method === "GET" ? undefined : JSON.stringify({ role: "admin", pcKey: fakeKey() }) });
      expect([method, path, r.status]).toEqual([method, path, 403]);
    }
    // nothing changed
    expect((await call(`/v1/devices?runtime=${rid}`, { token: pc.access })).body[0].role).toBe("operator");
    expect((await post(`/v1/relay/${rid}/ticket`, {}, { token: t })).status).toBe(200);
  });

  it("a revoked device's access token fails on the next request, and its refresh fails", async () => {
    const { credential, device, rid, pc } = await pairDevice();
    expect((await post(`/v1/relay/${rid}/ticket`, {}, { token: credential.access })).status).toBe(200);
    expect((await call(`/v1/devices/${device.id}`, { method: "DELETE", token: pc.access })).status).toBe(204);
    const r = await post(`/v1/relay/${rid}/ticket`, {}, { token: credential.access });
    expect(r.status).toBe(401);
    expect((await call(`/v1/devices/${device.id}`, { method: "DELETE", token: credential.access })).status).toBe(401);
    expect((await post("/v1/auth/refresh", { refresh: credential.refresh })).status).toBe(401);
  });

  it("revoking the PC ends its devices too", async () => {
    const { credential, rid, phone } = await pairDevice();
    expect((await call(`/v1/runtimes/${rid}`, { method: "DELETE", token: phone.access })).status).toBe(204);
    expect((await post(`/v1/relay/${rid}/ticket`, {}, { token: credential.access })).status).toBe(401);
    expect((await post("/v1/auth/refresh", { refresh: credential.refresh })).status).toBe(401);
  });
});

describe("/v1/devices", () => {
  it("GET lists a runtime's devices for that runtime and for an admin user only", async () => {
    const { pc, phone, rid, device, email } = await pairDevice();
    await call(`/v1/devices/${device.id}`, { method: "PATCH", token: pc.access, body: JSON.stringify({ role: "presenter" }) });
    const want = [{ id: device.id, name: "iPhone", platform: "iOS", browser: "Safari", role: "presenter", approvedAt: expect.any(Number), lastUsedAt: null, revoked: false }];
    expect((await call(`/v1/devices?runtime=${rid}`, { token: pc.access })).body).toEqual(want);
    expect((await call(`/v1/devices?runtime=${rid}`, { token: phone.access })).body).toEqual(want);

    const laptop = await signIn(email, { ...RUNTIME, name: "Laptop" });
    expect((await call(`/v1/devices?runtime=${rid}`, { token: laptop.access })).status).toBe(403);
    const stranger = await signIn(newEmail(), { type: "browser" });
    expect((await call(`/v1/devices?runtime=${rid}`, { token: stranger.access })).status).toBe(404);
    expect((await call("/v1/devices", { token: pc.access })).status).toBe(400);

    // a member who is not an admin
    const member = await signIn(newEmail(), { type: "browser" });
    await E.DB.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'operator')").bind(phone.workspace.id, member.user.id).run();
    await E.DB.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").bind(member.workspace.id, member.user.id).run();
    const memberTokens = await post("/v1/auth/refresh", { refresh: member.refresh });
    expect((await call(`/v1/devices?runtime=${rid}`, { token: memberTokens.body.access })).status).toBe(403);
  });

  it("PATCH changes the role (the device's runtime or an admin user) and audits it", async () => {
    const { pc, phone, rid, device, email } = await pairDevice();
    const r = await call(`/v1/devices/${device.id}`, { method: "PATCH", token: pc.access, body: JSON.stringify({ role: "viewer" }) });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: device.id, role: "viewer" });
    const r2 = await call(`/v1/devices/${device.id}`, { method: "PATCH", token: phone.access, body: JSON.stringify({ role: "admin" }) });
    expect(r2.body.role).toBe("admin");
    expect((await call(`/v1/devices/${device.id}`, { method: "PATCH", token: pc.access, body: JSON.stringify({ role: "boss" }) })).status).toBe(400);
    const laptop = await signIn(email, { ...RUNTIME, name: "Laptop" });
    expect((await call(`/v1/devices/${device.id}`, { method: "PATCH", token: laptop.access, body: JSON.stringify({ role: "viewer" }) })).status).toBe(403);
    const stranger = await signIn(newEmail(), { type: "browser" });
    expect((await call(`/v1/devices/${device.id}`, { method: "PATCH", token: stranger.access, body: JSON.stringify({ role: "viewer" }) })).status).toBe(404);
    expect(await auditActions(phone.workspace.id, "device_role_changed")).toEqual([
      { actor_type: "runtime", actor_id: rid, detail: { device: device.id, runtime: rid, from: "operator", role: "viewer" } },
      { actor_type: "user", actor_id: phone.user.id, detail: { device: device.id, runtime: rid, from: "viewer", role: "admin" } },
    ]);
  });

  it("DELETE: the device itself, its runtime or an admin user; another runtime or a stranger cannot; audited", async () => {
    const a = await pairDevice();
    const laptop = await signIn(a.email, { ...RUNTIME, name: "Laptop" });
    const stranger = await signIn(newEmail(), { type: "browser" });
    expect((await call(`/v1/devices/${a.device.id}`, { method: "DELETE", token: laptop.access })).status).toBe(403);
    expect((await call(`/v1/devices/${a.device.id}`, { method: "DELETE", token: stranger.access })).status).toBe(404);
    // another paired device cannot delete this one
    const b = await pairDevice();
    expect((await call(`/v1/devices/${a.device.id}`, { method: "DELETE", token: b.credential.access })).status).toBe(404);

    expect((await call(`/v1/devices/${a.device.id}`, { method: "DELETE", token: a.credential.access })).status).toBe(204);
    const list = (await call(`/v1/devices?runtime=${a.rid}`, { token: a.pc.access })).body;
    expect(list[0].revoked).toBe(true);
    const tokens = await E.DB.prepare("SELECT COUNT(*) AS n FROM refresh_tokens WHERE subject_type = 'device' AND subject_id = ? AND revoked_at IS NULL").bind(a.device.id).first<{ n: number }>();
    expect(tokens!.n).toBe(0);
    expect(await auditActions(a.phone.workspace.id, "device_revoked")).toEqual([
      { actor_type: "device", actor_id: a.device.id, detail: { device: a.device.id, runtime: a.rid } },
    ]);

    expect((await call(`/v1/devices/${b.device.id}`, { method: "DELETE", token: b.phone.access })).status).toBe(204);
    const c = await pairDevice();
    expect((await call(`/v1/devices/${c.device.id}`, { method: "DELETE", token: c.pc.access })).status).toBe(204);
  });

  it("deleting the account that paired a device ends the device", async () => {
    const { phone, credential, rid } = await pairDevice();
    expect((await call("/v1/me", { method: "DELETE", token: phone.access })).status).toBe(204);
    expect((await post(`/v1/relay/${rid}/ticket`, {}, { token: credential.access })).status).toBe(401);
    expect((await post("/v1/auth/refresh", { refresh: credential.refresh })).status).toBe(401);
  });
});
