// Guards for the design audit's website items (docs/design-system.md): what each fix promised stays true.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const components = readdirSync(new URL("../src/components/", import.meta.url)).filter((f) => f.endsWith(".tsx"));
const css = ["globals.css", "design.css", "about.css", "motion.css", "light.css"].map((f) => [f, src(`app/${f}`)]);

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("every page has a skip link target and one main landmark (DD-18)", () => {
  assert.match(src("app/layout.tsx"), /className="fd-skip" href="#main"/);
  for (const f of ["app-shell.tsx", "auth-shell.tsx", "landing.tsx"]) assert.match(src(`components/${f}`), /<main [^>]*id="main"/, f);
  assert.match(src("app/design.css"), /input:focus-visible/);
});

test("loading, empty and error states come from the state kit (DD-15)", () => {
  for (const f of components) {
    const text = src(`components/${f}`);
    assert.doesNotMatch(text, /className="page-note">Loading…</, f);
    assert.doesNotMatch(text, /className="page-note page-problem"/, f);
  }
  assert.match(src("components/services-panel.tsx"), /<ErrorState text=\{loaded\.error\} onRetry=\{load\} \/>/);
});

test("no text under 12 px, and the faintest text is 4.5:1 or more in both themes (DD-19)", () => {
  for (const [name, text] of css) assert.doesNotMatch(text, /font-size: (?:[0-9]|1[01])(?:\.\d+)?px/, name);
  const dark = src("app/globals.css").match(/--text-3: (#[0-9a-f]{6})/)[1];
  const light = src("app/light.css").match(/--text-3: (#[0-9a-f]{6})/)[1];
  for (const bg of ["#070c18", "#111a2f", "#1a2440"]) assert.ok(contrast(dark, bg) >= 4.5, `dark ${dark} on ${bg}`);
  for (const bg of ["#ffffff", "#f4f5f9"]) assert.ok(contrast(light, bg) >= 4.5, `light ${light} on ${bg}`);
});

test("gold is kept for the main action and the selection; links are neutral (DD-10)", () => {
  const rules = src("app/design.css").split("Gold discipline (design audit DD-10)")[1];
  assert.ok(rules, "the gold-discipline block is in design.css");
  assert.match(rules, /\.page-note a,[\s\S]*?color: var\(--text\);[\s\S]*?text-decoration: underline;/);
});

test("the light theme is chosen before the first paint and can be changed (DD-23)", () => {
  assert.match(src("app/layout.tsx"), /localStorage\.getItem\('fd-theme'\)/);
  assert.match(src("app/layout.tsx"), /import "\.\/light\.css";/);
  assert.match(src("components/app-shell.tsx"), /<ThemeToggle \/>/);
});

test("the Overview is task first and the mission is said once (DD-24, DD-08)", () => {
  const overview = src("components/overview.tsx");
  assert.doesNotMatch(overview, /MISSION/);
  assert.match(overview, /\{!selected && \(/);
  assert.doesNotMatch(src("components/auth-shell.tsx"), /MISSION/);
});
