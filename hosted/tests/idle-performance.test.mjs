// The website must cost nothing while it sits open next to the program on an older PC (owner, 26 October):
// no endless animations, no animated blur, and frosted glass only on the sticky bars.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const dir = new URL("../src/app/", import.meta.url);
const css = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(new URL(f, dir), "utf8")]);

test("no animation runs forever", () => {
  for (const [file, text] of css) assert.doesNotMatch(text, /\binfinite\b/, `${file} has an endless animation`);
});

test("frosted glass only on the sticky bars and dialogs", () => {
  const design = css.find(([f]) => f === "design.css")[1];
  assert.ok((design.match(/backdrop-filter/g) || []).length <= 2, "design.css: backdrop-filter belongs on the two sticky bars only");
});
