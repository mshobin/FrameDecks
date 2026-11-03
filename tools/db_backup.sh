#!/usr/bin/env bash
# FrameDecks - an encrypted copy of the workspace database (free plan, docs/operations/database-backup.md).
#   tools/db_backup.sh <out-folder>
# Needs SUPABASE_DB_URL (the Session pooler URI, password included) and BACKUP_PASSPHRASE in the environment.
# Writes <out-folder>/framedecks-backup-<UTC time>.tar.enc: everything FrameDecks keeps (schema public, schema and
# data) plus the sign-in accounts (auth.users, auth.identities, data only), packed and encrypted with AES-256
# (openssl, PBKDF2). Nothing unencrypted is left behind. Restore: docs/operations/database-backup.md.
set -euo pipefail
out="${1:?usage: tools/db_backup.sh <out-folder>}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
mkdir -p "$out"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
stamp="$(date -u +%Y-%m-%dT%H%MZ)"
# grants are kept (the same roles exist in every Supabase project), so a restore keeps who may read what
pg_dump "$SUPABASE_DB_URL" --no-owner --schema=public --format=custom --file="$work/public.dump"
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges --data-only --table=auth.users --table=auth.identities \
  --format=custom --file="$work/auth.dump"
printf 'FrameDecks database backup %s\npublic.dump: schema public (pg_restore)\nauth.dump: auth.users, auth.identities (data only)\n' \
  "$stamp" > "$work/README.txt"
tar -C "$work" -cf "$work/backup.tar" public.dump auth.dump README.txt
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE \
  -in "$work/backup.tar" -out "$out/framedecks-backup-$stamp.tar.enc"
# 9.3 (audit L14): an HMAC of the encrypted file, keyed from the passphrase, so a changed or damaged backup is caught
python3 "$(dirname "$0")/backup_mac.py" sign "$out/framedecks-backup-$stamp.tar.enc"
echo "Backup written: $out/framedecks-backup-$stamp.tar.enc ($(stat -c %s "$out/framedecks-backup-$stamp.tar.enc") bytes)"
# Prove the copy can be restored (audit roadmap step 2): decrypt it again, unpack it and let pg_restore read both
# archives' tables of contents. A backup that cannot be read fails this run instead of failing on the day it is needed.
check="$work/check"
mkdir -p "$check"
python3 "$(dirname "$0")/backup_mac.py" verify "$out/framedecks-backup-$stamp.tar.enc"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE \
  -in "$out/framedecks-backup-$stamp.tar.enc" | tar -C "$check" -xf -
tables=$(pg_restore --list "$check/public.dump" | grep -c "TABLE DATA" || true)
pg_restore --list "$check/auth.dump" > /dev/null
[ "$tables" -gt 0 ] || { echo "The backup holds no table data" >&2; exit 1; }
sha256sum "$out/framedecks-backup-$stamp.tar.enc" | sed "s|$out/||" > "$out/framedecks-backup-$stamp.tar.enc.sha256"
echo "Backup verified: it decrypts, unpacks and lists $tables tables with data."
