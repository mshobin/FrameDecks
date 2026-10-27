// FrameDecks - the website's Meeting Form: a Frame record <-> the rows of the Excel Meeting Form, and back
// (design: docs/architecture/meeting-form.md, section 2). New Content is built in the same shape as the program's
// Excel import (app/js/meeting-book.js build()); the program's normalize (store.js cleanScene / cleanLayer) fills in
// every default. Editing changes only the fields the form shows; position, size, look and the item on screen stay
// as the PC made them. Self-contained, with no imports, so the tests load it with Node's type stripping.

type Obj = { [key: string]: unknown };

// ---- The lists the Excel template's drop-downs use (meeting-book.js), and their stored values ----

export const CONTENT_TYPES = [
  ["question", "Question"],
  ["scripture", "Scripture"],
  ["text", "Text"], // also the Excel "Announcement": the same Content in the program
  ["prayer", "Prayer Point"],
  ["lowerthird", "Lower Third"],
  ["countdown", "Timer"],
  ["image", "Image"],
  ["video", "Video"],
  ["powerpoint", "PowerPoint"],
  ["audio", "Audio"],
  ["birthday", "Birthday"],
  ["brand", "Branding"],
  ["camera", "Camera"],
  ["screen", "Screen"],
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number][0];
export const TYPE_NAME = Object.fromEntries(CONTENT_TYPES) as Record<ContentType, string>;

/** Background: [form name, stored colour]. "Brand" is the meeting's brand colour. */
export const BACKGROUNDS: [string, string][] = [
  ["None", ""],
  ["Navy", "#0b1222"],
  ["Black", "#000000"],
  ["White", "#ffffff"],
  ["Brand", "brand"],
];
/** Frame transitions: [form name, stored type] (store.js TX; "Frame default" follows the meeting's profile). */
export const TRANSITIONS: [string, string][] = [
  ["Frame default", "profile"],
  ["Cut", "cut"],
  ["Fade", "fade"],
  ["Cross Dissolve", "dissolve"],
  ["Dip to Black", "dip-black"],
  ["Dip to White", "dip-white"],
  ["Blur Fade", "blur-fade"],
  ["Zoom Fade", "zoom-fade"],
  ["Slide Left", "slide-left"],
  ["Slide Right", "slide-right"],
  ["Push", "push"],
  ["Reveal", "reveal"],
  ["Soft Scale", "soft-scale"],
  ["Cinema Fade", "cinema"],
  ["Church Service Fade", "church"],
];
/** Card animations (questions and scripture): [form name, stored value] (store.js TRANSITIONS). */
export const CARD_ANIMATIONS: [string, string][] = [
  ["Content default", ""],
  ["Fade", "fade"],
  ["Gentle Rise", "rise"],
  ["Word by Word", "words"],
  ["Typewriter", "typewriter"],
  ["Burst", "burst"],
  ["Cut", "none"],
];
/** Text animations (announcement, prayer, lower third): store.js keeps fade, rise or none. */
export const TEXT_ANIMATIONS: [string, string][] = [
  ["Content default", ""],
  ["Fade", "fade"],
  ["Gentle Rise", "rise"],
  ["Cut", "none"],
];

/** Meeting details: [key, label] (meeting-book.js FIELDS; the meeting record keeps the same keys). */
export const MEETING_FIELDS: [string, string, number][] = [
  ["title", "Meeting name", 80],
  ["date", "Date", 40],
  ["time", "Time", 40],
  ["location", "Location / link", 200],
  ["presenter", "Speaker name", 80],
  ["contact", "Speaker contact", 120],
  ["attendees", "Expected attendees", 20],
  ["attendeeNotes", "Attendee notes", 2000],
  ["owner", "Presentation owner", 80],
  ["contentNotes", "Content notes", 2000],
  ["notes", "Meeting notes", 2000],
  ["extra", "Additional notes", 4000],
];

// The program's limits (store.js cleanScene / cleanLayer / cleanItem)
export const LIMITS = { frames: 400, layers: 60, items: 1000, name: 80, group: 60, layerName: 60, script: 20000, text: 2000, itemText: 8000, short: 200, label: 80 };

const MEDIA_KINDS = ["camera", "screen", "window", "image", "video", "pdf", "background", "text", "rect", "ellipse"];
const ABOUT = "About this Frame: ";

// ---- The form ----

export type QuestionRow = { id?: string; label: string; text: string; media: string; timer: string; anim: string };
export type ScriptureRow = { id?: string; label: string; ref: string; version: string; text: string; anim: string };
export type ContentRow = {
  layerId?: string; // the Content this row edits; none for a new one
  type: ContentType | "other";
  kind?: string; // for "other": the program's own kind (shown, never edited here)
  name: string;
  main: string; // text, or the file name in the service PC's media folder
  label: string; // the on-screen label / title
  duration: string; // Timer: minutes (5) or a time (10:30)
  anim: string;
  pptBg: "show" | "hide";
  questions: QuestionRow[];
  scriptures: ScriptureRow[];
};
export type FrameForm = { name: string; desc: string; script: string; background: string; transition: string; content: ContentRow[] };
export type MeetingForm = Record<string, string>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const cut = (v: unknown, n: number) => String(v ?? "").slice(0, n);
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
export const newId = (prefix: string) => prefix + Math.random().toString(36).slice(2, 9);
const layersOf = (frame: Obj): Obj[] => (Array.isArray(frame.layers) ? frame.layers.filter(isObj) : []);

export function emptyRow(type: ContentType = "question"): ContentRow {
  return { type, name: TYPE_NAME[type], main: "", label: "", duration: "", anim: "", pptBg: "show", questions: [], scriptures: [] };
}
export function emptyFrame(): FrameForm {
  return { name: "", desc: "", script: "", background: "None", transition: "profile", content: [] };
}

// ---- Record -> form (as the Excel export reads a Frame, meeting-book.js exportSheets) ----

function rowOf(l: Obj): ContentRow {
  const c = (isObj(l.c) ? l.c : {}) as Obj;
  const row = emptyRow();
  row.layerId = str(l.id);
  row.name = str(l.name);
  const kind = str(l.kind);
  const items = Array.isArray(c.items) ? c.items.filter(isObj) : [];
  if (kind === "question" || kind === "scripture") {
    row.type = kind;
    row.label = str(c.label);
    row.anim = str(isObj(c.look) ? c.look.transition : "");
    if (kind === "question") {
      row.questions = items.map((it) => ({ id: str(it.id), label: str(it.label), text: str(it.text), media: str(it.media), timer: str(it.timer), anim: str(it.transition) }));
    } else {
      row.scriptures = items.map((it) => ({ id: str(it.id), label: str(it.label), ref: str(it.ref), version: str(it.version), text: str(it.text), anim: str(it.transition) }));
    }
  } else if (kind === "announcement" || kind === "prayer") {
    row.type = kind === "prayer" ? "prayer" : "text";
    row.label = c.label === false ? "" : str(c.title);
    row.main = str(c.text);
    row.anim = str(c.anim);
  } else if (kind === "lowerthird") {
    row.type = kind;
    row.label = str(c.title);
    row.main = str(c.text);
    row.anim = str(c.anim);
  } else if (kind === "countdown") {
    row.type = "countdown";
    row.label = str(c.title);
    row.duration = c.mode === "until" ? str(c.until) : str(c.minutes ?? "");
  } else if (kind === "image" || kind === "video" || kind === "audio") {
    row.type = kind;
    row.main = str(c.file);
  } else if (kind === "pdf") {
    row.type = "powerpoint";
    row.main = str(c.file);
    row.pptBg = c.objectsOnly ? "hide" : "show";
  } else if (kind === "brand" || kind === "birthday" || kind === "camera" || kind === "screen") {
    row.type = kind;
  } else {
    row.type = "other";
    row.kind = kind;
  }
  return row;
}

export function backgroundName(color: string): string {
  const named = BACKGROUNDS.find(([, value]) => value && value === color.toLowerCase());
  return named ? named[0] : color;
}

export function frameFormOf(frame: Obj): FrameForm {
  let notes = str(frame.notes);
  let desc = "";
  const about = new RegExp(`\\n?${ABOUT}([^\\n]*)`).exec(notes);
  if (about) {
    desc = about[1];
    notes = notes.replace(about[0], "").trim();
  }
  const layers = layersOf(frame);
  const bg = layers.find((l) => l.kind === "background");
  const bgColor = bg && isObj(bg.c) && isObj(bg.c.props) ? str(bg.c.props.color) : "";
  return {
    name: str(frame.name),
    desc,
    script: notes,
    background: bg ? backgroundName(bgColor) || "None" : "None",
    transition: isObj(frame.tx) ? str(frame.tx.type) || "profile" : "profile",
    content: layers.filter((l) => l.kind !== "background").map(rowOf),
  };
}

export function meetingFormOf(meeting: unknown): MeetingForm {
  const m = isObj(meeting) ? meeting : {};
  return Object.fromEntries(MEETING_FIELDS.map(([key]) => [key, str(m[key])]));
}

// ---- Checks (the same rules as the Excel import, meeting-book.js parse) ----

export function problemsOf(form: FrameForm): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const single: Record<string, boolean> = {};
  if (form.content.length + (form.background && form.background !== "None" ? 1 : 0) > LIMITS.layers) {
    out.push(`A Frame holds up to ${LIMITS.layers} Content.`);
  }
  const bg = form.background.trim();
  if (bg && !BACKGROUNDS.some(([name]) => name === bg) && !/^#?[0-9a-f]{6}$/i.test(bg)) {
    out.push(`Background “${bg}” is not one of: ${BACKGROUNDS.map(([n]) => n).join(", ")}, or a colour like #1F3A6D.`);
  }
  form.content.forEach((row, i) => {
    const where = `Content ${i + 1} (${row.name.trim() || (row.type === "other" ? row.kind : TYPE_NAME[row.type as ContentType])})`;
    const name = row.name.trim().toLowerCase();
    if (name && seen.has(name)) out.push(`${where}: another Content in this Frame has the same name. Give each its own name.`);
    seen.add(name);
    if (["question", "scripture", "birthday", "brand"].includes(row.type)) {
      if (single[row.type]) out.push(`${where}: a Frame has one ${TYPE_NAME[row.type as ContentType]} Content. Put all its items in that one.`);
      single[row.type] = true;
    }
    if (row.type === "question") {
      if (row.questions.length > LIMITS.items) out.push(`${where}: up to ${LIMITS.items} questions.`);
      row.questions.forEach((q, j) => {
        if (!q.text.trim()) out.push(`${where}, question ${j + 1}: the question text is empty.`);
        if (q.timer.trim() && !/^\d{1,3}(\.\d)?$/.test(q.timer.trim())) out.push(`${where}, question ${j + 1}: Timer is in minutes, for example 3.`);
      });
    }
    if (row.type === "scripture") {
      if (row.scriptures.length > LIMITS.items) out.push(`${where}: up to ${LIMITS.items} readings.`);
      row.scriptures.forEach((v, j) => {
        if (!v.ref.trim()) out.push(`${where}, reading ${j + 1}: the reference is empty (for example John 15:5).`);
      });
    }
    if (row.type === "countdown") {
      const d = row.duration.trim();
      if (d && !/^\d{1,3}(\.\d)?$/.test(d) && !/^\d{1,2}:\d{2}$/.test(d)) out.push(`${where}: Duration is minutes (5) or a time (10:30).`);
    }
  });
  return out;
}

export function frameCountProblem(frames: number): string | null {
  return frames >= LIMITS.frames ? `FrameDecks holds up to ${LIMITS.frames} Frames.` : null;
}

// ---- Form -> record ----

function makeLayer(kind: string, name: string, c: Obj, fallbackName: string): Obj {
  return { id: newId("L"), kind, name: cut(name.trim() || fallbackName, LIMITS.layerName), visible: true, c };
}

function questionItems(rows: QuestionRow[], before: Map<string, Obj>): Obj[] {
  return rows.slice(0, LIMITS.items).map((q) => {
    const old = q.id ? before.get(q.id) : undefined;
    const it: Obj = old ? clone(old) : { id: newId("q") };
    it.label = cut(q.label.trim(), LIMITS.short);
    it.text = cut(q.text.trim(), LIMITS.itemText);
    it.media = cut(q.media.trim(), LIMITS.short);
    it.timer = cut(q.timer.trim(), LIMITS.short);
    if (q.anim) it.transition = q.anim;
    else delete it.transition;
    return it;
  });
}

function scriptureItems(rows: ScriptureRow[], before: Map<string, Obj>): Obj[] {
  return rows.slice(0, LIMITS.items).map((v) => {
    const old = v.id ? before.get(v.id) : undefined;
    const it: Obj = old ? clone(old) : { id: newId("v") };
    it.label = cut(v.label.trim(), LIMITS.short);
    it.ref = cut(v.ref.trim(), LIMITS.short);
    it.version = cut(v.version.trim(), LIMITS.short);
    it.text = cut(v.text.trim(), LIMITS.itemText);
    if (v.anim) it.transition = v.anim;
    else delete it.transition;
    return it;
  });
}

function timerOf(duration: string, c: Obj) {
  const d = duration.trim();
  if (/^\d{1,2}:\d{2}$/.test(d)) {
    c.mode = "until";
    c.until = d;
  } else {
    c.mode = "duration";
    c.minutes = /^\d{1,3}(\.\d)?$/.test(d) ? Number(d) : 5;
  }
}

/** One row as a layer: `old` (the Content it edits, when it is the same kind) keeps everything the form does not
 * show; a new row is built like the Excel import's build(). */
function layerOf(row: ContentRow, old: Obj | undefined): Obj | null {
  const t = row.type;
  if (t === "other") return old ? clone(old) : null;
  const kind = t === "text" ? "announcement" : t === "powerpoint" ? "pdf" : t;
  const same = old && old.kind === kind ? clone(old) : undefined;
  const l: Obj = same ?? makeLayer(kind, row.name, {}, TYPE_NAME[t]);
  l.name = cut(row.name.trim() || TYPE_NAME[t], LIMITS.layerName);
  const c = (isObj(l.c) ? l.c : (l.c = {})) as Obj;
  const label = cut(row.label.trim(), LIMITS.label);
  if (t === "question" || t === "scripture") {
    const before = new Map((Array.isArray(c.items) ? c.items.filter(isObj) : []).map((it) => [str(it.id), it]));
    const items = t === "question" ? questionItems(row.questions, before) : scriptureItems(row.scriptures, before);
    c.items = items;
    c.label = label;
    // The item on screen is kept while it exists; a new list starts at its first item (as the Excel import does)
    if (!same || !items.some((it) => it.id === c.itemId)) c.itemId = items[0] ? str(items[0].id) : "";
    if (row.anim) c.look = { ...(isObj(c.look) ? c.look : {}), transition: row.anim };
    else if (isObj(c.look)) {
      delete c.look.transition;
      if (!Object.keys(c.look).length) delete c.look;
    }
  } else if (t === "text" || t === "prayer") {
    c.title = label;
    c.text = cut(row.main, LIMITS.text);
    c.label = !!label; // the title shows only when there is one
    if (row.anim) c.anim = row.anim;
  } else if (t === "lowerthird") {
    // A new one without a title: "Name | Role" in the main content is split, as the Excel import does
    const parts = row.main.split(/\s*\|\s*|\n/);
    const split = !same && !label;
    c.title = split ? cut(parts[0] ?? "", LIMITS.label) : label;
    c.text = cut(split ? parts.slice(1).join(" ") : row.main, LIMITS.text);
    if (row.anim) c.anim = row.anim;
  } else if (t === "countdown") {
    c.title = label || (same ? str(c.title) : "Starting in");
    timerOf(row.duration || row.main, c);
  } else if (t === "brand") {
    if (!same) Object.assign(c, { logo: true, name: true });
  } else if (t === "image") {
    if (!same) Object.assign(c, { x: 0.5, y: 0.5, w: 0.5 });
    c.file = cut(row.main.trim(), LIMITS.short);
  } else if (t === "video") {
    if (!same) Object.assign(c, { x: 0.5, y: 0.5, w: 0.6, loop: true });
    c.file = cut(row.main.trim(), LIMITS.short);
  } else if (t === "powerpoint") {
    if (!same) Object.assign(c, { x: 0.5, y: 0.5, w: 1, h: 1 });
    c.file = cut(row.main.trim(), LIMITS.short);
    c.objectsOnly = row.pptBg === "hide";
  } else if (t === "audio") {
    if (!same) Object.assign(c, { loop: false, volume: 1 });
    c.file = cut(row.main.trim(), LIMITS.short);
  } else if (t === "camera") {
    if (!same) Object.assign(c, { x: 0.5, y: 0.5, w: 1, h: 1, props: { fit: "cover", mirror: false } });
  } else if (t === "screen") {
    if (!same) Object.assign(c, { x: 0.5, y: 0.5, w: 0.6, h: 0.6, props: { fit: "contain" } });
  }
  return l;
}

function backgroundColor(name: string, brandColor: string): string {
  const named = BACKGROUNDS.find(([n]) => n === name.trim());
  if (named) return named[1] === "brand" ? brandColor || "#1f3a6d" : named[1];
  const hex = name.trim().replace("#", "").toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : "";
}

export type FrameOptions = { brandColor?: string; group?: string; creator?: string; now?: number };

/** The Frame record body for `form`: on top of `base` (the latest version) when editing, or a new Frame. */
export function frameFromForm(form: FrameForm, base: Obj | null, opts: FrameOptions = {}): Obj {
  const now = opts.now ?? Date.now();
  const frame: Obj = base
    ? clone(base)
    : { id: newId("sc_"), group: cut(opts.group ?? "", LIMITS.group), created: now, creator: cut(opts.creator ?? "", 80), from: "Website", template: "Meeting Form" };
  frame.name = cut(form.name.trim() || "Frame", LIMITS.name);
  frame.modified = now;
  const desc = form.desc.trim();
  frame.notes = cut([form.script.replace(/\r\n/g, "\n").trim(), desc ? ABOUT + desc.replace(/\n/g, " ") : ""].filter(Boolean).join("\n"), LIMITS.script);
  const tx = isObj(frame.tx) ? frame.tx : {};
  frame.tx = { ...tx, type: TRANSITIONS.some(([, v]) => v === form.transition) ? form.transition : "profile", ms: typeof tx.ms === "number" ? tx.ms : 500 };

  const old = new Map(layersOf(frame).map((l) => [str(l.id), l]));
  const made: Obj[] = [];
  for (const row of form.content) {
    const l = layerOf(row, row.layerId ? old.get(row.layerId) : undefined);
    if (l) made.push(l);
  }
  // A new Frame is laid out as the Excel import does: words and cards in front, pictures and video behind
  const ordered = base ? made : [...made.filter((l) => !MEDIA_KINDS.includes(str(l.kind))), ...made.filter((l) => MEDIA_KINDS.includes(str(l.kind)))];
  const color = backgroundColor(form.background, opts.brandColor ?? "");
  const oldBg = layersOf(frame).find((l) => l.kind === "background");
  if (color) {
    const bg = oldBg ? clone(oldBg) : makeLayer("background", "Background", {}, "Background");
    const c = (isObj(bg.c) ? bg.c : (bg.c = {})) as Obj;
    c.props = { ...(isObj(c.props) ? c.props : {}), color };
    ordered.push(bg);
  }
  frame.layers = ordered.slice(0, LIMITS.layers);
  return frame;
}

export function meetingFromForm(form: MeetingForm, base: unknown): Obj {
  const out: Obj = isObj(base) ? clone(base) : {};
  for (const [key, , max] of MEETING_FIELDS) out[key] = cut((form[key] ?? "").trim(), max);
  return out;
}

/** A name not used by another Frame (store.js uniqueName): "Welcome" -> "Welcome copy", "Day 5" -> "Day 6". */
export function uniqueName(names: string[], wanted: string): string {
  const taken = new Set(names.map((n) => n.toLowerCase()));
  const base = wanted.trim() || "Frame";
  if (!taken.has(base.toLowerCase())) return base;
  const m = /^(.*?)(\d+)$/.exec(base);
  if (m) for (let n = Number(m[2]) + 1; n < Number(m[2]) + 500; n++) if (!taken.has(`${m[1]}${n}`.toLowerCase())) return `${m[1]}${n}`;
  for (let c = 1; c < 500; c++) {
    const name = base + (c === 1 ? " copy" : ` copy ${c}`);
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `${base} ${newId("")}`;
}

/** The order record with a new Frame added after the last Frame. */
export function withFrame(order: Obj | null, id: string): Obj {
  const out: Obj = order ? clone(order) : { scenes: [], questions: [], verses: [], members: [] };
  const scenes = (Array.isArray(out.scenes) ? out.scenes : []).map(String);
  if (!scenes.includes(id)) scenes.push(id);
  out.scenes = scenes;
  return out;
}

// ---- After a conflict: the latest version, with the person's own changes kept on top (as companion-editing E4) ----

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function rebaseFrame(latest: FrameForm, draft: FrameForm, initial: FrameForm): FrameForm {
  const pick = <K extends "name" | "desc" | "script" | "background" | "transition">(k: K) => (draft[k] !== initial[k] ? draft[k] : latest[k]);
  const initialRows = new Map(initial.content.filter((r) => r.layerId).map((r) => [r.layerId as string, r]));
  const draftIds = draft.content.filter((r) => r.layerId).map((r) => r.layerId as string);
  const removed = new Set([...initialRows.keys()].filter((id) => !draftIds.includes(id)));
  const latestRows = new Map(latest.content.filter((r) => r.layerId).map((r) => [r.layerId as string, r]));
  const changed = (r: ContentRow) => !r.layerId || !same(r, initialRows.get(r.layerId));
  // Removing Content is not moving it: compare the order of the Content that is still there
  const reordered = !same(draftIds, initial.content.filter((r) => r.layerId && draftIds.includes(r.layerId)).map((r) => r.layerId));
  let content: ContentRow[];
  if (reordered) {
    // The person's order; Content added on the PC meanwhile goes at the end
    content = draft.content
      .filter((r) => !r.layerId || latestRows.has(r.layerId) || changed(r))
      .map((r) => (r.layerId && !changed(r) && latestRows.has(r.layerId) ? (latestRows.get(r.layerId) as ContentRow) : r));
    for (const r of latest.content) if (r.layerId && !draftIds.includes(r.layerId) && !removed.has(r.layerId)) content.push(r);
  } else {
    // The latest order, with the person's edits, removals and new rows applied
    content = latest.content
      .filter((r) => !r.layerId || !removed.has(r.layerId))
      .map((r) => {
        const mine = r.layerId ? draft.content.find((d) => d.layerId === r.layerId) : undefined;
        return mine && changed(mine) ? mine : r;
      });
    content.push(...draft.content.filter((r) => !r.layerId));
  }
  return { name: pick("name"), desc: pick("desc"), script: pick("script"), background: pick("background"), transition: pick("transition"), content };
}
