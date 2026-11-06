// 26.11 the whole program on an older 4 GB PC: every window, tab, chip and panel, with a large meeting (40 Frames),
// the processor slowed 4x and nothing drawn by the graphics card (as "Light on graphics card" runs the app window).
// For each screen it records how busy the processor is at rest, the slowest frame, the JavaScript memory and the
// number of elements on the page; then it opens and closes everything 15 times and checks that memory comes back
// (no leaks), and reads the program's own memory (the Python server). It fails above the budget below.
// Run against a started program with a fresh data folder:
//   KC_DATA_DIR=$(mktemp -d) FRAMEDECKS_NO_UPDATE_CHECK=1 python src/server.py --no-browser &   then   node tests/visual/perf-4gb.mjs
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
const require = createRequire(process.cwd() + "/tests/visual/x.js");
const { chromium } = require("playwright");
const B = "http://127.0.0.1:8750", SLOW = Number(process.env.SLOW || 4);
const BUDGET = { idleBusyPct: 15, heapMB: 40, elements: 6000, worstFrameMs: 250, leakMB: 2, serverMB: 260 };
const b = await chromium.launch({ args: ["--disable-gpu", "--disable-gpu-compositing", "--disable-gpu-rasterization"] });
const rows = [], fail = [];

async function open(url, w, h, ready) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  p.on("pageerror", (e) => fail.push(`${url}: script error ${e.message}`));
  await cdp.send("Performance.enable"); await cdp.send("Emulation.setCPUThrottlingRate", { rate: SLOW });
  await p.goto(B + url); if (ready) await ready(p); await p.waitForTimeout(1500);
  return { p, cdp, ctx };
}
async function metrics(cdp) { const o = {}; for (const x of (await cdp.send("Performance.getMetrics")).metrics) o[x.name] = x.value; return o; }
async function measure({ p, cdp }, label, ms, action, kind = "idle") {
  if (action) { await action(); await p.waitForTimeout(400); }
  await p.evaluate(() => { window.__fr = []; let last = performance.now(); (function f(t){ window.__fr.push(t - last); last = t; window.__raf = requestAnimationFrame(f); })(last); });
  const a = await metrics(cdp); await p.waitForTimeout(ms); const z = await metrics(cdp);
  const fr = await p.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__fr.slice(1); });
  const elements = await p.evaluate(() => document.getElementsByTagName("*").length);   // live elements on the page
  const row = { label, busyPct: Math.round((z.TaskDuration - a.TaskDuration) / (ms / 1000) * 100), worstFrameMs: Math.round(Math.max(0, ...fr)),
    heapMB: +(z.JSHeapUsedSize / 1048576).toFixed(1), elements, listeners: z.JSEventListeners, kind };
  rows.push(row); console.log(JSON.stringify(row));
  return row;
}
async function heapAfterGC({ p, cdp }) {
  await cdp.send("HeapProfiler.enable"); await cdp.send("HeapProfiler.collectGarbage"); await p.waitForTimeout(300); await cdp.send("HeapProfiler.collectGarbage");
  return (await metrics(cdp)).JSHeapUsedSize / 1048576;
}
async function leak(page, label, cycle, times = 15) {
  await cycle(); const before = await heapAfterGC(page);
  for (let i = 0; i < times; i++) await cycle();
  const after = await heapAfterGC(page), grew = +(after - before).toFixed(2);
  const elements = await page.p.evaluate(() => document.getElementsByTagName("*").length);
  console.log(JSON.stringify({ leak: label, before: +before.toFixed(1), after: +after.toFixed(1), grewMB: grew, elements }));
  if (grew > BUDGET.leakMB) fail.push(`${label}: memory grew ${grew} MB over ${times} rounds`);
}
function serverMB() {
  // the Python server's resident memory (Linux /proc; the Windows app is similar or lower)
  for (const pid of readdirSync("/proc").filter((x) => /^\d+$/.test(x))) {
    try {
      const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8");
      if (cmd.startsWith("python") && cmd.includes("src/server.py")) return Math.round(+/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, "utf8"))[1] / 1024);
    } catch { /* gone */ }
  }
  return 0;
}

// ---------- the main window, with a large meeting ----------
const main = await open("/dashboard.html", 1366, 768, (p) => p.waitForSelector("#onb.in", { timeout: 20000 }));
main.p.setDefaultTimeout(15000);
await main.p.evaluate(() => window.KCOnboarding.close()); await main.p.waitForTimeout(800);
await main.p.evaluate(() => KCStore.update((n) => {                                   // 40 Frames, long scripts, many questions
  const base = n.scenes.filter((s) => !s.tpl), out = [];
  for (let i = 0; out.length + base.length < 40; i++) {
    const c = JSON.parse(JSON.stringify(base[i % base.length])), tag = "p" + i;
    c.id = c.id + tag; c.name = "Frame " + (i + 1) + " · " + c.name; c.notes = ("Welcome everyone. We are going to read together tonight. ").repeat(30);
    (c.layers || []).forEach((l) => { l.id = l.id + tag; if (l.c && Array.isArray(l.c.items)) l.c.items = Array.from({ length: 12 }, (_, k) => Object.assign({}, l.c.items[0] || {}, { id: "it" + tag + k, text: "Question " + (k + 1) + ": what does this passage teach us about faith?" })); });
    out.push(c);
  }
  n.scenes = n.scenes.concat(out);
}));
await main.p.waitForTimeout(2500);
await measure(main, "studio idle (40 Frames)", 5000);
await measure(main, "studio: select a Frame", 2000, () => main.p.evaluate(() => { const s = KCStore.get().scenes.filter((x) => !x.tpl); KCWorkspace.select(s[20].id); }), "action");
await measure(main, "studio: Go Live", 2000, () => main.p.evaluate(() => KCStore.update((n) => { window.KCScenes.take(n, n.scenes.filter((x) => !x.tpl)[3].id); })), "action");
await measure(main, "studio live idle", 5000);
for (const c of ["prepare", "engage", "control", "notes", "more"])
  await measure(main, "top bar chip: " + c, 1500, () => main.p.evaluate((id) => window.KCChipBar.open(id), c), "action");
await main.p.evaluate(() => window.KCChipBar.close());
await measure(main, "command palette open", 1500, () => main.p.keyboard.press("Control+k"), "action");
await main.p.keyboard.type("frame 3"); await main.p.waitForTimeout(500);
await main.p.keyboard.press("Escape");
await measure(main, "members", 2000, () => main.p.evaluate(() => window.KCSetTab("members")), "action");
await measure(main, "settings", 2000, () => main.p.evaluate(() => window.KCSetTab("settings")), "action");
for (const g of ["look", "content", "screens", "controls", "workspace", "data"])
  await measure(main, "settings: " + g, 1200, () => main.p.click(`#s-nav [data-sgroup="${g}"]`), "action");
await measure(main, "settings idle", 4000);
await main.p.evaluate(() => window.KCSetTab("studio")); await main.p.waitForTimeout(800);
const mainMem = await heapAfterGC(main);
console.log(JSON.stringify({ mainWindowHeapAfterGC: +mainMem.toFixed(1) }));

await leak(main, "main window: tabs, chips and palette", async () => {
  await main.p.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const t of ["members", "settings", "studio"]) { window.KCSetTab(t); await w(120); }
    for (const c of ["prepare", "engage", "control", "notes", "more"]) { window.KCChipBar.open(c); await w(60); }
    window.KCChipBar.close(); window.KCPalette.open(); await w(80); window.KCPalette.close(); await w(60);
  });
});
await leak(main, "main window: moving through 40 Frames", async () => {
  await main.p.evaluate(async () => {
    const s = KCStore.get().scenes.filter((x) => !x.tpl);
    for (let i = 0; i < 8; i++) { KCWorkspace.select(s[(i * 5) % s.length].id); await new Promise((r) => setTimeout(r, 40)); }
  });
});

// ---------- the other windows ----------
const tp = await open("/speaker.html", 900, 600, (p) => p.waitForSelector("#sp-prompt"));
await measure(tp, "teleprompter idle", 4000);
await measure(tp, "teleprompter scrolling", 3000, () => tp.p.evaluate(() => document.querySelector(".tp-play").click()), "busy");
await tp.p.evaluate(() => document.querySelector(".tp-play").click());

const cc = await open("/spotlight.html", 820, 720, (p) => p.waitForSelector(".cc-handle"));
await measure(cc, "command center idle", 4000);
await cc.p.click(".cc-handle"); await cc.p.waitForTimeout(400);
for (const g of ["prepare", "engage", "control", "notes", "more"]) await measure(cc, "command center: " + g, 1200, () => cc.p.click("#cc-g-" + g), "action");
await leak(cc, "command center: chips", async () => { for (const g of ["prepare", "engage", "control", "notes", "more"]) { await cc.p.click("#cc-g-" + g); await cc.p.waitForTimeout(150); } });

const rem = await open("/remote.html", 390, 844, (p) => p.waitForSelector("#app:not([hidden])"));
await measure(rem, "phone remote idle", 4000);
for (const t of ["prepare", "engage", "notes", "more", "control"]) await measure(rem, "phone remote: " + t, 1200, () => rem.p.click("#tab-" + t), "action");
await leak(rem, "phone remote: chips", async () => { for (const t of ["prepare", "engage", "notes", "more", "control"]) { await rem.p.click("#tab-" + t); await rem.p.waitForTimeout(120); } });

const share = await open("/present.html", 1280, 720);
await measure(share, "share window idle (live)", 4000);
for (const pg of ["/stage.html", "/focus-verse.html", "/discussion-question.html", "/birthday.html"]) {
  const o = await open(pg, 1280, 720); await measure(o, "overlay page " + pg, 3000); await o.ctx.close();
}

// ---------- the program itself ----------
const mb = serverMB();
console.log(JSON.stringify({ serverMB: mb }));
if (mb > BUDGET.serverMB) fail.push(`the program uses ${mb} MB (budget ${BUDGET.serverMB} MB)`);
await b.close();

for (const r of rows) {
  if (r.kind === "idle" && r.busyPct > BUDGET.idleBusyPct) fail.push(`${r.label}: ${r.busyPct}% busy at rest`);
  if (r.heapMB > BUDGET.heapMB) fail.push(`${r.label}: ${r.heapMB} MB of JavaScript memory`);
  if (r.elements > BUDGET.elements) fail.push(`${r.label}: ${r.elements} elements`);
  if (r.kind !== "busy" && r.worstFrameMs > BUDGET.worstFrameMs) fail.push(`${r.label}: a ${r.worstFrameMs} ms frame`);
}
if (fail.length) { console.error("4 GB check:\n  " + [...new Set(fail)].join("\n  ")); process.exit(1); }
console.log("4 GB check: every screen within the budget");
