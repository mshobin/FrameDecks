"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import { checkNumber, parseConnect, rememberReturn, type ConnectRequest } from "@/lib/connect-link";
import { browserSupabase } from "@/lib/supabase-browser";
import { useSession } from "@/lib/use-session";
import { useWorkspaces } from "@/lib/use-workspaces";
import { userSafeError } from "@/lib/user-error";

// One-click linking (6.13): the program opened this page with its request in the fragment. A signed-in owner or admin
// sees which PC asked, how long ago and its check number, picks a workspace and allows it. The PC learns the answer
// from its own poll (computer_link_poll); nothing secret passes through this page or the framedecks:// link.

type Peek = { status: "pending"; name: string; ageSeconds: number } | { status: "expired" | "unknown" };
type Phase = "ready" | "approving" | "done" | "cancelled";

function ago(seconds: number) {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  const m = Math.round(seconds / 60);
  return `${m} minute${m === 1 ? "" : "s"} ago`;
}

export function ConnectPanel() {
  const supabase = browserSupabase();
  const session = useSession();
  const { workspaces } = useWorkspaces();
  const [request, setRequest] = useState<ConnectRequest | null | undefined>(undefined);
  const [check, setCheck] = useState<number | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [orgId, setOrgId] = useState("");
  const [phase, setPhase] = useState<Phase>("ready");

  useEffect(() => {
    const found = parseConnect(window.location.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRequest(found);
    if (found) void checkNumber(found.code).then(setCheck);
  }, []);

  // Not signed in: remember this request, so signing in (even in another tab) comes back here
  useEffect(() => {
    if (request && session === null) rememberReturn(localStorage, `/connect${window.location.hash}`);
  }, [request, session]);

  useEffect(() => {
    if (!supabase || !session || !request) return;
    let live = true;
    supabase.rpc("computer_link_peek", { code: request.code }).then(({ data, error }) => {
      if (!live) return;
      if (error) setProblem(userSafeError(error, "This request couldn’t be checked. Try again."));
      else setPeek(data as Peek);
    });
    return () => {
      live = false;
    };
  }, [supabase, session, request]);

  const admin = useMemo(() => (workspaces ?? []).filter((w) => w.role === "owner" || w.role === "admin"), [workspaces]);
  const chosen = orgId || admin[0]?.id || "";
  const chosenName = admin.find((w) => w.id === chosen)?.name ?? "your workspace";
  // 9.3 (audit L10): the name the PC gave when it asked for the code (kept in the cloud), not the one in the link,
  // which anyone could write. Until that answer arrives the page says only "A computer".
  const pcName = peek?.status === "pending" ? peek.name : "A computer";

  async function allow() {
    if (!supabase || !request || !chosen) return;
    setPhase("approving");
    setProblem(null);
    const { error } = await supabase.rpc("computer_link_approve", { code: request.code, org: chosen });
    if (error) {
      setPhase("ready");
      setProblem(userSafeError(error, "This PC couldn’t be connected. Try again."));
      return;
    }
    setPhase("done");
    history.replaceState(null, "", "/connect"); // the code is used up; keep it out of the history
    window.location.href = "framedecks://linked"; // brings FrameDecks forward; it already knows from its own check
  }

  function cancel() {
    setPhase("cancelled");
    history.replaceState(null, "", "/connect");
  }

  if (request === undefined || (supabase && session === undefined)) {
    return <p className="auth-message" role="status">One moment…</p>;
  }
  if (!request) {
    return (
      <>
        <p className="auth-message">This page connects a PC to your workspace. Open it from FrameDecks on the PC: Settings → Sync.</p>
        <Link className="auth-link" href="/join">
          Type a code instead
        </Link>
      </>
    );
  }
  if (!session) {
    return (
      <>
        <PcLine name={pcName} check={check} />
        <p className="auth-message">Open your workspace to allow this PC. You’ll come straight back here.</p>
        <Link className="fd-btn fd-btn-primary auth-primary" href="/sync">
          Open your workspace to continue
        </Link>
      </>
    );
  }
  if (phase === "done") {
    return (
      <div className="fd-connect-done" role="status">
        <span className="fd-connect-tick" aria-hidden="true">
          <Check size={26} strokeWidth={3} />
        </span>
        <p className="fd-connect-big">
          <b>{pcName}</b> is connected to <b>{chosenName}</b>.
        </p>
        <p className="auth-message">FrameDecks on the PC shows it within a few seconds. You can close this tab.</p>
        <a className="fd-btn fd-btn-ghost" href="framedecks://linked">
          Return to FrameDecks
        </a>
      </div>
    );
  }
  if (phase === "cancelled") {
    return (
      <p className="auth-message" role="status">
        Nothing was shared. {pcName} stays unconnected; you can close this tab.
      </p>
    );
  }
  if (peek && peek.status !== "pending") {
    return (
      <>
        <p className="auth-error" role="alert">
          {peek.status === "expired"
            ? "This request has expired (requests last 10 minutes). On the PC, choose Connect to FrameDecks again. (FD-CLD-02)"
            : "This request is not known, or it was already used. On the PC, choose Connect to FrameDecks again."}
        </p>
        <Link className="auth-link" href="/join">
          Type a code instead
        </Link>
      </>
    );
  }
  if (workspaces !== null && admin.length === 0) {
    return (
      <>
        <PcLine name={pcName} check={check} />
        <p className="auth-error" role="alert">
          Only a workspace’s owners and admins can connect a PC. Ask one of them to open this link, or create your own
          workspace first.
        </p>
        <Link className="auth-link" href="/">
          Go to Home
        </Link>
      </>
    );
  }

  return (
    <>
      <PcLine name={pcName} check={check} />
      <p className="fd-connect-ask">
        Allow <b>{pcName}</b> to use your workspace?
      </p>
      {admin.length > 1 ? (
        <label className="fd-connect-field">
          Workspace
          <select value={chosen} onChange={(e) => setOrgId(e.target.value)}>
            {admin.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="fd-connect-field">
          Workspace <b>{chosenName}</b>
        </p>
      )}
      <ul className="fd-connect-scope">
        <li>
          <Check aria-hidden="true" size={15} /> Get the workspace’s service plans and Teleprompter scripts
        </li>
        <li>
          <Check aria-hidden="true" size={15} /> Get the workspace’s member list
        </li>
        <li>
          <Check aria-hidden="true" size={15} /> Send this PC’s changes back
        </li>
      </ul>
      <p className="fd-connect-meta">
        {peek?.status === "pending" ? `Asked ${ago(peek.ageSeconds)}. ` : ""}Pictures, video and what is on screen stay
        on the PC. You can remove it any time under Devices.
      </p>
      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
      <div className="fd-connect-actions">
        <button className="fd-btn fd-btn-ghost" type="button" onClick={cancel} disabled={phase === "approving"}>
          Cancel
        </button>
        <Button className="auth-primary" type="button" onClick={allow} disabled={phase === "approving" || !chosen || !peek}>
          {phase === "approving" ? "Allowing…" : "Allow"}
        </Button>
      </div>
    </>
  );
}

function PcLine({ name, check }: Readonly<{ name: string; check: number | null }>) {
  return (
    <div className="fd-connect-pc">
      <span className="fd-connect-pc-icon" aria-hidden="true">
        <Monitor size={20} />
      </span>
      <span>
        <b>{name}</b>
        <small>Check: FrameDecks on this PC shows {check ?? "…"}</small>
      </span>
      <span className="fd-connect-check" aria-label={`Check number ${check ?? ""}`}>
        {check ?? "··"}
      </span>
    </div>
  );
}
