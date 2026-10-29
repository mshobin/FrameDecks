"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { takeReturn } from "@/lib/connect-link";
import { browserSupabase } from "@/lib/supabase-browser";
import { userSafeError } from "@/lib/user-error";

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
    // An empty error_description must still count as a failure, or the page waits forever.
    const errorCode = query.get("error") || hash.get("error");
    const hasReported =
      query.get("error_description") ||
      hash.get("error_description") ||
      errorCode;
    const slow = window.setTimeout(
      () => setFailure("Signing in is taking too long. Check your connection and try again."),
      20000,
    );
    supabase.auth.getSession().then(({ data, error }) => {
      window.clearTimeout(slow);
      if (data.session) {
        // Back to a PC's connect request if signing in started there (6.13); otherwise Home
        const back = takeReturn(localStorage);
        if (back) window.location.replace(back);
        else router.replace("/");
      }
      else if (hasReported) setFailure("Sign-in couldn’t be completed. Request a new link or choose another way to sign in.");
      else setFailure(userSafeError(error, "This sign-in link has expired or was already used. Request a new one."));
    });
    return () => window.clearTimeout(slow);
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
