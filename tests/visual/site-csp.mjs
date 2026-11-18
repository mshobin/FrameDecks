// 9.3 the website's Content-Security-Policy (production audit M7). Build the website first
// (cd hosted && NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=stub npm run build),
// then: node tests/visual/site-csp.mjs
// Serves hosted/out with the page policies scripts/write-csp.mjs wrote into out/_headers, opens every page and fails
// on any rule a page breaks (the browser reports each break as an event; 26.11.58 the policy is enforced).
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const OUT = new URL("../../hosted/out/", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".json": "application/json", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };

// the page rules: "/route" then "  Header: value"
const policies = {};
const lines = readFileSync(join(OUT, "_headers"), "utf8").split("\n");
if (!lines.some((l) => l.startsWith("# 9.3 page policies"))) throw new Error("out/_headers has no page policies: run node hosted/scripts/write-csp.mjs after the build");
// every rule's page policy (a page whose path already had a rule, such as /sync, has its policy inside that rule)
for (let i = 0, route = ""; i < lines.length; i++) {
  if (lines[i].startsWith("/")) route = lines[i];
  else if (route && /^\s+Content-Security-Policy(-Report-Only)?: (?!frame-ancestors 'none'$)/.test(lines[i])) {
    const [name, ...rest] = lines[i].trim().split(": ");
    policies[route] = [name, rest.join(": ")];
  }
}

const srv = createServer((q, r) => {
  const route = decodeURIComponent(q.url.split("?")[0]).replace(/\/$/, "") || "/";
  let f = join(OUT, route);
  if (existsSync(f) && statSync(f).isDirectory()) f = existsSync(f + ".html") ? f + ".html" : join(f, "index.html");
  else if (!existsSync(f) && existsSync(f + ".html")) f = f + ".html";
  if (!existsSync(f)) return (r.writeHead(404), r.end());
  const headers = { "content-type": TYPES[extname(f)] || "application/octet-stream" };
  if (policies[route]) headers[policies[route][0]] = policies[route][1];
  r.writeHead(200, headers);
  r.end(readFileSync(f));
}).listen(8932);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
// 26.11.58: every outside request is answered here (the cloud with {}, FrameDecks' servers and anything else with
// nothing), so the check is the same on a CI runner with the internet as on a machine without it. A request the policy
// blocks never gets this far: the browser reports it first.
await ctx.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 204, body: "" }));
await ctx.addInitScript(() => {
  window.__csp = [];
  document.addEventListener("securitypolicyviolation", (e) =>
    window.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || "(inline)"} ${e.sample ? `"${e.sample.slice(0, 60)}"` : ""}`));
});
const found = [];
const routes = Object.keys(policies);
for (const route of routes) {
  const p = await ctx.newPage();
  let res = null;
  try {
    res = await p.goto(`http://127.0.0.1:8932${route}`, { waitUntil: "load", timeout: 20000 });
    await p.waitForTimeout(800);
  } catch (e) {
    found.push(`${route}: did not load (${String(e.message).split("\n")[0]})`);
  }
  if (res && !res.headers()["content-security-policy-report-only"] && !res.headers()["content-security-policy"]) found.push(`${route}: no policy`);
  await p.mouse.wheel(0, 4000);                       // the landing's reveal effects and lazy parts
  await p.waitForTimeout(500);
  for (const v of await p.evaluate(() => window.__csp)) found.push(`${route}: ${v}`);
  await p.close();
}
await browser.close();
srv.close();
if (found.length) {
  console.error(`Website Content-Security-Policy: ${found.length} break(s)\n  ` + [...new Set(found)].join("\n  "));
  process.exit(1);
}
console.log(`Website Content-Security-Policy: ${routes.length} pages, no rule broken`);
