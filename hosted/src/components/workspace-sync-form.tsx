"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { rememberAcceptance } from "@/lib/legal";
import { browserSupabase, callbackUrl } from "@/lib/supabase-browser";
import { statusMessage, type DeviceStatus } from "@/lib/trusted-device";
import { userSafeError } from "@/lib/user-error";
import { takeReturn } from "@/lib/connect-link";
import { useSession } from "@/lib/use-session";

/** 9.8 the three ways in, one form: an emailed one-time link (10 minutes, once), no password and nothing to remember.
 * Open my workspace (9.11, was Sync Workspace): your workspace on this device. Start a new one (was Save Workspace):
 * start keeping your plans (asks for the Terms once).
 * Continue on Another Device: the same workspace on a phone, tablet or second computer. */
export type SyncIntent = "sync" | "save" | "continue";

const INTENTS: Record<SyncIntent, { tab: string; title: string; lede: string; button: string }> = {
  sync: {
    tab: "Open my workspace",
    title: "Open your workspace.",
    lede: "Enter your email. We send a one-time link that opens your workspace on this device.",
    button: "Email me a link",
  },
  save: {
    tab: "Start a new one",
    title: "Start a free workspace.",
    lede: "Keep your meetings, Frames and people safe in a workspace you can open anywhere. Free, and nothing to remember.",
    button: "Email me a link to start it",
  },
  continue: {
    tab: "Continue on Another Device",
    title: "Continue on this device.",
    lede: "Using FrameDecks somewhere else already? Enter the same email and open the link here.",
    button: "Email me a link for this device",
  },
};

export function readIntent(search: string, hash: string): SyncIntent {
  const q = new URLSearchParams(search);
  const v = q.get("intent") || (hash === "#new" || q.has("new") ? "save" : "");
  return v === "save" || v === "continue" ? v : "sync";
}

export function WorkspaceSyncChooser() {
  const [intent, setIntent] = useState<SyncIntent>("sync");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const session = useSession();
  const returning = !!session && !/[?&]reason=/.test(typeof window === "undefined" ? "" : window.location.search);
  useEffect(() => {
    // 9.11.1 already signed in on this browser: no email form, straight to Home (or back to a PC's connect request)
    if (returning) window.location.replace(takeReturn(localStorage) ?? "/");
  }, [returning]);
  useEffect(() => {
    // The address is only known in the browser (static export), so the choice is read after the first render.
    const q = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIntent(readIntent(window.location.search, window.location.hash));
    const pre = q.get("email");
    if (pre && /^[^@\s]+@[^@\s]+$/.test(pre)) setEmail(pre);
    const reason = q.get("reason");
    if (reason === "revoked" || reason === "expired") setNotice(statusMessage(reason as DeviceStatus));
  }, []);
  const text = INTENTS[intent];
  if (returning) {
    return (
      <p className="auth-message" role="status">
        Opening your workspace…
      </p>
    );
  }
  return (
    <>
      <div className="auth-modes" role="tablist" aria-label="Your workspace">
        {(Object.keys(INTENTS) as SyncIntent[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={intent === k} onClick={() => setIntent(k)}>
            {INTENTS[k].tab}
          </button>
        ))}
      </div>
      <h1 className="fd-auth-title">{text.title}</h1>
      <p className="auth-lede">{text.lede}</p>
      {notice && (
        <p className="auth-message" role="status">
          {notice}
        </p>
      )}
      <WorkspaceSyncForm key={intent} intent={intent} initialEmail={email} />
    </>
  );
}

type Status = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string };

export function WorkspaceSyncForm({ intent = "sync", initialEmail = "" }: Readonly<{ intent?: SyncIntent; initialEmail?: string }>) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [agreed, setAgreed] = useState(false);
  const supabase = browserSupabase();
  // Saving a new workspace needs an explicit tick for the Terms and the Privacy Policy (7.0); it is recorded once the
  // workspace is open (components/legal-gate.tsx). Syncing an existing workspace does not ask here.
  const starting = intent === "save";
  const blocked = starting && !agreed;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  if (!supabase) {
    return (
      <p className="auth-message" role="status">
        Workspace sync is not set up for this site yet. The rest of FrameDecks works without it.
      </p>
    );
  }

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || blocked) return;
    const address = email.trim();
    if (starting) rememberAcceptance(localStorage);
    setStatus({ kind: "sending" });
    // The security log notes the request (the address only as a hash) and limits how often one address or network can
    // ask; before migration 0015 the function is missing and the link is sent anyway.
    const logged = await supabase.rpc("magic_link_requested", { email: address });
    if (logged.error && /Too many/i.test(logged.error.message)) {
      setStatus({ kind: "error", message: "Too many links asked for. Wait a few minutes and try again." });
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true },
    });
    setStatus(error ? { kind: "error", message: userSafeError(error, "Couldn’t send the link. Check your email address and try again.") } : { kind: "sent" });
  }

  if (status.kind === "sent") {
    return (
      <div className="auth-message" role="status">
        <p>
          Check your inbox. We sent a one-time link to <strong>{email.trim()}</strong>. Open it on this device within 10
          minutes; it works once. Nothing there? Look in Spam or Promotions.
        </p>
        <button type="button" className="fd-link" onClick={() => setStatus({ kind: "idle" })}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      {starting && (
        <label className="auth-agree">
          <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I agree to the <Link href="/terms">Terms of Service</Link> and the <Link href="/privacy">Privacy Policy</Link>.
          </span>
        </label>
      )}
      <form className="auth-form" onSubmit={sendLink}>
        <label htmlFor="email">Email address</label>
        <span className="auth-hint">Nothing to remember: the link opens your workspace. It works once, for 10 minutes.</span>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.org"
        />
        <Button className="auth-primary" disabled={status.kind === "sending" || blocked} type="submit">
          {status.kind === "sending" ? "Sending…" : INTENTS[intent].button}
        </Button>
      </form>
      {status.kind === "error" && (
        <p className="auth-error" role="alert">
          {status.message}
        </p>
      )}
    </>
  );
}
