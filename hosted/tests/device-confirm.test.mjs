// 26.11.58 (release sign-off, migration 0029) on the website and in the device-sign-in server function: a code made by
// a church PC asks the account holder for the 6-digit code emailed to them before the phone is signed in (the address
// stays masked, wrong digits never use the code); a Terms tick that could not be saved is not lost; /connect says
// whether the PC asked from this browser's network; members without admin rights see no one else's email; a refused
// request from a removed Trusted Device ends the session at once.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { isUntrustedAnswer } from "../src/lib/trusted-device.ts";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const fn = readFileSync(new URL("../supabase/functions/device-sign-in/index.ts", import.meta.url), "utf8");

test("the server function checks the emailed digits before it uses a PC's code, and never sends the full address", () => {
  const second = fn.slice(fn.indexOf("if (otp) {"), fn.indexOf('admin.rpc("device_code_redeem"'));
  assert.ok(second.length > 200, "the step with the 6 digits");
  const look = second.indexOf('rpc("device_code_confirm_email"');
  const verify = second.indexOf("verifyOtp({ email: look.data.email, token: otp, type: \"email\" })");
  const wrong = second.indexOf("otp_ok: false");
  const use = second.indexOf("otp_ok: true");
  assert.ok(look >= 0 && verify > look && wrong > verify && use > wrong, "look up, check the digits, count a wrong try, then use the code");
  assert.match(second, /SUPABASE_ANON_KEY/, "the digits are checked like a person's email code");
  assert.match(second, /signOut\(session\.access_token/, "a session for a code that could not be used is ended, not handed out");
  assert.match(second, /accessToken: session\.access_token,\s+refreshToken: session\.refresh_token/);
  assert.match(fn, /signInWithOtp\(\{ email: data\.email, options: \{ shouldCreateUser: false \} \}\)/);
  assert.match(fn, /answer\(\{ status: "confirm", who: data\.who, sent \}\)/);
  for (const m of fn.matchAll(/answer\(\{([^)]*)\}/g)) assert.doesNotMatch(m[1], /email/, `no address in ${m[1]}`);
  // a code made on the website keeps the one-step magic link
  assert.match(fn, /generateLink\(\{ type: "magiclink", email: data\.email \}\)/);
});

test("the website asks for the emailed code and finishes with the session it gets back", () => {
  const quick = src("lib/quick-sign-in.ts");
  assert.match(quick, /body: otp \? \{ code, device, otp \} : \{ code, device \}/);
  assert.match(quick, /answer\.status === "confirm"\) return \{ confirm:/);
  assert.match(quick, /setSession\(\{ access_token: answer\.accessToken, refresh_token: answer\.refreshToken \}\)/);
  assert.match(quick, /"otp-used-up": "Too many wrong codes from the email\./);
  assert.match(quick, /That code doesn’t match the one in the email\./);
  const join = src("components/join-panel.tsx");
  assert.match(join, /We emailed a 6-digit code to <strong>\{confirm\.who/);
  assert.match(join, /to confirm it’s you\./);
  assert.match(join, /<CodeBoxes value=\{otp\}/);
  assert.ok(join.includes("Confirm and open") && join.includes("Send a new code"));
  assert.match(join, /confirms with a code from email/, "the steps show the extra step for a PC's code");
  assert.match(join, /signInWithCode\(supabase, code, deviceName, confirm && !again \? digits : undefined\)/);
  assert.match(join, /done\.confirm\) setConfirm\(done\.confirm\)/);
  assert.match(join, /await openAs\(done\.organizationId\)/);
});

test("a Terms tick that could not be saved is tried again, then kept for the Terms screen; a database without it is fine", () => {
  const join = src("components/join-panel.tsx");
  assert.doesNotMatch(join, /accept_terms[^;]*\.then\(\(\) => undefined, \(\) => undefined\)/, "no longer swallowed");
  const record = join.slice(join.indexOf("async function recordTerms"), join.indexOf("export function JoinPanel"));
  assert.match(record, /for \(let i = 0; i < 2; i\+\+\)/);
  assert.match(record, /if \(!error \|\| legalNotSetUp\(error\)\) return;/);
  assert.match(record, /rememberAcceptance\(localStorage\)/);
  assert.match(join, /if \(needTerms && agreed\) await recordTerms\(supabase\);/);
  assert.match(src("components/legal-gate.tsx"), /takeAcceptance\(localStorage\)/, "the Terms screen records a kept tick");
});

test("/connect shows how long ago and whether the PC asked from this browser's network", () => {
  const panel = src("components/connect-panel.tsx");
  assert.match(panel, /sameNetwork\?: boolean \| null/);
  assert.match(panel, /from the same network as this browser/);
  assert.match(panel, /peek\.sameNetwork === false/);
  assert.match(panel, /This request came from a different network than this browser\./);
  assert.match(panel, /Asked \$\{ago\(peek\.ageSeconds\)\}/);
});

test("members without admin rights see no one else's email, and nothing breaks", () => {
  const members = src("components/workspace-members.tsx");
  assert.match(members, /email: string \| null/);
  assert.match(members, /const who = \(m: Member\) => m\.display_name \?\? m\.email \?\? "A team member";/);
  assert.match(members, /member\.display_name && member\.email && <span>/);
  assert.match(members, /m\.email\?\.toLowerCase\(\)/);
  assert.match(src("components/frame-history.tsx"), /if \(name\) names\.people\[p\.user_id\] = name;/);
});

test("a refused request from a removed Trusted Device ends the session at once", () => {
  assert.ok(isUntrustedAnswer(403, '{"code":"42501","message":"This device is no longer trusted. Sync Workspace again."}'));
  assert.ok(isUntrustedAnswer(401, "This device is no longer trusted."));
  assert.ok(!isUntrustedAnswer(403, '{"message":"permission denied for table x"}'));
  assert.ok(!isUntrustedAnswer(200, "no longer trusted"));
  const browser = src("lib/supabase-browser.ts");
  assert.match(browser, /global: \{ fetch: guardedFetch \}/);
  assert.match(browser, /isUntrustedAnswer\(response\.status, body\) && leaveUntrusted\("revoked"\)/);
  assert.match(browser, /clearLocalSession\(localStorage\);\s+clearLocalSession\(sessionStorage\);/);
  assert.match(src("components/trusted-device.tsx"), /leaveUntrusted\(status\)/);
});

test("the new words stay within the website's wording rules", () => {
  for (const f of ["components/join-panel.tsx", "components/connect-panel.tsx", "components/workspace-members.tsx"]) {
    assert.doesNotMatch(src(f), /Sign in|Sign up|Account|Password/, f);
  }
});
