import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../src", import.meta.url));
const read = (rel) => readFileSync(path.join(src, rel), "utf8");

function allSources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? allSources(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

test("the sign-in return page lives under /auth/, which the service worker never caches", () => {
  assert.ok(existsSync(path.join(src, "app/auth/callback/page.tsx")));
  assert.match(read("lib/supabase-browser.ts"), /\/auth\/callback/);
});

test("browser code reads each public Supabase value by its full name, so Next.js inlines it", () => {
  const config = read("lib/supabase-config.ts");
  assert.match(config, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(config, /process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(read("lib/supabase-browser.ts"), /readSupabaseConfig\(publicSupabaseEnv\(\)\)/);
});

test("sign-in uses PKCE and never a service-role key", () => {
  assert.match(read("lib/supabase-browser.ts"), /flowType: "pkce"/);
  for (const file of allSources(src)) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /service_role|SERVICE_ROLE|sb_secret_/i, file);
  }
});

test("the desktop's config route serves only the two public values", () => {
  const route = read("app/api/sync-config/route.ts");
  assert.match(route, /readSupabaseConfig\(\)/);
  assert.match(route, /\{ url: config\.url, anonKey: config\.anonKey \}/);
  assert.doesNotMatch(route, /process\.env/);
  assert.ok(route.split("Response.json(").length === 3, "one error answer and one config answer");
});
