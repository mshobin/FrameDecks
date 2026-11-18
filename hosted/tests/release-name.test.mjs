// 26.11.63 how a release is named: the website says "FrameDecks v26.11 · Stable Release · Updated November 2026";
// GitHub titles the release 26.11.63 (YY.MM.Build); the tag stays v26.11.63.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { shortVersion, updatedLabel } from "../src/lib/releases.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the website shows YY.MM", () => {
  assert.equal(shortVersion("26.11.63"), "v26.11");
  assert.equal(shortVersion("v26.12.1"), "v26.12");
  assert.equal(shortVersion("27.1.4"), "v27.01");
  assert.equal(shortVersion("26.11"), "v26.11");
  assert.equal(shortVersion("beta"), "beta");
});

test("Updated <Month YYYY> comes from the release date, else from the version", () => {
  assert.equal(updatedLabel("2026-11-18", "26.11.63"), "Updated November 2026");
  assert.equal(updatedLabel("2026-12-01", "26.11.63"), "Updated December 2026", "the real date wins");
  assert.equal(updatedLabel("", "27.01.2"), "Updated January 2027");
  assert.equal(updatedLabel("", "beta"), "");
});

test("the download card, footer and Help use the short name; the build stays in the small print", () => {
  const dl = read("../src/components/download-panel.tsx");
  assert.match(dl, /FrameDecks \{shortVersion\(version\)\}<\/h2>/);
  assert.match(dl, /<strong>Stable Release<\/strong>/);
  assert.match(dl, /updatedLabel\(release\?\.released \?\? "", version\)/);
  assert.match(dl, /Build \{version\}/);
  // SignPath Foundation asks the download page to say who provides the signing (README "Code signing policy" too)
  assert.match(dl.replace(/\s+/g, " "), /Free code signing provided by\{" "\} <a href="https:\/\/about\.signpath\.io\/" rel="noopener"> SignPath\.io <\/a> , certificate by\{" "\} <a href="https:\/\/signpath\.org\/" rel="noopener"> SignPath Foundation <\/a>/);
  assert.match(read("../src/components/site-footer.tsx"), /\{shortVersion\(brand\.version\)\}, Stable Release \(build \{brand\.version\}\)/);
  assert.match(read("../src/app/help/page.tsx"), /FrameDecks \$\{shortVersion\(brand\.version\)\}/);
});

test("GitHub titles the release YY.MM.Build and keeps the v tag", () => {
  const wf = read("../../.github/workflows/build-windows.yml");
  assert.match(wf, /\n {10}name: \$\{\{ needs\.build\.outputs\.version \}\}\n/);
  assert.doesNotMatch(wf, /name: FrameDecks \$\{\{ needs\.build\.outputs\.version \}\}/);
});

test("the Actions list keeps the newest runs of each workflow", () => {
  const wf = read("../../.github/workflows/tidy-runs.yml");
  assert.match(wf, /default: "10"/);
  assert.match(wf, /cron: "41 2 \* \* 0"/);
  assert.match(wf, /actions: write/);
  assert.match(wf, /\$3 != me && \$4 == "completed"/, "never this run or a run still going");
  assert.doesNotMatch(wf, /releases|git push|tags/, "only runs, never releases or tags");
});
