// Visual regression checks for the desktop program (design audit DD-26), run against a started program:
//   FRAMEDECKS_NO_UPDATE_CHECK=1 python server.py &   then   node tests/visual/layout.mjs [--shots]
// Layout facts, not pixel comparisons, so a different font build on another machine cannot make them fail. With --shots
// the screens are also saved to tests/visual/out/ to compare by eye with docs/design/baselines/.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.FRAMEDECKS_URL || "http://127.0.0.1:8750";
const SHOTS = process.argv.includes("--shots");
const OUT = new URL("./out/", import.meta.url);
if (SHOTS) mkdirSync(OUT, { recursive: true });

let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed++;
};

const browser = await chromium.launch();
async function page(width, height = 860, setup) {
  const p = await browser.newPage({ viewport: { width, height } });
  if (setup) await setup(p);
  await p.goto(`${BASE}/dashboard.html`);
  await p.waitForTimeout(2200);
  return p;
}
const shot = async (p, name) => SHOTS && p.screenshot({ path: new URL(`${name}.png`, OUT).pathname });

// 1. The command bar fits at every width: no sideways scroll, no control cut short (DD-13)
for (const w of [1920, 1440, 1280, 1100]) {
  const p = await page(w);
  const r = await p.evaluate(() => {
    const cut = [...document.querySelectorAll(".cmdbar .cb-btn, .cmdbar .sys-sum, .cmdbar .live-ind")]
      .filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map((e) => e.id || e.className);
    return { scroll: document.documentElement.scrollWidth > innerWidth, cut };
  });
  check(!r.scroll && r.cut.length === 0, `command bar fits at ${w} px${r.cut.length ? " (cut: " + r.cut.join(", ") + ")" : ""}`);
  await shot(p, `bar-${w}`);
  await p.close();
}

// 2. Nothing covers the Studio canvas while the camera picture is not in use (DD-02)
{
  const p = await page(1440);
  const r = await p.evaluate(() => {
    const host = document.getElementById("tab-studio"), program = document.getElementById("program");
    return { hostShown: !!host && !host.hidden && getComputedStyle(host).display !== "none", programShown: !!program && !program.hidden };
  });
  check(!(r.hostShown && r.programShown), "the camera-picture panel never sits over the Frame preview");
  await shot(p, "studio");
  await p.close();
}

// 3. First run with nothing found: Start fresh is the focused, main choice (DD-03)
{
  const p = await page(1440, 860, async (pg) => {
    await pg.route("**/api/app/info", async (route) => {
      const res = await route.fetch();
      const info = await res.json();
      info.migration = { needed: true, candidates: [] };
      await route.fulfill({ response: res, json: info });
    });
  });
  const focused = await p.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), primary: document.activeElement?.classList.contains("primary") }));
  check(focused.text === "Start fresh" && focused.primary, `first run focuses Start fresh (got "${focused.text}")`);
  await shot(p, "first-run");
  await p.close();
}

// 4. The Teleprompter without a script: one message and one action (DD-02)
{
  const p = await page(1440);
  await p.evaluate(() => document.getElementById("lb-prompter")?.click());
  await p.waitForTimeout(800);
  const n = await p.locator(".tp-empty-act").count();
  check(n >= 1, "the Teleprompter's empty state offers Write a script");
  await shot(p, "teleprompter");
  await p.close();
}

// 5. Settings: the menu lines up with the page title, and headings use the interface typeface (DD-21, DD-04)
{
  const p = await page(1440);
  await p.evaluate(() => window.KCSetTab && window.KCSetTab("settings"));
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const nav = document.getElementById("s-nav"), title = document.querySelector(".s-sec:not([hidden]) .s-head h2");
    return { gap: Math.abs(nav.getBoundingClientRect().top - title.getBoundingClientRect().top), font: getComputedStyle(title).fontFamily };
  });
  check(r.gap <= 6, `the Settings menu lines up with the title (off by ${Math.round(r.gap)} px)`);
  check(!/serif/i.test(r.font.split(",")[0]) && /KC Sans/.test(r.font), `Settings headings use the interface typeface (${r.font.split(",")[0]})`);
  await shot(p, "settings");
  await p.close();
}

await browser.close();
console.log(failed ? `${failed} visual check(s) failed` : "all visual checks passed");
process.exit(failed ? 1 : 0);
