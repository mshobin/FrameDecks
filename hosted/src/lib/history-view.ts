// FRAMEDECKS - a Frame's history in the companion: its current version and the versions the database keeps for
// 30 days (entity_history, filled by sync_push), with who made each and what changed. Pure functions, no imports, so
// the tests load this file directly with Node's type stripping.

type Obj = { [key: string]: unknown };

export type HistoryRow = { rev: number; deleted: boolean; body: unknown; updated_by: string; replaced_at: string };
export type Version = {
  rev: number;
  deleted: boolean;
  body: Obj | null;
  by: string; // "user:<uuid>" or "computer:<uuid>", as the database records it
  at: string | null; // when this version was made, when known
  current: boolean;
  changes: string[]; // what differs from the version before it
};

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function items(frame: Obj, kind: string): string[] {
  return list(frame.layers)
    .filter((l) => l.kind === kind && isObj(l.c))
    .flatMap((l) => list((l.c as Obj).items))
    .map((it) => (kind === "scripture" ? `${it.ref ?? ""} ${it.version ?? ""} ${it.text ?? ""}` : String(it.text ?? "")));
}

/** What changed between two versions of a Frame, in words. */
export function changesBetween(before: Obj | null, after: Obj | null): string[] {
  if (!before && after) return ["created"];
  if (before && !after) return ["deleted"];
  if (!before || !after) return [];
  const out: string[] = [];
  if (before.name !== after.name) out.push("name");
  if (before.group !== after.group) out.push("group");
  if (before.notes !== after.notes) out.push("script");
  if (!same(items(before, "question"), items(after, "question"))) out.push("questions");
  if (!same(items(before, "scripture"), items(after, "scripture"))) out.push("scripture");
  const shape = (f: Obj) => list(f.layers).map((l) => ({ ...l, c: { ...(l.c as Obj), items: undefined } }));
  if (!same(shape(before), shape(after))) out.push("Content or looks");
  const rest = (f: Obj) => ({ ...f, name: 0, group: 0, notes: 0, layers: 0, modified: 0 });
  if (!out.length && !same(rest(before), rest(after))) out.push("settings");
  return out;
}

/** The current record and its history rows as a list of versions, newest first. A version's own time is when it
 * replaced the one before (that row's replaced_at); the current version's is the record's updatedAt. */
export function versionsOf(
  current: { rev: number; deleted?: boolean; body: unknown; updatedBy?: string; updatedAt?: string },
  rows: HistoryRow[],
): Version[] {
  const older = [...rows].sort((a, b) => a.rev - b.rev);
  const all = [
    ...older.map((r) => ({ rev: r.rev, deleted: r.deleted, body: isObj(r.body) ? r.body : null, by: r.updated_by })),
    {
      rev: current.rev,
      deleted: !!current.deleted,
      body: isObj(current.body) ? current.body : null,
      by: current.updatedBy ?? "",
    },
  ];
  const madeAt = (i: number): string | null => {
    if (i === all.length - 1) return current.updatedAt ?? null;
    const before = older.find((r) => r.rev === all[i].rev - 1);
    return before ? before.replaced_at : null;
  };
  return all
    .map((v, i) => ({
      ...v,
      at: madeAt(i),
      current: i === all.length - 1,
      changes: i === 0 ? [] : changesBetween(all[i - 1].deleted ? null : all[i - 1].body, v.deleted ? null : v.body),
    }))
    .reverse();
}

/** Who made a version, for people: a member's name, the PC's name, or a neutral word when unknown. */
export function whoMade(by: string, people: Record<string, string>, computers: Record<string, string>): string {
  const [kind, id] = by.split(":");
  if (kind === "user") return people[id] ? `${people[id]} (companion)` : "Someone in the companion";
  if (kind === "computer") return computers[id] ?? "The service PC";
  return "Unknown";
}

/** The newest version that was not deleted: what a deleted Frame is restored to. */
export function lastKept(versions: Version[]): Version | null {
  return versions.find((v) => !v.deleted && v.body) ?? null;
}
