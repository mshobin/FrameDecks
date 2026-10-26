import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { brandData } from "../scripts/write-brand.mjs";

test("the website's About text is the program's (run npm run build or node scripts/write-brand.mjs)", () => {
  const committed = JSON.parse(readFileSync(new URL("../src/lib/brand.json", import.meta.url), "utf8"));
  assert.deepEqual(committed, brandData());
  assert.match(committed.version, /^\d+\.\d+/);
});
