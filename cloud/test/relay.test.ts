// The relay (docs/architecture/relay-protocol.md): tickets, the upgrade, and RuntimeRelay's routing.
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";
import { signTicket } from "../src/jwt";
import { RuntimeRelay } from "../src/relay";
import { call, newEmail, post, RUNTIME, signIn } from "./helpers";

const E = env as unknown as Env;

/** A test socket: every message it receives is queued; next() takes the oldest (waiting for one if need be). */
interface Sock { ws: WebSocket; next: (ms?: number) => Promise<any>; closed: Promise<{ code: number; reason: string }>; pending: any[] }

const open: WebSocket[] = [];
afterEach(() => {
  for (const ws of open.splice(0)) {
    try { ws.close(1000, "done"); } catch { /* already closed */ }
  }
});

async function upgrade(runtimeId: string, ticket: string): Promise<Response> {
  return worker.fetch(new Request(`https://api.test/v1/relay/${runtimeId}?ticket=${encodeURIComponent(ticket)}`, {
    headers: { Upgrade: "websocket" },
  }), E);
}

function wrap(ws: WebSocket): Sock {
  const pending: any[] = [];
  const waiters: ((v: any) => void)[] = [];
  ws.accept();
  open.push(ws);
  ws.addEventListener("message", (e) => {
    const v = JSON.parse(e.data as string);
    const w = waiters.shift();
    if (w) w(v); else pending.push(v);
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    ws.addEventListener("close", (e) => resolve({ code: e.code, reason: e.reason }));
  });
  const next = (ms = 2000) => {
    if (pending.length) return Promise.resolve(pending.shift());
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("no message")), ms);
      waiters.push((v) => { clearTimeout(t); resolve(v); });
    });
  };
  return { ws, next, closed, pending };
}

async function getTicket(runtimeId: string, token: string): Promise<string> {
  const r = await post(`/v1/relay/${runtimeId}/ticket`, {}, { token });
  if (r.status !== 200) throw new Error(`ticket ${r.status} ${r.text}`);
  return r.body.ticket;
}

async function connect(runtimeId: string, token: string): Promise<Sock> {
  const res = await upgrade(runtimeId, await getTicket(runtimeId, token));
  if (res.status !== 101 || !res.webSocket) throw new Error(`upgrade ${res.status} ${await res.text()}`);
  return wrap(res.webSocket);
}

/** A workspace with one PC (signed in as the runtime) and a phone (the same person, signed in in a browser). */
async function setup() {
  const email = newEmail();
  const pc = await signIn(email, RUNTIME);
  const phone = await signIn(email, { type: "browser" });
  return { rid: pc.runtime!.id, pc, phone };
}

describe("POST /v1/relay/{runtimeId}/ticket", () => {
  it("gives a member's device and the runtime itself a 60-second ticket", async () => {
    const { rid, pc, phone } = await setup();
    for (const token of [phone.access, pc.access]) {
      const r = await post(`/v1/relay/${rid}/ticket`, {}, { token });
      expect(r.status).toBe(200);
      expect(r.body.expiresIn).toBe(60);
      const claims = JSON.parse(atob(r.body.ticket.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      expect(claims).toMatchObject({ rid, role: token === pc.access ? "runtime" : "device", sub: token === pc.access ? rid : phone.user.id });
      expect(claims.exp - claims.iat).toBe(60);
      expect(typeof claims.jti).toBe("string");
    }
  });

  it("refuses a runtime asking for another runtime, and someone from another workspace", async () => {
    const { rid } = await setup();
    const other = await signIn(newEmail(), RUNTIME);
    expect((await post(`/v1/relay/${rid}/ticket`, {}, { token: other.access })).body.error.code).toBe("forbidden");
    const stranger = await signIn(newEmail(), { type: "browser" });
    const r = await post(`/v1/relay/${rid}/ticket`, {}, { token: stranger.access });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("forbidden");
  });

  it("answers 404 for an unknown or revoked runtime, and 401 without a token", async () => {
    const { rid, phone } = await setup();
    expect((await post("/v1/relay/r_unknown/ticket", {}, { token: phone.access })).status).toBe(404);
    expect((await call(`/v1/runtimes/${rid}`, { method: "DELETE", token: phone.access })).status).toBe(204);
    const r = await post(`/v1/relay/${rid}/ticket`, {}, { token: phone.access });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe("not_found");
    expect((await post(`/v1/relay/${rid}/ticket`, {})).status).toBe(401);
  });
});

describe("GET /v1/relay/{runtimeId}", () => {
  it("answers 426 to a request that is not a WebSocket upgrade", async () => {
    const { rid, phone } = await setup();
    const r = await call(`/v1/relay/${rid}?ticket=${await getTicket(rid, phone.access)}`);
    expect(r.status).toBe(426);
  });

  it("refuses an expired, reused, tampered or wrong-runtime ticket with 401 bad_ticket", async () => {
    const { rid, phone } = await setup();
    const expired = await signTicket(E, { sub: phone.user.id, role: "device", rid, jti: "j_old" }, Date.now() - 120_000);
    const r1 = await upgrade(rid, expired);
    expect(r1.status).toBe(401);
    expect(((await r1.json()) as any).error.code).toBe("bad_ticket");

    const t = await getTicket(rid, phone.access);
    const first = await upgrade(rid, t);
    expect(first.status).toBe(101);
    wrap(first.webSocket!);
    const again = await upgrade(rid, t);
    expect(again.status).toBe(401);
    expect(((await again.json()) as any).error.code).toBe("bad_ticket");

    const t2 = await getTicket(rid, phone.access);
    expect((await upgrade(rid, t2.slice(0, -4) + "AAAA")).status).toBe(401);
    expect((await upgrade("r_other", t2)).status).toBe(401);
    // an access token is not a ticket
    expect((await upgrade(rid, phone.access)).status).toBe(401);
  });

  it("refuses a ticket for a runtime revoked after it was issued", async () => {
    const { rid, phone } = await setup();
    const t = await getTicket(rid, phone.access);
    await call(`/v1/runtimes/${rid}`, { method: "DELETE", token: phone.access });
    expect((await upgrade(rid, t)).status).toBe(401);
  });
});

describe("RuntimeRelay", () => {
  it("answers a device's request with 503 offline while the PC is away", async () => {
    const { rid, phone } = await setup();
    const dev = await connect(rid, phone.access);
    expect(await dev.next()).toEqual({ t: "runtime", online: false });
    dev.ws.send(JSON.stringify({ t: "req", id: "1", method: "GET", path: "api/state", headers: {}, body: "" }));
    expect(await dev.next()).toEqual({
      t: "res", id: "1", status: 503, headers: { "Content-Type": "application/json" }, body: '{"error":"offline"}',
    });
  });

  it("routes a request to the PC with from, and its answer back to that device without to", async () => {
    const { rid, pc, phone } = await setup();
    const rt = await connect(rid, pc.access);
    const a = await connect(rid, phone.access);
    const b = await connect(rid, phone.access);
    expect(await a.next()).toEqual({ t: "runtime", online: true });
    expect(await b.next()).toEqual({ t: "runtime", online: true });

    const req = { t: "req", id: "7", method: "POST", path: "api/next", headers: { "Content-Type": "application/json", Cookie: "s=1" }, body: "{}" };
    a.ws.send(JSON.stringify(req));
    const got = await rt.next();
    expect(got).toMatchObject(req);
    expect(typeof got.from).toBe("string");

    const res = { t: "res", id: "7", status: 200, headers: { "Content-Type": "application/json" }, body: '{"ok":true}', enc: undefined };
    rt.ws.send(JSON.stringify({ ...res, to: got.from }));
    const back = await a.next();
    expect(back).toEqual({ t: "res", id: "7", status: 200, headers: { "Content-Type": "application/json" }, body: '{"ok":true}' });
    expect(back.to).toBeUndefined();
    // the other device saw nothing
    b.ws.send(JSON.stringify({ t: "ping" }));
    expect(await b.next()).toEqual({ t: "pong" });

    // a binary body travels as base64, untouched
    b.ws.send(JSON.stringify({ t: "req", id: 9, method: "GET", path: "api/thumb", headers: {}, body: "AAEC", enc: "b64" }));
    const got2 = await rt.next();
    expect(got2).toMatchObject({ id: 9, enc: "b64", body: "AAEC" });
    expect(got2.from).not.toBe(got.from);
  });

  it("tells the devices when the PC connects and goes away", async () => {
    const { rid, pc, phone } = await setup();
    const dev = await connect(rid, phone.access);
    expect(await dev.next()).toEqual({ t: "runtime", online: false });
    const rt = await connect(rid, pc.access);
    expect(await dev.next()).toEqual({ t: "runtime", online: true });
    rt.ws.close(1000, "bye");
    expect(await dev.next()).toEqual({ t: "runtime", online: false });
  });

  it("a second PC connection replaces the first (4000 replaced) and the devices stay online", async () => {
    const { rid, pc, phone } = await setup();
    const first = await connect(rid, pc.access);
    const dev = await connect(rid, phone.access);
    expect(await dev.next()).toEqual({ t: "runtime", online: true });
    const second = await connect(rid, pc.access);
    expect(await first.closed).toEqual({ code: 4000, reason: "replaced" });
    expect(await dev.next()).toEqual({ t: "runtime", online: true });

    dev.ws.send(JSON.stringify({ t: "req", id: "a", method: "GET", path: "api/state", headers: {}, body: "" }));
    expect(await second.next()).toMatchObject({ t: "req", id: "a" });
    expect(first.pending).toEqual([]);

    const stub = E.RELAY.get(E.RELAY.idFromName(rid));
    await runInDurableObject(stub, async (instance: RuntimeRelay, state) => {
      expect(instance).toBeInstanceOf(RuntimeRelay);
      const live = state.getWebSockets("runtime").filter((s) => s.readyState === WebSocket.OPEN);
      expect(live).toHaveLength(1);
    });
  });

  it("answers ping with pong on both sides", async () => {
    const { rid, pc, phone } = await setup();
    const rt = await connect(rid, pc.access);
    const dev = await connect(rid, phone.access);
    await dev.next();
    for (const s of [rt, dev]) {
      s.ws.send('{"t":"ping"}');
      expect(await s.next()).toEqual({ t: "pong" });
      s.ws.send('{ "t": "ping" }');
      expect(await s.next()).toEqual({ t: "pong" });
    }
  });

  it("drops oversize, malformed and unknown messages and tells the sender", async () => {
    const { rid, pc, phone } = await setup();
    const rt = await connect(rid, pc.access);
    const dev = await connect(rid, phone.access);
    await dev.next();

    dev.ws.send(JSON.stringify({ t: "req", id: "big", method: "POST", path: "api/x", headers: {}, body: "x".repeat(1024 * 1024) }));
    expect(await dev.next()).toMatchObject({ t: "error", code: "too_large" });
    dev.ws.send("{not json");
    expect(await dev.next()).toMatchObject({ t: "error", code: "bad_json" });
    dev.ws.send(JSON.stringify({ t: "hello" }));
    expect(await dev.next()).toMatchObject({ t: "error", code: "unknown_type" });
    dev.ws.send(JSON.stringify({ t: "res", id: "1", to: "c_x", status: 200 }));   // a device cannot answer
    expect(await dev.next()).toMatchObject({ t: "error", code: "unknown_type" });
    rt.ws.send(JSON.stringify({ t: "req", id: "1", method: "GET", path: "api/state" }));   // nor the PC ask
    expect(await rt.next()).toMatchObject({ t: "error", code: "unknown_type" });
    rt.ws.send("[1,2]");
    expect(await rt.next()).toMatchObject({ t: "error", code: "bad_json" });

    // none of it reached the other side
    rt.ws.send('{"t":"ping"}');
    expect(await rt.next()).toEqual({ t: "pong" });
    expect(rt.pending).toEqual([]);
  });

  it("answers its internal status", async () => {
    const { rid, pc, phone } = await setup();
    const stub = E.RELAY.get(E.RELAY.idFromName(rid));
    expect(await (await stub.fetch("https://relay/status")).json()).toEqual({ online: false, devices: 0 });
    await connect(rid, pc.access);
    const dev = await connect(rid, phone.access);
    await dev.next();
    expect(await (await stub.fetch("https://relay/status")).json()).toEqual({ online: true, devices: 1 });
  });
});

describe("GET /v1/relay/runtimes", () => {
  it("lists the workspace's computers that are not revoked, with whether each is connected", async () => {
    const email = newEmail();
    const a = await signIn(email, RUNTIME);
    const b = await signIn(email, { ...RUNTIME, name: "Laptop", platform: "macos" });
    const c = await signIn(email, { ...RUNTIME, name: "Old PC", platform: "linux" });
    const phone = await signIn(email, { type: "browser" });
    await call(`/v1/runtimes/${c.runtime!.id}`, { method: "DELETE", token: phone.access });

    const rt = await connect(a.runtime!.id, a.access);
    let r = await call("/v1/relay/runtimes", { token: phone.access });
    expect(r.status).toBe(200);
    expect(r.body).toEqual([
      { id: a.runtime!.id, name: "Church PC", platform: "windows", online: true },
      { id: b.runtime!.id, name: "Laptop", platform: "macos", online: false },
    ]);

    // after the PC goes away (a device sees the notice first, so the relay has handled the close)
    const dev = await connect(a.runtime!.id, phone.access);
    expect(await dev.next()).toEqual({ t: "runtime", online: true });
    rt.ws.close(1000, "bye");
    expect(await dev.next()).toEqual({ t: "runtime", online: false });
    r = await call("/v1/relay/runtimes", { token: phone.access });
    expect(r.body.every((x: { online: boolean }) => !x.online)).toBe(true);

    expect((await call("/v1/relay/runtimes", { token: a.access })).status).toBe(403);
    expect((await call("/v1/relay/runtimes")).status).toBe(401);
  });
});
