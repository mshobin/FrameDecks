// FrameDecks - checks a deployed website from the outside: the pages answer, the PC's setup file is JSON with the
// cloud's address, the security headers are sent, signed-in pages are not cached, a missing page is a 404, and the
// build's files are cached for a year. Used after every Cloudflare Pages deploy (.github/workflows/hosted.yml) and by
// the owner during the move (docs/deployment/cloudflare-pages.md):
//   node hosted/scripts/smoke-site.mjs https://framedecks.com
//   node hosted/scripts/smoke-site.mjs https://<deployment>.framedecks.pages.dev --preview
// --preview: a pages.dev address (it must say noindex). Exits 1 and lists every problem.
import { fileURLToPath } from "node:url";

const PAGES = ["/", "/follow", "/join", "/sign-in", "/auth/callback", "/help", "/privacy", "/terms", "/download", "/sync",
  "/live", "/members", "/plan", "/services"];
const SECURITY = ["strict-transport-security", "x-content-type-options", "referrer-policy", "x-frame-options",
  "content-security-policy", "permissions-policy"];

async function get(url) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "FrameDecks site check (+https://framedecks.com)" } });
  return { res, text: await res.text() };
}

export async function smoke(base, { preview = false } = {}) {
  base = base.replace(/\/+$/, "");
  const problems = [];
  for (const p of PAGES) {
    try {
      const { res, text } = await get(base + p);
      if (res.status !== 200) { problems.push(`${p}: ${res.status}`); continue; }
      if (!/<html/i.test(text)) problems.push(`${p}: not a page`);
      for (const h of SECURITY) if (!res.headers.get(h)) problems.push(`${p}: no ${h}`);
      if (!/script-src/.test(res.headers.get("content-security-policy") || "")) problems.push(`${p}: no page script policy`);
      if ((p === "/sync" || p.startsWith("/auth/")) && !/no-store/.test(res.headers.get("cache-control") || "")) problems.push(`${p}: may be cached`);
      if (preview && !/noindex/.test(res.headers.get("x-robots-tag") || "")) problems.push(`${p}: a pages.dev address without noindex`);
      if (p === "/") {
        const asset = /\/_next\/static\/[^"']+\.js/.exec(text)?.[0];
        if (!asset) problems.push("/: no build script found");
        else {
          const a = await fetch(base + asset);
          if (a.status !== 200) problems.push(`${asset}: ${a.status}`);
          if (!/immutable/.test(a.headers.get("cache-control") || "")) problems.push(`${asset}: not cached as immutable`);
          await a.arrayBuffer();
        }
      }
    } catch (e) {
      problems.push(`${p}: ${e.message}`);
    }
  }
  try {
    const { res, text } = await get(base + "/api/sync-config");
    const cfg = JSON.parse(text);
    if (res.status !== 200) problems.push(`/api/sync-config: ${res.status}`);
    if (!/application\/json/.test(res.headers.get("content-type") || "")) problems.push("/api/sync-config: not served as JSON");
    if (!(typeof cfg.url === "string" && cfg.url.startsWith("https://") && cfg.anonKey)) problems.push("/api/sync-config: no cloud address (PCs could not link)");
  } catch (e) {
    problems.push(`/api/sync-config: ${e.message}`);
  }
  try {
    const { res } = await get(base + "/this-page-does-not-exist-" + Date.now());
    if (res.status !== 404) problems.push(`a missing page answers ${res.status}, not 404`);
  } catch (e) {
    problems.push(`missing page: ${e.message}`);
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const base = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!base) {
    console.error("usage: node hosted/scripts/smoke-site.mjs <https://address> [--preview]");
    process.exit(2);
  }
  const problems = await smoke(base, { preview: process.argv.includes("--preview") });
  if (problems.length) {
    console.error(`smoke-site: ${base} has ${problems.length} problem(s):\n  ` + problems.join("\n  "));
    process.exit(1);
  }
  console.log(`smoke-site: ${base} answers every page with its headers, the setup file and a 404`);
}
