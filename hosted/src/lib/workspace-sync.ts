import type { SupabaseClient } from "@supabase/supabase-js";

import type { SyncRecord } from "@/lib/sync-entities";
import { userSafeError } from "@/lib/user-error";

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
  return send(supabase, organizationId, { kind: record.kind, id: record.id, baseRev: record.rev, body });
}

/** Deletes one record (owners and admins), on top of the revision it was read at; a conflict as for pushRecord. */
export async function deleteRecord(
  supabase: SupabaseClient,
  organizationId: string,
  record: { kind: string; id: string; rev: number },
): Promise<PushAnswer> {
  return send(supabase, organizationId, { kind: record.kind, id: record.id, baseRev: record.rev, deleted: true });
}

/** Several records in one push (a new Frame and the order that lists it). Each is stored only if nobody changed it
 * since it was read; the answers come back in the same order. */
export async function pushChanges(
  supabase: SupabaseClient,
  organizationId: string,
  changes: ({ kind: string; id: string; rev: number } & ({ body: unknown } | { deleted: true }))[],
): Promise<PushAnswer[]> {
  const { data, error } = await supabase.rpc("sync_push", {
    org: organizationId,
    changes: changes.map(({ rev, ...c }) => ({ ...c, baseRev: rev })),
  });
  if (error) return changes.map(() => ({ status: "error" as const, message: messageOf(error) }));
  const results = (data as { results?: { status: string; rev?: number; current?: unknown }[] })?.results ?? [];
  return changes.map((_, i) => answerOf(results[i]));
}

function messageOf(error: { code?: string; message: string }): string {
  return userSafeError(error, "Couldn’t save this change to your workspace. Check your connection and try again.");
}

function answerOf(result: { status: string; rev?: number; current?: unknown } | undefined): PushAnswer {
  if (result?.status === "ok") return { status: "ok", rev: Number(result.rev) };
  if (result?.status === "conflict" && result.current) {
    return { status: "conflict", current: result.current as { rev: number; deleted: boolean; body: unknown } };
  }
  return { status: "error", message: "The workspace did not answer as expected." };
}

async function send(supabase: SupabaseClient, organizationId: string, change: Record<string, unknown>): Promise<PushAnswer> {
  const { data, error } = await supabase.rpc("sync_push", { org: organizationId, changes: [change] });
  if (error) return { status: "error", message: messageOf(error) };
  return answerOf((data as { results?: { status: string; rev?: number; current?: unknown }[] })?.results?.[0]);
}
