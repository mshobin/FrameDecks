// The website must cost nothing while it sits open next to the program on an older PC (owner, 26 October):
// no endless animations, no animated blur, and frosted glass only on the sticky bars.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const dir = new URL("../src/app/", import.meta.url);
const css = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(new URL(f, dir), "utf8")]);

// Gentle loops (landing marquee, light beam, teleprompter) are allowed only if they stay still until they are on
// screen: every endless animation is declared paused, and only [data-live] (set by components/motion.tsx while the
// element is visible) lets it run. Under "reduce motion" or "Reduce effects" (html.fd-calm) none is declared at all.
test("no animation runs forever unless it is on screen", () => {
  for (const [file, text] of css) {
    for (const line of text.split("\n").filter((l) => /\binfinite\b/.test(l))) {
      assert.match(line, /\bpaused\b/, `${file}: an endless animation must start paused: ${line.trim()}`);
    }
    if (/\binfinite\b/.test(text)) {
      assert.match(text, /\[data-live\][^{]*\{\s*animation-play-state: running;/, `${file}: loops run only under [data-live]`);
      assert.match(text, /html\.fd-motion:not\(\.fd-calm\)[^{]*\{\s*animation:[^;]*infinite/, `${file}: loops stop with Reduce effects`);
    }
  }
  assert.match(readFileSync(new URL("../src/components/motion.tsx", import.meta.url), "utf8"), /toggleAttribute\("data-live", e\.isIntersecting\)/);
});

test("the stage light drifts for a while and then rests", () => {
  const motion = css.find(([f]) => f === "motion.css")[1];
  assert.match(motion, /\.fd-glow-navy \{\s*animation: fd-drift-a [^;]* 3 alternate;/);
  assert.match(motion, /\.fd-glow-gold \{\s*animation: fd-drift-b [^;]* 3 alternate;/);
});

test("revealed content is never left hidden", () => {
  const motion = css.find(([f]) => f === "motion.css")[1];
  assert.match(motion, /html\.fd-motion\.fd-reveal-ready \[data-reveal\]:not\(\[data-in\]\) \{\s*opacity: 0;/);
  const tsx = readFileSync(new URL("../src/components/motion.tsx", import.meta.url), "utf8");
  assert.match(tsx, /rootMargin: "0px 0px -8% 0px"/);
  assert.match(tsx, /e\.boundingClientRect\.bottom < 0/); // passed over by an anchor jump or a fast flick
  assert.match(tsx, /addEventListener\("scroll", onScroll, \{ passive: true \}\)/);
});

test("frosted glass only on the sticky bars and dialogs", () => {
  const design = css.find(([f]) => f === "design.css")[1];
  assert.ok((design.match(/backdrop-filter/g) || []).length <= 2, "design.css: backdrop-filter belongs on the two sticky bars only");
});
