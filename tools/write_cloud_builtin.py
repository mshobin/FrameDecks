"""FrameDecks - writes src/cloud_builtin.json for the Windows build (9.10.3), so a new PC can link without first asking
the website for the cloud's address (cloud_sync.companion_config; the website stays the backup).

Reads SUPABASE_URL and SUPABASE_ANON_KEY (the repository secrets the keep-alive workflow already uses). Both are public
by design: the same two values every visitor's browser receives from the website. The file is git-ignored and made only
at build time. It refuses anything but the publishable (anon) key, so a secret or service_role key can never be built
into the program. Without the two values it writes nothing and the program asks the website, as before.

    python tools/write_cloud_builtin.py            # in the build (the workflow passes the secrets as environment)
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from cloud_sync import public_key_ok  # noqa: E402

OUT = ROOT / "src" / "cloud_builtin.json"


def make(env):
    """(content, message): the file's content, or None with the reason nothing is written."""
    url = str(env.get("SUPABASE_URL") or "").strip().rstrip("/")
    key = str(env.get("SUPABASE_ANON_KEY") or "").strip()
    if not url and not key:
        return None, "SUPABASE_URL / SUPABASE_ANON_KEY are not set: the program asks the website for them, as before."
    if not url.startswith("https://") or not key:
        return None, "SUPABASE_URL must be an https:// address and SUPABASE_ANON_KEY must be set."
    if not public_key_ok(key):
        return None, "SUPABASE_ANON_KEY is not the publishable (anon) key. A secret key is never built into the program."
    return {"url": url, "anonKey": key}, "Built in: " + url


def main():
    content, message = make(os.environ)
    if content is None:
        OUT.unlink(missing_ok=True)
        print(message)
        # a key that is set but wrong stops the build; no key at all is allowed (the website is used instead)
        return 1 if os.environ.get("SUPABASE_URL") or os.environ.get("SUPABASE_ANON_KEY") else 0
    OUT.write_text(json.dumps(content), encoding="utf-8")
    print(message)
    return 0


if __name__ == "__main__":
    sys.exit(main())
