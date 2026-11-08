// Visual regression checks for the desktop program (design audit DD-26), run against a started program:
//   FRAMEDECKS_NO_UPDATE_CHECK=1 python src/server.py &   then   node tests/visual/layout.mjs [--shots]
// Layout facts, not pixel comparisons, so a different font build on another machine cannot make them fail. With --shots
// the screens are also saved to tests/visual/out/ to compare by eye with tests/visual/baselines/.
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
  // 8.9 Safe Next (26.11.13: in the column beside the picture): never over the Frame preview, and names the next Frame
  const un = await p.evaluate(() => {
    const box = document.getElementById("upnext"), prog = document.getElementById("program");
    if (!box || box.hidden || !box.offsetParent) return { shown: false };
    const a = box.getBoundingClientRect(), b = prog.getBoundingClientRect();
    const apart = a.left >= b.right - 1 || a.top >= b.bottom - 1 || a.right <= b.left + 1 || a.bottom <= b.top + 1;
    return { shown: true, below: apart, name: document.getElementById("un-name").textContent.trim(),
      next: document.getElementById("lb-next").title };
  });
  if (un.shown) {
    check(un.below, "Up next sits beside or under the Frame preview, not over it");
    check(!!un.name && un.next.includes(un.name), `Up next names the Frame Next will show (${un.name})`);
  } else check(true, "Up next is hidden when there is no next Frame");
  await shot(p, "studio");
  await p.close();
}

// 3. First run (9.5): the Welcome flow fills the window, its first page's title has the focus, the window behind waits,
//    and an earlier version's data is offered on its last page
{
  const p = await page(1440, 860, async (pg) => {
    await pg.route("**/api/app/info", async (route) => {
      const res = await route.fetch();
      const info = await res.json();
      info.migration = { needed: true, candidates: [{ folder: "C:\\Users\\Pat\\Desktop\\FrameDecks data", members: 3 }] };
      await route.fulfill({ response: res, json: info });
    });
  });
  const first = await p.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), open: window.KCOnboarding.isOpen(),
    behind: document.querySelector(".ws")?.closest("[inert]") !== null, full: (() => { const r = document.getElementById("onb").getBoundingClientRect(); return r.width === innerWidth && r.height === innerHeight; })() }));
  check(first.open && first.full && first.behind && first.text === "Frames, Decks and Content",
    `first run: the Welcome flow, full screen, focus on its title, the window behind waits (${JSON.stringify(first)})`);
  await shot(p, "first-run");
  const pages = await p.evaluate(() => window.KCOnboarding.pages.length);      // 9.7: five pages (Going live)
  for (let i = 0; i < pages - 1; i++) { await p.click("#onb-next"); await p.waitForTimeout(400); }
  check(await p.locator("#onb-import").isVisible(), "its last page offers the earlier version's data");
  await p.keyboard.press("Escape");
  check(await p.evaluate(() => window.KCOnboarding.isOpen()), "Escape never closes it by accident (Skip does)");
  await p.evaluate(() => window.KCOnboarding.close());
  await p.close();
}

// 4. The Teleprompter (8.0: one overlay window): the script fills it, the top bar is hidden until asked for
{
  const p = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  await p.goto(`${BASE}/speaker.html`);
  await p.mouse.move(500, 500);                 // the pointer away from the top edge
  await p.waitForTimeout(800);
  // 8.2: the window shows only the words; every control, Write Script included, is in the top bar
  const inPreview = await p.locator("#sp-prompt button, #sp-prompt select, #sp-prompt .tp-cues").count();
  check(inPreview === 0, `nothing but the script in the Teleprompter's window (${inPreview} controls found)`);
  check(await p.locator("#sp-top #sp-write").count() === 1 && await p.locator("#sp-top .tp-play").count() === 1, "Write Script and Scroll are in the top bar");
  const hidden = await p.locator("#sp-top").evaluate((el) => getComputedStyle(el).opacity === "0");
  check(hidden, "the Teleprompter's top bar is hidden at first");
  await p.click("#sp-bar-btn");
  await p.waitForTimeout(300);
  const shown = await p.locator("#sp-top").evaluate((el) => getComputedStyle(el).opacity === "1");
  check(shown, "the bar button shows the top bar (time, Frame, timer)");
  await p.click("#sp-bar-pin");
  await p.mouse.move(500, 500);
  await p.waitForTimeout(300);
  const again = await p.locator("#sp-top").evaluate((el) => getComputedStyle(el).opacity === "0");
  check(again, "Hide bar hides the top bar again");
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

// 6. The Studio (8.0: one Studio, no Run): the Frame editor is simple with one Advanced section; Hide all is calm
//    while nothing is on screen; Esc closes Live tools without hiding everything; the bar fits at 1440 px
{
  const p = await page(1440);
  await p.evaluate(() => { document.querySelectorAll(".app-modal-back").forEach((m) => m.remove()); if (window.KCOnboarding) window.KCOnboarding.close(); window.KCSetTab("studio"); });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({
    modes: !!document.getElementById("mode-switch"),
    scroll: document.documentElement.scrollWidth > innerWidth, onAir: document.body.classList.contains("kc-on-air"),
    hide: getComputedStyle(document.querySelector('[data-cb="hideAll"]')).backgroundColor,
    decks: document.getElementById("layers-title").textContent,
  }));
  check(!r.modes, "there is no Prepare / Run switch");
  check(r.decks === "Decks", `the section under the Frames is called Decks (${r.decks})`);
  check(!r.scroll, "the command bar fits at 1440 px");
  check(r.onAir || !/220, 38, 38/.test(r.hide), `Hide all is calm while nothing is on screen (${r.hide})`);
  await p.click("#lc-control");
  check(await p.evaluate(() => !document.getElementById("lc-pop-control").hidden), "the Control chip opens its panel");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  check(!(await p.evaluate(() => document.querySelector(".lc-wrap.open"))), "Esc closes the open chip");
  await shot(p, "studio");
  await p.close();
}

// 26.11.2 the top bars fit their window at every size (js/bar-fit.js): live, with the question stepper and the window
// buttons, the main bar stays one row from 1280 px up and never runs past the window; the Teleprompter keeps its window
// buttons on the first row at any width
{
  const p = await page(1920, 900, null);
  await p.evaluate(() => { window.KCOnboarding && window.KCOnboarding.close(); document.documentElement.classList.add("win-chrome");
    document.querySelectorAll("[data-win-controls]").forEach((e) => window.KCWindow.mount(e));
    KCStore.update((n) => KCScenes.take(n, n.scenes.filter((x) => !x.tpl)[0].id)); });
  await p.waitForTimeout(600);
  for (const w of [2560, 1920, 1600, 1366, 1280, 1100]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(250);
    const r = await p.evaluate(() => { const bar = document.querySelector(".cmdbar");
      return { fit: bar.dataset.fit, fits: window.KCBarFit.fits(bar), scroll: document.documentElement.scrollWidth > innerWidth,
        ctl: document.querySelector("[data-win-controls]").getBoundingClientRect().right <= innerWidth + 1 }; });
    check(!r.scroll && r.ctl && (w < 1280 || (r.fits && r.fit !== "6")), `top bar fits at ${w} px (level ${r.fit})`);
  }
  await p.close();
  const t = await browser.newPage({ viewport: { width: 1280, height: 600 } });
  await t.goto(`${BASE}/speaker.html`); await t.waitForTimeout(1200);
  await t.evaluate(() => { document.body.classList.add("sp-bar-open"); document.documentElement.classList.add("win-chrome");
    document.querySelectorAll("[data-win-controls]").forEach((e) => window.KCWindow.mount(e));
    ["sp-look", "sp-pin", "sp-voice-wrap"].forEach((id) => { document.getElementById(id).hidden = false; }); });
  for (const w of [1920, 1280, 1024, 760, 600]) {
    await t.setViewportSize({ width: w, height: 600 }); await t.waitForTimeout(250);
    const r = await t.evaluate(() => { const c = document.querySelector("[data-win-controls]").getBoundingClientRect(), f = document.querySelector(".sp-clock").getBoundingClientRect();
      return { scroll: document.documentElement.scrollWidth > innerWidth, row1: Math.abs(c.top - f.top) < 24 && c.right <= innerWidth + 1,
        fit: [...document.querySelectorAll(".sp-row")].map((x) => x.dataset.fit).join("/") }; });
    check(!r.scroll && r.row1, `Teleprompter bar fits at ${w} px, window buttons on the first row (levels ${r.fit})`);
  }
  await t.close();
}

// 26.11.2 the content area under the preview: every deck fits without the page scrolling, and the preview and the
// list point at each other (a click on a card lights its item; an item gives its card an outline; live words are a draft)
{
  for (const [w, hh] of [[1366, 768], [1920, 1080]]) {
    const p = await browser.newPage({ viewport: { width: w, height: hh } });
    await p.goto(`${BASE}/dashboard.html`); await p.waitForTimeout(2200);
    await p.evaluate(() => window.KCOnboarding && window.KCOnboarding.close()); await p.waitForTimeout(400);
    const picks = await p.evaluate(() => { const o = {}; for (const s of KCStore.get().scenes.filter((x) => !x.tpl)) { if (!o.frame) o.frame = [s.id, null]; for (const l of s.layers || []) if (!o[l.kind]) o[l.kind] = [s.id, l.id]; } return o; });
    for (const k of ["frame", "birthday", "question", "scripture"]) {
      if (!picks[k]) continue;
      await p.evaluate((x) => KCWorkspace.select(x[0], x[1]), picks[k]); await p.waitForTimeout(350);
      const r = await p.evaluate(() => { const b = document.getElementById("insp-body"), kids = [...b.children].filter((e) => getComputedStyle(e).display !== "none");
        return { page: document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth, body: b.scrollHeight > b.clientHeight + 1,
          empty: kids.some((e) => e.getBoundingClientRect().height < 1) }; });
      check(!r.page && !r.body && !r.empty, `content area: ${k} fits at ${w} px without scrolling`);
    }
    if (w === 1366) {
      await p.evaluate((x) => KCWorkspace.select(x[0], null), picks.frame); await p.waitForTimeout(350);
      const at = await p.evaluate(() => { const f = document.getElementById("program-frame"), r = f.getBoundingClientRect(), s = r.width / 1920;
        const c = f.contentDocument.querySelector(".card-question:not(.out)"); if (!c) return null; const b = c.getBoundingClientRect(); return { x: r.left + (b.left + b.width / 2) * s, y: r.top + (b.top + b.height / 2) * s }; });
      if (at) {
        await p.mouse.click(at.x, at.y); await p.waitForTimeout(250);
        check(await p.evaluate(() => !!document.querySelector("#fl-question .fl-ping")), "a click on a card in the preview lights up its item in the list");
        await p.click("#fl-question li.item:nth-child(2) .num"); await p.waitForTimeout(500);
        check(await p.evaluate(() => !!document.querySelector(".pv-outline.on")), "choosing an item outlines its card on the preview");
        await p.evaluate((s) => KCStore.update((n) => KCScenes.take(n, s)), picks.frame[0]); await p.waitForTimeout(900);
        const at2 = await p.evaluate(() => { const f = document.getElementById("program-frame"), r = f.getBoundingClientRect(), s = r.width / 1920;
          const c = f.contentDocument.querySelector(".card-question:not(.out)"); const b = c.getBoundingClientRect(); return { x: r.left + (b.left + b.width / 2) * s, y: r.top + (b.top + b.height * .7) * s }; });
        const before = await p.evaluate(() => KCStore.get().question.text);
        await p.mouse.dblclick(at2.x, at2.y); await p.waitForTimeout(300);
        await p.keyboard.press("End"); await p.keyboard.type(" now"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
        const mid = await p.evaluate(() => ({ text: KCStore.get().question.text, open: !!document.querySelector(".pv-ed.ef-draft.ef-armed") }));
        await p.keyboard.press("Enter"); await p.waitForTimeout(800);
        const after = await p.evaluate(() => KCStore.get().question.text);
        check(mid.open && mid.text === before && after === before + " now", "live words are a draft: the first Enter keeps the screen, the second updates it");
      }
    }
    await p.close();
  }
}

await browser.close();
console.log(failed ? `${failed} visual check(s) failed` : "all visual checks passed");
process.exit(failed ? 1 : 0);
