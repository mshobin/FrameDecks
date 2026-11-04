// 8.6 Signing out: the session ends, this browser forgets it, and the person lands on framedecks.com; when the
// server cannot be reached the session is still cleared here, and only a browser that cannot be signed out at all
// stays put with a message.
import assert from "node:assert/strict";
import { test } from "node:test";

import { SIGNED_OUT_URL, clearLocalSession, signOutAndLeave } from "../src/lib/sign-out.ts";

function store(keys) {
  const m = new Map(keys.map((k) => [k, "x"]));
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, removeItem: (k) => m.delete(k), m };
}
const client = (global, local) => ({ auth: { signOut: async (o) => {
  const r = o?.scope === "local" ? local : global;
  if (r instanceof Error) throw r;
  return { error: r };
} } });

test("goes to framedecks.com", () => assert.equal(SIGNED_OUT_URL, "https://framedecks.com"));

test("clears only the Supabase session entries", () => {
  const s = store(["sb-abc-auth-token", "fd-theme", "sb-abc-auth-token-code-verifier", "fd-consent"]);
  assert.equal(clearLocalSession(s), 2);
  assert.deepEqual([...s.m.keys()], ["fd-theme", "fd-consent"]);
  assert.equal(clearLocalSession(null), 0);
});

test("a normal sign-out leaves for framedecks.com", async () => {
  let went = "";
  assert.equal(await signOutAndLeave(client(null, null), (u) => (went = u)), null);
  assert.equal(went, SIGNED_OUT_URL);
});

test("no internet: the session is still cleared here and the person still leaves", async () => {
  let went = "";
  assert.equal(await signOutAndLeave(client(new Error("Failed to fetch"), null), (u) => (went = u)), null);
  assert.equal(went, SIGNED_OUT_URL);
  went = "";
  assert.equal(await signOutAndLeave(client({ message: "500" }, null), (u) => (went = u)), null);
  assert.equal(went, SIGNED_OUT_URL);
});

test("when nothing could be signed out, it says so and stays", async () => {
  let went = "";
  const msg = await signOutAndLeave(client(new Error("down"), new Error("blocked")), (u) => (went = u));
  assert.match(msg, /Couldn’t disconnect this device/);
  assert.equal(went, "");
});
