#!/usr/bin/env bash
# FRAMEDECKS - an encrypted copy of the workspace database (free plan, docs/project/database-backup.md).
#   tools/db_backup.sh <out-folder>
# Needs SUPABASE_DB_URL (the Session pooler URI, password included) and BACKUP_PASSPHRASE in the environment.
# Writes <out-folder>/framedecks-backup-<UTC time>.tar.enc: everything FRAMEDECKS keeps (schema public, schema and
# data) plus the sign-in accounts (auth.users, auth.identities, data only), packed and encrypted with AES-256
# (openssl, PBKDF2). Nothing unencrypted is left behind. Restore: docs/project/database-backup.md.
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
printf 'FRAMEDECKS database backup %s\npublic.dump: schema public (pg_restore)\nauth.dump: auth.users, auth.identities (data only)\n' \
  "$stamp" > "$work/README.txt"
tar -C "$work" -cf "$work/backup.tar" public.dump auth.dump README.txt
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE \
  -in "$work/backup.tar" -out "$out/framedecks-backup-$stamp.tar.enc"
echo "Backup written: $out/framedecks-backup-$stamp.tar.enc ($(stat -c %s "$out/framedecks-backup-$stamp.tar.enc") bytes)"
