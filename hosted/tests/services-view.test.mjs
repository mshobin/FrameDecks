import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { describeFrames, describeMembers } from "../src/lib/services-view.ts";
import { join, split } from "../src/lib/sync-entities.ts";

const fixture = JSON.parse(readFileSync(new URL("../../tests/fixtures/sync/service.json", import.meta.url), "utf8"));

// What the Services page shows is built from the records the PC sent, joined back exactly as the PC does.
const fromRecords = () => {
  const { entities } = split(fixture.normalized, fixture.members);
  return join(entities, {});
};

test("frames come out in order with their media named, never fetched", () => {
  const frames = describeFrames(fromRecords().doc);
  assert.deepEqual(
    frames.map((f) => [f.name, f.template]),
    [["Welcome", false], ["Study: John 3", false], ["Video", false], ["Slide", false], ["Prayer template", true]],
  );
  const study = frames.find((f) => f.name === "Study: John 3");
  assert.equal(study.group, "Teaching");
  assert.equal(study.script, "Read verse 16 slowly.\nPause for questions.");
  assert.deepEqual(frames.find((f) => f.name === "Video").content, [{ kind: "video", title: "Video", lines: [], media: "Opening video.mp4" }]);
  assert.equal(frames.find((f) => f.name === "Slide").content[0].media, "Welcome slide.png");
});

test("questions, scriptures and text cards read as lines", () => {
  const doc = fromRecords().doc;
  const study = doc.scenes.find((s) => s.name === "Study: John 3");
  study.layers.find((l) => l.kind === "question").c.items = [{ id: "a", text: "What stands out?" }, { id: "b", text: "" }];
  study.layers.find((l) => l.kind === "scripture").c.items = [{ id: "c", ref: "John 3:16", version: "ESV", text: "For God so loved" }];
  doc.scenes[0].layers[0].c.text = "Welcome, friends";
  const frames = describeFrames(doc);
  const content = frames.find((f) => f.name === "Study: John 3").content;
  assert.deepEqual(content.find((c) => c.kind === "question").lines, ["What stands out?"]);
  assert.deepEqual(content.find((c) => c.kind === "scripture").lines, ["John 3:16 (ESV): For God so loved"]);
  assert.deepEqual(frames[0].content[0].lines, ["Announcement", "Welcome, friends"]);
});

test("members come out sorted by name with every field as text", () => {
  const members = describeMembers(fromRecords().members);
  assert.deepEqual(members.map((m) => m.name), ["Paul Brown", "Ruth Adams"]);
  assert.equal(members[1].phone, "+965 5000 0000");
  assert.deepEqual(describeMembers([null, "x", { id: 1 }]), [{ id: "1", name: "", country: "", phone: "", email: "", birthDate: "", role: "" }]);
});
