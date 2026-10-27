"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { browserSupabase } from "@/lib/supabase-browser";
import { useSession } from "@/lib/use-session";

export function initialsOf(text: string): string {
  const parts = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}

export function AccountStatus() {
  const supabase = browserSupabase();
  const session = useSession();

  if (!supabase || session === undefined) return null;
  if (!session) {
    return (
      <Link className="fd-account fd-account-in" href="/sign-in">
        Sign in
      </Link>
    );
  }
  const email = session.user.email ?? "";
  return (
    <span className="fd-account">
      <Link className="fd-account-link" href="/account" title="Your account: profile and teams">
        <span className="fd-avatar" aria-hidden="true">
          {initialsOf(String(session.user.user_metadata?.full_name ?? email))}
        </span>
        <span className="fd-account-email">{email}</span>
      </Link>
      <button type="button" aria-label="Sign out" title="Sign out" onClick={() => supabase.auth.signOut()}>
        <LogOut aria-hidden="true" size={15} />
      </button>
    </span>
  );
}
