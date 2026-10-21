// Who is calling: a valid access token, a user that still exists, a runtime that is not revoked, a device that is not
// revoked (re-checked on every request, so revoking takes effect at once).
import type { Env } from "./env";
import { HttpError } from "./http";
import { verifyAccess } from "./jwt";

export interface Auth {
  typ: "user" | "runtime" | "device";
  sub: string;
  uid: string;
  ws: string;
  role: string;                 // the user's role in the workspace; for a device, the device's role (from the database)
  runtimeId: string | null;     // a runtime token's own id
  deviceId: string | null;      // a device token's device id
  rid: string | null;           // a device token's PC
}

export interface AuthOptions {
  /** May a device token call this? A device may only refresh, get a ticket for its own PC, and delete itself
   * (docs/architecture/pairing-protocol.md §3); everywhere else it gets 403. */
  device?: boolean;
}

export async function authenticate(request: Request, env: Env, opts: AuthOptions = {}): Promise<Auth> {
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
  let role = c.role;
  if (c.typ === "device") {
    const d = await env.DB.prepare(
      `SELECT d.runtime_id, d.user_id, d.role, d.revoked_at, r.workspace_id, r.revoked_at AS rt_revoked, m.user_id AS member
       FROM devices d JOIN runtimes r ON r.id = d.runtime_id
       LEFT JOIN workspace_members m ON m.workspace_id = r.workspace_id AND m.user_id = d.user_id
       WHERE d.id = ?`,
    ).bind(c.sub).first<{ runtime_id: string; user_id: string; role: string; revoked_at: number | null; workspace_id: string; rt_revoked: number | null; member: string | null }>();
    if (!d || d.revoked_at || d.rt_revoked || !d.member || d.runtime_id !== c.rid || d.user_id !== c.uid || d.workspace_id !== c.ws) throw gone;
    if (!opts.device) throw new HttpError(403, "forbidden", "A paired device cannot do that.");
    role = d.role;
  }
  return {
    typ: c.typ, sub: c.sub, uid: c.uid, ws: c.ws, role,
    runtimeId: c.typ === "runtime" ? c.sub : null,
    deviceId: c.typ === "device" ? c.sub : null,
    rid: c.typ === "device" ? (c.rid as string) : null,
  };
}
