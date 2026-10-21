// Pairing a phone or tablet with one PC (docs/architecture/pairing-protocol.md §2): the PC starts a request (a 6-digit
// code and a QR token), a signed-in member claims it with the phone's key, the PC approves it with a role, and the
// phone collects its device credential exactly once.
//
// The code is kept only as SHA-256(salt + code) with a per-request salt. The token (128 random bits) is kept as
// SHA-256 with a fixed, domain-separating salt, so it can be looked up; a per-request salt would add nothing to a
// value that cannot be guessed. Every comparison of hashes is constant-time.
import { audit } from "./audit";
import { b64url, fromB64url, randomBytes, randomId, sameString, sha256, sixDigits } from "./crypto";
import type { Env } from "./env";
import type { Auth } from "./guard";
import { clientIp, empty, HttpError, json, readJson } from "./http";
import { HOUR, limit, MINUTE } from "./ratelimit";
import { deviceOut, type DeviceRow, ROLES } from "./devices";
import { issue } from "./tokens";

export const PAIR_TTL_MS = 5 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

type Status = "open" | "claimed" | "approved" | "rejected" | "expired";

interface PairRow {
  id: string; runtime_id: string; workspace_id: string; code_hash: string; code_salt: string; token_hash: string;
  claimed_by_user: string | null; device_name: string | null; device_platform: string | null; device_browser: string | null;
  device_key: string | null; pc_key: string; device_id: string | null; credential_delivered: number;
  attempts: number; status: Status; created_at: number; expires_at: number;
}

const COLUMNS = `id, runtime_id, workspace_id, code_hash, code_salt, token_hash, claimed_by_user, device_name, device_platform,
  device_browser, device_key, pc_key, device_id, credential_delivered, attempts, status, created_at, expires_at`;

const expired = () => new HttpError(410, "pair_expired", "This pairing has ended. Start again on the computer.");
const notFound = () => new HttpError(404, "not_found", "There is no such pairing.");

const codeHash = (salt: string, code: string) => sha256(`fd-pair-code:${salt}:${code}`);
const tokenHash = (token: string) => sha256(`fd-pair-token:${token}`);

/** 'open' and 'claimed' end on their own 5 minutes after the start. */
function statusOf(r: Pick<PairRow, "status" | "expires_at">, now = Date.now()): Status {
  if ((r.status === "open" || r.status === "claimed") && r.expires_at <= now) return "expired";
  return r.status;
}

/** A public X25519 key: 32 bytes, base64url. */
function publicKey(v: unknown, field: string): string {
  const bad = new HttpError(400, "bad_key", `${field} must be a 32-byte key, base64url.`);
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(v)) throw bad;
  try {
    if (fromB64url(v).length !== 32) throw bad;
  } catch {
    throw bad;
  }
  return v;
}

const text = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function runtimeName(env: Env, id: string): Promise<string> {
  const r = await env.DB.prepare("SELECT name FROM runtimes WHERE id = ?").bind(id).first<{ name: string }>();
  return r?.name ?? "";
}

/** POST /pairing (a runtime) */
export async function start(request: Request, env: Env, auth: Auth): Promise<Response> {
  if (auth.typ !== "runtime") throw new HttpError(403, "forbidden", "Only a computer can start pairing a phone.");
  await limit(env, `pair-start:${auth.sub}`, 30, HOUR);
  const body = await readJson<{ pcKey?: unknown }>(request);
  const pcKey = publicKey(body.pcKey, "pcKey");
  const now = Date.now();
  const id = randomId("p");
  const code = sixDigits();
  const token = b64url(randomBytes(16));
  const salt = b64url(randomBytes(16));
  const expiresAt = now + PAIR_TTL_MS;
  await env.DB.batch([
    // a new one ends any open one of this PC
    env.DB.prepare("UPDATE pairing_requests SET status = 'expired' WHERE runtime_id = ? AND status IN ('open','claimed')").bind(auth.sub),
    env.DB.prepare(
      `INSERT INTO pairing_requests (id, runtime_id, workspace_id, code_hash, code_salt, token_hash, pc_key, attempts, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'open', ?, ?)`,
    ).bind(id, auth.sub, auth.ws, await codeHash(salt, code), salt, await tokenHash(token), pcKey, now, expiresAt),
  ]);
  await audit(env, auth.ws, { type: "runtime", id: auth.sub }, "pair_started", { pairing: id }, clientIp(request));
  return json({ id, code, token, expiresAt }, 201);
}

/** POST /pairing/claim (a signed-in member of the PC's workspace) */
export async function claim(request: Request, env: Env, auth: Auth): Promise<Response> {
  if (auth.typ !== "user") throw new HttpError(403, "forbidden", "Please sign in on this phone to pair it.");
  await limit(env, `pair-claim:user:${auth.uid}`, 10, MINUTE);
  await limit(env, `pair-claim:ip:${(await sha256(`fd-ip:${clientIp(request)}`)).slice(0, 32)}`, 30, HOUR);
  const body = await readJson<{ token?: unknown; code?: unknown; device?: unknown; deviceKey?: unknown }>(request);
  const deviceKey = publicKey(body.deviceKey, "deviceKey");
  const d = (body.device && typeof body.device === "object" ? body.device : {}) as Record<string, unknown>;
  const device = { name: text(d.name, 80) || "Phone", platform: text(d.platform, 40), browser: text(d.browser, 40) };
  const now = Date.now();

  let row: PairRow | null = null;
  let method: "token" | "code";
  if (typeof body.token === "string" && body.token) {
    method = "token";
    const h = await tokenHash(body.token);
    const found = await env.DB.prepare(`SELECT ${COLUMNS} FROM pairing_requests WHERE token_hash = ?`).bind(h).first<PairRow>();
    if (!found || !sameString(found.token_hash, h)) throw expired();
    const rt = await env.DB.prepare("SELECT revoked_at FROM runtimes WHERE id = ?").bind(found.runtime_id).first<{ revoked_at: number | null }>();
    if (!rt || rt.revoked_at) throw expired();
    const member = await env.DB.prepare("SELECT 1 AS ok FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .bind(found.workspace_id, auth.uid).first<{ ok: number }>();
    if (!member) throw new HttpError(403, "forbidden", "That computer belongs to another workspace. Sign in with the same account as the computer.");
    row = found;
  } else if (typeof body.code === "string" || typeof body.code === "number") {
    method = "code";
    const code = String(body.code).replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, "code_wrong", "That code is not right. Check the six digits on the computer.");
    // only the open requests of runtimes in the claimer's workspace
    const { results } = await env.DB.prepare(
      `SELECT ${COLUMNS.split(",").map((c) => "p." + c.trim()).join(", ")} FROM pairing_requests p JOIN runtimes r ON r.id = p.runtime_id
       WHERE p.workspace_id = ? AND r.workspace_id = ? AND r.revoked_at IS NULL AND p.status = 'open' AND p.expires_at > ?
         AND p.attempts < ?`,
    ).bind(auth.ws, auth.ws, now, MAX_CODE_ATTEMPTS).all<PairRow>();
    if (!results.length) throw expired();
    for (const r of results) {
      if (sameString(await codeHash(r.code_salt, code), r.code_hash) && !row) row = r;
    }
    if (!row) {
      // every wrong code counts against every open request of the workspace; the fifth ends them
      await env.DB.prepare(
        `UPDATE pairing_requests SET attempts = attempts + 1,
           status = CASE WHEN attempts + 1 >= ?1 THEN 'expired' ELSE status END
         WHERE workspace_id = ?2 AND status = 'open' AND expires_at > ?3`,
      ).bind(MAX_CODE_ATTEMPTS, auth.ws, now).run();
      const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM pairing_requests WHERE workspace_id = ? AND status = 'open' AND expires_at > ?")
        .bind(auth.ws, now).first<{ n: number }>();
      if (!left?.n) throw expired();
      throw new HttpError(400, "code_wrong", "That code is not right. Check the six digits on the computer.");
    }
  } else {
    throw new HttpError(400, "bad_request", "Scan the QR code or type the 6-digit code shown on the computer.");
  }

  const claimed = await env.DB.prepare(
    `UPDATE pairing_requests SET status = 'claimed', claimed_by_user = ?, device_name = ?, device_platform = ?, device_browser = ?, device_key = ?
     WHERE id = ? AND status = 'open' AND expires_at > ? RETURNING ${COLUMNS}`,
  ).bind(auth.uid, device.name, device.platform || null, device.browser || null, deviceKey, row.id, now).first<PairRow>();
  if (!claimed) throw expired();
  await audit(env, claimed.workspace_id, { type: "user", id: auth.uid }, "pair_claimed",
    { pairing: claimed.id, runtime: claimed.runtime_id, method, device: device.name }, clientIp(request));
  return json({
    id: claimed.id, runtime: { id: claimed.runtime_id, name: await runtimeName(env, claimed.runtime_id) },
    pcKey: claimed.pc_key, expiresAt: claimed.expires_at,
  });
}

/** GET /pairing/{id} (the runtime that started it, or the user who claimed it) */
export async function get(env: Env, auth: Auth, id: string): Promise<Response> {
  const r = await env.DB.prepare(`SELECT ${COLUMNS} FROM pairing_requests WHERE id = ?`).bind(id).first<PairRow>();
  if (!r) throw notFound();
  const isRuntime = auth.typ === "runtime" && auth.sub === r.runtime_id;
  const isClaimer = auth.typ === "user" && !!r.claimed_by_user && auth.uid === r.claimed_by_user;
  if (!isRuntime && !isClaimer) throw notFound();
  const status = statusOf(r);
  const out: Record<string, unknown> = { id: r.id, status, expiresAt: r.expires_at };
  if (isRuntime && r.claimed_by_user) {
    out.device = { name: r.device_name ?? "", platform: r.device_platform ?? "", browser: r.device_browser ?? "" };
    out.deviceKey = r.device_key;
  }
  if (isClaimer && status === "approved" && r.device_id && !r.credential_delivered) {
    // exactly once: whoever flips the flag mints the credential
    const won = await env.DB.prepare("UPDATE pairing_requests SET credential_delivered = 1 WHERE id = ? AND credential_delivered = 0 RETURNING id")
      .bind(r.id).first<{ id: string }>();
    if (won) {
      const d = await env.DB.prepare("SELECT id, role, name, revoked_at FROM devices WHERE id = ?")
        .bind(r.device_id).first<{ id: string; role: string; name: string; revoked_at: number | null }>();
      if (d && !d.revoked_at) {
        try {
          const tokens = await issue(env, { type: "device", deviceId: d.id });
          out.credential = {
            device: { id: d.id, role: d.role, name: d.name },
            runtime: { id: r.runtime_id, name: await runtimeName(env, r.runtime_id) },
            ...tokens,
          };
        } catch (e) {
          await env.DB.prepare("UPDATE pairing_requests SET credential_delivered = 0 WHERE id = ?").bind(r.id).run();
          throw e;
        }
      }
    }
  }
  return json(out);
}

async function ownRequest(env: Env, auth: Auth, id: string): Promise<PairRow> {
  if (auth.typ !== "runtime") throw new HttpError(403, "forbidden", "Only the computer can answer a pairing.");
  const r = await env.DB.prepare(`SELECT ${COLUMNS} FROM pairing_requests WHERE id = ?`).bind(id).first<PairRow>();
  if (!r || r.runtime_id !== auth.sub) throw notFound();
  return r;
}

/** POST /pairing/{id}/approve (that runtime) */
export async function approve(request: Request, env: Env, auth: Auth, id: string): Promise<Response> {
  const r = await ownRequest(env, auth, id);
  const body = await readJson<{ role?: unknown }>(request);
  const role = body.role == null ? "operator" : String(body.role);
  if (!(ROLES as readonly string[]).includes(role)) throw new HttpError(400, "bad_role", "The role must be viewer, operator, presenter or admin.");
  const status = statusOf(r);
  if (status === "open") throw new HttpError(409, "not_claimed", "No phone has claimed this pairing yet.");
  if (status !== "claimed" || !r.claimed_by_user) throw expired();
  const now = Date.now();
  const deviceId = randomId("d");
  // one transaction: the device exists only if the request was still claimed and unexpired, and then points at it
  const open = "SELECT 1 FROM pairing_requests WHERE id = ? AND status = 'claimed' AND expires_at > ?";
  const [made, marked] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO devices (id, runtime_id, user_id, name, platform, browser, role, approved_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (${open})`,
    ).bind(deviceId, r.runtime_id, r.claimed_by_user, r.device_name || "Phone", r.device_platform, r.device_browser, role, now, r.id, now),
    env.DB.prepare(
      `UPDATE pairing_requests SET status = 'approved', device_id = ?
       WHERE id = ? AND status = 'claimed' AND expires_at > ? AND EXISTS (SELECT 1 FROM devices WHERE id = ?)`,
    ).bind(deviceId, r.id, now, deviceId),
  ]);
  if (!made.meta.changes || !marked.meta.changes) throw expired();
  const device = await env.DB.prepare(
    "SELECT id, runtime_id, name, platform, browser, role, approved_at, last_used_at, revoked_at FROM devices WHERE id = ?",
  ).bind(deviceId).first<DeviceRow>();
  await audit(env, r.workspace_id, { type: "runtime", id: auth.sub }, "pair_approved",
    { pairing: r.id, device: deviceId, role, user: r.claimed_by_user }, clientIp(request));
  return json({ device: deviceOut(device!) });
}

/** POST /pairing/{id}/reject (that runtime) */
export async function reject(request: Request, env: Env, auth: Auth, id: string): Promise<Response> {
  const r = await ownRequest(env, auth, id);
  const done = await env.DB.prepare("UPDATE pairing_requests SET status = 'rejected' WHERE id = ? AND status IN ('open','claimed') RETURNING id")
    .bind(r.id).first<{ id: string }>();
  if (!done) throw expired();
  await audit(env, r.workspace_id, { type: "runtime", id: auth.sub }, "pair_rejected", { pairing: r.id }, clientIp(request));
  return empty();
}
