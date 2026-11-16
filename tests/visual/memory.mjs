// FrameDecks 9.0 / 9.1 - Capture Chats (Memory Cards) in a browser, against a started program:
//   FRAMEDECKS_NO_UPDATE_CHECK=1 python src/server.py &   then   node tests/visual/memory.mjs [--shots DIR]
// 26.11.57: Capture Chats is a window opened from Engage › Memory Cards (26.11.49), and a card is what someone copied
// in a chat. The clipboard watcher is Windows-only, so a "copy" here is the same add the watcher makes (one line of chat
// text, "Name: message", becomes a card titled with the name). Covered: copied lines become cards and chat bubbles
// (Show, Pin, Hide, Delete; several selected and shown together), a typed note still works, the chat bubbles in the Studio preview (only bubbles: no window) in their three layouts (beside / below the
// picture, which shrinks out of their way, or over it), the OBS pages (only with "Also on the Share Window", always
// floating), the corner popup, the phone remote's Capture Memory, and accessibility (dark and light).
// Clipboard capture and the popup window itself are Windows-only: see docs/architecture/memory-cards.md.
import { createRequire } from "node:module";
import { keyHeaders, unlock } from "./local-key.mjs";   // 26.11.58 (release sign-off L2) the program's key

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = require.resolve("axe-core/axe.min.js");
const BASE = process.env.FRAMEDECKS_URL || "http://127.0.0.1:8750";
const shotsAt = process.argv.indexOf("--shots");
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : "";

let failed = 0;
function check(ok, what) { console.log((ok ? "ok    " : "FAIL  ") + what); if (!ok) failed++; }
async function copied(text) { return api({ action: "add", text }); }   // what the clipboard watcher hands over
async function api(body) {
  const r = await fetch(`${BASE}/api/memory`, { method: "POST", headers: { "Content-Type": "application/json", ...keyHeaders() }, body: JSON.stringify(body) });
  return r.json();
}
async function axe(p, where, tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"], off = []) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(([t, o]) => window.axe.run(document, { runOnly: { type: "tag", values: t },
    rules: Object.fromEntries(o.map((k) => [k, { enabled: false }])) }), [tags, off]);
  for (const v of r.violations) console.log(`      ${where}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  check(r.violations.length === 0, `no accessibility problems: ${where}`);
}

await api({ action: "clear", pinned: true });
await api({ action: "hideall" });
await api({ action: "settings", dur: 12, share: false, layout: "beside", side: "right", auto: true });

const browser = await chromium.launch();
const studio = await unlock(await browser.newPage({ viewport: { width: 1440, height: 900 }, bypassCSP: true }), BASE);
await studio.goto(`${BASE}/dashboard.html`);
await studio.waitForTimeout(2200);
await studio.evaluate(() => window.KCOnboarding && window.KCOnboarding.close());     // 9.5 the Welcome flow
await studio.waitForTimeout(600);
check(await studio.$("#lb-audience") === null && await studio.$("#mem-dlg #mem-pane") !== null, "no Audience Dock; Capture Chats is a window in the Studio");
async function openChats() {                              // Engage › Memory Cards, as a person does
  if (await studio.$eval("#mem-dlg", (d) => d.open)) return;
  await studio.click("#lc-engage");
  await studio.click('#lc-pop-engage [data-action="cards"]');
  await studio.waitForSelector("#mem-dlg[open]");
}
await openChats();
check(await studio.isVisible("#mem-capture") && await studio.isVisible("#mem-add-text"), "Engage › Memory Cards opens Capture Chats, with its Capture switch");

// a copied chat line becomes a card, in the window and in the chat overlay
const preview = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await preview.goto(`${BASE}/stage.html?bg=preview&preview=1`);
await preview.waitForTimeout(800);
await copied("Sarah Lee: How much does the course cost, and is there a discount?");
await studio.waitForSelector(".mem-card");
check((await studio.textContent(".mem-card .mem-title")).includes("Sarah Lee"), "the card has a title (who wrote it)");
await preview.waitForSelector(".chat-list:not(.out) .chat-msg");
check((await preview.textContent(".chat-msg .chat-name")) === "Sarah Lee", "the card is a chat bubble on screen");
check(await preview.$(".chatwin, .chat-bar, .chat-typing") === null, "only bubbles: no chat window, title bar or panel");
await preview.waitForFunction(() => getComputedStyle(document.querySelector(".stage-root")).transform.startsWith("matrix(0.7,"), null, { timeout: 3000 }).catch(() => {});
const beside = await preview.evaluate(() => ({ cls: document.documentElement.className, t: getComputedStyle(document.querySelector(".stage-root")).transform,
  chat: document.querySelector(".zone-chat").getBoundingClientRect().left }));
check(beside.cls.includes("mem-beside") && beside.t.startsWith("matrix(0.7"), "beside: the overlays shrink to 70 %");
check(await preview.evaluate(() => getComputedStyle(document.body).backgroundImage.includes("gradient") && getComputedStyle(document.querySelector(".stage-root")).backgroundImage === "none"),
  "beside: the video (the preview picture) keeps its size; the bubbles are on top of it");
check(beside.chat >= 1280 * 0.69, "beside: the chat overlay takes the right column");
if (SHOTS) { await preview.waitForTimeout(800); await preview.screenshot({ path: `${SHOTS}/memory-beside.png` }); }

// Show (full text), Pin, Hide
await studio.locator(".mem-card").first().getByRole("button", { name: "Show" }).click();
await preview.waitForSelector(".chat-msg.full");
check(true, "Show expands it to the full text");
await studio.locator(".mem-card").first().getByRole("button", { name: "Pin" }).click();
await preview.waitForSelector(".chat-msg.pinned");
check(await studio.$eval(".mem-card", (e) => e.classList.contains("pinned")), "Pin keeps it (gold edge in the pane and the overlay)");
await studio.fill("#mem-add-text", "The rollout plan has three phases: pilot, regional and national.");   // a typed note still works
await studio.press("#mem-add-text", "Enter");
await preview.waitForFunction(() => document.querySelectorAll(".chat-msg").length === 2);
check(await preview.$(".chat-msg.pop") !== null, "a new bubble pops open");
check(await preview.$$eval(".chat-msg .chat-name", (l) => l[0].textContent === "Sarah Lee" && l.length === 2), "in the order they were copied (newest at the foot)");

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
check(await obs.$(".chat-list") === null, "not on the OBS pages unless shared");
await api({ action: "settings", share: true });
await obs.waitForSelector(".chat-list:not(.out)");
check(await obs.$eval(".zone-chat", (z) => z.classList.contains("chat-over")), "shared: floating over the OBS page");
await api({ action: "settings", share: false });

// Hide, Esc in the Studio, Delete
await studio.locator(".mem-card.pinned").getByRole("button", { name: "Hide" }).click();
await studio.waitForFunction(() => !document.querySelector(".mem-card.pinned"));
check(true, "Hide takes a card out of the overlay (and unpins it)");
await studio.keyboard.press("Escape");                    // the first Esc closes the window...
await studio.waitForFunction(() => !document.getElementById("mem-dlg").open);
await studio.click("#canvas-wrap", { position: { x: 5, y: 5 } }).catch(() => {});
await studio.keyboard.press("Escape");                    // ...then Esc in the Studio is Hide all
await preview.waitForFunction(() => !document.querySelector(".chat-list:not(.out)"), null, { timeout: 5000 });
check(true, "Esc (Hide all) takes every bubble off screen");
// several selected, shown together in the order copied
await openChats();
const picks = studio.locator(".mem-card .mem-pick");
await picks.nth(0).check(); await picks.nth(1).check();
check(await studio.isVisible("#mem-sel") && (await studio.textContent("#mem-sel-show")) === "Show 2 together", "select several");
await studio.click("#mem-sel-show");
await preview.waitForFunction(() => document.querySelectorAll(".chat-list:not(.out) .chat-msg:not(.leave)").length === 2, null, { timeout: 5000 });
const order = await preview.$$eval(".chat-list:not(.out) .chat-msg:not(.leave) .chat-text", (l) => l.map((e) => e.textContent));
check(order[0].startsWith("How much") && order[1].startsWith("The rollout"), "shown together, the first copied at the top");
await studio.click("#mem-gear"); await studio.click("#mem-hideall"); await studio.click("#mem-gear");   // settings › Hide all bubbles
await preview.waitForFunction(() => !document.querySelector(".chat-list:not(.out)"), null, { timeout: 5000 });
const before = await studio.$$eval(".mem-card", (l) => l.length);
await studio.locator(".mem-card").first().getByRole("button", { name: "Delete" }).click();
await studio.waitForFunction((n) => document.querySelectorAll(".mem-card").length === n - 1, before);
check(true, "Delete removes a card");

// the corner popup page: the cards just copied, then it asks to be hidden
const pop = await unlock(await browser.newPage({ viewport: { width: 360, height: 300 }, bypassCSP: true }), BASE);
const asked = [];
await pop.route("**/api/app/popup", async (route) => { asked.push(JSON.parse(route.request().postData() || "{}").op); await route.fulfill({ json: { desktop: false } }); });
await pop.goto(`${BASE}/memory-popup.html`);
await copied("Tom: Is the recording shared afterwards?");
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

// the phone remote: paste a conversation, Show, Hide, Remove, several together
await api({ action: "hideall" });
// the phone remote opened on this PC itself (127.0.0.1) is one of the program's own pages here: it carries the key
const phone = await unlock(await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, bypassCSP: true }), BASE);
await phone.goto(`${BASE}/remote.html`);
await phone.waitForSelector("#app:not([hidden])");
await phone.click("#tab-engage");                 // 9.13 Capture Memory lives in the Engage chip
await phone.waitForSelector("#cm-text");
await phone.fill("#cm-text", "[10:40, 03/11/2026] Grace: Can we get the slides afterwards?\n[10:41, 03/11/2026] Mark: Yes please!");
await phone.click("#cm-go");
await preview.waitForFunction(() => [...document.querySelectorAll(".chat-list:not(.out) .chat-name")].map((e) => e.textContent).join("|") === "Grace|Mark", null, { timeout: 5000 });
check(true, "pasted on the phone: one bubble per message, on screen at once, in order");
await phone.waitForSelector(".cm-card.on");
check((await phone.locator(".cm-card").first().locator(".cm-meta").textContent()).startsWith("WhatsApp"), "the phone lists the cards with their app");
await phone.locator(".cm-card.on").first().getByRole("button", { name: "Hide" }).click();
await phone.waitForFunction(() => document.querySelectorAll(".cm-card.on").length === 1);
check(true, "Hide from the phone");
const nPhone = await phone.locator(".cm-card").count();
await phone.locator(".cm-card").first().getByRole("button", { name: /^Remove/ }).click();
await phone.waitForFunction((n) => document.querySelectorAll(".cm-card").length === n - 1, nPhone);
check(true, "Remove from the phone");
await phone.locator(".cm-card .cm-pick").nth(0).check(); await phone.locator(".cm-card .cm-pick").nth(1).check();
await phone.click("#cm-sel-show");
await phone.waitForFunction(() => document.querySelectorAll(".cm-card.on").length >= 2);
check(true, "several selected on the phone, shown together");
if (SHOTS) await phone.locator("#cm").screenshot({ path: `${SHOTS}/memory-phone.png` });
// the remote keeps its page zoom off (8.0: drawing with a finger), so axe's meta-viewport rule is left out
await axe(phone, "phone remote", ["wcag2a", "wcag2aa"], ["meta-viewport"]);
await api({ action: "hideall" });

for (const theme of ["dark", "light"]) {
  await studio.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await openChats();
  await studio.click("#mem-gear");
  if (SHOTS) await studio.locator("#mem-dlg").screenshot({ path: `${SHOTS}/memory-pane-${theme}.png` });
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
