"use client";

// FrameDecks 8.3 - the guided Plan workflow (lib/frame-flow.ts): the five steps with the Sync status, the timeline
// whose Frames are dragged into order, the transition picker and the Preview. Used by meeting-form-panel.tsx.
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, CloudOff, GripVertical, Loader2, Plus, X } from "lucide-react";

import { FLOW_STEPS, previewOf, type FramePreview, type StepId, type StepState } from "@/lib/frame-flow";
import { TRANSITIONS } from "@/lib/meeting-form";

type Obj = { [key: string]: unknown };
export type SyncShown = "synced" | "syncing" | "offline" | "failed";

const SYNC_WORDS: Record<SyncShown, string> = { synced: "Synced", syncing: "Syncing…", offline: "Offline", failed: "Sync failed" };

export function SyncPill({ phase }: Readonly<{ phase: SyncShown }>) {
  return (
    <span className={`flow-sync is-${phase}`} role="status" aria-live="polite">
      {phase === "syncing" ? <Loader2 aria-hidden="true" size={14} /> : phase === "offline" ? <CloudOff aria-hidden="true" size={14} /> : phase === "failed" ? <AlertTriangle aria-hidden="true" size={14} /> : <Check aria-hidden="true" size={14} />}
      {SYNC_WORDS[phase]}
    </span>
  );
}

/** The five steps: ticked when done; the one to do now carries a large button with its action. */
export function FlowSteps({ state, onStep, sync }: Readonly<{ state: Record<StepId, StepState>; onStep: (id: StepId) => void; sync: SyncShown }>) {
  return (
    <ol className="flow-steps" aria-label="Plan in five steps">
      {FLOW_STEPS.map((s, i) => (
        <li key={s.id} className={`is-${state[s.id]}`} aria-current={state[s.id] === "now" ? "step" : undefined}>
          <span className="flow-dot" aria-hidden="true">
            {state[s.id] === "done" ? <Check size={15} /> : i + 1}
          </span>
          <span className="flow-text">
            <strong>{s.title}</strong>
            <small>{s.id === "send" ? <SyncPill phase={sync} /> : s.hint}</small>
          </span>
          <button type="button" className={state[s.id] === "now" ? "fd-btn fd-btn-primary" : "fd-btn fd-btn-glass"} onClick={() => onStep(s.id)}>
            {s.action}
          </button>
        </li>
      ))}
    </ol>
  );
}

const TX_NAME = Object.fromEntries(TRANSITIONS.map(([n, v]) => [v, n]));

/** The Frames side by side: drag one to a new place (or Alt + arrow keys); click to open it. */
export function Timeline({
  frames,
  onAir,
  canEdit,
  busy,
  onMove,
  onOpen,
  onAdd,
  addDisabled,
}: Readonly<{
  frames: Obj[];
  onAir: string | null;
  canEdit: boolean;
  busy: boolean;
  onMove: (id: string, to: number) => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
  addDisabled: boolean;
}>) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null); // insert before this place (0..n)

  function place(e: DragEvent<HTMLLIElement>, i: number) {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientX > r.left + r.width / 2 ? i + 1 : i;
  }
  function drop() {
    if (drag !== null && over !== null) {
      const at = frames.findIndex((f) => String(f.id) === drag);
      const to = over > at ? over - 1 : over;
      if (at >= 0 && to !== at) onMove(drag, to);
    }
    setDrag(null);
    setOver(null);
  }
  function keys(e: KeyboardEvent<HTMLButtonElement>, id: string, i: number) {
    if (!e.altKey || !canEdit || busy) return;
    const d = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    if (i + d >= 0 && i + d < frames.length) onMove(id, i + d);
  }

  return (
    <div className="flow-line-wrap">
      <ol className="flow-line" aria-label="Timeline: the Frames in order" aria-describedby="flow-line-hint">
        {frames.map((f, i) => {
          const id = String(f.id);
          const p = previewOf(f);
          const tx = TX_NAME[p.transition] ?? "";
          return (
            <li
              key={id}
              className={[drag === id && "is-dragging", over === i && "is-before", over === i + 1 && i === frames.length - 1 && "is-after"].filter(Boolean).join(" ") || undefined}
              draggable={canEdit && !busy}
              onDragStart={(e) => (e.dataTransfer.setData("text/plain", id), (e.dataTransfer.effectAllowed = "move"), setDrag(id))}
              onDragOver={(e) => drag && (e.preventDefault(), setOver(place(e, i)))}
              onDrop={(e) => (e.preventDefault(), drop())}
              onDragEnd={() => (setDrag(null), setOver(null))}
            >
              <button type="button" className="flow-tile" onClick={() => onOpen(id)} onKeyDown={(e) => keys(e, id, i)} aria-label={`${i + 1}. ${p.name}${onAir === id ? ", on screen" : ""}. Open`}>
                <span className="flow-thumb" style={p.background ? { background: p.background } : undefined} aria-hidden="true">
                  {p.cards[0]?.text.slice(0, 60) || p.media[0]?.file || ""}
                </span>
                <span className="flow-name">
                  {canEdit && <GripVertical aria-hidden="true" size={14} />}
                  <b>{i + 1}</b> {p.name}
                </span>
                <small>{onAir === id ? "On screen" : tx ? `${tx}` : ""}</small>
              </button>
            </li>
          );
        })}
        {canEdit && (
          <li className="flow-add">
            <button type="button" className="flow-tile" onClick={onAdd} disabled={addDisabled}>
              <Plus aria-hidden="true" size={22} />
              <span className="flow-name">Add Frame</span>
            </button>
          </li>
        )}
      </ol>
      <p id="flow-line-hint" className="workspace-hint">
        {canEdit ? "Drag a Frame to a new place, or select it and press Alt + arrow keys. Click to open it." : "Click a Frame to see it."}
      </p>
    </div>
  );
}

/** "Choose Animation": the transitions as buttons, each showing its movement when pointed at. */
export function TransitionPicker({ value, onChange }: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <fieldset className="flow-tx">
      <legend>Choose Animation</legend>
      <div role="radiogroup" aria-label="Transition into this Frame">
        {TRANSITIONS.map(([name, v]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? "is-on" : undefined} onClick={() => onChange(v)}>
            <i className={`pv-${v}`} aria-hidden="true" />
            {v === "profile" ? "Meeting style" : name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Stage({ p }: Readonly<{ p: FramePreview }>) {
  return (
    <div className={`pv-scene pv-${p.transition}`} style={p.background ? { background: p.background } : undefined}>
      {p.cards.length === 0 && p.media.length === 0 && <p className="pv-empty">Nothing on screen yet: add Content to this Frame.</p>}
      {p.media.map((m) => (
        <span key={m.kind + m.file} className="pv-media">
          {m.kind === "pdf" ? "Slides" : m.kind[0].toUpperCase() + m.kind.slice(1)}: {m.file || "chosen on the PC"}
        </span>
      ))}
      {p.cards.map((c, i) => (
        <div key={i} className={`pv-card pv-${c.kind}`}>
          {c.label && <em>{c.label}</em>}
          <p>{c.text}</p>
          {c.sub && <small>{c.sub}</small>}
        </div>
      ))}
    </div>
  );
}

/** The Preview: each Frame as people will see it (an approximation), with its transition and the script. */
export function PreviewDialog({ frames, start, styleTx, onClose }: Readonly<{ frames: Obj[]; start: number; styleTx: string; onClose: () => void }>) {
  const ref = useRef<HTMLDialogElement>(null);
  const [at, setAt] = useState(start);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const n = frames.length;
  const go = (d: number) => setAt((v) => Math.max(0, Math.min(n - 1, v + d)));
  const p = previewOf(frames[at] ?? {}, { styleTransition: styleTx });
  return (
    <dialog
      ref={ref}
      className="fd-confirm flow-preview"
      aria-label="Preview"
      onClose={onClose}
      onKeyDown={(e) => (e.key === "ArrowRight" ? go(1) : e.key === "ArrowLeft" ? go(-1) : null)}
    >
      <header>
        <strong>
          Preview · {at + 1} of {n} · {p.name}
        </strong>
        <button type="button" className="fd-btn fd-btn-glass flow-x" aria-label="Close the Preview" onClick={() => ref.current?.close()}>
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      <div className="pv-stage" aria-live="polite">
        <Stage key={at} p={p} />
      </div>
      <nav className="pv-nav" aria-label="Frames">
        <button type="button" className="fd-btn fd-btn-glass" disabled={at === 0} onClick={() => go(-1)}>
          <ChevronLeft aria-hidden="true" size={16} /> Previous
        </button>
        <span>{TX_NAME[p.transition] ?? p.transition}</span>
        <button type="button" className="fd-btn fd-btn-primary" disabled={at >= n - 1} onClick={() => go(1)}>
          Next <ChevronRight aria-hidden="true" size={16} />
        </button>
      </nav>
      <section className="pv-script" aria-label="Teleprompter script">
        <small>Teleprompter (only the presenter sees this)</small>
        <p>{p.script || "No script for this Frame."}</p>
      </section>
    </dialog>
  );
}
