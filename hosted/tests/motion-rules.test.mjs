// 9.11.2 the website's motion rules, held by a test (app/flourish.css, app/motion.css):
// only transform and opacity move; nothing moves when less motion is asked for or "Reduce effects" is on;
// endless loops run only while on screen ([data-live]); one timing language (var(--t-move), about 0.35 s, rising 8 px).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** Every declaration in a stylesheet with the chain of blocks around it (at-rules and selectors). */
function declarations(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const stack = [];
  let buf = "";
  for (const ch of text) {
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      if (buf.trim()) out.push({ decl: buf.trim(), within: [...stack] });
      stack.pop();
      buf = "";
    } else if (ch === ";") {
      if (buf.trim()) out.push({ decl: buf.trim(), within: [...stack] });
      buf = "";
    } else buf += ch;
  }
  return out.map(({ decl, within }) => {
    const i = decl.indexOf(":");
    return { prop: decl.slice(0, i).trim(), value: decl.slice(i + 1).trim(), within };
  });
}

const flourish = declarations(read("src/app/flourish.css"));
// 26.11.2 the front page's stage keeps the same rules (app/tour.css)
const tour = declarations(read("src/app/tour.css"));
const moving = [...flourish, ...tour];
const QUIET = "@media (prefers-reduced-motion: no-preference)";
const GUARD = "html.fd-motion:not(.fd-calm)";

test("keyframes move only transform and opacity", () => {
  const frames = moving.filter((d) => d.within.some((w) => w.startsWith("@keyframes")));
  assert.ok(frames.length > 4); // 26.11.4 fewer: the stage and the closing scene now move with the scroll instead
  for (const d of frames) assert.ok(["transform", "opacity"].includes(d.prop), `${d.within.join(" > ")}: ${d.prop}`);
});

test("transitions move only transform or opacity", () => {
  for (const d of moving.filter((x) => x.prop === "transition"))
    for (const part of d.value.split(","))
      assert.match(part.trim(), /^(transform|opacity)\s/, `${d.within.at(-1)}: ${d.value}`);
});

test("every animation and transition stops for less motion and for Reduce effects", () => {
  const animated = moving.filter((d) => /^(animation|transition)(?!-(?:delay|property))/.test(d.prop) && !d.within.some((w) => w.startsWith("@keyframes")));
  assert.ok(animated.length >= 12);
  for (const d of animated) {
    if (d.within.at(-1).includes(":not([data-ready])")) continue; // tour.css: the 4 s safety net that shows the Studio
    assert.ok(d.within.includes(QUIET), `${d.within.at(-1)} is outside ${QUIET}`);
    for (const sel of d.within.at(-1).split(","))
      assert.ok(sel.trim().startsWith(GUARD), `${sel.trim()} is not behind ${GUARD}`);
  }
});

test("endless loops run only while on screen", () => {
  // 26.11.2 the hero's loops are gone with the hero; any loop that comes back keeps the rule
  const loops = moving.filter((d) => d.prop === "animation" && /\binfinite\b/.test(d.value));
  for (const d of loops) assert.match(d.value, /\bpaused$/, `${d.within.at(-1)} must start paused`);
  const running = moving.filter((d) => d.prop === "animation-play-state" && d.value === "running");
  for (const d of running) for (const sel of d.within.at(-1).split(",")) assert.match(sel, /\[data-live\]/);
});

test("one timing language: about a third of a second, rising 8 px", () => {
  const motion = read("src/app/motion.css");
  assert.match(motion, /--t-move: 0\.35s;/);
  assert.match(motion, /@keyframes fd-reveal \{\s*from \{\s*opacity: 0;\s*transform: translate3d\(0, 8px, 0\);/);
  assert.match(motion, /\[data-reveal\]\[data-in\] \{\s*animation: fd-reveal var\(--t-move\)/);
  for (const d of flourish.filter((x) => x.prop === "transition")) assert.match(d.value, /var\(--t-move\) var\(--ease-out\)/);
});

test("the finishing touches load after the page appears, and their hooks are in place", () => {
  assert.match(read("src/components/landing/flourish-later.tsx"), /dynamic\(\(\) => import\("@\/components\/landing\/flourish"\), \{ ssr: false \}\)/);
  assert.match(read("src/components/landing/flourish.tsx"), /import "@\/app\/flourish\.css";/);
  const landing = read("src/components/landing.tsx");
  assert.match(landing, /<FlourishLater \/>/);
  assert.match(landing, /<p className="lp-assemble" style=\{\{ display: "none" \}\} aria-hidden="true">/);
  assert.match(landing, /<details key=\{f\.q\} data-spotlight=""/);
  const download = read("src/components/download-panel.tsx");
  assert.match(download, /<FlourishLater \/>/);
  assert.match(download, /className="fd-dl-card"[^>]*data-spotlight=""/);
});
