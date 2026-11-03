"""FrameDecks - the integrity check of an encrypted database backup (production audit L14).

tools/db_backup.sh encrypts with AES-256-CBC, which hides the backup but does not show whether it was changed. This
adds an HMAC-SHA256 of the encrypted file, keyed from BACKUP_PASSPHRASE (so only someone with the passphrase can make
one), written next to it as <file>.mac. Restore checks it first (docs/operations/database-backup.md).

    python3 tools/backup_mac.py sign   <file.tar.enc>     writes <file.tar.enc>.mac
    python3 tools/backup_mac.py verify <file.tar.enc>     exit 0 when the file is exactly as backed up, 1 otherwise
The passphrase is read from the environment, never from the command line. Standard library only.
"""
import hashlib
import hmac
import os
import sys
from pathlib import Path

LABEL = b"FrameDecks backup MAC v1\0"


def key():
    p = os.environ.get("BACKUP_PASSPHRASE", "")
    if not p:
        raise SystemExit("BACKUP_PASSPHRASE is not set")
    return hashlib.sha256(LABEL + p.encode("utf-8")).digest()


def mac_of(path):
    h = hmac.new(key(), digestmod=hashlib.sha256)
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 2 or argv[0] not in ("sign", "verify"):
        raise SystemExit(__doc__)
    path = Path(argv[1])
    side = Path(str(path) + ".mac")
    if argv[0] == "sign":
        side.write_text(mac_of(path) + "\n", encoding="ascii")
        print(f"Integrity check written: {side.name}")
        return 0
    if not side.exists():
        print(f"No integrity check ({side.name}) next to the backup; it may predate 9.3. Restore it only if you trust its source.")
        return 1
    if hmac.compare_digest(side.read_text(encoding="ascii").strip(), mac_of(path)):
        print("The backup is exactly as it was made.")
        return 0
    print("The backup was changed or damaged after it was made (or the passphrase is different). Do not restore it.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
