// FrameDecks - a saved plan as sync records ("entities"), and back: the companion's copy of the desktop's
// src/sync_entities.py (design: docs/architecture/metadata-sync.md, section 3). Both are checked against the shared
// fixtures in tests/fixtures/sync/ (hosted/tests/sync-entities.test.mjs). Self-contained, with no imports, so the
// tests can load it directly with Node's type stripping.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export const KINDS = [
  "frame",
  "template",
  "order",
  "library_question",
  "library_verse",
  "theme",
  "brand",
  "layout",
  "meeting",
  "member",
] as const;
export type Kind = (typeof KINDS)[number];

export type SyncRecord = { kind: Kind; id: string; body: Json; deleted?: boolean };
export type Split = { entities: SyncRecord[]; local: JsonObject };

// What a card shows right now (live, never synced); every other card field is its look (the theme record).
export const CARD_LIVE: Record<string, string[]> = {
  question: ["text", "visible", "seq", "cut", "itemId", "mode", "play", "upcoming", "out"],
  verse: ["text", "ref", "version", "visible", "seq", "cut", "itemId", "play", "upcoming", "out"],
  birthday: ["name", "greeting", "message", "country", "visible", "seq", "cut", "out"],
};
const CARDS = ["question", "verse", "birthday"];
const SINGLE = ["brand", "layout", "meeting"];

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const list = (value: unknown): Json[] => (Array.isArray(value) ? value : []);
const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** JSON with sorted keys: equal content gives equal text, whatever the key order. */
export function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canon(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

/** List items -> record ids, unique within the list (a repeated id gets #2, #3... so nothing is lost). */
function ids(items: Json[]): string[] {
  const seen: Record<string, number> = {};
  return items.map((item, i) => {
    const raw = isObject(item) ? item.id : undefined;
    const key = raw !== undefined && raw !== null && raw !== "" ? String(raw) : `#${i}`;
    seen[key] = (seen[key] ?? 0) + 1;
    return seen[key] > 1 ? `${key}#${seen[key]}` : key;
  });
}

export function split(doc: JsonObject, members: Json[] = []): Split {
  const d = clone(isObject(doc) ? doc : {});
  const people = clone(list(members));
  const out: SyncRecord[] = [];
  const add = (kind: Kind, id: string, body: Json) => out.push({ kind, id: String(id), body });

  const scenes = list(d.scenes);
  const sceneIds = ids(scenes);
  scenes.forEach((scene, i) => add(isObject(scene) && scene.tpl ? "template" : "frame", sceneIds[i], scene));
  const library = isObject(d.library) ? d.library : {};
  const questions = list(library.questions);
  const verses = list(library.verses);
  const qIds = ids(questions);
  const vIds = ids(verses);
  questions.forEach((item, i) => add("library_question", qIds[i], item));
  verses.forEach((item, i) => add("library_verse", vIds[i], item));
  const memberIds = ids(people);
  people.forEach((person, i) => add("member", memberIds[i], person));
  add("order", "order", { scenes: sceneIds, questions: qIds, verses: vIds, members: memberIds });
  const theme: JsonObject = {};
  for (const card of CARDS) {
    const value = d[card];
    if (!isObject(value)) continue;
    theme[card] = Object.fromEntries(Object.entries(value).filter(([key]) => !CARD_LIVE[card].includes(key)));
  }
  add("theme", "cards", theme);
  for (const key of SINGLE) if (key in d) add(key as Kind, key, d[key]);
  if ("profile" in d) add("layout", "profile", { value: d.profile });

  const local: JsonObject = {};
  for (const [key, value] of Object.entries(d)) {
    if (key === "scenes" || key === "profile" || SINGLE.includes(key)) continue;
    if (key === "library") {
      local.library = Object.fromEntries(Object.entries(library).filter(([k]) => k !== "questions" && k !== "verses"));
    } else if (CARDS.includes(key) && isObject(value)) {
      local[key] = Object.fromEntries(CARD_LIVE[key].filter((k) => k in value).map((k) => [k, value[k]]));
    } else {
      local[key] = value;
    }
  }
  local.keys = Object.keys(d);
  return { entities: out, local };
}

export function join(entities: SyncRecord[], localIn: JsonObject): { doc: JsonObject; members: Json[] } {
  const local = clone(isObject(localIn) ? localIn : {});
  const by: Record<string, Record<string, SyncRecord>> = {};
  for (const e of entities ?? []) {
    if (!e || e.body === null || e.body === undefined || e.deleted) continue;
    (by[e.kind] ??= {})[String(e.id)] = e;
  }
  const body = (kind: string, id: string): Json | undefined => {
    const e = by[kind]?.[id];
    return e ? clone(e.body) : undefined;
  };
  const order = (isObject(body("order", "order")) ? body("order", "order") : {}) as JsonObject;

  // Records in the order's sequence, then any the order does not list yet (added elsewhere) at the end.
  const ordered = (kinds: string[], idsInOrder: Json[]): Json[] => {
    const wanted = idsInOrder.map(String);
    const got: Json[] = [];
    for (const id of wanted) {
      for (const kind of kinds) {
        const b = body(kind, id);
        if (b !== undefined) {
          got.push(b);
          break;
        }
      }
    }
    for (const kind of kinds) {
      for (const [id, e] of Object.entries(by[kind] ?? {})) if (!wanted.includes(id)) got.push(clone(e.body));
    }
    return got;
  };

  const keys = Array.isArray(local.keys) ? (local.keys as string[]) : [];
  delete local.keys;
  const parts: JsonObject = { scenes: ordered(["frame", "template"], list(order.scenes)) };
  parts.library = {
    verses: ordered(["library_verse"], list(order.verses)),
    questions: ordered(["library_question"], list(order.questions)),
    ...(isObject(local.library) ? local.library : {}),
  };
  const theme = (isObject(body("theme", "cards")) ? body("theme", "cards") : {}) as JsonObject;
  for (const card of CARDS) {
    if (!(card in local) && !(card in theme)) continue;
    parts[card] = { ...(isObject(theme[card]) ? theme[card] : {}), ...(isObject(local[card]) ? local[card] : {}) };
  }
  for (const key of SINGLE) {
    const b = body(key, key);
    if (b !== undefined) parts[key] = b;
  }
  const profile = body("layout", "profile");
  if (isObject(profile)) parts.profile = profile.value;
  for (const [key, value] of Object.entries(local)) {
    if (!(key in parts) && key !== "library" && !CARDS.includes(key)) parts[key] = value;
  }

  const doc: JsonObject = {};
  for (const key of keys) if (key in parts) doc[key] = parts[key];
  for (const [key, value] of Object.entries(parts)) if (!(key in doc)) doc[key] = value;
  return { doc, members: ordered(["member"], list(order.members)) };
}

/** What changed between two record lists: the records to send, and the ones that are gone. */
export function changes(
  before: SyncRecord[],
  after: SyncRecord[],
): { upserts: SyncRecord[]; deletes: { kind: Kind; id: string }[] } {
  const old = new Map((before ?? []).map((e) => [`${e.kind}\u0000${e.id}`, canon(e.body)]));
  const now = new Set((after ?? []).map((e) => `${e.kind}\u0000${e.id}`));
  return {
    upserts: (after ?? []).filter((e) => old.get(`${e.kind}\u0000${e.id}`) !== canon(e.body)),
    deletes: (before ?? [])
      .filter((e) => !now.has(`${e.kind}\u0000${e.id}`))
      .map((e) => ({ kind: e.kind, id: e.id })),
  };
}
