// FrameDecks update service (7.0): api.framedecks.com, a Cloudflare Worker reading the release files that the
// "Build Windows installer" workflow writes to the R2 bucket (docs/deployment/release-pipeline.md).
//
//   GET /releases/latest       the newest release manifest (the program's updater and framedecks.com/download)
//   GET /releases              every release, newest first
//   GET /releases/<version>    one release's manifest (for putting an earlier version back)
//   GET /health                {"ok": true} when the bucket answers (framedecks.com/status)
//
// Read-only, no cookies, nothing about the caller is stored. Answers are cached for five minutes.

const VERSION = /^\d+(\.\d+){1,3}$/;
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "x-content-type-options": "nosniff",
};

function json(body, status = 200, cache = "public, max-age=300") {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { ...HEADERS, "cache-control": cache } });
}

async function file(env, key) {
  const obj = await env.RELEASES.get(key);
  return obj ? json(await obj.text()) : json({ error: "Not found" }, 404, "public, max-age=60");
}

export async function handle(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed" }, 405, "no-store");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/health") {
    try {
      const head = await env.RELEASES.head("releases/latest.json");
      return json({ ok: true, latest: head ? true : false }, 200, "no-store");
    } catch {
      return json({ ok: false }, 503, "no-store");
    }
  }
  if (path === "/releases/latest") return file(env, "releases/latest.json");
  if (path === "/releases") return file(env, "releases/index.json");
  const m = /^\/releases\/([^/]+)$/.exec(path);
  if (m && VERSION.test(m[1])) return file(env, `releases/${m[1]}/manifest.json`);
  return json({ error: "Not found" }, 404, "public, max-age=60");
}

export default { fetch: handle };
