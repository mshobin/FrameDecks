"""FrameDecks - lays out one release for Cloudflare R2 (7.0; docs/deployment/release-pipeline.md).

Given the built installer, it writes the folder that the workflow uploads to the bucket behind downloads.framedecks.com:

    releases/<version>/FrameDecks-<version>-Setup.exe      the installer (never changes once published)
    releases/<version>/FrameDecks-<version>-Setup.exe.sha256
    releases/<version>/manifest.json                       this release's manifest
    releases/latest.json                                   the newest manifest (api.framedecks.com/releases/latest)
    releases/index.json                                    every release, newest first
    latest/FrameDecks-Setup.exe                            always the newest installer (the download page's fallback)

The manifest is what the website's download page (hosted/src/lib/releases.ts) and the program's updater
(src/updater.py) read: version, date, download URL, SHA-256, size, the user-facing release notes, and the previous
release (for putting it back). The notes are checked: a release note must never name a file in the repository.

Usage (the workflow runs this; it works the same on any computer):
    python tools/make_release_manifest.py --installer "dist/FrameDecks v7.0.exe" --out publish \
        [--index previous-index.json] [--signed] [--version 7.0] [--date 2026-10-29]
Standard library only.
"""
import argparse
import hashlib
import json
import re
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://downloads.framedecks.com"
# what users must never see in release notes: repository paths and owner-only steps
INTERNAL = re.compile(r"(hosted/|supabase|\.sql\b|migrations/|src/|app/js/|\.github/|tools/|docs/)", re.I)


def app_version():
    return re.search(r'APP_VERSION = "([^"]+)"', (ROOT / "src" / "server.py").read_text(encoding="utf-8")).group(1)


def user_notes(markdown):
    """The notes from "## What's New" on: the sections users read, without the title and the install paragraph."""
    i = markdown.find("## What's New")
    body = markdown[i:] if i >= 0 else markdown
    return body.strip() + "\n"


def internal_lines(notes):
    return [line for line in notes.splitlines() if INTERNAL.search(line)]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def build(installer, out, version, date, index, signed, base=BASE):
    """Lay the release out under `out`; returns the manifest."""
    installer, out = Path(installer), Path(out)
    notes_file = ROOT / "docs" / "releases" / f"v{version}.md"
    notes = user_notes(notes_file.read_text(encoding="utf-8"))
    bad = internal_lines(notes)
    if bad:
        raise SystemExit(f"{notes_file.name}: release notes must not name repository files or owner steps:\n  " + "\n  ".join(bad))
    name = f"FrameDecks-{version}-Setup.exe"
    folder = out / "releases" / version
    folder.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(installer, folder / name)
    digest, size = sha256(installer), installer.stat().st_size
    (folder / f"{name}.sha256").write_text(f"{digest}  {name}\n", encoding="ascii")
    url = f"{base}/releases/{version}/{name}"
    entries = [e for e in (index or {}).get("releases", []) if e.get("version") != version]
    prev = entries[0] if entries else None
    manifest = {
        "version": version,
        "released": date,
        "downloadUrl": url,
        "sha256": digest,
        "size": size,
        "releaseNotes": notes,
        "minimumOs": "Windows 10 (64-bit)",
        "signed": bool(signed),
        "platforms": {"windows": {"url": url, "sha256": digest, "size": size, "file": name}},
        "previous": ({"version": prev["version"], "url": prev["url"], "sha256": prev["sha256"], "size": prev["size"]} if prev else None),
    }
    text = json.dumps(manifest, indent=2) + "\n"
    (folder / "manifest.json").write_text(text, encoding="utf-8")
    (out / "releases" / "latest.json").write_text(text, encoding="utf-8")
    entry = {"version": version, "released": date, "url": url, "sha256": digest, "size": size}
    (out / "releases" / "index.json").write_text(json.dumps({"latest": version, "releases": [entry] + entries}, indent=2) + "\n", encoding="utf-8")
    (out / "latest").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(installer, out / "latest" / "FrameDecks-Setup.exe")
    return manifest


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--installer", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--version", default=None)
    ap.add_argument("--date", default=time.strftime("%Y-%m-%d"))
    ap.add_argument("--index", default=None, help="the current releases/index.json, if any")
    ap.add_argument("--signed", action="store_true")
    a = ap.parse_args(argv)
    index = None
    if a.index and Path(a.index).exists():
        try:
            index = json.loads(Path(a.index).read_text(encoding="utf-8"))
        except ValueError:
            index = None
    m = build(a.installer, a.out, a.version or app_version(), a.date, index, a.signed)
    print(f"release {m['version']}: {m['downloadUrl']} sha256 {m['sha256']} ({m['size']} bytes)"
          + (f", previous {m['previous']['version']}" if m["previous"] else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
