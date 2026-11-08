"use client";

import "@/app/join.css";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { agoWords, codeFromHash, codeProblem, isShortCode, rolesICanGive, tidyCode, type JoinRole } from "@/lib/join-code";
import { takeHashCode } from "@/lib/join-device";
import { browserSupabase } from "@/lib/supabase-browser";
import { useWorkspaces } from "@/lib/use-workspaces";
import { userSafeError } from "@/lib/user-error";

type Peek = { status: "pending"; device: string; ageSeconds: number } | { status: "expired" | "unknown" };
const TOO_MANY = "Too many wrong codes from this device or network. Wait an hour, then try again.";

/** 26.11.12 /allow: a new browser shows its own code (Open Workspace → Show a code for this browser); a phone that is
 * already in scans it (/allow#c=CODE), or the code is typed here. Owners let it in as an Admin or a Helper, admins as
 * a Helper. */
export function AllowPanel() {
  const supabase = browserSupabase();
  const { session, workspaces, selected } = useWorkspaces();
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [peek, setPeek] = useState<Peek | null>(null);
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState<JoinRole>("member");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<{ device: string; team: string; role: JoinRole } | null>(null);

  const mine = (workspaces ?? []).filter((w) => w.role === "owner" || w.role === "admin");
  const team = mine.find((w) => w.id === teamId) ?? (selected && mine.some((w) => w.id === selected.id) ? selected : mine[0]);
  const roles = rolesICanGive(team?.role);

  const look = useCallback(
    async (c: string) => {
      if (!supabase) return;
      setBusy(true);
      setProblem(null);
      const { data, error } = await supabase.rpc("join_request_peek", { code: c });
      setBusy(false);
      if (error) {
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
    setCode(takeHashCode(codeFromHash));
  }, []);

  const signedIn = !!session;
  const canAllow = mine.length > 0;
  useEffect(() => {
    // the code is looked at only by a device that may allow it (0018 join_request_peek needs a session)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (code && signedIn && canAllow && !peek) void look(code);
  }, [code, signedIn, canAllow, peek, look]);

  if (!supabase) {
    return (
      <p className="auth-message" role="status">
        Workspace sync is not set up for this site yet. The rest of FrameDecks works without it.
      </p>
    );
  }
  if (session === undefined || (session && workspaces === null)) {
    return (
      <p className="auth-message" role="status">
        One moment…
      </p>
    );
  }
  if (!session) {
    return (
      <>
        <h1 className="fd-auth-title">Allow a device</h1>
        <p className="jc-note">
          This device isn’t in a team yet. Scan the code with a phone that’s already in your team, or type it into FrameDecks
          on the church PC (Sync → Allow a device).
        </p>
        <Link className="auth-link" href="/sync">
          Open your workspace on this device
        </Link>
      </>
    );
  }
  if (!canAllow) {
    return (
      <>
        <h1 className="fd-auth-title">Allow a device</h1>
        <p className="jc-note">Only a team’s owner or an admin can let a new device in. Ask one of them to scan the code.</p>
        <Link className="auth-link" href="/">
          Back to Home
        </Link>
      </>
    );
  }

  if (done) {
    return (
      <>
        <h1 className="fd-auth-title">It’s in</h1>
        <p className="jc-ask" role="status">
          <strong>{done.device}</strong> joined <strong>{done.team}</strong> as {done.role === "admin" ? "an Admin" : "a Helper"}. It opens
          by itself in a moment.
        </p>
        <Link className="fd-btn fd-btn-primary auth-primary" href="/devices">
          See your devices
        </Link>
      </>
    );
  }

  async function allow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !code || !team || busy) return;
    const wanted = roles.includes(role) ? role : "member";
    setBusy(true);
    setProblem(null);
    const { data, error } = await supabase.rpc("join_request_allow", { code, org: team.id, wanted });
    setBusy(false);
    if (error) {
      setProblem(codeProblem(error) === "too-many" ? TOO_MANY : userSafeError(error, "Couldn’t allow this device. Try again."));
      return;
    }
    const answer = data as { status: string; device?: string };
    if (answer.status !== "allowed") {
      setPeek({ status: "expired" });
      return;
    }
    setDone({ device: answer.device ?? "The device", team: team.name, role: wanted });
  }

  async function checkTyped(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isShortCode(typed)) {
      setProblem("Codes have 8 letters and numbers, as shown on the other screen. Spaces don’t matter. (FD-CLD-01)");
      return;
    }
    setPeek(null);
    setProblem(null);
    setTyped("");
    setCode(tidyCode(typed));                            // looked at by the effect above
  }

  const pending = peek?.status === "pending" ? peek : null;
  return (
    <>
      <h1 className="fd-auth-title">
        {pending ? "Allow this device?" : peek?.status === "expired" ? "This code has run out" : peek?.status === "unknown" ? "That code doesn’t match" : "Allow a device"}
      </h1>

      {pending && team && (
        <form onSubmit={allow}>
          <p className="jc-ask">
            Allow <strong>{pending.device}</strong> (asked {agoWords(pending.ageSeconds)}) into <strong>{team.name}</strong>?
          </p>
          <p className="jc-note">Only allow a device you know: it will see your team’s plans.</p>
          {mine.length > 1 && (
            <label className="jc-field">
              Team
              <select value={team.id} onChange={(e) => setTeamId(e.target.value)}>
                {mine.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {roles.length > 1 ? (
            <fieldset className="jc-roles">
              <legend>Let it in as</legend>
              <label>
                <input type="radio" name="role" checked={role === "member"} onChange={() => setRole("member")} /> Helper
              </label>
              <label>
                <input type="radio" name="role" checked={role === "admin"} onChange={() => setRole("admin")} /> Admin
              </label>
            </fieldset>
          ) : (
            <p className="jc-note">It joins as a Helper. Only the team’s owner can add an Admin.</p>
          )}
          <div className="jc-actions">
            <Button className="auth-primary" type="submit" disabled={busy}>
              {busy ? "Allowing…" : "Allow"}
            </Button>
            <Link className="fd-link" href="/">
              Not now
            </Link>
          </div>
        </form>
      )}

      {(peek?.status === "expired" || peek?.status === "unknown") && (
        <p className="jc-note">
          {peek.status === "expired"
            ? "Codes last 5 minutes and work once. The other screen shows a new one by itself: scan that."
            : "Check the letters and try again, or scan the QR code instead."}
        </p>
      )}

      {!pending && (
        <form className="auth-form" onSubmit={checkTyped}>
          <label htmlFor="allow-code">Type the code the new device shows</label>
          <input
            id="allow-code"
            className="jc-type"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="K7PM 2XQ9"
          />
          <Button className="auth-primary" type="submit" disabled={busy || !typed.trim()}>
            {busy ? "Checking…" : "Check the code"}
          </Button>
        </form>
      )}

      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
    </>
  );
}
