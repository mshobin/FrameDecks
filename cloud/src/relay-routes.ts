// The relay's HTTP side (docs/architecture/relay-protocol.md §1): tickets, the WebSocket upgrade, and the list of
// a workspace's computers with whether each is connected now. The sockets themselves live in RuntimeRelay (relay.ts).
import { randomId } from "./crypto";
import type { Env } from "./env";
import type { Auth } from "./guard";
import { error, HttpError, json } from "./http";
import { signTicket, TICKET_TTL_S, verifyTicket } from "./jwt";
import { limit, MINUTE } from "./ratelimit";
import { RELAY_HEADERS } from "./relay";

const relay = (env: Env, runtimeId: string) => env.RELAY.get(env.RELAY.idFromName(runtimeId));

const notFound = () => new HttpError(404, "not_found", "That computer is not connected to this account.");
const badTicket = () => error(401, "bad_ticket", "This connection ticket is not valid. Please try again.");

async function liveRuntime(env: Env, runtimeId: string) {
  return env.DB.prepare("SELECT workspace_id, revoked_at FROM runtimes WHERE id = ?")
    .bind(runtimeId).first<{ workspace_id: string; revoked_at: number | null }>();
}

/** POST /v1/relay/{runtimeId}/ticket */
export async function ticket(env: Env, auth: Auth, runtimeId: string): Promise<Response> {
  await limit(env, `relay-ticket:${auth.sub}`, 60, MINUTE);
  if (auth.typ === "runtime" && auth.sub !== runtimeId) {
    throw new HttpError(403, "forbidden", "A computer can only open its own connection.");
  }
  const rt = await liveRuntime(env, runtimeId);
  if (!rt || rt.revoked_at) throw notFound();
  if (auth.typ === "user") {
    const member = await env.DB.prepare("SELECT 1 AS ok FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .bind(rt.workspace_id, auth.uid).first<{ ok: number }>();
    if (!member || rt.workspace_id !== auth.ws) throw new HttpError(403, "forbidden", "That computer belongs to another workspace.");
  } else if (rt.workspace_id !== auth.ws) {
    throw new HttpError(403, "forbidden", "That computer belongs to another workspace.");
  }
  const t = await signTicket(env, { sub: auth.sub, role: auth.typ === "runtime" ? "runtime" : "device", rid: runtimeId, jti: randomId("j") });
  return json({ ticket: t, expiresIn: TICKET_TTL_S });
}

/** GET /v1/relay/{runtimeId}?ticket=… (Upgrade: websocket) */
export async function connect(request: Request, env: Env, runtimeId: string, url: URL): Promise<Response> {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return error(426, "upgrade_required", "This address takes a WebSocket connection.", {});
  }
  const claims = await verifyTicket(env, url.searchParams.get("ticket") || "", runtimeId);
  if (!claims) return badTicket();
  const rt = await liveRuntime(env, runtimeId);
  if (!rt || rt.revoked_at) return badTicket();
  const forward = new Request("https://relay/connect", {
    headers: {
      Upgrade: "websocket",
      [RELAY_HEADERS.role]: claims.role,
      [RELAY_HEADERS.sub]: claims.sub,
      [RELAY_HEADERS.jti]: claims.jti,
      [RELAY_HEADERS.exp]: String(claims.exp),
    },
  });
  const res = await relay(env, runtimeId).fetch(forward);
  if (res.status === 401) return badTicket();   // the ticket was already used
  return res;
}

/** GET /v1/relay/runtimes: the workspace's computers, and whether each is connected to the relay now. */
export async function runtimes(env: Env, auth: Auth): Promise<Response> {
  if (auth.typ !== "user") throw new HttpError(403, "forbidden", "Only a signed-in person can list the computers.");
  const { results } = await env.DB.prepare(
    "SELECT id, name, platform FROM runtimes WHERE workspace_id = ? AND revoked_at IS NULL ORDER BY name, id",
  ).bind(auth.ws).all<{ id: string; name: string; platform: string }>();
  const out = await Promise.all(results.map(async (r) => {
    let online = false;
    try {
      const s = await relay(env, r.id).fetch("https://relay/status");
      online = !!((await s.json()) as { online?: boolean }).online;
    } catch {
      // reported as offline
    }
    return { id: r.id, name: r.name, platform: r.platform, online };
  }));
  return json(out);
}
