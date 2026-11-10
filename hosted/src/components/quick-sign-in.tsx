"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";

import { takeReturn } from "@/lib/connect-link";
import { authFeatures, type AuthFeatures } from "@/lib/quick-sign-in";
import { browserSupabase } from "@/lib/supabase-browser";

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

const SAVED = "fd-passkey"; // "saved": this browser holds a FrameDecks passkey (components/passkey-prompt.tsx)

function savedHere(): boolean {
  try {
    return localStorage.getItem(SAVED) === "saved";
  } catch {
    return false;
  }
}

/** 26.11.26 Open Workspace: a passkey (Face ID, a fingerprint, Windows Hello), when this site has passkeys switched on.
 * 26.11.37 The passkey button shows only on a browser that saved one (no empty "Choose a passkey" box elsewhere);
 * `quiet` is the small "Use a passkey" link under Other ways in, for a browser that has not. */
export function QuickSignIn({ quiet = false }: Readonly<{ quiet?: boolean }>) {
  const f = useFeatures();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSaved(savedHere()), []);
  const supabase = browserSupabase();
  if (!supabase || !f || !f.passkeys || saved === null || saved === quiet) return null;

  async function passkey() {
    setBusy(true);
    setProblem(null);
    const { error } = await supabase!.auth.signInWithPasskey();
    if (error) {
      setBusy(false);
      setProblem(/cancel|abort|NotAllowed/i.test(error.message) ? null : "No passkey for FrameDecks on this device yet. Use another way in, then save one.");
      return;
    }
    try {
      localStorage.setItem(SAVED, "saved");
    } catch {
      /* not remembered: the link stays under Other ways in */
    }
    window.location.replace(takeReturn(localStorage) ?? "/");
  }

  if (quiet) {
    return (
      <>
        <button type="button" className="fd-link" disabled={busy} onClick={passkey}>
          {busy ? "Opening…" : "Use a passkey"}
        </button>
        {problem && (
          <p className="auth-error" role="alert">
            {problem}
          </p>
        )}
      </>
    );
  }
  return (
    <div className="jc-quick">
      <button type="button" className="fd-btn fd-btn-primary jc-quick-key" disabled={busy} onClick={passkey}>
        <Fingerprint aria-hidden="true" size={18} /> {busy ? "Opening…" : "Open with a passkey"}
      </button>
      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
