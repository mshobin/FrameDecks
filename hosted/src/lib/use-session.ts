"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { browserSupabase } from "@/lib/supabase-browser";

// undefined while the stored session is still being read; null when signed out.
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
}

/** 26.11.12 whether this browser already had a session when the page opened (null while reading). A session that the
 * page itself starts (Scan to join) does not change the answer. */
export function useSessionAtArrival(session: Session | null | undefined): boolean | null {
  const [arrived, setArrived] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session !== undefined && arrived === null) setArrived(!!session);
  }, [session, arrived]);
  return arrived;
}
