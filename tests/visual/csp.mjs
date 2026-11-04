// 9.3 Content-Security-Policy check (production audit M7), run against a started program:
//   FRAMEDECKS_NO_UPDATE_CHECK=1 python src/server.py &   then   node tests/visual/csp.mjs
// Opens every page of the program (and every Studio, Members and Settings view, the Setup guide, the palette and the
// Memory Cards pane) and fails on any rule the page breaks. The policy is report-only for now, so the browser still
// raises a securitypolicyviolation event for each break; that event is what this counts.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.FRAMEDECKS_URL || "http://127.0.0.1:8750";

const PAGES = ["dashboard.html", "remote.html", "speaker.html", "spotlight.html", "memory-popup.html", "present.html",
  "stage.html", "focus-verse.html", "discussion-question.html", "birthday.html"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => {
  window.__csp = [];
  document.addEventListener("securitypolicyviolation", (e) =>
    window.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || "(inline)"} at ${e.sourceFile || location.pathname}:${e.lineNumber}`));
});
const found = [];
async function collect(p, where) {
  const frames = p.frames();
  for (const f of frames) {
    const v = await f.evaluate(() => (window.__csp || []).splice(0)).catch(() => []);
    for (const x of v) found.push(`${where}: ${x}`);
  }
}

for (const page of PAGES) {
  const p = await ctx.newPage();
  const res = await p.goto(`${BASE}/${page}`);
  const policy = res.headers()["content-security-policy-report-only"] || res.headers()["content-security-policy"];
  if (!policy || !/script-src 'self'/.test(policy) || /'unsafe-eval'/.test(policy)) found.push(`${page}: no policy (${policy})`);
  await p.waitForTimeout(1800);
  if (page === "dashboard.html") {
    await p.evaluate(() => document.querySelectorAll(".app-modal-back").forEach((m) => m.remove()));
    await p.evaluate(() => { window.KCOnboarding.open(); });                // 9.5 the Welcome flow, then away
    for (let i = 0; i < 3; i++) { await p.waitForTimeout(500); await p.click("#onb-next"); }
    await p.evaluate(() => window.KCOnboarding.close());
    for (const tab of ["studio", "members", "birthdays", "email", "settings"]) {
      await p.evaluate((t) => window.KCSetTab(t), tab);
      await p.waitForTimeout(400);
    }
    await p.evaluate(() => { window.KCSetTab("studio"); window.KCGuide && window.KCGuide.open(); });
    await p.waitForTimeout(400);
    await p.keyboard.press("Escape");
    await p.keyboard.press("Control+k");
    await p.waitForTimeout(300);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
  }
  await collect(p, page);
  await p.close();
}
await browser.close();

if (found.length) {
  console.error(`Content-Security-Policy: ${found.length} break(s)\n  ` + [...new Set(found)].join("\n  "));
  process.exit(1);
}
console.log(`Content-Security-Policy: ${PAGES.length} pages, no rule broken`);
