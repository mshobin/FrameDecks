import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

import {
  emptyFrame,
  emptyRow,
  frameFormOf,
  frameFromForm,
  meetingFormOf,
  meetingFromForm,
  problemsOf,
  rebaseFrame,
  uniqueName,
  withFrame,
} from "../src/lib/meeting-form.ts";

// The program's own code: store.js (normalize, what the PC runs on every load) and meeting-book.js (the Excel import),
// so a Frame made on the website is checked against the Frame the Excel import makes from the same rows.
function loadProgram() {
  const ls = {};
  const ctx = {
    console, Math, Date, JSON, setTimeout, clearTimeout, Promise, Object, Array, String, Number, isFinite, RegExp, Error,
    location: { protocol: "file:" },
    localStorage: { getItem: (k) => ls[k] || null, setItem: (k, v) => { ls[k] = v; } },
    document: { addEventListener() {}, hidden: false },
    addEventListener() {},
    BroadcastChannel: undefined,
    fetch: () => Promise.reject(),
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  for (const file of ["store.js", "meeting-book.js"]) {
    vm.runInContext(readFileSync(new URL(`../../app/js/${file}`, import.meta.url), "utf8"), ctx);
  }
  return { Store: ctx.KCStore, MB: ctx.KCMeetingBook };
}
const { Store, MB } = loadProgram();
const plain = (v) => JSON.parse(JSON.stringify(v));
const normalized = (frame) => plain(Store.normalize(plain({ scenes: [frame] })).scenes[0]);

// What may differ between two builds of the same rows: new ids, times, where it was made, and the card look the
// Excel import copies from the theme (without it, the Frame follows the theme, which looks the same).
function comparable(scene) {
  const s = plain(scene);
  for (const key of ["id", "created", "modified", "from", "template", "creator", "group"]) delete s[key];
  s.layers = s.layers.map((l) => {
    delete l.id;
    if (l.c) {
      delete l.c.look;
      delete l.c.itemId;
      if (Array.isArray(l.c.items)) l.c.items = l.c.items.map(({ id, ...rest }) => rest);
    }
    return l;
  });
  return s;
}

const ROWS = [
  { type: "question", name: "Discussion", label: "Discuss", anim: "rise", questions: [
    { label: "Q1", text: "What does it mean to abide?", media: "", timer: "3", anim: "" },
    { label: "", text: "Where do you see fruit?", media: "", timer: "", anim: "words" },
  ] },
  { type: "scripture", name: "Reading", label: "", anim: "", scriptures: [
    { label: "", ref: "John 15:5", version: "ESV", text: "I am the vine; you are the branches.", anim: "" },
  ] },
  { type: "text", name: "Welcome", label: "Welcome", main: "Glad you are here", anim: "fade" },
  { type: "prayer", name: "Pray", label: "", main: "For the city", anim: "" },
  { type: "lowerthird", name: "Speaker", label: "", main: "Jane Doe | Elder", anim: "" },
  { type: "countdown", name: "Start", label: "", duration: "10:30" },
  { type: "countdown", name: "Break", label: "Back in", duration: "7" },
  { type: "image", name: "Logo", main: "" },
  { type: "video", name: "Intro", main: "" },
  { type: "powerpoint", name: "Slides", main: "", pptBg: "hide" },
  { type: "camera", name: "Camera" },
  { type: "screen", name: "Screen" },
  { type: "brand", name: "Branding" },
];
const formRow = (r) => ({ ...emptyRow(r.type), ...r, questions: r.questions ?? [], scriptures: r.scriptures ?? [] });

test("a Frame made on the website is the Frame the Excel import makes from the same rows", () => {
  const form = { ...emptyFrame(), name: "Abide", desc: "Opening", script: "Welcome everyone", background: "Navy", transition: "dissolve", content: ROWS.map(formRow) };
  const fromWeb = normalized(frameFromForm(form, null, { brandColor: "#1f3a6d", group: "Sunday" }));

  const n = plain(Store.normalize({}));
  n.scenes = [];
  const anim = (a) => a || "";
  const plan = {
    errors: [], warnings: [], meeting: Object.fromEntries(MB.FIELDS.map((f) => [f[0], ""])),
    frames: [{ name: "Abide", desc: "Opening", bg: "#0b1222", tx: "dissolve", notes: "Welcome everyone", content: ROWS.map((r, idx) => ({
      type: r.type === "powerpoint" ? "powerpoint" : r.type, name: r.name, main: r.main ?? "", label: r.label ?? "", duration: r.duration ?? "",
      anim: anim(r.anim), objectsOnly: r.pptBg === "hide", notes: "", idx, order: null,
      items: (r.questions ?? r.scriptures ?? []).map((it) => ({ ...it, transition: it.anim || "" })),
    })) }],
  };
  const made = MB.apply(n, plan, { group: "Sunday" });
  assert.deepEqual(comparable(fromWeb), comparable(normalized(made[0])));
});

test("the form reads back what it wrote, and saving it again changes nothing", () => {
  const form = { ...emptyFrame(), name: "Abide", desc: "Opening", script: "Line one\nLine two", background: "#123abc", transition: "fade", content: ROWS.map(formRow) };
  const body = normalized(frameFromForm(form, null));
  const again = frameFormOf(body);
  assert.deepEqual([again.name, again.desc, again.script, again.background, again.transition], ["Abide", "Opening", "Line one\nLine two", "#123abc", "fade"]);
  // Words and cards first, pictures and video behind (as the Excel import lays out a new Frame)
  assert.deepEqual(again.content.map((r) => r.name), ["Discussion", "Reading", "Welcome", "Pray", "Speaker", "Start", "Break", "Branding", "Logo", "Intro", "Slides", "Camera", "Screen"]);
  const byName = Object.fromEntries(again.content.map((r) => [r.name, r]));
  assert.deepEqual(byName.Discussion.questions.map((q) => [q.label, q.text, q.timer, q.anim]), [["Q1", "What does it mean to abide?", "3", ""], ["", "Where do you see fruit?", "", "words"]]);
  assert.equal(byName.Discussion.anim, "rise");
  assert.deepEqual(byName.Reading.scriptures.map((v) => [v.ref, v.version, v.text]), [["John 15:5", "ESV", "I am the vine; you are the branches."]]);
  assert.deepEqual([byName.Welcome.type, byName.Welcome.label, byName.Welcome.main, byName.Welcome.anim], ["text", "Welcome", "Glad you are here", "fade"]);
  assert.deepEqual([byName.Speaker.label, byName.Speaker.main], ["Jane Doe", "Elder"]);
  assert.deepEqual([byName.Start.duration, byName.Break.duration, byName.Break.label], ["10:30", "7", "Back in"]);
  assert.equal(byName.Slides.pptBg, "hide");
  // Saving the form again as it is gives the same Frame (no drift between the website and the PC)
  const resaved = normalized(frameFromForm(again, body, { now: body.modified }));
  assert.deepEqual(resaved, body);
});

test("editing keeps what the form does not show: position, look, the item on screen, other Content", () => {
  const body = normalized(frameFromForm({ ...emptyFrame(), name: "F", content: ROWS.map(formRow) }, null));
  const q = body.layers.find((l) => l.kind === "question");
  q.c.look = { qScale: 1.2, transition: "rise" };
  q.c.itemId = q.c.items[1].id;
  const img = body.layers.find((l) => l.kind === "image");
  Object.assign(img.c, { x: 0.2, y: 0.3, w: 0.4, file: "logo.png" });
  body.layers.push(Store.normalize({ scenes: [{ name: "x", layers: [{ id: "Lshape", kind: "rect", name: "Box", c: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }] }] }).scenes[0].layers[0]);

  const form = frameFormOf(body);
  assert.equal(form.content.at(-1).type, "other");
  const qRow = form.content.find((r) => r.type === "question");
  qRow.questions[0].text = "Changed?";
  qRow.questions.push({ label: "", text: "New one", media: "", timer: "", anim: "" });
  form.content.find((r) => r.type === "image").main = "logo2.png";
  const after = normalized(frameFromForm(form, body));

  const q2 = after.layers.find((l) => l.kind === "question");
  assert.equal(q2.c.look.qScale, 1.2);
  assert.equal(q2.c.itemId, q.c.items[1].id);
  assert.equal(q2.c.items[0].id, q.c.items[0].id);
  assert.equal(q2.c.items[0].text, "Changed?");
  assert.equal(q2.c.items.length, 3);
  const img2 = after.layers.find((l) => l.kind === "image");
  assert.deepEqual([img2.id, img2.c.x, img2.c.y, img2.c.w, img2.c.file], [img.id, 0.2, 0.3, 0.4, "logo2.png"]);
  assert.ok(after.layers.some((l) => l.id === "Lshape" && l.kind === "rect"));
  assert.equal(after.id, body.id);
});

test("removing, reordering and changing the type of Content", () => {
  const body = normalized(frameFromForm({ ...emptyFrame(), name: "F", background: "Black", content: ROWS.slice(2, 5).map(formRow) }, null));
  const form = frameFormOf(body);
  const [text, prayer, lower] = form.content;
  form.content = [lower, { ...text, type: "prayer" }];
  form.background = "None";
  const after = normalized(frameFromForm(form, body));
  assert.deepEqual(after.layers.map((l) => l.kind), ["lowerthird", "prayer"]);
  assert.equal(after.layers[0].id, lower.layerId);
  assert.notEqual(after.layers[1].id, text.layerId); // a different kind is new Content
  assert.ok(!after.layers.some((l) => l.id === prayer.layerId));
});

test("the same checks as the Excel import", () => {
  const form = { ...emptyFrame(), background: "Purple", content: [
    formRow({ type: "question", name: "A", questions: [{ label: "", text: " ", media: "", timer: "x", anim: "" }] }),
    formRow({ type: "question", name: "a" }),
    formRow({ type: "scripture", name: "S", scriptures: [{ label: "", ref: "", version: "", text: "", anim: "" }] }),
    formRow({ type: "countdown", name: "T", duration: "soon" }),
  ] };
  const problems = problemsOf(form);
  assert.equal(problems.length, 7, problems.join("\n"));
  assert.match(problems.join("\n"), /Background “Purple”/);
  assert.match(problems.join("\n"), /same name/);
  assert.match(problems.join("\n"), /one Question Content/);
  assert.match(problems.join("\n"), /question text is empty/);
  assert.match(problems.join("\n"), /Timer is in minutes/);
  assert.match(problems.join("\n"), /reference is empty/);
  assert.match(problems.join("\n"), /Duration is minutes/);
  assert.deepEqual(problemsOf({ ...emptyFrame(), content: ROWS.map(formRow) }), []);
});

test("meeting details keep the program's keys and limits", () => {
  const form = meetingFormOf({ title: "Sunday", date: "2026-11-01", other: "kept" });
  assert.equal(form.title, "Sunday");
  assert.equal(form.extra, "");
  form.presenter = "  Jane  ";
  form.title = "x".repeat(200);
  const body = meetingFromForm(form, { title: "Sunday", other: "kept" });
  assert.equal(body.presenter, "Jane");
  assert.equal(body.title.length, 80);
  assert.equal(body.other, "kept");
  const meeting = Store.normalize({ meeting: body }).meeting;
  assert.equal(meeting.presenter, "Jane");
});

test("new Frame names, and the order record", () => {
  assert.equal(uniqueName(["Welcome", "Day 5"], "Welcome"), "Welcome copy");
  assert.equal(uniqueName(["Day 5"], "Day 5"), "Day 6");
  assert.equal(uniqueName([], ""), "Frame");
  assert.deepEqual(withFrame({ scenes: ["a"], questions: ["q"] }, "b"), { scenes: ["a", "b"], questions: ["q"] });
  assert.deepEqual(withFrame(null, "b").scenes, ["b"]);
});

test("after a conflict the latest version is shown with the person's own changes on top", () => {
  const body = normalized(frameFromForm({ ...emptyFrame(), name: "F", script: "s", content: ROWS.slice(2, 5).map(formRow) }, null));
  const initial = frameFormOf(body);
  const draft = structuredClone(initial);
  draft.name = "Mine";
  draft.content[0].main = "my words";
  draft.content.splice(2, 1); // removed the lower third
  draft.content.push(formRow({ type: "camera", name: "Cam" }));
  const latest = structuredClone(initial);
  latest.script = "theirs";
  latest.content[1].main = "their prayer";
  latest.content.push({ ...formRow({ type: "brand", name: "Brand" }), layerId: "Lnew" });
  const out = rebaseFrame(latest, draft, initial);
  assert.equal(out.name, "Mine");
  assert.equal(out.script, "theirs");
  assert.deepEqual(out.content.map((r) => r.name), ["Welcome", "Pray", "Brand", "Cam"]);
  assert.equal(out.content[0].main, "my words");
  assert.equal(out.content[1].main, "their prayer");
});
