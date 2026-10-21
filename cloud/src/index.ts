// FrameDecks cloud API (docs/project/saas-pwa-architecture.md §4, §8; the exact contract: docs/architecture/cloud-api.md).
// Every response is JSON (the browser sign-in page aside); errors use {"error": {"code", "message"}} with messages
// written for people.
import pkg from "../package.json";
import { audit, listAudit } from "./audit";
import * as email from "./auth/email";
import { configuredProviders } from "./auth/oidc";
import * as session from "./auth/session";
import type { Env } from "./env";
import { authenticate } from "./guard";
import { clientIp, empty, error, HttpError, json, readJson } from "./http";
import { jwks } from "./jwt";
import { deleteMe, exportMe, me, renameRuntime, revokeRuntime } from "./me";
import { pull, push } from "./sync";
import { logout, rotate } from "./tokens";

// The Workers runtime treats every named export of this module as an entry point: export only the handler.
const VERSION: string = pkg.version;

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

type Handler = (request: Request, env: Env, params: string[], url: URL) => Promise<Response>;
interface Route { method: string; pattern: RegExp; handler: Handler }

const routes: Route[] = [];
const on = (method: string, path: string, handler: Handler) =>
  routes.push({ method, pattern: new RegExp(`^/v1${path.replace(/\{[a-z]+\}/g, "([^/]+)")}$`), handler });

on("GET", "/health", (_r, env) => health(env));
on("GET", "/\\.well-known/jwks\\.json", async (_r, env) => json(await jwks(env), 200, { "Cache-Control": "public, max-age=300" }));

// signing in
on("GET", "/auth/providers", async (_r, env) => json({ providers: configuredProviders(env), email: email.emailAvailable(env) }));
on("POST", "/auth/email/start", (r, env) => email.apiStart(r, env));
on("POST", "/auth/email/verify", (r, env) => email.apiVerify(r, env));
on("POST", "/auth/session", (r, env) => session.create(r, env));
on("POST", "/auth/session/poll", (r, env) => session.poll(r, env));
on("GET", "/auth/session/{id}", (r, env, p) => session.page(r, env, p[0]));
on("GET", "/auth/session/{id}/oidc/{provider}", (r, env, p) => session.toProvider(r, env, p[0], p[1]));
on("POST", "/auth/session/{id}/email", (r, env, p) => session.pageEmail(r, env, p[0], "start"));
on("POST", "/auth/session/{id}/email/verify", (r, env, p) => session.pageEmail(r, env, p[0], "verify"));
on("GET", "/auth/oidc/{provider}/callback", (r, env, p) => session.callback(r, env, p[0]));
on("POST", "/auth/oidc/{provider}/callback", (r, env, p) => session.callback(r, env, p[0]));
on("POST", "/auth/refresh", async (r, env) => {
  const body = await readJson<{ refresh?: unknown }>(r);
  return json(await rotate(env, String(body.refresh ?? ""), clientIp(r)));
});
on("POST", "/auth/logout", async (r, env) => {
  const body = await readJson<{ refresh?: unknown }>(r);
  const who = await logout(env, String(body.refresh ?? ""));
  if (who) await audit(env, null, { type: who.type === "runtime" ? "runtime" : "user", id: who.id }, "sign_out", null, clientIp(r));
  return empty();
});

// you, your workspace, your computers
on("GET", "/me", async (r, env) => me(env, await authenticate(r, env)));
on("GET", "/me/export", async (r, env) => exportMe(env, await authenticate(r, env)));
on("DELETE", "/me", async (r, env) => deleteMe(r, env, await authenticate(r, env)));
on("PATCH", "/runtimes/{id}", async (r, env, p) => renameRuntime(r, env, await authenticate(r, env), p[0]));
on("DELETE", "/runtimes/{id}", async (r, env, p) => revokeRuntime(r, env, await authenticate(r, env), p[0]));
on("GET", "/audit", async (r, env, _p, url) => listAudit(env, await authenticate(r, env), url));

// sync
on("GET", "/sync", async (r, env, _p, url) => pull(env, await authenticate(r, env), url));
on("POST", "/sync", async (r, env) => push(r, env, await authenticate(r, env)));

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method === "HEAD" ? "GET" : request.method;
  let pathMatched = false;
  for (const rt of routes) {
    const m = rt.pattern.exec(url.pathname);
    if (!m) continue;
    pathMatched = true;
    if (rt.method !== method) continue;
    try {
      return await rt.handler(request, env, m.slice(1).map(decodeURIComponent), url);
    } catch (e) {
      if (e instanceof HttpError) return e.response();
      console.error("unexpected error", e instanceof Error ? e.stack : e);
      return error(500, "server_error", "Something went wrong on our side. Please try again.");
    }
  }
  if (pathMatched) return error(405, "method_not_allowed", `${request.method} is not allowed here.`);
  return error(404, "not_found", "There is nothing at this address.");
}

export default {
  fetch: (request: Request, env: Env) => route(request, env),
} satisfies ExportedHandler<Env>;
