// 26.11.4 Help search: the plain scorer finds the right place for the words people really type.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { searchHelp, words } from "../src/lib/help-search.ts";

const codes = JSON.parse(readFileSync(new URL("../content/help-codes.json", import.meta.url), "utf8"));
const index = [
  ...codes.map((c) => ({ kind: "Error code", title: `${c.code} · ${c.title}`, text: `${c.why} ${c.fix}`, href: `/help?code=${c.code}#codes` })),
  { kind: "Guide", title: "When something goes wrong: Hide all, Black screen, Emergency, Freeze", text: "Press K for a black screen.", href: "/docs/presentations#x" },
  { kind: "Guide", title: "If the phone can't connect", text: "Same Wi-Fi, not a guest network; allow FrameDecks through the firewall.", href: "/docs/remote-control#if-the-phone-cant-connect" },
  { kind: "Guide", title: "Teleprompter", text: "Follow my voice moves the script as you speak.", href: "/docs/presentations#teleprompter" },
];

test("words keep error codes whole and drop small words", () => {
  assert.deepEqual(words("Why does FD-NET-02 happen?"), ["fd-net-02", "happen"]);
  assert.deepEqual(words("Phone won’t connect"), ["phone", "connect"]);
});

test("an error code typed exactly comes first", () => {
  assert.equal(searchHelp(index, "fd-net-02")[0].href, "/help?code=FD-NET-02#codes");
});

test("everyday words find the right answer", () => {
  assert.equal(searchHelp(index, "black screen")[0].href, "/docs/presentations#x");
  assert.equal(searchHelp(index, "phone won't connect")[0].href, "/docs/remote-control#if-the-phone-cant-connect");
  assert.equal(searchHelp(index, "voice")[0].href, "/docs/presentations#teleprompter");
  assert.ok(searchHelp(index, "firew").some((e) => e.title.includes("Firewall") || e.text.includes("firewall")), "word starts match");
});

test("nothing typed, nothing found", () => {
  assert.deepEqual(searchHelp(index, "  "), []);
  assert.deepEqual(searchHelp(index, "zzzz"), []);
});
