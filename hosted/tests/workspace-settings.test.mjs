import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { PROFILES, SWATCHES, brandFormOf, brandFromForm, profileOf, upcomingBirthdays, validColor } from "../src/lib/workspace-settings.ts";

// The program's own store.js: what the PC keeps when these records arrive
const require = createRequire(import.meta.url);
const { Store, Scenes } = require("../../tests/helpers/load-store.js")();
const plain = (v) => JSON.parse(JSON.stringify(v));

test("branding saved on the website is what the program keeps, and the PC's logo is untouched", () => {
  const base = { meeting: "Tuesday Study", org: "Grace Church", color: "#c9a04a", logo: "3", lw: 400, lh: 120, auto: true };
  const body = brandFromForm({ ...brandFormOf(base), meeting: "  Thursday Study ", color: "#2F6FB0", auto: false }, base);
  assert.deepEqual(body, { meeting: "Thursday Study", org: "Grace Church", color: "#2f6fb0", logo: "3", lw: 400, lh: 120, auto: false });
  assert.deepEqual(plain(Store.normalize({ brand: body }).brand), body);
  const fresh = brandFromForm({ meeting: "x".repeat(200), org: "", color: "nope", auto: true }, null);
  assert.deepEqual(plain(Store.normalize({ brand: fresh }).brand), fresh);
  assert.equal(fresh.meeting.length, 80);
  assert.equal(fresh.color, "");
  assert.ok(validColor("") && validColor("#AbCdEf") && !validColor("#abc") && !validColor("red"));
  assert.equal(SWATCHES[0][0], "");
});

test("the transition styles are the program's", () => {
  assert.deepEqual(PROFILES.map((p) => p.id), plain(Scenes.profiles).map((p) => p.id));
  assert.deepEqual(PROFILES.map((p) => p.name), plain(Scenes.profiles).map((p) => p.name));
  assert.equal(profileOf({ value: "wedding" }), "wedding");
  assert.equal(profileOf({ value: "nonsense" }), "bible-study");
  assert.equal(Store.normalize({ profile: "wedding" }).profile, "wedding");
});

test("birthdays this week: today first, without a year, across the new year, and 29 February", () => {
  const today = new Date(2026, 11, 29); // 29 December 2026
  const people = [
    { id: "a", name: "Ruth", birthDate: "1990-12-29" },
    { id: "b", name: "Paul", birthDate: "--01-02" },
    { id: "c", name: "Anna", birthDate: "1985-01-10" },
    { id: "d", name: "Mark", birthDate: "" },
    { id: "e", name: "Lydia", birthDate: "1992-12-31" },
  ];
  const got = upcomingBirthdays(people, today);
  assert.deepEqual(got.map((b) => [b.name, b.inDays, b.turning]), [["Ruth", 0, 36], ["Lydia", 2, 34], ["Paul", 4, null]]);
  const leap = upcomingBirthdays([{ id: "f", name: "Leap", birthDate: "2000-02-29" }], new Date(2027, 1, 25));
  assert.deepEqual(leap.map((b) => [b.inDays, b.date.getDate()]), [[3, 28]]);
});
