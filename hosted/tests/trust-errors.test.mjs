import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { userSafeError } from "../src/lib/user-error.ts";

test("backend messages never become user-facing fallback text", () => {
  const raw = "relation private.customer_data does not exist; query was SELECT *";
  assert.equal(userSafeError({ code: "XX000", message: raw }), "That didn’t work. Please try again.");
  assert.equal(userSafeError({ code: "42501", message: raw }), "You don’t have permission to make that change. Ask a workspace owner.");
  assert.equal(userSafeError({ status: Symbol("invalid") }), "That didn’t work. Please try again.");
});

test("known failures are mapped to plain-language next steps", () => {
  assert.equal(userSafeError({ code: "23505", message: "duplicate key detail" }), "That already exists. Choose a different name.");
  assert.equal(userSafeError({ code: "53400" }), "Too many changes just now. Wait a moment, then try again.");
  assert.equal(userSafeError(new TypeError("Failed to fetch")), "FrameDecks couldn’t reach the service. Check your connection and try again.");
});

test("the companion uses designed confirmation dialogs instead of browser prompts", () => {
  const directory = new URL("../src/components/", import.meta.url);
  const sources = readdirSync(directory)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => readFileSync(new URL(name, directory), "utf8"))
    .join("\n");
  assert.doesNotMatch(sources, /\bwindow\.(?:confirm|prompt)\s*\(/);
  assert.match(sources, /className="fd-confirm"/);
  assert.match(sources, /aria-labelledby=/);
  assert.match(sources, /confirmationText/);
});
