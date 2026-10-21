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
