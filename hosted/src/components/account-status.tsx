"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";

import { signOutAndLeave } from "@/lib/sign-out";
import { clearTrust, readTrust } from "@/lib/trusted-device";
import { browserSupabase } from "@/lib/supabase-browser";
import { useSession } from "@/lib/use-session";

export function initialsOf(text: string): string {
  const parts = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}

export function AccountStatus() {
  const supabase = browserSupabase();
  const session = useSession();
  const [leaving, setLeaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!supabase || session === undefined) return null;
  if (!session) {
    return (
      <Link className="fd-account fd-account-in" href="/sync">
        Sync Workspace
      </Link>
    );
  }
  const email = session.user.email ?? "";
  return (
    <span className="fd-account">
      <Link className="fd-account-link" href="/account" title="Your workspace: profile and teams">
        <span className="fd-avatar" aria-hidden="true">
          {initialsOf(String(session.user.user_metadata?.full_name ?? email))}
        </span>
        <span className="fd-account-email">{email}</span>
      </Link>
      <button
        type="button"
        aria-label={leaving ? "Disconnecting…" : "Disconnect this device"}
        title={problem ?? "Disconnect this device"}
        disabled={leaving}
        onClick={async () => {
          setLeaving(true);
          setProblem(null);
          // a Trusted Device stops being trusted when it disconnects (Manage Devices no longer lists it)
          const trust = readTrust();
          if (trust) {
            await supabase.rpc("device_revoke", { device: trust.id }).then(() => undefined, () => undefined);
            clearTrust();
          }
          const err = await signOutAndLeave(supabase);
          if (err) {
            setProblem(err);
            setLeaving(false);
          }
        }}
      >
        {leaving ? <LoaderCircle aria-hidden="true" size={15} className="fd-spin" /> : <LogOut aria-hidden="true" size={15} />}
      </button>
      {problem && (
        <span className="fd-account-problem" role="alert">
          {problem}
        </span>
      )}
    </span>
  );
}
