// Accessibility scan of the desktop program with axe-core (WCAG 2.1 A and AA), run against a started program:
//   FRAMEDECKS_NO_UPDATE_CHECK=1 python server.py &   then   node tests/visual/a11y.mjs
// Every tab, every Settings section and the Speaker, Teleprompter and Spotlight windows, in the dark and light themes.
// Any violation fails. axe finds about half of what a person with a screen reader finds; it does not replace that pass.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = require.resolve("axe-core/axe.min.js");
const BASE = process.env.FRAMEDECKS_URL || "http://127.0.0.1:8750";
const RULES = { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } };

const found = new Map();
async function scan(p, where) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate((rules) => window.axe.run(document, rules), RULES);
  for (const v of r.violations) {
    for (const n of v.nodes) {
      const key = `${v.id}: ${n.target.join(" ")}`;
      if (!found.has(key)) found.set(key, `${where}: ${v.help} (${(n.failureSummary.split("\n")[1] || "").trim()})`);
    }
  }
}

const browser = await chromium.launch();
for (const theme of ["dark", "light"]) {
  const p = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto(`${BASE}/dashboard.html`);
  await p.waitForTimeout(2200);
  if (await p.evaluate(() => !!document.querySelector(".app-modal-back"))) {      // a fresh program asks the first-run question
    await scan(p, `${theme} first run`);
    await p.evaluate(() => document.querySelectorAll(".app-modal-back").forEach((m) => m.remove()));
  }
  await p.evaluate((t) => { window.KCSetTab("settings"); document.querySelector(`[data-theme-pick="${t}"]`).click(); }, theme);
  for (const tab of ["studio", "members"]) {
    await p.evaluate((t) => window.KCSetTab(t), tab);
    await p.waitForTimeout(300);
    await scan(p, `${theme} ${tab}`);
  }
  await p.evaluate(() => { window.KCSetTab("studio"); window.KCServiceMode.set("run"); });       // the service view
  await p.waitForTimeout(400);
  await scan(p, `${theme} Studio in Run`);
  await p.evaluate(() => window.KCServiceMode.set("prepare"));
  const sections = await p.evaluate(() => [...document.querySelectorAll("#s-nav [data-sec]")].map((b) => b.dataset.sec));
  for (const s of sections) {
    await p.evaluate((id) => { window.KCSetTab("settings"); window.KCShowSection(id); }, s);
    await p.waitForTimeout(250);
    await scan(p, `${theme} Settings → ${s}`);
  }
  await p.evaluate(() => document.querySelector('[data-theme-pick="dark"]').click());
  await p.close();
}
for (const page of ["speaker.html", "prompter.html", "spotlight.html"]) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(`${BASE}/${page}`);
  await p.waitForTimeout(1500);
  await scan(p, page);
  await p.close();
}
await browser.close();

for (const [key, where] of found) console.log(`FAIL ${key}\n     ${where}`);
console.log(found.size ? `${found.size} accessibility problem(s)` : "no accessibility problems found (axe, WCAG 2.1 AA)");
process.exit(found.size ? 1 : 0);
