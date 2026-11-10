"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Fingerprint, Mail } from "lucide-react";

import { authFeatures } from "@/lib/quick-sign-in";
import { browserSupabase, callbackUrl } from "@/lib/supabase-browser";
import { useSession } from "@/lib/use-session";

const ASKED = "fd-passkey"; // "saved" or "later": the passkey offer shows once per device
const EMAIL_LATER = "fd-email-later";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return "later"; // storage unavailable: don't keep asking
  }
}
function remember(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* not remembered: asked again next time */
  }
}

/** 26.11.37 Keep your workspace safe, once, after a device first opens it: add an email (a phone that joined by scanning
 * has none, so it could not get new-device emails or get back in by email) and save a passkey, so next time is one
 * touch. A device joined by scanning saves its passkey after the email is confirmed. */
export function PasskeyPrompt() {
  const session = useSession();
  const [passkeys, setPasskeys] = useState(false);
  const [askedKey, setAskedKey] = useState<string | null>("later");
  const [emailLater, setEmailLater] = useState<string | null>("later");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void authFeatures().then((f) => setPasskeys(f.passkeys));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAskedKey(read(ASKED));
    setEmailLater(read(EMAIL_LATER));
  }, [session]);
  if (!session) return null;
  const needEmail = !session.user.email && !emailLater;
  const wantKey = passkeys && !askedKey && !session.user.is_anonymous;
  if (!needEmail && !wantKey) return null;

  async function save() {
    setBusy(true);
    const { error } = await browserSupabase()!.auth.registerPasskey();
    setBusy(false);
    if (!error) {
      remember(ASKED, "saved");
      setAskedKey("saved");
    }
  }
  async function addEmail(e: FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setProblem("Type an email address like name@church.org.");
      return;
    }
    setBusy(true);
    setProblem(null);
    const { error } = await browserSupabase()!.auth.updateUser({ email: email.trim() }, { emailRedirectTo: callbackUrl() });
    setBusy(false);
    if (error) setProblem("Couldn’t send the email. Check the address and try again.");
    else setSent(true);
  }
  const later = () => {
    if (needEmail) {
      remember(EMAIL_LATER, "1");
      setEmailLater("1");
    }
    if (wantKey) {
      remember(ASKED, "later");
      setAskedKey("later");
    }
  };

  return (
    <section className="fd-trust" aria-labelledby="fd-passkey-title">
      {needEmail ? <Mail aria-hidden="true" size={22} className="fd-trust-icon" /> : <Fingerprint aria-hidden="true" size={22} className="fd-trust-icon" />}
      <div className="fd-trust-text">
        <h2 id="fd-passkey-title">{needEmail ? "Keep your workspace safe" : "Open your workspace with one touch next time?"}</h2>
        {needEmail ? (
          sent ? (
            <p role="status">Check {email.trim()}: open the link in that email to confirm. Then save a passkey here.</p>
          ) : (
            <>
              <p>Add your email: it gets you back in if every device is lost, and tells you when a new PC or phone joins your team.</p>
              <form className="fd-trust-email" onSubmit={addEmail}>
                <label className="sr-only" htmlFor="fd-trust-mail">
                  Your email
                </label>
                <input id="fd-trust-mail" type="email" autoComplete="email" placeholder="name@church.org" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button type="submit" className="fd-btn fd-btn-primary" disabled={busy}>
                  {busy ? "Sending…" : "Add my email"}
                </button>
              </form>
              {problem && (
                <p className="auth-error" role="alert">
                  {problem}
                </p>
              )}
            </>
          )
        ) : (
          <p>Save a passkey: Face ID, a fingerprint or Windows Hello opens your workspace. No email, no code, nothing to remember.</p>
        )}
      </div>
      <div className="fd-trust-actions">
        {!needEmail && (
          <button type="button" className="fd-btn fd-btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save a passkey"}
          </button>
        )}
        <button type="button" className="fd-btn fd-btn-ghost" onClick={later}>
          Not now
        </button>
      </div>
    </section>
  );
}
