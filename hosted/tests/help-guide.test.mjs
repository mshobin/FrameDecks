// The Help page's step-by-step guide (8.4) stays true to the product: every label it tells people to click is on a
// real screen, every picture and circled place exists, and both tracks cover the whole workflow. When this fails after
// a screen changed, update src/lib/help-guide.ts and run tests/visual/help-shots.mjs again.
import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CORE, GUIDE, searchGuide } from "../src/lib/help-guide.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));
const shots = JSON.parse(readFileSync(join(root, "hosted/src/lib/help-shots.json"), "utf8"));
function textOf(dir, exts) {
  let out = "";
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!["node_modules", "vendor", "out", ".next"].includes(f)) out += textOf(p, exts); }
    else if (exts.some((e) => f.endsWith(e)) && !p.endsWith("help-guide.ts")) out += readFileSync(p, "utf8") + "\n";
  }
  return out;
}
const website = textOf(join(root, "hosted/src"), [".tsx", ".ts"]);
const program = textOf(join(root, "app"), [".html", ".js"]) + textOf(join(root, "src"), [".py"]); // the program's messages too (Sync complete…)
// the screens write a few labels with entities or typographic marks
const clean = (s) => s.replace(/&amp;/g, "&").replace(/&apos;|&#39;/g, "'").replace(/\\u2026/g, "…");

test("both tracks walk through the whole workflow, in order", () => {
  assert.equal(CORE.length, 8);
  for (const track of ["website", "pc"]) assert.deepEqual(GUIDE[track].steps.map((s) => s.core), [1, 2, 3, 4, 5, 6, 7, 8], track);
});

test("every label the guide names is on a real screen", () => {
  const missing = [];
  for (const [track, g] of Object.entries(GUIDE))
    for (const s of g.steps)
      for (const label of s.ui) {
        // a label from the other side is fine (the website step that sends you to the PC, and the reverse)
        if (!clean(track === "website" ? website : program).includes(label) && !clean(track === "website" ? program : website).includes(label))
          missing.push(`${s.id}: "${label}"`);
      }
  assert.deepEqual(missing, []);
});

test("every bold word in the instructions is one of the step's labels or on a screen", () => {
  for (const g of Object.values(GUIDE))
    for (const s of g.steps)
      for (const line of s.steps)
        for (const [, bold] of line.matchAll(/\*\*(.+?)\*\*/g))
          assert.ok(s.ui.includes(bold) || clean(website + program).includes(bold.replace(/^[✎⇪+] ?/, "")), `${s.id}: "${bold}"`);
});

test("every picture and circled place exists", () => {
  for (const g of Object.values(GUIDE))
    for (const s of g.steps) {
      assert.ok(existsSync(join(root, "hosted/public/help", `${s.shot}.jpg`)), `${s.id}: public/help/${s.shot}.jpg`);
      const spot = shots[s.shot]?.spots?.[s.spot];
      assert.ok(spot && spot.length === 4 && spot.every((v) => v >= 0 && v <= 100), `${s.id}: ${s.shot} → ${s.spot}`);
    }
});

test("the search finds steps by what people would type", () => {
  assert.ok(searchGuide("export").some((r) => r.step.id === "web-send"));
  assert.ok(searchGuide("teleprompter upload").some((r) => r.step.id === "pc-script"));
  assert.ok(searchGuide("resync").some((r) => r.step.id === "pc-sync"));
  assert.deepEqual(searchGuide("zzzz"), []);
});
