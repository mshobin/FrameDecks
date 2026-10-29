// Server-only: turns the repository's Markdown (hosted/content/, copied by scripts/write-content.mjs) into the HTML of
// framedecks.com's legal pages and documentation, at build time. Links are rewritten so a published page never points
// into the (private) repository: a guide links to /docs/…, a legal text to its page, anything else inside the
// repository becomes plain text. Pictures come from /docs/images/. Mermaid diagrams are left out.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { Marked, type Tokens } from "marked";

const CONTENT = path.join(process.cwd(), "content");

export const LEGAL_ROUTES: Record<string, string> = {
  eula: "/eula",
  terms: "/terms",
  privacy: "/privacy",
  cookies: "/cookies",
  security: "/security",
  "vulnerability-disclosure": "/security/disclosure",
  THIRD_PARTY_NOTICES: "/legal#third-party",
};

/** GitHub-style heading ids, so "#before-you-start" anchors keep working. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

/** A guide file (relative to content/guide, e.g. "roles/media-team.md") to its address on the website. */
export function guideRoute(file: string): string {
  const name = file.replace(/\.md$/, "");
  if (name === "roles/README") return "/docs/roles";
  return `/docs/${name.replace("/", "-")}`;
}

/** Where a link written in a Markdown file under content/<area>/<dir> should go on the website, or null for none. */
export function rewriteHref(
  href: string,
  area: "guide" | "legal",
  fromDir = "",
): string | null {
  if (/^mailto:/i.test(href)) return href;
  if (/^https?:\/\//i.test(href))
    return /github\.com|githubusercontent\.com/i.test(href) ? null : href;
  if (href.startsWith("#")) return href;
  const [file, hash] = href.split("#");
  const anchor = hash ? `#${hash}` : "";
  if (area === "legal") {
    const name = path.basename(file).replace(/\.md$/, "");
    return name in LEGAL_ROUTES && file.endsWith(".md")
      ? LEGAL_ROUTES[name] + (LEGAL_ROUTES[name].includes("#") ? "" : anchor)
      : null;
  }
  const joined = path.posix.normalize(path.posix.join(fromDir, file));
  if (joined.startsWith("..") || !joined.endsWith(".md")) return null;
  return guideRoute(joined) + anchor;
}

function renderer(area: "guide" | "legal", fromDir: string) {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(
        this: { parser: { parseInline: (t: Tokens.Generic[]) => string } },
        { tokens, depth, text }: Tokens.Heading,
      ) {
        const inner = this.parser.parseInline(tokens);
        return `<h${depth} id="${slugify(text)}">${inner}</h${depth}>\n`;
      },
      link(
        this: { parser: { parseInline: (t: Tokens.Generic[]) => string } },
        { href, tokens }: Tokens.Link,
      ) {
        const inner = this.parser.parseInline(tokens);
        const to = rewriteHref(href, area, fromDir);
        if (!to) return `<span>${inner}</span>`;
        const external =
          /^https?:/i.test(to) && !/^https:\/\/framedecks\.com/i.test(to);
        return `<a href="${to}"${external ? ' target="_blank" rel="noreferrer"' : ""}>${inner}</a>`;
      },
      image({ href, text }: Tokens.Image) {
        const name = path.basename(href);
        return `<img src="/docs/images/${name}" alt="${text.replace(/"/g, "&quot;")}" loading="lazy">`;
      },
      code({ text, lang }: Tokens.Code) {
        if (lang === "mermaid") return "";
        return `<pre><code>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>\n`;
      },
      html() {
        return ""; // no raw HTML from the Markdown on the website
      },
    },
  });
  return marked;
}

export type Rendered = { title: string; html: string };

/** Render one Markdown text; the first "# Title" becomes the page title instead of part of the body. */
export function renderMarkdown(
  source: string,
  area: "guide" | "legal",
  fromDir = "",
): Rendered {
  const match = /^#\s+(.+)\n/m.exec(source);
  const title = match ? match[1].trim() : "";
  const body = match ? source.replace(match[0], "") : source;
  return {
    title,
    html: renderer(area, fromDir).parse(body, { async: false }) as string,
  };
}

export function legalPage(name: keyof typeof LEGAL_ROUTES | string): Rendered {
  return renderMarkdown(
    readFileSync(path.join(CONTENT, "legal", `${name}.md`), "utf8"),
    "legal",
  );
}

export type Guide = {
  file: string;
  slug: string;
  title: string;
  summary: string;
};

/** Every user guide, in reading order: getting started first, the roles last. */
export function guides(): Guide[] {
  const order = [
    "getting-started",
    "installation",
    "service-planning",
    "frames",
    "content",
    "presentations",
    "media",
    "remote-control",
    "ai",
    "troubleshooting",
    "faq",
    "glossary",
    "user-guide",
  ];
  const files = readdirSync(path.join(CONTENT, "guide"))
    .filter((f) => f.endsWith(".md"))
    .sort(
      (a, b) =>
        (order.indexOf(a.slice(0, -3)) + 1 || 99) -
        (order.indexOf(b.slice(0, -3)) + 1 || 99),
    );
  const roles = readdirSync(path.join(CONTENT, "guide", "roles"))
    .filter((f) => f.endsWith(".md"))
    .sort((a, b) =>
      a === "README.md" ? -1 : b === "README.md" ? 1 : a.localeCompare(b),
    )
    .map((f) => `roles/${f}`);
  return [...files, ...roles].map((file) => {
    const text = readFileSync(path.join(CONTENT, "guide", file), "utf8");
    const title = /^#\s+(.+)$/m.exec(text)?.[1].trim() ?? file;
    const summary = text
      .replace(/^#.*$/m, "")
      .trim()
      .split(/\n\s*\n/)[0]
      .replace(/\*\*|\[|\]\([^)]*\)|`/g, "")
      .replace(/\]/g, "");
    return {
      file,
      slug: guideRoute(file).replace("/docs/", ""),
      title,
      summary: summary.length > 180 ? `${summary.slice(0, 177)}…` : summary,
    };
  });
}

export function guidePage(slug: string): Rendered | null {
  const g = guides().find((x) => x.slug === slug);
  if (!g) return null;
  return renderMarkdown(
    readFileSync(path.join(CONTENT, "guide", g.file), "utf8"),
    "guide",
    path.posix.dirname(g.file) === "." ? "" : path.posix.dirname(g.file),
  );
}
