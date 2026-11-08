// FrameDecks 26.11.12 - Scan to join: bringing a new device in without an email (migration 0018). The device becomes a
// Supabase anonymous user only once a code has been checked, so a wrong code never makes one. Where its session lives
// follows lib/trusted-device.ts: this tab first; then, unless it is a shared computer, trust_device keeps it on the
// device so it appears in Devices at once and can be removed from there.
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonymousOff } from "@/lib/join-code";
import { keepInTabOnly, keepOnDevice, readTrust } from "@/lib/trusted-device";
import { userSafeError } from "@/lib/user-error";

const WORKSPACE_KEY = "framedecks-workspace"; // lib/use-workspaces.ts: the team this device looks at

/** Joining by code is not switched on (Supabase: Allow anonymous sign-ins), in words, with its error code. */
export const ANONYMOUS_OFF =
  "Joining with a code isn’t switched on for this site yet. Ask your workspace owner to finish setting it up, or use an email code instead. (FD-CLD-06)";

/** Signs this browser in as a new device when it has no session yet. Answers a message when that failed. */
export async function startDevice(supabase: SupabaseClient, shared: boolean): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return null;
  if (shared) keepInTabOnly();
  const { error } = await supabase.auth.signInAnonymously();
  if (!error) return null;
  if (anonymousOff(error)) return ANONYMOUS_OFF;
  return userSafeError(error, "Couldn’t set up this device. Check your connection and try again.");
}

/** After joining: keep a new device like a Trusted Device (`keep`: not a shared computer; a browser that already had a
 * session keeps its earlier choice), look at the team it joined, and go to Home. */
export async function finishDevice(supabase: SupabaseClient, name: string, keep: boolean, organizationId?: string | null) {
  if (keep && !readTrust()) {
    const { data, error } = await supabase.rpc("trust_device", { device_name: name });
    if (!error && data?.token) keepOnDevice({ token: data.token, id: data.id, name, expiresAt: data.expires_at });
  }
  if (organizationId) {
    try {
      localStorage.setItem(WORKSPACE_KEY, organizationId);
    } catch {
      /* storage blocked: Home shows the first team */
    }
  }
  window.location.replace("/");
}

/** Reads the code from a QR address (#c=…) once and takes it out of the address bar and the history. */
export function takeHashCode(read: (hash: string) => string | null): string | null {
  if (typeof window === "undefined") return null;
  const code = read(window.location.hash);
  if (window.location.hash) {
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      /* an old browser: the code ends with the tab */
    }
  }
  return code;
}
