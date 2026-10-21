// The audit log (architecture §15): sign-ins, sign-outs, token reuse, runtimes, sync conflicts, account deletion.
// The IP address is kept only as a hash.
import { sha256 } from "./crypto";
import type { Env } from "./env";
import { HttpError, json } from "./http";
import type { Auth } from "./guard";

export interface AuditActor { type: "user" | "runtime" | "device" | "system"; id: string }

export async function audit(env: Env, workspaceId: string | null, actor: AuditActor, action: string, detail: unknown = null, ip?: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO audit_log (workspace_id, actor_type, actor_id, action, detail, ip_hash, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(workspaceId, actor.type, actor.id, action, detail == null ? null : JSON.stringify(detail), ip ? (await sha256(`fd-ip:${ip}`)).slice(0, 32) : null, Date.now()).run();
}

/** GET /audit?since=<id> (admin) */
export async function listAudit(env: Env, auth: Auth, url: URL): Promise<Response> {
  if (auth.role !== "admin") throw new HttpError(403, "forbidden", "Only an administrator of this workspace can see its activity.");
  const since = Math.max(0, Number(url.searchParams.get("since") || 0) || 0);
  const { results } = await env.DB.prepare(
    "SELECT id, at, actor_type, actor_id, action, detail FROM audit_log WHERE workspace_id = ? AND id > ? ORDER BY id LIMIT 200",
  ).bind(auth.ws, since).all<{ id: number; at: number; actor_type: string; actor_id: string; action: string; detail: string | null }>();
  const events = results.map((r) => ({
    id: r.id, at: r.at, actor: { type: r.actor_type, id: r.actor_id }, action: r.action,
    detail: r.detail == null ? null : safeParse(r.detail),
  }));
  return json({ events, next: events.length ? events[events.length - 1].id : since });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
