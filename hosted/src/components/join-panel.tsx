"use client";

import "@/app/join.css";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { codeFromHash, codeProblem, guessDeviceName, isShortCode, tidyCode, type JoinRole } from "@/lib/join-code";
import { finishDevice, startDevice, takeHashCode } from "@/lib/join-device";
import { TERMS_VERSION } from "@/lib/legal";
import { browserSupabase } from "@/lib/supabase-browser";
import { useSession, useSessionAtArrival } from "@/lib/use-session";
import { userSafeError } from "@/lib/user-error";

type Peek =
  | { status: "invite"; team: string; role: JoinRole; byPc: boolean }
  | { status: "pc"; pc: string }
  | { status: "expired" | "unknown" };

const TOO_MANY = "Too many wrong codes from this device or network. Wait an hour, then try again.";

/** 26.11.12 /join: a phone scanned the QR code shown by the church PC or by a device already in (/join#c=CODE), or a
 * code is typed. The code is looked at first, with no session, so a wrong code never makes a new device. */
export function JoinPanel() {
  const supabase = browserSupabase();
  const session = useSession();
  const arrived = useSessionAtArrival(session);
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [peek, setPeek] = useState<Peek | null>(null);
  const [checking, setChecking] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsAsked, setTermsAsked] = useState(false);
  const [teams, setTeams] = useState<{ id: string; name: string }[] | null>(null);
  const [org, setOrg] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const look = useCallback(
    async (c: string) => {
      if (!supabase) return;
      setChecking(true);
      setProblem(null);
      setTeams(null);
      const { data, error } = await supabase.rpc("join_code_peek", { code: c });
      setChecking(false);
      if (error) {
        setPeek(null);
        setProblem(codeProblem(error) === "too-many" ? TOO_MANY : userSafeError(error, "Couldn’t check the code. Check your connection and try again."));
        return;
      }
      setCode(c);
      setPeek(data as Peek);
    },
    [supabase],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(guessDeviceName());
    const c = takeHashCode(codeFromHash);
    if (c) void look(c);
  }, [look]);

  if (!supabase) {
    return (
      <p className="auth-message" role="status">
        Workspace sync is not set up for this site yet. The rest of FrameDecks works without it.
      </p>
    );
  }

  const fresh = arrived === false;                      // a new device: no session on this browser when it came
  const needTerms = fresh || termsAsked;
  const ready = peek?.status === "invite" || peek?.status === "pc";

  async function checkTyped(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isShortCode(typed)) {
      setProblem("Codes have 8 letters and numbers, as shown on the other screen. Spaces don’t matter. (FD-CLD-01)");
      return;
    }
    setTyped("");
    await look(tidyCode(typed));
  }

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !code || busy || (needTerms && !agreed)) return;
    setBusy(true);
    setProblem(null);
    const deviceName = name.trim() || guessDeviceName();
    const started = await startDevice(supabase, shared);
    if (started) {
      setBusy(false);
      setProblem(started);
      return;
    }
    if (needTerms && agreed) await supabase.rpc("accept_terms", { version: TERMS_VERSION }).then(() => undefined, () => undefined);
    const { data, error } = await supabase.rpc("join_with_code", { code, device_name: deviceName, ...(org ? { org } : {}) });
    if (error) {
      setBusy(false);
      const kind = codeProblem(error);
      if (kind === "terms") {
        setTermsAsked(true);
        setProblem("This starts a new team on this device. Tick the box to agree to the Terms first.");
      } else setProblem(kind === "too-many" ? TOO_MANY : userSafeError(error, "Couldn’t join with this code. Try again."));
      return;
    }
    const answer = data as { status: string; organizationId?: string; teams?: { id: string; name: string }[] };
    if (answer.status === "choose") {
      setBusy(false);
      setTeams(answer.teams ?? []);
      setOrg(answer.teams?.[0]?.id ?? "");
      return;
    }
    if (answer.status !== "joined" && answer.status !== "linked") {
      setBusy(false);
      setPeek({ status: "expired" });
      return;
    }
    await finishDevice(supabase, deviceName, fresh && !shared, answer.organizationId);
  }

  const title = !peek
    ? "Join a team"
    : peek.status === "invite"
      ? `Join ${peek.team}`
      : peek.status === "pc"
        ? "Connect the church PC"
        : peek.status === "expired"
          ? "This code has run out"
          : "That code doesn’t match";

  return (
    <>
      <h1 className="fd-auth-title">{title}</h1>

      {peek?.status === "invite" && (
        <p className="jc-ask">
          Join <strong>{peek.team}</strong> as {peek.role === "admin" ? "an Admin" : "a Helper"}.
          {peek.byPc && " The code came from your church PC."}
        </p>
      )}
      {peek?.status === "pc" && (
        <>
          <p className="jc-ask">
            Connect <strong>{peek.pc}</strong> to your team.
          </p>
          <p className="jc-note">Its plans then sync by themselves. If this device isn’t in a team yet, this starts one and you are its owner.</p>
        </>
      )}
      {(peek?.status === "expired" || peek?.status === "unknown") && (
        <p className="jc-note">
          {peek.status === "expired"
            ? "Codes last 2 minutes and work once. Ask for a fresh one on the screen that showed it, then scan again."
            : "Check the letters and try again, or scan the QR code instead."}
        </p>
      )}

      {ready && !teams && (
        <form onSubmit={join}>
          <label className="jc-field">
            Name this device
            <input value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          </label>
          {fresh && (
            <label className="auth-agree">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
              <span>This is a shared computer: forget me when I close this tab.</span>
            </label>
          )}
          {needTerms && (
            <label className="auth-agree">
              <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                I agree to the <Link href="/terms">Terms of Service</Link> and the <Link href="/privacy">Privacy Policy</Link>.
              </span>
            </label>
          )}
          <Button className="auth-primary" type="submit" disabled={busy || (needTerms && !agreed)}>
            {busy ? "Joining…" : peek?.status === "pc" ? "Connect the PC" : "Join"}
          </Button>
        </form>
      )}

      {teams && (
        <form onSubmit={join}>
          <fieldset className="jc-roles">
            <legend>Which team should the PC join?</legend>
            {teams.map((t) => (
              <label key={t.id}>
                <input type="radio" name="team" value={t.id} checked={org === t.id} onChange={() => setOrg(t.id)} />
                {t.name}
              </label>
            ))}
          </fieldset>
          <Button className="auth-primary" type="submit" disabled={busy || !org}>
            {busy ? "Connecting…" : "Connect to this team"}
          </Button>
        </form>
      )}

      {!ready && (
        <form className="auth-form" onSubmit={checkTyped}>
          <label htmlFor="join-code">{peek ? "Try another code" : "Type the code from the other screen"}</label>
          <input
            id="join-code"
            className="jc-type"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="K7PM 2XQ9"
          />
          <Button className="auth-primary" type="submit" disabled={checking || !typed.trim()}>
            {checking ? "Checking…" : "Check the code"}
          </Button>
        </form>
      )}

      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
      {checking && (
        <p className="auth-message" role="status">
          Checking the code…
        </p>
      )}
    </>
  );
}
