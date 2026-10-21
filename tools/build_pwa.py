"""FrameDecks - build the remote from anywhere (the PWA) for Cloudflare Pages (SaaS Phase 3, architecture §2, §14).

The remote's own files, copied unchanged from app/, plus js/cloud-config.js with the cloud's address. Everything the
service worker (app/sw.js) keeps for offline must be in the build; the check fails otherwise.

    python tools/build_pwa.py --api https://framedecks-api.example.workers.dev --out dist
"""
import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
FILES = ["remote.html", "stage.html", "remote-manifest.json", "sw.js",
         "css/remote.css", "css/teleprompter.css", "css/overlay.css",
         "js/cloud-remote.js", "js/store.js", "js/brand.js", "js/teleprompter.js", "js/remote.js", "js/overlay.js",
         "img/kc-emblem.webp", "icons/remote-180.png", "icons/remote-192.png", "icons/remote-512.png", "icons/remote-maskable-512.png",
         "fonts/EBGaramond.ttf", "fonts/SourceSans3.ttf", "fonts/OFL-EBGaramond.txt", "fonts/OFL-SourceSans3.txt"]
HEADERS = """/sw.js
  Cache-Control: no-cache
/js/cloud-config.js
  Cache-Control: no-cache
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
"""


def build(api, out):
    if not re.match(r"^https://[^/\s]+$|^http://(127\.0\.0\.1|localhost)(:\d+)?$", api.rstrip("/")):
        raise SystemExit("--api must be the cloud's https:// address")
    out = Path(out)
    if out.exists():
        shutil.rmtree(out)
    for f in FILES:
        (out / f).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(APP / f, out / f)
    (out / "js" / "cloud-config.js").write_text(
        "/* FrameDecks - written by tools/build_pwa.py: the cloud this remote signs in to. */\n"
        f"window.FD_CLOUD = {json.dumps({'api': api.rstrip('/')})};\n", encoding="utf-8")
    (out / "_headers").write_text(HEADERS, encoding="utf-8")
    (out / "index.html").write_text('<!doctype html><meta http-equiv="refresh" content="0; url=remote.html"><title>FrameDecks</title>', encoding="utf-8")
    shell = re.findall(r"'([^']+)'", re.search(r"SHELL = \[(.*?)\];", (APP / "sw.js").read_text(), re.S).group(1))
    missing = [f for f in shell if not (out / f).exists()]
    if missing:
        raise SystemExit("The service worker keeps files the build lacks: " + ", ".join(missing))
    return out


if __name__ == "__main__":
    a = argparse.ArgumentParser(description="Build the FrameDecks remote for Cloudflare Pages")
    a.add_argument("--api", required=True)
    a.add_argument("--out", default="dist")
    args = a.parse_args()
    out = build(args.api, args.out)
    print(f"Built {sum(1 for p in out.rglob('*') if p.is_file())} files in {out}")
