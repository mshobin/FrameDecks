// 26.11.39 the Plan page's changes wait until Sync Now: only Frames that really differ are sent, in one push; an edit
// put back, or a Frame added and deleted again, is not sent at all; deletes of many Frames go together; an order
// changed meanwhile is merged; the list survives a closed tab.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { bodyPrint, keyOf, loadChanges, mergeOrder, overlay, saveChanges, stage, summarize, toPush } from "../src/lib/plan-changes.ts";
import { emptyFrame, emptyRow, frameFormOf, frameFromForm } from "../src/lib/meeting-form.ts";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const rec = (kind, id, rev, body) => ({ kind, id, rev, seq: rev, body });
const welcome = frameFromForm({ ...emptyFrame(), name: "Welcome", content: [emptyRow("question")] }, null, { group: "Sunday", now: 1 });
const sermon = frameFromForm({ ...emptyFrame(), name: "Sermon", content: [emptyRow("question")] }, null, { group: "Sunday", now: 1 });
const server = [rec("frame", welcome.id, 3, welcome), rec("frame", sermon.id, 4, sermon), rec("order", "order", 7, { scenes: [welcome.id, sermon.id] })];
const by = (k) => server.find((r) => keyOf(r.kind, r.id) === k);

test("saving a Frame unchanged is not a change; its save time does not count", () => {
  const again = frameFromForm(frameFormOf(welcome), welcome, { now: 99 });
  assert.equal(bodyPrint(again), bodyPrint(welcome));
  assert.deepEqual(stage({}, by(keyOf("frame", welcome.id)), "frame", welcome.id, again), {});
});

test("an edit waits with the revision it was read at, and putting it back removes it", () => {
  const edited = { ...welcome, name: "Welcome everyone" };
  let c = stage({}, by(keyOf("frame", welcome.id)), "frame", welcome.id, edited);
  assert.equal(c[keyOf("frame", welcome.id)].rev, 3);
  c = stage(c, by(keyOf("frame", welcome.id)), "frame", welcome.id, { ...welcome, modified: 5 });
  assert.deepEqual(c, {}, "back to the workspace's version: nothing to send");
});

test("a Frame added and deleted before Sync Now is never sent", () => {
  const extra = frameFromForm({ ...emptyFrame(), name: "Offering" }, null, { now: 2 });
  let c = stage({}, undefined, "frame", extra.id, extra);
  assert.equal(summarize(c).added[0], "Offering");
  c = stage(c, undefined, "frame", extra.id, null);
  assert.deepEqual(c, {});
});

test("many Frames deleted together, and the order without them, in one push (Frames first)", () => {
  let c = {};
  for (const f of [welcome, sermon]) c = stage(c, by(keyOf("frame", f.id)), "frame", f.id, null);
  c = stage(c, by("order/order"), "order", "order", { scenes: [] });
  const s = summarize(c);
  assert.deepEqual([s.deleted.length, s.moved, s.count], [2, false, 2], "deleting is not a move");
  const push = toPush(c);
  assert.deepEqual(push.map((p) => p.kind), ["frame", "frame", "order"]);
  assert.ok(push.slice(0, 2).every((p) => p.deleted && p.rev > 0));
  const shown = overlay(server, c);
  assert.deepEqual(shown.map((r) => r.kind), ["order"], "the page shows them gone at once");
});

test("a move is a change; moving back is not", () => {
  let c = stage({}, by("order/order"), "order", "order", { scenes: [sermon.id, welcome.id] });
  assert.equal(summarize(c).moved, true);
  c = stage(c, by("order/order"), "order", "order", { scenes: [welcome.id, sermon.id] });
  assert.deepEqual(c, {});
});

test("an order changed on the PC meanwhile is merged, not overwritten", () => {
  const merged = mergeOrder({ scenes: ["b", "a"] }, { scenes: ["a", "b", "pc-new"], questions: [1] }, ["x"]);
  assert.deepEqual(merged.scenes, ["b", "a", "pc-new"]);
  assert.deepEqual(merged.questions, [1]);
  assert.deepEqual(mergeOrder({ scenes: ["a", "x"] }, { scenes: ["a", "x"] }, ["x"]).scenes, ["a"]);
});

test("the list is kept in this browser per workspace", () => {
  const m = new Map();
  const store = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  const c = stage({}, by(keyOf("frame", welcome.id)), "frame", welcome.id, { ...welcome, name: "Hi" });
  saveChanges("ws1", c, store);
  assert.deepEqual(loadChanges("ws1", store), c);
  assert.deepEqual(loadChanges("ws2", store), {});
  saveChanges("ws1", {}, store);
  assert.equal(m.size, 0, "an empty list is removed");
  assert.deepEqual(loadChanges("ws1", { getItem: () => "{bad" }), {});
});

test("the Plan page: Sync Now, multi-select in both places, the lit Frame on the timeline", () => {
  const plan = src("components/meeting-form-panel.tsx");
  assert.match(plan, /function syncNow\(\)/);
  assert.match(plan, /const list = toPush\(changes\);/);
  assert.match(plan, /<SyncBox waiting=\{waiting\}/);
  assert.match(plan, /\{syncing \? "Syncing…" : "Sync Now"\}/);
  assert.match(plan, /async function removeMany\(ids: string\[\]\)/);
  assert.match(plan, /onClick=\{\(\) => removeMany\(\[\.\.\.picked\]\)\}/);
  assert.match(plan, /active=\{editing && editing !== "new" \? editing : current\}/);
  assert.match(plan, /picked=\{picked\}\s+onPick=\{pick\}/);
  assert.doesNotMatch(plan.slice(plan.indexOf("function FrameFormEditor")), /pushRecord|pushChanges/, "the editor only adds to the changes");
  const flow = src("components/frame-flow.tsx");
  assert.match(flow, /picked\.has\(id\) && "is-picked"/);
  assert.match(flow, /onClick=\{\(\) => onPick\(id\)\}/);
});
