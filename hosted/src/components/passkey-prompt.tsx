"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";

import { authFeatures } from "@/lib/quick-sign-in";
import { browserSupabase } from "@/lib/supabase-browser";
import { readTrust } from "@/lib/trusted-device";
import { useSession } from "@/lib/use-session";

const ASKED = "fd-passkey"; // "saved" or "later": the offer shows once per device

/** After this device is trusted: offer a passkey once, so next time Open Workspace is one touch. */
export function PasskeyPrompt() {
  const session = useSession();
  const [passkeys, setPasskeys] = useState(false);
  const [asked, setAsked] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void authFeatures().then((f) => setPasskeys(f.passkeys));
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAsked(!!localStorage.getItem(ASKED) || !readTrust());
    } catch {
      setAsked(true);
    }
  }, [session]);
  if (asked || !passkeys || !session || session.user.is_anonymous) return null;

  const decide = (v: string) => {
    try {
      localStorage.setItem(ASKED, v);
    } catch {
      /* not remembered: asked again next time */
    }
    setAsked(true);
  };
  async function save() {
    setBusy(true);
    const { error } = await browserSupabase()!.auth.registerPasskey();
    setBusy(false);
    if (!error) decide("saved"); // cancelled or not possible here: the offer stays for another try
  }
  return (
    <section className="fd-trust" aria-labelledby="fd-passkey-title">
      <Fingerprint aria-hidden="true" size={22} className="fd-trust-icon" />
      <div className="fd-trust-text">
        <h2 id="fd-passkey-title">Open your workspace with one touch next time?</h2>
        <p>Save a passkey: Face ID, a fingerprint or Windows Hello opens your workspace. No email, no code, nothing to remember.</p>
      </div>
      <div className="fd-trust-actions">
        <button type="button" className="fd-btn fd-btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save a passkey"}
        </button>
        <button type="button" className="fd-btn fd-btn-ghost" onClick={() => decide("later")}>
          Not now
        </button>
      </div>
    </section>
  );
}
