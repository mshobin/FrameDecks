// FrameDecks - copies the legal texts (docs/legal/) and the user guides (docs/guide/) into hosted/content/, and the
// guides' pictures into public/docs/images/, so framedecks.com publishes exactly what the repository says
// (/terms, /privacy, /cookies, /eula, /security, /security/disclosure, /legal, /docs). Run before every build and
// `npm run dev`; the copies are committed, and tests/legal-pages.test.mjs fails if they are out of date. If the
// repository's docs are not next to the website (a host that copies only hosted/), the committed copies are kept.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const here = new URL("../", import.meta.url);

export const LEGAL = [
  "eula",
  "terms",
  "privacy",
  "cookies",
  "security",
  "vulnerability-disclosure",
  "THIRD_PARTY_NOTICES",
];

/** Every file to copy: [source in the repository, destination in hosted/]. */
export function contentFiles() {
  const out = LEGAL.map((n) => [`docs/legal/${n}.md`, `content/legal/${n}.md`]);
  for (const dir of ["docs/guide", "docs/guide/roles"]) {
    for (const f of readdirSync(new URL(dir, root))
      .filter((x) => x.endsWith(".md"))
      .sort()) {
      const rel = dir === "docs/guide" ? f : `roles/${f}`;
      out.push([`${dir}/${f}`, `content/guide/${rel}`]);
    }
  }
  for (const f of readdirSync(new URL("docs/guide/images", root)).sort())
    out.push([`docs/guide/images/${f}`, `public/docs/images/${f}`]);
  // this version's release notes: what /download shows if the update service cannot be reached
  const version = /^APP_VERSION = "([^"]+)"/m.exec(
    readFileSync(new URL("src/server.py", root), "utf8"),
  )?.[1];
  out.push([`docs/releases/v${version}.md`, "content/release-notes.md"]);
  return out;
}

/** 26.11.4 lists the website takes from the program's own files (one list each, never typed twice):
 *  [destination in hosted/, its text]. The error codes come from app/js/help-codes.js (between its markers). */
export function derivedFiles() {
  const js = readFileSync(new URL("app/js/help-codes.js", root), "utf8");
  const codes = JSON.parse(js.slice(js.indexOf("/* codes:start */") + 17, js.indexOf("/* codes:end */")));
  return [["content/help-codes.json", JSON.stringify(codes, null, 2) + "\n"]];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(new URL("docs/legal/eula.md", root))) {
    console.log(
      "write-content: the repository's docs are not here; keeping hosted/content",
    );
  } else {
    for (const [from, to] of contentFiles()) {
      const dest = new URL(to, here);
      mkdirSync(new URL(".", dest), { recursive: true });
      if (to.endsWith(".md"))
        writeFileSync(dest, readFileSync(new URL(from, root)));
      else copyFileSync(new URL(from, root), dest);
    }
    for (const [to, text] of derivedFiles()) writeFileSync(new URL(to, here), text);
    console.log("write-content: legal texts, guides and help lists copied");
  }
}
