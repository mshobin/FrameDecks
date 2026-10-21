// You, your workspace and your computers (docs/architecture/cloud-api.md §3).
import { audit } from "./audit";
import type { Env } from "./env";
import type { Auth } from "./guard";
import { clientIp, empty, HttpError, json, readJson } from "./http";
import { revokeSubject } from "./tokens";

interface RuntimeRow { id: string; name: string; platform: string; app_version: string | null; last_seen_at: number | null; revoked_at: number | null }

const runtimeOut = (r: RuntimeRow) => ({
  id: r.id, name: r.name, platform: r.platform, appVersion: r.app_version || "", lastSeenAt: r.last_seen_at, revoked: !!r.revoked_at,
});

async function profile(env: Env, auth: Auth) {
  const u = await env.DB.prepare("SELECT id, email, name FROM users WHERE id = ?").bind(auth.uid).first<{ id: string; email: string; name: string | null }>();
  const w = await env.DB.prepare("SELECT id, name FROM workspaces WHERE id = ?").bind(auth.ws).first<{ id: string; name: string }>();
  if (!u || !w) throw new HttpError(401, "unauthorized", "Please sign in again.");
  return { user: { id: u.id, email: u.email, name: u.name || "" }, workspace: { id: w.id, name: w.name, role: auth.role } };
}

/** GET /me */
export async function me(env: Env, auth: Auth): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, name, platform, app_version, last_seen_at, revoked_at FROM runtimes WHERE workspace_id = ? ORDER BY last_seen_at DESC",
  ).bind(auth.ws).all<RuntimeRow>();
  return json({ ...(await profile(env, auth)), runtimes: results.map(runtimeOut) });
}

/** GET /me/export: everything stored about you */
export async function exportMe(env: Env, auth: Auth): Promise<Response> {
  const p = await profile(env, auth);
  const identities = await env.DB.prepare("SELECT provider, subject FROM identities WHERE user_id = ?").bind(auth.uid).all();
  const entities = await env.DB.prepare(
    "SELECT kind, id, rev, seq, deleted, updated_by, updated_at, body FROM entities WHERE workspace_id = ? ORDER BY seq",
  ).bind(auth.ws).all<{ kind: string; id: string; rev: number; seq: number; deleted: number; updated_by: string; updated_at: number; body: string }>();
  const runtimes = await env.DB.prepare(
    "SELECT id, name, platform, app_version, last_seen_at, revoked_at FROM runtimes WHERE workspace_id = ?",
  ).bind(auth.ws).all<RuntimeRow>();
  const auditRows = await env.DB.prepare(
    "SELECT id, at, actor_type, actor_id, action, detail FROM audit_log WHERE workspace_id = ? ORDER BY id",
  ).bind(auth.ws).all();
  const body = {
    exportedAt: Date.now(), ...p, identities: identities.results,
    entities: entities.results.map((e) => ({
      kind: e.kind, id: e.id, rev: e.rev, seq: e.seq, deleted: !!e.deleted, updatedBy: e.updated_by, updatedAt: e.updated_at,
      body: e.deleted ? null : JSON.parse(e.body),
    })),
    runtimes: runtimes.results.map(runtimeOut), audit: auditRows.results,
  };
  return json(body, 200, { "Content-Disposition": 'attachment; filename="framedecks-export.json"' });
}

/** DELETE /me */
export async function deleteMe(request: Request, env: Env, auth: Auth): Promise<Response> {
  const now = Date.now();
  const members = await env.DB.prepare("SELECT COUNT(*) AS n FROM workspace_members WHERE workspace_id = ?").bind(auth.ws).first<{ n: number }>();
  await revokeSubject(env, "user", auth.uid);
  const { results: rts } = await env.DB.prepare("SELECT id FROM runtimes WHERE user_id = ? OR workspace_id = ?").bind(auth.uid, (members?.n ?? 0) <= 1 ? auth.ws : "").all<{ id: string }>();
  for (const r of rts) await revokeSubject(env, "runtime", r.id);
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM identities WHERE user_id = ?").bind(auth.uid),
    env.DB.prepare("DELETE FROM email_codes WHERE email = (SELECT email FROM users WHERE id = ?)").bind(auth.uid),
    env.DB.prepare("UPDATE runtimes SET revoked_at = COALESCE(revoked_at, ?) WHERE user_id = ?").bind(now, auth.uid),
  ];
  if ((members?.n ?? 0) <= 1) {
    // the only member: the workspace and everything in it goes
    stmts.push(
      env.DB.prepare("DELETE FROM entities WHERE workspace_id = ?").bind(auth.ws),
      env.DB.prepare("DELETE FROM devices WHERE runtime_id IN (SELECT id FROM runtimes WHERE workspace_id = ?)").bind(auth.ws),
      env.DB.prepare("DELETE FROM pairing_requests WHERE runtime_id IN (SELECT id FROM runtimes WHERE workspace_id = ?)").bind(auth.ws),
      env.DB.prepare("DELETE FROM refresh_tokens WHERE subject_type = 'runtime' AND subject_id IN (SELECT id FROM runtimes WHERE workspace_id = ?)").bind(auth.ws),
      env.DB.prepare("DELETE FROM runtimes WHERE workspace_id = ?").bind(auth.ws),
      env.DB.prepare("DELETE FROM audit_log WHERE workspace_id = ?").bind(auth.ws),
      env.DB.prepare("DELETE FROM workspace_members WHERE workspace_id = ?").bind(auth.ws),
      env.DB.prepare("DELETE FROM workspaces WHERE id = ?").bind(auth.ws),
    );
  } else {
    stmts.push(env.DB.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").bind(auth.ws, auth.uid));
  }
  // the user row is kept 30 days (deleted_at), its address freed so it can sign up again
  stmts.push(env.DB.prepare("UPDATE users SET deleted_at = ?, email = 'deleted:' || id, name = NULL WHERE id = ?").bind(now, auth.uid));
  await env.DB.batch(stmts);
  await audit(env, null, { type: "user", id: auth.uid }, "account_deleted", null, clientIp(request));
  return empty();
}

/** PATCH /runtimes/{id} (admin) */
export async function renameRuntime(request: Request, env: Env, auth: Auth, id: string): Promise<Response> {
  requireAdmin(auth);
  const body = await readJson<{ name?: unknown }>(request);
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) throw new HttpError(400, "bad_name", "Please give the computer a name.");
  const r = await env.DB.prepare("UPDATE runtimes SET name = ? WHERE id = ? AND workspace_id = ? RETURNING id, name, platform, app_version, last_seen_at, revoked_at")
    .bind(name, id, auth.ws).first<RuntimeRow>();
  if (!r) throw new HttpError(404, "not_found", "There is no such computer in this workspace.");
  await audit(env, auth.ws, { type: auth.typ, id: auth.sub }, "runtime_renamed", { runtime: id, name }, clientIp(request));
  return json(runtimeOut(r));
}

/** DELETE /runtimes/{id} (admin) */
export async function revokeRuntime(request: Request, env: Env, auth: Auth, id: string): Promise<Response> {
  requireAdmin(auth);
  const r = await env.DB.prepare("UPDATE runtimes SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ? AND workspace_id = ? RETURNING id")
    .bind(Date.now(), id, auth.ws).first<{ id: string }>();
  if (!r) throw new HttpError(404, "not_found", "There is no such computer in this workspace.");
  await revokeSubject(env, "runtime", id);
  await audit(env, auth.ws, { type: auth.typ, id: auth.sub }, "runtime_revoked", { runtime: id }, clientIp(request));
  return empty();
}

export function requireAdmin(auth: Auth): void {
  if (auth.role !== "admin") throw new HttpError(403, "forbidden", "Only an administrator of this workspace can do that.");
}
