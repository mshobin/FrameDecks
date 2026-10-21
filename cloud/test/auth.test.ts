// Signing in with an email code, tokens (rotation, reuse, expiry), sign-out, you and your computers, account deletion.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { signAccess } from "../src/jwt";
import type { Env } from "../src/env";
import { call, newEmail, newIp, post, RUNTIME, signIn } from "./helpers";

const E = env as unknown as Env;

describe("email code sign-in", () => {
  it("sends a code (shown in test), then signs a runtime in with a new account and workspace", async () => {
    const email = newEmail();
    const ip = newIp();
    const s = await post("/v1/auth/email/start", { email: email.toUpperCase() }, { ip });
    expect(s.status).toBe(202);
    expect(s.body.sent).toBe(true);
    expect(s.body.devCode).toMatch(/^\d{6}$/);
    const v = await post("/v1/auth/email/verify", { email, code: s.body.devCode, client: RUNTIME }, { ip });
    expect(v.status).toBe(200);
    expect(v.body.user.email).toBe(email);
    expect(v.body.workspace.role).toBe("admin");
    expect(v.body.workspace.name).toBe("My ministry");
    expect(v.body.runtime.name).toBe("Church PC");
    expect(v.body.access.split(".")).toHaveLength(3);
    expect(v.body.accessExpiresAt).toBeGreaterThan(Date.now());
    expect(v.body.refresh.length).toBeGreaterThanOrEqual(40);
    // the code is used up
    const again = await post("/v1/auth/email/verify", { email, code: s.body.devCode, client: RUNTIME }, { ip });
    expect(again.body.error.code).toBe("code_expired");
  });

  it("a browser sign-in has no runtime; the same email is the same user", async () => {
    const email = newEmail();
    const a = await signIn(email, RUNTIME);
    const b = await signIn(email, { type: "browser", platform: "web" });
    expect(b.user.id).toBe(a.user.id);
    expect(b.workspace.id).toBe(a.workspace.id);
    expect(b.runtime).toBeUndefined();
  });

  it("refuses a wrong code, and ends the code after 5 wrong tries", async () => {
    const email = newEmail();
    const ip = newIp();
    const s = await post("/v1/auth/email/start", { email }, { ip });
    const wrong = s.body.devCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      const v = await post("/v1/auth/email/verify", { email, code: wrong }, { ip });
      expect(v.status).toBe(400);
      expect(v.body.error.code).toBe("code_wrong");
      expect(v.body.error.message).toMatch(/not right/);
    }
    const right = await post("/v1/auth/email/verify", { email, code: s.body.devCode }, { ip });
    expect(right.body.error.code).toBe("code_expired");
  });

  it("refuses an expired code", async () => {
    const email = newEmail();
    const s = await post("/v1/auth/email/start", { email }, { ip: newIp() });
    await E.DB.prepare("UPDATE email_codes SET expires_at = ? WHERE email = ?").bind(Date.now() - 1, email).run();
    const v = await post("/v1/auth/email/verify", { email, code: s.body.devCode }, { ip: newIp() });
    expect(v.status).toBe(400);
    expect(v.body.error.code).toBe("code_expired");
  });

  it("limits codes to 5 an hour per email (429 with retryAfter)", async () => {
    const email = newEmail();
    for (let i = 0; i < 5; i++) expect((await post("/v1/auth/email/start", { email }, { ip: newIp() })).status).toBe(202);
    const r = await post("/v1/auth/email/start", { email }, { ip: newIp() });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe("rate_limited");
    expect(r.body.error.retryAfter).toBeGreaterThan(0);
  });

  it("limits codes to 20 an hour per address", async () => {
    const ip = newIp();
    for (let i = 0; i < 20; i++) expect((await post("/v1/auth/email/start", { email: newEmail() }, { ip })).status).toBe(202);
    expect((await post("/v1/auth/email/start", { email: newEmail() }, { ip })).status).toBe(429);
  });

  it("is not available without a mailer outside dev and test", async () => {
    const r = await post("/v1/auth/email/start", { email: newEmail() }, { ip: newIp(), env: { ENVIRONMENT: "production" } });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe("email_not_configured");
    const p = await call("/v1/auth/providers", { env: { ENVIRONMENT: "production" } });
    expect(p.body).toEqual({ providers: [], email: false });
  });

  it("checks the address and the client", async () => {
    expect((await post("/v1/auth/email/start", { email: "nope" }, { ip: newIp() })).body.error.code).toBe("bad_email");
    const email = newEmail();
    const s = await post("/v1/auth/email/start", { email }, { ip: newIp() });
    const v = await post("/v1/auth/email/verify", { email, code: s.body.devCode, client: { type: "runtime", platform: "ios" } }, { ip: newIp() });
    expect(v.status).toBe(400);
    expect(v.body.error.code).toBe("bad_client");
  });
});

describe("tokens", () => {
  it("publishes the public signing key", async () => {
    const r = await call("/v1/.well-known/jwks.json");
    expect(r.body.keys).toHaveLength(1);
    expect(r.body.keys[0]).toMatchObject({ kty: "EC", crv: "P-256", kid: "test-1", alg: "ES256" });
    expect(r.body.keys[0].d).toBeUndefined();
  });

  it("rotates the refresh token; a reused one ends the whole sign-in", async () => {
    const s = await signIn();
    const r1 = await post("/v1/auth/refresh", { refresh: s.refresh });
    expect(r1.status).toBe(200);
    expect(r1.body.refresh).not.toBe(s.refresh);
    expect((await call("/v1/me", { token: r1.body.access })).status).toBe(200);
    // the old one again: reuse, so the family (including r1's new token) is revoked
    const reused = await post("/v1/auth/refresh", { refresh: s.refresh });
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe("token_reused");
    const r2 = await post("/v1/auth/refresh", { refresh: r1.body.refresh });
    expect(r2.status).toBe(401);
    const log = await E.DB.prepare("SELECT action FROM audit_log WHERE workspace_id = ? AND action = 'token_reused'").bind(s.workspace.id).first();
    expect(log).not.toBeNull();
  });

  it("refuses an expired or tampered access token", async () => {
    const s = await signIn();
    const old = await signAccess(E, { sub: s.runtime!.id, typ: "runtime", uid: s.user.id, ws: s.workspace.id, role: "admin", jti: "j1" },
      Date.now() - 20 * 60 * 1000);
    const expired = await call("/v1/me", { token: old.token });
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe("unauthorized");
    const [h, p, sig] = s.access.split(".");
    const claims = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    const forged = btoa(JSON.stringify({ ...claims, role: "admin", ws: "w_someone_else" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect((await call("/v1/me", { token: `${h}.${forged}.${sig}` })).status).toBe(401);
    expect((await call("/v1/me", { token: "not-a-jwt" })).status).toBe(401);
    expect((await call("/v1/me")).status).toBe(401);
  });

  it("signs out: the refresh token stops working", async () => {
    const s = await signIn();
    expect((await post("/v1/auth/logout", { refresh: s.refresh })).status).toBe(204);
    expect((await post("/v1/auth/refresh", { refresh: s.refresh })).status).toBe(401);
  });
});

describe("you and your computers", () => {
  it("GET /me lists the user, the workspace and its runtimes", async () => {
    const s = await signIn();
    const r = await call("/v1/me", { token: s.access });
    expect(r.status).toBe(200);
    expect(r.body.user).toEqual({ id: s.user.id, email: s.user.email, name: "" });
    expect(r.body.workspace).toEqual({ id: s.workspace.id, name: s.workspace.name, role: "admin" });
    expect(r.body.runtimes).toHaveLength(1);
    expect(r.body.runtimes[0]).toMatchObject({ id: s.runtime!.id, name: "Church PC", platform: "windows", appVersion: "6.9", revoked: false });
  });

  it("signing in again with the runtime's id re-uses it", async () => {
    const email = newEmail();
    const a = await signIn(email, RUNTIME);
    const b = await signIn(email, { ...RUNTIME, name: "Church PC (new name)", runtimeId: a.runtime!.id });
    expect(b.runtime!.id).toBe(a.runtime!.id);
    const c = await signIn(email, { ...RUNTIME, name: "Laptop", platform: "macos" });
    expect(c.runtime!.id).not.toBe(a.runtime!.id);
    const me = await call("/v1/me", { token: c.access });
    expect(me.body.runtimes.map((r: { name: string }) => r.name).sort()).toEqual(["Church PC (new name)", "Laptop"]);
  });

  it("an administrator renames and revokes a runtime; a revoked one cannot refresh", async () => {
    const email = newEmail();
    const pc = await signIn(email, RUNTIME);
    const admin = await signIn(email, { type: "browser" });
    const ren = await call(`/v1/runtimes/${pc.runtime!.id}`, { method: "PATCH", token: admin.access, body: JSON.stringify({ name: "Sanctuary PC" }) });
    expect(ren.status).toBe(200);
    expect(ren.body.name).toBe("Sanctuary PC");
    expect((await call(`/v1/runtimes/${pc.runtime!.id}`, { method: "DELETE", token: admin.access })).status).toBe(204);
    expect((await post("/v1/auth/refresh", { refresh: pc.refresh })).status).toBe(401);
    expect((await call("/v1/me", { token: pc.access })).status).toBe(401);     // its access token stops at once too
    const me = await call("/v1/me", { token: admin.access });
    expect(me.body.runtimes[0].revoked).toBe(true);
    expect((await call("/v1/runtimes/r_unknown", { method: "DELETE", token: admin.access })).status).toBe(404);
  });

  it("someone who is not an administrator cannot manage runtimes or read the audit log", async () => {
    const owner = await signIn(newEmail(), RUNTIME);
    const other = await signIn(newEmail(), { type: "browser" });
    // make `other` an operator of the owner's workspace (no invitations yet: straight in the database)
    await E.DB.batch([
      E.DB.prepare("DELETE FROM workspace_members WHERE user_id = ?").bind(other.user.id),
      E.DB.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'operator')").bind(owner.workspace.id, other.user.id),
    ]);
    const op = await post("/v1/auth/refresh", { refresh: other.refresh });
    expect(op.status).toBe(200);
    const patch = await call(`/v1/runtimes/${owner.runtime!.id}`, { method: "PATCH", token: op.body.access, body: JSON.stringify({ name: "x" }) });
    expect(patch.status).toBe(403);
    expect(patch.body.error.code).toBe("forbidden");
    expect((await call(`/v1/runtimes/${owner.runtime!.id}`, { method: "DELETE", token: op.body.access })).status).toBe(403);
    expect((await call("/v1/audit", { token: op.body.access })).status).toBe(403);
    expect((await call("/v1/sync", { token: op.body.access })).status).toBe(403);
  });

  it("the audit log shows sign-ins and registrations", async () => {
    const s = await signIn();
    const r = await call("/v1/audit", { token: s.access });
    expect(r.status).toBe(200);
    expect(r.body.events.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["runtime_registered", "sign_in"]));
    const next = await call(`/v1/audit?since=${r.body.next}`, { token: s.access });
    expect(next.body.events).toEqual([]);
  });

  it("exports everything stored about you", async () => {
    const s = await signIn();
    await post("/v1/sync", { changes: [{ kind: "brand", id: "brand", baseRev: 0, body: { meeting: "Tuesday" } }] }, { token: s.access });
    const r = await call("/v1/me/export", { token: s.access });
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Disposition")).toContain("framedecks-export.json");
    expect(r.body.user.email).toBe(s.user.email);
    expect(r.body.identities).toEqual([{ provider: "email", subject: s.user.email }]);
    expect(r.body.entities).toHaveLength(1);
    expect(r.body.entities[0]).toMatchObject({ kind: "brand", body: { meeting: "Tuesday" } });
    expect(r.body.runtimes).toHaveLength(1);
    expect(r.body.audit.length).toBeGreaterThan(0);
  });

  it("deleting your account removes your workspace's data and ends every sign-in", async () => {
    const email = newEmail();
    const s = await signIn(email);
    await post("/v1/sync", { changes: [{ kind: "frame", id: "sc_1", baseRev: 0, body: { name: "Welcome" } }] }, { token: s.access });
    expect((await call("/v1/me", { method: "DELETE", token: s.access })).status).toBe(204);
    for (const t of ["entities", "runtimes", "workspace_members"]) {
      const n = await E.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE workspace_id = ?`).bind(s.workspace.id).first<{ n: number }>();
      expect(n?.n).toBe(0);
    }
    expect(await E.DB.prepare("SELECT id FROM workspaces WHERE id = ?").bind(s.workspace.id).first()).toBeNull();
    const u = await E.DB.prepare("SELECT email, deleted_at FROM users WHERE id = ?").bind(s.user.id).first<{ email: string; deleted_at: number }>();
    expect(u?.deleted_at).toBeGreaterThan(0);
    expect(u?.email).not.toBe(email);
    expect((await post("/v1/auth/refresh", { refresh: s.refresh })).status).toBe(401);
    expect((await call("/v1/me", { token: s.access })).status).toBe(401);
    // the address can start again, as a new account
    const again = await signIn(email);
    expect(again.user.id).not.toBe(s.user.id);
  });
});
