import assert from "node:assert/strict";
import { test } from "node:test";

import { setName, setQuestions, setScript, editableLists } from "../src/lib/frame-edit.ts";
import { changesBetween, lastKept, versionsOf, whoMade } from "../src/lib/history-view.ts";

// A Frame's history (entity_history keeps every replaced version 30 days): versions newest first, who made each,
// when, and what changed, so the Services page can show it and restore one.
const frame = {
  id: "sc1",
  name: "Welcome",
  group: "",
  notes: "Good morning",
  modified: 1,
  layers: [{ id: "L1", kind: "question", name: "Question", c: { items: [{ id: "q1", text: "Why?" }], itemId: "" } }],
};
const PC = "computer:11111111-1111-1111-1111-111111111111";
const ME = "user:22222222-2222-2222-2222-222222222222";

test("versions newest first, with who, when and what changed", () => {
  const v2 = setScript(frame, "Good evening");
  const v3 = setName(setQuestions(v2, editableLists(v2)[0].layerId, [{ id: "q1", text: "Why not?" }]), "Welcome & notices");
  const versions = versionsOf({ rev: 3, body: v3, updatedBy: ME, updatedAt: "2026-10-25T12:00:00Z" }, [
    { rev: 1, deleted: false, body: frame, updated_by: PC, replaced_at: "2026-10-25T10:00:00Z" },
    { rev: 2, deleted: false, body: v2, updated_by: PC, replaced_at: "2026-10-25T12:00:00Z" },
  ]);
  assert.deepEqual(
    versions.map((v) => [v.rev, v.current, v.by, v.at, v.changes]),
    [
      [3, true, ME, "2026-10-25T12:00:00Z", ["name", "questions"]],
      [2, false, PC, "2026-10-25T10:00:00Z", ["script"]],
      [1, false, PC, null, []],
    ],
  );
});

test("deleted versions, and what a deleted Frame is restored to", () => {
  const versions = versionsOf({ rev: 2, deleted: true, body: null, updatedBy: PC }, [
    { rev: 1, deleted: false, body: frame, updated_by: PC, replaced_at: "2026-10-25T10:00:00Z" },
  ]);
  assert.deepEqual(versions[0].changes, ["deleted"]);
  assert.equal(lastKept(versions).rev, 1);
  assert.equal(lastKept([{ ...versions[0] }]), null);
});

test("names for who made a version", () => {
  const people = { "22222222-2222-2222-2222-222222222222": "Shobin" };
  const computers = { "11111111-1111-1111-1111-111111111111": "CHURCH-PC" };
  assert.equal(whoMade(ME, people, computers), "Shobin (companion)");
  assert.equal(whoMade(PC, people, computers), "CHURCH-PC");
  assert.equal(whoMade(PC, people, {}), "The service PC");
  assert.equal(whoMade("user:x", {}, {}), "Someone in the companion");
});

test("a change only to looks or Content is named as such", () => {
  const looks = { ...frame, layers: [{ ...frame.layers[0], opacity: 0.5 }] };
  assert.deepEqual(changesBetween(frame, looks), ["Content or looks"]);
  assert.deepEqual(changesBetween(frame, { ...frame, modified: 99 }), []);
  assert.deepEqual(changesBetween(frame, { ...frame, fav: true }), ["settings"]);
});
