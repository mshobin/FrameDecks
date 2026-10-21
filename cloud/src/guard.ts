// Who is calling: a valid access token, a user that still exists, a runtime that is not revoked.
import type { Env } from "./env";
import { HttpError } from "./http";
import { verifyAccess } from "./jwt";

export interface Auth {
  typ: "user" | "runtime";
  sub: string;
  uid: string;
  ws: string;
  role: string;
  runtimeId: string | null;
}

export async function authenticate(request: Request, env: Env): Promise<Auth> {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") || "");
  if (!m) throw new HttpError(401, "unauthorized", "Please sign in.");
  const c = await verifyAccess(env, m[1]);
  const gone = new HttpError(401, "unauthorized", "Please sign in again.");
  const user = await env.DB.prepare("SELECT deleted_at FROM users WHERE id = ?").bind(c.uid).first<{ deleted_at: number | null }>();
  if (!user || user.deleted_at) throw gone;
  if (c.typ === "runtime") {
    const rt = await env.DB.prepare("SELECT workspace_id, revoked_at FROM runtimes WHERE id = ?").bind(c.sub).first<{ workspace_id: string; revoked_at: number | null }>();
    if (!rt || rt.revoked_at || rt.workspace_id !== c.ws) throw gone;
    await env.DB.prepare("UPDATE runtimes SET last_seen_at = ? WHERE id = ?").bind(Date.now(), c.sub).run();
  }
  return { typ: c.typ, sub: c.sub, uid: c.uid, ws: c.ws, role: c.role, runtimeId: c.typ === "runtime" ? c.sub : null };
}
