"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TERMS_VERSION, legalNotSetUp, takeAcceptance } from "@/lib/legal";
import { signOutAndLeave } from "@/lib/sign-out";
import { browserSupabase } from "@/lib/supabase-browser";
import { useSession } from "@/lib/use-session";
import { userSafeError } from "@/lib/user-error";

// Signed-in pages show their content only once the current Terms of Service and Privacy Policy are accepted (7.0).
// Someone who ticked the box when creating their account has it recorded here without asking again; anyone else
// (an existing account, a new version of the terms) sees this one screen once. Until 0011_accounts_legal.sql is
// run, nothing is blocked.
type State = "checking" | "ok" | "ask";

export function LegalGate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = browserSupabase();
  const session = useSession();
  const [state, setState] = useState<State>("checking");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || session === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("ok"); // signed-out pages handle themselves
      return;
    }
    if (!session) return;
    let live = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("terms_version")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!live) return;
      if (legalNotSetUp(error)) return setState("ok");
      if (!error && data?.terms_version === TERMS_VERSION)
        return setState("ok");
      if (takeAcceptance(localStorage)) {
        const r = await supabase.rpc("accept_terms", {
          version: TERMS_VERSION,
        });
        if (live) setState(r.error && !legalNotSetUp(r.error) ? "ask" : "ok");
        return;
      }
      setState("ask");
    })();
    return () => {
      live = false;
    };
  }, [supabase, session]);

  async function accept() {
    if (!supabase || !agreed) return;
    setBusy(true);
    setProblem(null);
    const { error } = await supabase.rpc("accept_terms", {
      version: TERMS_VERSION,
    });
    setBusy(false);
    if (error && !legalNotSetUp(error))
      setProblem(
        userSafeError(
          error,
          "Couldn’t save that. Check your connection and try again.",
        ),
      );
    else setState("ok");
  }

  if (state === "ok") return <>{children}</>;
  if (state === "checking") return null;
  return (
    <section className="fd-gate" aria-labelledby="fd-gate-title">
      <p className="fd-kicker">Before you continue</p>
      <h1 id="fd-gate-title">Our Terms and Privacy Policy</h1>
      <p>
        FrameDecks now has <Link href="/terms">Terms of Service</Link> and an
        updated <Link href="/privacy">Privacy Policy</Link>. They explain what
        you can expect from us, what is kept about you and your workspace, and
        how to export or delete it. Nothing about how FrameDecks works for you
        changes.
      </p>
      <label className="auth-agree">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>I agree to the Terms of Service and the Privacy Policy.</span>
      </label>
      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
      <div className="fd-gate-actions">
        <Button
          className="auth-primary"
          type="button"
          disabled={!agreed || busy}
          onClick={accept}
        >
          {busy ? "Saving…" : "Continue"}
        </Button>
        <button
          type="button"
          className="fd-link"
          onClick={() =>
            void signOutAndLeave(supabase)
          }
        >
          Disconnect this device instead
        </button>
      </div>
    </section>
  );
}
