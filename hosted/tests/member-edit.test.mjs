import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

import { birthDateInput, birthdayLabel, groupCounts, inGroup, memberBody, parseBirthDate } from "../src/lib/member-edit.ts";

// The desktop's own member rules (app/js/members-core.js), loaded as the program loads them.
const sandbox = { globalThis: {} };
sandbox.window = sandbox.globalThis;
vm.runInNewContext(readFileSync(new URL("../../app/js/members-core.js", import.meta.url), "utf8"), sandbox);
const M = sandbox.globalThis.KCMembers;

// What app/js/members.js normalizeData does to every person it loads: the companion's records must pass unchanged.
const desktopNormalize = (m) => {
  const bd = /^(\d{4}|-)-\d{2}-\d{2}$/.test(m.birthDate || "") && M.parseDate(m.birthDate).ok ? m.birthDate : "";
  return { id: M.clean(m.id, 40) || "new", name: M.clean(m.name, 120), country: M.clean(m.country, 80), phone: M.clean(m.phone, 40),
    email: M.clean(m.email, 160), birthDate: bd, role: M.clean(m.role, 60) };
};

const draft = (over = {}) => ({ name: "Ruth Adams", country: "Kuwait", phone: "+965 5000 0000", email: "ruth@example.org", birthDate: "", role: "Leader", ...over });

test("what the companion saves arrives on the PC exactly as saved", () => {
  for (const d of [
    draft(),
    draft({ birthDate: "1985-03-15" }),
    draft({ birthDate: "03-15" }),
    draft({ birthDate: "--02-29" }),
    draft({ name: "  Paul \u0007Brown  ", country: "", phone: "", email: "", role: "" }),
    draft({ name: "x".repeat(300), role: "y".repeat(90) }),
  ]) {
    const { body, errors } = memberBody("m1", d);
    assert.deepEqual(errors, []);
    assert.deepEqual(desktopNormalize(body), body);
  }
});

test("birth dates follow the desktop's rules", () => {
  const today = new Date(2026, 9, 25);
  for (const [input, stored] of [["1985-03-15", "1985-03-15"], ["1985-3-5", "1985-03-05"], ["03-15", "--03-15"], ["--12-25", "--12-25"], ["", ""]]) {
    const r = parseBirthDate(input, today);
    assert.ok(r.ok, input);
    assert.equal(r.value, stored);
    if (stored) assert.equal(M.parseDate(stored).iso, stored, `desktop reads ${stored} the same`);
  }
  for (const bad of ["1985-02-30", "2027-01-01", "1850-01-01", "13-01", "15/03/1985", "soon"]) {
    assert.equal(parseBirthDate(bad, today).ok, false, bad);
  }
  assert.equal(parseBirthDate("2000-02-29", today).ok, true);
  assert.equal(parseBirthDate("1900-02-29", today).ok, false);
  assert.equal(birthdayLabel("1985-03-15"), "15 March 1985");
  assert.equal(birthdayLabel("--03-05"), "5 March");
  assert.equal(birthdayLabel("04/02"), "04/02", "an older form is shown as it is");
  assert.equal(birthDateInput("--03-05"), "03-05");
});

test("a person needs a name, and an email or phone that look right", () => {
  assert.deepEqual(memberBody("m1", draft({ name: " " })).errors, ["The name is missing."]);
  assert.deepEqual(memberBody("m1", draft({ email: "ruth@" })).errors, ["The email address does not look right."]);
  assert.deepEqual(memberBody("m1", draft({ phone: "call me" })).errors, ["The phone number does not look right."]);
  const fresh = memberBody("", draft()).body;
  assert.match(fresh.id, /^m[a-z0-9]{6,}$/, "a new person gets an id in the desktop's form");
});

test("groups filter and count people, ignoring people removed since", () => {
  const people = [{ id: "a", name: "Zoe" }, { id: "b", name: "Adam" }, { id: "c", name: "Mia" }];
  const links = new Map([["a", new Set(["g1"])], ["b", new Set(["g1", "g2"])], ["gone", new Set(["g1"])]]);
  assert.deepEqual(inGroup(people, links, "g1").map((p) => p.name), ["Adam", "Zoe"]);
  assert.deepEqual(inGroup(people, links, "").map((p) => p.name), ["Adam", "Mia", "Zoe"]);
  assert.deepEqual([...groupCounts(links, new Set(["a", "b", "c"]))], [["g1", 2], ["g2", 1]]);
});
