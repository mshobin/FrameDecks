// 26.11.12 Scan to join on the website (migration 0018): codes tidied and shown the same way everywhere, read from the
// QR address's fragment and taken out of the address bar, a plain name for a new device, the 2- and 5-minute
// countdowns that make a fresh code by themselves, who may give which role, where a new device keeps its workspace,
// a QR encoder that matches the program's module for module, and the pages' wording and wiring.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  agoWords, allowUrl, anonymousOff, canRemove, clock, codeFromHash, codeProblem, deadlineFrom, formatCode, guessDeviceName,
  highestRole, isRecoveryCode, isShortCode, joinUrl, REFRESH_AT_SECONDS, ROLE_WORDS, rolesICanGive, secondsLeft, shouldRefresh,
  tidyCode,
} from "../src/lib/join-code.ts";
import { qrMatrix, qrPath, versionFor } from "../src/lib/qr.ts";
import { ASKED_KEY, TRUST_KEY, deviceStorage, keepInTabOnly, keepOnDevice, readTrust, storageChoice } from "../src/lib/trusted-device.ts";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

function mem() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test("codes are tidied like the database does, and shown in groups", () => {
  assert.equal(tidyCode(" k7pm-2xq9 "), "K7PM2XQ9");
  assert.equal(formatCode("k7pm2xq9"), "K7PM 2XQ9");
  assert.equal(formatCode("abcdefghjkmnpqrs"), "ABCD-EFGH-JKMN-PQRS");
  assert.ok(isShortCode("k7pm 2xq9"));
  assert.ok(!isShortCode("K7PM2XQ0"), "no 0 in the alphabet");
  assert.ok(!isShortCode("K7PM2XQ"), "8 characters");
  assert.ok(isRecoveryCode("ABCD-EFGH-JKMN-PQRS"));
  assert.ok(!isRecoveryCode("ABCD-EFGH-JKMN"));
});

test("a QR address carries the code in its fragment only", () => {
  assert.equal(codeFromHash("#c=k7pm2xq9"), "K7PM2XQ9");
  assert.equal(codeFromHash("#c=nope"), null);
  assert.equal(codeFromHash(""), null);
  assert.equal(joinUrl("https://framedecks.com/", "k7pm 2xq9"), "https://framedecks.com/join#c=K7PM2XQ9");
  assert.equal(allowUrl("https://framedecks.com", "K7PM2XQ9"), "https://framedecks.com/allow#c=K7PM2XQ9");
});

test("a new device gets a plain name from its browser", () => {
  assert.equal(guessDeviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Mobile Safari", 5), "iPhone");
  assert.equal(guessDeviceName("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Chrome/130 Mobile Safari/537", 5), "Android phone");
  assert.equal(guessDeviceName("Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit Chrome/130 Safari/537", 5), "Android tablet");
  assert.equal(guessDeviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit Chrome/130 Safari/537", 0), "Windows computer");
  assert.equal(guessDeviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Version/18 Safari/605", 0), "Mac");
  assert.equal(guessDeviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Version/18 Safari/605", 5), "iPad", "iPadOS says Mac");
  assert.equal(guessDeviceName("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit Chrome/130", 0), "Chromebook");
  assert.equal(guessDeviceName("", 0), "This device");
});

test("the countdown trusts the server's time only when it makes sense, and refreshes just before the end", () => {
  const now = 1_000_000;
  const at = (ms) => new Date(now + ms).toISOString();
  assert.equal(deadlineFrom(at(110_000), 120_000, now), now + 110_000);
  assert.equal(deadlineFrom(at(600_000), 120_000, now), now + 120_000, "a clock far behind: the full lifetime");
  assert.equal(deadlineFrom(at(-5_000), 120_000, now), now + 120_000, "a clock far ahead: the full lifetime");
  assert.equal(deadlineFrom(undefined, 300_000, now), now + 300_000);
  assert.equal(secondsLeft(now + 1_500, now), 2);
  assert.equal(secondsLeft(now - 1, now), 0);
  assert.equal(clock(105), "1:45");
  assert.equal(clock(300), "5:00");
  assert.ok(shouldRefresh(REFRESH_AT_SECONDS) && shouldRefresh(0) && !shouldRefresh(REFRESH_AT_SECONDS + 1));
  assert.equal(agoWords(2), "just now");
  assert.equal(agoWords(40), "40 seconds ago");
  assert.equal(agoWords(200), "3 minutes ago");
});

test("the owner adds Admins or Helpers, an admin only Helpers; removing follows the same rules", () => {
  assert.deepEqual(rolesICanGive("owner"), ["member", "admin"]);
  assert.deepEqual(rolesICanGive("admin"), ["member"]);
  assert.deepEqual(rolesICanGive("member"), []);
  assert.equal(highestRole("owner"), "admin");
  assert.equal(highestRole("admin"), "member");
  assert.equal(highestRole("member"), null);
  assert.deepEqual(ROLE_WORDS, { owner: "Owner", admin: "Admin", member: "Helper", pc: "PC" });
  const row = (kind, role, is_me = false) => ({ kind, role, is_me });
  assert.ok(canRemove("owner", row("person", "admin")));
  assert.ok(!canRemove("owner", row("person", "owner", true)), "the owner never removes itself");
  assert.ok(canRemove("admin", row("person", "member")));
  assert.ok(!canRemove("admin", row("person", "admin")));
  assert.ok(canRemove("member", row("person", "member", true)), "anyone removes themselves");
  assert.ok(!canRemove("member", row("person", "member")));
  assert.ok(canRemove("admin", row("pc", "pc")) && !canRemove("member", row("pc", "pc")));
});

test("problems in words: anonymous joining switched off, the Terms, too many wrong codes", () => {
  assert.ok(anonymousOff({ message: "Anonymous sign-ins are disabled", code: "anonymous_provider_disabled" }));
  assert.ok(anonymousOff({ message: "Anonymous sign-ins are disabled" }));
  assert.ok(!anonymousOff({ message: "Failed to fetch" }));
  assert.equal(codeProblem({ message: "Accept the Terms first", hint: "terms" }), "terms");
  assert.equal(codeProblem({ message: "Too many wrong codes; try again in an hour", code: "53400" }), "too-many");
  assert.equal(codeProblem({ message: "Not allowed", code: "42501" }), null);
  assert.match(src("lib/join-device.ts"), /\(FD-CLD-06\)/);
});

test("a new device starts in this tab; kept, it moves to the device; shared, it stays in the tab", () => {
  const KEY = "sb-abc-auth-token";
  assert.equal(storageChoice(true), "tab");
  assert.equal(storageChoice(false), "device");
  // kept: the anonymous session starts in the tab, trust_device moves it to the device
  let local = mem(), tab = mem();
  deviceStorage(local, tab).setItem(KEY, "session");
  assert.equal(tab.getItem(KEY), "session");
  keepOnDevice({ token: "t".repeat(64), id: "d1", name: "iPhone", expiresAt: "2027-05-01" }, local, tab);
  assert.equal(local.getItem(KEY), "session");
  assert.equal(tab.getItem(KEY), null);
  assert.equal(readTrust(local).name, "iPhone");
  assert.ok(local.getItem(TRUST_KEY));
  // shared: this tab only, and Trust This Device is not asked
  local = mem();
  tab = mem();
  keepInTabOnly(local, tab);
  deviceStorage(local, tab).setItem(KEY, "session");
  assert.equal(tab.getItem(ASKED_KEY), "1");
  assert.equal(tab.getItem(KEY), "session");
  assert.equal(local.getItem(KEY), null);
});

test("the QR encoder matches the program's (qrcode-generator) module for module", () => {
  const require = createRequire(import.meta.url);
  const reference = require("../../app/vendor/qrcode.js");
  const texts = [
    "hi",
    "https://framedecks.com/join#c=ABCD2345",
    "https://framedecks.com/allow#c=K7PM2XQ9",
    "https://preview-branch.framedecks.pages.dev/allow#c=K7PM2XQ9",
    "x".repeat(60),
    "y".repeat(120),
    "z".repeat(150),
    "q".repeat(213),
  ];
  const versions = new Set();
  for (const text of texts) {
    const version = versionFor(text.length);
    versions.add(version);
    const ref = reference(version, "M");
    ref.addData(text, "Byte");
    ref.make();
    const n = ref.getModuleCount();
    const same = [0, 1, 2, 3, 4, 5, 6, 7].some((mask) => {
      const m = qrMatrix(text, { mask, version });
      return m.length === n && m.every((row, y) => row.every((dark, x) => dark === ref.isDark(y, x)));
    });
    assert.ok(same, `${text.slice(0, 30)}… (version ${version})`);
  }
  assert.ok(versions.has(1) && versions.has(7) && versions.has(10), "small, with version bits, and the largest");
  assert.equal(versionFor(214), 0, "longer than a join address ever is");
  const m = qrMatrix("https://framedecks.com/join#c=ABCD2345");
  assert.equal(m.length, 29);
  assert.match(qrPath(m), /^M4 4h1v1h-1z/, "the quiet zone is 4 modules");
});

test("the pages: the code is looked at before any session, read from the fragment and taken out of the address", () => {
  const join = src("components/join-panel.tsx");
  assert.ok(join.indexOf('rpc("join_code_peek"') < join.indexOf("startDevice(supabase"), "peek first, sign in only on Join");
  assert.match(src("lib/join-device.ts"), /history\.replaceState\(/);
  for (const f of ["components/join-panel.tsx", "components/allow-panel.tsx"]) assert.match(src(f), /takeHashCode\(codeFromHash\)/, f);
  assert.match(src("lib/join-device.ts"), /signInAnonymously\(\)/);
  // the QR encoder is loaded only by the pages that show a code
  assert.match(src("components/join-code-card.tsx"), /import\("@\/lib\/qr"\)/);
  const srcDir = fileURLToPath(new URL("../src", import.meta.url));
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const f of files(srcDir).filter((f) => /\.(tsx?|mts)$/.test(f))) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, /from "@\/lib\/qr"/, `${path.relative(srcDir, f)} must load the QR encoder with import()`);
    if (/join|allow|devices-panel|workspace-sync-form/.test(f)) assert.doesNotMatch(text, /console\.(log|info|debug)\(/, `${f}: codes are never logged`);
  }
  // the old addresses keep working, and the menu says Devices
  assert.match(src("app/computers/page.tsx"), /<Forward to="\/devices"/);
  assert.match(src("app/sign-in/page.tsx"), /<MovedToSync \/>/);
  assert.match(src("components/workspace-sync-form.tsx"), /return intent === "save" \? "start" : "code";/);
  assert.match(src("components/app-shell.tsx"), /label: "Devices", href: "\/devices"/);
  for (const p of ["join", "allow"]) assert.match(src(`app/${p}/page.tsx`), new RegExp(`pageMetadata\\("[^"]+", "/${p}", \\{ private: true \\}\\)`), p);
});

test("the email also carries a code, and the screens use the agreed words", () => {
  const form = src("components/workspace-sync-form.tsx");
  assert.match(form, /verifyOtp\(\{ email: email\.trim\(\), token: digits, type: "email" \}\)/);
  for (const words of ["Open with your phone", "Email me a code", "Lost every device? Use your recovery code", "Start with email", "Sync → Allow a device"])
    assert.ok(form.includes(words), words);
  const devices = src("components/devices-panel.tsx");
  for (const words of ["Add a device", "Invite someone", "Make a recovery code", "Emergency email", "This device", "confirmationText: row.name"])
    assert.ok(devices.includes(words), words);
  assert.match(src("components/join-panel.tsx"), /This is a shared computer: forget me when I close this tab\./);
  assert.match(src("components/allow-panel.tsx"), /\(asked \{agoWords\(pending\.ageSeconds\)\}\)/);
});
