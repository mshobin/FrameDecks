// Refresh tokens: random, stored as SHA-256 hashes, rotated on every use. Presenting a retired one again revokes
// the whole family (every token from that sign-in): someone else has a copy. docs/architecture/cloud-api.md §1.
import { audit } from "./audit";
import { randomId, randomToken, sha256 } from "./crypto";
import type { Env } from "./env";
import { HttpError } from "./http";
import { signAccess } from "./jwt";

export const USER_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
export const RUNTIME_REFRESH_MS = 10 * 365 * 24 * 60 * 60 * 1000;     // "until signed out or revoked"
export const DEVICE_REFRESH_MS = 180 * 24 * 60 * 60 * 1000;           // a paired phone; each refresh starts it again

export type Subject =
  | { type: "user"; userId: string }
  | { type: "runtime"; runtimeId: string }
  | { type: "device"; deviceId: string };

export interface TokenPair { access: string; accessExpiresAt: number; refresh: string }

interface Identity { typ: "user" | "runtime" | "device"; sub: string; uid: string; ws: string; role: string; rid?: string }

const subjectId = (s: Subject): string => s.type === "runtime" ? s.runtimeId : s.type === "device" ? s.deviceId : s.userId;
const refreshTtl = (s: Subject): number => s.type === "runtime" ? RUNTIME_REFRESH_MS : s.type === "device" ? DEVICE_REFRESH_MS : USER_REFRESH_MS;

function subjectOf(type: string, id: string): Subject {
  if (type === "runtime") return { type: "runtime", runtimeId: id };
  if (type === "device") return { type: "device", deviceId: id };
  return { type: "user", userId: id };
}

/** Who a subject is now (its user, workspace and role), or null when it can no longer sign in. */
async function identityOf(env: Env, s: Subject): Promise<Identity | null> {
  if (s.type === "device") {
    // a device lives while it is not revoked, its PC is not revoked, and the person who paired it is still a member
    const d = await env.DB.prepare(
      `SELECT d.runtime_id AS rid, d.user_id AS uid, d.role, d.revoked_at, r.workspace_id AS ws, r.revoked_at AS rt_revoked,
              u.deleted_at, m.user_id AS member
       FROM devices d JOIN runtimes r ON r.id = d.runtime_id JOIN users u ON u.id = d.user_id
       LEFT JOIN workspace_members m ON m.workspace_id = r.workspace_id AND m.user_id = d.user_id
       WHERE d.id = ?`,
    ).bind(s.deviceId).first<{ rid: string; uid: string; role: string; revoked_at: number | null; ws: string; rt_revoked: number | null; deleted_at: number | null; member: string | null }>();
    if (!d || d.revoked_at || d.rt_revoked || d.deleted_at || !d.member) return null;
    return { typ: "device", sub: s.deviceId, uid: d.uid, ws: d.ws, role: d.role, rid: d.rid };
  }
  if (s.type === "runtime") {
    const r = await env.DB.prepare(
      `SELECT r.workspace_id AS ws, r.user_id AS uid, r.revoked_at, u.deleted_at, m.role
       FROM runtimes r JOIN users u ON u.id = r.user_id
       LEFT JOIN workspace_members m ON m.workspace_id = r.workspace_id AND m.user_id = r.user_id
       WHERE r.id = ?`,
    ).bind(s.runtimeId).first<{ ws: string; uid: string; revoked_at: number | null; deleted_at: number | null; role: string | null }>();
    if (!r || r.revoked_at || r.deleted_at || !r.role) return null;
    return { typ: "runtime", sub: s.runtimeId, uid: r.uid, ws: r.ws, role: r.role };
  }
  const u = await env.DB.prepare(
    `SELECT u.deleted_at, m.workspace_id AS ws, m.role FROM users u
     LEFT JOIN workspace_members m ON m.user_id = u.id WHERE u.id = ? ORDER BY m.rowid LIMIT 1`,
  ).bind(s.userId).first<{ deleted_at: number | null; ws: string | null; role: string | null }>();
  if (!u || u.deleted_at || !u.ws || !u.role) return null;
  return { typ: "user", sub: s.userId, uid: s.userId, ws: u.ws, role: u.role };
}

async function access(env: Env, id: Identity): Promise<{ access: string; accessExpiresAt: number }> {
  const { token, expiresAt } = await signAccess(env, {
    sub: id.sub, typ: id.typ, uid: id.uid, ws: id.ws, role: id.role, jti: randomId("j"), ...(id.rid ? { rid: id.rid } : {}),
  });
  return { access: token, accessExpiresAt: expiresAt };
}

async function storeRefresh(env: Env, s: Subject, familyId: string): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO refresh_tokens (id, family_id, subject_type, subject_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(randomId("t"), familyId, s.type, subjectId(s), await sha256(token), now + refreshTtl(s)).run();
  return token;
}

/** A new sign-in: a new token family. */
export async function issue(env: Env, s: Subject): Promise<TokenPair> {
  const id = await identityOf(env, s);
  if (!id) throw new HttpError(401, "unauthorized", "Please sign in again.");
  const a = await access(env, id);
  return { ...a, refresh: await storeRefresh(env, s, randomId("f")) };
}

/** POST /auth/refresh */
export async function rotate(env: Env, refresh: string, ip?: string): Promise<TokenPair> {
  const unauthorized = new HttpError(401, "unauthorized", "Please sign in again.");
  if (!refresh || typeof refresh !== "string") throw unauthorized;
  const row = await env.DB.prepare(
    "SELECT id, family_id, subject_type, subject_id, expires_at, used_at, revoked_at FROM refresh_tokens WHERE token_hash = ?",
  ).bind(await sha256(refresh)).first<{ id: string; family_id: string; subject_type: string; subject_id: string; expires_at: number; used_at: number | null; revoked_at: number | null }>();
  if (!row || row.revoked_at || row.expires_at <= Date.now()) throw unauthorized;
  const s = subjectOf(row.subject_type, row.subject_id);
  if (row.used_at) {                                     // a retired token came back: the family is compromised
    await revokeFamily(env, row.family_id);
    const id = await identityOf(env, s);
    await audit(env, id?.ws ?? null, { type: s.type, id: row.subject_id }, "token_reused", { family: row.family_id }, ip);
    throw new HttpError(401, "token_reused", "This sign-in was used somewhere else, so it has been ended. Please sign in again.");
  }
  // claim it: only one rotation can win, even if two arrive together
  const claimed = await env.DB.prepare("UPDATE refresh_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(Date.now(), row.id).run();
  if (!claimed.meta.changes) {
    await revokeFamily(env, row.family_id);
    throw new HttpError(401, "token_reused", "This sign-in was used somewhere else, so it has been ended. Please sign in again.");
  }
  const id = await identityOf(env, s);
  if (!id) {
    await revokeFamily(env, row.family_id);
    throw unauthorized;
  }
  const a = await access(env, id);
  return { ...a, refresh: await storeRefresh(env, s, row.family_id) };
}

/** POST /auth/logout: ends that sign-in (its family). Unknown tokens are ignored. */
export async function logout(env: Env, refresh: string): Promise<{ type: string; id: string } | null> {
  if (!refresh || typeof refresh !== "string") return null;
  const row = await env.DB.prepare("SELECT family_id, subject_type, subject_id FROM refresh_tokens WHERE token_hash = ?")
    .bind(await sha256(refresh)).first<{ family_id: string; subject_type: string; subject_id: string }>();
  if (!row) return null;
  await revokeFamily(env, row.family_id);
  return { type: row.subject_type, id: row.subject_id };
}

export async function revokeFamily(env: Env, familyId: string): Promise<void> {
  await env.DB.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL").bind(Date.now(), familyId).run();
}

export async function revokeSubject(env: Env, type: "user" | "runtime" | "device", id: string): Promise<void> {
  await env.DB.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE subject_type = ? AND subject_id = ? AND revoked_at IS NULL")
    .bind(Date.now(), type, id).run();
}
