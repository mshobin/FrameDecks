// 26.11.37 Opening the workspace: the phone is the key (Open with your phone first), the passkey button only on a browser
// that saved one, the PC's "Open in this PC's browser" opens without a click (#c=…&go=1), a phone that joined is asked
// once for an email and a passkey, Connect this PC is not offered once a PC is connected, and the steps are drawn as an
// animated flowchart that connects into a picture of the workspace.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("the flowchart ticks each step and lights up the workspace", () => {
  const steps = src("components/connect-steps.tsx");
  assert.match(steps, /export type StepState = "done" \| "now" \| "next"/);
  assert.match(steps, /aria-current=\{state === "now" \? "step" : undefined\}/);
  assert.match(steps, /className=\{team \? "cs cs-in" : "cs"\}/);
  assert.match(steps, /\(prefers-reduced-motion: reduce\)/);
  const css = src("app/join.css");
  const motion = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
  for (const k of ["cs-tick", "cs-ping"]) assert.ok(motion.includes(`animation:${k}`) || motion.includes(`animation: ${k}`), k);
  assert.doesNotMatch(css, /cs-ping[^;]*infinite/, "the ring rests after a few pulses");
  for (const f of ["components/workspace-sync-form.tsx", "components/join-panel.tsx"]) {
    assert.match(src(f), /<ConnectSteps\s/, f);
    assert.match(src(f), /await settle\(\)/, f);
  }
});

test("the passkey shows only where one is saved; the phone is under Other ways in (26.11.38: the email code first)", () => {
  const form = src("components/workspace-sync-form.tsx");
  assert.ok(form.includes("Open with your phone"));
  assert.ok(form.indexOf("<WorkspaceSyncForm intent=\"sync\"") < form.indexOf("<OpenWithPhone />"), "the email code first, the phone after");
  assert.ok(form.indexOf("<WorkspaceSyncForm intent=\"sync\"") < form.indexOf("<QuickSignIn quiet />"));
  const quick = src("components/quick-sign-in.tsx");
  assert.match(quick, /const SAVED = "fd-passkey"/);
  assert.match(quick, /saved === null \|\| saved === quiet\) return null/);
  assert.match(quick, /localStorage\.setItem\(SAVED, "saved"\)/);
});

test("a phone that joined is asked once for an email and a passkey", () => {
  const p = src("components/passkey-prompt.tsx");
  assert.ok(p.includes("Keep your workspace safe"));
  assert.match(p, /updateUser\(\{ email: email\.trim\(\) \}, \{ emailRedirectTo: callbackUrl\(\) \}\)/);
  assert.match(p, /const EMAIL_LATER = "fd-email-later"/);
  assert.ok(p.includes("Not now"));
});

test("the PC's own browser opens without a click, and Connect this PC goes once a PC is connected", () => {
  const join = src("components/join-panel.tsx");
  assert.match(join, /go=1/);
  assert.match(join, /p\?\.status === "self"\) window\.setTimeout\(\(\) => document\.getElementById\("jc-join-go"\)\?\.click\(\), 60\)/);
  const pc = src("components/pc-setup-card.tsx");
  assert.match(pc, /rpc\("workspace_devices", \{ org \}\)/);
  assert.match(pc, /org && !linked && /);
  assert.ok(pc.includes("is connected to this team."));
});
