"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { browserSupabase, callbackUrl, enabledProviders, type SignInProvider } from "@/lib/supabase-browser";

const providerLabels: Record<SignInProvider, string> = {
  google: "Continue with Google",
  azure: "Continue with Microsoft",
};

type Status = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string };

/** Sign in, or start (owner-approved, 27 October): a first visit is greeted as new, not "welcome back". The same
 * emailed link or Google / Microsoft account does both; Home then walks a new person through three steps. */
export function SignInChooser() {
  const [mode, setMode] = useState<"in" | "new">("in");
  useEffect(() => {
    // The address is only known in the browser (static export), so the choice is read after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.location.hash === "#new" || new URLSearchParams(window.location.search).has("new")) setMode("new");
  }, []);
  return (
    <>
      <div className="auth-modes" role="tablist" aria-label="Sign in or start">
        <button type="button" role="tab" aria-selected={mode === "in"} onClick={() => setMode("in")}>
          Sign in
        </button>
        <button type="button" role="tab" aria-selected={mode === "new"} onClick={() => setMode("new")}>
          New here?
        </button>
      </div>
      {mode === "in" ? (
        <>
          <h1 className="fd-auth-title">Welcome back.</h1>
          <p className="auth-lede">Use the same email or account as last time.</p>
        </>
      ) : (
        <>
          <h1 className="fd-auth-title">Start your church&apos;s space.</h1>
          <p className="auth-lede">Free. No password: use Google or Microsoft, or we email you a link. Next, three short steps.</p>
        </>
      )}
      <SignInForm starting={mode === "new"} />
    </>
  );
}

export function SignInForm({ starting = false }: Readonly<{ starting?: boolean }>) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [providers, setProviders] = useState<SignInProvider[]>([]);
  const supabase = browserSupabase();

  useEffect(() => {
    let live = true;
    enabledProviders().then((list) => {
      if (live) setProviders(list);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!supabase) {
    return (
      <p className="auth-message" role="status">
        Sign-in is not set up for this site yet. The rest of the companion works without it.
      </p>
    );
  }

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setStatus({ kind: "sending" });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });
    setStatus(error ? { kind: "error", message: error.message } : { kind: "sent" });
  }

  async function signInWith(provider: SignInProvider) {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl(), scopes: provider === "azure" ? "email" : undefined },
    });
    if (error) setStatus({ kind: "error", message: error.message });
  }

  if (status.kind === "sent") {
    return (
      <div className="auth-message" role="status">
        <p>
          Check your inbox. We sent a link to <strong>{email.trim()}</strong>. Open it on this device; it works for one
          hour. Nothing there? Look in Spam or Promotions.
        </p>
        <button type="button" className="fd-link" onClick={() => setStatus({ kind: "idle" })}>
          Use a different email
        </button>
      </div>
    );
  }

  // Free plan (docs/project/free-hosting.md, Part D): Google and Microsoft come first when they are switched on; they
  // need no email, and the emailed link uses a small daily email allowance.
  return (
    <>
      {providers.length > 0 && (
        <div className="auth-providers auth-providers-first">
          {providers.map((provider) => (
            <Button key={provider} variant="outline" type="button" onClick={() => signInWith(provider)}>
              {providerLabels[provider]}
            </Button>
          ))}
          <span className="auth-divider">or use your email</span>
        </div>
      )}
      <form className="auth-form" onSubmit={sendLink}>
        <label htmlFor="email">Email address</label>
        <span className="auth-hint">No password to remember: the link signs you in.</span>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@church.org"
        />
        <Button className="auth-primary" disabled={status.kind === "sending"} type="submit">
          {status.kind === "sending" ? "Sending…" : starting ? "Email me a link to start" : "Email me a sign-in link"}
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
