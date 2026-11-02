// FrameDecks 8.3 - the guided Plan workflow on the website (docs/architecture/design-history.md §45): the five steps
// and how far the plan is, moving a Frame to any place on the timeline, and the picture the Preview draws for a Frame.
// Self-contained (no imports), so the tests load it with Node's type stripping, like meeting-form.ts.

type Obj = { [key: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

export type StepId = "meeting" | "frames" | "content" | "preview" | "send";
export type StepState = "done" | "now" | "todo";
export type FlowStep = { id: StepId; title: string; hint: string; action: string };

/** The five steps, in the words the owner asked for (Add Frame, Write Script, Choose Animation, Preview, Sync, Export). */
export const FLOW_STEPS: FlowStep[] = [
  { id: "meeting", title: "Your meeting", hint: "Name and date", action: "Edit details" },
  { id: "frames", title: "Add Frames", hint: "One for each part of the meeting", action: "Add Frame" },
  { id: "content", title: "Words and media", hint: "Script, questions, pictures, animation", action: "Write Script" },
  { id: "preview", title: "Preview", hint: "See it as people will", action: "Preview" },
  { id: "send", title: "Sync or export", hint: "To the service PC", action: "Export for Service PC" },
];

export type FlowFacts = { title: string; frames: Obj[]; previewed: boolean; sent: boolean };

/** Each step's state: done steps are ticked, the first not done is "now". */
export function flowState(f: FlowFacts): Record<StepId, StepState> {
  const done: Record<StepId, boolean> = {
    meeting: f.title.trim().length > 0,
    frames: f.frames.length > 0,
    content: f.frames.length > 0 && f.frames.every((fr) => frameFilled(fr)),
    preview: f.previewed,
    send: f.sent,
  };
  const out = {} as Record<StepId, StepState>;
  let now = false;
  for (const s of FLOW_STEPS) {
    if (done[s.id]) out[s.id] = "done";
    else if (!now) {
      out[s.id] = "now";
      now = true;
    } else out[s.id] = "todo";
  }
  return out;
}

/** A Frame has something in it: a script, or Content with words or a file. */
export function frameFilled(frame: Obj): boolean {
  if (str(frame.notes).trim()) return true;
  const layers = Array.isArray(frame.layers) ? frame.layers.filter(isObj) : [];
  return layers.some((l) => {
    const c = isObj(l.c) ? l.c : {};
    const items = Array.isArray(c.items) ? c.items.filter(isObj) : [];
    return items.some((it) => str(it.text).trim() || str(it.ref).trim()) || !!str(c.text).trim() || !!str(c.file).trim() || !!str(c.title).trim();
  });
}

/** The order with Frame `id` moved to place `to` among the Frames (drag and drop on the timeline). Templates and
 * anything else in the order keep their places. */
export function moveFrameTo(order: Obj, frameIds: string[], id: string, to: number): Obj {
  const out: Obj = JSON.parse(JSON.stringify(order ?? {}));
  const scenes = (Array.isArray(out.scenes) ? out.scenes : []).map(String);
  const frames = scenes.filter((s) => frameIds.includes(s));
  const at = frames.indexOf(id);
  if (at < 0) return out;
  const target = Math.max(0, Math.min(frames.length - 1, Math.round(to)));
  if (target === at) return out;
  frames.splice(at, 1);
  frames.splice(target, 0, id);
  let next = 0;
  out.scenes = scenes.map((s) => (frameIds.includes(s) ? frames[next++] : s));
  return out;
}

export type PreviewCard = { kind: string; label: string; text: string; sub: string };
export type FramePreview = { name: string; background: string; transition: string; cards: PreviewCard[]; media: { kind: string; file: string }[]; script: string };

const MEDIA = ["image", "video", "pdf", "audio"];

/** What the Preview draws for a Frame: its background, the card each Content shows first, the files it uses and its
 * transition (the Frame's own, or the meeting's style when it has none). An approximation of the PC's picture. */
export function previewOf(frame: Obj, opts: { styleTransition?: string } = {}): FramePreview {
  const layers = Array.isArray(frame.layers) ? frame.layers.filter(isObj) : [];
  const cards: PreviewCard[] = [];
  const media: { kind: string; file: string }[] = [];
  let background = "";
  for (const l of layers) {
    if (l.visible === false) continue;
    const kind = str(l.kind);
    const c = isObj(l.c) ? l.c : {};
    if (kind === "background") background = str(c.color) || background;
    else if (MEDIA.includes(kind)) media.push({ kind, file: str(c.file) });
    else if (kind === "question" || kind === "scripture") {
      const items = Array.isArray(c.items) ? c.items.filter(isObj) : [];
      const first = items.find((it) => it.id === c.itemId) ?? items[0];
      if (!first) continue;
      cards.push(
        kind === "question"
          ? { kind, label: str(c.label) || "Question", text: str(first.text), sub: items.length > 1 ? `1 of ${items.length}` : "" }
          : { kind, label: str(c.label) || str(first.ref), text: str(first.text) || str(first.ref), sub: [str(first.ref), str(first.version)].filter(Boolean).join(" ") },
      );
    } else if (kind === "announcement" || kind === "prayer" || kind === "lowerthird") {
      if (str(c.text).trim() || str(c.title).trim()) cards.push({ kind, label: c.label === false ? "" : str(c.title), text: str(c.text), sub: "" });
    } else if (kind === "countdown") cards.push({ kind, label: str(c.title) || "Starting in", text: c.mode === "until" ? str(c.until) : `${str(c.minutes || 5)}:00`, sub: "" });
  }
  const tx = isObj(frame.tx) ? str(frame.tx.type) : "";
  return {
    name: str(frame.name) || "Frame",
    background,
    transition: tx && tx !== "profile" ? tx : opts.styleTransition || "fade",
    cards: cards.slice(0, 3),
    media,
    script: str(frame.notes),
  };
}

/** The meeting's transition style (layout/profile) as the transition the Preview plays. */
export const PROFILE_TX: Record<string, string> = { sunday: "fade", "bible-study": "fade", youth: "push", conference: "fade", wedding: "fade", funeral: "fade", christmas: "dip-white", livestream: "cut" };

/** The media files the plan's Frames use, once each (they travel in the .frame file when this browser has them). */
export function mediaNamesOf(scenes: unknown[]): string[] {
  const seen = new Set<string>();
  for (const s of scenes) {
    if (!isObj(s) || !Array.isArray(s.layers)) continue;
    for (const l of s.layers) {
      if (!isObj(l) || !MEDIA.includes(str(l.kind)) || !isObj(l.c)) continue;
      const f = str(l.c.file).trim();
      if (f) seen.add(f);
    }
  }
  return [...seen];
}

/** A file name safe on every PC: no folders, no characters Windows refuses, not hidden. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[:*?"<>|\u0000-\u001f]+/g, "").replace(/^\.+/, "").trim().slice(0, 120);
  return clean || "file";
}
