// 26.11.33 quick responses and polls on /follow (0022): what the room sends is checked before it is shown, the bars'
// percentages add up to 100, each phone keeps one id of its own, and the page asks the room for the open question.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { VOTER_KEY, percentages, tidyResponse, voterId } from "../src/lib/room-responses.ts";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("percentages always add up to 100, and are 0 before anyone answers", () => {
  assert.deepEqual(percentages([0, 0]), [0, 0]);
  assert.deepEqual(percentages([12, 3]), [80, 20]);
  assert.deepEqual(percentages([1, 1, 1]), [33, 34, 33]);
  assert.deepEqual(percentages([2, 1, 0, 0, 0]), [67, 33, 0, 0, 0]);
  for (const c of [[1, 2, 3, 4, 5], [7, 7, 7, 7, 7, 7], [1, 0, 999], [1, 1, 1, 1, 1, 1]]) {
    assert.equal(percentages(c).reduce((a, b) => a + b, 0), 100, String(c));
  }
});

test("what the room sends is checked before it is shown", () => {
  const ok = { id: "r1", question: "  Did this\nhelp? ", kind: "yesno", options: ["Yes", "No"], showResults: false, mine: 1 };
  assert.deepEqual(tidyResponse(ok), { ...ok, counts: null, mine: 1 });
  assert.equal(tidyResponse(null), null);
  assert.equal(tidyResponse({ ...ok, question: "" }), null);
  assert.equal(tidyResponse({ ...ok, options: ["Only"] }), null);
  assert.equal(tidyResponse({ ...ok, mine: 5 }).mine, null);
  assert.equal(tidyResponse({ ...ok, mine: 0.5 }).mine, null);
  const shown = tidyResponse({ ...ok, showResults: true, counts: [3, 2], total: 5 });
  assert.deepEqual([shown.counts, shown.total], [[3, 2], 5]);
  assert.equal(tidyResponse({ ...ok, showResults: true, counts: [1] }).counts, null, "counts that do not match are not shown");
  assert.equal(tidyResponse({ ...ok, showResults: false, counts: [1, 2] }).counts, null, "hidden results are not shown");
});

test("each phone keeps one id of its own, or one for this visit", () => {
  const kept = new Map();
  const store = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
  const id = voterId(store);
  assert.ok(id.length >= 8 && id.length <= 100);
  assert.equal(voterId(store), id);
  assert.equal(kept.get(VOTER_KEY), id);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => {} };
  const visit = voterId(broken);
  assert.ok(visit.length >= 8);
  assert.equal(voterId(null), visit, "a browser that keeps nothing gets one id for the visit");
});

test("the follow page asks the room for the open question and answers it", () => {
  const panel = src("components/join-panel.tsx");
  for (const s of ['rpc("room_response"', 'rpc("room_respond"', "Thanks, your answer is in", "aria-pressed={r.mine === i}", 'aria-live="polite"', "1 is low, 5 is high"]) {
    assert.ok(panel.includes(s), s);
  }
  assert.match(src("app/join.css"), /\.fl-bar-track span\{/);
});
