// framedecks.com is the one authoritative address (docs/deployment/cloudflare-domains.md): canonical links, robots.txt
// and the sitemap use it, signed-in pages stay out of search results, and the Pages address is never indexed.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const files = (dir) =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

test("the canonical address is framedecks.com", () => {
  assert.match(read("lib/site.ts"), /"https:\/\/framedecks\.com"/);
  assert.match(read("app/layout.tsx"), /metadataBase: new URL\(SITE_URL\)/);
  assert.match(read("app/robots.ts"), /sitemap: `\$\{SITE_URL\}\/sitemap\.xml`/);
  assert.match(read("app/sitemap.ts"), /\$\{SITE_URL\}/);
});

test("no other domain is written into the website", () => {
  for (const f of files(root)) {
    if (!/\.(tsx?|css|json)$/.test(f)) continue;
    assert.doesNotMatch(readFileSync(f, "utf8"), /framedecks\.app|framedecks\.pages\.dev|vercel\.app/, f);
  }
});

test("every page has its own title, link-preview title and address; signed-in pages are noindex", () => {
  assert.match(read("app/page.tsx"), /canonical: "\/"/);
  assert.match(read("app/page.tsx"), /openGraph: \{ title: "FrameDecks · Prepare with Purpose\. Present with Excellence\.", url: "\/" \}/);
  // the layout must not give every page the home page's preview title and address
  assert.doesNotMatch(read("app/layout.tsx"), /openGraph: \{[^}]*\b(title|url):/);
  for (const p of ["help", "privacy", "sign-in"]) {
    assert.match(read(`app/${p}/page.tsx`), new RegExp(`pageMetadata\\("[^"]+", "/${p}"\\)`), p);
  }
  for (const p of ["account", "branding", "computers", "live", "meeting", "members", "plan", "services", "auth/callback"]) {
    assert.match(read(`app/${p}/page.tsx`), new RegExp(`pageMetadata\\("[^"]+", "/${p}", \\{ private: true \\}\\)`), p);
  }
  assert.match(read("lib/site.ts"), /openGraph: \{ title: `\$\{title\} \| FrameDecks`, url: path \}/);
});

test("the Pages address is never indexed", () => {
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  assert.match(headers, /https:\/\/:project\.pages\.dev\/\*\n {2}X-Robots-Tag: noindex/);
});
