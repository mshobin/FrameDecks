import type { SupabaseClient } from "@supabase/supabase-js";

import type { SyncRecord } from "@/lib/sync-entities";

export type PulledRecord = SyncRecord & { rev: number; seq: number; updatedBy?: string; updatedAt?: string };

/** Problems that mean the database is not ready for sync yet (0003_sync.sql not run), not a broken page. */
export function syncNotSetUp(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ["PGRST202", "PGRST205", "42883", "42P01"].includes(error.code ?? "") || /could not find the (function|table)/i.test(error.message ?? "");
}

/** Every record of the workspace, newest version of each, through sync_pull pages (what RLS lets this person see). */
export async function pullWorkspace(supabase: SupabaseClient, organizationId: string) {
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
  return { records: [...latest.values()].filter((r) => !r.deleted), error: null };
}
