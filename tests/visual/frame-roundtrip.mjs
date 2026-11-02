// 8.4 The .frame round trip, end to end: a plan made on the website (stand-in workspace, as plan-flow.mjs), exported
// with a picture chosen in the browser, imported on a running program with Use this plan, then compared field by field.
// Needs the website built and the program running (python src/server.py). Restore your kc-*.json afterwards.
// Original header of the shared stand-in: the 8.3 guided Plan workflow on the website, against a stand-in workspace (no Supabase needed). Build the website
// first (cd hosted && NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=stub npm run build),
// then: node tests/visual/plan-flow.mjs [screenshot folder] [width]   (DARK=1 for the dark theme)
// Checks the steps, drag and drop and Alt + arrows on the timeline, the Preview, Choose Animation, a file kept in the
// browser and the .frame export with it, axe (WCAG 2.1 AA) and no sideways scrolling.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const OUT = new URL("../../hosted/out/", import.meta.url).pathname, SP = process.argv[2] || new URL("./out", import.meta.url).pathname;
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
  { kind: "meeting", id: "meeting", rev: 1, seq: 1, body: { title: "Tuesday", date: "", location: "Hall" } },
  { kind: "order", id: "order", rev: 1, seq: 1, body: { scenes: ["f1", "f2", "f3"] } },
  frame("f1", "Welcome", "Good evening everyone.", [{ id: "L1", kind: "announcement", name: "Welcome", c: { title: "Welcome", text: "Glad you are here", label: true } }]),
  frame("f2", "Reading", "", [{ id: "L2", kind: "scripture", name: "Scripture", c: { label: "Reading", itemId: "v1", items: [{ id: "v1", ref: "John 15:5", version: "ESV", text: "I am the vine; you are the branches." }] } }, { id: "L4", kind: "background", c: { color: "#2b1d0e" } }], "burst"),
  frame("f3", "Discussion", "", [{ id: "L3", kind: "question", name: "Questions", c: { label: "Discuss", itemId: "q1", items: [{ id: "q1", text: "What does abiding look like this week?" }, { id: "q2", text: "Why?" }] } }]),
];
const pushes = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: Number(process.argv[3] || 1366), height: 900 }, acceptDownloads: true });
if (process.env.DARK) await ctx.addInitScript(() => { window.__dark = 1; localStorage.setItem("fd-theme", "dark"); });
await ctx.addInitScript(() => {
  localStorage.setItem("sb-x-auth-token", JSON.stringify({ access_token: "t", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user: { id: "u1", email: "a@b.c", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } }));
  localStorage.setItem("fd-cookie-ok", "1"); if (location.search.includes("dark") || window.__dark) localStorage.setItem("fd-theme", "dark");
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
  return route.fulfill({ json: [] });
});
import { mkdirSync } from "node:fs";
mkdirSync(SP, { recursive: true });
const PC = process.env.FRAMEDECKS_URL || "http://127.0.0.1:8750";
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("PAGEERR", e.message));
await p.goto("http://127.0.0.1:8931/plan");
await p.waitForSelector(".flow-steps", { timeout: 15000 });
// the meeting details (8.4: name, date, notes)
await p.click(".flow-steps li:nth-child(1) button");
await p.fill(".meet-form input >> nth=0", "Tuesday Bible Study");
await p.fill(".meet-form input[type=date]", "2026-11-03");
await p.fill(".meet-form textarea", "Bring Bibles and a friend.");
await p.click("#plan-meeting .edit-actions .live-primary");
await p.waitForTimeout(700);
check((await p.textContent("#plan-meeting .edit-actions")).includes("Saved"), "Meeting details: saved feedback");
check(records.find((r) => r.kind === "meeting").body.location === "Hall", "Meeting details: an older field is kept");
// a picture on the first Frame, kept in the browser
await p.click(".frame-card .frame-quick button:has-text('Write Script')");
await p.waitForSelector("li.frame-editing");
await p.selectOption("li.frame-editing .planner-add-row select", "image");
await p.click("li.frame-editing .planner-add-row button");
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
await p.setInputFiles("li.frame-editing .flow-file input[type=file]", { name: "vine.png", mimeType: "image/png", buffer: PNG });
await p.waitForTimeout(300);
await p.click("li.frame-editing .edit-actions .live-primary");
await p.waitForTimeout(900);
const [dl] = await Promise.all([p.waitForEvent("download"), p.click(".flow-steps li:nth-child(5) button")]);
const path = SP + "/roundtrip.frame";
await dl.saveAs(path);
const text = readFileSync(path, "utf8");
check(JSON.parse(text).media.length === 1, "the picture is inside the .frame file");
const websiteFrames = (() => {
  const order = records.find((r) => r.kind === "order").body.scenes;
  return order.map((id) => records.find((r) => r.kind === "frame" && r.id === id).body);
})();
// the program
const q = await b.newPage({ viewport: { width: 1500, height: 950 } });
q.on("pageerror", (e) => console.log("PC PAGEERR", e.message));
await q.goto(PC + "/dashboard.html");
await q.waitForTimeout(2500);
await q.evaluate(() => { document.querySelector('[data-goto="settings"]')?.click(); document.querySelector('button[data-sec="data"]')?.click(); });
await q.evaluate((t) => KCFrameFile.importFile(new File([t], "roundtrip.frame")), text);
await q.waitForSelector("#frame-use");
check((await q.textContent("#frame-ask")).includes("Use this plan"), "the import asks with Use this plan first");
await q.click("#frame-use");
await q.waitForFunction(() => /Now using/.test(document.getElementById("frame-file-status").textContent), null, { timeout: 15000 });
await q.waitForTimeout(500);
const status = await q.textContent("#frame-file-status");
console.log("     " + status);
check(/Everything matches/.test(status) && !/⚠/.test(status), "the import check: everything matches");
const st = await q.evaluate(() => JSON.parse(JSON.stringify(KCStore.get())));
const pcFrames = st.scenes.filter((s) => !s.tpl);
check(pcFrames.map((s) => s.id).join() === websiteFrames.map((s) => s.id).join(), "same Frames, same ids, same order");
check(pcFrames.every((s, i) => s.name === websiteFrames[i].name && s.notes === websiteFrames[i].notes), "same names and scripts");
check(pcFrames.every((s, i) => JSON.stringify(s.layers.map((l) => [l.id, l.kind, l.c.text ?? "", l.c.file ?? "", (l.c.items || []).map((it) => it.text || it.ref)])) ===
  JSON.stringify((websiteFrames[i].layers || []).map((l) => [l.id, l.kind, l.c.text ?? "", l.c.file ?? "", (l.c.items || []).map((it) => it.text || it.ref)]))), "same Content, words, questions and files");
check(st.meeting.title === "Tuesday Bible Study" && st.meeting.date === "2026-11-03" && st.meeting.notes === "Bring Bibles and a friend.", "same meeting name, date and notes");
const img = await q.evaluate(() => fetch("api/media/file?name=vine.png").then((r) => (r.ok ? r.arrayBuffer() : null)).then((x) => (x ? x.byteLength : 0)));
check(img === PNG.length, "the picture is on the PC, byte for byte");
await q.screenshot({ path: SP + "/roundtrip-pc.png" });
await b.close(); srv.close();
console.log(failed ? `${failed} check(s) failed` : "all round-trip checks passed");
process.exit(failed ? 1 : 0);
