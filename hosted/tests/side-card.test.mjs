// 26.11.40 the left panel's Next meeting card: the meeting the service PC shows (date, Frames), five readiness checks,
// the church PC, and the changes waiting for Sync Now; loaded once with Home and kept a minute.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { meetingWhen, readyCount } from "../src/lib/glance-view.ts";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const NOW = new Date("2026-11-01T09:00:00").getTime();

test("the date in words", () => {
  assert.equal(meetingWhen("2026-11-03", NOW), "Tue 3 Nov · in 2 days");
  assert.equal(meetingWhen("2026-11-02", NOW), "Mon 2 Nov · tomorrow");
  assert.equal(meetingWhen("2026-11-01", NOW), "Sun 1 Nov · today");
  assert.equal(meetingWhen("2026-10-20", NOW), "Tue 20 Oct", "a past date has no countdown");
  assert.equal(meetingWhen("", NOW), "No date yet");
});

test("the meeting the PC shows, with only its Frames", () => {
  const data = src("lib/glance-data.ts");
  assert.match(data, /const id = currentMeetingId\(body, list\);/);
  assert.match(data, /framesOfMeeting\(scenes, list, id\)/);
  assert.match(data, /filled: frames\.filter\(frameFilled\)\.length/);
});

test("five checks: named and dated, Frames, every Frame filled, nothing waiting, the PC online", () => {
  const m = { name: "Sunday", date: "2026-11-08", frames: 2, filled: 2 };
  assert.equal(readyCount(m, 0, true), 5);
  assert.equal(readyCount(m, 2, true), 4, "changes waiting for Sync Now");
  assert.equal(readyCount(m, 0, false), 4, "the PC offline");
  assert.equal(readyCount({ ...m, filled: 1 }, 0, true), 4, "a Frame with nothing in it");
  assert.equal(readyCount({ name: "", date: "", frames: 0, filled: 0 }, 0, false), 1);
});

test("the card sits under Help, follows Plan's waiting changes, and shares Home's load", () => {
  const shell = src("components/app-shell.tsx");
  assert.ok(shell.indexOf("</nav>") < shell.indexOf("<SideCard />") && shell.indexOf("<SideCard />") < shell.indexOf("fd-sidebar-foot"));
  const card = src("components/side-card.tsx");
  assert.match(card, /addEventListener\("fd-plan-changes", read\)/);
  assert.match(card, /Sync Now →/);
  assert.match(src("lib/plan-changes.ts"), /dispatchEvent\?\.\(new Event\("fd-plan-changes"\)\)/);
  assert.match(src("components/glance.tsx"), /loadGlance\(supabase, workspace\.id\)/);
  assert.match(src("lib/glance-data.ts"), /Date\.now\(\) - hit\.at < 60_000/);
});
