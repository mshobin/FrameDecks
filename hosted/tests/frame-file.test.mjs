// The .frame file (8.2): the website writes the plan the PC imports; both check the same rules.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

import { join, split } from "../src/lib/sync-entities.ts";
import { FRAME_FORMAT, frameFileFromDoc, frameFileName, readFrameFile } from "../src/lib/frame-file.ts";

const require = createRequire(import.meta.url);
const pc = require("../../app/js/frame-file.js");

const DOC = {
  scenes: [
    { id: "sc_a", name: "Welcome", notes: "Hello everyone", tx: { type: "burst", ms: 1400 }, layers: [{ id: "L1", kind: "announcement", name: "Hi", c: { title: "Welcome" } }] },
    { id: "sc_b", name: "Reading", notes: "", tx: { type: "fade", ms: 500 }, layers: [] },
  ],
  meeting: { title: "Tuesday Bible Study", script: "One script", scriptMode: "all" },
  brand: { meeting: "Tuesday", org: "", color: "", logo: "data:image/png;base64,AAAA", lw: 10, lh: 10 },
  layout: { panel: 92 },
};

test("the website's export is the plan the records describe, with the order and ids kept", () => {
  const { entities } = split(DOC);
  const f = frameFileFromDoc(join(entities, {}).doc, { app: "8.2.0", now: new Date("2026-11-02T10:00:00Z") });
  assert.equal(f.format, FRAME_FORMAT);
  assert.deepEqual(f.plan.scenes.map((s) => s.id), ["sc_a", "sc_b"]);
  assert.equal(f.plan.scenes[0].notes, "Hello everyone");
  assert.equal(f.plan.meeting.script, "One script");
  assert.equal(f.plan.brand.logo, "");                     // the logo file stays on each PC
  assert.deepEqual(f.counts, { frames: 2, media: 0 });
  assert.equal(frameFileName(f.title, new Date("2026-11-02T10:00:00Z")), "Tuesday Bible Study 2026-11-02.frame");
});

test("the website and the PC accept and refuse the same files", () => {
  const good = JSON.stringify({ format: FRAME_FORMAT, version: 1, plan: { scenes: [] }, media: [] });
  const cases = [
    [good, true],
    ["not json", false],
    [JSON.stringify({ format: "other", version: 1, plan: { scenes: [] } }), false],
    [JSON.stringify({ format: FRAME_FORMAT, version: 99, plan: { scenes: [] } }), false],
    [JSON.stringify({ format: FRAME_FORMAT, version: 1, plan: {} }), false],
    [JSON.stringify({ format: FRAME_FORMAT, version: 1, plan: { scenes: [] }, media: [{ file: "../x.png", data: "" }] }), false],
  ];
  for (const [text, ok] of cases) {
    assert.equal(readFrameFile(text).ok, ok, text.slice(0, 60));
    assert.equal(pc.check(text).ok, ok, "PC: " + text.slice(0, 60));
  }
});

// ---- 8.4 the whole round trip: Frames made on the website, exported, imported on the PC, checked field by field ----
import { emptyFrame, emptyRow, frameFormOf, frameFromForm, meetingFromForm } from "../src/lib/meeting-form.ts";
import { integrityOf } from "../src/lib/frame-file.ts";

const program = require("../../tests/helpers/load-store.js")();
const plainOf = (o) => JSON.parse(JSON.stringify(o));

function websitePlan() {
  const rows = ["question", "scripture", "text", "prayer", "lowerthird", "countdown", "image", "video", "powerpoint", "audio", "brand", "camera", "screen"].map((t) => {
    const r = emptyRow(t);
    r.label = `Label ${t}`;
    r.main = { image: "vine.png", video: "intro.mp4", audio: "song.mp3", powerpoint: "talk.pdf" }[t] ?? `Words for ${t}`;
    if (t === "question") r.questions = [{ label: "Q", text: "Why does it matter?", media: "", timer: "3", anim: "" }, { label: "", text: "What will you do?", media: "", timer: "", anim: "" }];
    if (t === "scripture") r.scriptures = [{ label: "", ref: "John 15:5", version: "ESV", text: "I am the vine", anim: "" }];
    if (t === "countdown") r.duration = "5";
    return r;
  });
  const a = frameFromForm({ ...emptyFrame(), name: "Everything", script: "Welcome, everyone.\n\n# Opening", background: "Navy", transition: "burst", content: rows }, null, { group: "Tuesday" });
  const b = frameFromForm({ ...emptyFrame(), name: "Close", script: "Thank you", transition: "dip-white", content: [] }, null, { group: "Tuesday" });
  const records = [
    { kind: "meeting", id: "meeting", rev: 1, body: meetingFromForm({ title: "Tuesday Bible Study", date: "2026-11-03", notes: "Bring Bibles" }, { location: "Hall" }) },
    { kind: "order", id: "order", rev: 1, body: { scenes: [b.id, a.id] } },
    { kind: "frame", id: a.id, rev: 1, body: a },
    { kind: "frame", id: b.id, rev: 1, body: b },
  ];
  return join(records, {}).doc;
}

test("website and PC count a .frame file the same way", () => {
  const doc = websitePlan();
  const file = frameFileFromDoc(doc, { app: "8.4.0", media: [{ file: "vine.png", type: "image/png", size: 3, sha256: "", data: "AAAA" }] });
  assert.deepEqual(file.integrity, pc.integrity(file.plan, file.media));
  assert.deepEqual({ ...file.integrity, files: [...file.integrity.files].sort() }, { frames: 2, layers: 14, items: 3, files: ["intro.mp4", "song.mp3", "talk.pdf", "vine.png"], included: ["vine.png"] });
});

test("a cut-short or edited file is refused by both before anything changes", () => {
  const file = frameFileFromDoc(websitePlan(), { app: "8.4.0" });
  file.plan.scenes[1].layers.pop();
  const text = JSON.stringify(file);
  assert.equal(readFrameFile(text).ok, false);
  assert.equal(pc.check(text).ok, false);
  assert.match(pc.check(text).error, /incomplete/);
});

test("Use this plan: the PC has exactly the website's Frames, order, words, scripts, transitions and meeting", () => {
  const doc = websitePlan();
  const text = JSON.stringify(frameFileFromDoc(doc, { app: "8.4.0" }));
  const n = plainOf(program.Store.normalize({}));
  n.scenes = [plainOf(program.Scenes.cleanScene({ id: "sc_old", name: "Old Frame on the PC", layers: [] }))];
  const made = pc.apply(n, pc.check(text).file, "replace", {}, program.Scenes);
  const after = plainOf(program.Store.normalize(n));
  assert.deepEqual(pc.verify(pc.check(text).file, after, "replace", made, {}), [], "the import check finds nothing");
  // what the website shows for each Frame is what the PC now has (the PC writes out its default animations)
  const web = doc.scenes.map((s) => frameFormOf(s));
  const got = after.scenes.filter((s) => !s.tpl).map((s) => frameFormOf(s));
  const strip = (f) => ({ ...f, content: f.content.map((r) => ({ ...r, anim: "" })) });
  assert.deepEqual(got.map(strip), web.map(strip));
  assert.deepEqual([after.meeting.title, after.meeting.date, after.meeting.notes, after.meeting.location], ["Tuesday Bible Study", "2026-11-03", "Bring Bibles", "Hall"]);
});

test("the import check names what differs", () => {
  const text = JSON.stringify(frameFileFromDoc(websitePlan(), { app: "8.4.0" }));
  const file = pc.check(text).file;
  const n = plainOf(program.Store.normalize({}));
  const made = pc.apply(n, file, "replace", {}, program.Scenes);
  const after = plainOf(program.Store.normalize(n));
  after.scenes[0].notes = "changed";
  after.scenes[1].layers[0].c.items.pop();
  after.meeting.date = "";
  const issues = pc.verify(file, after, "replace", made, {});
  assert.ok(issues.some((t) => /“Close”: its Teleprompter script/.test(t)), issues.join("\n"));
  assert.ok(issues.some((t) => /1 of its 2 questions/.test(t)), issues.join("\n"));
  assert.ok(issues.some((t) => /meeting date/.test(t)), issues.join("\n"));
});

test("Add after my Frames keeps the PC's Frames and checks the added ones", () => {
  const text = JSON.stringify(frameFileFromDoc(websitePlan(), { app: "8.4.0" }));
  const file = pc.check(text).file;
  const n = plainOf(program.Store.normalize({}));
  n.scenes = [plainOf(program.Scenes.cleanScene({ id: "sc_mine", name: "Mine", layers: [] }))];
  const made = pc.apply(n, file, "add", {}, program.Scenes);
  const after = plainOf(program.Store.normalize(n));
  assert.equal(after.scenes.filter((s) => !s.tpl)[0].id, "sc_mine");
  assert.deepEqual(pc.verify(file, after, "add", made, {}), []);
});
