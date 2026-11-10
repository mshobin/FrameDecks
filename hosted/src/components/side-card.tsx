"use client";

// FrameDecks 26.11.40 - the left panel's Next meeting card, under Help: the meeting the service PC shows (its date and
// Frames), how ready it is (5 checks), the church PC, and the Frame changes waiting for Sync Now on Plan.
import "@/app/side-card.css";

import Link from "next/link";
import { useEffect, useState } from "react";

import { loadGlance, type GlanceData } from "@/lib/glance-data";
import { meetingWhen, readyCount } from "@/lib/glance-view";
import { isOnline } from "@/lib/live-view";
import { loadChanges, summarize } from "@/lib/plan-changes";
import { browserSupabase } from "@/lib/supabase-browser";
import { useWorkspaces } from "@/lib/use-workspaces";

export function SideCard() {
  const supabase = browserSupabase();
  const { selected } = useWorkspaces();
  const [g, setG] = useState<GlanceData | null>(null);
  const [waiting, setWaiting] = useState(0);
  const ws = selected?.id;

  useEffect(() => {
    if (!supabase || !ws) return;
    let live = true;
    loadGlance(supabase, ws).then((d) => live && setG(d), () => undefined);
    const read = () => setWaiting(summarize(loadChanges(ws)).count);
    read();
    window.addEventListener("fd-plan-changes", read);
    window.addEventListener("storage", read);
    return () => {
      live = false;
      window.removeEventListener("fd-plan-changes", read);
      window.removeEventListener("storage", read);
    };
  }, [supabase, ws]);

  if (!g) return null;
  const m = g.meeting;
  const pc = g.pcs[0];
  const on = !!pc && isOnline(pc);
  const ready = readyCount(m, waiting, on);
  return (
    <section className="fd-side-card" aria-label="Next meeting">
      <p className="fd-side-kicker">Next meeting</p>
      <Link className="fd-side-title" href="/plan">
        {m.name || "Your next meeting"}
      </Link>
      <p className="fd-side-when">
        {meetingWhen(m.date)} · {m.frames} Frame{m.frames === 1 ? "" : "s"}
      </p>
      <div className="fd-side-bar" role="progressbar" aria-label="Ready for the meeting" aria-valuemin={0} aria-valuemax={5} aria-valuenow={ready}>
        <i style={{ transform: `scaleX(${ready / 5})` }} />
      </div>
      <p className="fd-side-when">{ready} of 5 ready</p>
      <Link className="fd-side-pc" href="/devices">
        <span className={on ? "fd-side-dot is-on" : "fd-side-dot"} aria-hidden="true" />
        {pc ? `${pc.name} · ${on ? "online" : "offline"}` : "No service PC linked yet"}
      </Link>
      {waiting > 0 && (
        <Link className="fd-side-sync" href="/plan">
          <span>
            {waiting} change{waiting === 1 ? "" : "s"} waiting
          </span>
          <b>Sync Now →</b>
        </Link>
      )}
    </section>
  );
}
