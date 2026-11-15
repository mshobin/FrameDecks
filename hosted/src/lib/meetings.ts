// FrameDecks 8.5 - several meetings in one workspace, each with its own Frames (docs/architecture/design-history.md §47).
//
// A meeting is an entry in the meeting record's `meetings` list ({id, name, date, notes}); a Frame belongs to the
// meeting whose name is its `group` (a field every PC version keeps), and a Frame whose group names no meeting belongs
// to the first one. With no list (every plan before 8.5) there is one meeting, made from the meeting record's own title,
// date and notes, holding every Frame: nothing changes for a plan until a second meeting is made. The PC's copy of these
// rules is in app/js/store.js (Scenes.meetings); hosted/tests/meetings.test.mjs keeps the two equal.
// Self-contained (no imports), so the tests load it with Node's type stripping.

type Obj = { [key: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, n: number) => String(v ?? "").slice(0, n);

export type Meeting = { id: string; name: string; date: string; notes: string };
export const MEETING_LIMITS = { meetings: 100, name: 60, date: 40, notes: 2000 };

/** The meetings of a plan, in order. Never empty. */
export function meetingsOf(meeting: unknown): Meeting[] {
  const m = isObj(meeting) ? meeting : {};
  const out: Meeting[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const e of Array.isArray(m.meetings) ? m.meetings : []) {
    if (!isObj(e) || out.length >= MEETING_LIMITS.meetings) continue;
    const name = str(e.name, MEETING_LIMITS.name).trim();
    const id = str(e.id, 40).trim();
    if (!name || !id || seenIds.has(id) || seenNames.has(name.toLowerCase())) continue;
    seenIds.add(id);
    seenNames.add(name.toLowerCase());
    out.push({ id, name, date: str(e.date, MEETING_LIMITS.date), notes: str(e.notes, MEETING_LIMITS.notes) });
  }
  if (!out.length) out.push({ id: "main", name: str(m.title, MEETING_LIMITS.name).trim() || "Meeting", date: str(m.date, MEETING_LIMITS.date), notes: str(m.notes, MEETING_LIMITS.notes) });
  return out;
}

/** The meeting a Frame belongs to: the one named by its group, else the first. */
export function meetingOfFrame(frame: Obj, list: Meeting[]): Meeting {
  const g = String(frame.group ?? "").trim().toLowerCase();
  return list.find((m) => m.name.toLowerCase() === g) ?? list[0];
}

/** The Frames of one meeting, in plan order (templates are never part of a meeting). */
export function framesOfMeeting(scenes: unknown[], list: Meeting[], id: string): Obj[] {
  return scenes.filter((s): s is Obj => isObj(s) && !s.tpl && meetingOfFrame(s, list).id === id);
}

/** A name no other meeting uses: "Sunday" -> "Sunday 2". */
export function uniqueMeetingName(list: Meeting[], wanted: string, except = ""): string {
  const base = wanted.trim().slice(0, MEETING_LIMITS.name) || "New meeting";
  const used = new Set(list.filter((m) => m.id !== except).map((m) => m.name.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const name = `${base.slice(0, MEETING_LIMITS.name - String(i).length - 1)} ${i}`;
    if (!used.has(name.toLowerCase())) return name;
  }
}

export const newMeetingId = () => "mt_" + Math.random().toString(36).slice(2, 9);

/** The meeting record with `list` written out. `current` (a meeting id): its name, date and notes also become the
 * record's title, date and notes, which every PC version shows (the PC writes its own choice of meeting the same way). */
export function withMeetings(meeting: unknown, list: Meeting[], current?: string): Obj {
  const out: Obj = isObj(meeting) ? JSON.parse(JSON.stringify(meeting)) : {};
  out.meetings = list.map((m) => ({ id: m.id, name: m.name, date: m.date, notes: m.notes }));
  const cur = current ? list.find((m) => m.id === current) : undefined;
  if (cur) Object.assign(out, { title: cur.name, date: cur.date, notes: cur.notes });
  return out;
}

/** Which meeting the record's title, date and notes describe (the one a PC last chose), if any. */
export function currentMeetingId(meeting: unknown, list: Meeting[]): string {
  const title = isObj(meeting) ? String(meeting.title ?? "").trim().toLowerCase() : "";
  return (list.find((m) => m.name.toLowerCase() === title) ?? list[0]).id;
}

const newId = (prefix: string) => prefix + Math.random().toString(36).slice(2, 9);

/** 26.11.49 "Copy of …": the Frames of one meeting copied into the meeting named `group`, as the PC's
 * Scenes.addMeeting(…, {copy}) does: new ids for each Frame and its Content, the same Decks, looks and timings, and the
 * scripture and questions left empty to fill in. */
export function copyFramesTo(frames: Obj[], group: string, now = Date.now()): Obj[] {
  return frames.map((f) => {
    const c = JSON.parse(JSON.stringify(f)) as Obj;
    c.id = newId("sc_");
    c.group = group;
    c.created = now;
    c.modified = now;
    c.from = "";
    c.fav = false;
    c.layers = (Array.isArray(c.layers) ? c.layers : []).filter(isObj).map((l) => {
      const k = { ...l, id: newId("L") } as Obj;
      const cc = isObj(k.c) ? { ...k.c } : {};
      if (k.kind === "scripture" || k.kind === "question") {
        cc.itemId = "";
        if (Array.isArray(cc.items)) cc.items = [];
        if (k.kind === "scripture") Object.assign(cc, { ref: "", text: "", version: "" });
      }
      k.c = cc;
      return k;
    });
    return c;
  });
}

/** 26.11.49 how a meeting's date reads on its tab: an ISO date ("2026-11-19") reads "Thu 19 Nov"; other text as written.
 * `when` says whether it is past, the next one (the nearest date from today) or neither. */
export function meetingDates(list: Pick<Meeting, "id" | "date">[], today = new Date()): Record<string, { label: string; when: "past" | "next" | "" }> {
  const iso = (v: string) => /^\d{4}-\d{2}-\d{2}/.exec(v.trim())?.[0] ?? "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const t = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  let next = "";
  for (const m of list) {
    const d = iso(m.date);
    if (d && d >= t && (!next || d < iso(list.find((x) => x.id === next)!.date))) next = m.id;
  }
  const out: Record<string, { label: string; when: "past" | "next" | "" }> = {};
  for (const m of list) {
    const d = iso(m.date);
    let label = m.date.slice(0, 24);
    if (d) {
      const day = new Date(`${d}T12:00:00`);
      label = `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.getDay()]} ${day.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][day.getMonth()]}`;
    }
    out[m.id] = { label, when: m.id === next ? "next" : d && d < t ? "past" : "" };
  }
  return out;
}
