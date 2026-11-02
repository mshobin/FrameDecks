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
