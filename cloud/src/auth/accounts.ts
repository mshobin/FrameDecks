// Users, workspaces and runtimes at sign-in, and the session answer every sign-in gives
// (docs/architecture/cloud-api.md §1, §2).
import { audit } from "../audit";
import { randomId } from "../crypto";
import type { Env } from "../env";
import { HttpError } from "../http";
import { issue, type Subject } from "../tokens";

export const PLATFORMS = ["windows", "macos", "linux", "ios", "android", "web"] as const;
const RUNTIME_PLATFORMS = ["windows", "macos", "linux"];

export interface Client {
  type: "runtime" | "browser";
  name: string;
  platform: string;
  appVersion: string;
  runtimeId?: string;
}

/** The signing-in client from a request body (a browser when none is given). */
export function parseClient(v: unknown): Client {
  const bad = (m: string) => new HttpError(400, "bad_client", m);
  if (v == null) return { type: "browser", name: "Browser", platform: "web", appVersion: "" };
  if (typeof v !== "object" || Array.isArray(v)) throw bad("The client details are missing.");
  const c = v as Record<string, unknown>;
  const type = c.type === "runtime" ? "runtime" : c.type === "browser" || c.type == null ? "browser" : null;
  if (!type) throw bad("The client type must be runtime or browser.");
  const platform = String(c.platform ?? (type === "browser" ? "web" : ""));
  if (!(PLATFORMS as readonly string[]).includes(platform)) throw bad("Unknown platform.");
  if (type === "runtime" && !RUNTIME_PLATFORMS.includes(platform)) throw bad("FrameDecks runs on Windows, macOS or Linux.");
  const name = String(c.name ?? "").trim().slice(0, 80) || (type === "runtime" ? "This computer" : "Browser");
  const out: Client = { type, name, platform, appVersion: String(c.appVersion ?? "").slice(0, 40) };
  if (typeof c.runtimeId === "string" && c.runtimeId) out.runtimeId = c.runtimeId.slice(0, 64);
  return out;
}

export const normEmail = (e: unknown): string => String(e ?? "").trim().toLowerCase();
export const validEmail = (e: string): boolean => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export interface IdentityIn {
  provider: "email" | "google" | "microsoft" | "apple";
  subject: string;
  email: string;
  name?: string;
  /** May this identity join an existing account that has the same email? (only when the provider verified it) */
  linkByEmail: boolean;
}

/** The user for a signed-in identity; the first sign-in of an email creates the user and its workspace. */
export async function findOrCreateUser(env: Env, id: IdentityIn): Promise<string> {
  const known = await env.DB.prepare("SELECT user_id FROM identities WHERE provider = ? AND subject = ?").bind(id.provider, id.subject).first<{ user_id: string }>();
  if (known) {
    const u = await env.DB.prepare("SELECT deleted_at FROM users WHERE id = ?").bind(known.user_id).first<{ deleted_at: number | null }>();
    if (u && !u.deleted_at) return known.user_id;
    await env.DB.prepare("DELETE FROM identities WHERE provider = ? AND subject = ?").bind(id.provider, id.subject).run();
  }
  const email = normEmail(id.email);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL").bind(email).first<{ id: string }>();
  if (existing) {
    if (!id.linkByEmail) {
      throw new HttpError(409, "email_in_use", "This email already has a FrameDecks account. Please sign in the way you did before.");
    }
    await env.DB.prepare("INSERT INTO identities (provider, subject, user_id) VALUES (?, ?, ?)").bind(id.provider, id.subject, existing.id).run();
    return existing.id;
  }
  const now = Date.now();
  const userId = randomId("u");
  const wsId = randomId("w");
  const name = (id.name || "").trim().slice(0, 80);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)").bind(userId, email, name || null, now),
    env.DB.prepare("INSERT INTO identities (provider, subject, user_id) VALUES (?, ?, ?)").bind(id.provider, id.subject, userId),
    env.DB.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)").bind(wsId, (name ? `${name}'s ministry` : "My ministry").slice(0, 120), now),
    env.DB.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'admin')").bind(wsId, userId),
  ]);
  return userId;
}

export interface SessionAnswer {
  access: string;
  accessExpiresAt: number;
  refresh: string;
  user: { id: string; email: string; name: string };
  workspace: { id: string; name: string; role: string };
  runtime?: { id: string; name: string };
}

/** Signs a user in as `client`: registers (or re-uses) the runtime for a runtime client, then issues tokens. */
export async function signIn(env: Env, userId: string, client: Client, ip?: string): Promise<SessionAnswer> {
  const u = await env.DB.prepare(
    `SELECT u.email, u.name, w.id AS ws, w.name AS wsName, m.role FROM users u
     JOIN workspace_members m ON m.user_id = u.id JOIN workspaces w ON w.id = m.workspace_id
     WHERE u.id = ? AND u.deleted_at IS NULL ORDER BY m.rowid LIMIT 1`,
  ).bind(userId).first<{ email: string; name: string | null; ws: string; wsName: string; role: string }>();
  if (!u) throw new HttpError(401, "unauthorized", "This account can no longer sign in.");
  let subject: Subject = { type: "user", userId };
  let runtime: { id: string; name: string } | undefined;
  const now = Date.now();
  if (client.type === "runtime") {
    let rtId: string | null = null;
    if (client.runtimeId) {
      const rt = await env.DB.prepare("SELECT id FROM runtimes WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL")
        .bind(client.runtimeId, u.ws).first<{ id: string }>();
      if (rt) rtId = rt.id;
    }
    if (rtId) {
      await env.DB.prepare("UPDATE runtimes SET name = ?, platform = ?, app_version = ?, user_id = ?, last_seen_at = ? WHERE id = ?")
        .bind(client.name, client.platform, client.appVersion, userId, now, rtId).run();
    } else {
      rtId = randomId("r");
      await env.DB.prepare("INSERT INTO runtimes (id, workspace_id, name, platform, app_version, last_seen_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(rtId, u.ws, client.name, client.platform, client.appVersion, now, userId).run();
      await audit(env, u.ws, { type: "user", id: userId }, "runtime_registered", { runtime: rtId, name: client.name, platform: client.platform }, ip);
    }
    subject = { type: "runtime", runtimeId: rtId };
    runtime = { id: rtId, name: client.name };
  }
  const tokens = await issue(env, subject);
  await audit(env, u.ws, subject.type === "runtime" ? { type: "runtime", id: subject.runtimeId } : { type: "user", id: userId }, "sign_in",
    { client: client.type, platform: client.platform }, ip);
  const out: SessionAnswer = {
    ...tokens,
    user: { id: userId, email: u.email, name: u.name || "" },
    workspace: { id: u.ws, name: u.wsName, role: u.role },
  };
  if (runtime) out.runtime = runtime;
  return out;
}
