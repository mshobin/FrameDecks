// 9.8 Trusted Devices in the browser: the session stays in this tab until the device is trusted, the PKCE verifier
// always survives a new tab, earlier sessions are kept until decided, and the wording never says Sign in or Account.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  TRUST_KEY, clearTrust, deviceName, deviceStorage, isLegacyKeep, markDecided, moveSession, readTrust, statusMessage, writeTrust,
} from "../src/lib/trusted-device.ts";

function mem() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    has: (k) => m.has(k),
  };
}
const KEY = "sb-abc-auth-token";
const token = "t".repeat(64);

test("a new browser keeps the session in this tab only; the PKCE verifier always on the device", () => {
  const local = mem(), tab = mem(), s = deviceStorage(local, tab);
  s.setItem(KEY, "session");
  assert.equal(tab.getItem(KEY), "session");
  assert.equal(local.getItem(KEY), null);
  s.setItem(`${KEY}-code-verifier`, "v");
  assert.equal(local.getItem(`${KEY}-code-verifier`), "v", "the emailed link may open in a new tab");
  assert.equal(s.getItem(KEY), "session");
});

test("Trust This Device moves the session to the device; removing trust ends it there", () => {
  const local = mem(), tab = mem(), s = deviceStorage(local, tab);
  s.setItem(KEY, "session");
  writeTrust({ token, id: "d1", name: "Chrome on Windows", expiresAt: "2027-05-01" }, local);
  moveSession(true, local, tab);
  assert.equal(local.getItem(KEY), "session");
  assert.equal(tab.getItem(KEY), null);
  assert.equal(s.getItem(KEY), "session");
  assert.equal(readTrust(local).id, "d1");
  assert.ok(!JSON.parse(local.getItem(TRUST_KEY)).hash, "no hash is kept here, only the token");
  clearTrust(local);
  assert.equal(readTrust(local), null);
  s.removeItem(KEY);
  assert.equal(local.getItem(KEY), null);
});

test("a session kept by an earlier version stays until the person decides", () => {
  const local = mem(), tab = mem();
  local.setItem(KEY, "old session");
  assert.equal(isLegacyKeep(local), true);
  assert.equal(deviceStorage(local, tab).getItem(KEY), "old session");
  markDecided(local);                                // "Just this visit"
  moveSession(false, local, tab);
  assert.equal(tab.getItem(KEY), "old session");
  assert.equal(local.getItem(KEY), null);
  assert.equal(deviceStorage(local, tab).getItem(KEY), "old session", "this tab keeps it");
});

test("device names and messages", () => {
  assert.equal(deviceName("Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/130 Safari/537"), "Chrome on Windows");
  assert.equal(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18) AppleWebKit Version/18 Mobile Safari/604"), "Safari on iPhone");
  assert.match(statusMessage("revoked"), /removed/);
  assert.match(statusMessage("expired"), /180 days/);
  assert.equal(statusMessage("trusted"), null);
});

test("the website never says Sign In, Sign Up, Account or Password to people", () => {
  const src = fileURLToPath(new URL("../src", import.meta.url));
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const banned = /\b(sign[ -]?in|sign[ -]?up|accounts?|passwords?)\b/i;
  const found = [];
  for (const f of files(src).filter((f) => /\.tsx$/.test(f))) {
    const code = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")               // comments
      .replace(/(className|id|htmlFor|href|aria-labelledby|key)=("[^"]*"|\{[^}]*\})/g, "")  // identifiers and addresses
      .replace(/import [^;]+;/g, "");
    for (const m of code.matchAll(/>([^<>{}]+)<|"([^"\n]{3,})"|“([^”]+)”|`([^`]{3,})`/g)) {
      const text = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
      if (/^[a-z0-9_./@:-]+$/i.test(text.trim())) continue;                                  // bare identifiers
      if (/[;=()]|=>|\n\s*\n/.test(text)) continue;                                           // code, not words
      if (banned.test(text)) found.push(`${path.relative(src, f)}: ${text.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(found, []);
});
