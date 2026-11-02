// The .frame file (8.2; docs/reference/frame-file.md): the whole plan in one portable file, so a service PC without
// internet gets exactly what was planned here. The PC reads it with app/js/frame-file.js (Settings → Data / Backup →
// Import Frame File); both sides check the same rules.
//
// { format: "framedecks-frame", version: 1, exported, source: "website" | "program", app, title,
//   plan: { scenes, meeting, brand, layout, profile, question, verse, birthday, library, fx },   // the PC's own shapes
//   media: [{ file, type, size, sha256, data (base64) }], counts: { frames, media } }
// Self-contained (no imports), so the tests load it with Node's type stripping, like meeting-form.ts.
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

export const FRAME_FORMAT = "framedecks-frame";
export const FRAME_VERSION = 1;
export const FRAME_MAX_BYTES = 300 * 1024 * 1024;
const PLAN_KEYS = ["scenes", "meeting", "brand", "layout", "profile", "question", "verse", "birthday", "library", "fx"] as const;

export type FrameMedia = { file: string; type: string; size: number; sha256: string; data: string };
export type FrameIntegrity = { frames: number; layers: number; items: number; files: string[]; included: string[] };
export type FrameFile = {
  format: typeof FRAME_FORMAT;
  version: number;
  exported: string;
  source: "website" | "program";
  app: string;
  title: string;
  plan: JsonObject;
  media: FrameMedia[];
  counts: { frames: number; media: number };
  integrity?: FrameIntegrity;
};

const isObj = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);

const FILE_KINDS = ["image", "video", "pdf", "audio"];

/** 8.4 What a .frame file declares it holds, counted exactly as app/js/frame-file.js integrity() does; the PC refuses a
 * file whose plan does not match (cut short, or changed by hand). */
export function integrityOf(plan: JsonObject, media: FrameMedia[] = []): FrameIntegrity {
  const frames = (Array.isArray(plan.scenes) ? plan.scenes : []).filter((s): s is JsonObject => isObj(s) && !s.tpl);
  let layers = 0;
  let items = 0;
  const files: string[] = [];
  for (const s of frames)
    for (const l of Array.isArray(s.layers) ? s.layers : []) {
      if (!isObj(l)) continue;
      layers++;
      const c = isObj(l.c) ? l.c : {};
      if (Array.isArray(c.items)) items += c.items.length;
      if (FILE_KINDS.includes(String(l.kind)) && c.file && !files.includes(String(c.file))) files.push(String(c.file));
    }
  return { frames: frames.length, layers, items, files, included: media.map((m) => m.file) };
}

/** The plan for a .frame file, from the workspace's plan as sync gives it to the PC (sync-entities join(records).doc). */
export function frameFileFromDoc(doc: JsonObject, meta: { app: string; now?: Date; media?: FrameMedia[] }): FrameFile {
  const plan: JsonObject = {};
  for (const k of PLAN_KEYS) if (doc[k] !== undefined) plan[k] = doc[k];
  if (isObj(plan.brand)) plan.brand = { ...plan.brand, logo: "", lw: 0, lh: 0 }; // the logo file stays on each PC
  const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];
  const title = isObj(plan.meeting) ? String(plan.meeting.title ?? "") : "";
  return {
    format: FRAME_FORMAT,
    version: FRAME_VERSION,
    exported: (meta.now ?? new Date()).toISOString(),
    source: "website",
    app: meta.app,
    title,
    plan,
    media: meta.media ?? [], // 8.3: files added on the website, kept in this browser (local-media.ts)
    counts: { frames: scenes.filter((s) => isObj(s) && !s.tpl).length, media: (meta.media ?? []).length },
    integrity: integrityOf(plan, meta.media ?? []),
  };
}

/** "Tuesday Bible Study 2026-11-02.frame" (only letters, digits, spaces and dashes). */
export function frameFileName(title: string, now = new Date()): string {
  const safe = title.replace(/[^\p{L}\p{N} -]+/gu, "").trim().slice(0, 60) || "FrameDecks plan";
  return `${safe} ${now.toISOString().slice(0, 10)}.frame`;
}

/** Checks a .frame file's text; the same rules as app/js/frame-file.js. */
export function readFrameFile(text: string): { ok: true; file: FrameFile } | { ok: false; error: string } {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, error: "This is not a FrameDecks Frame file (it could not be read)." };
  }
  if (!isObj(v) || v.format !== FRAME_FORMAT) return { ok: false, error: "This is not a FrameDecks Frame file." };
  if (typeof v.version !== "number" || v.version > FRAME_VERSION)
    return { ok: false, error: "This Frame file was made by a newer FrameDecks. Update FrameDecks, then try again." };
  if (!isObj(v.plan) || !Array.isArray(v.plan.scenes)) return { ok: false, error: "This Frame file has no Frames in it." };
  const media = Array.isArray(v.media) ? v.media : [];
  for (const m of media) {
    if (!isObj(m) || typeof m.file !== "string" || typeof m.data !== "string" || /[\\/:*?"<>|]/.test(m.file) || m.file.startsWith("."))
      return { ok: false, error: "A picture or file inside this Frame file is damaged." };
  }
  const declared = v.integrity;
  if (isObj(declared)) {
    const got = integrityOf(v.plan, media as unknown as FrameMedia[]);
    if (got.frames !== declared.frames || got.layers !== declared.layers || got.items !== declared.items)
      return { ok: false, error: "This Frame file is incomplete or was changed after it was made. Export it again." };
  }
  return { ok: true, file: v as unknown as FrameFile };
}
