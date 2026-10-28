// Performance budget for the built website (audit roadmap step 2): run after `npm run build`. Fails when the shipped
// JavaScript or CSS grows past the budget, so a heavy dependency cannot slip in unnoticed. Measured gzipped, as served.
// Budgets were set on 26 October 2026 with about 25% headroom (then: 317 KB JS in 21 files, largest 70 KB, CSS 12 KB).
// 28 October: CSS 20 → 24 KB on purpose. The redesigned landing draws its four step screens, the Teleprompter and the
// FRAMECAST preview in CSS instead of shipping pictures (21 KB after removing the old landing's unused rules).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const BUDGET = { totalJsKB: 400, largestJsKB: 90, cssKB: 24 };
const dir = fileURLToPath(new URL("../out/_next/static/chunks/", import.meta.url)); // a real path on Windows too (not "/C:/…")
let js = 0, largest = 0, css = 0, largestName = "";
for (const f of readdirSync(dir)) {
  const size = gzipSync(readFileSync(join(dir, f))).length / 1024;
  if (f.endsWith(".js")) {
    js += size;
    if (size > largest) [largest, largestName] = [size, f];
  } else if (f.endsWith(".css")) css += size;
}
const report = `JS ${js.toFixed(0)} KB (budget ${BUDGET.totalJsKB}), largest ${largest.toFixed(0)} KB ${largestName} ` +
  `(budget ${BUDGET.largestJsKB}), CSS ${css.toFixed(0)} KB (budget ${BUDGET.cssKB}), gzipped`;
console.log(report);
if (js > BUDGET.totalJsKB || largest > BUDGET.largestJsKB || css > BUDGET.cssKB) {
  console.error("Over the performance budget. Find what grew, or raise the budget on purpose in scripts/check-budget.mjs.");
  process.exit(1);
}
