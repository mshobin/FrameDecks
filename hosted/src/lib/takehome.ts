// 26.11.63 the take-home page on /follow (room_takehome, 0030): what the leader publishes for the week is checked and cut
// to size before it is shown, and a phone matches the prayer requests it sent (kept on the phone by id only) against the
// statuses the leader published. Pure and dependency-free, so it is tested directly.

export type Verse = { ref: string; text: string; version: string };
export type Takehome = {
  meeting: string;
  org: string;
  date: string; // YYYY-MM-DD or ""
  color: string | null; // #rrggbb
  note: string;
  verses: Verse[];
  questions: string[];
  songs: { title: string; credit: string }[];
  notes: string;
  prayers: string[];
  answered: string[];
  status: Record<string, "praying" | "answered">;
  next: { name: string; date: string; time: string; read: string[]; questions: string[]; join: string } | null;
  days: { label: string; read: string }[];
};
export type MyPrayer = { id: string; text: string; at: number };
export type MyPrayerState = MyPrayer & { state: "praying" | "answered" };

export const MY_PRAYERS_KEY = "fd-my-prayers";
const MY_PRAYERS_MAX = 30;
const LIST_MAX = 60;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown, max = 400): string => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "");
const list = <T>(v: unknown, each: (x: unknown) => T | null): T[] =>
  (Array.isArray(v) ? v : []).slice(0, LIST_MAX).map(each).filter((x): x is T => x !== null);
const strs = (v: unknown, max = 400) => list(v, (x) => str(x, max) || null);
const day = (v: unknown) => {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && dayDate(s) ? s : "";
};

/** A YYYY-MM-DD date as a local date (no time-zone shift), or null when it is not a real date. */
export function dayDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

/** The published take-home body, checked: unknown keys dropped, text trimmed and cut to size, lists kept to what they
 * should hold, a colour only when it is #rrggbb. null when it is not a take-home body at all. */
export function tidyTakehome(raw: unknown): Takehome | null {
  const b = obj(raw);
  if (!b || (b.v !== undefined && b.v !== 1)) return null;
  const n = obj(b.next);
  const status: Takehome["status"] = {};
  for (const [id, st] of Object.entries(obj(b.status) ?? {}).slice(0, 500)) if (st === "praying" || st === "answered") status[id] = st;
  const next = n && str(n.name, 200)
    ? { name: str(n.name, 200), date: day(n.date), time: str(n.time, 40), read: strs(n.read, 200), questions: strs(n.questions), join: str(n.join, 300) }
    : null;
  return {
    meeting: str(b.meeting, 200),
    org: str(b.org, 200),
    date: day(b.date),
    color: typeof b.color === "string" && /^#[0-9a-f]{6}$/i.test(b.color) ? b.color.toLowerCase() : null,
    note: str(b.note, 4000),
    verses: list(b.verses, (x) => {
      const v = obj(x);
      return v && str(v.ref, 120) ? { ref: str(v.ref, 120), text: str(v.text, 4000), version: str(v.version, 40) } : null;
    }),
    questions: strs(b.questions),
    songs: list(b.songs, (x) => {
      const s = obj(x);
      return s && str(s.title, 200) ? { title: str(s.title, 200), credit: str(s.credit, 200) } : null;
    }),
    notes: str(b.notes, 30000),
    prayers: strs(b.prayers, 600),
    answered: strs(b.answered, 600),
    status,
    next,
    days: list(b.days, (x) => {
      const d = obj(x);
      return d && (str(d.label, 80) || str(d.read, 300)) ? { label: str(d.label, 80), read: str(d.read, 300) } : null;
    }),
  };
}

/** Paragraphs of plain text split by blank lines. */
export const paragraphs = (text: string) => (text ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** Where "join" points: an https link opens as it is; a meeting code opens /follow with it; anything else is shown. */
export function joinTarget(join: string): { href: string | null; text: string } {
  const t = (join ?? "").trim();
  if (/^https:\/\/[^\s]+$/i.test(t)) return { href: t, text: t.replace(/^https:\/\//i, "") };
  const code = t.replace(/[\s-]/g, "").toUpperCase();
  if (/^(?:[A-HJ-NP-Z2-9]{6}|[A-HJ-NP-Z2-9]{8})$/.test(code)) return { href: `/follow#c=${code}`, text: code };
  return { href: null, text: t };
}

/** The prayer requests this phone sent, newest first (kept on the phone only). */
export function readMyPrayers(store?: Pick<Storage, "getItem"> | null): MyPrayer[] {
  try {
    const raw = JSON.parse((store === undefined ? localStorage : store)?.getItem(MY_PRAYERS_KEY) ?? "[]");
    return list(raw, (x) => {
      const p = obj(x);
      return p && typeof p.id === "string" && p.id ? { id: p.id, text: str(p.text, 80), at: Number(p.at) || 0 } : null;
    }).slice(0, MY_PRAYERS_MAX);
  } catch {
    return [];
  }
}

/** Keeps a request this phone just sent at the front of the list (at most 30), so its status can be followed. */
export function rememberPrayer(id: string, text: string, at = Date.now(), store?: Pick<Storage, "getItem" | "setItem"> | null): MyPrayer[] {
  const s = store === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : store;
  const kept = [{ id: String(id), text: (text ?? "").trim().slice(0, 80), at }, ...readMyPrayers(s).filter((p) => p.id !== String(id))].slice(0, MY_PRAYERS_MAX);
  try {
    s?.setItem(MY_PRAYERS_KEY, JSON.stringify(kept));
  } catch {
    /* storage blocked: nothing to follow later */
  }
  return kept;
}

/** This phone's requests that the take-home has a status for, newest first. */
export function myPrayerStates(mine: readonly MyPrayer[], status: Takehome["status"]): MyPrayerState[] {
  return mine.filter((p) => Object.hasOwn(status, p.id)).map((p) => ({ ...p, state: status[p.id] }));
}
