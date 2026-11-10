// FrameDecks 26.11.39 - the Plan page's changes wait on the page until Sync Now (components/meeting-form-panel.tsx).
// Adding, editing, moving and deleting Frames goes into a list of changes, kept in this browser so a closed tab loses
// nothing. Sync Now sends only what really differs from the workspace, in one push (the same rule as the first sync of
// a PC, src/first_sync.py): a Frame edited and then put back as it was, or added and deleted again before Sync Now, is
// not sent at all, so nothing is duplicated. Meeting details, the transition style and new meetings still save at once.
import type { PulledRecord } from "@/lib/workspace-sync";

type Obj = { [key: string]: unknown };
export type Kind = "frame" | "order";
/** One waiting change: the record as the workspace had it when it was read (rev, and its body for the comparison), and
 * what it becomes (body), or deleted. A Frame that is new here has rev 0 and no base. */
export type Change = { kind: Kind; id: string; rev: number; base: Obj | null; body: Obj | null; deleted?: true };
export type Changes = Record<string, Change>;

export const keyOf = (kind: string, id: string) => `${kind}/${id}`;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const TIMES = new Set(["modified", "created"]);
function content(value: unknown, top = true): unknown {
  if (Array.isArray(value)) return value.map((v) => content(v, false));
  if (!isObj(value)) return value;
  const out: Obj = {};
  for (const k of Object.keys(value).sort()) if (!(top && TIMES.has(k))) out[k] = content(value[k], false);
  return out;
}
/** What a record holds, its save times aside: two bodies with the same print are the same Frame. */
export function bodyPrint(body: unknown): string {
  return JSON.stringify(content(body));
}

/** Adds one change, or takes it out when it ends up where the workspace already is. */
export function stage(changes: Changes, server: PulledRecord | null | undefined, kind: Kind, id: string, body: Obj | null): Changes {
  const k = keyOf(kind, id);
  const next = { ...changes };
  const before = next[k];
  const base = before ? before.base : server ? (server.body as Obj) : null;
  const rev = before ? before.rev : server ? server.rev : 0;
  if (body === null) {
    if (!base) delete next[k];                                   // new here and deleted again: nothing to send
    else next[k] = { kind, id, rev, base, body: null, deleted: true };
    return next;
  }
  if (base && bodyPrint(base) === bodyPrint(body)) delete next[k]; // back to what the workspace has
  else next[k] = { kind, id, rev, base, body };
  return next;
}

/** The workspace's records with the waiting changes on top: what the page shows. */
export function overlay(records: PulledRecord[], changes: Changes): PulledRecord[] {
  const seen = new Set<string>();
  const out: PulledRecord[] = [];
  for (const r of records) {
    const k = keyOf(r.kind, r.id);
    seen.add(k);
    const c = changes[k];
    if (!c) out.push(r);
    else if (!c.deleted && c.body) out.push({ ...r, body: c.body as PulledRecord["body"] });
  }
  for (const [k, c] of Object.entries(changes)) {
    if (seen.has(k) || c.deleted || !c.body) continue;
    out.push({ kind: c.kind, id: c.id, rev: c.rev, seq: 0, body: c.body as PulledRecord["body"] });
  }
  return out;
}

export type Summary = { added: string[]; changed: string[]; deleted: string[]; moved: boolean; count: number };
const nameOf = (c: Change) => String((c.body ?? c.base ?? {}).name ?? "Frame");

/** In words for the Sync Now box: which Frames are added, changed and deleted, and whether the order moved. */
export function summarize(changes: Changes): Summary {
  const s: Summary = { added: [], changed: [], deleted: [], moved: false, count: 0 };
  const frames = Object.values(changes).filter((c) => c.kind === "frame");
  for (const c of frames) (c.deleted ? s.deleted : c.base ? s.changed : s.added).push(nameOf(c));
  const order = changes[keyOf("order", "order")];
  if (order && !order.deleted) {
    const known = new Set(frames.map((c) => c.id));
    const ids = (b: Obj | null) => (Array.isArray(b?.scenes) ? (b.scenes as unknown[]).map(String) : []).filter((x) => !known.has(x));
    s.moved = ids(order.body).join() !== ids(order.base).join();   // a move, not only a Frame added or deleted
  }
  s.count = frames.length + (s.moved ? 1 : 0);
  return s;
}

/** What Sync Now pushes: every Frame first, then the order (so the order never names a Frame that is not there yet). */
export function toPush(changes: Changes) {
  return Object.values(changes)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "frame" ? -1 : 1))
    .map((c) => (c.deleted ? { kind: c.kind, id: c.id, rev: c.rev, deleted: true as const } : { kind: c.kind, id: c.id, rev: c.rev, body: c.body as Obj }));
}

/** The order after someone else changed it meanwhile: this page's order, then any Frame the other side added, without
 * the Frames deleted here. */
export function mergeOrder(mine: Obj, theirs: Obj, deleted: string[]): Obj {
  const list = (b: Obj) => (Array.isArray(b.scenes) ? (b.scenes as unknown[]).map(String) : []);
  const gone = new Set(deleted);
  const scenes = list(mine).filter((s) => !gone.has(s));
  for (const s of list(theirs)) if (!gone.has(s) && !scenes.includes(s)) scenes.push(s);
  return { ...theirs, ...mine, scenes };
}

const STORE = (ws: string) => `fd-plan-changes-${ws}`;
export function loadChanges(ws: string, store: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Changes {
  try {
    const raw = JSON.parse(store?.getItem(STORE(ws)) ?? "{}");
    return isObj(raw) ? (raw as Changes) : {};
  } catch {
    return {};
  }
}
export function saveChanges(ws: string, changes: Changes, store: Pick<Storage, "setItem" | "removeItem"> | undefined = globalThis.localStorage) {
  try {
    if (Object.keys(changes).length) store?.setItem(STORE(ws), JSON.stringify(changes));
    else store?.removeItem(STORE(ws));
  } catch {
    /* storage full or blocked: the changes stay on this page until Sync Now */
  }
}
