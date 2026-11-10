// 26.11.38 The email code is the main way in: the address shown back hidden, six boxes, an unknown email answered like a
// sent code and never making a team (only Start with email does), whose computer this is (new browsers start as someone
// else's: this tab only), the person told when their workspace opens somewhere, and Sign out other computers.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { CODE_LENGTH, codeDigits, defaultWhose, maskEmail, noWorkspaceYet, rememberMine } from "../src/lib/email-code.ts";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test("the address is shown back hidden, and a code is six digits from whatever was pasted", () => {
  assert.equal(maskEmail("mary@gmail.com"), "m•••@gmail.com");
  assert.equal(maskEmail("jo@x.org"), "j•@x.org");
  assert.equal(maskEmail(" a@b.co "), "a•@b.co");
  assert.equal(maskEmail("not-an-email"), "not-an-email");
  assert.equal(CODE_LENGTH, 6);
  assert.equal(codeDigits("Your code: 482 913"), "482913");
  assert.equal(codeDigits("48-29-13-77"), "482913");
  assert.equal(codeDigits("abc"), "");
});

test("an email with no workspace is answered like a sent code", () => {
  assert.equal(noWorkspaceYet({ message: "Signups not allowed for otp", status: 422 }), true);
  assert.equal(noWorkspaceYet({ code: "otp_disabled", message: "x" }), true);
  assert.equal(noWorkspaceYet({ message: "Email rate limit exceeded" }), false);
  assert.equal(noWorkspaceYet(null), false);
  const form = src("components/workspace-sync-form.tsx");
  assert.match(form, /shouldCreateUser: starting/, "only Start with email makes a team");
  assert.match(form, /if \(error && !noWorkspaceYet\(error\)\)/);
  assert.match(form, /If \{maskEmail\(email\)\} opens a workspace, a 6-digit code is on its way/);
});

test("a browser that never opened FrameDecks is someone else's; Mine is remembered", () => {
  const s = mem();
  assert.equal(defaultWhose(s), "theirs");
  rememberMine(s);
  assert.equal(defaultWhose(s), "mine");
  assert.equal(defaultWhose({ getItem: () => { throw new Error("blocked"); } }), "theirs");
  const form = src("components/workspace-sync-form.tsx");
  assert.match(form, /Whose computer is this\?/);
  assert.match(form, /if \(whose === "theirs"\) keepInTabOnly\(\);/);
  assert.ok(form.indexOf('keepInTabOnly();') < form.indexOf("verifyOtp("), "this tab only, before the session starts");
  assert.match(form, /rpc\("trust_device", \{ device_name: name \}\)/);
});

test("six boxes take a pasted or autofilled code and open by themselves", () => {
  const boxes = src("components/code-boxes.tsx");
  assert.match(boxes, /autoComplete="one-time-code"/);
  assert.match(boxes, /inputMode="numeric"/);
  assert.match(boxes, /if \(digits\.length === CODE_LENGTH\) onComplete\(digits\)/);
  const form = src("components/workspace-sync-form.tsx");
  assert.match(form, /<CodeBoxes /);
  assert.match(form, /verifyOtp\(\{ email: email\.trim\(\), token: digits, type: "email" \}\)/);
  assert.match(form, /Send a new code in \$\{wait\}s/);
  assert.match(form, /<ConnectSteps steps=\{steps\} team=\{opened\}/);
});

test("the person hears when their workspace opens somewhere, and can sign the others out", () => {
  const form = src("components/workspace-sync-form.tsx");
  assert.match(form, /rpc\("email_sign_in", \{ device_name: name, shared: whose === "theirs" \}\)/);
  const fn = readFileSync(new URL("../supabase/functions/device-alert/index.ts", import.meta.url), "utf8");
  assert.match(fn, /if \(a\.kind === "signin"\)/);
  assert.match(fn, /Sign out other computers/);
  const devices = src("components/devices-panel.tsx");
  assert.match(devices, /signOut\(\{ scope: "others" \}\)/);
  assert.match(devices, /Sign out other computers/);
});

test("the email carries only the code (no link for a work mail scanner to use up)", () => {
  const html = readFileSync(new URL("../supabase/setup/email-code.html", import.meta.url), "utf8");
  assert.match(html, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(html, /ConfirmationURL|href=/);
});
