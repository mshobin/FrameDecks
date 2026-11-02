// The 8.3 guided Plan workflow on the website, against a stand-in workspace (no Supabase needed). Build the website
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
  { kind: "meeting", id: "meeting", rev: 1, seq: 1, body: { title: "Tuesday Bible Study", date: "2026-11-03" } },
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
import { mkdirSync } from "node:fs";
mkdirSync(SP, { recursive: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("PAGEERR", e.message));
await p.goto("http://127.0.0.1:8931/plan");
await p.waitForSelector(".flow-steps", { timeout: 15000 });
await p.waitForTimeout(800);
await p.screenshot({ path: SP + "/plan-top.png", fullPage: false });
await p.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
const ax = await p.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }));
const own = ax.violations.filter((v) => !v.nodes.every((n) => n.target.join(" ").includes("cookies")));
check(!own.length, `axe on the Plan page: ${own.map((v) => v.id + " " + v.nodes.map((n) => n.target.join(" ") + " " + (n.any[0]?.message || "").slice(0, 120)).join(" ; ")).join(", ") || "none"}`);
check((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, "no sideways scrolling");
const st = await p.$$eval(".flow-steps li", (l) => l.map((x) => x.className));
check(st.join() === "is-done,is-done,is-done,is-now,is-todo", `steps: ${st}`);
// drag Discussion before Welcome
const W = Number(process.argv[3] || 1366);
if (W >= 700) await p.dragAndDrop(".fc-node:nth-child(4)", ".fc-node:nth-child(2)", { targetPosition: { x: 60, y: 6 } });
else {
  // a phone: the same move by keyboard (the cards' arrows work too)
  await p.focus(".fc-node:nth-child(4) .fc-card");
  await p.keyboard.press("Alt+ArrowUp");
  await p.waitForTimeout(700);
  await p.focus(".fc-node:nth-child(3) .fc-card");
  await p.keyboard.press("Alt+ArrowUp");
}
await p.waitForTimeout(150);
await p.screenshot({ path: SP + "/plan-syncing.png", clip: { x: 0, y: 0, width: 1366, height: 500 } });
await p.waitForTimeout(800);
check(JSON.stringify(records.find((r) => r.kind === "order").body.scenes) === '["f3","f1","f2"]', "drag and drop saves the new order");
check((await p.textContent(".flow-sync")).includes("Synced"), "Sync status back to Synced");
check((await p.textContent(".fc-node:nth-child(2) .fc-text b")).includes("Discussion"), "the timeline shows the new order");
check((await p.textContent(".frame-list > li:first-child h3")).includes("Discussion"), "the main list shows it too");
// keyboard move
await p.focus(".fc-node:nth-child(2) .fc-card");
await p.keyboard.press("Alt+ArrowDown");
await p.waitForTimeout(800);
check(JSON.stringify(records.find((r) => r.kind === "order").body.scenes) === '["f1","f3","f2"]', "Alt + arrow moves a Frame");
// Preview
await p.click(".flow-steps li:nth-child(4) button");
await p.waitForSelector(".flow-preview[open]");
await p.waitForTimeout(1000);
await p.screenshot({ path: SP + "/plan-preview.png" });
const ax2 = await p.evaluate(() => window.axe.run(document.querySelector(".flow-preview"), { runOnly: ["wcag2a", "wcag2aa"] }));
check(!ax2.violations.length, "axe on the Preview");
await p.keyboard.press("ArrowRight"); await p.waitForTimeout(400);
await p.screenshot({ path: SP + "/plan-preview2.png" });
await p.keyboard.press("Escape"); await p.waitForTimeout(300);
// Choose Animation on a card
await p.click(".frame-card .frame-quick button:has-text('Choose Animation')");
await p.waitForSelector(".flow-tx");
await p.waitForTimeout(600);
await p.screenshot({ path: SP + "/plan-tx.png" });
const ax3 = await p.evaluate(() => window.axe.run(document.querySelector("li.frame-editing"), { runOnly: ["wcag2a", "wcag2aa"] }));
check(!ax3.violations.length, "axe on the Frame editor");
// media file
await p.click(".flow-tx button:has-text('Zoom')");
await p.selectOption(".planner-add-row select", "image");
await p.click(".planner-add-row button");
await p.setInputFiles(".flow-file input[type=file]", { name: "vine photo.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
await p.waitForTimeout(400);
check((await p.textContent(".flow-file small")).includes("Kept in this browser"), "a chosen file is kept in the browser");
await p.click("li.frame-editing .edit-actions .live-primary");
await p.waitForTimeout(900);
// export
const [dl] = await Promise.all([p.waitForEvent("download"), p.click(".flow-steps li:nth-child(5) button")]);
const path = SP + "/" + dl.suggestedFilename(); await dl.saveAs(path);
const f = JSON.parse(readFileSync(path, "utf8"));
check(f.counts.frames === 3 && f.media.length === 1 && f.media[0].file === "vine photo.png", "the .frame file holds the Frames and the file");
check((await p.$$eval(".flow-steps li.is-done", (l) => l.length)) === 5, "every step done after the export");
await p.screenshot({ path: SP + "/plan-end.png", fullPage: true });
// ---- 8.5 several meetings ----
const meetingBody = () => records.find((r) => r.kind === "meeting").body;
await p.evaluate(() => window.scrollTo(0, 0));
await p.click(".mb-new");
await p.fill(".mb-form input", "Sunday Service");
await p.click(".mb-form button[type=submit]");
await p.waitForTimeout(900);
check((meetingBody().meetings || []).map((m) => m.name).join() === "Tuesday Bible Study,Sunday Service", "a new meeting is saved in the list");
check((await p.textContent(".mb-chips [aria-selected=true]")).includes("Sunday Service"), "the new meeting is chosen");
check((await p.$$(".fc-node")).length === 0, "the new meeting starts with no Frames");
check(meetingBody().title === "Tuesday Bible Study", "making a meeting does not change what the PC shows");
await p.click(".fc-end button");
await p.waitForSelector("li.frame-editing");
await p.fill("li.frame-editing .planner-grid input >> nth=0", "Sunday Welcome");
await p.click("li.frame-editing .edit-actions .live-primary");
await p.waitForTimeout(900);
const sunday = records.find((r) => r.kind === "frame" && r.body?.name === "Sunday Welcome");
check(sunday?.body.group === "Sunday Service", "a Frame added here belongs to the meeting");
check((await p.$$(".fc-node")).length === 1, "the timeline shows only this meeting's Frame");
await p.screenshot({ path: SP + "/plan-meetings.png" });
await p.click(".mb-chips button:has-text('Tuesday Bible Study')");
await p.waitForTimeout(600);
check((await p.$$(".fc-node")).length === 3, "switching back shows the first meeting's three Frames");
await p.click(".mb-chips button:has-text('Sunday Service')");
await p.waitForTimeout(400);
await p.click(".mb-rename");
await p.fill(".mb-form input", "Sunday Worship");
await p.click(".mb-form button[type=submit]");
await p.waitForTimeout(900);
check(meetingBody().meetings.some((m) => m.name === "Sunday Worship") && records.find((r) => r.id === sunday.id).body.group === "Sunday Worship", "renaming moves the meeting's Frames with it");
await p.click(".fc-node .fc-del");
await p.click(".fd-confirm-submit");
await p.waitForTimeout(900);
check(!records.find((r) => r.id === sunday.id)?.body, "delete in the timeline removes the Frame");
check((await p.$$(".fc-node")).length === 0, "and the timeline shows it gone");
await p.click(".mb-chips button:has-text('Tuesday Bible Study')");
await p.waitForTimeout(500);
const [dl2] = await Promise.all([p.waitForEvent("download"), p.click(".flow-steps li:nth-child(5) button")]);
const f2 = JSON.parse(readFileSync(await dl2.path(), "utf8"));
check(f2.counts.frames === 3 && f2.plan.meeting.title === "Tuesday Bible Study" && !f2.plan.meeting.meetings, "the .frame file holds one meeting");
await b.close(); srv.close();
console.log(failed ? `${failed} check(s) failed` : "all Plan workflow checks passed");
process.exit(failed ? 1 : 0);
