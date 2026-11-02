// The Setup guide (6.14): one step list in the program (app/js/guide-steps.js) and on the website
// (src/lib/guide-steps.ts), kept equal here; the website ticks only what it can see.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

import {
  GUIDE_KINDS,
  GUIDE_STEPS,
  frameChangedOnWebsite,
  readGuide,
  writeGuide,
} from "../src/lib/guide-steps.ts";

const require = createRequire(import.meta.url);
const program = require("../../app/js/guide-steps.js");
const src = (p) =>
  readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("the program and the website have the same six steps and kinds of gathering", () => {
  const pick = (s) => ({
    id: s.id,
    title: s.title,
    where: s.where,
    optional: !!s.optional,
    text: s.text,
  });
  assert.deepEqual(GUIDE_STEPS.map(pick), program.steps.map(pick));
  assert.deepEqual(
    GUIDE_KINDS.map((k) => ({ ...k })),
    program.kinds,
  );
  assert.deepEqual(
    GUIDE_STEPS.map((s) => s.id),
    ["welcome", "output", "phone", "connect", "frame", "ready"],
  );
});

test("this browser's progress is read safely and written back", () => {
  const store = new Map();
  const ls = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  assert.deepEqual(readGuide(ls), { kind: undefined, hidden: false });
  writeGuide(ls, { kind: "youth", hidden: true });
  assert.deepEqual(readGuide(ls), { kind: "youth", hidden: true });
  store.set("fd-guide", '{"kind":"<script>","hidden":"yes"}');
  assert.deepEqual(readGuide(ls), { kind: undefined, hidden: false });
  store.set("fd-guide", "not json");
  assert.deepEqual(readGuide(ls), {});
});

test("the website's first Frame is one added or changed here, not by a PC", () => {
  assert.equal(
    frameChangedOnWebsite([
      { kind: "frame", updatedBy: "computer:c1" },
      { kind: "order", updatedBy: "user:u1" },
    ]),
    false,
  );
  assert.equal(
    frameChangedOnWebsite([
      { kind: "frame", updatedBy: "user:u1", deleted: true },
    ]),
    false,
  );
  assert.equal(
    frameChangedOnWebsite([
      { kind: "frame", updatedBy: "computer:c1" },
      { kind: "frame", updatedBy: "user:u1" },
    ]),
    true,
  );
});

test("Home shows the guide for a workspace, and Help brings it back", () => {
  assert.match(
    src("components/overview.tsx"),
    /<SetupGuide workspace=\{selected\} \/>/,
  );
  assert.match(src("components/help-center.tsx"), /<ShowGuide \/>/); // Help → Getting Started (8.6 Help Center)
  const guide = src("components/setup-guide.tsx");
  assert.match(guide, /const onPc = !tick && s\.where === "program";/); // program steps never tick on the website
  assert.doesNotMatch(guide, /onClick=\{\(\) => save\(\{ \.\.\.progress, done/); // nothing is ticked by clicking it
});
