// FrameDecks 26.11.4 - Help search: one small index of everything Help can answer (the Help Center's topics, every
// guide page and its sections, the step-by-step guide, the error codes, the keys) and a plain scorer, so "black
// screen" or "FD-NET-02" finds the right place. Runs in the browser; no service, nothing sent anywhere.
// Self-contained (no imports), so tests/help-search.test.mjs loads it with Node's type stripping.

export type HelpEntry = { kind: string; title: string; text: string; href: string };

const STOP = new Set(["a", "an", "and", "the", "to", "of", "in", "on", "for", "is", "it", "my", "i", "how", "do", "can", "what", "with", "why", "does", "doesnt", "dont", "not", "wont", "cant"]);

/** Lower case, no accents or punctuation (keeps the dashes in FD-NET-02), split into words. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "")
    .split(/[^a-z0-9-]+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w && !STOP.has(w));
}

/** The best matches for what was typed: whole words in the title count most, then words in the text, then the
 *  start of a word ("fire" finds firewall). An error code typed exactly always comes first. */
export function searchHelp(index: readonly HelpEntry[], query: string, limit = 8): HelpEntry[] {
  const q = words(query);
  if (!q.length) return [];
  const code = /^fd-[a-z]{3}-\d\d$/i.test(query.trim()) ? query.trim().toUpperCase() : "";
  const scored = index.map((e, i) => {
    if (code && e.title.startsWith(code)) return { e, i, s: 1000 };
    const tw = words(e.title);
    const xw = words(e.text);
    let s = 0;
    let all = true;
    for (const w of q) {
      const inTitle = tw.includes(w) ? 6 : tw.some((t) => t.startsWith(w)) ? 3 : 0;
      const inText = xw.includes(w) ? 2 : xw.some((t) => t.startsWith(w)) ? 1 : 0;
      if (!inTitle && !inText) all = false;
      s += inTitle + inText;
    }
    if (all && q.length > 1) s += 4; // every word found: a better answer than one word found many times
    return { e, i, s };
  });
  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}
