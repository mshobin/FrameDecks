import assert from "node:assert/strict";
import { test } from "node:test";

import { ONLINE_FOR_SECONDS, isOnline, label, nowShowing, outcome } from "../src/lib/live-view.ts";

// The Live page's words, from the status the PC publishes (cloud_remote.py status_from) and the database's clock.
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
