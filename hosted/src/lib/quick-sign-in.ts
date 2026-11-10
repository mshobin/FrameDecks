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

const NOT_SET_UP = "Opening by scanning isn’t set up for this site yet. Use an email code instead, or ask the workspace owner. (FD-CLD-07)";
const ANSWERS: Record<string, string> = {
  wrong: "That code doesn’t match. Scan the code on the other screen again. (FD-CLD-01)",
  expired: "This code has run out. Codes last 2 minutes and work once: show a fresh one and scan again.",
  "too-many": "Too many wrong codes from this network. Wait an hour, then try again.",
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

/** Add a device: turns the scanned code into this browser's session. Answers a message when it failed. */
export async function signInWithCode(
  supabase: SupabaseClient,
  code: string,
  device: string,
): Promise<{ organizationId?: string; problem?: string }> {
  const { data, error } = await supabase.functions.invoke("device-sign-in", { body: { code, device } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    return { problem: status === 404 || error.name === "FunctionsRelayError" ? NOT_SET_UP : "Couldn’t open your workspace. Check your connection and try again." };
  }
  const answer = data as { status: string; tokenHash?: string; organizationId?: string };
  if (answer.status !== "ok" || !answer.tokenHash) return { problem: ANSWERS[answer.status] ?? NOT_SET_UP };
  const { error: otp } = await supabase.auth.verifyOtp({ token_hash: answer.tokenHash, type: "magiclink" });
  return otp ? { problem: "Couldn’t open your workspace. Scan a fresh code and try again." } : { organizationId: answer.organizationId };
}

/** Connect this PC: a 2-minute grant for the program, opened through its framedecks:// link. */
export async function connectThisPc(supabase: SupabaseClient, org: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("pc_grant_create", { org });
  if (error || !data?.code) return error?.message?.includes("owners and admins") ? "Only owners and admins can connect a PC." : "Couldn’t make a code. Try again.";
  window.location.href = `framedecks://connect?grant=${encodeURIComponent(data.code)}`;
  return null;
}
