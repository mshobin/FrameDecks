"use client";

// FrameDecks 8.3 - the guided Plan workflow (lib/frame-flow.ts): the five steps with the Sync status, the timeline
// whose Frames are dragged into order, the transition picker and the Preview. Used by meeting-form-panel.tsx.
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from "react";
import { AlertTriangle, CalendarDays, Pencil, Check, ChevronLeft, ChevronRight, CloudOff, GripVertical, Loader2, Plus, Trash2, X } from "lucide-react";

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

/** Smooth moves (8.5): children with data-flip glide from where they were to where they are after a change (FLIP),
 * and new ones fade in. Nothing moves under "reduce motion". */
export function useFlip(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  const last = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = new Map<string, DOMRect>();
    box.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      const id = el.dataset.flip ?? "";
      const now = el.getBoundingClientRect();
      const was = last.current.get(id);
      seen.set(id, now);
      if (calm || typeof el.animate !== "function") return;
      if (was && (Math.abs(was.top - now.top) > 1 || Math.abs(was.left - now.left) > 1))
        el.animate([{ transform: `translate(${was.left - now.left}px, ${was.top - now.top}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
      else if (!was && last.current.size) el.animate([{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    });
    last.current = seen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** The meeting as a flowchart, on the right of the Plan page (8.5): the meeting at the top, then each Frame as a
 * connected card with a small picture, what it shows and a delete button. Drag a card (or Alt + ↑ / ↓) to move it. */
export function FlowChart({
  meeting,
  frames,
  onAir,
  active,
  canEdit,
  busy,
  onMove,
  onOpen,
  onDelete,
  onAdd,
  addDisabled,
  onMeeting,
}: Readonly<{
  meeting: { name: string; date: string };
  frames: Obj[];
  onAir: string | null;
  active: string | null;
  canEdit: boolean;
  busy: boolean;
  onMove: (id: string, to: number) => void;
  onOpen: (id: string) => void;
  onDelete: (frame: Obj) => void;
  onAdd: () => void;
  addDisabled: boolean;
  onMeeting: () => void;
}>) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const list = useRef<HTMLOListElement>(null);
  useFlip(list, [frames.map((f) => String(f.id)).join(), meeting.name]);

  function place(e: DragEvent<HTMLLIElement>, i: number) {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2 ? i + 1 : i;
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
    const d = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    if (i + d >= 0 && i + d < frames.length) onMove(id, i + d);
  }

  return (
    <ol className="fc" ref={list} aria-label={`The meeting “${meeting.name}”, Frame by Frame`} aria-describedby="fc-hint">
      <li className="fc-start" data-flip="@meeting">
        <button type="button" className="fc-head" onClick={onMeeting}>
          <CalendarDays aria-hidden="true" size={18} />
          <span>
            <strong>{meeting.name}</strong>
            <small>{meeting.date ? meeting.date : "No date yet"} · {frames.length} Frame{frames.length === 1 ? "" : "s"}</small>
          </span>
        </button>
      </li>
      {frames.map((f, i) => {
        const id = String(f.id);
        const p = previewOf(f);
        const kinds = [...new Set(p.cards.map((c) => KIND_WORD[c.kind] ?? "Text").concat(p.media.map((m) => KIND_WORD[m.kind] ?? "File")))];
        const detail = [kinds.slice(0, 2).join(" · ") || "Empty", TX_NAME[p.transition] && p.transition !== "fade" ? TX_NAME[p.transition] : ""].filter(Boolean).join(" · ");
        return (
          <li
            key={id}
            data-flip={id}
            className={["fc-node", drag === id && "is-dragging", over === i && "is-before", over === i + 1 && i === frames.length - 1 && "is-after", active === id && "is-active", onAir === id && "is-air"].filter(Boolean).join(" ")}
            draggable={canEdit && !busy}
            onDragStart={(e) => (e.dataTransfer.setData("text/plain", id), (e.dataTransfer.effectAllowed = "move"), setDrag(id))}
            onDragOver={(e) => drag && (e.preventDefault(), setOver(place(e, i)))}
            onDrop={(e) => (e.preventDefault(), drop())}
            onDragEnd={() => (setDrag(null), setOver(null))}
          >
            <span className="fc-num" aria-hidden="true">{i + 1}</span>
            <button type="button" className="fc-card" onClick={() => onOpen(id)} onKeyDown={(e) => keys(e, id, i)} aria-label={`${i + 1}. ${p.name}: ${detail}${onAir === id ? ", on screen" : ""}. Open`}>
              <span className="fc-thumb" style={p.background ? { background: p.background } : undefined} aria-hidden="true">
                {p.cards[0]?.text.slice(0, 40) ?? ""}
              </span>
              <span className="fc-text">
                <b>{p.name}</b>
                <small>{onAir === id ? "On screen now" : detail}</small>
              </span>
              {canEdit && <GripVertical className="fc-grip" aria-hidden="true" size={16} />}
            </button>
            {canEdit && (
              <button type="button" className="fc-del" aria-label={`Delete ${p.name}`} title={`Delete ${p.name}`} disabled={busy || onAir === id} onClick={() => onDelete(f)}>
                <Trash2 aria-hidden="true" size={15} />
              </button>
            )}
          </li>
        );
      })}
      {canEdit && (
        <li className="fc-end" data-flip="@add">
          <button type="button" onClick={onAdd} disabled={addDisabled}>
            <Plus aria-hidden="true" size={18} /> Add Frame
          </button>
        </li>
      )}
      <li className="fc-hint" id="fc-hint">
        {canEdit ? "Drag a Frame to move it, or select it and press Alt + ↑ / ↓." : "Click a Frame to see it."}
      </li>
    </ol>
  );
}

/** The meetings of the workspace as chips (8.5): choose one to see only its Frames; + New meeting; Rename. */
export function MeetingBar({
  list,
  selected,
  counts,
  canEdit,
  supported,
  busy,
  onSelect,
  onCreate,
  onRename,
}: Readonly<{
  list: { id: string; name: string; date: string }[];
  selected: string;
  counts: Record<string, number>;
  canEdit: boolean;
  supported: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (name: string) => void;
}>) {
  const [mode, setMode] = useState<"new" | "rename" | null>(null);
  const [name, setName] = useState("");
  const current = list.find((m) => m.id === selected);
  function done() {
    const n = name.trim();
    if (n) (mode === "new" ? onCreate : onRename)(n);
    setMode(null);
  }
  return (
    <nav className="mb" aria-label="Meetings">
      <div className="mb-chips">
        <div className="mb-tabs" role="tablist" aria-label="Choose a meeting">
        {list.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={m.id === selected} className={m.id === selected ? "is-on" : undefined} onClick={() => onSelect(m.id)}>
            <b>{m.name}</b>
            <small>{m.date ? `${m.date} · ` : ""}{counts[m.id] ?? 0} Frame{counts[m.id] === 1 ? "" : "s"}</small>
          </button>
        ))}
        </div>
        {canEdit && supported && mode === null && (
          <button type="button" className="mb-new" disabled={busy} onClick={() => (setName(""), setMode("new"))}>
            <Plus aria-hidden="true" size={16} /> New meeting
          </button>
        )}
        {canEdit && mode === null && current && (
          <button type="button" className="mb-rename" disabled={busy} onClick={() => (setName(current.name), setMode("rename"))}>
            <Pencil aria-hidden="true" size={15} /> Rename
          </button>
        )}
      </div>
      {mode && (
        <form className="mb-form" onSubmit={(e) => (e.preventDefault(), done())}>
          <label>
            {mode === "new" ? "Name of the new meeting" : "New name for this meeting"}
            <input autoFocus maxLength={60} value={name} placeholder={mode === "new" ? "Sunday Service" : ""} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setMode(null)} />
          </label>
          <button type="submit" className="fd-btn fd-btn-primary" disabled={!name.trim()}>{mode === "new" ? "Make the meeting" : "Rename"}</button>
          <button type="button" className="fd-btn fd-btn-glass" onClick={() => setMode(null)}>Cancel</button>
        </form>
      )}
      {canEdit && !supported && list.length < 2 && (
        <p className="workspace-hint">More than one meeting needs a small database update first: the workspace owner runs 0012_meetings.sql in Supabase (see the 8.5 release notes).</p>
      )}
    </nav>
  );
}

const KIND_WORD: Record<string, string> = { question: "Question", scripture: "Scripture", announcement: "Text", prayer: "Prayer", lowerthird: "Name title", countdown: "Timer", image: "Picture", video: "Video", pdf: "Slides", audio: "Audio" };

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
