// FrameDecks - checks the built website (hosted/out) before it is deployed to Cloudflare Pages, so a deploy can never
// publish a site that is missing a page, its security headers or the PC's setup file. Run after `npm run build`:
//   node scripts/verify-site.mjs            (CI: --cloud also requires the real Supabase address in /api/sync-config)
// Exits 1 and lists every problem.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The pages every visitor, leader and PC relies on. */
export const PAGES = ["index.html", "404.html", "follow.html", "join.html", "sign-in.html", "auth/callback.html", "help.html",
  "privacy.html", "terms.html", "download.html", "sync.html", "live.html", "members.html", "plan.html", "services.html"];
/** Files the program, the browser or search engines ask for by name. */
export const FILES = ["_headers", "api/sync-config", "manifest.webmanifest", "sw.js", "robots.txt", "sitemap.xml",
  ".well-known/security.txt"];
/** The security headers every page must send (public/_headers, rule "/*"). */
export const SECURITY = ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options",
  "Content-Security-Policy", "Permissions-Policy"];

/** _headers as [{path, headers: [[name, value]]}] in file order. */
export function parseHeaders(text) {
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (/^\s/.test(line)) {
      const m = /^\s+([^:]+):\s*(.*)$/.exec(line);
      if (m && rules.length) rules.at(-1).headers.push([m[1].trim(), m[2].trim()]);
    } else rules.push({ path: line.trim(), headers: [] });
  }
  return rules;
}

function htmlPages(dir, root = dir, list = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "_next") htmlPages(p, root, list); continue; }
    if (f.endsWith(".html")) list.push(p.slice(root.length + 1).replace(/\\/g, "/"));
  }
  return list;
}

/** Every problem with the built site in `out` (an empty list when it is ready to deploy). */
export function checkSite(out, { cloud = false } = {}) {
  const problems = [];
  if (!existsSync(out)) return [`${out} does not exist: run npm run build first`];
  for (const f of [...PAGES, ...FILES]) if (!existsSync(join(out, f))) problems.push(`missing ${f}`);
  if (!existsSync(join(out, "_next", "static"))) problems.push("missing _next/static (the build's scripts and styles)");
  if (existsSync(join(out, "vercel.json"))) problems.push("vercel.json is in the output");

  if (existsSync(join(out, "api/sync-config"))) {
    try {
      const cfg = JSON.parse(readFileSync(join(out, "api/sync-config"), "utf8"));
      if (cloud && !(typeof cfg.url === "string" && cfg.url.startsWith("https://") && typeof cfg.anonKey === "string" && cfg.anonKey)) {
        problems.push("api/sync-config has no cloud address: the build had no NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
      }
      if (/service_role/.test(JSON.stringify(cfg))) problems.push("api/sync-config holds a service_role key");
    } catch {
      problems.push("api/sync-config is not JSON");
    }
  }

  if (existsSync(join(out, "_headers"))) {
    const text = readFileSync(join(out, "_headers"), "utf8");
    const rules = parseHeaders(text);
    if (rules.length > 100) problems.push(`_headers has ${rules.length} rules (Cloudflare Pages allows 100)`);
    const seen = new Set();
    for (const r of rules) {           // Cloudflare keeps one rule per exact path: a second one drops the first's headers
      if (seen.has(r.path)) problems.push(`_headers has two rules for ${r.path}`);
      seen.add(r.path);
    }
    for (const line of text.split(/\r?\n/)) if (line.length > 2000) problems.push("a _headers line is longer than 2,000 characters");
    const all = rules.find((r) => r.path === "/*");
    for (const h of SECURITY) if (!all?.headers.some(([n]) => n === h)) problems.push(`_headers "/*" does not send ${h}`);
    for (const p of ["/auth/*", "/sync"]) {
      if (!rules.some((r) => r.path === p && r.headers.some(([n, v]) => n === "Cache-Control" && v === "no-store"))) problems.push(`${p} is not no-store`);
    }
    if (!rules.some((r) => r.path === "/api/sync-config" && r.headers.some(([n, v]) => n === "Content-Type" && v.startsWith("application/json")))) {
      problems.push("/api/sync-config is not served as JSON");
    }
    const csp = new Set(rules.filter((r) => r.headers.some(([n]) => n === "Content-Security-Policy" || n === "Content-Security-Policy-Report-Only")).map((r) => r.path));
    if (existsSync(out)) {
      for (const page of htmlPages(out)) {
        if (page === "404.html" || page.startsWith("google")) continue;
        const route = "/" + page.replace(/\.html$/, "").replace(/(^|\/)index$/, "");
        const r = route === "/" ? "/" : route.replace(/\/$/, "");
        if (!csp.has(r)) problems.push(`${page} has no page Content-Security-Policy (scripts/write-csp.mjs)`);
      }
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = fileURLToPath(new URL("../out/", import.meta.url)).replace(/\/$/, "");
  const problems = checkSite(out, { cloud: process.argv.includes("--cloud") });
  if (problems.length) {
    console.error("verify-site: the built website is not ready to deploy:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  console.log("verify-site: every page, header and file is in place");
}
