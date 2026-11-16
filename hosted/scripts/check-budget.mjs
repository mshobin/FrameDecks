// Performance budget for the built website (audit roadmap step 2): run after `npm run build`. Fails when the shipped
// JavaScript or CSS grows past the budget, so a heavy dependency cannot slip in unnoticed. Measured gzipped, as served.
// Budgets were set on 26 October 2026 with about 25% headroom (then: 317 KB JS in 21 files, largest 70 KB, CSS 12 KB).
// 28 October: CSS 20 → 24 KB on purpose. The redesigned landing draws its four step screens, the Teleprompter and the
// FrameDecks vCam preview in CSS instead of shipping pictures (21 KB after removing the old landing's unused rules).
// 2 November (8.4): CSS is measured per page, as a visitor downloads it: the largest sum of the stylesheets one page
// links. The landing page's own styles (landing-page.css) and the Help guide's now load only on those pages, so the
// signed-in app loads about 7 KB less than before; the 24 KB budget is unchanged.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

// 3 November (9.3, audit L15): JS is measured like CSS, per page as a visitor downloads it (the scripts one page loads,
// heaviest page 253 KB), with a 320 KB budget. The total of every chunk stays as a second check, without the
// old-browser polyfills (noModule: modern browsers never fetch them; 39 KB of the 395 KB that was counted).
// The About dialog's own styles now load when it is first opened, not with every page.
// 5 November (9.11.2): the website's finishing touches (app/flourish.css) load just after a page appears, linked by no
// page. Each stylesheet loaded that way is held to its own small budget, so "later" cannot become a back door.
// 9 November (26.11.28): one gesture, one chapter on the front page's stage (wheel, trackpad and touch) adds 0.25 KB to the
// total; the heaviest page is unchanged.
// 16 November (26.11.58, release sign-off): headroom without changing the look: unused rules removed, Tailwind scans
// src/ only, the download card's rules load on /download only, and supabase-js's storage client (unused here, with an
// Iceberg client and a Buffer polyfill) is left out of the browser build (src/lib/no-storage.ts). CSS 23.9 -> 22.9 KB on
// the heaviest page, JS 384 -> 371 KB in all; budgets unchanged.
const BUDGET = { pageJsKB: 320, totalJsKB: 401, largestJsKB: 90, cssKB: 24, laterCssKB: 3 };
const dir = fileURLToPath(new URL("../out/_next/static/chunks/", import.meta.url)); // a real path on Windows too (not "/C:/…")
// the scripts browsers that run modules never load (<script noModule>): not counted
const noModule = new Set();
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== "_next") walk(p); continue; }
    if (f.endsWith(".html")) for (const m of readFileSync(p, "utf8").matchAll(/<script src="\/_next\/static\/chunks\/([\w-]+\.js)"[^>]*noModule/g)) noModule.add(m[1]);
  }
})(fileURLToPath(new URL("../out/", import.meta.url)));
let js = 0, largest = 0, css = 0, largestName = "";
const jsSize = {};
for (const f of readdirSync(dir)) {
  const size = gzipSync(readFileSync(join(dir, f))).length / 1024;
  if (f.endsWith(".js") && !noModule.has(f)) {
    jsSize[f] = size;
    js += size;
    if (size > largest) [largest, largestName] = [size, f];
  } else if (f.endsWith(".css")) css += size;
}
// the CSS each page links (out/**/*.html), gzipped; the largest is what the budget holds
const out = fileURLToPath(new URL("../out/", import.meta.url));
const cssSize = {};
for (const f of readdirSync(dir)) if (f.endsWith(".css")) cssSize[f] = gzipSync(readFileSync(join(dir, f))).length / 1024;
let pageCss = 0, pageName = "", pageJs = 0, pageJsName = "";
const linkedAnywhere = new Set();
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== "_next") walk(p); continue; }
    if (!f.endsWith(".html")) continue;
    const html = readFileSync(p, "utf8");
    const scripts = [...new Set([...html.matchAll(/<script src="\/_next\/static\/chunks\/([\w-]+\.js)"/g)].map((m) => m[1]))];
    const jsHere = scripts.reduce((a, c) => a + (jsSize[c] ?? 0), 0);
    if (jsHere > pageJs) [pageJs, pageJsName] = [jsHere, p.slice(out.length)];
    const linked = [...new Set([...html.matchAll(/chunks\/([\w-]+\.css)/g)].map((m) => m[1]))];
    for (const c of linked) linkedAnywhere.add(c);
    const size = linked.reduce((a, c) => a + (cssSize[c] ?? 0), 0);
    if (size > pageCss) [pageCss, pageName] = [size, p.slice(out.length)];
  }
})(out);
css = pageCss;
// the stylesheets no page links (loaded later by a script): the largest of them
let laterCss = 0;
for (const [f, size] of Object.entries(cssSize)) if (!linkedAnywhere.has(f)) laterCss = Math.max(laterCss, size);
const report = `JS ${pageJs.toFixed(0)} KB on the heaviest page, ${pageJsName} (budget ${BUDGET.pageJsKB}), ` +
  `${js.toFixed(0)} KB in all (budget ${BUDGET.totalJsKB}), largest ${largest.toFixed(0)} KB ${largestName} ` +
  `(budget ${BUDGET.largestJsKB}), CSS ${css.toFixed(1)} KB on the heaviest page, ${pageName} (budget ${BUDGET.cssKB}), ` +
  `largest stylesheet loaded later ${laterCss.toFixed(1)} KB (budget ${BUDGET.laterCssKB}), gzipped`;
console.log(report);
if (pageJs > BUDGET.pageJsKB || js > BUDGET.totalJsKB || largest > BUDGET.largestJsKB || css > BUDGET.cssKB || laterCss > BUDGET.laterCssKB) {
  console.error("Over the performance budget. Find what grew, or raise the budget on purpose in scripts/check-budget.mjs.");
  process.exit(1);
}
