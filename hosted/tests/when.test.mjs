import assert from "node:assert/strict";
import { test } from "node:test";

import { exactTime, relativeTime, shortDate } from "../src/lib/when.ts";

const now = Date.parse("2026-10-26T15:00:00Z");
const ago = (ms) => new Date(now - ms).toISOString();

test("recent times read as minutes, hours and days ago", () => {
  assert.equal(relativeTime(ago(20_000), now), "just now");
  assert.equal(relativeTime(ago(5 * 60_000), now), "5 min ago");
  assert.equal(relativeTime(ago(2 * 3600_000 + 59 * 60_000), now), "2 h ago");
  assert.equal(relativeTime(ago(30 * 3600_000), now), "yesterday");
  assert.equal(relativeTime(ago(3 * 86400_000), now), "3 days ago");
  assert.equal(relativeTime(ago(-60_000), now), "just now");      // a PC clock a little ahead
});

test("older times are a short date, with the year only when it differs", () => {
  assert.equal(relativeTime("2026-10-12T09:00:00Z", now, "en-GB"), "12 Oct");
  assert.equal(shortDate("2025-03-02T09:00:00Z", now, "en-GB"), "2 Mar 2025");
});

test("the exact time never shows seconds, and bad input shows nothing", () => {
  const t = exactTime("2026-10-26T08:00:05Z", "en-US");
  assert.doesNotMatch(t, /:\d\d:\d\d/);
  assert.match(t, /2026/);
  assert.equal(relativeTime("not a date", now), "");
  assert.equal(exactTime("not a date"), "");
});
