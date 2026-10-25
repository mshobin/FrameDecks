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
