// One-click linking (6.13): the link from the program carries the code in its fragment, the website and the program
// show the same check number, and only a fresh /connect path is ever returned to after signing in.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { checkNumber, normalizeCode, parseConnect, rememberReturn, takeReturn } from "../src/lib/connect-link.ts";

test("the request is read from the fragment, and a bad code is refused", () => {
  assert.deepEqual(parseConnect("#code=k7pm%202xq9&name=Hall%20PC"), { code: "K7PM2XQ9", name: "Hall PC" });
  assert.deepEqual(parseConnect("#code=K7PM2XQ9"), { code: "K7PM2XQ9", name: "A computer" });
  for (const bad of ["", "#code=K7PM2XQ", "#code=K7PM2XQ0", "#code=K7PM2XQ9X", "#name=Hall"]) assert.equal(parseConnect(bad), null, bad);
  assert.equal(normalizeCode(" ab cd 23 45 "), "ABCD2345");
});

test("the check number matches the program's (src/cloud_sync.py check_number)", async () => {
  // the same three values are asserted in tests/test_cloud_sync.py
  assert.equal(await checkNumber("K7PM2XQ9"), 36);
  assert.equal(await checkNumber("abcd efgh"), 28);
  assert.equal(await checkNumber("23456789"), 45);
});

test("after signing in, only a fresh /connect path on this site is returned to, and only once", () => {
  const box = new Map();
  const store = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v), removeItem: (k) => box.delete(k) };
  rememberReturn(store, "/connect#code=K7PM2XQ9", 1000);
  assert.equal(takeReturn(store, 2000), "/connect#code=K7PM2XQ9");
  assert.equal(takeReturn(store, 2000), null, "once");
  rememberReturn(store, "/connect#code=K7PM2XQ9", 0);
  assert.equal(takeReturn(store, 16 * 60 * 1000), null, "stale after 15 minutes");
  rememberReturn(store, "https://evil.example/connect", 0);
  assert.equal(takeReturn(store, 1), null, "never another site");
  box.set("fd-after-sign-in", JSON.stringify({ path: "//evil.example/connect", at: 0 }));
  assert.equal(takeReturn(store, 1), null);
});

test("the connect page is private and the program's link keeps the code out of the address's path and query", () => {
  const page = readFileSync(new URL("../src/app/connect/page.tsx", import.meta.url), "utf8");
  assert.match(page, /pageMetadata\("Connect a PC", "\/connect", \{ private: true \}\)/);
  const py = readFileSync(new URL("../../src/cloud_sync.py", import.meta.url), "utf8");
  assert.match(py, /\/connect#code=/);
});
