// FrameDecks cloud API (docs/project/saas-pwa-architecture.md §4, §8). Phase 1: the skeleton, with /v1/health.
// Every response is JSON; errors use {"error": {"code", "message"}} with messages written for people.
import pkg from "../package.json";

export interface Env {
  DB: D1Database;
}

export const VERSION: string = pkg.version;

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: SECURITY_HEADERS });
}

export function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

async function health(env: Env): Promise<Response> {
  let db: "ok" | "error" = "error";
  try {
    const row = await env.DB.prepare("SELECT 1 AS one").first<{ one: number }>();
    if (row?.one === 1) db = "ok";
  } catch {
    // reported as "error" below; the service itself is up
  }
  return json({ ok: true, service: "framedecks-api", version: VERSION, db });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/v1/health") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return error(405, "method_not_allowed", "Use GET for /v1/health.");
      }
      return health(env);
    }
    return error(404, "not_found", "There is nothing at this address.");
  },
} satisfies ExportedHandler<Env>;
