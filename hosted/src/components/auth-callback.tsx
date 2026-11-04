"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { takeReturn } from "@/lib/connect-link";
import { browserSupabase } from "@/lib/supabase-browser";
import { userSafeError } from "@/lib/user-error";

export const FIRST_WORKSPACE_NAME = "My Workspace";

/** 9.8 After the link: the person's workspace is opened, or made for them when they have none and nobody invited them
 * (the same insert as Home's "Name your team"; the database makes them its owner; it can be renamed any time). */
export async function ensureWorkspace(supabase: SupabaseClient, userId: string): Promise<void> {
  const mine = await supabase.from("memberships").select("organization_id", { count: "exact", head: true }).eq("user_id", userId);
  if (mine.error || (mine.count ?? 0) > 0) return;
  const invited = await supabase.rpc("my_invitations");
  if (!invited.error && Array.isArray(invited.data) && invited.data.length > 0) return;   // they will join a team instead
  await supabase.from("organizations").insert({ name: FIRST_WORKSPACE_NAME, created_by: userId });
}

// The browser client finishes the link's one-time code by itself (detectSessionInUrl, PKCE).
export function AuthCallback() {
  const router = useRouter();
  const supabase = browserSupabase();
  const [failure, setFailure] = useState<string | null>(null);
  const problem = supabase ? failure : "Workspace sync is not set up for this site yet.";

  useEffect(() => {
    if (!supabase) return;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    // An empty error_description must still count as a failure, or the page waits forever.
    const errorCode = query.get("error") || hash.get("error");
    const hasReported = query.get("error_description") || hash.get("error_description") || errorCode;
    const slow = window.setTimeout(() => setFailure("Opening your workspace is taking too long. Check your connection and try again."), 20000);
    supabase.auth.getSession().then(async ({ data, error }) => {
      window.clearTimeout(slow);
      if (data.session) {
        // the security log: this link was used (once per session); before migration 0015 this does nothing
        await supabase.rpc("magic_link_used").then(() => undefined, () => undefined);
        await ensureWorkspace(supabase, data.session.user.id).catch(() => undefined);
        // Back to a PC's connect request if it started there (6.13); otherwise Home, which offers Trust This Device
        const back = takeReturn(localStorage);
        if (back) window.location.replace(back);
        else router.replace("/");
      } else if (hasReported) setFailure("This link couldn’t open your workspace. Ask for a new one.");
      else setFailure(userSafeError(error, "This link has expired or was already used. Links work once, for 10 minutes. Ask for a new one."));
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
      <Link className="auth-link" href="/sync">
        Back to Sync Workspace
      </Link>
    </>
  );
}
