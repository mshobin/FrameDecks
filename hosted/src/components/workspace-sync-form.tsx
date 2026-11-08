"use client";

import "@/app/join.css"; // 26.11.12 the code card and the quieter ways in

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { ensureWorkspace } from "@/components/auth-callback";
import { CodeStopped, JoinCodeCard, useRotatingCode } from "@/components/join-code-card";
import { Button } from "@/components/ui/button";
import { takeReturn } from "@/lib/connect-link";
import { allowUrl, codeProblem, formatCode, guessDeviceName, isRecoveryCode, tidyCode } from "@/lib/join-code";
import { finishDevice, startDevice } from "@/lib/join-device";
import { rememberAcceptance } from "@/lib/legal";
import { browserSupabase, callbackUrl } from "@/lib/supabase-browser";
import { statusMessage, type DeviceStatus } from "@/lib/trusted-device";
import { useSession, useSessionAtArrival } from "@/lib/use-session";
import { userSafeError } from "@/lib/user-error";

/** The ways into a workspace. 26.11.12 Scan to join: the main way is a phone that is already in (this browser shows a
 * code, the phone scans it and allows it). Quieter: an emailed link or 6-digit code (9.8), the recovery code, and for
 * someone new, the church PC (Add a device) or Start with email (asks for the Terms once).
 * Old addresses keep working: ?intent=save opens Start with email, ?intent=continue and ?email=… the email code. */
export type SyncIntent = "sync" | "save" | "continue";
type Mode = "code" | "email" | "start" | "recover";

const INTENTS: Record<SyncIntent, { title: string; lede: string; button: string }> = {
  sync: {
    title: "Open your workspace with email.",
    lede: "Enter your email. We send a one-time link and a 6-digit code that open your workspace on this device.",
    button: "Email me a link",
  },
  save: {
    title: "Start a free workspace.",
    lede: "Plan on the website first: keep your meetings, Frames and people safe in a workspace you can open anywhere. Free, and nothing to remember.",
    button: "Email me a link to start it",
  },
  continue: {
    title: "Continue on this device.",
    lede: "Using FrameDecks somewhere else already? Enter the same email, then open the link or type the code here.",
    button: "Email me a link for this device",
  },
};

export function readIntent(search: string, hash: string): SyncIntent {
  const q = new URLSearchParams(search);
  const v = q.get("intent") || (hash === "#new" || q.has("new") ? "save" : "");
  return v === "save" || v === "continue" ? v : "sync";
}

function modeOf(intent: SyncIntent, email: string | null): Mode {
  if (intent === "save") return "start";
  return intent === "continue" || email ? "email" : "code";
}

export function WorkspaceSyncChooser() {
  const [mode, setMode] = useState<Mode>("code");
  const [intent, setIntent] = useState<SyncIntent>("sync");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const session = useSession();
  const arrived = useSessionAtArrival(session);
  const [inTeam, setInTeam] = useState<boolean | null>(null);
  // Already in on this browser when the page opened: Home. A device this page starts itself is not "returning", and a
  // device that never got into a team (it showed a code nobody allowed) stays here and uses the same session again.
  const anonymous = !!session?.user.is_anonymous;
  const returning =
    arrived === true && (!anonymous || inTeam === true) && !/[?&]reason=/.test(typeof window === "undefined" ? "" : window.location.search);
  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase || !session || !anonymous || arrived !== true) return;
    supabase
      .from("memberships")
      .select("organization_id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .then(({ count, error }) => setInTeam(!error && !!count));
  }, [session, anonymous, arrived]);
  useEffect(() => {
    // 9.11.1 already in on this browser: straight to Home (or back to a PC's connect request)
    if (returning) window.location.replace(takeReturn(localStorage) ?? "/");
  }, [returning]);
  useEffect(() => {
    // The address is only known in the browser (static export), so the choice is read after the first render.
    const q = new URLSearchParams(window.location.search);
    const asked = readIntent(window.location.search, window.location.hash);
    const pre = q.get("email");
    const valid = pre && /^[^@\s]+@[^@\s]+$/.test(pre) ? pre : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIntent(asked);
    setMode(modeOf(asked, valid));
    if (valid) setEmail(valid);
    const reason = q.get("reason");
    if (reason === "revoked" || reason === "expired") setNotice(statusMessage(reason as DeviceStatus));
  }, []);
  if (returning) {
    return (
      <p className="auth-message" role="status">
        Opening your workspace…
      </p>
    );
  }
  const back = (
    <button type="button" className="fd-link jc-back" onClick={() => setMode("code")}>
      ← Other ways in
    </button>
  );
  return (
    <>
      {notice && (
        <p className="auth-message" role="status">
          {notice}
        </p>
      )}
      {mode === "code" && (
        <>
          <h1 className="fd-auth-title">Open your workspace.</h1>
          <p className="auth-lede">With a phone that’s already in your team. No email, nothing to remember.</p>
          <OpenWithPhone />
          <div className="jc-more">
            <p>Other ways in</p>
            <button type="button" className="fd-link" onClick={() => setMode("email")}>
              Use an email code instead
            </button>
            <button type="button" className="fd-link" onClick={() => setMode("recover")}>
              Lost every device? Use your recovery code
            </button>
          </div>
          <div className="jc-more">
            <p>New here?</p>
            <p className="jc-note">
              Install FrameDecks on your church PC and choose <strong>Add a device</strong>, then scan its code with your phone.{" "}
              <Link href="/download">Get FrameDecks</Link>
            </p>
            <button type="button" className="fd-link" onClick={() => setMode("start")}>
              Plan on the website first? Start with email
            </button>
          </div>
        </>
      )}
      {(mode === "email" || mode === "start") && (
        <>
          {back}
          <h1 className="fd-auth-title">{INTENTS[mode === "start" ? "save" : intent === "save" ? "sync" : intent].title}</h1>
          <p className="auth-lede">{INTENTS[mode === "start" ? "save" : intent === "save" ? "sync" : intent].lede}</p>
          <WorkspaceSyncForm key={mode} intent={mode === "start" ? "save" : intent === "save" ? "sync" : intent} initialEmail={email} />
        </>
      )}
      {mode === "recover" && (
        <>
          {back}
          <h1 className="fd-auth-title">Get your team back.</h1>
          <p className="auth-lede">Lost every device? Type the recovery code the owner printed or saved. This device becomes the team’s owner.</p>
          <RecoverForm />
        </>
      )}
    </>
  );
}

/** This browser shows its own code; a phone that is in scans it (/allow) or the church PC types it in. Polls every
 * 2 seconds until it is allowed, then keeps the device (unless shared) and opens Home. */
function OpenWithPhone() {
  const supabase = browserSupabase();
  const [shared, setShared] = useState(false);
  const [name, setName] = useState("");
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(guessDeviceName());
  }, []);

  const make = useCallback(async () => {
    if (!supabase) return "Workspace sync is not set up for this site yet.";
    const { data, error } = await supabase.rpc("join_request_create", { device_name: name.trim() || guessDeviceName() });
    if (error) return userSafeError(error, "Couldn’t make a code. Check your connection and try again.");
    return data as { code: string; expiresAt: string };
  }, [supabase, name]);
  const rotating = useRotatingCode(make, 5 * 60_000, started && !allowed);
  const code = rotating.code;

  useEffect(() => {
    if (!supabase || !code || allowed) return;
    let live = true;
    const t = window.setInterval(async () => {
      const { data, error } = await supabase.rpc("join_request_status", { code });
      const answer = data as { status: string; organizationId?: string; organizationName?: string } | null;
      if (!live || error || answer?.status !== "allowed") return;
      live = false;
      window.clearInterval(t);
      setAllowed(answer.organizationName ?? "your team");
      await finishDevice(supabase, name.trim() || guessDeviceName(), !shared, answer.organizationId);
    }, 2000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [supabase, code, allowed, name, shared]);

  if (!supabase) {
    return (
      <p className="auth-message" role="status">
        Workspace sync is not set up for this site yet. The rest of FrameDecks works without it.
      </p>
    );
  }

  async function start() {
    if (!supabase) return;
    setStarting(true);
    setProblem(null);
    const failed = await startDevice(supabase, shared);
    setStarting(false);
    if (failed) setProblem(failed);
    else setStarted(true);
  }

  if (allowed) {
    return (
      <p className="jc-ask" role="status">
        Allowed ✓ Opening <strong>{allowed}</strong>…
      </p>
    );
  }
  if (started) {
    if (rotating.stopped || rotating.problem) return <CodeStopped problem={rotating.problem} onAgain={rotating.again} />;
    if (!code) {
      return (
        <p className="auth-message" role="status">
          Making a code…
        </p>
      );
    }
    return (
      <>
        <p className="jc-note">Scan this with a phone that’s already in your team. It asks there whether to let this browser in.</p>
        <JoinCodeCard
          url={allowUrl(window.location.origin, code)}
          code={code}
          left={rotating.left}
          fresh={rotating.fresh}
          qrLabel="QR code to allow this browser. Scan it with a phone that’s already in your team."
          typeHint="Or type it into FrameDecks on the church PC (Sync → Allow a device)"
        />
        <p className="auth-message" role="status" aria-live="polite">
          Waiting for a phone to allow this browser…
        </p>
      </>
    );
  }
  return (
    <>
      <label className="jc-field">
        Name this browser
        <input value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="auth-agree">
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        <span>This is a shared computer: forget me when I close this tab.</span>
      </label>
      <Button className="auth-primary" type="button" disabled={starting} onClick={start}>
        {starting ? "One moment…" : "Show a code for this browser"}
      </Button>
      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
    </>
  );
}

/** Lost every device: the printed recovery code makes this device the team's owner (0018 recover_team). */
function RecoverForm() {
  const supabase = browserSupabase();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(guessDeviceName());
  }, []);
  if (!supabase) return null;

  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || busy) return;
    if (!isRecoveryCode(code)) {
      setProblem("A recovery code has 16 letters and numbers, like ABCD-EFGH-JKMN-PQRS. Dashes and spaces don’t matter.");
      return;
    }
    setBusy(true);
    setProblem(null);
    const failed = await startDevice(supabase, shared);
    if (failed) {
      setBusy(false);
      setProblem(failed);
      return;
    }
    const deviceName = name.trim() || guessDeviceName();
    const { data, error } = await supabase.rpc("recover_team", { code: tidyCode(code), device_name: deviceName });
    const answer = data as { status: string; organizationId?: string } | null;
    if (error || answer?.status !== "recovered") {
      setBusy(false);
      setProblem(
        codeProblem(error) === "too-many"
          ? "Too many wrong codes from this device or network. Wait an hour, then try again."
          : error
            ? userSafeError(error, "Couldn’t check the recovery code. Try again.")
            : "That recovery code doesn’t match. Check each letter and try again. After 5 wrong tries, wait an hour.",
      );
      return;
    }
    await finishDevice(supabase, deviceName, !shared, answer.organizationId);
  }

  return (
    <form onSubmit={recover}>
      <label className="jc-field">
        Recovery code
        <input
          className="jc-type"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={24}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => isRecoveryCode(code) && setCode(formatCode(code))}
          placeholder="ABCD-EFGH-JKMN-PQRS"
        />
      </label>
      <label className="jc-field">
        Name this device
        <input value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="auth-agree">
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        <span>This is a shared computer: forget me when I close this tab.</span>
      </label>
      <Button className="auth-primary" type="submit" disabled={busy || !code.trim()}>
        {busy ? "Checking…" : "Get my team back"}
      </Button>
      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}

type Status = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string };

export function WorkspaceSyncForm({ intent = "sync", initialEmail = "" }: Readonly<{ intent?: SyncIntent; initialEmail?: string }>) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [agreed, setAgreed] = useState(false);
  const [token, setToken] = useState("");
  const [opening, setOpening] = useState(false);
  const [codeProblemText, setCodeProblemText] = useState<string | null>(null);
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

  // 26.11.12 the same email carries a 6-digit code: typed here it opens the workspace like the link does
  async function openWithCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || opening) return;
    const digits = token.replace(/\D/g, "");
    if (digits.length < 6) {
      setCodeProblemText("Type the 6-digit code from the email.");
      return;
    }
    setOpening(true);
    setCodeProblemText(null);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: digits, type: "email" });
    if (error || !data.session) {
      setOpening(false);
      setCodeProblemText(
        error && /expired|invalid/i.test(error.message)
          ? "That code has run out or doesn’t match. Codes work once, for 10 minutes. Ask for a new email."
          : userSafeError(error, "Couldn’t open your workspace with that code. Try again."),
      );
      return;
    }
    await supabase.rpc("magic_link_used").then(() => undefined, () => undefined);
    await ensureWorkspace(supabase, data.session.user.id).catch(() => undefined);
    window.location.replace(takeReturn(localStorage) ?? "/");
  }

  if (status.kind === "sent") {
    return (
      <div className="auth-message" role="status">
        <p>
          Check your inbox. We sent a one-time link and a 6-digit code to <strong>{email.trim()}</strong>. Open the link on this
          device, or type the code below, within 10 minutes; each works once. Nothing there? Look in Spam or Promotions.
        </p>
        <form className="auth-form" onSubmit={openWithCode}>
          <label htmlFor="email-code">Code from the email</label>
          <input
            id="email-code"
            className="jc-type"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456"
          />
          <Button className="auth-primary" type="submit" disabled={opening || !token.trim()}>
            {opening ? "Opening…" : "Open my workspace"}
          </Button>
        </form>
        {codeProblemText && (
          <p className="auth-error" role="alert">
            {codeProblemText}
          </p>
        )}
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
        <span className="auth-hint">Nothing to remember: the link or the code opens your workspace. Each works once, for 10 minutes.</span>
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
