// Trusted devices: the phones and tablets paired with a PC (docs/architecture/pairing-protocol.md §3).
import { audit } from "./audit";
import type { Env } from "./env";
import type { Auth } from "./guard";
import { clientIp, empty, HttpError, json, readJson } from "./http";
import { relay } from "./relay-routes";
import { revokeSubject } from "./tokens";

export const ROLES = ["viewer", "operator", "presenter", "admin"] as const;

export interface DeviceRow {
  id: string; runtime_id: string; name: string; platform: string | null; browser: string | null; role: string;
  approved_at: number; last_used_at: number | null; revoked_at: number | null;
}

const DEVICE_COLUMNS = "d.id, d.runtime_id, d.name, d.platform, d.browser, d.role, d.approved_at, d.last_used_at, d.revoked_at";

export const deviceOut = (d: DeviceRow) => ({
  id: d.id, name: d.name, platform: d.platform || "", browser: d.browser || "", role: d.role,
  approvedAt: d.approved_at, lastUsedAt: d.last_used_at, revoked: !!d.revoked_at,
});

const notFound = () => new HttpError(404, "not_found", "There is no such device.");
const forbidden = () => new HttpError(403, "forbidden", "Only the computer it is paired with, or an administrator, can do that.");

/** That runtime itself, or an admin user of its workspace. */
const runtimeOrAdmin = (auth: Auth, runtimeId: string, workspaceId: string): boolean =>
  (auth.typ === "runtime" && auth.sub === runtimeId) || (auth.typ === "user" && auth.role === "admin" && auth.ws === workspaceId);

async function deviceWithWorkspace(env: Env, id: string) {
  return env.DB.prepare(`SELECT ${DEVICE_COLUMNS}, r.workspace_id FROM devices d JOIN runtimes r ON r.id = d.runtime_id WHERE d.id = ?`)
    .bind(id).first<DeviceRow & { workspace_id: string }>();
}

/** GET /devices?runtime={id} (that runtime, or an admin user) */
export async function list(env: Env, auth: Auth, url: URL): Promise<Response> {
  const runtimeId = url.searchParams.get("runtime") || "";
  if (!runtimeId) throw new HttpError(400, "bad_request", "Say which computer: ?runtime=<id>.");
  const rt = await env.DB.prepare("SELECT workspace_id FROM runtimes WHERE id = ?").bind(runtimeId).first<{ workspace_id: string }>();
  if (!rt || rt.workspace_id !== auth.ws) throw new HttpError(404, "not_found", "There is no such computer in this workspace.");
  if (!runtimeOrAdmin(auth, runtimeId, rt.workspace_id)) throw forbidden();
  const { results } = await env.DB.prepare(`SELECT ${DEVICE_COLUMNS} FROM devices d WHERE d.runtime_id = ? ORDER BY d.approved_at, d.id`)
    .bind(runtimeId).all<DeviceRow>();
  return json(results.map(deviceOut));
}

/** PATCH /devices/{id} {role} (the device's runtime, or an admin user) */
export async function setRole(request: Request, env: Env, auth: Auth, id: string): Promise<Response> {
  const d = await deviceWithWorkspace(env, id);
  if (!d || d.workspace_id !== auth.ws) throw notFound();
  if (!runtimeOrAdmin(auth, d.runtime_id, d.workspace_id)) throw forbidden();
  const body = await readJson<{ role?: unknown }>(request);
  const role = String(body.role ?? "");
  if (!(ROLES as readonly string[]).includes(role)) throw new HttpError(400, "bad_role", "The role must be viewer, operator, presenter or admin.");
  if (d.revoked_at) throw new HttpError(409, "device_revoked", "This device has been removed.");
  const updated = await env.DB.prepare(`UPDATE devices SET role = ? WHERE id = ? RETURNING ${DEVICE_COLUMNS.replace(/d\./g, "")}`)
    .bind(role, id).first<DeviceRow>();
  // open sockets carry the new role from their next request on
  try {
    await relay(env, d.runtime_id).fetch("https://relay/role", { method: "POST", body: JSON.stringify({ device: id, role }) });
  } catch (e) {
    console.error("relay role update failed", e instanceof Error ? e.message : e);
  }
  if (d.role !== role) {
    await audit(env, d.workspace_id, { type: auth.typ, id: auth.sub }, "device_role_changed", { device: id, runtime: d.runtime_id, from: d.role, role }, clientIp(request));
  }
  return json(deviceOut(updated!));
}

/** DELETE /devices/{id} (the device's runtime, an admin user, or the device itself) */
export async function revoke(request: Request, env: Env, auth: Auth, id: string): Promise<Response> {
  const d = await deviceWithWorkspace(env, id);
  const self = auth.typ === "device" && auth.sub === id;
  if (!d || (!self && d.workspace_id !== auth.ws)) throw notFound();
  if (!self && !runtimeOrAdmin(auth, d.runtime_id, d.workspace_id)) throw forbidden();
  await env.DB.prepare("UPDATE devices SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?").bind(Date.now(), id).run();
  await revokeSubject(env, "device", id);
  // closes its relay sockets at once (4001 revoked)
  await relay(env, d.runtime_id).fetch("https://relay/revoke", { method: "POST", body: JSON.stringify({ device: id }) });
  if (!d.revoked_at) {
    await audit(env, d.workspace_id, { type: auth.typ, id: auth.sub }, "device_revoked", { device: id, runtime: d.runtime_id }, clientIp(request));
  }
  return empty();
}
