"""FrameDecks - the GitHub release page, branded like the About screen (6.7).

Builds the release notes for one version: the About screen's header (assets/brand/framedecks-about-header.webp, captured from
the app by tools/make_readme_header.py: the logo, FrameDecks, the tagline, the motto and "Version X.Y"; its
alternative text uses the words in app/js/brand.js), then the notes from docs/releases/vX.Y.md in a fixed order:

    What's New · Enhancements · Fixes · Performance Improvements · Known Issues

A section the notes leave out is shown as "None in this version." Older notes without these sections are kept
as they are, under the header.

Usage:
    python tools/make_release_notes.py                       # this version (src/server.py APP_VERSION), to stdout
    python tools/make_release_notes.py --out dist/release-notes.md --repo owner/name --ref v6.7
    python tools/make_release_notes.py --check               # fails if a section is missing or the header shows another version

Standard library only (it runs on the GitHub build machine before anything is installed).
"""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECTIONS = ["What's New", "Enhancements", "Fixes", "Performance Improvements", "Known Issues"]
HEADER = "assets/brand/framedecks-about-header.webp"          # the About screen, captured by tools/make_readme_header.py
HEADER_VERSION = "assets/brand/framedecks-about-header.version"


def app_version():
    return re.search(r'APP_VERSION = "([^"]+)"', (ROOT / "src" / "server.py").read_text(encoding="utf-8")).group(1)


def brand_words():
    """The tagline and motto exactly as the About screen shows them (app/js/brand.js)."""
    js = (ROOT / "app/js/brand.js").read_text(encoding="utf-8")
    tagline = re.search(r"tagline:\s*'([^']+)'", js).group(1)
    found = re.search(r"motto:\s*\[([^\]]*)\]", js)        # the motto may be empty
    motto = " ".join(re.findall(r"'([^']+)'", found.group(1))) if found else ""
    return tagline, motto


def split_sections(text):
    """(lead, {section: body}) from Markdown with '## Section' headings; lead is the text before the first one."""
    parts = re.split(r"^##\s+(.+?)\s*$", text, flags=re.M)
    lead, found = parts[0], {}
    for i in range(1, len(parts), 2):
        found[parts[i].strip()] = parts[i + 1].strip()
    return lead.strip(), found


def canonical(name):
    """Match a heading to a section regardless of case and apostrophe style."""
    key = re.sub(r"[^a-z]", "", name.lower())
    for s in SECTIONS:
        if re.sub(r"[^a-z]", "", s.lower()) == key:
            return s
    return None


def header(version, repo, ref):
    """The About screen's header: the captured picture, with its words as the alternative text."""
    tagline, motto = brand_words()
    if repo:      # an image in a release body needs a full link; "?raw=true" also works for private repositories
        src = "https://github.com/%s/blob/%s/%s?raw=true" % (repo, ref or ("v" + version), HEADER)
    else:
        src = HEADER
    alt = " ".join(w for w in ["FrameDecks.", tagline + ".", motto, "Version %s" % version] if w)
    return "\n".join(['<p align="center"><img src="%s" alt="%s" width="900"></p>' % (src, alt), "", "---", ""])


def absolute_links(text, repo, ref):
    """Links relative to docs/releases/ become full GitHub links (a release page has no folder to be relative to)."""
    import posixpath

    def fix(m):
        target = m.group(2)
        if re.match(r"^(https?:|mailto:|#)", target):
            return m.group(0)
        path, _, anchor = target.partition("#")
        full = posixpath.normpath(posixpath.join("docs/releases", path))
        return "%s(https://github.com/%s/blob/%s/%s%s)" % (m.group(1), repo, ref, full, "#" + anchor if anchor else "")
    return re.sub(r"(\]\s*)\(([^)\s]+)\)", fix, text)


def build(version, repo=None, ref=None):
    src = ROOT / "docs/releases" / ("v%s.md" % version)
    if not src.exists():
        raise SystemExit("No release notes for %s: write %s" % (version, src.relative_to(ROOT)))
    text = src.read_text(encoding="utf-8")
    text = re.sub(r"\A#{1,2}\s+FrameDecks v[\d.]+\s*\n", "", text)  # prior release headings remain readable
    if repo:
        text = absolute_links(text, repo, ref or ("v" + version))
    lead, found = split_sections(text)
    named = {canonical(k): v for k, v in found.items() if canonical(k)}
    out = [header(version, repo, ref)]
    if not named:                                                         # older notes: keep them as written
        out.append(text.strip())
        return "\n".join(out) + "\n"
    if lead:
        out += [lead, ""]
    for s in SECTIONS:
        out += ["## " + s, "", named.get(s) or "_None in this version._", ""]
    others = [k for k in found if not canonical(k)]
    for k in others:                                                      # extra sections (e.g. Install) go last
        out += ["## " + k, "", found[k], ""]
    return "\n".join(out).rstrip() + "\n"


def check(version):
    src = ROOT / "docs/releases" / ("v%s.md" % version)
    if not src.exists():
        return ["missing %s" % src.relative_to(ROOT)]
    hv = ROOT / HEADER_VERSION
    shown = hv.read_text(encoding="ascii").strip() if hv.exists() else "?"
    if shown != version:
        return ["%s shows version %s, not %s: run tools/make_readme_header.py" % (HEADER, shown, version)]
    _, found = split_sections(src.read_text(encoding="utf-8"))
    have = {canonical(k) for k in found}
    return ["%s: no '## %s' section" % (src.relative_to(ROOT), s) for s in SECTIONS if s not in have]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--version", default=None)
    ap.add_argument("--repo", default=None, help="owner/name, for the logo link")
    ap.add_argument("--ref", default=None, help="tag or commit the logo is read from (default v<version>)")
    ap.add_argument("--out", default=None)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    version = a.version or app_version()
    if a.check:
        problems = check(version)
        for p in problems:
            print(p)
        print("release notes %s: %s" % (version, "ok" if not problems else "%d problems" % len(problems)))
        return 1 if problems else 0
    notes = build(version, a.repo, a.ref)
    if a.out:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(notes, encoding="utf-8")
        print("wrote", a.out)
    else:
        sys.stdout.buffer.write(notes.encode("utf-8"))   # the bullet in the tagline is not in Windows' console code page
    return 0


if __name__ == "__main__":
    sys.exit(main())
