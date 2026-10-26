"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { browserSupabase, callbackUrl, enabledProviders, type SignInProvider } from "@/lib/supabase-browser";

const providerLabels: Record<SignInProvider, string> = {
  google: "Continue with Google",
  azure: "Continue with Microsoft",
};

type Status = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string };

export function SignInForm() {
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
      <p className="auth-message" role="status">
        Check your email. We sent a sign-in link to <strong>{email.trim()}</strong>. Open it on this device.
      </p>
    );
  }

  return (
    <>
      <form className="auth-form" onSubmit={sendLink}>
        <label htmlFor="email">Email address</label>
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
          {status.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>
      {providers.length > 0 && (
        <div className="auth-providers">
          <span className="auth-divider">or</span>
          {providers.map((provider) => (
            <Button key={provider} variant="outline" type="button" onClick={() => signInWith(provider)}>
              {providerLabels[provider]}
            </Button>
          ))}
        </div>
      )}
      {status.kind === "error" && (
        <p className="auth-error" role="alert">
          {status.message}
        </p>
      )}
    </>
  );
}
