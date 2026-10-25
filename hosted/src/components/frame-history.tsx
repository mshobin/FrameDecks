"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";

import { lastKept, versionsOf, whoMade, type HistoryRow, type Version } from "@/lib/history-view";
import { browserSupabase } from "@/lib/supabase-browser";
import { pushRecord, type PulledRecord } from "@/lib/workspace-sync";

export type Names = { people: Record<string, string>; computers: Record<string, string> };
type Row = HistoryRow & { id: string };

/** Who is who in this workspace, for "changed by": members' names (workspace_members) and the PCs' names
 * (computers for owners and admins, remote_computers for people who may run services). Unknown names stay neutral. */
export async function loadNames(organizationId: string): Promise<Names> {
  const supabase = browserSupabase();
  const names: Names = { people: {}, computers: {} };
  if (!supabase) return names;
  const [people, pcs, live] = await Promise.all([
    supabase.rpc("workspace_members", { org: organizationId }),
    supabase.from("computers").select("id, name").eq("organization_id", organizationId),
    supabase.rpc("remote_computers", { org: organizationId }),
  ]);
  for (const p of (people.data as { user_id: string; display_name: string | null; email: string }[] | null) ?? []) {
    names.people[p.user_id] = p.display_name || p.email;
  }
  const computers = [...((pcs.data as { id: string; name: string }[] | null) ?? []), ...((live.data as { id: string; name: string }[] | null) ?? [])];
  for (const c of computers) names.computers[c.id] = c.name;
  return names;
}

// The versions entity_history keeps (30 days) of these Frames, newest first
async function loadHistory(organizationId: string, ids: string[]): Promise<Row[]> {
  const supabase = browserSupabase();
  if (!supabase || !ids.length) return [];
  const { data } = await supabase
    .from("entity_history")
    .select("id, rev, deleted, body, updated_by, replaced_at")
    .eq("organization_id", organizationId)
    .eq("kind", "frame")
    .in("id", ids)
    .order("rev", { ascending: false });
  return (data as Row[] | null) ?? [];
}

const when = (at: string | null) => (at ? new Date(at).toLocaleString() : "earlier");

// An older version back as the newest one, through the same sync_push as an edit (owners and admins)
async function restore(organizationId: string, current: PulledRecord, version: Version) {
  const supabase = browserSupabase();
  if (!supabase || !version.body) return { ok: false, text: "Nothing to restore." };
  const body = { ...version.body, modified: Date.now() };
  const answer = await pushRecord(supabase, organizationId, current, body);
  if (answer.status === "ok") {
    const saved: PulledRecord = { ...current, rev: answer.rev, deleted: false, body: body as PulledRecord["body"] };
    return { ok: true, text: `Restored version ${version.rev}. The service PC picks it up within about a minute.`, saved };
  }
  if (answer.status === "conflict") return { ok: false, text: "It changed meanwhile. Open History again to see the latest." };
  return { ok: false, text: answer.message };
}

/** One Frame's versions (30 days), newest first, with Restore for owners and admins. */
export function FrameHistory({
  organizationId,
  record,
  canEdit,
  names,
  onRestored,
}: Readonly<{
  organizationId: string;
  record: PulledRecord;
  canEdit: boolean;
  names: Names | null;
  onRestored: (saved: PulledRecord, text: string) => void;
}>) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadHistory(organizationId, [record.id]).then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [organizationId, record.id, record.rev]);

  if (rows === null) return <p className="workspace-hint">Loading history…</p>;
  const versions = versionsOf(record, rows);
  return (
    <div className="frame-history">
      <h4>
        <History aria-hidden="true" size={14} /> History (kept 30 days)
      </h4>
      <ol>
        {versions.map((v) => (
          <li key={v.rev}>
            <span className="history-what">
              <strong>{v.current ? "Now" : `Version ${v.rev}`}</strong> · {when(v.at)} ·{" "}
              {whoMade(v.by, names?.people ?? {}, names?.computers ?? {})}
              {v.changes.length > 0 && <span className="history-changes">changed {v.changes.join(", ")}</span>}
            </span>
            {canEdit && !v.current && !v.deleted && v.body && (
              <button
                className="member-action"
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm(`Bring back version ${v.rev} of “${String(v.body?.name ?? "this Frame")}”?`)) return;
                  setBusy(true);
                  const r = await restore(organizationId, record, v);
                  setBusy(false);
                  if (r.ok && r.saved) onRestored(r.saved, r.text);
                  else setProblem(r.text);
                }}
              >
                <RotateCcw aria-hidden="true" size={13} /> Restore
              </button>
            )}
          </li>
        ))}
      </ol>
      {versions.length === 1 && <p className="workspace-hint">No earlier versions in the last 30 days.</p>}
      {problem && (
        <p className="workspace-problem" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}

/** Frames deleted in the last 30 days, with Restore for owners and admins. */
export function DeletedFrames({
  organizationId,
  records,
  canEdit,
  names,
  onRestored,
}: Readonly<{
  organizationId: string;
  records: PulledRecord[];
  canEdit: boolean;
  names: Names | null;
  onRestored: (saved: PulledRecord, text: string) => void;
}>) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const ids = records.map((r) => r.id).join(",");

  useEffect(() => {
    let live = true;
    loadHistory(organizationId, ids ? ids.split(",") : []).then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [organizationId, ids]);

  const items = records
    .map((record) => ({ record, kept: lastKept(versionsOf(record, (rows ?? []).filter((h) => h.id === record.id))) }))
    .filter((x) => x.kept);
  if (!items.length) return null;
  return (
    <>
      <h2 className="section-title">Deleted in the last 30 days</h2>
      <ul className="members-list deleted-frames">
        {items.map(({ record, kept }) => (
          <li key={record.id}>
            <span className="member-who">
              <strong>{String(kept?.body?.name ?? "Frame")}</strong>
              <span>
                Deleted {when(record.updatedAt ?? null)} by{" "}
                {whoMade(record.updatedBy ?? "", names?.people ?? {}, names?.computers ?? {})}
              </span>
            </span>
            {canEdit && kept && (
              <button
                className="member-action"
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await restore(organizationId, record, kept);
                  setBusy(false);
                  if (r.ok && r.saved) onRestored(r.saved, r.text.replace(/^Restored version \d+/, "Brought it back"));
                  else setProblem(r.text);
                }}
              >
                <RotateCcw aria-hidden="true" size={13} /> Restore
              </button>
            )}
          </li>
        ))}
      </ul>
      {problem && (
        <p className="workspace-problem" role="alert">
          {problem}
        </p>
      )}
    </>
  );
}
