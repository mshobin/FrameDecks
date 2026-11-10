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

// 26.11.36: a passkey first, an email code as the fallback; no Google, Apple or Microsoft sign-in anywhere on the site
test("the website opens workspaces with a passkey or an email code, never through Google, Apple or Microsoft", () => {
  for (const file of allSources(src).filter((f) => /\.(ts|tsx)$/.test(f))) {
    const code = readFileSync(file, "utf8");
    assert.doesNotMatch(code, /signInWithOAuth|linkIdentity|PROVIDER_NAMES|provider:\s*["'](google|apple|azure)|Continue with (Google|Apple|Microsoft)/, file);
  }
  const quick = read("components/quick-sign-in.tsx");
  assert.match(quick, /signInWithPasskey/);
  assert.match(quick, /Open with a passkey/);
  assert.match(read("components/workspace-sync-form.tsx"), /Email me a code/);
  assert.doesNotMatch(read("lib/quick-sign-in.ts"), /providers|external/);
});

test("the desktop's config file holds only the two public values", async () => {
  const { syncConfig } = await import("../scripts/write-sync-config.mjs");
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "pk", SUPABASE_SERVICE_ROLE_KEY: "secret" };
  assert.deepEqual(syncConfig(env), { url: "https://x.supabase.co", anonKey: "pk" });
  assert.deepEqual(Object.keys(syncConfig({ NEXT_PUBLIC_SUPABASE_URL: "http://x", NEXT_PUBLIC_SUPABASE_ANON_KEY: "pk" })), ["error"]);
  assert.deepEqual(Object.keys(syncConfig({})), ["error"]);
  assert.doesNotMatch(readFileSync(new URL("../scripts/write-sync-config.mjs", import.meta.url), "utf8"), /SERVICE_ROLE|service_role|sb_secret_/);
});
