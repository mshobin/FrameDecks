"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { browserSupabase } from "@/lib/supabase-browser";

export function AccountStatus() {
  const supabase = browserSupabase();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase) return null;
  if (!email) {
    return (
      <Link className="account-chip" href="/sign-in">
        Sign in
      </Link>
    );
  }
  return (
    <span className="account-chip account-chip-signed-in">
      <span className="account-email">{email}</span>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </span>
  );
}
