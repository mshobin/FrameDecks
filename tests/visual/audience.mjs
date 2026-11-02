// FrameDecks 8.8 - the Audience Dock in a browser, against a started program:
//   FRAMEDECKS_NO_UPDATE_CHECK=1 python src/server.py &   then   node tests/visual/audience.mjs [--shots DIR]
// Typed questions become cards (with the notice), Show puts the card on the Studio preview with a countdown line and
// leaves it off the overlay pages until "Also show on Share Window" is on; Pin keeps it, Hide and Esc clear it,
// edits follow on screen, Delete removes it. Also scans the dock with axe (WCAG 2.1 AA), dark and light.
// The Windows-only parts (clipboard, click-through, Ctrl+Shift) are on the testing checklist in
// docs/architecture/audience-dock.md.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = require.resolve("axe-core/axe.min.js");
const BASE = process.env.FRAMEDECKS_URL || "http://127.0.0.1:8750";
const shotsAt = process.argv.indexOf("--shots");
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : "";

let failed = 0;
function check(ok, what) { console.log((ok ? "ok    " : "FAIL  ") + what); if (!ok) failed++; }
async function api(body) {
  const r = await fetch(`${BASE}/api/audience`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

await api({ action: "clear" });
await api({ action: "hide" });
await api({ action: "settings", dur: 12, share: false });

const browser = await chromium.launch();
const dock = await browser.newPage({ viewport: { width: 340, height: 640 } });
await dock.goto(`${BASE}/audience.html`);
await dock.waitForSelector("#dk-empty:not([hidden])");
check(await dock.isVisible("#dk-empty"), "an empty queue says how to capture");

// typed questions (the same path as a copy, without the clipboard)
await dock.fill("#dk-add-text", "Sarah: How much does it cost?");
await dock.press("#dk-add-text", "Enter");
await dock.waitForSelector(".dk-card");
check((await dock.textContent("#dk-notice")).includes("Audience Question Captured"), "the notice says the question was captured");
check(await dock.$eval(".dk-card .dk-name", (e) => e.value) === "Sarah", "the sender is read from \"Name: message\"");
await dock.fill("#dk-add-text", "Will the slides be shared?");
await dock.press("#dk-add-text", "Enter");
await dock.waitForFunction(() => document.querySelectorAll(".dk-card").length === 2);
check(await dock.$eval(".dk-card", (e) => e.classList.contains("dk-new")), "a new card slides into the queue");
await dock.fill("#dk-add-text", "will the slides be shared");
await dock.press("#dk-add-text", "Enter");
await dock.waitForFunction(() => document.querySelector("#dk-notice").textContent.includes("Already"));
check(await dock.$$eval(".dk-card", (l) => l.length) === 2, "a repeated question is not added twice");
if (SHOTS) await dock.screenshot({ path: `${SHOTS}/audience-dock-queue.png` });

// Show: Currently live, the Studio preview, not the overlay pages
await dock.locator(".dk-card").nth(1).locator(".dk-show").click();
await dock.waitForSelector("#dk-live:not([hidden])");
check((await dock.textContent("#dk-live-name")) === "Sarah", "Currently live shows the card");
check(await dock.isVisible("#dk-count"), "a timed card has its countdown line");
const preview = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await preview.goto(`${BASE}/stage.html?preview=1`);
await preview.waitForSelector(".chatwin:not(.out)", { timeout: 5000 });
check((await preview.textContent(".chatwin .chat-text")).includes("How much does it cost?"), "the Studio preview shows the card");
check(await preview.isVisible(".chatwin .aud-timer"), "with a countdown line");
check(await preview.$eval(".zone-chat", (z) => { const r = z.firstElementChild.getBoundingClientRect(); return r.left > innerWidth * 0.55 && r.bottom < innerHeight * 0.75; }), "the chat window sits at the right edge, clear of the bottom cards");
check(await preview.$(".chatwin .chat-typing") !== null && (await preview.textContent(".chatwin .chat-av")) === "S", "it has typing dots and the sender's initials");
if (SHOTS) { await preview.waitForTimeout(600); await preview.screenshot({ path: `${SHOTS}/audience-card.png` }); }
const stage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await stage.goto(`${BASE}/stage.html`);
await stage.waitForTimeout(1500);
check(await stage.$(".chatwin") === null, "not on the overlay pages unless \"Also show on Share Window\"");
await api({ action: "settings", share: true });
await stage.waitForSelector(".chatwin:not(.out)", { timeout: 5000 });
check(true, "\"Also show on Share Window\" puts it on the overlay pages");

// edit follows on screen; Pin; Hide; Esc
await dock.locator(".dk-card").nth(1).locator(".dk-text").fill("How much does the course cost?");
await dock.locator(".dk-card").nth(1).locator(".dk-text").press("Enter");
await preview.waitForFunction(() => (document.querySelector(".chatwin:not(.out) .chat-text") || {}).textContent === "How much does the course cost?");
check(true, "an edit follows on screen");
await dock.locator(".dk-card").nth(0).locator(".dk-pin").click();
await dock.waitForFunction(() => !document.querySelector("#dk-pinned").hidden);
check((await dock.textContent("#dk-live-text")).includes("slides"), "a new card replaces the one on screen");
await preview.waitForFunction(() => { const c = document.querySelector(".chatwin:not(.out)"); return c && c.textContent.includes("slides"); });
check(await preview.$eval(".chatwin:not(.out) .aud-timer", (e) => e.hidden), "a pinned card has no countdown");
await dock.click("#dk-hide");
await preview.waitForFunction(() => !document.querySelector(".chatwin:not(.out)"));
check(await dock.isHidden("#dk-live"), "Hide takes it off screen");
await dock.locator(".dk-card").nth(0).locator(".dk-show").click();
await preview.waitForSelector(".chatwin:not(.out)");
await dock.locator("h2.dk-qh").click();
await dock.keyboard.press("Escape");
await preview.waitForFunction(() => !document.querySelector(".chatwin:not(.out)"));
check(true, "Esc in the dock hides it");

// a short timer runs out by itself
await api({ action: "settings", dur: 3 });
await dock.locator(".dk-card").nth(0).locator(".dk-show").click();
await preview.waitForSelector(".chatwin:not(.out)");
await preview.waitForFunction(() => !document.querySelector(".chatwin:not(.out)"), null, { timeout: 7000 });
check(true, "a timed card fades out after its seconds");
await api({ action: "settings", dur: 12, share: false });

// Delete
await dock.locator(".dk-card").nth(0).locator(".dk-del").click();
await dock.waitForFunction(() => document.querySelectorAll(".dk-card").length === 1);
check(true, "Delete removes a card");

// accessibility, dark and light
for (const theme of ["dark", "light"]) {
  await dock.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await dock.click("#dk-gear");
  await dock.addScriptTag({ path: AXE });
  const r = await dock.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
  for (const v of r.violations) console.log(`      ${theme}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  check(r.violations.length === 0, `no accessibility problems in the dock (${theme})`);
  if (SHOTS) await dock.screenshot({ path: `${SHOTS}/audience-dock-settings-${theme}.png` });
  await dock.click("#dk-gear");
}
const handle = await browser.newPage({ viewport: { width: 184, height: 30 } });
await handle.goto(`${BASE}/audience-handle.html`);
await handle.addScriptTag({ path: AXE });
const hr = await handle.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }));
check(hr.violations.length === 0, "no accessibility problems in the handle");
if (SHOTS) await handle.screenshot({ path: `${SHOTS}/audience-handle.png` });

await api({ action: "clear" });
await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
