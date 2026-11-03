"""FrameDecks - lays out one release for Cloudflare R2 (7.0; docs/deployment/release-pipeline.md).

Given the built installer, it writes the folder that the workflow uploads to the bucket behind downloads.framedecks.com:

    releases/<version>/FrameDecks-<version>-Setup.exe      the installer (never changes once published)
    releases/<version>/FrameDecks-<version>-Setup.exe.sha256
    releases/<version>/manifest.json                       this release's manifest
    releases/latest.json                                   the newest manifest (api.framedecks.com/releases/latest)
    releases/index.json                                    every release, newest first
    latest/FrameDecks-Setup.exe                            always the newest installer (the download page's fallback)

9.2: with the MANIFEST_SIGNING_KEY environment variable (the release workflow's secret) the manifests are signed
(src/manifest_sig.py). Once src/updater.py trusts a key, publishing without that key is refused, so a release can never
reach programs that would reject it.

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
import os
import re
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import ed25519  # noqa: E402
import manifest_sig  # noqa: E402

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


def version_tuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", str(v or "")))[:4]


def internal_lines(notes):
    return [line for line in notes.splitlines() if INTERNAL.search(line)]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def trusted_keys():
    """TRUSTED_KEYS from src/updater.py, read without importing the program."""
    text = (ROOT / "src" / "updater.py").read_text(encoding="utf-8")
    block = re.search(r"TRUSTED_KEYS = \{(.*?)\n\}", text, re.S).group(1)
    return dict(re.findall(r'"([0-9a-f]{16})"\s*:\s*"([0-9a-f]{64})"', block))


def signing_key(env=None):
    """The private key from MANIFEST_SIGNING_KEY, checked against TRUSTED_KEYS. None when there is no key and none is
    needed yet; stops the release when the programs would not accept what would be published."""
    raw = (os.environ if env is None else env).get("MANIFEST_SIGNING_KEY", "").strip()
    trusted = trusted_keys()
    if not raw:
        if trusted:
            raise SystemExit("src/updater.py trusts a manifest key but MANIFEST_SIGNING_KEY is not set: programs would "
                             "reject this release. Add the secret (tools/manifest_key.py) and run the release again.")
        return None
    try:
        secret = bytes.fromhex(raw)
        assert len(secret) == 32
    except (ValueError, AssertionError):
        raise SystemExit("MANIFEST_SIGNING_KEY must be 64 hexadecimal characters (tools/manifest_key.py new)")
    kid = manifest_sig.key_id(ed25519.public_key(secret))
    if trusted and kid not in trusted:
        raise SystemExit(f"MANIFEST_SIGNING_KEY (key {kid}) is not in TRUSTED_KEYS in src/updater.py: programs would "
                         "reject this release.")
    return secret


def build(installer, out, version, date, index, signed, base=BASE, key=None):
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
    # 7.1.2: "latest" only ever moves forward. A version older than one already published is refused, so pushing an old
    # tag can never make the download page or new installs go back (rolling back is a deliberate owner step:
    # docs/deployment/release-pipeline.md, "Rollback").
    newest = max((e.get("version", "") for e in entries), key=version_tuple, default="")
    if newest and version_tuple(newest) > version_tuple(version):
        raise SystemExit(f"{version} is older than the published {newest}: refusing to make it the latest. "
                         "Bump APP_VERSION and tag the new version instead.")
    older = sorted((e for e in entries if version_tuple(e.get("version")) < version_tuple(version)),
                   key=lambda e: version_tuple(e.get("version")), reverse=True)
    prev = older[0] if older else None                   # the next lower version, whatever order they were published in
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
    if key:
        manifest = manifest_sig.sign(manifest, key)          # 9.2 signed: programs with the public key check it
    text = json.dumps(manifest, indent=2) + "\n"
    (folder / "manifest.json").write_text(text, encoding="utf-8")
    (out / "releases" / "latest.json").write_text(text, encoding="utf-8")
    entry = {"version": version, "released": date, "url": url, "sha256": digest, "size": size}
    releases = sorted([entry] + entries, key=lambda e: version_tuple(e.get("version")), reverse=True)   # newest first
    (out / "releases" / "index.json").write_text(json.dumps({"latest": version, "releases": releases}, indent=2) + "\n", encoding="utf-8")
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
        try:                                             # 7.1.2: an unreadable index is an error, never an empty list
            index = json.loads(Path(a.index).read_text(encoding="utf-8"))
        except ValueError as e:
            raise SystemExit(f"{a.index} is not valid JSON ({e}); nothing was published") from e
        if not isinstance(index, dict) or not isinstance(index.get("releases"), list):
            raise SystemExit(f"{a.index} has no release list; nothing was published")
    key = signing_key()
    m = build(a.installer, a.out, a.version or app_version(), a.date, index, a.signed, key=key)
    print(f"release {m['version']}: {m['downloadUrl']} sha256 {m['sha256']} ({m['size']} bytes)"
          + (f", previous {m['previous']['version']}" if m["previous"] else "")
          + (f", signed with key {m['signature']['key']}" if key else ", manifest not signed"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
