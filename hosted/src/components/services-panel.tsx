"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Film, Image as ImageIcon, Presentation } from "lucide-react";

import { NotSetUp, WorkspaceGate } from "@/components/workspace-gate";
import { describeFrames, type FrameView } from "@/lib/services-view";
import { browserSupabase } from "@/lib/supabase-browser";
import { join, type JsonObject } from "@/lib/sync-entities";
import { pullWorkspace, syncNotSetUp } from "@/lib/workspace-sync";
import type { WorkspaceChoice } from "@/lib/use-workspaces";

type Loaded = { frames: FrameView[]; meeting: JsonObject; lastChange: string | null } | "not-set-up" | { error: string };

const MEDIA_ICON: Record<string, typeof Film> = { video: Film, image: ImageIcon, pdf: Presentation };

function Services({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    pullWorkspace(supabase, workspace.id).then(({ records, error }) => {
      if (!live) return;
      if (error) return setLoaded(syncNotSetUp(error) ? "not-set-up" : { error: error.message });
      const { doc } = join(records, {});
      const lastChange = records.map((r) => r.updatedAt ?? "").sort().at(-1) || null;
      setLoaded({
        frames: describeFrames(doc),
        meeting: (doc.meeting && typeof doc.meeting === "object" ? doc.meeting : {}) as JsonObject,
        lastChange,
      });
    });
    return () => {
      live = false;
    };
  }, [supabase, workspace.id]);

  if (loaded === null) return <p className="page-note">Loading…</p>;
  if (loaded === "not-set-up") return <NotSetUp />;
  if ("error" in loaded) return <p className="page-note page-problem">{loaded.error}</p>;
  if (!loaded.frames.length) {
    return (
      <p className="page-note">
        No service plan has been synced to “{workspace.name}” yet. Link the service PC under{" "}
        <Link href="/computers">Computers</Link>.
      </p>
    );
  }
  const frames = loaded.frames.filter((f) => !f.template);
  const templates = loaded.frames.filter((f) => f.template);
  const title = String(loaded.meeting.title ?? "");
  return (
    <>
      <p className="page-note">
        {title ? <strong>{title}</strong> : null}
        {title ? " · " : null}
        {frames.length} Frame{frames.length === 1 ? "" : "s"}
        {loaded.lastChange ? ` · last change ${new Date(loaded.lastChange).toLocaleString()}` : null}. View only: edit
        on the service PC.
      </p>
      <ol className="frame-list">
        {frames.map((frame, i) => (
          <FrameCard frame={frame} key={frame.id} number={i + 1} />
        ))}
      </ol>
      {templates.length > 0 && (
        <>
          <h2 className="section-title">Templates</h2>
          <ol className="frame-list">
            {templates.map((frame) => (
              <FrameCard frame={frame} key={frame.id} />
            ))}
          </ol>
        </>
      )}
    </>
  );
}

function FrameCard({ frame, number }: Readonly<{ frame: FrameView; number?: number }>) {
  return (
    <li className="frame-card">
      <header>
        {number !== undefined && <span className="frame-number">{number}</span>}
        <h3>{frame.name}</h3>
        {frame.group && <span className="workspace-role">{frame.group}</span>}
      </header>
      {frame.content.length === 0 ? (
        <p className="workspace-hint">No Content.</p>
      ) : (
        <ul className="content-list">
          {frame.content.map((c, i) => {
            const Icon = MEDIA_ICON[c.kind];
            return (
              <li key={i}>
                <span className="content-title">{c.title}</span>
                {c.media !== undefined ? (
                  <span className="content-media">
                    {Icon && <Icon aria-hidden="true" size={14} />}
                    {c.media ? `${c.media} · on the service PC` : "No file chosen"}
                  </span>
                ) : c.lines.length ? (
                  c.lines.map((line, j) => (
                    <span className="content-line" key={j}>
                      {line}
                    </span>
                  ))
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {frame.script && (
        <details className="frame-script">
          <summary>Teleprompter script</summary>
          <p>{frame.script}</p>
        </details>
      )}
    </li>
  );
}

export function ServicesPanel() {
  return <WorkspaceGate what="your services">{(w) => <Services key={w.id} workspace={w} />}</WorkspaceGate>;
}
