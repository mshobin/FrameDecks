import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
// A plain file (not app/manifest.ts) so the companion builds as static files (docs/architecture/hosting.md).
const manifest = readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8");

test("service worker never handles non-GET, cross-origin, api or auth traffic", () => {
  assert.match(sw, /request\.method !== "GET"/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /"\/api\/"/);
  assert.match(sw, /"\/auth\/"/);
});

test("manifest is installable", () => {
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /"start_url": "\/"/);
  assert.match(manifest, /framedecks-emblem\.webp/);
});
