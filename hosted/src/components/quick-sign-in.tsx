"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";

import { takeReturn } from "@/lib/connect-link";
import { PROVIDER_NAMES, authFeatures, type AuthFeatures } from "@/lib/quick-sign-in";
import { browserSupabase, callbackUrl } from "@/lib/supabase-browser";

function useFeatures(): AuthFeatures | null {
  const [f, setF] = useState<AuthFeatures | null>(null);
  useEffect(() => {
    let live = true;
    void authFeatures().then((x) => live && setF(x));
    return () => {
      live = false;
    };
  }, []);
  return f;
}

/** 26.11.26 Open Workspace: a passkey (Face ID, a fingerprint, Windows Hello) and Google, Apple or Microsoft, when this
 * site has them switched on. Nothing shows otherwise. */
export function QuickSignIn() {
  const f = useFeatures();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const supabase = browserSupabase();
  if (!supabase || !f || (!f.passkeys && !f.providers.length)) return null;

  async function passkey() {
    setBusy(true);
    setProblem(null);
    const { error } = await supabase!.auth.signInWithPasskey();
    if (error) {
      setBusy(false);
      setProblem(/cancel|abort|NotAllowed/i.test(error.message) ? null : "No passkey for FrameDecks on this device yet. Use another way in, then save one.");
      return;
    }
    window.location.replace(takeReturn(localStorage) ?? "/");
  }

  return (
    <div className="jc-quick">
      {f.passkeys && (
        <button type="button" className="fd-btn fd-btn-primary jc-quick-key" disabled={busy} onClick={passkey}>
          <Fingerprint aria-hidden="true" size={18} /> {busy ? "Opening…" : "Open with a passkey"}
        </button>
      )}
      {f.providers.map((p) => (
        <button
          key={p}
          type="button"
          className="fd-btn fd-btn-ghost"
          onClick={() => void supabase.auth.signInWithOAuth({ provider: p, options: { redirectTo: callbackUrl() } })}
        >
          Continue with {PROVIDER_NAMES[p]}
        </button>
      ))}
      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
