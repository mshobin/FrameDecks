"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, CloudUpload, Eye, FileText, PanelRightClose, PanelRightOpen, Pencil, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";

import { KindIcon } from "@/components/content-kind";
import { NotSetUp, WorkspaceGate } from "@/components/workspace-gate";
import { FlowChart, FlowSteps, MeetingBar, PreviewDialog, TransitionPicker, useFlip, type SyncShown } from "@/components/frame-flow";
import { currentMeetingId, framesOfMeeting, meetingsOf, newMeetingId, uniqueMeetingName, withMeetings, type Meeting } from "@/lib/meetings";
import { PROFILE_TX, flowState, frameFilled, mediaNamesOf, moveFrameTo, type StepId } from "@/lib/frame-flow";
import { keepMedia, keptNames, mediaForExport } from "@/lib/local-media";
import {
  BACKGROUNDS,
  CARD_ANIMATIONS,
  CONTENT_TYPES,
  LIMITS,
  OLDER_MEETING_FIELDS,
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
import brandInfo from "@/lib/brand.json";
import { frameFileFromDoc, frameFileName } from "@/lib/frame-file";
import { useConfirmation } from "@/components/confirm-dialog";
import "@/app/plan.css"; // 8.4 the Plan page's own styles load only here
import { shortDate } from "@/lib/when";
import { PROFILES, profileOf } from "@/lib/workspace-settings";
import { join, type JsonObject } from "@/lib/sync-entities";
import { userSafeError } from "@/lib/user-error";
import { pullWorkspace, pushChanges, pushRecord, syncNotSetUp, watchSync, type PulledRecord } from "@/lib/workspace-sync";
import { keyOf, loadChanges, mergeOrder, overlay, saveChanges, stage, summarize, toPush, type Changes } from "@/lib/plan-changes";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";

type Obj = { [key: string]: unknown };
type Loaded = { records: PulledRecord[]; onAir: string | null; pcs: number; supported: boolean } | "not-set-up" | { error: string };
type Focus = "script" | "tx" | null;
type Notice = { ok: boolean; text: string } | null;

const key = (kind: string, id: string) => `${kind}/${id}`;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const SAVED = "Waiting for Sync Now.";
const SAVED_LIVE = "Waiting for Sync Now. On screen now: the PC applies it when it leaves the screen.";

// The website's Meeting Form (docs/architecture/meeting-form.md): the Excel Meeting Form's sections, on the live plan.
// Owners and admins add, change, move and delete Frames and their Content; everyone else reads it. Every save goes
// to the workspace with sync_push on top of the revision it was read at, and the PC applies it like any other edit.
function Planner({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const { ask, dialog } = useConfirmation();
  const canEdit = workspace.role === "owner" || workspace.role === "admin";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // a Frame id, or "new"
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  // 8.3 the guided workflow: the Preview, the Sync status, files kept in this browser and the step being opened
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [sent, setSent] = useState(false);
  const [phase, setPhase] = useState<SyncShown>("synced");
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [meetingOpen, setMeetingOpen] = useState(0);
  const [focus, setFocus] = useState<Focus>(null);
  // 8.5 the meeting being planned (remembered on this device) and the timeline on the right
  const remembered = `fd-meeting-${workspace.id}`;
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem(remembered) ?? "";
    } catch {
      return "";
    }
  });
  const [sideOpen, setSideOpen] = useState(true);
  const [renames, setRenames] = useState(0); // a rename from the meeting bar refills Meeting details; their own Save keeps "Saved" on screen
  // 26.11.39 edits wait on this page until Sync Now (kept in this browser), Frames picked for Delete selected, and the
  // Frame last clicked, lit on the timeline too
  const [changes, setChangesState] = useState<Changes>(() => (typeof window === "undefined" ? {} : loadChanges(workspace.id)));
  const setChanges = useCallback(
    (fn: (c: Changes) => Changes) => setChangesState((c) => {
      const next = fn(c);
      saveChanges(workspace.id, next);
      return next;
    }),
    [workspace.id],
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const sideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const online = () => setPhase(navigator.onLine ? "synced" : "offline");
    online();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    const stop = watchSync((p) => setPhase(navigator.onLine ? p : "offline"));
    keptNames(workspace.id).then(setKept);
    return () => (stop(), window.removeEventListener("online", online), window.removeEventListener("offline", online));
  }, [workspace.id]);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { records, error } = await pullWorkspace(supabase, workspace.id);
    if (error) return setLoaded(syncNotSetUp(error) ? "not-set-up" : { error: userSafeError(error, "Couldn’t load the meeting plan. Check your connection and try again.") });
    const pcs = await supabase.rpc("remote_computers", { org: workspace.id });
    const statuses = ((pcs.data as { status: { frame?: { id: string } | null } | null }[] | null) ?? []).map((p) => p.status);
    const supported = await supabase.rpc("meetings_supported"); // 0012: without it, one meeting as before
    setLoaded({ records, onAir: statuses.find((s) => s?.frame)?.frame?.id ?? null, pcs: statuses.length, supported: !supported.error && supported.data === true });
  }, [supabase, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const id = editing && editing !== "new" ? editing : current;
    const side = sideRef.current;
    const node = id && side ? side.querySelector<HTMLElement>(`[data-flip="${CSS.escape(id)}"]`) : null;
    if (!side || !node) return;
    const top = node.offsetTop - side.clientHeight / 2 + node.clientHeight / 2;
    side.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [current, editing]);

  if (loaded === null) return <PageSkeleton />;
  if (loaded === "not-set-up") return <NotSetUp />;
  if ("error" in loaded) return <ErrorState text={loaded.error} onRetry={load} />;

  const serverByKey = new Map(loaded.records.map((r) => [key(r.kind, r.id), r]));
  const records = overlay(loaded.records, changes);              // what this page shows: the workspace and the waiting changes
  const byKey = new Map(records.map((r) => [key(r.kind, r.id), r]));
  const waiting = summarize(changes);
  const onAirId = loaded.onAir;
  const { doc } = join(records, {});
  const scenes = (Array.isArray(doc.scenes) ? (doc.scenes as unknown[]) : []).filter(isObj);
  const meetingRecord = byKey.get(key("meeting", "meeting"));
  const order = byKey.get(key("order", "order")) ?? null;
  const brand = isObj(doc.brand) ? (doc.brand as JsonObject) : {};
  // 8.5 several meetings: the one chosen here, and only its Frames
  const meetingBody = (isObj(doc.meeting) ? doc.meeting : {}) as Obj;
  const meetings = meetingsOf(meetingBody);
  const multi = meetings.length > 1;
  const selId = meetings.some((m) => m.id === selected) ? selected : currentMeetingId(meetingBody, meetings);
  const sel = meetings.find((m) => m.id === selId) ?? meetings[0];
  const frames = multi ? framesOfMeeting(scenes, meetings, sel.id) : scenes.filter((s) => !s.tpl);
  const counts = Object.fromEntries(meetings.map((m) => [m.id, framesOfMeeting(scenes, meetings, m.id).length]));
  const title = multi ? sel.name : String(meetingBody.title ?? "");
  const group = multi ? sel.name : title;

  /** 8.2 Export for Service PC: the whole plan in one .frame file, for a service PC without internet. 8.3: with the
   * pictures, video, audio and slides added in this browser. */
  async function exportFrameFile() {
    // 8.5 the meeting chosen here: its Frames, name, date and notes (the PC puts it in a meeting of that name)
    const meetingOut: Obj = { ...meetingBody, title: sel.name, date: multi ? sel.date : meetingBody.date ?? "", notes: multi ? sel.notes : meetingBody.notes ?? "" };
    delete meetingOut.meetings;
    const scenesOut = frames.map((f) => ({ ...f, group: multi ? sel.name : f.group }));
    const { media, left } = await mediaForExport(workspace.id, mediaNamesOf(scenesOut).filter((n) => kept.has(n)));
    const file = frameFileFromDoc({ ...doc, scenes: scenesOut, meeting: meetingOut } as JsonObject, { app: String(brandInfo.version ?? ""), media });
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = frameFileName(title);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setSent(true);
    // 8.4 say exactly what is in the file, and which files the Frames use that it does not carry
    const n = file.integrity;
    const files = media.length ? `, ${media.length} file${media.length === 1 ? "" : "s"}` : "";
    const absent = (n?.files ?? []).filter((f) => !n?.included.includes(f));
    const missing = absent.length
      ? ` Not in the file (not in this browser${left.length ? " or too large" : ""}): ${absent.join(", ")}. The service PC must already have ${absent.length === 1 ? "it" : "them"}.`
      : "";
    setNotice({
      ok: !absent.length,
      text: `Exported ${file.counts.frames} Frame${file.counts.frames === 1 ? "" : "s"} (${n?.layers ?? 0} Content, ${n?.items ?? 0} questions and readings${files}) with the meeting name, date and notes. On the service PC: Settings → Data / Backup → Import Frame File → Use this plan.${missing}`,
    });
  }

  const styleTx = PROFILE_TX[profileOf(byKey.get(key("layout", "profile"))?.body)] ?? "fade";
  const steps = flowState({ title, frames, previewed, sent: sent || (loaded.pcs > 0 && phase === "synced" && !waiting.count && frames.length > 0) });
  function preview(at: number) {
    if (!frames.length) return setNotice({ ok: false, text: "Add a Frame first, then preview it." });
    setPreviewed(true);
    setPreviewAt(at);
  }
  function open(id: string, f: Focus = null) {
    setNotice(null);
    setFocus(f);
    setEditing(id);
    requestAnimationFrame(() => document.getElementById(`frame-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function step(id: StepId) {
    if (id === "meeting") {
      setMeetingOpen((n) => n + 1);
      return;
    }
    if (!canEdit && (id === "frames" || id === "content")) return setNotice({ ok: false, text: "View only: owners and admins can edit." });
    if (id === "frames") return open("new");
    if (id === "content") {
      const next = frames.find((f) => !frameFilled(f)) ?? frames[0];
      return next ? open(String(next.id), "script") : open("new");
    }
    if (id === "preview") return preview(0);
    if (!frames.length) return setNotice({ ok: false, text: "Add a Frame first, then export the plan." });
    exportFrameFile();
  }

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

  function choose(id: string) {
    setSelected(id);
    setEditing(null);
    setNotice(null);
    try {
      localStorage.setItem(remembered, id);
    } catch {}
  }
  const meetingBase = meetingRecord ?? { kind: "meeting" as const, id: "meeting", rev: 0, seq: 0, body: {} };

  async function createMeeting(wanted: string) {
    if (!supabase || busy) return;
    const entry: Meeting = { id: newMeetingId(), name: uniqueMeetingName(meetings, wanted), date: "", notes: "" };
    const body = withMeetings(meetingBody, [...meetings, entry]);
    setBusy(true);
    const answer = await pushRecord(supabase, workspace.id, meetingBase, body);
    setBusy(false);
    if (answer.status === "ok") {
      upsert({ ...meetingBase, kind: "meeting", body: body as PulledRecord["body"], rev: answer.rev });
      choose(entry.id);
      setNotice({ ok: true, text: `“${entry.name}” made. Add its first Frame: Add Frame.` });
    } else if (answer.status === "conflict") {
      setNotice({ ok: false, text: "The meetings changed on the PC meanwhile. Here is the latest; try again." });
      await load();
    } else setNotice({ ok: false, text: answer.message });
  }

  /** Name, date and notes of the chosen meeting; a new name also moves its Frames' group (how the PC knows them). */
  async function saveMeeting(form: MeetingForm): Promise<string | null> {
    if (!supabase) return "Not connected.";
    const newName = form.title.trim().slice(0, 60);
    if (multi && !newName) return "A meeting needs a name.";
    if (multi && uniqueMeetingName(meetings, newName, sel.id) !== newName) return `Another meeting is already called “${newName}”.`;
    const old = sel.name;
    let body: Obj;
    if (multi) {
      const list = meetings.map((m) => (m.id === sel.id ? { ...m, name: newName, date: form.date.trim(), notes: form.notes.trim().slice(0, 2000) } : m));
      const shows = String(meetingBody.title ?? "").trim().toLowerCase() === old.toLowerCase();
      body = withMeetings(meetingBody, list, shows ? sel.id : undefined);
    } else body = meetingFromForm(form, meetingRecord?.body);
    const renamed = newName && newName !== old ? scenes.filter((f) => !f.tpl && String(f.group ?? "").trim().toLowerCase() === old.toLowerCase()) : [];
    const changes: Parameters<typeof pushChanges>[2] = [{ kind: "meeting", id: "meeting", rev: meetingBase.rev, body }];
    for (const f of renamed) {
      const r = serverByKey.get(key("frame", String(f.id)));       // the workspace's version; a waiting edit follows below
      if (r) changes.push({ kind: "frame", id: r.id, rev: r.rev, body: { ...(r.body as Obj), group: newName } });
    }
    const answers = await pushChanges(supabase, workspace.id, changes);
    if (answers.every((a) => a.status === "ok")) {
      changes.forEach((c, i) => "body" in c && upsert({ kind: c.kind as PulledRecord["kind"], id: c.id, rev: (answers[i] as { rev: number }).rev, seq: 0, body: c.body as PulledRecord["body"] }));
      const moved = new Map(changes.map((c, i) => [keyOf(c.kind, c.id), { rev: (answers[i] as { rev: number }).rev, body: "body" in c ? (c.body as Obj) : null }]));
      setChanges((w) => {
        const next = { ...w };
        for (const f of renamed) {
          const k = keyOf("frame", String(f.id));
          const c = next[k];
          if (!c) continue;
          const m = moved.get(k);
          next[k] = { ...c, ...(m ? { rev: m.rev, base: m.body } : {}), body: c.body ? { ...c.body, group: newName } : null };
        }
        return next;
      });
      return null;
    }
    await load();
    const bad = answers.find((a) => a.status === "error");
    return bad && bad.status === "error" ? bad.message : "The meeting changed on the PC meanwhile. The latest is shown now; make your change again.";
  }

  /** 26.11.39 a change waits on this page (or drops out when it puts things back as the workspace has them) */
  function put(kind: "frame" | "order", id: string, body: Obj | null) {
    setChanges((c) => stage(c, serverByKey.get(key(kind, id)), kind, id, body));
  }

  function move(id: string, to: number) {
    if (!order || busy) return;
    setNotice(null);
    put("order", "order", moveFrameTo(order.body as Obj, frames.map((f) => String(f.id)), id, to));
  }

  async function remove(frame: Obj) {
    await removeMany([String(frame.id)]);
  }

  /** Deletes one or many Frames at once (one question), as waiting changes; the Frame on screen is never deleted. */
  async function removeMany(ids: string[]) {
    if (busy) return;
    const list = frames.filter((f) => ids.includes(String(f.id)) && byKey.get(key("frame", String(f.id))));
    const live = list.filter((f) => onAirId === String(f.id));
    const gone = list.filter((f) => !live.includes(f));
    if (!gone.length) return setNotice({ ok: false, text: "The Frame on screen can’t be deleted." });
    const one = gone.length === 1;
    if (!(await ask({
      title: one ? `Delete “${String(gone[0].name)}”?` : `Delete ${gone.length} Frames?`,
      description: `Deleted when you press Sync Now; restore from History within 30 days.${live.length ? ` “${String(live[0].name)}” is on screen, so it stays.` : ""}`,
      confirmLabel: one ? "Delete Frame" : `Delete ${gone.length} Frames`,
    }))) return;
    const drop = new Set(gone.map((f) => String(f.id)));
    setChanges((c) => {
      let next = c;
      for (const id of drop) next = stage(next, serverByKey.get(key("frame", id)), "frame", id, null);
      const ob = (next[keyOf("order", "order")]?.body ?? order?.body) as Obj | undefined;
      if (ob) next = stage(next, serverByKey.get(key("order", "order")), "order", "order", { ...ob, scenes: ((ob.scenes as string[]) ?? []).filter((s) => !drop.has(String(s))) });
      return next;
    });
    setPicked(new Set());
    setNotice({ ok: true, text: `${one ? `“${String(gone[0].name)}”` : `${gone.length} Frames`} deleted here. Press Sync Now to send ${one ? "it" : "them"} to the service PC.` });
  }

  function pick(id: string) {
    setCurrent(id);
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** 26.11.39 Sync Now: only the waiting changes, in one push. A Frame changed on the PC meanwhile stays waiting (press
   * Sync Now again to use this page's version); an order changed meanwhile is merged with it. */
  async function syncNow() {
    if (!supabase || syncing || !Object.keys(changes).length) return;
    setSyncing(true);
    setNotice(null);
    const list = toPush(changes);
    const answers = await pushChanges(supabase, workspace.id, list);
    const done: string[] = [];
    const later: Changes = {};
    let conflicts = 0;
    let failed = "";
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const a = answers[i];
      const k = keyOf(c.kind, c.id);
      if (a?.status === "ok") {
        if ("deleted" in c) drop(c.kind, c.id);
        else upsert({ kind: c.kind, id: c.id, rev: a.rev, seq: 0, body: c.body as PulledRecord["body"] });
        done.push(k);
      } else if (a?.status === "conflict" && c.kind === "order" && !a.current.deleted && a.current.body) {
        const deleted = Object.values(changes).filter((x) => x.deleted).map((x) => x.id);
        const merged = mergeOrder(("body" in c ? c.body : {}) as Obj, a.current.body as Obj, deleted);
        const [again] = await pushChanges(supabase, workspace.id, [{ kind: "order", id: "order", rev: a.current.rev, body: merged }]);
        if (again?.status === "ok") {
          upsert({ kind: "order", id: "order", rev: again.rev, seq: 0, body: merged as PulledRecord["body"] });
          done.push(k);
        } else later[k] = { ...changes[k], rev: a.current.rev, base: a.current.body as Obj };
      } else if (a?.status === "conflict") {
        if (a.current.deleted && "deleted" in c) done.push(k);                   // already deleted there
        else {
          conflicts++;
          later[k] = { ...changes[k], rev: a.current.rev, base: (a.current.body as Obj) ?? null };
        }
      } else failed = a && a.status === "error" ? a.message : "Couldn’t reach the workspace. Try again.";
    }
    setChanges((c) => {
      const next = { ...c };
      for (const k of done) delete next[k];
      return { ...next, ...later };
    });
    setSyncing(false);
    if (failed) setNotice({ ok: false, text: failed });
    else if (conflicts) {
      setNotice({ ok: false, text: `${conflicts} changed on the PC meanwhile. Sync Now again to use yours, or Discard changes to keep the PC’s.` });
      await load();
    } else setNotice({ ok: true, text: `Synced: ${syncWords(waiting)}. The service PC picks it up in a few seconds.` });
  }

  async function discard() {
    if (!(await ask({ title: "Discard your changes?", description: "The workspace and the service PC stay as they are.", confirmLabel: "Discard changes" }))) return;
    setChanges(() => ({}));
    setEditing(null);
    setNotice({ ok: true, text: "Changes discarded." });
  }

  return (
    <>
      <p className="page-note">
        {title ? <strong>{title}</strong> : null}
        {title ? " · " : null}
        {frames.length} Frame{frames.length === 1 ? "" : "s"}.{" "}
        {canEdit
          ? "Frame changes wait until you press Sync Now; only what changed is sent. Pictures and video you add here stay in this browser and travel in the .frame file."
          : "View only: owners and admins can edit."}
      </p>
      <MeetingBar
        list={meetings}
        selected={sel.id}
        counts={counts}
        canEdit={canEdit}
        supported={loaded.supported}
        busy={busy}
        onSelect={choose}
        onCreate={createMeeting}
        onRename={(name) => saveMeeting({ title: name, date: sel.date || String(meetingBody.date ?? ""), notes: multi ? sel.notes : String(meetingBody.notes ?? "") }).then((err) => (setRenames((n) => n + 1), setNotice(err ? { ok: false, text: err } : { ok: true, text: `Renamed to “${name}”.` })))}
      />
      <div className={`plan-grid${sideOpen ? "" : " is-closed"}`}>
      <div className="plan-main" key={sel.id}>
      <FlowSteps state={steps} onStep={step} sync={waiting.count && phase === "synced" ? "waiting" : phase} />
      {notice && (
        <p className={notice.ok ? "workspace-notice" : "workspace-problem"} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      )}

      <MeetingDetails
        key={`${sel.id}:${renames}`}
        openSignal={meetingOpen}
        initial={multi ? { title: sel.name, date: sel.date, notes: sel.notes } : meetingFormOf(meetingRecord?.body)}
        fresh={!meetingRecord}
        older={OLDER_MEETING_FIELDS.some((k) => String(meetingBody[k] ?? "").trim())}
        canEdit={canEdit}
        onSave={saveMeeting}
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
      {canEdit && frames.length > 0 && (
        <div className={`pick-bar${picked.size ? " is-on" : ""}`} role="toolbar" aria-label="Selected Frames">
          {picked.size ? (
            <>
              <span>
                <Check aria-hidden="true" size={15} /> {picked.size} selected
              </span>
              <button type="button" className="fd-link" onClick={() => setPicked(new Set(frames.map((f) => String(f.id))))}>
                Select all
              </button>
              <button type="button" className="fd-link" onClick={() => setPicked(new Set())}>
                <X aria-hidden="true" size={14} /> Clear
              </button>
              <button type="button" className="pick-delete" disabled={busy || editing !== null} onClick={() => removeMany([...picked])}>
                <Trash2 aria-hidden="true" size={15} /> Delete {picked.size}
              </button>
            </>
          ) : (
            <span className="pick-hint">Click a Frame’s number to select it.</span>
          )}
        </div>
      )}
      {frames.length === 0 && editing !== "new" && (
        <EmptyState title="No Frames yet">
          {canEdit ? "Add the first one below. " : null}They appear in FrameDecks once the service PC is linked under{" "}
          <Link href="/devices">Devices</Link>.
        </EmptyState>
      )}
      <FlipList className="frame-list" ids={frames.map((f) => String(f.id)).join()}>
        {frames.map((frame, i) => {
          const id = String(frame.id);
          const record = byKey.get(key("frame", id));
          const onAir = loaded.onAir === id;
          if (editing === id && record) {
            return (
              <FrameFormEditor
                ws={workspace.id}
                key={id}
                number={i + 1}
                record={record}
                onAir={onAir}
                brandColor={String(brand.color ?? "")}
                otherNames={frames.filter((f) => f.id !== frame.id).map((f) => String(f.name))}
                focus={focus}
                kept={kept}
                onKept={(name) => setKept((k) => new Set(k).add(name))}
                onStage={(frame, orderBody) => {
                  put("frame", frame.id, frame.body);
                  if (orderBody) put("order", "order", orderBody);
                }}
                onDone={(text) => {
                  setEditing(null);
                  if (text) setNotice({ ok: true, text });
                }}
              />
            );
          }
          const form = frameFormOf(frame);
          return (
            <li
              className={`frame-card plan-frame${onAir ? " is-on-air" : ""}${picked.has(id) ? " is-picked" : ""}${current === id ? " is-current" : ""}`}
              key={id}
              id={`frame-${id}`}
              onClick={(e) => !(e.target as HTMLElement).closest("button, a, input, select, textarea") && setCurrent(id)}
            >
              <header>
                {canEdit && record ? (
                  <button
                    type="button"
                    className="frame-number frame-pick"
                    aria-pressed={picked.has(id)}
                    aria-label={`Select ${form.name}`}
                    onClick={() => pick(id)}
                  >
                    {picked.has(id) ? <Check aria-hidden="true" size={16} /> : i + 1}
                  </button>
                ) : (
                  <span className="frame-number">{i + 1}</span>
                )}
                <div className="pf-title">
                  <h3>{form.name}</h3>
                  {/* 8.6 what the Frame holds at a glance: its Content, its animation, whether it has a script */}
                  <p className="pf-tags">
                    <span>
                      {form.content.length} Content
                    </span>
                    <span className="pf-tx">
                      <Sparkles aria-hidden="true" size={12} />
                      {form.transition === "profile" ? "Meeting style" : (TRANSITIONS.find(([, v]) => v === form.transition)?.[0] ?? form.transition)}
                    </span>
                    <span className={form.script.trim() ? "pf-ok" : "pf-todo"}>
                      <FileText aria-hidden="true" size={12} />
                      {form.script.trim() ? "Script" : "No script yet"}
                    </span>
                    {onAir && <span className="live-flag">On screen</span>}
                  </p>
                </div>
                {canEdit && record && (
                  <span className="frame-actions">
                    <button type="button" aria-label={`Move ${form.name} up`} disabled={busy || i === 0} onClick={() => move(id, i - 1)}>
                      <ArrowUp aria-hidden="true" size={15} />
                    </button>
                    <button type="button" aria-label={`Move ${form.name} down`} disabled={busy || i === frames.length - 1} onClick={() => move(id, i + 1)}>
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
              {form.desc && <p className="pf-desc">{form.desc}</p>}
              {form.content.length === 0 ? (
                <p className="pf-empty">No Content yet. Choose Edit to add a question, a scripture, text or a picture.</p>
              ) : (
                <ul className="content-list pf-content">
                  {form.content.map((row, j) => (
                    <li key={row.layerId ?? j}>
                      <span className="pf-ic" aria-hidden="true">
                        <KindIcon kind={row.type === "other" ? String(row.kind ?? "") : row.type} />
                      </span>
                      <span className="content-title" title={row.type === "other" ? undefined : TYPE_NAME[row.type]}>
                        {row.name.trim() || (row.type === "other" ? "Content" : TYPE_NAME[row.type])}
                      </span>
                      {/* an empty item is an action, not a note (owner-approved, 27 October) */}
                      {EMPTY[summary(row)] && canEdit ? (
                        <button type="button" className="content-add" disabled={editing !== null} onClick={() => (setNotice(null), setEditing(id))}>
                          + {EMPTY[summary(row)]}
                        </button>
                      ) : (
                        summary(row) && <span className="content-line">{summary(row)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="frame-quick pf-foot">
                {canEdit && record && (
                  <>
                    <button type="button" className="fd-btn fd-btn-glass" disabled={editing !== null} onClick={() => open(id, "script")}>
                      <Pencil aria-hidden="true" size={15} /> Write Script
                    </button>
                    <button type="button" className="fd-btn fd-btn-glass" disabled={editing !== null} onClick={() => open(id, "tx")}>
                      <Sparkles aria-hidden="true" size={15} /> Choose Animation
                    </button>
                  </>
                )}
                <button type="button" className="fd-btn fd-btn-glass" onClick={() => preview(i)}>
                  <Eye aria-hidden="true" size={15} /> Preview
                </button>
              </div>
            </li>
          );
        })}
        {editing === "new" && (
          <FrameFormEditor
            ws={workspace.id}
            key="new"
            number={frames.length + 1}
            record={null}
            order={order}
            onAir={false}
            brandColor={String(brand.color ?? "")}
            group={group}
            otherNames={frames.map((f) => String(f.name))}
            focus={focus}
            kept={kept}
            onKept={(name) => setKept((k) => new Set(k).add(name))}
            onStage={(frame, orderBody) => {
              put("frame", frame.id, frame.body);
              if (orderBody) put("order", "order", orderBody);
            }}
            onDone={(text) => {
              setEditing(null);
              if (text) setNotice({ ok: true, text });
            }}
          />
        )}
      </FlipList>
      {canEdit && editing === null && (
        <button
          className="live-btn live-primary planner-add"
          type="button"
          disabled={!!frameCountProblem(frames.length)}
          title={frameCountProblem(frames.length) ?? undefined}
          onClick={() => open("new")}
        >
          <Plus aria-hidden="true" size={16} /> Add Frame
        </button>
      )}
      </div>
      <aside className="plan-side" aria-label="Timeline" ref={sideRef}>
        <button type="button" className="plan-side-toggle" aria-expanded={sideOpen} onClick={() => setSideOpen((v) => !v)}>
          {sideOpen ? <PanelRightClose aria-hidden="true" size={16} /> : <PanelRightOpen aria-hidden="true" size={16} />}
          {sideOpen ? "Hide timeline" : "Timeline"}
        </button>
        {sideOpen && (
          <FlowChart
            key={sel.id}
            meeting={{ name: title || "Your meeting", date: multi ? sel.date : String(meetingBody.date ?? "") }}
            frames={frames}
            onAir={loaded.onAir}
            active={editing && editing !== "new" ? editing : current}
            picked={picked}
            onPick={pick}
            canEdit={canEdit}
            busy={busy || editing !== null}
            onMove={move}
            onOpen={(id) => (canEdit ? open(id) : preview(frames.findIndex((f) => String(f.id) === id)))}
            onDelete={remove}
            onAdd={() => open("new")}
            addDisabled={editing !== null || !!frameCountProblem(frames.length)}
            onMeeting={() => setMeetingOpen((n) => n + 1)}
          />
        )}
        {sideOpen && canEdit && picked.size > 0 && (
          <button type="button" className="pick-delete fc-pick-delete" disabled={busy || editing !== null} onClick={() => removeMany([...picked])}>
            <Trash2 aria-hidden="true" size={15} /> Delete {picked.size} selected
          </button>
        )}
        {canEdit && waiting.count > 0 && <SyncBox waiting={waiting} syncing={syncing} onSync={syncNow} onDiscard={discard} />}
      </aside>
      </div>
      {previewAt !== null && <PreviewDialog frames={frames} start={previewAt} styleTx={styleTx} onClose={() => setPreviewAt(null)} />}
      {dialog}
    </>
  );
}

/** 26.11.39 the waiting changes in words: "2 Frames changed, 1 added, 1 deleted, new order" */
function syncWords(w: ReturnType<typeof summarize>): string {
  const n = (k: number, word: string) => (k ? `${k} Frame${k === 1 ? "" : "s"} ${word}` : "");
  return [n(w.added.length, "added"), n(w.changed.length, "changed"), n(w.deleted.length, "deleted"), w.moved ? "new order" : ""].filter(Boolean).join(", ") || "no changes";
}

/** 26.11.39 Sync Now, under the timeline: what is waiting, one big button, and Discard. */
function SyncBox({ waiting, syncing, onSync, onDiscard }: Readonly<{ waiting: ReturnType<typeof summarize>; syncing: boolean; onSync: () => void; onDiscard: () => void }>) {
  const lines: [string, string[]][] = [["Added", waiting.added], ["Changed", waiting.changed], ["Deleted", waiting.deleted]];
  return (
    <section className="sync-box" aria-labelledby="sync-box-title">
      <h2 id="sync-box-title">
        <CloudUpload aria-hidden="true" size={18} />
        {waiting.count} change{waiting.count === 1 ? "" : "s"} waiting
      </h2>
      <ul>
        {lines.filter(([, l]) => l.length).map(([word, l]) => (
          <li key={word}>
            <b>{word}</b> {l.join(", ")}
          </li>
        ))}
        {waiting.moved && (
          <li>
            <b>Moved</b> Frames
          </li>
        )}
      </ul>
      <button type="button" className="sync-now" disabled={syncing} onClick={onSync}>
        {syncing ? "Syncing…" : "Sync Now"}
      </button>
      <p className="sync-note">
        Only these Frames are sent, never twice.{" "}
        <button type="button" className="fd-link" disabled={syncing} onClick={onDiscard}>
          Discard changes
        </button>
      </p>
    </section>
  );
}

/** The main list of Frames, gliding to their new places when they move (the same as the timeline) */
function FlipList({ className, ids, children }: Readonly<{ className: string; ids: string; children: ReactNode }>) {
  const ref = useRef<HTMLOListElement>(null);
  useFlip(ref, [ids]);
  return (
    <ol className={className} ref={ref}>
      {children}
    </ol>
  );
}

const EMPTY: Record<string, string> = { "No questions yet": "Add a question", "No readings yet": "Add a reading" };

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
    // One compact choice, not eight large cards above the Frames (owner-approved simplification, 27 October)
    <section className="fd-style-row">
      <label className="fd-style-pick">
        <span>Transition style</span>
        <select value={current} disabled={!canEdit || busy} onChange={(e) => choose(e.target.value)}>
          {PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}: {p.feel.toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <span className="workspace-hint">How every Frame moves on screen, unless a Frame has its own.</span>
      {problem && (
        <p className="workspace-problem" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}

function MeetingDetails({
  openSignal,
  initial,
  fresh,
  older,
  canEdit,
  onSave,
}: Readonly<{ openSignal: number; initial: MeetingForm; fresh: boolean; older: boolean; canEdit: boolean; onSave: (form: MeetingForm) => Promise<string | null> }>) {
  const [form, setForm] = useState<MeetingForm>(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(fresh);
  const box = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!openSignal) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => box.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }));
  }, [openSignal]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const edit = (patch: Record<string, string>) => (setForm({ ...form, ...patch }), setDirty(true), setSaved(false));

  async function save() {
    setBusy(true);
    setProblem(null);
    const err = await onSave(form);
    setBusy(false);
    if (err) return setProblem(err);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }

  return (
    <details ref={box} id="plan-meeting" className="frame-card frame-editing planner-meeting" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <strong>Meeting details</strong>
        <span className="workspace-hint">{form.title || "No meeting name yet"}{form.date ? ` · ${shortDate(`${form.date}T12:00:00`)}` : ""}</span>
      </summary>
      <div className="meet-form">
        <label>
          Meeting name
          <input
            maxLength={80}
            value={form.title}
            disabled={!canEdit}
            placeholder="Tuesday Bible Study"
            onChange={(e) => edit({ title: e.target.value })}
          />
        </label>
        <label>
          Date
          {/* a date typed in an older version ("3 Nov, evening") stays as it was until it is changed */}
          <input
            type={!form.date || /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? "date" : "text"}
            maxLength={40}
            value={form.date}
            disabled={!canEdit}
            onChange={(e) => edit({ date: e.target.value })}
          />
        </label>
        <label className="meet-notes">
          Meeting notes
          <textarea
            rows={3}
            maxLength={2000}
            value={form.notes}
            disabled={!canEdit}
            placeholder="Anything the team should know: the theme, who brings snacks, what to prepare."
            onChange={(e) => edit({ notes: e.target.value })}
          />
        </label>
      </div>
      {older && <p className="workspace-hint">This meeting also has details from an earlier version (speaker, location and so on). They are kept.</p>}
      {problem && (
        <p className="workspace-problem" role="alert">
          {problem}
        </p>
      )}
      {canEdit && (
        <div className="edit-actions">
          <button className={`live-btn live-primary${saved ? " is-saved" : ""}`} type="button" disabled={busy || (!dirty && !fresh)} onClick={save}>
            {busy ? "Saving…" : saved ? "✓ Saved" : "Save details"}
          </button>
          <span className="workspace-hint" role="status">
            {saved ? "Saved. Linked service PCs get it within about a minute." : dirty ? "Not saved yet." : ""}
          </span>
        </div>
      )}
    </details>
  );
}

// ---- One Frame, as the Excel form's Frames, Content, Questions and Scriptures tables ----

function FrameFormEditor({
  ws,
  focus = null,
  kept,
  onKept,
  number,
  record,
  order = null,
  onAir,
  brandColor,
  group = "",
  otherNames,
  onStage,
  onDone,
}: Readonly<{
  ws: string;
  focus?: Focus;
  kept: Set<string>;
  onKept: (name: string) => void;
  number: number;
  record: PulledRecord | null;
  order?: PulledRecord | null;
  onAir: boolean;
  brandColor: string;
  group?: string;
  otherNames: string[];
  /** 26.11.39 the Frame (and for a new one, the order that lists it) go into the waiting changes, sent by Sync Now */
  onStage: (frame: { id: string; body: Obj }, orderBody?: Obj) => void;
  onDone: (text?: string) => void;
}>) {
  const base = record;
  const [draft, setDraft] = useState<FrameForm>(() => (record ? frameFormOf(record.body as Obj) : { ...emptyFrame(), content: [emptyRow("question")] }));
  const [problems, setProblems] = useState<string[]>([]);
  const [addType, setAddType] = useState<ContentType>("question");
  const card = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = card.current?.querySelector<HTMLElement>(focus === "script" ? ".edit-script textarea" : focus === "tx" ? ".flow-tx [aria-checked=true]" : "input");
    el?.focus({ preventScroll: true });
    if (focus === "tx") card.current?.querySelector(".flow-tx")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  const setRow = (i: number, row: ContentRow) => setDraft((d) => ({ ...d, content: d.content.map((r, j) => (j === i ? row : r)) }));
  const moveRow = (i: number, delta: -1 | 1) =>
    setDraft((d) => {
      const content = [...d.content];
      const to = i + delta;
      if (to < 0 || to >= content.length) return d;
      [content[i], content[to]] = [content[to], content[i]];
      return { ...d, content };
    });

  function save() {
    const found = problemsOf(draft);
    setProblems(found);
    if (found.length) return;
    if (!base) {
      // A new Frame: its record and the order that lists it, waiting together for Sync Now
      const body = frameFromForm({ ...draft, name: uniqueName(otherNames, draft.name) }, null, { brandColor, group });
      const id = String(body.id);
      onStage({ id, body }, withFrame((order?.body as Obj) ?? null, id));
      onDone(`“${String(body.name)}” added. ${SAVED}`);
      return;
    }
    onStage({ id: base.id, body: frameFromForm(draft, base.body as Obj, { brandColor }) });
    onDone(onAir ? SAVED_LIVE : SAVED);
  }

  const customBg = !BACKGROUNDS.some(([n]) => n === draft.background);
  return (
    <li className="frame-card frame-editing" ref={card} id={`frame-${base ? base.id : "new"}`}>
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
      </div>
      <TransitionPicker value={draft.transition} onChange={(transition) => setDraft({ ...draft, transition })} />
      <label className="edit-script">
        Write Script: what you will say (Teleprompter, never on screen)
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
          ws={ws}
          kept={kept}
          onKept={onKept}
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
        <button className="live-btn live-primary" type="button" onClick={save}>
          {base ? "Save" : "Add Frame"}
        </button>
        <button className="live-btn" type="button" onClick={() => onDone()}>
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
  ws,
  kept,
  onKept,
}: Readonly<{
  row: ContentRow;
  index: number;
  count: number;
  onChange: (r: ContentRow) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  ws: string;
  kept: Set<string>;
  onKept: (name: string) => void;
}>) {
  const [fileProblem, setFileProblem] = useState<string | null>(null);
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
            File name (optional)
            <input value={row.main} maxLength={LIMITS.short} placeholder={t === "powerpoint" ? "talk.pptx" : t === "audio" ? "intro.mp3" : t === "video" ? "intro.mp4" : "welcome.jpg"} onChange={(e) => set({ main: e.target.value })} />
          </label>
          <div className="flow-file">
            <label className="fd-btn fd-btn-glass">
              <Upload aria-hidden="true" size={15} /> Choose file
              <input
                type="file"
                accept={ACCEPT[t]}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setFileProblem(null);
                  try {
                    const name = await keepMedia(ws, file);
                    onKept(name);
                    set({ main: name });
                  } catch (err) {
                    setFileProblem(err instanceof Error ? err.message : "The file could not be kept in this browser.");
                  }
                }}
              />
            </label>
            <small className={kept.has(row.main.trim()) ? "is-kept" : undefined}>
              {fileProblem ??
                (!row.main.trim()
                  ? "Or type the name of a file on the service PC."
                  : kept.has(row.main.trim())
                    ? "Kept in this browser: it travels in the .frame file (Export for Service PC)."
                    : "Looked for on the service PC.")}
            </small>
          </div>
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

const ACCEPT: Partial<Record<ContentType | "other", string>> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
  powerpoint: ".pdf,.pptx,.ppt,application/pdf",
};

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
