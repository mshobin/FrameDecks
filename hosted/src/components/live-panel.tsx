"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, EyeOff, Moon } from "lucide-react";

import { WorkspaceGate } from "@/components/workspace-gate";
import { userSafeError } from "@/lib/user-error";
import { label, nowShowing, outcome, pcState, refreshEvery, type LiveComputer, type Op } from "@/lib/live-view";
import { browserSupabase } from "@/lib/supabase-browser";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { syncNotSetUp } from "@/lib/workspace-sync";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";

// Running a service from a phone (Phase 5, docs/architecture/remote-control-design.md): commands go to the workspace with
// remote_send; the linked PC takes them and publishes what is on its screen. 9.11 live push (docs/architecture/live-push.md):
// where the database has 0016, this page listens on the workspace's private channel and reads again the moment a status
// or an answer changes, and keeps the PC it shows awake with remote_watch. Otherwise, and for PCs from before 9.11, it
// reads every 2 seconds exactly as before.
function Live({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const [computers, setComputers] = useState<LiveComputer[] | "not-set-up" | null>(null);
  const [pcId, setPcId] = useState<string | null>(null);
  const [last, setLast] = useState<{ id: number; text: string; result: string | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pushReady, setPushReady] = useState(false);   // live_computers answered: the database has live push
  const [channel, setChannel] = useState(false);       // the private channel is open
  const [waiting, setWaiting] = useState(false);       // a press waits for the PC's answer
  const lastRef = useRef(last);
  const pushRef = useRef<boolean | null>(null);
  useEffect(() => {
    lastRef.current = last;
  }, [last]);

  const load = useCallback(async () => {
    if (!supabase) return;
    let answer: { data: unknown; error: { code?: string; message?: string } | null } | null = null;
    if (pushRef.current !== false) {
      answer = await supabase.rpc("live_computers", { org: workspace.id });
      if (answer.error && syncNotSetUp(answer.error)) {
        pushRef.current = false;                       // 0016 not run yet: as before 9.11
        answer = null;
      } else if (!answer.error && pushRef.current === null) {
        pushRef.current = true;
        setPushReady(true);
      }
    }
    if (!answer) answer = await supabase.rpc("remote_computers", { org: workspace.id });
    const { data, error } = answer;
    if (error) {
      if (syncNotSetUp(error)) setComputers("not-set-up");
      else setProblem(userSafeError(error, "Couldn’t check the service PC. Check your connection and try again."));
      return;
    }
    setComputers((data as LiveComputer[]) ?? []);
    const sent = lastRef.current;
    if (sent && sent.result === null) {
      const reply = await supabase.from("remote_commands").select("result").eq("id", sent.id).maybeSingle();
      const result = (reply.data as { result: string | null } | null)?.result ?? null;
      if (result !== null) {
        setLast({ ...sent, result });
        setWaiting(false);
      }
    }
  }, [supabase, workspace.id]);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const selected = Array.isArray(computers) ? (computers.find((c) => c.id === pcId) ?? computers[0] ?? null) : null;
  const selectedId = selected?.id ?? null;
  const state = selected ? pcState(selected) : "offline";
  const every = refreshEvery({ channel, pc: selected, state, waiting });

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, every);
    return () => clearInterval(timer);
  }, [load, every]);

  // The private channel: each ring ("status", "result") makes the page read once (a burst of rings, once).
  useEffect(() => {
    if (!supabase || !pushReady) return;
    let soon: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const ping = () => {
      clearTimeout(soon);
      soon = setTimeout(() => loadRef.current(), 150);
    };
    const live = supabase.channel(`live:${workspace.id}`, { config: { private: true } });
    live.on("broadcast", { event: "*" }, ping);
    (async () => {
      try {
        await supabase.realtime.setAuth();
      } catch {
        // signed out meanwhile: the channel is refused and the page keeps reading every 2 seconds
      }
      if (!alive) return;
      live.subscribe((status) => {
        setChannel(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") ping();
      });
    })();
    return () => {
      alive = false;
      clearTimeout(soon);
      setChannel(false);
      supabase.removeChannel(live);
    };
  }, [supabase, pushReady, workspace.id]);

  // Keep the PC on screen awake while this page is visible (an asleep PC wakes within a minute).
  useEffect(() => {
    if (!supabase || !pushReady || !selectedId) return;
    const watch = () => {
      if (!document.hidden) supabase.rpc("remote_watch", { computer: selectedId }).then(() => undefined, () => undefined);
    };
    const shown = () => {
      if (document.hidden) return;
      watch();
      loadRef.current();
    };
    watch();
    const timer = setInterval(watch, 60_000);
    document.addEventListener("visibilitychange", shown);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", shown);
    };
  }, [supabase, pushReady, selectedId]);

  if (!supabase) return null;
  if (computers === "not-set-up") {
    return (
      <EmptyState title="Live control isn’t switched on yet">
          Ask your workspace owner to finish setting up service control.
      </EmptyState>
    );
  }
  if (computers === null) return problem ? <ErrorState text={problem} onRetry={() => (setProblem(null), load())} /> : <PageSkeleton cards={2} />;
  if (computers.length === 0 || !selected) {
    return (
      <EmptyState title="No service PC to run yet">
        Owners and admins link the service PC under Devices, and can let a member run services with “Can run
        services” on the Overview’s member list.
      </EmptyState>
    );
  }

  const pc = selected;
  const online = state === "online";
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
            : userSafeError(error, "Couldn’t send that action to the service PC. Check its connection and try again."),
      );
      return;
    }
    setLast({ id: data as number, text: label(op, args), result: null });
    setWaiting(true);
    setTimeout(() => setWaiting(false), 15_000);         // answered, expired or the PC is off: back to the usual pace
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
          <span className={online ? "live-state live-on" : "live-state"}>
            {online ? "Online" : state === "waking" ? "Waking up…" : "Not connected"}
          </span>
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
        {state === "waking" && (
          <p className="workspace-hint">
            {pc.name} rests between services to save data and wakes now that this page is open, usually within a
            minute. Presses made before it shows Online are dropped after 10 seconds.
          </p>
        )}
        {state === "offline" && (
          <p className="workspace-hint">
            Is FrameDecks running on {pc.name}, with Settings → Sync → “Allow control from the
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
