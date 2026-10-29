"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Monitor, X } from "lucide-react";

import {
  GUIDE_KINDS,
  GUIDE_STEPS,
  frameChangedOnWebsite,
  readGuide,
  writeGuide,
  type GuideProgress,
} from "@/lib/guide-steps";
import { browserSupabase } from "@/lib/supabase-browser";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { pullWorkspace } from "@/lib/workspace-sync";

// The Setup guide on Home (6.14): the program's seven steps, ticked only where this website can see them (the kind
// of gathering chosen here, a linked PC, a Frame added or changed here). Steps that happen on the PC say so instead of
// pretending; the program's own guide ticks them there. Hidden with ✕; Help → Setup guide brings it back.

type Seen = { linked: boolean; frame: boolean };

export function SetupGuide({
  workspace,
}: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const [progress, setProgress] = useState<GuideProgress | null>(null);
  const [seen, setSeen] = useState<Seen | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(readGuide(localStorage));
  }, []);

  useEffect(() => {
    if (!supabase || !progress || progress.hidden) return;
    let live = true;
    (async () => {
      const [pcs, pulled] = await Promise.all([
        supabase
          .from("computers")
          .select("id")
          .eq("organization_id", workspace.id)
          .is("revoked_at", null)
          .limit(1),
        pullWorkspace(supabase, workspace.id),
      ]);
      if (live)
        setSeen({
          linked: !pcs.error && (pcs.data?.length ?? 0) > 0,
          frame: frameChangedOnWebsite(pulled.records),
        });
    })();
    return () => {
      live = false;
    };
  }, [supabase, workspace.id, progress]);

  if (!progress || progress.hidden) return null;

  function save(next: GuideProgress) {
    writeGuide(localStorage, next);
    setProgress(next);
  }

  const done: Record<string, boolean> = {
    welcome: !!progress.kind,
    connect: !!seen?.linked,
    frame: !!seen?.frame,
  };
  const here = GUIDE_STEPS.filter(
    (s) => s.where === "both" || s.id === "connect",
  );
  const doneHere = here.filter((s) => done[s.id]).length;
  const current = GUIDE_STEPS.find((s) => s.where === "both" && !done[s.id]);

  return (
    <section className="fd-guide" aria-labelledby="fd-guide-title">
      <header className="fd-guide-head">
        <div>
          <p className="fd-kicker">Setup guide</p>
          <h2 id="fd-guide-title">Get ready for your first gathering</h2>
          <p className="fd-guide-sub">
            {doneHere} of {here.length} done here. The other steps happen in
            FrameDecks on the service PC, which ticks them itself.
          </p>
        </div>
        <button
          className="fd-guide-x"
          type="button"
          aria-label="Hide the Setup guide"
          title="Hide (Help brings it back)"
          onClick={() => save({ ...progress, hidden: true })}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      <ol className="fd-guide-list">
        {GUIDE_STEPS.map((s) => {
          const tick = !!done[s.id];
          const onPc = !tick && s.where === "program";
          const now = current?.id === s.id;
          return (
            <li
              key={s.id}
              className={
                tick ? "is-done" : now ? "is-now" : onPc ? "is-pc" : ""
              }
            >
              <span className="fd-guide-mark" aria-hidden="true">
                {tick ? (
                  <Check size={14} strokeWidth={3} />
                ) : onPc ? (
                  <Monitor size={13} />
                ) : null}
              </span>
              <div className="fd-guide-step">
                <b>{s.title}</b>
                {s.optional && (
                  <span className="fd-guide-opt"> (optional)</span>
                )}
                <span className="sr-only">
                  {tick ? " (done)" : now ? " (now)" : ""}
                </span>
                {onPc && !now && (
                  <span className="fd-guide-where">On the PC</span>
                )}
                {now && <p>{s.text}</p>}
                {now && s.id === "welcome" && (
                  <div className="fd-guide-kinds">
                    {GUIDE_KINDS.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        className="fd-btn fd-btn-ghost fd-btn-sm"
                        onClick={() => save({ ...progress, kind: k.id })}
                      >
                        {k.name}
                      </button>
                    ))}
                  </div>
                )}
                {now && s.id === "frame" && (
                  <Link
                    className="fd-btn fd-btn-primary fd-btn-sm"
                    href="/plan"
                  >
                    Open Plan
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {progress.kind && progress.kind !== "other" && (
        <p className="fd-guide-hint">
          On the service PC, Quick Start makes the{" "}
          {GUIDE_KINDS.find((k) => k.id === progress.kind)?.name} Frames in one
          click (Studio → Quick Start).
        </p>
      )}
    </section>
  );
}
