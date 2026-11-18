// The website is served by Cloudflare Pages only (docs/deployment/cloudflare-pages.md): one deploy path (GitHub Actions
// with wrangler), every security header Vercel used to send, one rule per path in _headers, and no Vercel left.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { addToRule } from "../scripts/write-csp.mjs";
import { SECURITY, parseHeaders } from "../scripts/verify-site.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("no Vercel configuration is left", () => {
  assert.equal(existsSync(new URL("../vercel.json", import.meta.url)), false);
  assert.doesNotMatch(read("../package.json"), /vercel/i);
  assert.doesNotMatch(read("../../.github/workflows/hosted.yml"), /vercel/i);
});

test("every page sends the security headers, and the return and sync pages are never cached", () => {
  const rules = parseHeaders(read("../public/_headers"));
  const all = rules.find((r) => r.path === "/*");
  assert.deepEqual(all.headers.map(([n]) => n), SECURITY);
  assert.equal(Object.fromEntries(all.headers)["Strict-Transport-Security"], "max-age=31536000; includeSubDomains");
  assert.equal(Object.fromEntries(all.headers)["X-Frame-Options"], "DENY");
  for (const p of ["/auth/*", "/sync"]) assert.deepEqual(rules.find((r) => r.path === p).headers, [["Cache-Control", "no-store"]], p);
  assert.equal(new Set(rules.map((r) => r.path)).size, rules.length, "one rule per path (Cloudflare keeps only one)");
});

test("a page policy joins an existing rule instead of replacing it", () => {
  const text = "/sync\n  Cache-Control: no-store\n/*\n  X-Frame-Options: DENY\n";
  const out = addToRule(text, "/sync", "  Content-Security-Policy: default-src 'self'");
  assert.equal(out, "/sync\n  Cache-Control: no-store\n  Content-Security-Policy: default-src 'self'\n/*\n  X-Frame-Options: DENY\n");
  assert.equal(addToRule(text, "/help", "  X: y"), null);
  assert.deepEqual(parseHeaders(out).find((r) => r.path === "/sync").headers.map(([n]) => n), ["Cache-Control", "Content-Security-Policy"]);
});

test("GitHub Actions deploys the checked build to the framedecks Pages project", () => {
  const toml = read("../../infra/site/wrangler.toml");
  assert.match(toml, /^name = "framedecks"$/m);
  assert.match(toml, /^pages_build_output_dir = "\.\.\/\.\.\/hosted\/out"$/m);
  assert.doesNotMatch(toml, /\[\[(kv_namespaces|d1_databases|r2_buckets|durable_objects)/, "a static site needs no bindings");
  const wf = read("../../.github/workflows/hosted.yml");
  const deploy = wf.slice(wf.indexOf("\n  deploy:"));
  assert.match(deploy, /needs: checks/);
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'/);
  assert.match(deploy, /npx --yes wrangler@\d+\.\d+\.\d+ pages deploy --branch main/, "a pinned wrangler");
  assert.match(deploy, /verify-site\.mjs --cloud/);
  assert.match(deploy, /smoke-site\.mjs https:\/\/framedecks\.com/);
  assert.match(deploy, /set -o pipefail/);
  assert.match(deploy, /NEXT_PUBLIC_SUPABASE_ANON_KEY: \$\{\{ secrets\.SUPABASE_ANON_KEY \}\}/);
  assert.doesNotMatch(deploy, /service_role|SERVICE_ROLE/, "only the publishable key reaches the build");
});
