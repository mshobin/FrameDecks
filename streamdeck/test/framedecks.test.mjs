import assert from "node:assert/strict";
import { test } from "node:test";

import { FrameDecks, PORTS, commandFor, goLiveTitle, stateFor } from "../src/framedecks.js";

const STATUS = {
  app: "FRAMEDECKS", frame: { id: "f2", name: "Prayer", number: 2 }, count: 3, blackout: false, question: true, scripture: false,
  frames: [{ id: "f1", name: "Welcome" }, { id: "f2", name: "Prayer" }, { id: "f3", name: "Study: John 3" }],
};

// A stand-in for the FRAMEDECKS program: answers on one port only, records what it was asked
function program(port, answer = { ok: true, result: "done" }) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    if (Number(u.port) !== port) throw new Error("ECONNREFUSED");
    calls.push({ path: u.pathname, body: init.body ? JSON.parse(init.body) : null });
    const body = u.pathname === "/api/command/status" ? STATUS : answer;
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchImpl, calls };
}

test("finds FRAMEDECKS on whichever of its ports it uses, and remembers it", async () => {
  const p = program(8753);
  const fd = new FrameDecks({ fetchImpl: p.fetchImpl });
  assert.deepEqual(await fd.status(), STATUS);
  assert.equal(fd.port, 8753);
  const before = p.calls.length;
  await fd.run("next");
  assert.deepEqual(p.calls.slice(before), [{ path: "/api/command", body: { op: "next", args: {} } }], "no new search");
  assert.deepEqual(PORTS, [8750, 8751, 8752, 8753, 8754, 8755, 8756, 8757, 8758, 8759, 8760]);
});

test("says so when FRAMEDECKS is not running", async () => {
  const fd = new FrameDecks({ fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
  await assert.rejects(fd.run("next"), /not running/);
});

test("the program's answer comes back as it is", async () => {
  const p = program(8750, { ok: false, result: "not run: that Frame is not on this PC" });
  const fd = new FrameDecks({ fetchImpl: p.fetchImpl });
  assert.deepEqual(await fd.run("go_live", { frame: "x" }), { ok: false, result: "not run: that Frame is not on this PC" });
});

test("each key's command; toggles ask for the opposite of what is on screen", () => {
  assert.deepEqual(commandFor("next", STATUS), { op: "next", args: {} });
  assert.deepEqual(commandFor("hideall", STATUS), { op: "hide_all", args: {} });
  assert.deepEqual(commandFor("blackout", STATUS), { op: "blackout", args: { on: true } });
  assert.deepEqual(commandFor("question", STATUS), { op: "question", args: { show: false } });
  assert.deepEqual(commandFor("scripture", STATUS), { op: "scripture", args: { show: true } });
  assert.deepEqual(commandFor("golive", STATUS, { number: 3 }), { op: "go_live", args: { frame: "f3" } });
  assert.equal(commandFor("golive", STATUS, { number: 9 }), null, "no such Frame: the key shows an alert");
});

test("keys light up to match the screen; Go Live shows its Frame", () => {
  assert.equal(stateFor("question", STATUS), 1);
  assert.equal(stateFor("blackout", STATUS), 0);
  assert.equal(stateFor("golive", STATUS, { number: 2 }), 1);
  assert.equal(stateFor("golive", STATUS, { number: 1 }), 0);
  assert.equal(stateFor("next", STATUS), null);
  assert.equal(stateFor("question", null), 0, "FRAMEDECKS not running: off");
  assert.equal(goLiveTitle(STATUS, { number: 3 }), "3\nStudy: J…");
  assert.equal(goLiveTitle(STATUS, { number: 1 }), "1\nWelcome");
  assert.equal(goLiveTitle(null, { number: 4 }), "4\n—");
});
