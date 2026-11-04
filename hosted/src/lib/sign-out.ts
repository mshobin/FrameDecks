// FrameDecks 8.6 - disconnecting this device, the same everywhere: end the session, clear what this browser keeps of
// it (9.8: in this tab and on the device), then go to framedecks.com. When the server cannot be reached the session is
// still cleared here (it then simply expires on the server), so a device is never left connected because the internet
// dropped.
import type { SupabaseClient } from "@supabase/supabase-js";

export const SIGNED_OUT_URL = "https://framedecks.com";

/** Forget every Supabase session this browser keeps (the `sb-…` entries). */
export function clearLocalSession(store: Pick<Storage, "length" | "key" | "removeItem"> | null | undefined): number {
  if (!store) return 0;
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && /^sb-.*-auth-token/.test(k)) keys.push(k);
  }
  keys.forEach((k) => store.removeItem(k));
  return keys.length;
}

/** Disconnect and leave. Answers an error message only when this browser could not be disconnected at all. */
export async function signOutAndLeave(
  supabase: SupabaseClient | null,
  go: (url: string) => void = (url) => window.location.assign(url),
): Promise<string | null> {
  let cleared = false;
  if (supabase) {
    try {
      const { error } = await supabase.auth.signOut();
      cleared = !error;
      if (error) cleared = !(await supabase.auth.signOut({ scope: "local" })).error;
    } catch {
      try {
        cleared = !(await supabase.auth.signOut({ scope: "local" })).error;
      } catch {
        cleared = false;
      }
    }
  }
  try {
    const here = clearLocalSession(typeof localStorage === "undefined" ? null : localStorage);
    const tab = clearLocalSession(typeof sessionStorage === "undefined" ? null : sessionStorage);
    if (here + tab > 0 || !supabase) cleared = true;
  } catch {
    /* storage blocked: rely on the sign-out above */
  }
  if (!cleared) return "Couldn’t disconnect this device. Check your internet connection and try again.";
  go(SIGNED_OUT_URL);
  return null;
}
