// 26.11.58 (release sign-off items 2-6, migration 0028): room and prayer codes have 8 characters (6-character codes of
// rooms opened before still read); a closed prayer wall answers instead of failing; only the owner is offered Admin
// when inviting, and admins are offered Remove only for members; the website's security policy is enforced and names
// this build's own cloud.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { BASE, HEADER, cloudHost } from "../scripts/write-csp.mjs";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("8-character codes are read, and 6-character ones still are", () => {
  // prayer-code.ts imports through the "@/" alias, so its pattern is read from the source (tidyCode is tested elsewhere)
  const room = new RegExp(src("lib/prayer-code.ts").match(/const ROOM = \/(.+)\/;/)[1]);
  assert.equal(room.test("K7PM2XQ4"), true);
  assert.equal(room.test("K7PM2X"), true);
  assert.equal(room.test("K7PM2XQ"), false, "seven is neither");
  assert.equal(room.test("K7PM2XQ40"), false);
  assert.equal(room.test("K7PM2XO4"), false, "no O");
});

test("a closed prayer wall says so", () => {
  assert.match(src("components/join-panel.tsx"), /\?\.sent === false\) \{\n\s+setProblem\("This prayer wall is closed\."\)/);
  assert.match(src("components/join-panel.tsx"), /Meeting codes have 8 letters/);
});

test("only the owner adds or removes admins on the Members page", () => {
  const m = src("components/workspace-members.tsx");
  assert.match(m, /\{myRole === "owner" && <option value="admin">Admin<\/option>\}/);
  assert.match(m, /isMe \|\| myRole === "owner" \|\| \(canManage && member\.role === "member"\)/);
});

test("the website's security policy is enforced and names this build's cloud", () => {
  assert.equal(HEADER, "Content-Security-Policy");
  assert.equal(cloudHost("https://abcd.supabase.co"), "abcd.supabase.co");
  assert.equal(cloudHost(undefined), "*.supabase.co");
  assert.equal(cloudHost("not a url"), "*.supabase.co");
  assert.match(BASE, /connect-src 'self' https:\/\/\S+ wss:\/\/\S+ https:\/\/api\.framedecks\.com/);
});
