import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clearLocalSession } from "@/lib/sign-out";
import { publicSupabaseEnv, readSupabaseConfig } from "@/lib/supabase-config";
import { clearTrust, deviceStorage, isUntrustedAnswer } from "@/lib/trusted-device";

let client: SupabaseClient | null | undefined;
let leaving = false;

/** 26.11.58 (release sign-off L12): this device is no longer trusted (removed, or 180 days old): forget its token and
 * every session kept here, then go to Open Workspace. Used by the device check and by any refused request. */
export function leaveUntrusted(reason: "revoked" | "expired") {
  if (leaving || typeof window === "undefined") return;
  leaving = true;
  clearTrust();
  try {
    clearLocalSession(localStorage);
    clearLocalSession(sessionStorage);
  } catch {
    /* storage blocked */
  }
  window.location.replace(`/sync?reason=${reason}`);
}

/** 26.11.58 (L12): every request the client makes; a refusal saying the device is no longer trusted ends the session
 * here at once (the refresh token with it), not only at the next device check. Nothing else is changed or read. */
const guardedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401 || response.status === 403) {
    response
      .clone()
      .text()
      .then((body) => isUntrustedAnswer(response.status, body) && leaveUntrusted("revoked"))
      .catch(() => undefined);
  }
  return response;
};

// One browser client per page; null when the project is not configured.
export function browserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = readSupabaseConfig(publicSupabaseEnv());
  client = config
    ? createClient(config.url, config.anonKey, {
        // 9.8 the session stays in this tab until the device is trusted (lib/trusted-device.ts)
        auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true, storage: deviceStorage() },
        global: { fetch: guardedFetch },
      })
    : null;
  return client;
}

export function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}
