import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

import { editableLists, moveFrame, setGroup, setName, setQuestions, setScript, setVerses } from "../src/lib/frame-edit.ts";
import { canon, join, split } from "../src/lib/sync-entities.ts";

// Companion edits (docs/architecture/companion-editing.md) must arrive on the PC exactly as made: after joining the
// edited records, the desktop's own store.js normalize (what the program runs on every load and save) changes nothing.
const require = createRequire(import.meta.url);
const { Store } = require("../../tests/helpers/load-store.js")();
const fixture = JSON.parse(readFileSync(new URL("../../tests/fixtures/sync/service.json", import.meta.url), "utf8"));

const records = () => split(fixture.normalized, fixture.members).entities;
const frameRecord = (rs, name) => rs.find((r) => r.kind === "frame" && r.body.name === name);
const roundTrip = (rs) => {
  const { local } = split(fixture.normalized, fixture.members);
  const { doc } = join(rs, local);
  const again = JSON.parse(JSON.stringify(Store.normalize(JSON.parse(JSON.stringify(doc)))));
  return { doc, again };
};
const keep = (rs) => {
  const { doc, again } = roundTrip(rs);
  assert.equal(canon(again), canon(doc), "the PC's normalize keeps the edited plan exactly");
  return doc;
};

test("name, group and script", () => {
  const rs = records();
  const study = frameRecord(rs, "Study: John 3");
  study.body = setScript(setGroup(setName(study.body, "  Study: John 3:16  "), "Bible"), "Line one\r\nLine two");
  const doc = keep(rs);
  const frame = doc.scenes.find((s) => s.id === study.id);
  assert.equal(frame.name, "Study: John 3:16");
  assert.equal(frame.group, "Bible");
  assert.equal(frame.notes, "Line one\nLine two");
  assert.equal(setName(study.body, "x".repeat(200)).name.length, 80);
  assert.equal(setName(study.body, "   ").name, "Frame");
});

test("questions and scripture references, new and edited, keep everything the companion does not edit", () => {
  const rs = records();
  const study = frameRecord(rs, "Study: John 3");
  const lists = editableLists(study.body);
  assert.deepEqual(lists.map((l) => l.kind).sort(), ["question", "scripture"]);
  const q = lists.find((l) => l.kind === "question");
  const v = lists.find((l) => l.kind === "scripture");
  study.body = setQuestions(study.body, q.layerId, [{ text: "What does verse 16 say about love?" }, { text: "  " }, { text: "Who is it for?" }]);
  study.body = setVerses(study.body, v.layerId, [{ ref: "John 3:16", version: "ESV", text: "" }]);
  let doc = keep(rs);
  let layer = doc.scenes.find((s) => s.id === study.id).layers.find((l) => l.id === q.layerId);
  assert.deepEqual(layer.c.items.map((it) => it.text), ["What does verse 16 say about love?", "Who is it for?"], "empty lines are dropped");
  const first = layer.c.items[0];

  // Edit the first again: same id, a pairing to the Frame's verse (made on the PC) survives
  const verseId = `v1_${v.layerId}`; // the form the PC gives a pairing (store.js ownLists)
  study.body.layers.find((l) => l.id === q.layerId).c.items[0].pair = verseId;
  study.body.layers.find((l) => l.id === q.layerId).c.itemId = layer.c.items[1].id;
  study.body = setQuestions(study.body, q.layerId, [{ id: first.id, text: "Edited" }]);
  doc = keep(rs);
  layer = doc.scenes.find((s) => s.id === study.id).layers.find((l) => l.id === q.layerId);
  assert.deepEqual(layer.c.items.map((it) => [it.id, it.text, it.pair]), [[first.id, "Edited", verseId]]);
  assert.equal(layer.c.itemId, "", "the chosen item was removed, so nothing is chosen");
});

test("only the edited Frame's record changes; media, looks and live fields are untouched", () => {
  const rs = records();
  const before = new Map(rs.map((r) => [`${r.kind}/${r.id}`, canon(r.body)]));
  const study = frameRecord(rs, "Study: John 3");
  study.body = setScript(study.body, "New script");
  const changed = rs.filter((r) => before.get(`${r.kind}/${r.id}`) !== canon(r.body)).map((r) => r.id);
  assert.deepEqual(changed, [study.id]);
  const { doc } = roundTrip(rs);
  assert.equal(canon(doc.live), canon(fixture.normalized.live));
  assert.equal(doc.scenes.find((s) => s.name === "Video").layers[0].c.file, "Opening video.mp4");
});

test("moving Frames up and down; templates keep their places", () => {
  const rs = records();
  const order = rs.find((r) => r.kind === "order");
  const frameIds = rs.filter((r) => r.kind === "frame").map((r) => r.id);
  const [a, b] = order.body.scenes;
  order.body = moveFrame(order.body, frameIds, b, -1);
  assert.deepEqual(order.body.scenes.slice(0, 2), [b, a]);
  assert.deepEqual(moveFrame(order.body, frameIds, b, -1), order.body, "the first cannot move up");
  const tplIndex = order.body.scenes.findIndex((id) => !frameIds.includes(id));
  const last = frameIds.find((id) => order.body.scenes.indexOf(id) === tplIndex - 1);
  const moved = moveFrame(order.body, frameIds, last, 1);
  assert.equal(moved.scenes[tplIndex], order.body.scenes[tplIndex], "a template stays where it is");
  const doc = keep(rs);
  assert.deepEqual(doc.scenes.slice(0, 2).map((s) => s.id), [b, a]);
});

test("an edit to Content that is gone says so", () => {
  const study = frameRecord(records(), "Study: John 3");
  assert.throws(() => setQuestions(study.body, "nope", [{ text: "x" }]), /no longer in this Frame/);
});

test("only what was changed in the form is sent; after a conflict the latest version is kept for the rest", async () => {
  const { applyDraft, draftOf, rebase } = await import("../src/lib/frame-edit.ts");
  const rs = records();
  const welcome = frameRecord(rs, "Welcome");
  const initial = draftOf(welcome.body);
  const draft = { ...initial, name: "Welcome & notices" };
  // Meanwhile the PC changed the script
  const latest = setScript(welcome.body, "Changed on the PC");
  const sent = applyDraft(latest, draft, initial);
  assert.equal(sent.name, "Welcome & notices");
  assert.equal(sent.notes, "Changed on the PC", "the PC's newer script is not overwritten by the form's old one");
  const next = rebase(latest, draft, initial);
  assert.equal(next.draft.name, "Welcome & notices", "the person's change stays in the form");
  assert.equal(next.draft.script, "Changed on the PC", "the form shows the latest for the rest");
  assert.equal(applyDraft(latest, next.draft, next.initial).notes, "Changed on the PC");
  assert.equal(canon(applyDraft(welcome.body, initial, initial)), canon(welcome.body), "nothing changed, nothing sent differently");
});
