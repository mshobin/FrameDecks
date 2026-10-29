// 7.0, FrameDecks as a commercial product: legal and security pages from the repository's own texts, a footer with
// every required link, no road to the source repository, a cookie notice, explicit acceptance of the terms, and a
// download page fed by the release manifest.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";

import { contentFiles } from "../scripts/write-content.mjs";
import { CONSENT_VERSION, readConsent, saveConsent } from "../src/lib/consent.ts";
import { TERMS_VERSION, rememberAcceptance, takeAcceptance } from "../src/lib/legal.ts";
import { detectOs, downloadState, noteBlocks, parseRelease } from "../src/lib/releases.ts";

const root = new URL("../../", import.meta.url);
const here = new URL("../", import.meta.url);
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const mem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
};

test("the published legal texts and guides are the repository's own (run npm run build to refresh)", () => {
  for (const [from, to] of contentFiles()) {
    assert.ok(existsSync(new URL(to, here)), `${to} is missing`);
    assert.ok(readFileSync(new URL(from, root)).equals(readFileSync(new URL(to, here))), `${to} is out of date with ${from}`);
  }
});

test("LICENSE carries the EULA, and the legal texts share one version", () => {
  const license = readFileSync(new URL("LICENSE", root), "utf8");
  assert.match(license, /^FrameDecks Proprietary Software License/);
  assert.ok(license.includes(readFileSync(new URL("docs/legal/eula.md", root), "utf8")));
  assert.doesNotMatch(license, /Apache License\s+Version 2\.0, January 2004/);
  for (const n of ["eula", "terms", "privacy", "cookies"]) {
    assert.match(readFileSync(new URL(`docs/legal/${n}.md`, root), "utf8"), new RegExp(`Version ${TERMS_VERSION}`), n);
  }
});

test("the footer links to every page it promises, and each page exists", () => {
  const footer = src("components/site-footer.tsx");
  const wanted = ["/download", "/#features", "/roadmap", "/docs", "/help", "/about", "/contact", "/terms", "/privacy", "/cookies", "/eula", "/security", "/security/disclosure", "/status"];
  for (const href of wanted) assert.match(footer, new RegExp(`href: "${href.replace(/[/#]/g, "\\$&")}"`), href);
  for (const href of wanted.filter((h) => !h.includes("#"))) {
    assert.ok(existsSync(new URL(`../src/app${href}/page.tsx`, import.meta.url)), `no page for ${href}`);
  }
  assert.match(footer.replace(/\s+/g, " "), /© 2026 Shobin Mathews\. All rights reserved\. FrameDecks is proprietary software/);
  assert.match(src("components/landing.tsx"), /<SiteFooter \/>/);
  assert.match(src("components/public-page.tsx"), /<SiteFooter \/>/);
});

test("nothing on the website points to the source repository or calls FrameDecks open source", () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const url = new URL(name, dir);
      if (statSync(url).isDirectory()) walk(new URL(`${name}/`, dir));
      else if (/\.(tsx|ts)$/.test(name)) files.push(url);
    }
  };
  walk(new URL("../src/", import.meta.url));
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, /github\.com\/mshobin/i, f.pathname);
    assert.doesNotMatch(text.replace(/\/\/.*$/gm, ""), /open[ -]source|Apache 2\.0 licence/i, f.pathname);
  }
  assert.match(src("lib/pc-setup.ts"), /export const DOWNLOADS = "\/download";/);
  assert.equal(JSON.parse(readFileSync(new URL("package.json", here), "utf8")).license, "UNLICENSED");
});

test("published Markdown never links into the repository", async () => {
  const { rewriteHref, renderMarkdown } = await import("../src/lib/markdown.ts");
  assert.equal(rewriteHref("https://github.com/mshobin/FRAMEDECKS/blob/main/x.md", "guide"), null);
  assert.equal(rewriteHref("../development/testing.md", "guide"), null);
  assert.equal(rewriteHref("frames.md#steps", "guide"), "/docs/frames#steps");
  assert.equal(rewriteHref("../getting-started.md", "guide", "roles"), "/docs/getting-started");
  assert.equal(rewriteHref("README.md", "guide", "roles"), "/docs/roles");
  assert.equal(rewriteHref("eula.md", "legal"), "/eula");
  assert.equal(rewriteHref("../../LICENSE", "legal"), null);
  const out = renderMarkdown("# T\n\nSee [x](../development/a.md) and [y](https://ollama.com).\n\n<script>alert(1)</script>\n\n```mermaid\nflowchart\n```\n", "guide");
  assert.equal(out.title, "T");
  assert.doesNotMatch(out.html, /development|<script|flowchart/);
  assert.match(out.html, /<a href="https:\/\/ollama\.com" target="_blank" rel="noreferrer">y<\/a>/);
});

test("security.txt names the contact and the policy, and has not expired", () => {
  const txt = readFileSync(new URL("public/.well-known/security.txt", here), "utf8");
  assert.match(txt, /^Contact: mailto:security@framedecks\.com$/m);
  assert.match(txt, /^Policy: https:\/\/framedecks\.com\/security\/disclosure$/m);
  const expires = new Date(/^Expires: (.+)$/m.exec(txt)[1]);
  assert.ok(expires > new Date(), "security.txt has expired: renew it (at most a year ahead)");
});

test("the cookie notice is remembered for a year, for this version only", () => {
  const s = mem();
  assert.equal(readConsent(s), null);
  saveConsent(s, false, 1000);
  assert.deepEqual(readConsent(s, 2000), { version: CONSENT_VERSION, at: 1000, essential: true, analytics: false });
  assert.equal(readConsent(s, 1000 + 366 * 24 * 3600 * 1000), null);
  assert.match(src("app/layout.tsx"), /<CookieNotice \/>/);
});

test("creating an account needs the tick; it is recorded once, within a day", () => {
  const form = src("components/sign-in-form.tsx");
  assert.match(form, /const blocked = starting && !agreed;/);
  assert.match(form, /disabled=\{status\.kind === "sending" \|\| blocked\}/);
  assert.match(form, /disabled=\{blocked\} onClick=\{\(\) => signInWith\(provider\)\}/);
  const s = mem();
  rememberAcceptance(s, 0);
  assert.equal(takeAcceptance(s, 1000), true);
  assert.equal(takeAcceptance(s, 1000), false, "read once");
  rememberAcceptance(s, 0);
  assert.equal(takeAcceptance(s, 25 * 3600 * 1000), false, "too old");
  assert.match(src("components/app-shell.tsx"), /<LegalGate>\{children\}<\/LegalGate>/);
});

test("the download page trusts only manifests that point at downloads.framedecks.com", () => {
  const good = {
    version: "7.0",
    released: "2026-10-29",
    downloadUrl: "https://downloads.framedecks.com/releases/7.0/FrameDecks-7.0-Setup.exe",
    sha256: "a".repeat(64),
    size: 123,
    releaseNotes: "## What's New\n- **One** thing\n  continued\n## Fixes\n- None in this release.\n",
    platforms: { windows: { url: "https://downloads.framedecks.com/releases/7.0/FrameDecks-7.0-Setup.exe", sha256: "A".repeat(64), size: 123 } },
  };
  const r = parseRelease(good);
  assert.equal(r.version, "7.0");
  assert.equal(r.platforms.windows.sha256, "a".repeat(64));
  assert.equal(parseRelease({ ...good, downloadUrl: "https://evil.example/x.exe" }), null);
  assert.equal(parseRelease({ ...good, sha256: "nope" }), null);
  assert.equal(parseRelease({ ...good, version: "<b>7</b>" }), null);
  assert.deepEqual(noteBlocks(good.releaseNotes), [{ heading: "What's New", items: ["One thing continued"] }]);
  assert.equal(detectOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "windows");
  assert.equal(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"), "macos");
  assert.equal(detectOs("Mozilla/5.0 (X11; Linux x86_64)"), "linux");
  assert.equal(detectOs("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "other");
});

test("the download page offers a link only from a checked manifest, never a guessed address", () => {
  const good = parseRelease({
    version: "7.0",
    downloadUrl: "https://downloads.framedecks.com/releases/7.0/FrameDecks-7.0-Setup.exe",
    sha256: "a".repeat(64),
    size: 1,
  });
  assert.equal(downloadState(false, null), "checking");
  assert.equal(downloadState(true, null), "unavailable");
  assert.equal(downloadState(true, good), "ready");
  const panel = src("components/download-panel.tsx");
  assert.doesNotMatch(panel, /latest\/FrameDecks-Setup\.exe|LATEST_WINDOWS/);
  assert.match(panel, /Downloads open here very soon/);
});
