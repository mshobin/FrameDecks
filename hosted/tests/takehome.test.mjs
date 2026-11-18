// 26.11.63 the take-home page on /follow (room_takehome, 0030): the published body is checked and cut to size before it
// is shown, a phone follows the prayer requests it sent by id only, and the page offers the take-home while the room is
// open and as the whole page once it closes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { MY_PRAYERS_KEY, dayDate, joinTarget, myPrayerStates, paragraphs, readMyPrayers, rememberPrayer, tidyTakehome } from "../src/lib/takehome.ts";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

const full = {
  v: 1,
  meeting: "  Sunday service ",
  org: "Grace Church",
  date: "2026-11-15",
  color: "#2A6FDB",
  note: "Thank you for coming.",
  verses: [{ ref: "John 3:16", text: "For God so loved the world…", version: "KJV" }, { ref: "", text: "no ref" }, "x"],
  questions: ["What stood out?", "", 4],
  songs: [{ title: "Amazing Grace", credit: "John Newton" }, { credit: "no title" }],
  notes: "First paragraph.\n\nSecond\nparagraph.",
  prayers: ["For Sam's recovery"],
  answered: ["A new job for Ana"],
  status: { a1: "praying", b2: "answered", c3: "lost" },
  next: { name: "Midweek study", date: "2026-11-19", time: "19:30", read: ["Romans 8"], questions: ["Q1"], join: "K7PM 2XQ4" },
  days: [{ label: "Monday", read: "Psalm 1" }, { label: "", read: "" }],
  extra: "dropped",
};

test("a full body is kept, trimmed, and cut to what it should hold", () => {
  const t = tidyTakehome(full);
  assert.equal(t.meeting, "Sunday service");
  assert.equal(t.org, "Grace Church");
  assert.equal(t.date, "2026-11-15");
  assert.equal(t.color, "#2a6fdb");
  assert.deepEqual(t.verses, [{ ref: "John 3:16", text: "For God so loved the world…", version: "KJV" }]);
  assert.deepEqual(t.questions, ["What stood out?"]);
  assert.deepEqual(t.songs, [{ title: "Amazing Grace", credit: "John Newton" }]);
  assert.deepEqual(t.status, { a1: "praying", b2: "answered" });
  assert.deepEqual(t.next, { name: "Midweek study", date: "2026-11-19", time: "19:30", read: ["Romans 8"], questions: ["Q1"], join: "K7PM 2XQ4" });
  assert.deepEqual(t.days, [{ label: "Monday", read: "Psalm 1" }]);
  assert.equal("extra" in t, false);
});

test("a thin or odd body is safe to show", () => {
  const t = tidyTakehome({ meeting: "Bible study" });
  assert.deepEqual(t, {
    meeting: "Bible study", org: "", date: "", color: null, note: "", verses: [], questions: [], songs: [], notes: "",
    prayers: [], answered: [], status: {}, next: null, days: [],
  });
  assert.equal(tidyTakehome({ color: "red", date: "2026-02-30", next: { date: "x" } }).color, null);
  assert.equal(tidyTakehome({ date: "2026-02-30" }).date, "", "not a real day");
  assert.equal(tidyTakehome({ next: { date: "2026-11-19" } }).next, null, "a next meeting needs a name");
  assert.equal(tidyTakehome({ color: "#abc" }).color, null);
  assert.equal(tidyTakehome({ color: "url(x)" }).color, null);
  for (const bad of [null, undefined, "x", 3, [], { v: 2 }]) assert.equal(tidyTakehome(bad), null, String(bad));
  assert.equal(tidyTakehome({ questions: Array.from({ length: 200 }, (_, i) => `q${i}`) }).questions.length, 60);
  assert.equal(tidyTakehome({ meeting: "m".repeat(500) }).meeting.length, 200);
});

test("dates are read as local days and paragraphs split on blank lines", () => {
  const d = dayDate("2026-11-15");
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 10, 15]);
  assert.equal(dayDate("2026-13-01"), null);
  assert.equal(dayDate(""), null);
  assert.deepEqual(paragraphs("One.\n\n  \nTwo\nlines.\n\n"), ["One.", "Two\nlines."]);
  assert.deepEqual(paragraphs(""), []);
});

test("join opens an https link or a meeting code, and shows anything else", () => {
  assert.deepEqual(joinTarget("https://example.org/live"), { href: "https://example.org/live", text: "example.org/live" });
  assert.deepEqual(joinTarget("k7pm-2xq4"), { href: "/follow#c=K7PM2XQ4", text: "K7PM2XQ4" });
  assert.deepEqual(joinTarget("javascript:alert(1)"), { href: null, text: "javascript:alert(1)" });
  assert.deepEqual(joinTarget("http://plain.example"), { href: null, text: "http://plain.example" });
  assert.deepEqual(joinTarget("Church hall"), { href: null, text: "Church hall" });
});

test("a phone keeps the prayer requests it sent, newest first, at most 30, and follows their status", () => {
  const kept = new Map();
  const store = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
  assert.deepEqual(readMyPrayers(store), []);
  rememberPrayer("a1", "Please pray for my mother, who is in hospital this week and waiting for news.".repeat(2), 1, store);
  rememberPrayer("b2", "  For work  ", 2, store);
  const mine = readMyPrayers(store);
  assert.deepEqual(mine.map((p) => p.id), ["b2", "a1"]);
  assert.equal(mine[0].text, "For work");
  assert.equal(mine[1].text.length, 80);
  for (let i = 0; i < 40; i++) rememberPrayer(`x${i}`, "t", 10 + i, store);
  assert.equal(readMyPrayers(store).length, 30);
  assert.equal(readMyPrayers(store)[0].id, "x39");
  assert.ok(JSON.parse(kept.get(MY_PRAYERS_KEY)).length === 30);
  const states = myPrayerStates([{ id: "a1", text: "A", at: 1 }, { id: "zz", text: "Z", at: 2 }, { id: "b2", text: "B", at: 3 }], { a1: "praying", b2: "answered" });
  assert.deepEqual(states.map((p) => [p.id, p.state]), [["a1", "praying"], ["b2", "answered"]]);
  assert.deepEqual(myPrayerStates([{ id: "toString", text: "", at: 0 }], {}), []);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(readMyPrayers(broken), []);
  assert.doesNotThrow(() => rememberPrayer("c3", "x", 1, broken));
  kept.set(MY_PRAYERS_KEY, "{not json");
  assert.deepEqual(readMyPrayers(store), []);
});

test("the follow page offers the take-home and keeps the prayer ids it sends", () => {
  const panel = src("components/join-panel.tsx") + src("components/follow-together.tsx");
  for (const s of ['rpc("room_takehome"', "tidyTakehome(", "rememberPrayer(", "Take-home", "Still praying", "Answered prayers", "Your prayer requests", "Between meetings", "Next time"]) {
    assert.ok(panel.includes(s), s);
  }
  for (const s of ['rpc("room_checkin"', 'rpc("room_hand"', 'rpc("room_quiz_view"', 'rpc("room_quiz_answer"', "fd-follow-name", "So the leader can invite you to share. Only the leader sees it."]) {
    assert.ok(panel.includes(s), s);
  }
  assert.doesNotMatch(panel, /Sign in|Sign up|Account|Password|\bAI\b/);
});
