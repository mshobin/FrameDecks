// Several meetings (8.5): the website (src/lib/meetings.ts) and the PC (app/js/store.js) read a plan the same way, and a
// plan from before 8.5 is one meeting holding every Frame.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

import { framesOfMeeting, meetingOfFrame, meetingsOf, uniqueMeetingName, withMeetings, currentMeetingId } from "../src/lib/meetings.ts";

const require = createRequire(import.meta.url);
const { Store, Scenes } = require("../../tests/helpers/load-store.js")();
const plain = (o) => JSON.parse(JSON.stringify(o));
const frame = (id, group = "") => ({ id, name: id, group, layers: [] });

const PLANS = {
  before: { meeting: { title: "Tuesday", date: "2026-11-03", notes: "n" }, scenes: [frame("a"), frame("b", "Worship"), frame("c", "Tuesday")] },
  two: {
    meeting: { title: "Sunday", meetings: [{ id: "m1", name: "Tuesday", date: "2026-11-03", notes: "" }, { id: "m2", name: "Sunday", date: "2026-11-08", notes: "x" }] },
    scenes: [frame("a", "Tuesday"), frame("b", "Sunday"), frame("c", ""), frame("d", "Elsewhere"), { ...frame("t", "Sunday"), tpl: true }],
  },
  damaged: { meeting: { title: "", meetings: [{ id: "m1", name: "" }, { id: "m1", name: "A" }, { name: "B" }, { id: "m2", name: "a" }, "x"] }, scenes: [] },
};

test("a plan from before 8.5 is one meeting with every Frame", () => {
  const list = meetingsOf(PLANS.before.meeting);
  assert.deepEqual(list, [{ id: "main", name: "Tuesday", date: "2026-11-03", notes: "n" }]);
  assert.deepEqual(framesOfMeeting(PLANS.before.scenes, list, "main").map((f) => f.id), ["a", "b", "c"]);
});

test("Frames go to the meeting their group names, else the first", () => {
  const list = meetingsOf(PLANS.two.meeting);
  assert.deepEqual(framesOfMeeting(PLANS.two.scenes, list, "m1").map((f) => f.id), ["a", "c", "d"]);
  assert.deepEqual(framesOfMeeting(PLANS.two.scenes, list, "m2").map((f) => f.id), ["b"], "templates belong to no meeting");
  assert.equal(currentMeetingId(PLANS.two.meeting, list), "m2", "the meeting the details describe");
});

test("the website and the PC agree on every plan", () => {
  for (const [name, plan] of Object.entries(PLANS)) {
    const st = plain(Store.normalize(plan));
    const pc = Scenes.meetings(st);
    assert.deepEqual(plain(pc), meetingsOf(plan.meeting), name);
    for (const s of st.scenes) assert.equal(Scenes.meetingOf(st, s).id, meetingOfFrame(s, meetingsOf(plan.meeting)).id, `${name}: ${s.id}`);
  }
});

test("the PC keeps the list, and its normalize does not add one to an older plan", () => {
  assert.equal(plain(Store.normalize(PLANS.before)).meeting.meetings, undefined);
  assert.equal(plain(Store.normalize(PLANS.two)).meeting.meetings.length, 2);
});

test("the PC shows one meeting at a time", () => {
  const st = plain(Store.normalize(PLANS.two));
  assert.deepEqual(Scenes.order(st).map((s) => s.id), ["b"], "the details describe Sunday");
  Scenes.switchMeeting(st, "m1");
  assert.deepEqual(Scenes.order(st).map((s) => s.id), ["a", "c", "d"]);
  assert.equal(st.meeting.title, "Tuesday");
  assert.equal(st.meeting.date, "2026-11-03");
  assert.equal(Scenes.newGroup(st), "Tuesday");
  const one = plain(Store.normalize(PLANS.before));
  assert.equal(Scenes.order(one).length, 3, "one meeting: every Frame, as before");
  assert.equal(Scenes.newGroup(one), "");
});

test("adding and renaming meetings on the PC keeps every Frame where it was", () => {
  const st = plain(Store.normalize(PLANS.before));
  const m = Scenes.addMeeting(st, "Sunday");
  assert.equal(Scenes.currentMeeting(st).id, m.id);
  assert.deepEqual(Scenes.order(st), [], "the new meeting starts empty");
  Scenes.switchMeeting(st, "main");
  assert.deepEqual(Scenes.order(st).map((s) => s.id), ["a", "b", "c"], "the first meeting kept all three");
  Scenes.renameMeeting(st, "main", "Tuesday Study");
  assert.deepEqual(Scenes.order(st).map((s) => s.id), ["a", "b", "c"]);
  assert.equal(st.meeting.title, "Tuesday Study");
  assert.equal(Scenes.renameMeeting(st, "main", "sunday"), null, "two meetings cannot share a name");
});

test("names stay unique and the record keeps what older PCs read", () => {
  const list = meetingsOf(PLANS.two.meeting);
  assert.equal(uniqueMeetingName(list, "sunday"), "sunday 2");
  assert.equal(uniqueMeetingName(list, "Sunday", "m2"), "Sunday", "its own name");
  const out = withMeetings({ title: "Sunday", location: "Hall" }, list, "m1");
  assert.deepEqual([out.title, out.date, out.location, out.meetings.length], ["Tuesday", "2026-11-03", "Hall", 2]);
});
