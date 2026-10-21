// CORS for the PWA, which calls the API from another origin (Cloudflare Pages; a local server in development).
// Only origins on the CORS_ORIGINS allow-list (comma-separated; "http://127.0.0.1:*" allows any port) get CORS
// headers. Others get none, and are still answered: native clients send no Origin. Tokens are bearer, so no
// credentials (cookies) are ever allowed.
import type { Env } from "./env";

const ALLOW_METHODS = "GET, POST, PATCH, DELETE";
const ALLOW_HEADERS = "Authorization, Content-Type";
const MAX_AGE = "600";

export function allowedOrigin(env: Env, origin: string | null): string | null {
  if (!origin) return null;
  for (const raw of (env.CORS_ORIGINS || "").split(",")) {
    const entry = raw.trim().replace(/\/+$/, "");
    if (!entry) continue;
    if (entry === origin) return origin;
    if (entry.endsWith(":*") && origin.startsWith(entry.slice(0, -1)) && /^\d{1,5}$/.test(origin.slice(entry.length - 1))) {
      return origin;
    }
  }
  return null;
}

/** The answer to a preflight (OPTIONS with Access-Control-Request-Method). */
export function preflight(env: Env, request: Request): Response {
  const origin = allowedOrigin(env, request.headers.get("Origin"));
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin) {
    Object.assign(headers, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": ALLOW_METHODS,
      "Access-Control-Allow-Headers": ALLOW_HEADERS,
      "Access-Control-Max-Age": MAX_AGE,
    });
  }
  return new Response(null, { status: 204, headers });
}

export const isPreflight = (request: Request): boolean =>
  request.method === "OPTIONS" && request.headers.has("Origin") && request.headers.has("Access-Control-Request-Method");

/** Adds the CORS headers to an answer when the request's origin is allowed. A WebSocket upgrade (101) is left as is. */
export function withCors(env: Env, request: Request, response: Response): Response {
  const origin = allowedOrigin(env, request.headers.get("Origin"));
  if (!origin || response.status === 101 || response.webSocket) return response;
  const out = new Response(response.body, response);
  out.headers.set("Access-Control-Allow-Origin", origin);
  out.headers.append("Vary", "Origin");
  return out;
}
