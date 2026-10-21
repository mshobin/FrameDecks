// Calling the Worker in tests: straight through its fetch handler, with the test bindings (and any overrides).
import { env } from "cloudflare:workers";
import worker from "../src/index";
import type { Env } from "../src/env";

let ipCounter = 0;
/** A fresh client address per test, so the per-address limits of one test never touch another. */
export const newIp = (): string => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

export interface Call { status: number; body: any; headers: Headers; text: string }

export async function call(path: string, init: RequestInit & { token?: string; ip?: string; env?: Partial<Env> } = {}): Promise<Call> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  headers.set("CF-Connecting-IP", init.ip ?? "10.255.255.1");
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await worker.fetch(new Request(`https://api.test${path}`, { ...init, headers, redirect: "manual" }), { ...(env as unknown as Env), ...(init.env || {}) });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body, headers: res.headers, text };
}

export const post = (path: string, data: unknown, init: Parameters<typeof call>[1] = {}) =>
  call(path, { ...init, method: "POST", body: JSON.stringify(data) });

export const RUNTIME = { type: "runtime", name: "Church PC", platform: "windows", appVersion: "6.9" };

let n = 0;
export const newEmail = (): string => `person${Date.now()}${++n}@example.org`;

/** Signs in with an email code (dev/test answer with the code). */
export async function signIn(email = newEmail(), client: unknown = RUNTIME, ip = newIp()) {
  const s = await post("/v1/auth/email/start", { email }, { ip });
  if (s.status !== 202) throw new Error(`start ${s.status} ${s.text}`);
  const v = await post("/v1/auth/email/verify", { email, code: s.body.devCode, client }, { ip });
  if (v.status !== 200) throw new Error(`verify ${v.status} ${v.text}`);
  return v.body as {
    access: string; accessExpiresAt: number; refresh: string;
    user: { id: string; email: string; name: string }; workspace: { id: string; name: string; role: string };
    runtime?: { id: string; name: string };
  };
}

/** A public X25519 key's shape (32 random bytes, base64url): the cloud only stores and passes it on. */
export function fakeKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const PHONE = { name: "iPhone", platform: "iOS", browser: "Safari" };

/** A PC and a phone of one person, paired: start, claim with the QR token, approve, collect the credential. */
export async function pairDevice(role = "operator") {
  const email = newEmail();
  const pc = await signIn(email, RUNTIME);
  const phone = await signIn(email, { type: "browser" });
  const start = await post("/v1/pairing", { pcKey: fakeKey() }, { token: pc.access });
  if (start.status !== 201) throw new Error(`start ${start.status} ${start.text}`);
  const claim = await post("/v1/pairing/claim", { token: start.body.token, device: PHONE, deviceKey: fakeKey() }, { token: phone.access, ip: newIp() });
  if (claim.status !== 200) throw new Error(`claim ${claim.status} ${claim.text}`);
  const ok = await post(`/v1/pairing/${start.body.id}/approve`, { role }, { token: pc.access });
  if (ok.status !== 200) throw new Error(`approve ${ok.status} ${ok.text}`);
  const got = await call(`/v1/pairing/${start.body.id}`, { token: phone.access });
  if (!got.body?.credential) throw new Error(`credential ${got.status} ${got.text}`);
  const credential = got.body.credential as {
    device: { id: string; role: string; name: string }; runtime: { id: string; name: string };
    access: string; accessExpiresAt: number; refresh: string;
  };
  return { email, pc, phone, rid: pc.runtime!.id, pairingId: start.body.id as string, credential, device: credential.device };
}
