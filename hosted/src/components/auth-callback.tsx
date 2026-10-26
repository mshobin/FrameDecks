"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { browserSupabase } from "@/lib/supabase-browser";

// The browser client finishes the sign-in from the link's code by itself (detectSessionInUrl).
export function AuthCallback() {
  const router = useRouter();
  const supabase = browserSupabase();
  const [failure, setFailure] = useState<string | null>(null);
  const problem = supabase ? failure : "Sign-in is not set up for this site yet.";

  useEffect(() => {
    if (!supabase) return;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const reported = query.get("error_description") ?? hash.get("error_description");
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session) router.replace("/");
      else setFailure(reported ?? error?.message ?? "This sign-in link has expired or was already used.");
    });
  }, [router, supabase]);

  if (!problem) {
    return (
      <p className="auth-message" role="status">
        One moment…
      </p>
    );
  }
  return (
    <>
      <p className="auth-error" role="alert">
        {problem}
      </p>
      <Link className="auth-link" href="/sign-in">
        Back to sign in
      </Link>
    </>
  );
}
