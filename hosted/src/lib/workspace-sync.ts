import type { SupabaseClient } from "@supabase/supabase-js";

import type { SyncRecord } from "@/lib/sync-entities";

export type PulledRecord = SyncRecord & { rev: number; seq: number; updatedBy?: string; updatedAt?: string };

/** Problems that mean the database is not ready for sync yet (0003_sync.sql not run), not a broken page. */
export function syncNotSetUp(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ["PGRST202", "PGRST205", "42883", "42P01"].includes(error.code ?? "") || /could not find the (function|table)/i.test(error.message ?? "");
}

/** Every record of the workspace, newest version of each, through sync_pull pages (what RLS lets this person see).
 * Deleted records only when asked (the Services page lists deleted Frames for 30 days). */
export async function pullWorkspace(supabase: SupabaseClient, organizationId: string, includeDeleted = false) {
  const latest = new Map<string, PulledRecord>();
  let since = 0;
  for (let page = 0; page < 200; page++) {
    const { data, error } = await supabase.rpc("sync_pull", { org: organizationId, since, max_rows: 500 });
    if (error) return { records: [], error };
    const answer = data as { entities: PulledRecord[]; seq: number; more: boolean };
    for (const record of answer.entities ?? []) latest.set(`${record.kind}/${record.id}`, record);
    since = answer.seq;
    if (!answer.more) break;
  }
  const records = [...latest.values()];
  return { records: includeDeleted ? records : records.filter((r) => !r.deleted), error: null };
}

export type PushAnswer =
  | { status: "ok"; rev: number }
  | { status: "conflict"; current: { rev: number; deleted: boolean; body: unknown } }
  | { status: "error"; message: string };

/** One edited record back to the workspace (owners and admins), on top of the revision it was read at. The database
 * stores it only if nobody changed it since; otherwise it answers with the current version and stores nothing. */
export async function pushRecord(
  supabase: SupabaseClient,
  organizationId: string,
  record: { kind: string; id: string; rev: number },
  body: unknown,
): Promise<PushAnswer> {
  const { data, error } = await supabase.rpc("sync_push", {
    org: organizationId,
    changes: [{ kind: record.kind, id: record.id, baseRev: record.rev, body }],
  });
  if (error) {
    const message =
      error.code === "42501"
        ? "Only owners and admins of this workspace can edit services."
        : error.code === "53400"
          ? "Too many changes this minute; try again shortly."
          : error.message;
    return { status: "error", message };
  }
  const result = (data as { results?: { status: string; rev?: number; current?: PushAnswer & object }[] })?.results?.[0];
  if (result?.status === "ok") return { status: "ok", rev: Number(result.rev) };
  if (result?.status === "conflict" && result.current) {
    return { status: "conflict", current: result.current as unknown as { rev: number; deleted: boolean; body: unknown } };
  }
  return { status: "error", message: "The workspace did not answer as expected." };
}
