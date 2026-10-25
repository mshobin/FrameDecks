"use client";

import Link from "next/link";

import { browserSupabase } from "@/lib/supabase-browser";
import { useSession } from "@/lib/use-session";

export function AccountStatus() {
  const supabase = browserSupabase();
  const session = useSession();

  if (!supabase || session === undefined) return null;
  if (!session) {
    return (
      <Link className="account-chip" href="/sign-in">
        Sign in
      </Link>
    );
  }
  return (
    <span className="account-chip account-chip-signed-in">
      <span className="account-email">{session.user.email}</span>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </span>
  );
}
