// 26.11.33 quick responses and polls on /follow (0022_room_polls.sql): what the room sends is checked before it is
// shown, the bars' percentages always add up to 100, and each phone keeps one random id of its own so it answers once
// (the workspace only ever keeps a hash of it). Kept small: the website's JavaScript budget is tight.

export type RoomResponse = {
  id: string;
  question: string;
  kind: "yesno" | "choice" | "rating";
  options: string[];
  showResults?: boolean;
  counts?: number[] | null; // only when the leader shows the results
  total?: number;
  mine?: number | null;
};

export const VOTER_KEY = "fd-voter";

/** The open question as the room sent it (the workspace checked and cut it to size), or null: counts only when shown
 * and matching the answers, this phone's answer only when it is one of them. */
export function tidyResponse(raw: unknown): RoomResponse | null {
  const r = raw as RoomResponse | null;
  if (!r?.id || !r.question || !(r.options?.length > 1)) return null;
  return { ...r, counts: r.showResults && r.counts?.length === r.options.length ? r.counts : null, mine: r.options[r.mine ?? -1] ? r.mine : null };
}

/** Whole percentages for the bars, adding up to exactly 100 (each is the step between rounded running totals); all 0
 * before anyone answers. */
export function percentages(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  let run = 0;
  let was = 0;
  return counts.map((n) => {
    const now = total && Math.round(((run += n) * 100) / total);
    const step = now - was;
    was = now;
    return step;
  });
}

let spare = "";

/** This phone's own random id, kept on the phone (or for this visit only when the browser keeps nothing). */
export function voterId(store?: Pick<Storage, "getItem" | "setItem"> | null): string {
  try {
    const s = store === undefined ? localStorage : store!;
    const kept = s.getItem(VOTER_KEY);
    if (kept && kept.length > 7) return kept;
    s.setItem(VOTER_KEY, (spare = crypto.randomUUID()));
  } catch {
    spare ||= `${Date.now()}-${Math.random()}`;
  }
  return spare;
}
