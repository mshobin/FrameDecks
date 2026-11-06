// FrameDecks 26.11.4 - builds the Help search index at build time (server only): every guide page and its sections
// (content/guide, the same words as docs/guide), the step-by-step guide (help-guide.ts) and the error codes
// (content/help-codes.json, from app/js/help-codes.js). The Help Center adds its own topics in the browser.
import { readFileSync } from "node:fs";
import path from "node:path";

import codes from "../../content/help-codes.json";
import { GUIDE } from "@/lib/help-guide";
import { guides, slugify } from "@/lib/markdown";
import type { HelpEntry } from "@/lib/help-search";

const plain = (t: string) =>
  t
    .replace(/\*\*|`|_/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\|?[\s|:-]*-{3,}[\s|:-]*$/gm, "") // a table's divider row
    .replace(/\s*\|\s*/g, " · ") // its cells
    .replace(/^(\s*·\s*)+|(\s*·\s*)+$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
const cut = (t: string, n = 170) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export type HelpCode = { code: string; area: string; title: string; why: string; fix: string };
export const HELP_CODES = codes as HelpCode[];

export function helpIndex(): HelpEntry[] {
  const out: HelpEntry[] = [];
  for (const c of HELP_CODES)
    out.push({ kind: "Error code", title: `${c.code} · ${c.title}`, text: `${c.why} ${c.fix}`, href: `/help?code=${c.code}#codes` });
  for (const track of Object.values(GUIDE))
    for (const s of track.steps)
      out.push({ kind: "Step by step", title: s.title, text: cut(plain(`${s.why} ${s.steps.join(" ")}`)), href: "/help#getting-started" });
  for (const g of guides()) {
    out.push({ kind: "Guide", title: g.title, text: cut(plain(g.summary)), href: `/docs/${g.slug}` });
    const text = readFileSync(path.join(process.cwd(), "content", "guide", g.file), "utf8");
    const parts = text.split(/^## /m).slice(1);
    for (const part of parts) {
      const [head, ...rest] = part.split("\n");
      const para = rest.join("\n").trim().split(/\n\s*\n/)[0] ?? "";
      out.push({ kind: g.title, title: plain(head), text: cut(plain(para.replace(/^[-*|>#].*$/gm, (l) => l.replace(/^[-*|>#]+\s*/, "")))), href: `/docs/${g.slug}#${slugify(head)}` });
    }
  }
  return out;
}
