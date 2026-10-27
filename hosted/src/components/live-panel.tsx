"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, EyeOff, Moon } from "lucide-react";

import { WorkspaceGate } from "@/components/workspace-gate";
import { isOnline, label, nowShowing, outcome, type LiveComputer, type Op } from "@/lib/live-view";
import { browserSupabase } from "@/lib/supabase-browser";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { syncNotSetUp } from "@/lib/workspace-sync";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";

const POLL_MS = 2000;

// Running a service from a phone (Phase 5, docs/architecture/remote-control.md): commands go to the workspace with
// remote_send; the linked PC takes them and publishes what is on its screen, which this page reads every 2 seconds.
function Live({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const [computers, setComputers] = useState<LiveComputer[] | "not-set-up" | null>(null);
  const [pcId, setPcId] = useState<string | null>(null);
  const [last, setLast] = useState<{ id: number; text: string; result: string | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastRef = useRef(last);
  useEffect(() => {
    lastRef.current = last;
  }, [last]);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("remote_computers", { org: workspace.id });
    if (error) {
      if (syncNotSetUp(error)) setComputers("not-set-up");
      else setProblem(error.message);
      return;
    }
    setComputers((data as LiveComputer[]) ?? []);
    const sent = lastRef.current;
    if (sent && sent.result === null) {
      const answer = await supabase.from("remote_commands").select("result").eq("id", sent.id).maybeSingle();
      const result = (answer.data as { result: string | null } | null)?.result ?? null;
      if (result !== null) setLast({ ...sent, result });
    }
  }, [supabase, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (!supabase) return null;
  if (computers === "not-set-up") {
    return (
      <EmptyState title="Live control isn’t switched on yet">
        Whoever set up FrameDecks for your team finishes it once, in the database (steps <code>0004_remote.sql</code>{" "}
        and <code>0005_remote_live.sql</code>).
      </EmptyState>
    );
  }
  if (computers === null) return problem ? <ErrorState text={problem} onRetry={() => (setProblem(null), load())} /> : <PageSkeleton cards={2} />;
  if (computers.length === 0) {
    return (
      <EmptyState title="No service PC to run yet">
        Owners and admins link the service PC under Service PCs, and can let a member run services with “Can run
        services” on the Overview’s member list.
      </EmptyState>
    );
  }

  const pc = computers.find((c) => c.id === pcId) ?? computers[0];
  const online = isOnline(pc);
  const s = pc.status;

  async function send(op: Op, args: Record<string, unknown> = {}) {
    if (!supabase || busy) return;
    setBusy(true);
    setProblem(null);
    const { data, error } = await supabase.rpc("remote_send", { computer: pc.id, op, args });
    setBusy(false);
    if (error) {
      setProblem(
        error.code === "53400"
          ? "Too many presses: wait a moment."
          : error.code === "42501"
            ? "You are not allowed to run services on this PC."
            : error.message,
      );
      return;
    }
    setLast({ id: data as number, text: label(op, args), result: null });
    setTimeout(load, 700);
  }

  return (
    <div className="live">
      {computers.length > 1 && (
        <label className="workspace-picker">
          <span>PC</span>
          <select value={pc.id} onChange={(e) => setPcId(e.target.value)}>
            {computers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <article className="workspace-card live-now">
        <header>
          <h2>{pc.name}</h2>
          <span className={online ? "live-state live-on" : "live-state"}>{online ? "Online" : "Not connected"}</span>
        </header>
        <p className="live-frame">{nowShowing(s)}</p>
        {s && (
          <p className="live-flags">
            {s.blackout && <span className="live-flag live-flag-warn">Black screen</span>}
            {s.freeze && <span className="live-flag">Frozen</span>}
            {s.question.visible && <span className="live-flag">Question on screen</span>}
            {s.scripture.visible && (
              <span className="live-flag">Scripture on screen{s.scripture.ref ? ` · ${s.scripture.ref}` : ""}</span>
            )}
          </p>
        )}
        {!online && (
          <p className="workspace-hint">
            Is FrameDecks running on {pc.name}, with Settings → FrameDecks account → “Allow control from the
            companion” on? Presses made now are dropped after 10 seconds.
          </p>
        )}
      </article>

      <div className="live-controls" aria-label="Controls">
        <button className="live-btn live-big" type="button" disabled={busy} onClick={() => send("previous")}>
          <ChevronLeft aria-hidden="true" size={28} />
          Previous
        </button>
        <button className="live-btn live-big live-primary" type="button" disabled={busy} onClick={() => send("next")}>
          Next
          <ChevronRight aria-hidden="true" size={28} />
        </button>
        <button className="live-btn" type="button" disabled={busy} onClick={() => send("hide_all")}>
          <EyeOff aria-hidden="true" size={18} />
          Hide all
        </button>
        <button
          className={s?.blackout ? "live-btn live-active" : "live-btn"}
          type="button"
          aria-pressed={!!s?.blackout}
          disabled={busy}
          onClick={() => send("blackout", { on: !s?.blackout })}
        >
          <Moon aria-hidden="true" size={18} />
          Black screen
        </button>
        <button
          className={s?.question.visible ? "live-btn live-active" : "live-btn"}
          type="button"
          aria-pressed={!!s?.question.visible}
          disabled={busy}
          onClick={() => send("question", { show: !s?.question.visible })}
        >
          {s?.question.visible ? "Hide question" : "Show question"}
        </button>
        <button
          className={s?.scripture.visible ? "live-btn live-active" : "live-btn"}
          type="button"
          aria-pressed={!!s?.scripture.visible}
          disabled={busy}
          onClick={() => send("scripture", { show: !s?.scripture.visible })}
        >
          {s?.scripture.visible ? "Hide scripture" : "Show scripture"}
        </button>
      </div>

      {(last || problem) && (
        <p className={problem ? "workspace-problem" : "workspace-notice"} role={problem ? "alert" : "status"}>
          {problem ?? `${last?.text}: ${outcome(last?.result ?? null)}`}
        </p>
      )}

      <div className="live-columns">
        <article className="workspace-card">
          <header>
            <h2>Teleprompter</h2>
          </header>
          {s?.script ? (
            <div className="live-script" tabIndex={0}>
              {s.script}
            </div>
          ) : (
            <p className="workspace-hint">The Frame on screen has no script.</p>
          )}
        </article>

        <article className="workspace-card">
          <header>
            <h2>Frames</h2>
          </header>
          {s && s.frames.length ? (
            <ol className="live-frames">
              {s.frames.map((f, i) => {
                const current = s.frame?.id === f.id;
                return (
                  <li key={f.id} className={current ? "live-current" : undefined}>
                    <span>
                      {i + 1}. {f.name}
                    </span>
                    {current ? (
                      <span className="live-flag">On screen</span>
                    ) : (
                      <button
                        className="member-action"
                        type="button"
                        disabled={busy}
                        onClick={() => send("go_live", { frame: f.id })}
                      >
                        Go Live
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="workspace-hint">The PC has not sent its Frames yet.</p>
          )}
        </article>
      </div>
    </div>
  );
}

export function LivePanel() {
  return <WorkspaceGate what="the Live page">{(w) => <Live key={w.id} workspace={w} />}</WorkspaceGate>;
}
