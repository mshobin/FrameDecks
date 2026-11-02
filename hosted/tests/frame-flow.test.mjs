// The guided Plan workflow (8.3): steps, drag-and-drop order, the Preview's picture, and media for the .frame file.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

import { FLOW_STEPS, PROFILE_TX, flowState, frameFilled, mediaNamesOf, moveFrameTo, previewOf, safeFileName } from "../src/lib/frame-flow.ts";
import { frameFileFromDoc, readFrameFile } from "../src/lib/frame-file.ts";
import { PROFILES } from "../src/lib/workspace-settings.ts";

const require = createRequire(import.meta.url);
const pc = require("../../app/js/frame-file.js");

test("the five steps use the owner's words", () => {
  assert.deepEqual(FLOW_STEPS.map((s) => s.action), ["Edit details", "Add Frame", "Write Script", "Preview", "Export for Service PC"]);
});

test("the first step not done is the one to do now", () => {
  const empty = flowState({ title: "", frames: [], previewed: false, sent: false });
  assert.deepEqual(Object.values(empty), ["now", "todo", "todo", "todo", "todo"]);
  const some = flowState({ title: "Tuesday", frames: [{ id: "a", notes: "" , layers: [] }], previewed: false, sent: false });
  assert.equal(some.meeting, "done");
  assert.equal(some.frames, "done");
  assert.equal(some.content, "now", "an empty Frame still needs words");
  const all = flowState({ title: "Tuesday", frames: [{ id: "a", notes: "Hello" }], previewed: true, sent: true });
  assert.ok(Object.values(all).every((s) => s === "done"));
});

test("a Frame counts as filled with a script, words or a file", () => {
  assert.equal(frameFilled({ notes: "", layers: [] }), false);
  assert.equal(frameFilled({ layers: [{ kind: "question", c: { items: [{ text: "Why?" }] } }] }), true);
  assert.equal(frameFilled({ layers: [{ kind: "image", c: { file: "a.png" } }] }), true);
});

test("a Frame dragged to a new place; templates keep theirs", () => {
  const order = { scenes: ["a", "tpl1", "b", "c", "d"] };
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual(moveFrameTo(order, ids, "d", 0).scenes, ["d", "tpl1", "a", "b", "c"]);
  assert.deepEqual(moveFrameTo(order, ids, "a", 2).scenes, ["b", "tpl1", "c", "a", "d"]);
  assert.deepEqual(moveFrameTo(order, ids, "a", 99).scenes, ["b", "tpl1", "c", "d", "a"]);
  assert.deepEqual(moveFrameTo(order, ids, "zz", 1).scenes, order.scenes, "an unknown Frame changes nothing");
  assert.deepEqual(order.scenes, ["a", "tpl1", "b", "c", "d"], "the order given is not changed");
});

test("the Preview shows the first item of each card, the files and the transition", () => {
  const frame = {
    name: "Reading", notes: "Read slowly", tx: { type: "profile" },
    layers: [
      { kind: "background", c: { color: "#112233" } },
      { kind: "scripture", c: { label: "Today", itemId: "v2", items: [{ id: "v1", ref: "John 1:1" }, { id: "v2", ref: "John 15:5", version: "ESV", text: "I am the vine" }] } },
      { kind: "question", c: { items: [{ id: "q1", text: "What stands out?" }, { id: "q2", text: "Why?" }] } },
      { kind: "image", c: { file: "vine.jpg" } },
      { kind: "announcement", visible: false, c: { title: "Hidden", text: "x" } },
    ],
  };
  const p = previewOf(frame, { styleTransition: "push" });
  assert.equal(p.background, "#112233");
  assert.equal(p.transition, "push", "no transition of its own: the meeting's style");
  assert.deepEqual(p.cards.map((c) => [c.kind, c.text, c.sub]), [["scripture", "I am the vine", "John 15:5 ESV"], ["question", "What stands out?", "1 of 2"]]);
  assert.deepEqual(p.media, [{ kind: "image", file: "vine.jpg" }]);
  assert.equal(previewOf({ tx: { type: "burst" } }).transition, "burst");
});

test("every transition style has a Preview transition", () => {
  for (const p of PROFILES) assert.ok(PROFILE_TX[p.id], p.id);
});

test("media files travel in the .frame file, and the PC accepts them", () => {
  const doc = { scenes: [{ id: "a", name: "A", layers: [{ kind: "image", c: { file: "vine.jpg" } }, { kind: "pdf", c: { file: "talk.pdf" } }] }, { id: "b", layers: [{ kind: "image", c: { file: "vine.jpg" } }] }], meeting: { title: "T" } };
  assert.deepEqual(mediaNamesOf(doc.scenes), ["vine.jpg", "talk.pdf"]);
  const file = frameFileFromDoc(doc, { app: "8.3.0", media: [{ file: "vine.jpg", type: "image/jpeg", size: 3, sha256: "", data: "AAAA" }] });
  assert.equal(file.counts.media, 1);
  const text = JSON.stringify(file);
  assert.equal(readFrameFile(text).ok, true);
  assert.equal(pc.check(text).ok, true);
});

test("file names are safe on every PC", () => {
  assert.equal(safeFileName("C:\\Users\\me\\Vine photo.jpg"), "Vine photo.jpg");
  assert.equal(safeFileName("../../.hidden"), "hidden");
  assert.equal(safeFileName('a:b*c?"<>|.png'), "abc.png");
  assert.equal(safeFileName(""), "file");
});
