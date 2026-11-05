// 9.5.1 performance on an older PC, run against a started program with a fresh data folder:
//   KC_DATA_DIR=$(mktemp -d) FRAMEDECKS_NO_UPDATE_CHECK=1 python src/server.py --no-browser &   then   node tests/visual/perf.mjs
// The app window draws without the graphics card by default ("Light on graphics card"), so this runs Chromium the
// same way (--disable-gpu, software compositing) with the processor slowed 4x, and fails when the Welcome screen drops
// below 45 frames a second or a page waits more than 120 ms for a frame, or when the Studio or the remote are busy
// at rest. docs/development/performance.md keeps the numbers.
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/tests/visual/x.js");
const { chromium } = require("playwright");
const B = "http://127.0.0.1:8750", SLOW = Number(process.env.SLOW || 4);
const b = await chromium.launch({ args: ["--disable-gpu", "--disable-gpu-compositing", "--disable-gpu-rasterization"] });
async function metrics(cdp) { const m = (await cdp.send("Performance.getMetrics")).metrics; const o = {}; for (const x of m) o[x.name] = x.value; return o; }
async function measure(p, cdp, label, ms, action) {
  await p.evaluate(() => { window.__fr = []; let last = performance.now(); (function f(t){ window.__fr.push(t - last); last = t; window.__raf = requestAnimationFrame(f); })(last); });
  const a = await metrics(cdp);
  if (action) await action(); 
  await p.waitForTimeout(ms);
  const z = await metrics(cdp);
  const fr = await p.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__fr.slice(1); });
  const secs = ms / 1000, d = (k) => (z[k] - a[k]);
  const long = fr.filter((x) => x > 50).length, fps = fr.length / secs;
  const row = { label, cpuBusyPct: Math.round(d("TaskDuration") / secs * 100), styleMs: Math.round(d("RecalcStyleDuration") * 1000), layoutMs: Math.round(d("LayoutDuration") * 1000),
    scriptMs: Math.round(d("ScriptDuration") * 1000), fps: Math.round(fps), longFrames: long, worstFrameMs: Math.round(Math.max(0, ...fr)), heapMB: Math.round(z.JSHeapUsedSize / 1048576), nodes: z.Nodes };
  console.log(JSON.stringify(row));
  rows.push(row);
  return row;
}
const rows = [];
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
await cdp.send("Performance.enable"); await cdp.send("Emulation.setCPUThrottlingRate", { rate: SLOW });
await p.goto(B + "/dashboard.html"); await p.waitForSelector("#onb.in", { timeout: 20000 }); await p.waitForTimeout(3000);
await measure(p, cdp, "welcome idle (page 1)", 5000);
await measure(p, cdp, "welcome page change", 2500, () => p.click("#onb-next"));
await measure(p, cdp, "welcome page change 2", 2500, () => p.click("#onb-next"));
await p.evaluate(() => window.KCOnboarding.close()); await p.waitForTimeout(1500);
await measure(p, cdp, "studio idle", 6000);
await measure(p, cdp, "studio select frame", 2000, () => p.evaluate(() => { const s = KCStore.get().scenes.filter((x) => !x.tpl); KCWorkspace.select(s[s.length - 1].id); }));
const r = await ctx.newPage(); const rc = await ctx.newCDPSession(r);
await rc.send("Performance.enable"); await rc.send("Emulation.setCPUThrottlingRate", { rate: SLOW });
await r.setViewportSize({ width: 390, height: 844 });
await r.goto(B + "/remote.html"); await r.waitForSelector("#app:not([hidden])"); await r.waitForTimeout(2500);
await measure(r, rc, "remote idle", 5000);
// 9.10.2 the Command Center: at rest, opening, and moving between its chips (it runs beside Zoom or Teams)
const c = await ctx.newPage(); const cc = await ctx.newCDPSession(c);
await cc.send("Performance.enable"); await cc.send("Emulation.setCPUThrottlingRate", { rate: SLOW });
await c.setViewportSize({ width: 820, height: 720 });
await c.goto(B + "/spotlight.html"); await c.waitForSelector(".cc-handle"); await c.waitForTimeout(2500);
await c.evaluate(() => document.documentElement.classList.add("kc-glass"));
await measure(c, cc, "command center idle", 5000);
// 9.11 the tray is folded away: pointing at the arrow unfolds it, clicking keeps it open for the chip scenarios
await measure(c, cc, "command center unfold", 1200, () => c.hover(".cc-handle"));
await c.click(".cc-handle"); await c.waitForTimeout(400);
await measure(c, cc, "command center chip", 1500, () => c.click("#cc-g-prepare"));
await measure(c, cc, "command center chip change", 3000, async () => {
  for (const id of ["engage", "control", "more", "prepare", "engage"]) { await c.click("#cc-g-" + id); await c.waitForTimeout(420); }
});
await b.close();

const fail = [];
for (const r of rows) {
  if (r.label.startsWith("welcome") && (r.fps < 45 || r.worstFrameMs > 120)) fail.push(`${r.label}: ${r.fps} fps, worst frame ${r.worstFrameMs} ms`);
  if (/idle/.test(r.label) && !r.label.startsWith("welcome") && r.cpuBusyPct > 25) fail.push(`${r.label}: ${r.cpuBusyPct}% busy at rest`);
  if ((r.label.startsWith("command center chip") || r.label === "command center unfold") && (r.fps < 45 || r.worstFrameMs > 120)) fail.push(`${r.label}: ${r.fps} fps, worst frame ${r.worstFrameMs} ms`);
}
if (fail.length) { console.error("Performance: " + fail.join("; ")); process.exit(1); }
console.log("Performance: within the budget for an older PC");
