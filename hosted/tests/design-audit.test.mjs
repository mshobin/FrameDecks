// Guards for the design audit's website items (docs/development/design-system.md): what each fix promised stays true.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const components = readdirSync(new URL("../src/components/", import.meta.url)).filter((f) => f.endsWith(".tsx"));
const css = ["globals.css", "design.css", "about.css", "motion.css", "identity.css", "landing.css", "landing-page.css", "plan.css", "help/guide.css", "light.css"].map((f) => [f, src(`app/${f}`)]);

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

test("the website is dark until sign-in; Light, Dark and Auto only in the signed-in workspace (26.11.2)", () => {
  const layout = src("app/layout.tsx");
  assert.match(layout, /if\(!\/sb-/); // not signed in: dark, before the first paint
  assert.match(layout, /help\|docs\|legal/); // the public pages: dark even when signed in
  assert.match(layout, /!document\.documentElement\.classList\.contains\('fd-dark-only'\)&&/);
  const nav = src("components/landing/nav.tsx");
  assert.doesNotMatch(nav, /ThemeToggle/);
  assert.match(nav, /root\.classList\.add\("fd-dark-only"\)/);
  assert.match(nav, /applySavedTheme\(\)/);
  assert.match(src("components/app-shell.tsx"), /<ThemeToggle \/>/);
  assert.match(src("components/theme-toggle.tsx"), /classList\.remove\("fd-dark-only"\)/);
  assert.match(src("components/theme-toggle.tsx"), /const light = !dark &&/);
  assert.doesNotMatch(src("app/landing-page.css"), /fd-light/);
});

test("the light theme is chosen before the first paint and can be changed (DD-23)", () => {
  assert.match(src("app/layout.tsx"), /localStorage\.getItem\('fd-theme'\)/);
  assert.match(src("app/layout.tsx"), /import "\.\/light\.css";/);
  assert.match(src("components/app-shell.tsx"), /<ThemeToggle \/>/);
});

test("the Overview is task first and the mission is said once (DD-24, DD-08)", () => {
  const overview = src("components/overview.tsx");
  assert.doesNotMatch(overview, /MISSION/);
  assert.match(overview, /<NextService /);
  assert.match(overview, /<FirstSteps /);
  assert.doesNotMatch(src("components/auth-shell.tsx"), /MISSION/);
});

test("four main places, Settings below, and church words (owner-approved, 27 October)", () => {
  const shell = src("components/app-shell.tsx");
  // 26.11.12 Service PCs and Manage Devices are one Devices page (Scan to join)
  for (const label of ["Home", "Plan", "Live", "People", "Branding", "Devices", "Help"]) {
    assert.match(shell, new RegExp(`label: "${label}"`), label);
  }
  assert.doesNotMatch(shell, /label: "(?:Running order|Meeting Form|Computers|Members|Service PCs|Manage Devices)"/);
  assert.match(src("app/plan/page.tsx"), /PlanPage/);
  assert.match(src("app/meeting/page.tsx"), /PlanPage/);
  assert.match(src("app/help/page.tsx"), /brand\.version/);
});

test("the landing page carries the owner's brief (27 October): approved words, every audience, motion back", () => {
  const landing = src("components/landing.tsx");
  assert.match(landing, /Prepare with Purpose\./);
  assert.match(landing, /Present with Excellence\./);
  assert.match(
    landing.replace(/\s+/g, " "),
    /From prayerful preparation to meaningful moments, FrameDecks keeps your entire service seamlessly connected across every screen, every stream, and every member of your team\./,
  );
  assert.match(landing, /Ready to Serve\?/);
  const parts = readdirSync(new URL("../src/components/landing/", import.meta.url)).map((f) => src(`components/landing/${f}`));
  const words = [landing, ...parts].join("\n");
  assert.doesNotMatch(words, /church|sunday|\bobs\b|\bcamo\b/i);
  assert.doesNotMatch(words, />[^<]*FRAMEDECKS/);
  assert.ok(landing.indexOf("Download for Windows") < landing.indexOf("Start a free workspace"));
  // 26.11.4 the sections below the stage rise in with the scroll and go back down with it (components/landing/rise.tsx)
  assert.match(landing, /data-rise/);
  assert.match(landing, /<Rise \/>/);
  const rise = src("components/landing/rise.tsx");
  assert.match(rise, /addEventListener\("scroll", kick, \{ passive: true \}\)/);
  assert.match(rise, /new IntersectionObserver/); // the listener only while a section is near the screen
  assert.doesNotMatch(rise, /preventDefault/);
  assert.match(words, /data-spotlight/);
  assert.equal(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).dependencies.gsap, undefined);
  // 26.11.2 the stage (components/landing/tour.tsx): the meeting builds itself on arrival (Frame, Decks, Content, then
  // the real Studio), then one real screenshot of the program per chapter, each with the app's own keys
  const tour = src("components/landing/tour.tsx");
  assert.match(landing, /<Tour/);
  // 26.11.26 three chapters after the Studio: Voice, Control, Together
  for (const k of ["V", "Right Ctrl", "Alt+Space", "Alt+→", "Ctrl+C"]) assert.ok(landing.includes(`k="${k}"`), k);
  assert.equal((landing.match(/^    id: "/gm) || []).length, 3);
  // the verse heard arrives on the meeting screen with the program's own word-in (app/css/overlay.css)
  assert.match(tour, /className="tr-screen"/);
  assert.match(src("app/tour.css"), /@keyframes tr-word-in/);
  assert.match(tour, /className="tr-band"/);
  // 26.11.3 Memory Cards: copied chat messages pop up as bubbles on the camera picture, the program's own overlay style
  assert.match(tour, /className="tr-mc-list"/);
  assert.ok(landing.includes('k="Ctrl+C"'), "Ctrl+C"); // the Teleprompter is the one live piece, in the program's own style
  for (const shot of ["studio", "cc-control", "follow"])
    assert.match(tour, new RegExp(`/product/${shot}\\.webp`), shot);
  assert.match(tour, /new IntersectionObserver/); // starts once on screen; the scroll listener only while the stage is near
  assert.match(tour, /addEventListener\("scroll", onScroll, \{ passive: true \}\)/);
  // 26.11.4 no replay: the flowchart shows for about a second, then the Studio takes over (at once on scroll), and
  // scrolling back to the top plays it backwards; a spring follows the scroll
  const hold = Number(tour.match(/const HOLD = (\d+);/)?.[1]);
  assert.ok(hold >= 1000 && hold <= 1500, `HOLD ${hold}`);
  assert.match(tour, /const TAKE = \d+;/);
  assert.match(tour, /function spring\(/);
  for (const text of [tour, src("app/tour.css"), landing]) assert.doesNotMatch(text, /replay|tr-replay/i);
  // 26.11.28 one gesture, one chapter (owner, 9 November): the page snaps to each chapter, a wheel, trackpad or finger
  // on the stage steps exactly one, each chapter's story then plays by itself, and after the stage the page scrolls freely
  assert.match(tour, /className="tr-snap"/);
  assert.match(landing, /className="tr-snap-rest"/);
  assert.match(src("app/tour.css"), /scroll-snap-type: y mandatory;/);
  assert.match(src("app/tour.css"), /scroll-snap-stop: always;/);
  assert.match(tour, /on\(\s*"wheel",/);
  assert.match(tour, /on\(\s*"touchmove",/);
  assert.match(tour, /signal: off\.signal/); // removed with the stage
  assert.match(tour, /const STORY = [\d.]+;/);
  assert.match(src("app/tour.css"), /animation: tr-fallback 0s 4s forwards;/);
  assert.match(landing, /FAQ\.slice\(0, 4\)/);
  assert.match(landing, /More questions/);
  assert.match(landing, /Every member of your team\./);
  assert.match(src("app/layout.tsx"), /import "\.\/identity\.css";\s*import "\.\/landing\.css";\s*import "\.\/light\.css";/);
  assert.doesNotMatch(src("app/identity.css"), /\.fd-ambient \{\s*display: none;/);
  assert.doesNotMatch(src("app/motion.css"), /filter: blur/);
});

test("the name is written FrameDecks wherever people read it", () => {
  for (const f of ["components/landing.tsx", "components/app-shell.tsx", "components/about-dialog.tsx", "app/layout.tsx", "app/help/page.tsx"]) {
    assert.doesNotMatch(src(f).replace(/github\.com\/mshobin\/FRAMEDECKS/g, ""), /FRAMEDECKS/, f);
  }
});

test("the About screen has its own light panel (readable after switching to Light)", () => {
  assert.match(src("app/light.css"), /html\.fd-light \.fd-about \{[\s\S]*?#ffffff/);
});
