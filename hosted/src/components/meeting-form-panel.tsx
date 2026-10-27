"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

import { KindIcon } from "@/components/content-kind";
import { NotSetUp, WorkspaceGate } from "@/components/workspace-gate";
import { moveFrame } from "@/lib/frame-edit";
import {
  BACKGROUNDS,
  CARD_ANIMATIONS,
  CONTENT_TYPES,
  LIMITS,
  MEETING_FIELDS,
  TEXT_ANIMATIONS,
  TRANSITIONS,
  TYPE_NAME,
  emptyFrame,
  emptyRow,
  frameCountProblem,
  frameFormOf,
  frameFromForm,
  meetingFormOf,
  meetingFromForm,
  problemsOf,
  rebaseFrame,
  uniqueName,
  withFrame,
  type ContentRow,
  type ContentType,
  type FrameForm,
  type MeetingForm,
  type QuestionRow,
  type ScriptureRow,
} from "@/lib/meeting-form";
import { browserSupabase } from "@/lib/supabase-browser";
import { shortDate } from "@/lib/when";
import { PROFILES, profileOf } from "@/lib/workspace-settings";
import { join, type JsonObject } from "@/lib/sync-entities";
import { pullWorkspace, pushChanges, pushRecord, syncNotSetUp, type PulledRecord } from "@/lib/workspace-sync";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";

type Obj = { [key: string]: unknown };
type Loaded = { records: PulledRecord[]; onAir: string | null } | "not-set-up" | { error: string };
type Notice = { ok: boolean; text: string } | null;

const key = (kind: string, id: string) => `${kind}/${id}`;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const SAVED = "Saved. The service PC picks it up within about a minute.";
const SAVED_LIVE = "Saved. This Frame is on screen now: the PC applies your change when it leaves the screen.";

// The website's Meeting Form (docs/architecture/meeting-form.md): the Excel Meeting Form's sections, on the live plan.
// Owners and admins add, change, move and delete Frames and their Content; everyone else reads it. Every save goes
// to the workspace with sync_push on top of the revision it was read at, and the PC applies it like any other edit.
function Planner({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const canEdit = workspace.role === "owner" || workspace.role === "admin";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // a Frame id, or "new"
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { records, error } = await pullWorkspace(supabase, workspace.id);
    if (error) return setLoaded(syncNotSetUp(error) ? "not-set-up" : { error: error.message });
    const pcs = await supabase.rpc("remote_computers", { org: workspace.id });
    const statuses = ((pcs.data as { status: { frame?: { id: string } | null } | null }[] | null) ?? []).map((p) => p.status);
    setLoaded({ records, onAir: statuses.find((s) => s?.frame)?.frame?.id ?? null });
  }, [supabase, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loaded === null) return <PageSkeleton />;
  if (loaded === "not-set-up") return <NotSetUp />;
  if ("error" in loaded) return <ErrorState text={loaded.error} onRetry={load} />;

  const records = loaded.records;
  const byKey = new Map(records.map((r) => [key(r.kind, r.id), r]));
  const { doc } = join(records, {});
  const scenes = (Array.isArray(doc.scenes) ? (doc.scenes as unknown[]) : []).filter(isObj);
  const frames = scenes.filter((s) => !s.tpl);
  const meetingRecord = byKey.get(key("meeting", "meeting"));
  const order = byKey.get(key("order", "order")) ?? null;
  const brand = isObj(doc.brand) ? (doc.brand as JsonObject) : {};
  const title = String((isObj(doc.meeting) ? doc.meeting.title : "") ?? "");

  function upsert(record: PulledRecord) {
    setLoaded((current) => {
      if (!current || typeof current !== "object" || !("records" in current)) return current;
      const others = current.records.filter((r) => key(r.kind, r.id) !== key(record.kind, record.id));
      return { ...current, records: [...others, record] };
    });
  }
  function drop(kind: string, id: string) {
    setLoaded((current) =>
      current && typeof current === "object" && "records" in current
        ? { ...current, records: current.records.filter((r) => key(r.kind, r.id) !== key(kind, id)) }
        : current,
    );
  }

  async function move(id: string, delta: -1 | 1) {
    if (!supabase || !order || busy) return;
    setBusy(true);
    setNotice(null);
    const body = moveFrame(order.body as Obj, frames.map((f) => String(f.id)), id, delta);
    const answer = await pushRecord(supabase, workspace.id, order, body);
    setBusy(false);
    if (answer.status === "ok") {
      upsert({ ...order, body: body as PulledRecord["body"], rev: answer.rev });
      setNotice({ ok: true, text: "Order saved. The service PC picks it up within about a minute." });
    } else if (answer.status === "conflict") {
      setNotice({ ok: false, text: "The order changed on the PC meanwhile. Here is the latest; move it again if needed." });
      await load();
    } else setNotice({ ok: false, text: answer.message });
  }

  async function remove(frame: Obj) {
    const record = byKey.get(key("frame", String(frame.id)));
    if (!supabase || !record || busy) return;
    if (!window.confirm(`Delete “${String(frame.name)}”? It stays under Running order → Deleted in the last 30 days.`)) return;
    setBusy(true);
    setNotice(null);
    const changes: Parameters<typeof pushChanges>[2] = [{ kind: "frame", id: record.id, rev: record.rev, deleted: true }];
    const orderBody = order ? { ...(order.body as Obj), scenes: ((order.body as Obj).scenes as string[] ?? []).filter((s) => s !== record.id) } : null;
    if (order && orderBody) changes.push({ kind: "order", id: "order", rev: order.rev, body: orderBody });
    const [answer, orderAnswer] = await pushChanges(supabase, workspace.id, changes);
    setBusy(false);
    if (answer.status === "ok") {
      drop("frame", record.id);
      if (order && orderBody && orderAnswer?.status === "ok") upsert({ ...order, body: orderBody as PulledRecord["body"], rev: orderAnswer.rev });
      setNotice({ ok: true, text: `“${String(frame.name)}” deleted. Restore it from the Running order within 30 days.` });
    } else if (answer.status === "conflict") {
      setNotice({ ok: false, text: "This Frame changed on the PC meanwhile. Here is the latest; delete it again if needed." });
      await load();
    } else setNotice({ ok: false, text: answer.message });
  }

  return (
    <>
      <p className="page-note">
        {title ? <strong>{title}</strong> : null}
        {title ? " · " : null}
        {frames.length} Frame{frames.length === 1 ? "" : "s"}.{" "}
        {canEdit
          ? "Plan the whole meeting here, as in the Excel Meeting Form: Frames, their Content, questions and scripture. Pictures, video and PowerPoint files stay on the service PC; type their file names."
          : "View only: owners and admins can edit."}
      </p>
      {notice && (
        <p className={notice.ok ? "workspace-notice" : "workspace-problem"} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      )}

      <MeetingDetails
        record={meetingRecord}
        canEdit={canEdit}
        workspaceId={workspace.id}
        onSaved={(r) => {
          upsert(r);
          setNotice({ ok: true, text: "Meeting details saved." });
        }}
        onConflict={load}
      />

      <TransitionStyle
        record={byKey.get(key("layout", "profile"))}
        canEdit={canEdit}
        workspaceId={workspace.id}
        onSaved={(r, name) => {
          upsert(r);
          setNotice({ ok: true, text: `Transition style: ${name}. The service PC picks it up within about a minute.` });
        }}
        onConflict={load}
      />

      <h2 className="section-title">Frames</h2>
      {frames.length === 0 && editing !== "new" && (
        <EmptyState title="No Frames yet">
          {canEdit ? "Add the first one below. " : null}They appear in FRAMEDECKS once the service PC is linked under{" "}
          <Link href="/computers">Computers</Link>.
        </EmptyState>
      )}
      <ol className="frame-list">
        {frames.map((frame, i) => {
          const id = String(frame.id);
          const record = byKey.get(key("frame", id));
          const onAir = loaded.onAir === id;
          if (editing === id && record) {
            return (
              <FrameFormEditor
                key={id}
                number={i + 1}
                record={record}
                onAir={onAir}
                workspaceId={workspace.id}
                brandColor={String(brand.color ?? "")}
                otherNames={frames.filter((f) => f.id !== frame.id).map((f) => String(f.name))}
                onDone={(saved, text) => {
                  if (saved) saved.forEach(upsert);
                  setEditing(null);
                  if (text) setNotice({ ok: true, text });
                }}
                onReplace={upsert}
              />
            );
          }
          const form = frameFormOf(frame);
          return (
            <li className="frame-card" key={id}>
              <header>
                <span className="frame-number">{i + 1}</span>
                <h3>{form.name}</h3>
                {onAir && <span className="live-flag">On screen</span>}
                {canEdit && record && (
                  <span className="frame-actions">
                    <button type="button" aria-label={`Move ${form.name} up`} disabled={busy || i === 0} onClick={() => move(id, -1)}>
                      <ArrowUp aria-hidden="true" size={15} />
                    </button>
                    <button type="button" aria-label={`Move ${form.name} down`} disabled={busy || i === frames.length - 1} onClick={() => move(id, 1)}>
                      <ArrowDown aria-hidden="true" size={15} />
                    </button>
                    <button type="button" aria-label={`Edit ${form.name}`} disabled={editing !== null} onClick={() => (setNotice(null), setEditing(id))}>
                      <Pencil aria-hidden="true" size={15} /> Edit
                    </button>
                    <button className="is-danger" type="button" aria-label={`Delete ${form.name}`} title={`Delete ${form.name}`} disabled={busy || editing !== null || onAir} onClick={() => remove(frame)}>
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </span>
                )}
              </header>
              {form.desc && <p className="workspace-hint">{form.desc}</p>}
              {form.content.length === 0 ? (
                <p className="workspace-hint">No Content.</p>
              ) : (
                <ul className="content-list">
                  {form.content.map((row, j) => (
                    <li key={row.layerId ?? j}>
                      <span className="content-title" title={row.type === "other" ? undefined : TYPE_NAME[row.type]}>
                        <KindIcon kind={row.type === "other" ? String(row.kind ?? "") : row.type} />
                        {row.name.trim() || (row.type === "other" ? "Content" : TYPE_NAME[row.type])}
                      </span>
                      {summary(row) && <span className="content-line">{summary(row)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {editing === "new" && (
          <FrameFormEditor
            key="new"
            number={frames.length + 1}
            record={null}
            order={order}
            onAir={false}
            workspaceId={workspace.id}
            brandColor={String(brand.color ?? "")}
            group={title}
            otherNames={frames.map((f) => String(f.name))}
            onDone={(saved, text) => {
              if (saved) saved.forEach(upsert);
              setEditing(null);
              if (text) setNotice({ ok: true, text });
            }}
            onReplace={upsert}
          />
        )}
      </ol>
      {canEdit && editing === null && (
        <button
          className="live-btn live-primary planner-add"
          type="button"
          disabled={!!frameCountProblem(frames.length)}
          title={frameCountProblem(frames.length) ?? undefined}
          onClick={() => (setNotice(null), setEditing("new"))}
        >
          <Plus aria-hidden="true" size={16} /> Add a Frame
        </button>
      )}
    </>
  );
}

function summary(row: ContentRow): string {
  if (row.type === "other") return "Edited on the service PC";
  if (row.type === "question") {
    const asked = row.questions.map((q) => q.text.trim()).filter(Boolean);
    return asked.length ? asked[0] + (asked.length > 1 ? ` (+${asked.length - 1} more)` : "") : "No questions yet";
  }
  if (row.type === "scripture") return row.scriptures.map((v) => [v.ref, v.version].filter(Boolean).join(" ")).join(" · ") || "No readings yet";
  if (["image", "video", "powerpoint", "audio"].includes(row.type)) return row.main ? `${row.main} · on the service PC` : "File chosen on the service PC";
  if (row.type === "countdown") return row.duration ? (row.duration.includes(":") ? `Until ${row.duration}` : `${row.duration} min`) : "";
  return [row.label, row.main].filter((v) => v && v.trim().toLowerCase() !== row.name.trim().toLowerCase()).join(" · ");
}

// ---- Meeting details (the meeting record) ----

// The transition every Frame uses unless it has its own (the program's Settings → Transitions; record layout/profile)
function TransitionStyle({
  record,
  canEdit,
  workspaceId,
  onSaved,
  onConflict,
}: Readonly<{
  record: PulledRecord | undefined;
  canEdit: boolean;
  workspaceId: string;
  onSaved: (r: PulledRecord, name: string) => void;
  onConflict: () => void;
}>) {
  const supabase = browserSupabase();
  const current = profileOf(record?.body);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function choose(id: string) {
    if (!supabase || id === current || busy) return;
    setBusy(true);
    setProblem(null);
    const base = record ?? { kind: "layout" as const, id: "profile", rev: 0, seq: 0, body: null };
    const body = { value: id };
    const answer = await pushRecord(supabase, workspaceId, base, body);
    setBusy(false);
    if (answer.status === "ok") onSaved({ ...base, kind: "layout", body, rev: answer.rev }, PROFILES.find((p) => p.id === id)?.name ?? id);
    else if (answer.status === "conflict") {
      setProblem("The transition style changed on the PC meanwhile. Here is the latest; choose again if needed.");
      onConflict();
    } else setProblem(answer.message);
  }

  return (
    <section className="frame-card fd-style-card" data-reveal>
      <header>
        <h3>Transition style</h3>
        <span className="workspace-hint">How every Frame moves on screen, unless a Frame has its own transition.</span>
      </header>
      <div className="fd-style-grid" role="radiogroup" aria-label="Transition style">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === current}
            disabled={!canEdit || busy}
            className={p.id === current ? "fd-style fd-style-on" : "fd-style"}
            onClick={() => choose(p.id)}
          >
            <strong>{p.name}</strong>
            <span>{p.feel}</span>
          </button>
        ))}
      </div>
      {problem && (
        <p className="workspace-problem" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}

function MeetingDetails({
  record,
  canEdit,
  workspaceId,
  onSaved,
  onConflict,
}: Readonly<{ record: PulledRecord | undefined; canEdit: boolean; workspaceId: string; onSaved: (r: PulledRecord) => void; onConflict: () => void }>) {
  const supabase = browserSupabase();
  const [form, setForm] = useState<MeetingForm>(() => meetingFormOf(record?.body));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(!record);
  const base = record ?? { kind: "meeting" as const, id: "meeting", rev: 0, seq: 0, body: {} };

  async function save() {
    if (!supabase) return;
    setBusy(true);
    setProblem(null);
    const body = meetingFromForm(form, record?.body);
    const answer = await pushRecord(supabase, workspaceId, base, body);
    setBusy(false);
    if (answer.status === "ok") onSaved({ ...base, kind: "meeting", body: body as PulledRecord["body"], rev: answer.rev });
    else if (answer.status === "conflict") {
      setProblem("The meeting details changed on the PC meanwhile. The latest are shown now; make your change again.");
      setForm(meetingFormOf(answer.current.body));
      onConflict();
    } else setProblem(answer.message);
  }

  return (
    <details className="frame-card frame-editing planner-meeting" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <strong>Meeting details</strong>
        <span className="workspace-hint">{form.title || "No meeting name yet"}{form.date ? ` · ${shortDate(`${form.date}T12:00:00`)}` : ""}</span>
      </summary>
      <div className="planner-grid">
        {MEETING_FIELDS.map(([k, label, max]) => (
          <label key={k} className={max > 200 ? "planner-wide" : undefined}>
            {label}
            {max > 200 ? (
              <textarea rows={2} maxLength={max} value={form[k]} disabled={!canEdit} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            ) : (
              <input maxLength={max} value={form[k]} disabled={!canEdit} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      {problem && (
        <p className="workspace-problem" role="alert">
          {problem}
        </p>
      )}
      {canEdit && (
        <div className="edit-actions">
          <button className="live-btn live-primary" type="button" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save details"}
          </button>
        </div>
      )}
    </details>
  );
}

// ---- One Frame, as the Excel form's Frames, Content, Questions and Scriptures tables ----

function FrameFormEditor({
  number,
  record,
  order = null,
  onAir,
  workspaceId,
  brandColor,
  group = "",
  otherNames,
  onDone,
  onReplace,
}: Readonly<{
  number: number;
  record: PulledRecord | null;
  order?: PulledRecord | null;
  onAir: boolean;
  workspaceId: string;
  brandColor: string;
  group?: string;
  otherNames: string[];
  onDone: (saved: PulledRecord[] | null, text?: string) => void;
  onReplace: (record: PulledRecord) => void;
}>) {
  const supabase = browserSupabase();
  const [base, setBase] = useState(record);
  const [initial, setInitial] = useState<FrameForm>(() => (record ? frameFormOf(record.body as Obj) : emptyFrame()));
  const [draft, setDraft] = useState<FrameForm>(() => (record ? frameFormOf(record.body as Obj) : { ...emptyFrame(), content: [emptyRow("question")] }));
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [addType, setAddType] = useState<ContentType>("question");

  const setRow = (i: number, row: ContentRow) => setDraft((d) => ({ ...d, content: d.content.map((r, j) => (j === i ? row : r)) }));
  const moveRow = (i: number, delta: -1 | 1) =>
    setDraft((d) => {
      const content = [...d.content];
      const to = i + delta;
      if (to < 0 || to >= content.length) return d;
      [content[i], content[to]] = [content[to], content[i]];
      return { ...d, content };
    });

  async function save() {
    if (!supabase) return;
    const found = problemsOf(draft);
    setProblems(found);
    if (found.length) return;
    setBusy(true);
    if (!base) {
      // A new Frame: its record and the order that lists it, in one push
      const body = frameFromForm({ ...draft, name: uniqueName(otherNames, draft.name) }, null, { brandColor, group });
      const id = String(body.id);
      const orderBody = withFrame((order?.body as Obj) ?? null, id);
      const [frameAnswer, orderAnswer] = await pushChanges(supabase, workspaceId, [
        { kind: "frame", id, rev: 0, body },
        { kind: "order", id: "order", rev: order?.rev ?? 0, body: orderBody },
      ]);
      setBusy(false);
      if (frameAnswer.status !== "ok") return setProblems([frameAnswer.status === "error" ? frameAnswer.message : "The Frame could not be saved; try again."]);
      const saved: PulledRecord[] = [{ kind: "frame", id, rev: frameAnswer.rev, seq: 0, body: body as PulledRecord["body"] }];
      if (orderAnswer.status === "ok" && order) saved.push({ ...order, body: orderBody as PulledRecord["body"], rev: orderAnswer.rev });
      else if (orderAnswer.status === "ok") saved.push({ kind: "order", id: "order", rev: orderAnswer.rev, seq: 0, body: orderBody as PulledRecord["body"] });
      // If only the order conflicted, the PC still shows the new Frame (at the end of the meeting)
      onDone(saved, orderAnswer.status === "ok" ? `“${String(body.name)}” added. ${SAVED}` : `“${String(body.name)}” added at the end of the meeting. ${SAVED}`);
      return;
    }
    const body = frameFromForm(draft, base.body as Obj, { brandColor });
    const answer = await pushRecord(supabase, workspaceId, base, body);
    setBusy(false);
    if (answer.status === "ok") onDone([{ ...base, body: body as PulledRecord["body"], rev: answer.rev }], onAir ? SAVED_LIVE : SAVED);
    else if (answer.status === "conflict") {
      if (answer.current.deleted || !answer.current.body) {
        setProblems(["This Frame was deleted on the PC while you were editing. Copy your text if you need it, then Cancel."]);
        return;
      }
      const latest = { ...base, rev: answer.current.rev, body: answer.current.body as PulledRecord["body"] };
      const fresh = frameFormOf(latest.body as Obj);
      setDraft(rebaseFrame(fresh, draft, initial));
      setInitial(fresh);
      setBase(latest);
      onReplace(latest);
      setProblems(["This Frame was changed on the PC (or by someone else) while you were editing. The form now shows the latest version with your changes kept: check it and Save again."]);
    } else setProblems([answer.message]);
  }

  const customBg = !BACKGROUNDS.some(([n]) => n === draft.background);
  return (
    <li className="frame-card frame-editing">
      <header>
        <span className="frame-number">{number}</span>
        <h3>{base ? `Edit ${draft.name || "Frame"}` : "New Frame"}</h3>
        {onAir && <span className="live-flag">On screen</span>}
      </header>
      {onAir && <p className="workspace-hint">This Frame is on screen now. The PC applies your change when it leaves the screen.</p>}
      <div className="planner-grid">
        <label>
          Frame name
          <input value={draft.name} maxLength={LIMITS.name} placeholder="Welcome" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label>
          Purpose / description
          <input value={draft.desc} maxLength={200} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} />
        </label>
        <label>
          Background
          <select value={customBg ? "custom" : draft.background} onChange={(e) => setDraft({ ...draft, background: e.target.value === "custom" ? "#1f3a6d" : e.target.value })}>
            {BACKGROUNDS.map(([n]) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="custom">Colour…</option>
          </select>
          {customBg && (
            <input aria-label="Background colour" value={draft.background} maxLength={7} placeholder="#1F3A6D" onChange={(e) => setDraft({ ...draft, background: e.target.value })} />
          )}
        </label>
        <label>
          Transition
          <select value={draft.transition} onChange={(e) => setDraft({ ...draft, transition: e.target.value })}>
            {TRANSITIONS.map(([n, v]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="edit-script">
        Presenter script (Teleprompter, never on screen)
        <textarea rows={4} maxLength={LIMITS.script} value={draft.script} onChange={(e) => setDraft({ ...draft, script: e.target.value })} />
      </label>

      <h4 className="planner-sub">Content</h4>
      {draft.content.map((row, i) => (
        <ContentEditor
          key={row.layerId ?? `new-${i}`}
          row={row}
          index={i}
          count={draft.content.length}
          onChange={(r) => setRow(i, r)}
          onMove={(d) => moveRow(i, d)}
          onRemove={() => setDraft((d) => ({ ...d, content: d.content.filter((_, j) => j !== i) }))}
        />
      ))}
      <div className="planner-add-row">
        <select aria-label="Type of Content to add" value={addType} onChange={(e) => setAddType(e.target.value as ContentType)}>
          {CONTENT_TYPES.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
        <button
          className="member-action"
          type="button"
          disabled={draft.content.length >= LIMITS.layers - 1}
          onClick={() => setDraft((d) => ({ ...d, content: [...d.content, emptyRow(addType)] }))}
        >
          <Plus aria-hidden="true" size={14} /> Add Content
        </button>
      </div>

      {problems.length > 0 && (
        <div className="workspace-problem" role="alert">
          {problems.length === 1 ? (
            problems[0]
          ) : (
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="edit-actions">
        <button className="live-btn live-primary" type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : base ? "Save" : "Add Frame"}
        </button>
        <button className="live-btn" type="button" disabled={busy} onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </li>
  );
}

function ContentEditor({
  row,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: Readonly<{ row: ContentRow; index: number; count: number; onChange: (r: ContentRow) => void; onMove: (d: -1 | 1) => void; onRemove: () => void }>) {
  const set = (patch: Partial<ContentRow>) => onChange({ ...row, ...patch });
  const t = row.type;
  const head = (
    <div className="planner-content-head">
      <span className="frame-number">{index + 1}</span>
      {t === "other" ? (
        <strong>{row.name}</strong>
      ) : (
        <>
          <select
            aria-label={`Type of Content ${index + 1}`}
            value={t}
            onChange={(e) => {
              const type = e.target.value as ContentType;
              onChange({ ...emptyRow(type), layerId: row.layerId, name: row.name === TYPE_NAME[t as ContentType] ? TYPE_NAME[type] : row.name, label: row.label, main: row.main });
            }}
          >
            {CONTENT_TYPES.map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
          <input aria-label={`Name of Content ${index + 1}`} value={row.name} maxLength={LIMITS.layerName} onChange={(e) => set({ name: e.target.value })} />
        </>
      )}
      <span className="frame-actions">
        <button type="button" aria-label={`Move Content ${index + 1} up`} disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp aria-hidden="true" size={14} />
        </button>
        <button type="button" aria-label={`Move Content ${index + 1} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDown aria-hidden="true" size={14} />
        </button>
        <button type="button" aria-label={`Remove Content ${index + 1}`} onClick={onRemove}>
          <Trash2 aria-hidden="true" size={14} />
        </button>
      </span>
    </div>
  );

  return (
    <fieldset className="edit-list planner-content">
      {head}
      {t === "other" && <p className="workspace-hint">{row.kind} Content: edited on the service PC.</p>}
      {(t === "question" || t === "scripture") && (
        <div className="planner-grid">
          <label>
            On-screen label
            <input value={row.label} maxLength={LIMITS.label} onChange={(e) => set({ label: e.target.value })} />
          </label>
          <AnimationSelect value={row.anim} options={CARD_ANIMATIONS} onChange={(anim) => set({ anim })} />
        </div>
      )}
      {t === "question" && <QuestionList rows={row.questions} onChange={(questions) => set({ questions })} />}
      {t === "scripture" && <ScriptureList rows={row.scriptures} onChange={(scriptures) => set({ scriptures })} />}
      {(t === "text" || t === "prayer" || t === "lowerthird") && (
        <>
          <div className="planner-grid">
            <label>
              {t === "lowerthird" ? "Name (title)" : "Title (optional)"}
              <input value={row.label} maxLength={LIMITS.label} onChange={(e) => set({ label: e.target.value })} />
            </label>
            <AnimationSelect value={row.anim} options={TEXT_ANIMATIONS} onChange={(anim) => set({ anim })} />
          </div>
          <label className="edit-script">
            {t === "lowerthird" ? "Second line" : "Text"}
            <textarea rows={t === "lowerthird" ? 1 : 3} maxLength={LIMITS.text} value={row.main} onChange={(e) => set({ main: e.target.value })} />
          </label>
        </>
      )}
      {t === "countdown" && (
        <div className="planner-grid">
          <label>
            Title
            <input value={row.label} maxLength={LIMITS.label} placeholder="Starting in" onChange={(e) => set({ label: e.target.value })} />
          </label>
          <label>
            Duration: minutes (5) or until a time (10:30)
            <input value={row.duration} maxLength={8} placeholder="5" onChange={(e) => set({ duration: e.target.value })} />
          </label>
        </div>
      )}
      {(t === "image" || t === "video" || t === "powerpoint" || t === "audio") && (
        <div className="planner-grid">
          <label>
            File name in the service PC&apos;s media folder (optional)
            <input value={row.main} maxLength={LIMITS.short} placeholder={t === "powerpoint" ? "sermon.pptx" : t === "audio" ? "intro.mp3" : t === "video" ? "intro.mp4" : "welcome.jpg"} onChange={(e) => set({ main: e.target.value })} />
          </label>
          {t === "powerpoint" && (
            <label>
              PowerPoint background
              <select value={row.pptBg} onChange={(e) => set({ pptBg: e.target.value as "show" | "hide" })}>
                <option value="show">Show</option>
                <option value="hide">Hide</option>
              </select>
            </label>
          )}
        </div>
      )}
      {(t === "camera" || t === "screen") && <p className="workspace-hint">Choose the {t === "camera" ? "webcam" : "screen to share"} on the service PC.</p>}
    </fieldset>
  );
}

function AnimationSelect({ value, options, onChange }: Readonly<{ value: string; options: [string, string][]; onChange: (v: string) => void }>) {
  return (
    <label>
      Animation
      <select value={options.some(([, v]) => v === value) ? value : ""} onChange={(e) => onChange(e.target.value)}>
        {options.map(([n, v]) => (
          <option key={v || "default"} value={v}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

function QuestionList({ rows, onChange }: Readonly<{ rows: QuestionRow[]; onChange: (rows: QuestionRow[]) => void }>) {
  const set = (j: number, patch: Partial<QuestionRow>) => onChange(rows.map((r, k) => (k === j ? { ...r, ...patch } : r)));
  return (
    <div className="planner-items">
      {rows.map((q, j) => (
        <div className="planner-item" key={q.id ?? `new${j}`}>
          <textarea aria-label={`Question ${j + 1}`} rows={2} placeholder={`Question ${j + 1}`} value={q.text} maxLength={LIMITS.itemText} onChange={(e) => set(j, { text: e.target.value })} />
          <input aria-label={`Label of question ${j + 1}`} placeholder="Label (optional)" value={q.label} maxLength={LIMITS.short} onChange={(e) => set(j, { label: e.target.value })} />
          <input aria-label={`Timer of question ${j + 1}`} placeholder="Timer (min)" value={q.timer} maxLength={5} onChange={(e) => set(j, { timer: e.target.value })} />
          <button type="button" aria-label={`Remove question ${j + 1}`} onClick={() => onChange(rows.filter((_, k) => k !== j))}>
            <Trash2 aria-hidden="true" size={14} />
          </button>
        </div>
      ))}
      <button className="member-action" type="button" onClick={() => onChange([...rows, { label: "", text: "", media: "", timer: "", anim: "" }])}>
        <Plus aria-hidden="true" size={14} /> Add question
      </button>
    </div>
  );
}

function ScriptureList({ rows, onChange }: Readonly<{ rows: ScriptureRow[]; onChange: (rows: ScriptureRow[]) => void }>) {
  const set = (j: number, patch: Partial<ScriptureRow>) => onChange(rows.map((r, k) => (k === j ? { ...r, ...patch } : r)));
  return (
    <div className="planner-items">
      {rows.map((v, j) => (
        <div className="planner-item planner-verse" key={v.id ?? `new${j}`}>
          <input aria-label={`Reference ${j + 1}`} placeholder="John 15:5" value={v.ref} maxLength={LIMITS.short} onChange={(e) => set(j, { ref: e.target.value })} />
          <input aria-label={`Translation ${j + 1}`} placeholder="ESV" value={v.version} maxLength={40} onChange={(e) => set(j, { version: e.target.value })} />
          <input aria-label={`Label of reading ${j + 1}`} placeholder="Label (optional)" value={v.label} maxLength={LIMITS.short} onChange={(e) => set(j, { label: e.target.value })} />
          <button type="button" aria-label={`Remove reading ${j + 1}`} onClick={() => onChange(rows.filter((_, k) => k !== j))}>
            <Trash2 aria-hidden="true" size={14} />
          </button>
          <textarea
            aria-label={`Verse text ${j + 1}`}
            rows={2}
            placeholder="Verse text (optional: leave empty and fetch it on the PC)"
            value={v.text}
            maxLength={LIMITS.itemText}
            onChange={(e) => set(j, { text: e.target.value })}
          />
        </div>
      ))}
      <button className="member-action" type="button" onClick={() => onChange([...rows, { label: "", ref: "", version: "", text: "", anim: "" }])}>
        <Plus aria-hidden="true" size={14} /> Add reading
      </button>
    </div>
  );
}

export function MeetingFormPanel() {
  return <WorkspaceGate what="your meeting">{(w) => <Planner key={w.id} workspace={w} />}</WorkspaceGate>;
}
