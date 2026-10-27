// FrameDecks - editing a Frame's words in the companion (design: docs/architecture/companion-editing.md, E1 "A").
// Each function takes a synced record body and returns a new one with only that change, already in the form the
// desktop's store.js normalize keeps (same limits), so the PC applies it unchanged. Looks, media, layouts and live
// fields are never touched. Self-contained, with no imports, so the tests load it with Node's type stripping.

type Obj = { [key: string]: unknown };

// The desktop's limits (app/js/store.js cleanScene / cleanItem)
export const LIMITS = { name: 80, group: 60, script: 20000, itemText: 8000, short: 200, items: 1000, id: 40 };

export type QuestionEdit = { id?: string; text: string };
export type VerseEdit = { id?: string; ref: string; version: string; text: string };

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const cut = (v: unknown, n: number) => String(v ?? "").slice(0, n);
const newId = (prefix: string) => prefix + Math.random().toString(36).slice(2, 9);

function touched(frame: Obj): Obj {
  const out = clone(frame);
  out.modified = Date.now();
  return out;
}

export function setName(frame: Obj, name: string): Obj {
  const out = touched(frame);
  out.name = cut(name.trim() || "Frame", LIMITS.name);
  return out;
}

export function setGroup(frame: Obj, group: string): Obj {
  const out = touched(frame);
  out.group = cut(group.trim(), LIMITS.group);
  return out;
}

/** The Teleprompter script (`notes`): never on screen, read by the presenter. */
export function setScript(frame: Obj, script: string): Obj {
  const out = touched(frame);
  out.notes = cut(script.replace(/\r\n/g, "\n"), LIMITS.script);
  return out;
}

/** The editable lists of a Frame: its Question and Scripture Content that own a list (as the Studio shows them). */
export function editableLists(frame: Obj): { layerId: string; kind: "question" | "scripture"; title: string }[] {
  const layers = Array.isArray(frame.layers) ? frame.layers.filter(isObj) : [];
  return layers
    .filter((l) => (l.kind === "question" || l.kind === "scripture") && isObj(l.c) && Array.isArray(l.c.items))
    .map((l) => ({
      layerId: String(l.id),
      kind: l.kind as "question" | "scripture",
      title: String(l.name || (l.kind === "question" ? "Question" : "Scripture")),
    }));
}

function setItems(frame: Obj, layerId: string, kind: "question" | "scripture", next: Obj[]): Obj {
  const out = touched(frame);
  const layer = (Array.isArray(out.layers) ? out.layers : []).find(
    (l): l is Obj => isObj(l) && String(l.id) === layerId && l.kind === kind,
  );
  if (!layer || !isObj(layer.c) || !Array.isArray(layer.c.items)) throw new Error("That Content is no longer in this Frame.");
  const before = new Map((layer.c.items as unknown[]).filter(isObj).map((it) => [String(it.id), it]));
  const items = next.slice(0, LIMITS.items).map((edit) => {
    const old = typeof edit.id === "string" && edit.id ? before.get(edit.id) : undefined;
    // An existing item keeps everything the companion does not edit (label, pairing, mode, timer…)
    const item: Obj = old ? clone(old) : { id: newId(kind === "question" ? "q" : "v") };
    item.id = cut(item.id, LIMITS.id);
    for (const [key, value] of Object.entries(edit)) {
      if (key === "id") continue;
      item[key] = cut(String(value).trim(), key === "text" ? LIMITS.itemText : LIMITS.short);
    }
    if (!old) {
      item.label = "";
      if (kind === "question") Object.assign(item, { pair: "", mode: "", media: "", timer: "", anim: "" });
      else Object.assign(item, { anim: "" });
    }
    return item;
  });
  const c = layer.c as Obj;
  c.items = items;
  // The item chosen for the screen: kept while it exists, otherwise nothing is chosen (as when deleting on the PC)
  if (typeof c.itemId === "string" && c.itemId && !items.some((it) => it.id === c.itemId)) c.itemId = "";
  return out;
}

export function setQuestions(frame: Obj, layerId: string, items: QuestionEdit[]): Obj {
  return setItems(frame, layerId, "question", items.filter((q) => q.text.trim()));
}

/** Scripture references with their translation and (optional) text; empty text is fetched on the PC as today. */
export function setVerses(frame: Obj, layerId: string, items: VerseEdit[]): Obj {
  return setItems(frame, layerId, "scripture", items.filter((v) => v.ref.trim() || v.text.trim()));
}

/** The order record with one Frame moved up (-1) or down (+1) among the Frames; templates keep their places. */
export function moveFrame(order: Obj, frameIds: string[], id: string, delta: -1 | 1): Obj {
  const out = clone(order);
  const scenes = (Array.isArray(out.scenes) ? out.scenes : []).map(String);
  const frames = scenes.filter((s) => frameIds.includes(s));
  const at = frames.indexOf(id);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= frames.length) return out;
  [frames[at], frames[to]] = [frames[to], frames[at]];
  let next = 0;
  out.scenes = scenes.map((s) => (frameIds.includes(s) ? frames[next++] : s));
  return out;
}

// ---- The edit form's draft: only what the person changed is applied, on top of the latest version (E4) ----

export type ListDraft =
  | { layerId: string; kind: "question"; title: string; items: QuestionEdit[] }
  | { layerId: string; kind: "scripture"; title: string; items: VerseEdit[] };
export type Draft = { name: string; group: string; script: string; lists: ListDraft[] };

export function draftOf(frame: Obj): Draft {
  const layers = (Array.isArray(frame.layers) ? frame.layers : []).filter(isObj);
  const lists = editableLists(frame).map((l) => {
    const layer = layers.find((x) => String(x.id) === l.layerId) as Obj;
    const items = ((layer.c as Obj).items as unknown[]).filter(isObj).map((it) =>
      l.kind === "question"
        ? { id: String(it.id), text: String(it.text ?? "") }
        : { id: String(it.id), ref: String(it.ref ?? ""), version: String(it.version ?? ""), text: String(it.text ?? "") },
    );
    return { ...l, items } as ListDraft;
  });
  return { name: String(frame.name ?? ""), group: String(frame.group ?? ""), script: String(frame.notes ?? ""), lists };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const listOf = (d: Draft, layerId: string) => d.lists.find((l) => l.layerId === layerId);

/** The frame body to send: `base` (the latest version) with only the fields that differ between `draft` and
 * `initial` (what the form started from) applied. */
export function applyDraft(base: Obj, draft: Draft, initial: Draft): Obj {
  let body = clone(base);
  if (draft.name !== initial.name) body = setName(body, draft.name);
  if (draft.group !== initial.group) body = setGroup(body, draft.group);
  if (draft.script !== initial.script) body = setScript(body, draft.script);
  for (const l of draft.lists) {
    if (same(l.items, listOf(initial, l.layerId)?.items)) continue;
    body = l.kind === "question" ? setQuestions(body, l.layerId, l.items) : setVerses(body, l.layerId, l.items);
  }
  return body;
}

/** After a conflict: the form shows the latest version, with the person's own changes kept on top. Returns the new
 * draft and the new starting point to compare against. */
export function rebase(latest: Obj, draft: Draft, initial: Draft): { draft: Draft; initial: Draft } {
  const fresh = draftOf(latest);
  const pick = <K extends "name" | "group" | "script">(k: K) => (draft[k] !== initial[k] ? draft[k] : fresh[k]);
  const lists = fresh.lists.map((l) => {
    const mine = listOf(draft, l.layerId);
    return mine && !same(mine.items, listOf(initial, l.layerId)?.items) ? ({ ...l, items: mine.items } as ListDraft) : l;
  });
  return {
    draft: { name: pick("name"), group: pick("group"), script: pick("script"), lists },
    initial: fresh,
  };
}
