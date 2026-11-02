// The Help guide's screenshots (hosted/src/lib/help-guide.ts): the real website screens against a stand-in workspace
// (as plan-flow.mjs) and the real program, saved as hosted/public/help/<shot>.jpg, with the place each step highlights
// written to hosted/src/lib/help-shots.json (as percentages of the picture). Run it again whenever a screen in the
// guide changes: build the website, start the program (python src/server.py), then node tests/visual/help-shots.mjs.
// It does not change your plan file: it reads only; restore kc-*.json if you clicked around while it ran.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const OUT = new URL("../../hosted/out/", import.meta.url).pathname, SP = new URL("../../hosted/public/help/", import.meta.url).pathname;
let failed = 0;
const check = (ok, what) => (console.log(`${ok ? "ok  " : "FAIL"} ${what}`), ok || failed++);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".webp": "image/webp" };
const srv = createServer((q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]);
  let f = join(OUT, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = existsSync(f + ".html") ? f + ".html" : join(f, "index.html");
  else if (!existsSync(f) && existsSync(f + ".html")) f = f + ".html";
  if (!existsSync(f)) return (r.writeHead(404), r.end());
  r.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f));
}).listen(8931);
const frame = (id, name, notes, layers, tx = "profile") => ({ kind: "frame", id, rev: 1, seq: 1, body: { id, name, notes, tx: { type: tx, ms: 500 }, layers } });
let records = [
  { kind: "meeting", id: "meeting", rev: 1, seq: 1, body: { title: "Tuesday Bible Study", date: "2026-11-03", meetings: [{ id: "mt_a", name: "Tuesday Bible Study", date: "2026-11-03", notes: "" }, { id: "mt_b", name: "Sunday Service", date: "2026-11-08", notes: "" }] } },
  { kind: "order", id: "order", rev: 1, seq: 1, body: { scenes: ["f1", "f2", "f3"] } },
  frame("f1", "Welcome", "Good evening everyone.", [{ id: "L1", kind: "announcement", name: "Welcome", c: { title: "Welcome", text: "Glad you are here", label: true } }]),
  frame("f2", "Reading", "", [{ id: "L2", kind: "scripture", name: "Scripture", c: { label: "Reading", itemId: "v1", items: [{ id: "v1", ref: "John 15:5", version: "ESV", text: "I am the vine; you are the branches." }] } }, { id: "L4", kind: "background", c: { color: "#2b1d0e" } }], "burst"),
  frame("f3", "Discussion", "", [{ id: "L3", kind: "question", name: "Questions", c: { label: "Discuss", itemId: "q1", items: [{ id: "q1", text: "What does abiding look like this week?" }, { id: "q2", text: "Why?" }] } }]),
];
const pushes = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, reducedMotion: "reduce" });
await ctx.addInitScript(() => { window.__dark = 1; localStorage.setItem("fd-theme", "dark"); });
await ctx.addInitScript(() => {
  localStorage.setItem("sb-x-auth-token", JSON.stringify({ access_token: "t", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user: { id: "u1", email: "a@b.c", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } }));
  localStorage.setItem("fd-consent", JSON.stringify({ version: "2026-10-29", at: Date.now(), essential: true, analytics: false })); if (location.search.includes("dark") || window.__dark) localStorage.setItem("fd-theme", "dark");
});
await ctx.route("https://x.supabase.co/**", async (route) => {
  const u = route.request().url();
  if (u.includes("/rest/v1/memberships")) return route.fulfill({ json: [{ role: "owner", organizations: { id: "org1", name: "Grace", created_at: "2026-01-01" } }] });
  if (u.includes("/rest/v1/profiles")) return route.fulfill({ json: { terms_version: "2026-10-29" } });
  if (u.includes("rpc/sync_pull")) return route.fulfill({ json: { entities: records, seq: 9, more: false } });
  if (u.includes("rpc/sync_push")) {
    const body = route.request().postDataJSON(); pushes.push(body);
    for (const c of body.changes) { const r = records.find((x) => x.kind === c.kind && x.id === c.id); if (r) { r.body = c.body; r.rev++; } else records.push({ kind: c.kind, id: c.id, rev: 1, seq: 1, body: c.body }); }
    await new Promise((res) => setTimeout(res, 300));
    return route.fulfill({ json: { results: body.changes.map(() => ({ status: "ok", rev: 5 })) } });
  }
  if (u.includes("rpc/remote_computers")) return route.fulfill({ json: [] });
  if (u.includes("rpc/meetings_supported")) return route.fulfill({ json: true });
  return route.fulfill({ json: [] });
});
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(SP, { recursive: true });
const PC = process.env.FRAMEDECKS_URL || "http://127.0.0.1:8750";
const shots = {};
async function shot(page, name, spots) {
  const vp = page.viewportSize(), out = {};
  for (const [key, sel] of Object.entries(spots)) {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) throw new Error(`${name}: nothing to highlight for ${key} (${sel})`);
    const pad = 6, x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
    const w = Math.min(vp.width - x, box.width + 2 * pad), h = Math.min(vp.height - y, box.height + 2 * pad);
    out[key] = [x, y, w, h].map((v, i) => +((v / (i % 2 ? vp.height : vp.width)) * 100).toFixed(2));
  }
  await page.screenshot({ path: `${SP}${name}.jpg`, type: "jpeg", quality: 72 });
  shots[name] = { w: vp.width, h: vp.height, spots: out };
  console.log("ok  ", name, Object.keys(out).join(", "));
}
// ---- the website ----
const pub = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
await pub.addInitScript(() => { localStorage.setItem("fd-theme", "dark"); });
const s = await pub.newPage();
await s.goto("http://127.0.0.1:8931/sign-in"); await s.waitForTimeout(900);
await s.evaluate(() => document.querySelector(".fd-cookie button")?.click()); await s.waitForTimeout(300);
await shot(s, "web-sign-in", { send: "button:has-text('Email me a sign-in link')" });
await pub.close();
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:8931/plan");
await p.waitForSelector(".flow-steps", { timeout: 15000 });
await p.evaluate(() => document.querySelector(".fd-cookie button")?.click());
await p.waitForTimeout(400);
await shot(p, "web-steps", { frames: ".flow-steps li:nth-child(2)", timeline: ".plan-side .fc", meetings: ".mb", send: ".flow-steps li:nth-child(5)", nav: "a:has-text('Service PCs')" });
await p.click(".flow-steps li:nth-child(1) button"); await p.waitForTimeout(700);
await p.evaluate(() => window.scrollBy(0, -90));
await shot(p, "web-meeting", { form: ".meet-form" });
await p.click(".frame-card .frame-quick button:has-text('Write Script')"); await p.waitForTimeout(800);
await p.evaluate(() => document.querySelector("li.frame-editing .edit-script")?.scrollIntoView({ block: "center" }));
await p.waitForTimeout(300);
await shot(p, "web-editor", { script: "li.frame-editing .edit-script textarea" });
await p.evaluate(() => document.querySelector("li.frame-editing .flow-tx")?.scrollIntoView({ block: "center" }));
await p.waitForTimeout(300);
await shot(p, "web-animation", { picker: "li.frame-editing .flow-tx" });
await p.click("li.frame-editing .edit-actions button:has-text('Cancel')");
await p.evaluate(() => window.scrollTo(0, 0));
await p.click(".flow-steps li:nth-child(4) button"); await p.waitForSelector(".flow-preview[open]"); await p.waitForTimeout(500);
await shot(p, "web-preview", { stage: ".pv-stage" });
// ---- the program ----
const pcx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
const q = await pcx.newPage();
await q.goto(PC + "/dashboard.html"); await q.waitForTimeout(2500);
await shot(q, "pc-studio", { guide: ".gd-panel", add: "#scene-add", canvas: ".canvas-pane, #canvas-title" });
await q.evaluate(() => document.querySelector(".gd-panel")?.remove());
await shot(q, "pc-bar", { transition: ".lb-tx", golive: "#cb-take" });
await q.evaluate(() => document.querySelector('[data-goto="settings"]').click());
await q.waitForTimeout(500);
await q.evaluate(() => document.querySelector('button[data-sec="account"]').click());
await q.waitForTimeout(900);
await shot(q, "pc-account", { connect: "#acct-body .btn.primary" });
await q.evaluate(() => document.querySelector('button[data-sec="data"]').click());
await q.waitForTimeout(700);
await q.evaluate(() => document.getElementById("frame-file-box")?.scrollIntoView({ block: "center" }));
await q.waitForTimeout(300);
await shot(q, "pc-import", { import: "#frame-file-box" });
const t = await pcx.newPage();
await t.setViewportSize({ width: 1280, height: 800 });
await t.goto(PC + "/speaker.html"); await t.waitForTimeout(1800);
await t.mouse.move(640, 20); await t.waitForTimeout(600);
await t.evaluate(() => {
  document.body.classList.add("sp-bar-open");
  // example words for the picture only (nothing is saved)
  const box = document.querySelector("#sp-prompt .tp-text") || document.querySelector("#sp-prompt");
  if (box) box.innerHTML = "<h2>Welcome</h2><p>Good evening, everyone. It is good to see you.</p><p>Tonight we read <b>John 15</b> together: <i>I am the vine; you are the branches.</i></p><p>[PAUSE]</p><p>Let us begin with a short prayer.</p>";
});
await shot(t, "pc-teleprompter", { bar: "#sp-top" });
writeFileSync(new URL("../../hosted/src/lib/help-shots.json", import.meta.url), JSON.stringify(shots, null, 1) + "\n");
await b.close(); srv.close();
console.log("help screenshots written");
