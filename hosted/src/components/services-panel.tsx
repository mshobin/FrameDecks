"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, History, Pencil, Plus, Trash2 } from "lucide-react";

import { DeletedFrames, FrameHistory, loadNames, type Names } from "@/components/frame-history";

import { NotSetUp, WorkspaceGate } from "@/components/workspace-gate";
import { KindIcon } from "@/components/content-kind";
import { When } from "@/components/when";
import { applyDraft, draftOf, moveFrame, rebase, type ListDraft } from "@/lib/frame-edit";
import { describeFrames, type FrameView } from "@/lib/services-view";
import { browserSupabase } from "@/lib/supabase-browser";
import { userSafeError } from "@/lib/user-error";
import { join, type JsonObject } from "@/lib/sync-entities";
import { pullWorkspace, pushRecord, syncNotSetUp, type PulledRecord } from "@/lib/workspace-sync";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";

type Obj = { [key: string]: unknown };
type Loaded = { records: PulledRecord[]; onAir: string | null } | "not-set-up" | { error: string };
type Notice = { ok: boolean; text: string } | null;

const key = (kind: string, id: string) => `${kind}/${id}`;

// The synced plan. Everyone in the workspace reads it; owners and admins can also change the words of a Frame and
// the order of Frames (docs/architecture/companion-editing.md, E1-E4). Each change goes back with sync_push on top
// of the revision it was read at, and the PC applies it like a change from another PC.
function Services({ workspace, historyOnly = false }: Readonly<{ workspace: WorkspaceChoice; historyOnly?: boolean }>) {
  const supabase = browserSupabase();
  const canEdit = workspace.role === "owner" || workspace.role === "admin";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [names, setNames] = useState<Names | null>(null);

  useEffect(() => {
    let live = true;
    loadNames(workspace.id).then((n) => live && setNames(n));
    return () => {
      live = false;
    };
  }, [workspace.id]);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { records, error } = await pullWorkspace(supabase, workspace.id, true);
    if (error) return setLoaded(syncNotSetUp(error) ? "not-set-up" : { error: userSafeError(error, "Couldn’t load the service plan. Check your connection and try again.") });
    // The Frame on screen, when the PC shares it (Phase 5); without 0004/0005 or the switch, simply unknown
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

  const records = loaded.records.filter((r) => !r.deleted);
  const deletedFrames = loaded.records.filter((r) => r.deleted && r.kind === "frame");
  const byKey = new Map(loaded.records.map((r) => [key(r.kind, r.id), r]));
  const { doc } = join(records, {});
  const all = describeFrames(doc);
  if (!all.length) {
    return (
      <EmptyState
        title="No service plan yet"
        action={
          <Link className="fd-btn fd-btn-glass fd-btn-sm" href="/computers">
            Link the service PC
          </Link>
        }
      >
        The plan appears here once the service PC is linked to “{workspace.name}”, or when you add Frames on the Meeting Form.
      </EmptyState>
    );
  }
  const frames = all.filter((f) => !f.template);
  const templates = all.filter((f) => f.template);
  const meeting = (doc.meeting && typeof doc.meeting === "object" ? doc.meeting : {}) as JsonObject;
  const title = String(meeting.title ?? "");
  const lastChange = records.map((r) => r.updatedAt ?? "").sort().at(-1) || null;

  function replace(record: PulledRecord) {
    setLoaded((current) =>
      current && typeof current === "object" && "records" in current
        ? { ...current, records: current.records.map((r) => (key(r.kind, r.id) === key(record.kind, record.id) ? record : r)) }
        : current,
    );
  }

  function restored(saved: PulledRecord, text: string) {
    replace(saved);
    setHistoryOf(null);
    setNotice({ ok: true, text });
  }

  async function move(id: string, delta: -1 | 1) {
    const order = byKey.get(key("order", "order"));
    if (!supabase || !order || busy) return;
    setBusy(true);
    setNotice(null);
    const frameIds = records.filter((r) => r.kind === "frame").map((r) => r.id);
    const body = moveFrame(order.body as Obj, frameIds, id, delta);
    const answer = await pushRecord(supabase, workspace.id, order, body);
    setBusy(false);
    if (answer.status === "ok") {
      replace({ ...order, body: body as PulledRecord["body"], rev: answer.rev });
      setNotice({ ok: true, text: "Order saved. The service PC picks it up within about a minute." });
    } else if (answer.status === "conflict") {
      setNotice({ ok: false, text: "The order changed on the PC meanwhile. Here is the latest; move it again if needed." });
      await load();
    } else {
      setNotice({ ok: false, text: answer.message });
    }
  }

  return (
    <>
      <p className="page-note">
        {title ? <strong>{title}</strong> : null}
        {title ? " · " : null}
        {frames.length} Frame{frames.length === 1 ? "" : "s"}
        {lastChange ? <> · last change <When at={lastChange} /></> : null}.{" "}
        {historyOnly
          ? "Open a Frame's history to see who changed what, and restore an earlier version or a deleted Frame from the last 30 days."
          : canEdit
            ? "You can change names, scripts, questions, scripture and the order here; pictures, video and looks on the service PC."
            : "View only: owners and admins can edit."}
      </p>
      {notice && (
        <p className={notice.ok ? "workspace-notice" : "workspace-problem"} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      )}
      <ol className="frame-list">
        {frames.map((frame, i) => {
          const record = byKey.get(key("frame", frame.id));
          return editing === frame.id && record ? (
            <FrameEditor
              key={frame.id}
              number={i + 1}
              record={record}
              onAir={loaded.onAir === frame.id}
              workspaceId={workspace.id}
              onDone={(saved, text) => {
                if (saved) replace(saved);
                setEditing(null);
                if (text) setNotice({ ok: true, text });
              }}
              onReplace={replace}
            />
          ) : (
            <FrameCard
              frame={frame}
              key={frame.id}
              number={i + 1}
              onAir={loaded.onAir === frame.id}
              history={
                historyOf === frame.id && record ? (
                  <FrameHistory organizationId={workspace.id} record={record} canEdit={canEdit} names={names} onRestored={restored} />
                ) : null
              }
              actions={
                record ? (
                  <span className="frame-actions">
                    <button
                      type="button"
                      aria-label={`History of ${frame.name}`}
                      aria-expanded={historyOf === frame.id}
                      onClick={() => setHistoryOf(historyOf === frame.id ? null : frame.id)}
                    >
                      <History aria-hidden="true" size={15} />
                    </button>
                    {canEdit && !historyOnly && (
                      <>
                        <button type="button" aria-label={`Move ${frame.name} up`} disabled={busy || i === 0} onClick={() => move(frame.id, -1)}>
                          <ArrowUp aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${frame.name} down`}
                          disabled={busy || i === frames.length - 1}
                          onClick={() => move(frame.id, 1)}
                        >
                          <ArrowDown aria-hidden="true" size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${frame.name}`}
                          disabled={editing !== null}
                          onClick={() => {
                            setNotice(null);
                            setEditing(frame.id);
                          }}
                        >
                          <Pencil aria-hidden="true" size={15} />
                          Edit
                        </button>
                      </>
                    )}
                  </span>
                ) : null
              }
            />
          );
        })}
      </ol>
      <DeletedFrames organizationId={workspace.id} records={deletedFrames} canEdit={canEdit} names={names} onRestored={restored} />
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

function FrameEditor({
  number,
  record,
  onAir,
  workspaceId,
  onDone,
  onReplace,
}: Readonly<{
  number: number;
  record: PulledRecord;
  onAir: boolean;
  workspaceId: string;
  onDone: (saved: PulledRecord | null, text?: string) => void;
  onReplace: (record: PulledRecord) => void;
}>) {
  const supabase = browserSupabase();
  const [base, setBase] = useState(record);
  const [initial, setInitial] = useState(() => draftOf(record.body as Obj));
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const setList = (i: number, items: ListDraft["items"]) =>
    setDraft((d) => ({ ...d, lists: d.lists.map((l, j) => (j === i ? ({ ...l, items } as ListDraft) : l)) }));

  async function save() {
    if (!supabase) return;
    setBusy(true);
    setProblem(null);
    let body: Obj;
    try {
      body = applyDraft(base.body as Obj, draft, initial); // only what was changed in the form
    } catch (e) {
      setBusy(false);
      setProblem((e as Error).message);
      return;
    }
    const answer = await pushRecord(supabase, workspaceId, base, body);
    setBusy(false);
    if (answer.status === "ok") {
      onDone(
        { ...base, body: body as PulledRecord["body"], rev: answer.rev },
        onAir
          ? "Saved. This Frame is on screen now: the PC applies your change when it leaves the screen."
          : "Saved. The service PC picks it up within about a minute.",
      );
    } else if (answer.status === "conflict") {
      if (answer.current.deleted || !answer.current.body) {
        setProblem("This Frame was deleted on the PC while you were editing. Copy your text if you need it, then Cancel.");
        return;
      }
      // E4: take the latest version as the new base, keep what was typed, and ask to check and save again
      const latest = { ...base, rev: answer.current.rev, body: answer.current.body as PulledRecord["body"] };
      const next = rebase(latest.body as Obj, draft, initial);
      setBase(latest);
      setDraft(next.draft);
      setInitial(next.initial);
      onReplace(latest);
      setProblem(
        "This Frame was changed on the PC (or by someone else) while you were editing. The form now shows the latest version with your changes kept: check it and Save again.",
      );
    } else {
      setProblem(answer.message);
    }
  }

  return (
    <li className="frame-card frame-editing">
      <header>
        <span className="frame-number">{number}</span>
        <h3>Edit {draft.name || "Frame"}</h3>
        {onAir && <span className="workspace-role">On screen</span>}
      </header>
      {onAir && (
        <p className="workspace-hint">This Frame is on screen now. The PC applies your change when it leaves the screen.</p>
      )}
      <div className="edit-grid">
        <label>
          Name
          <input value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label>
          Group
          <input value={draft.group} maxLength={60} onChange={(e) => setDraft({ ...draft, group: e.target.value })} />
        </label>
      </div>
      {draft.lists.map((l, i) => (
        <fieldset className="edit-list" key={l.layerId}>
          <legend>{l.title}</legend>
          {l.kind === "question"
            ? l.items.map((it, j) => (
                <div className="edit-row" key={it.id ?? `new${j}`}>
                  <textarea
                    aria-label={`Question ${j + 1}`}
                    rows={2}
                    value={it.text}
                    onChange={(e) => setList(i, l.items.map((x, k) => (k === j ? { ...x, text: e.target.value } : x)))}
                  />
                  <button type="button" aria-label={`Remove question ${j + 1}`} onClick={() => setList(i, l.items.filter((_, k) => k !== j))}>
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </div>
              ))
            : l.items.map((it, j) => (
                <div className="edit-row edit-verse" key={it.id ?? `new${j}`}>
                  <input
                    aria-label={`Reference ${j + 1}`}
                    placeholder="John 3:16"
                    value={it.ref}
                    onChange={(e) => setList(i, l.items.map((x, k) => (k === j ? { ...x, ref: e.target.value } : x)))}
                  />
                  <input
                    aria-label={`Translation ${j + 1}`}
                    placeholder="ESV"
                    value={it.version}
                    onChange={(e) => setList(i, l.items.map((x, k) => (k === j ? { ...x, version: e.target.value } : x)))}
                  />
                  <button type="button" aria-label={`Remove reference ${j + 1}`} onClick={() => setList(i, l.items.filter((_, k) => k !== j))}>
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                  <textarea
                    aria-label={`Verse text ${j + 1}`}
                    rows={2}
                    placeholder="Verse text (optional: leave empty to fetch it on the PC)"
                    value={it.text}
                    onChange={(e) => setList(i, l.items.map((x, k) => (k === j ? { ...x, text: e.target.value } : x)))}
                  />
                </div>
              ))}
          <button
            className="member-action"
            type="button"
            onClick={() =>
              setList(
                i,
                l.kind === "question" ? [...l.items, { text: "" }] : [...l.items, { ref: "", version: "", text: "" }],
              )
            }
          >
            <Plus aria-hidden="true" size={14} /> {l.kind === "question" ? "Add question" : "Add scripture"}
          </button>
        </fieldset>
      ))}
      <label className="edit-script">
        Teleprompter script
        <textarea rows={6} maxLength={20000} value={draft.script} onChange={(e) => setDraft({ ...draft, script: e.target.value })} />
      </label>
      {problem && (
        <p className="workspace-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="edit-actions">
        <button className="live-btn live-primary" type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="live-btn" type="button" disabled={busy} onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </li>
  );
}

function FrameCard({
  frame,
  number,
  onAir = false,
  actions = null,
  history = null,
}: Readonly<{ frame: FrameView; number?: number; onAir?: boolean; actions?: React.ReactNode; history?: React.ReactNode }>) {
  return (
    <li className="frame-card">
      <header>
        {number !== undefined && <span className="frame-number">{number}</span>}
        <h3>{frame.name}</h3>
        {frame.group && <span className="workspace-role">{frame.group}</span>}
        {onAir && <span className="live-flag">On screen</span>}
        {actions}
      </header>
      {frame.content.length === 0 ? (
        <p className="workspace-hint">No Content.</p>
      ) : (
        <ul className="content-list">
          {frame.content.map((c, i) => {
            return (
              <li key={i}>
                <span className="content-title">
                  <KindIcon kind={c.kind} />
                  {c.title}
                </span>
                {c.media !== undefined ? (
                  <span className="content-media">
                    {c.media ? `${c.media} · on the service PC` : "No file chosen"}
                  </span>
                ) : c.lines.length ? (
                  c.lines.map((line, j) => (
                    <span className="content-line" key={j}>
                      {line}
                    </span>
                  ))
                ) : c.empty ? (
                  <span className="content-empty">{c.empty}</span>
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
      {history}
    </li>
  );
}

export function ServicesPanel({ historyOnly = false }: Readonly<{ historyOnly?: boolean }>) {
  return <WorkspaceGate what="your services">{(w) => <Services key={w.id} workspace={w} historyOnly={historyOnly} />}</WorkspaceGate>;
}
