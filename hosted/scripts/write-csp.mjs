// 9.3 (production audit M7): a Content-Security-Policy for every page of the built website, written into
// out/_headers (Cloudflare Pages) after `next build`. Each page's own inline scripts (Next.js puts the page data in
// them) are named by their SHA-256, so no other inline script runs; scripts otherwise come only from this site; the
// page talks only to this site, the FrameDecks cloud (Supabase) and FrameDecks' own update and download servers.
// 26.11.58 (release sign-off M7): enforced. The page may talk to this workspace's own Supabase project only (its address
// from NEXT_PUBLIC_SUPABASE_URL at build time; any *.supabase.co when the build has none).
// tests/visual/site-csp.mjs serves out/ with these headers and fails on any break.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const REPORT_ONLY = false;
export const HEADER = REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

/** The cloud the page may reach: this build's Supabase host, or any *.supabase.co when the build names none. */
export function cloudHost(url = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const h = new URL(url ?? "").host;
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(h) ? h : "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
}
export const BASE = [
  "default-src 'self'",
  `connect-src 'self' https://${cloudHost()} wss://${cloudHost()} https://api.framedecks.com https://downloads.framedecks.com`,
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** The inline scripts of one HTML page as CSP hash sources. */
export function inlineHashes(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .filter((m) => m[1].length)
    .map((m) => `'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`);
}

export function policyFor(html) {
  return `${BASE}; script-src 'self' ${[...new Set(inlineHashes(html))].join(" ")}`.trim();
}

/** The address a page answers at on Cloudflare Pages: out/a/b.html → /a/b, out/a/index.html → /a, out/index.html → / */
export function routeOf(file) {
  const r = "/" + file.replace(/\\/g, "/").replace(/\.html$/, "").replace(/(^|\/)index$/, "");
  return r === "/" ? "/" : r.replace(/\/$/, "");
}

function pages(dir, root = dir, list = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "_next") pages(p, root, list); continue; }
    if (f.endsWith(".html")) list.push(relative(root, p));
  }
  return list.sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = fileURLToPath(new URL("../out/", import.meta.url));
  const headersFile = join(out, "_headers");
  let text = readFileSync(headersFile, "utf8").replace(/\n# 9\.3 page policies[\s\S]*$/, "\n");
  const rules = [];
  for (const file of pages(out)) {
    if (file === "404.html" || file.startsWith("google")) continue;
    const policy = policyFor(readFileSync(join(out, file), "utf8"));
    if (policy.length > 1900) throw new Error(`${file}: the policy is ${policy.length} characters (Cloudflare allows 2,000 per line)`);
    const route = routeOf(file);
    rules.push(`${route}\n  ${HEADER}: ${policy}`);    // /a/ and /a.html redirect to /a on Cloudflare Pages
  }
  if (rules.length + (text.match(/^[^\s#]/gm) || []).length > 100) throw new Error("Cloudflare Pages allows 100 header rules");
  writeFileSync(headersFile, `${text.trimEnd()}\n# 9.3 page policies (scripts/write-csp.mjs)\n${rules.join("\n")}\n`);
  console.log(`write-csp: ${rules.length} page rules (${HEADER})`);
}
