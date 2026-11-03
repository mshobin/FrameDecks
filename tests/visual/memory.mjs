// FrameDecks 9.0 - Memory Cards in a browser, against a started program:
//   FRAMEDECKS_NO_UPDATE_CHECK=1 python src/server.py &   then   node tests/visual/memory.mjs [--shots DIR]
// The Studio's Memory Cards pane (a typed note becomes a card; Show, Pin, Hide, Delete), the chat overlay in the Studio
// preview in its three layouts (beside / below the picture, which shrinks out of its way, or over it), the OBS pages
// (only with "Also on the Share Window", always floating), the corner popup, and accessibility (dark and light).
// Clipboard capture and the popup window itself are Windows-only: see docs/architecture/memory-cards.md.
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
  const r = await fetch(`${BASE}/api/memory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
async function axe(p, where, tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate((t) => window.axe.run(document, { runOnly: { type: "tag", values: t } }), tags);
  for (const v of r.violations) console.log(`      ${where}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  check(r.violations.length === 0, `no accessibility problems: ${where}`);
}

await api({ action: "clear", pinned: true });
await api({ action: "hideall" });
await api({ action: "settings", dur: 12, share: false, layout: "beside", side: "right", auto: true });

const browser = await chromium.launch();
const studio = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await studio.goto(`${BASE}/dashboard.html`);
await studio.waitForTimeout(2200);
const fresh = studio.getByRole("button", { name: "Start fresh" });
if (await fresh.count()) await fresh.click();
check(await studio.$("#lb-audience") === null && await studio.$("#mem-pane") !== null, "no Audience Dock; a Memory Cards pane in the Studio");
if (await studio.$eval("#mem-pane", (e) => e.classList.contains("closed"))) await studio.click("#mem-fold");
check(await studio.isVisible("#mem-add-text"), "the pane opens");

// a typed note becomes a card, in the pane and in the chat overlay
const preview = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await preview.goto(`${BASE}/stage.html?bg=preview&preview=1`);
await preview.waitForTimeout(800);
await studio.fill("#mem-add-text", "Sarah Lee: How much does the course cost, and is there a discount?");
await studio.press("#mem-add-text", "Enter");
await studio.waitForSelector(".mem-card");
check((await studio.textContent(".mem-card .mem-title")).includes("Sarah Lee"), "the card has a title (who wrote it)");
await preview.waitForSelector(".chatwin:not(.out) .chat-msg");
check((await preview.textContent(".chat-msg .chat-name")) === "Sarah Lee", "the card is in the chat overlay");
await preview.waitForFunction(() => getComputedStyle(document.querySelector(".stage-root")).transform.startsWith("matrix(0.7,"), null, { timeout: 3000 }).catch(() => {});
const beside = await preview.evaluate(() => ({ cls: document.documentElement.className, t: getComputedStyle(document.querySelector(".stage-root")).transform,
  chat: document.querySelector(".zone-chat").getBoundingClientRect().left }));
check(beside.cls.includes("mem-beside") && beside.t.startsWith("matrix(0.7"), "beside: the rest of the picture shrinks to 70 %");
check(beside.chat >= 1280 * 0.69, "beside: the chat overlay takes the right column");
if (SHOTS) { await preview.waitForTimeout(800); await preview.screenshot({ path: `${SHOTS}/memory-beside.png` }); }

// Show (full text), Pin, Hide
await studio.locator(".mem-card").first().getByRole("button", { name: "Show" }).click();
await preview.waitForSelector(".chat-msg.full");
check(true, "Show expands it to the full text");
await studio.locator(".mem-card").first().getByRole("button", { name: "Pin" }).click();
await preview.waitForSelector(".chat-msg.pinned");
check(await studio.$eval(".mem-card", (e) => e.classList.contains("pinned")), "Pin keeps it (gold edge in the pane and the overlay)");
await studio.fill("#mem-add-text", "The rollout plan has three phases: pilot, regional and national.");
await studio.press("#mem-add-text", "Enter");
await preview.waitForFunction(() => document.querySelectorAll(".chat-msg").length === 2);
check(await preview.$(".chat-msg.arrive") !== null, "a new card arrives with typing dots, then its text");

// layouts
await api({ action: "settings", layout: "below" });
await preview.waitForFunction(() => document.documentElement.classList.contains("mem-below"));
const below = await preview.evaluate(() => document.querySelector(".zone-chat").getBoundingClientRect().top);
check(below >= 720 * 0.7, "below: the cards run along the bottom");
if (SHOTS) { await preview.waitForTimeout(800); await preview.screenshot({ path: `${SHOTS}/memory-below.png` }); }
await api({ action: "settings", layout: "over" });
await preview.waitForFunction(() => !document.documentElement.classList.contains("mem-below") && !document.documentElement.classList.contains("mem-beside"));
await preview.waitForTimeout(700);
check(await preview.evaluate(() => /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(getComputedStyle(document.querySelector(".stage-root")).transform)), "over: the picture keeps its size");
await api({ action: "settings", layout: "beside" });

// OBS pages: only when shared, and floating
const obs = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await obs.goto(`${BASE}/stage.html`);
await obs.waitForTimeout(1200);
check(await obs.$(".chatwin") === null, "not on the OBS pages unless shared");
await api({ action: "settings", share: true });
await obs.waitForSelector(".chatwin:not(.out)");
check(await obs.$eval(".zone-chat", (z) => z.classList.contains("chat-over")), "shared: floating over the OBS page");
await api({ action: "settings", share: false });

// Hide, Esc in the Studio, Delete
await studio.locator(".mem-card.pinned").getByRole("button", { name: "Hide" }).click();
await studio.waitForFunction(() => !document.querySelector(".mem-card.pinned"));
check(true, "Hide takes a card out of the overlay (and unpins it)");
await studio.click("#canvas-wrap", { position: { x: 5, y: 5 } }).catch(() => {});
await studio.keyboard.press("Escape");
await preview.waitForFunction(() => !document.querySelector(".chatwin:not(.out)"), null, { timeout: 5000 });
check(true, "Esc (Hide all) empties the chat overlay");
const before = await studio.$$eval(".mem-card", (l) => l.length);
await studio.locator(".mem-card").first().getByRole("button", { name: "Delete" }).click();
await studio.waitForFunction((n) => document.querySelectorAll(".mem-card").length === n - 1, before);
check(true, "Delete removes a card");

// the corner popup page: the cards just copied, then it asks to be hidden
const pop = await browser.newPage({ viewport: { width: 360, height: 300 } });
const asked = [];
await pop.route("**/api/app/popup", async (route) => { asked.push(JSON.parse(route.request().postData() || "{}").op); await route.fulfill({ json: { desktop: false } }); });
await pop.goto(`${BASE}/memory-popup.html`);
await api({ action: "add", text: "Tom: Is the recording shared afterwards?" });
await pop.waitForSelector(".pop .mem-card");
check((await pop.textContent(".pop .mem-card .mem-title")) === "Tom", "the popup shows the card just copied");
await pop.hover(".pop");                                   // the pointer on it keeps the cards there
check(await pop.getByRole("button", { name: "Show" }).count() > 0 && await pop.getByRole("button", { name: "Pin" }).count() > 0, "with Show and Pin");
if (SHOTS) await pop.screenshot({ path: `${SHOTS}/memory-popup.png` });
await axe(pop, "popup", ["wcag2a", "wcag2aa"]);
for (let i = 0; i < 8 && await pop.getByRole("button", { name: "Close" }).count(); i++) {
  await pop.getByRole("button", { name: "Close" }).first().click();
  await pop.waitForTimeout(150);
}
check(asked.includes("hide"), "closing the last card hides the popup");

for (const theme of ["dark", "light"]) {
  await studio.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await studio.click("#mem-gear");
  if (SHOTS) await studio.locator(".ws-left").screenshot({ path: `${SHOTS}/memory-pane-${theme}.png` });
  await studio.addScriptTag({ path: AXE });
  const r = await studio.evaluate(() => window.axe.run(document.getElementById("mem-pane"), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
  for (const v of r.violations) console.log(`      ${theme}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  check(r.violations.length === 0, `no accessibility problems in the pane (${theme})`);
  await studio.click("#mem-gear");
}

await api({ action: "clear", pinned: true });
await api({ action: "hideall" });
await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
