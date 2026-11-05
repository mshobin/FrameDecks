import assert from "node:assert/strict";
import { test } from "node:test";

import { ONLINE_FOR_SECONDS, READY_FOR_SECONDS, isOnline, label, nowShowing, outcome, pcState, refreshEvery } from "../src/lib/live-view.ts";

// The Live page's words, from the status the PC publishes (src/cloud_remote.py status_from) and the database's clock.
const at = (s) => new Date(Date.UTC(2026, 9, 25, 12, 0, s)).toISOString();

test("online while the PC's status is fresh by the database's clock, not the phone's", () => {
  assert.equal(isOnline({ updated_at: at(0), server_now: at(10) }), true);
  assert.equal(isOnline({ updated_at: at(0), server_now: at(ONLINE_FOR_SECONDS) }), false);
  assert.equal(isOnline({ updated_at: null, server_now: at(0) }), false);
  assert.equal(isOnline({ updated_at: "garbage", server_now: at(0) }), false);
});

test("what is on screen", () => {
  const base = { frames: [], script: "", question: { visible: false, text: "" }, blackout: false, freeze: false };
  assert.equal(nowShowing(null), "Nothing yet");
  assert.equal(nowShowing({ ...base, frame: null, count: 0 }), "No Frames in this plan");
  assert.equal(nowShowing({ ...base, frame: null, count: 3 }), "No Frame on screen");
  assert.equal(nowShowing({ ...base, frame: { id: "a", name: "Prayer", number: 2 }, count: 5 }), "Frame 2 of 5 · Prayer");
});

test("labels and the PC's answers in words", () => {
  assert.equal(label("next"), "Next Frame");
  assert.equal(label("blackout", { on: true }), "Black screen on");
  assert.equal(label("question", { show: false }), "Question hidden");
  assert.equal(outcome(null), "Sent…");
  assert.equal(outcome("done"), "Done");
  assert.match(outcome("expired"), /10 seconds/);
  assert.match(outcome("refused"), /no longer allowed/);
  assert.equal(outcome("not run: that Frame is not on this PC"), "Not run: that Frame is not on this PC");
});

// 9.11 live push (docs/architecture/live-push.md)
test("a PC resting between services shows as waking, not offline, only where live push is on", () => {
  const pc = { updated_at: at(0), server_now: at(100), control_seen_at: at(60), push: true };
  assert.equal(pcState({ ...pc, updated_at: at(90) }), "online");
  assert.equal(pcState(pc), "waking");
  assert.equal(pcState({ ...pc, push: false }), "offline", "push switched off: as before");
  assert.equal(pcState({ ...pc, control_seen_at: null }), "offline", "control off");
  assert.equal(pcState({ ...pc, control_seen_at: undefined, push: undefined }), "offline", "remote_computers (before 0016)");
  assert.equal(pcState({ ...pc, server_now: new Date(Date.parse(at(60)) + READY_FOR_SECONDS * 1000).toISOString() }), "offline");
});

test("the page reads every 2 seconds as before unless the channel is open and the PC pushes", () => {
  const pushing = { status: { push: true } };
  const old = { status: { frame: null } };
  assert.equal(refreshEvery({ channel: false, pc: pushing, state: "online", waiting: false }), 2000);
  assert.equal(refreshEvery({ channel: true, pc: old, state: "online", waiting: false }), 2000, "a PC from before 9.11");
  assert.equal(refreshEvery({ channel: true, pc: null, state: "offline", waiting: false }), 2000);
  assert.equal(refreshEvery({ channel: true, pc: pushing, state: "online", waiting: false }), 30000, "safety net only");
  assert.equal(refreshEvery({ channel: true, pc: pushing, state: "online", waiting: true }), 2000, "a press waits");
  assert.equal(refreshEvery({ channel: true, pc: pushing, state: "waking", waiting: false }), 5000);
  assert.equal(refreshEvery({ channel: false, pc: pushing, state: "waking", waiting: false }), 5000);
});
