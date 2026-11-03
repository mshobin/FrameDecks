"""FrameDecks 9.2 - the key that signs release manifests (docs/deployment/release-pipeline.md, "Signed manifests").

    python tools/manifest_key.py new [--out FILE]
        Makes a new key pair on THIS computer. The private key goes to FILE (default: framedecks-manifest-key.txt
        in the current folder; never commit it); the public key and its id are printed. Then:
          1. GitHub: Settings > Secrets and variables > Actions > New repository secret, name MANIFEST_SIGNING_KEY,
             value = the private key (the one line in FILE). Then delete FILE or keep it offline.
          2. Put the printed line into TRUSTED_KEYS in src/updater.py (or send the public key to whoever releases).
        From the release that carries the key on, programs accept only manifests signed with it, and the workflow
        refuses to publish without the secret.

    python tools/manifest_key.py public FILE
        Prints the public key line for a private key file (to check which key a secret holds).
Standard library only.
"""
import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import ed25519  # noqa: E402
import manifest_sig  # noqa: E402


def read_secret(text):
    s = text.strip()
    if len(s) != 64:
        raise SystemExit("A manifest signing key is 64 hexadecimal characters.")
    try:
        return bytes.fromhex(s)
    except ValueError:
        raise SystemExit("A manifest signing key is 64 hexadecimal characters.")


def trusted_line(secret):
    public = ed25519.public_key(secret)
    return f'"{manifest_sig.key_id(public)}": "{public.hex()}",'


def main(argv=None):
    ap = argparse.ArgumentParser(description="Release manifest signing key")
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("new")
    n.add_argument("--out", default="framedecks-manifest-key.txt")
    p = sub.add_parser("public")
    p.add_argument("file")
    a = ap.parse_args(argv)
    if a.cmd == "new":
        out = Path(a.out)
        if out.exists():
            raise SystemExit(f"{out} already exists; choose another --out")
        secret = os.urandom(32)
        out.write_text(secret.hex() + "\n", encoding="ascii")
        try:
            os.chmod(out, 0o600)
        except OSError:
            pass
        print(f"Private key written to {out}. Add it as the GitHub secret MANIFEST_SIGNING_KEY, then delete the file.")
        print("Public key for TRUSTED_KEYS in src/updater.py:")
        print("    " + trusted_line(secret))
    else:
        print(trusted_line(read_secret(Path(a.file).read_text(encoding="ascii"))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
