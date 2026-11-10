// FrameDecks 26.11.40 - what Home and the left panel's Next meeting card read about the workspace, loaded once and
// shared: the workspace's records, the meeting the service PC shows (with its Frames) and the linked PCs. Kept for a
// minute, so moving between pages does not load it again.
import type { SupabaseClient } from "@supabase/supabase-js";

import { frameFilled } from "@/lib/frame-flow";
import { isOnline, type LiveComputer } from "@/lib/live-view";
import { currentMeetingId, framesOfMeeting, meetingsOf } from "@/lib/meetings";
import { join } from "@/lib/sync-entities";
import { pullWorkspace, type PulledRecord } from "@/lib/workspace-sync";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export type GlanceData = {
  records: PulledRecord[];
  members: Obj[];
  meeting: { name: string; date: string; frames: number; filled: number };
  pcs: LiveComputer[];
};

/** The meeting the service PC shows, and how many of its Frames have words or media. */
export function meetingGlance(doc: Obj): GlanceData["meeting"] {
  const body = isObj(doc.meeting) ? doc.meeting : {};
  const list = meetingsOf(body);
  const scenes = Array.isArray(doc.scenes) ? doc.scenes.filter((s) => isObj(s) && !s.tpl) : [];
  const many = list.length > 1;
  const id = currentMeetingId(body, list);
  const m = list.find((x) => x.id === id) ?? list[0];
  const frames = many ? framesOfMeeting(scenes, list, id) : (scenes as Obj[]);
  return {
    name: many ? m.name : String(body.title ?? ""),
    date: many ? m.date : String(body.date ?? ""),
    frames: frames.length,
    filled: frames.filter(frameFilled).length,
  };
}

const cache = new Map<string, { at: number; data: Promise<GlanceData> }>();
export function loadGlance(supabase: SupabaseClient, org: string): Promise<GlanceData> {
  const hit = cache.get(org);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  const data = (async () => {
    const { records } = await pullWorkspace(supabase, org);
    const pcs = await supabase.rpc("remote_computers", { org });
    const { doc, members } = join(records, {});
    const list = ((pcs.data as LiveComputer[] | null) ?? []).sort((a, b) => Number(isOnline(b)) - Number(isOnline(a)));
    return { records, members: members as Obj[], meeting: meetingGlance(doc as Obj), pcs: list };
  })();
  cache.set(org, { at: Date.now(), data });
  data.catch(() => cache.delete(org));
  return data;
}
