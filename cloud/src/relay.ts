// The relay: one Durable Object per runtime (idFromName(runtimeId)) that passes messages between the PC and the
// phones signed in to its workspace. docs/architecture/relay-protocol.md.
//
// Hibernation API: sockets are accepted with ctx.acceptWebSocket, so an idle relay is evicted from memory and costs
// nothing; each socket's role and connection id live in its attachment and tags. The relay never logs, stores or
// reads `path`, `headers` or `body`: it parses a frame only to find `t`, `id` and `to`, and passes the rest on.
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import { randomId } from "./crypto";

/** Largest frame accepted, in bytes (1 MiB). */
export const MAX_MESSAGE = 1024 * 1024;

/** Internal headers the Worker sets when it forwards a checked upgrade (never taken from the outside). */
export const RELAY_HEADERS = { role: "X-Relay-Role", sub: "X-Relay-Sub", jti: "X-Relay-Jti", exp: "X-Relay-Exp" } as const;

type Role = "runtime" | "device";
interface Attachment { role: Role; id: string; sub: string; replaced?: boolean }

const OFFLINE_BODY = JSON.stringify({ error: "offline" });
const JTI_PREFIX = "jti:";

const plain = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export class RuntimeRelay extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // answered by the runtime itself, without waking the object (other spellings of ping reach webSocketMessage)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/status" && request.method === "GET") {
      return plain(200, { online: this.runtimeSocket() !== null, devices: this.ctx.getWebSockets("device").length });
    }
    if (url.pathname === "/connect") return this.accept(request);
    return plain(404, { error: "not_found" });
  }

  /** A checked upgrade from the Worker: the ticket's signature, expiry and runtime are already verified. */
  private async accept(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return plain(426, { error: "upgrade_required" });
    const role = request.headers.get(RELAY_HEADERS.role);
    const sub = request.headers.get(RELAY_HEADERS.sub) || "";
    const jti = request.headers.get(RELAY_HEADERS.jti) || "";
    const exp = Number(request.headers.get(RELAY_HEADERS.exp));
    if ((role !== "runtime" && role !== "device") || !sub || !jti || !Number.isFinite(exp)) return plain(400, { error: "bad_request" });

    // each ticket opens one socket: its jti is remembered until it expires (input gates make get+put atomic here)
    const key = JTI_PREFIX + jti;
    if ((await this.ctx.storage.get(key)) !== undefined) return plain(401, { error: "bad_ticket" });
    await this.ctx.storage.put(key, exp * 1000);
    await this.scheduleSweep(exp * 1000);

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    if (role === "runtime") {
      for (const old of this.ctx.getWebSockets("runtime")) {
        const a = old.deserializeAttachment() as Attachment | null;
        if (a) old.serializeAttachment({ ...a, replaced: true });
        try { old.close(4000, "replaced"); } catch { /* already closing */ }
      }
      const id = randomId("c");
      this.ctx.acceptWebSocket(server, ["runtime", id]);
      server.serializeAttachment({ role, id, sub } satisfies Attachment);
      this.broadcastOnline(true);
    } else {
      const id = randomId("c");
      this.ctx.acceptWebSocket(server, ["device", id]);
      server.serializeAttachment({ role, id, sub } satisfies Attachment);
      send(server, { t: "runtime", online: this.runtimeSocket() !== null });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const me = ws.deserializeAttachment() as Attachment | null;
    if (!me) return;
    if (typeof message !== "string") return sendError(ws, "bad_message", "Messages are text frames of JSON.");
    if (byteLength(message) > MAX_MESSAGE) return sendError(ws, "too_large", "Messages are at most 1 MB.");
    let m: Record<string, unknown>;
    try {
      const v = JSON.parse(message);
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("not an object");
      m = v as Record<string, unknown>;
    } catch {
      return sendError(ws, "bad_json", "That message is not valid JSON.");
    }

    if (m.t === "ping") return send(ws, { t: "pong" });

    if (me.role === "device" && m.t === "req") {
      if (!validId(m.id)) return sendError(ws, "bad_message", "A request needs an id.");
      const runtime = this.runtimeSocket();
      if (!runtime) {
        return send(ws, { t: "res", id: m.id, status: 503, headers: { "Content-Type": "application/json" }, body: OFFLINE_BODY });
      }
      return send(runtime, { ...m, from: me.id });
    }

    if (me.role === "runtime" && m.t === "res") {
      if (!validId(m.id) || typeof m.to !== "string") return sendError(ws, "bad_message", "A response needs an id and to.");
      const { to, ...out } = m;
      for (const device of this.ctx.getWebSockets(to)) {
        const a = device.deserializeAttachment() as Attachment | null;
        if (a?.role === "device") send(device, out);   // a device that has gone away: the answer is dropped
      }
      return;
    }

    return sendError(ws, "unknown_type", "Unknown message type.");
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, reason); } catch { /* already closed */ }
    this.gone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.gone(ws);
  }

  /** Forgets used tickets once they have expired. */
  async alarm(): Promise<void> {
    const now = Date.now();
    const used = await this.ctx.storage.list<number>({ prefix: JTI_PREFIX });
    const expired = [...used].filter(([, exp]) => exp <= now).map(([k]) => k);
    if (expired.length) await this.ctx.storage.delete(expired);
    const next = [...used.values()].filter((exp) => exp > now);
    if (next.length) await this.ctx.storage.setAlarm(Math.min(...next) + 1000);
  }

  private async scheduleSweep(at: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > at + 1000) await this.ctx.storage.setAlarm(at + 1000);
  }

  private gone(ws: WebSocket): void {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (a?.role !== "runtime" || a.replaced) return;
    if (this.runtimeSocket(ws) === null) this.broadcastOnline(false);
  }

  /** The open runtime socket (other than `except`), if any. */
  private runtimeSocket(except?: WebSocket): WebSocket | null {
    for (const s of this.ctx.getWebSockets("runtime")) {
      if (s === except || s.readyState !== WebSocket.OPEN) continue;
      const a = s.deserializeAttachment() as Attachment | null;
      if (a && !a.replaced) return s;
    }
    return null;
  }

  private broadcastOnline(online: boolean): void {
    for (const d of this.ctx.getWebSockets("device")) send(d, { t: "runtime", online });
  }
}

const validId = (v: unknown): boolean => (typeof v === "string" && v.length > 0) || typeof v === "number";

function byteLength(s: string): number {
  if (s.length * 3 <= MAX_MESSAGE) return s.length;   // cannot be over the limit: skip encoding
  return new TextEncoder().encode(s).length;
}

function send(ws: WebSocket, message: unknown): void {
  try { ws.send(JSON.stringify(message)); } catch { /* the socket is closing */ }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, { t: "error", code, message });
}
