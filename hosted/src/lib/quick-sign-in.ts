// FrameDecks 26.11.26 - getting in without typing (docs/architecture/passwordless.md).
//  - A phone that scanned Add a device is signed in as that person: the server function device-sign-in (Supabase Edge
//    Functions, service key) uses the code once and hands back a one-time sign-in the phone turns into its session.
//  - Connect this PC: a one-time grant handed to the program through its framedecks:// link; the program asks first.
//  - Passkeys (Face ID, a fingerprint, Windows Hello): shown only when switched on in Supabase (its public settings
//    say so), so the button never leads to an error page. 26.11.36: passkey first, an email code as the fallback; no
//    other sign-in companies.
import type { SupabaseClient } from "@supabase/supabase-js";

import { publicSupabaseEnv, readSupabaseConfig } from "@/lib/supabase-config";

export type AuthFeatures = { passkeys: boolean };

const NOT_SET_UP = "Opening by scanning isn’t set up for this site yet. Use an email code, or ask the workspace owner. (FD-CLD-07)";
const ANSWERS: Record<string, string> = {
  wrong: "That code doesn’t match. Scan the code on the other screen again. (FD-CLD-01)",
  expired: "This code has run out. Codes last 2 minutes and work once: show a fresh one and scan again.",
  "too-many": "Too many wrong codes from this network. Wait an hour, then try again.",
  "otp-used-up": "Too many wrong codes from the email. Show a fresh code on the PC and scan it again.", // 26.11.58 (H2)
};

let features: Promise<AuthFeatures> | null = null;

/** Whether this site has passkeys switched on (Supabase Auth's public settings), asked once per page. */
export function authFeatures(): Promise<AuthFeatures> {
  if (features) return features;
  const config = readSupabaseConfig(publicSupabaseEnv());
  features = !config
    ? Promise.resolve({ passkeys: false })
    : fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.anonKey } })
        .then((r) => (r.ok ? r.json() : {}))
        .then((s: { passkeys_enabled?: boolean }) => ({
          passkeys: !!s.passkeys_enabled && typeof window !== "undefined" && "PublicKeyCredential" in window,
        }))
        .catch(() => ({ passkeys: false }));
  return features;
}

/** Add a device: turns the scanned code into this browser's session. Answers a message when it failed.
 * 26.11.58 (release sign-off H2): a code made by a church PC first answers `confirm` with the account holder's masked
 * address; they get a 6-digit code by email, and calling again with it (otp) signs this browser in. */
export async function signInWithCode(
  supabase: SupabaseClient,
  code: string,
  device: string,
  otp?: string,
): Promise<{ organizationId?: string; problem?: string; confirm?: { who: string | null; sent: boolean } }> {
  const { data, error } = await supabase.functions.invoke("device-sign-in", { body: otp ? { code, device, otp } : { code, device } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    return { problem: status === 404 || error.name === "FunctionsRelayError" ? NOT_SET_UP : "Couldn’t open your workspace. Check your connection and try again." };
  }
  const answer = data as { status: string; tokenHash?: string; accessToken?: string; refreshToken?: string; organizationId?: string; who?: string | null; sent?: boolean; left?: number };
  if (answer.status === "confirm") return { confirm: { who: answer.who ?? null, sent: answer.sent !== false } };
  if (answer.status === "otp-wrong") return { problem: otpWrong(answer.left) };
  if (answer.status === "ok" && answer.accessToken && answer.refreshToken) {
    const { error: set } = await supabase.auth.setSession({ access_token: answer.accessToken, refresh_token: answer.refreshToken });
    return set ? { problem: "Couldn’t open your workspace. Scan a fresh code and try again." } : { organizationId: answer.organizationId };
  }
  if (answer.status !== "ok" || !answer.tokenHash) return { problem: ANSWERS[answer.status] ?? NOT_SET_UP };
  const { error: link } = await supabase.auth.verifyOtp({ token_hash: answer.tokenHash, type: "magiclink" });
  return link ? { problem: "Couldn’t open your workspace. Scan a fresh code and try again." } : { organizationId: answer.organizationId };
}

/** 26.11.58 (H2): wrong digits from the email; the scanned code still works until the fifth wrong try. */
export function otpWrong(left?: number): string {
  const tries = left ? ` ${left} ${left === 1 ? "try" : "tries"} left.` : "";
  return `That code doesn’t match the one in the email.${tries} Check the 6 digits and try again.`;
}

/** Connect this PC: a 2-minute grant for the program, opened through its framedecks:// link. */
export async function connectThisPc(supabase: SupabaseClient, org: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("pc_grant_create", { org });
  if (error || !data?.code) return error?.message?.includes("owners and admins") ? "Only owners and admins can connect a PC." : "Couldn’t make a code. Try again.";
  window.location.href = `framedecks://connect?grant=${encodeURIComponent(data.code)}`;
  return null;
}
