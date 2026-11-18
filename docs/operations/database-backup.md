# Database backups: how they work and how to restore one

The free Supabase plan has no daily backups, so FrameDecks makes its own. The **Database backup** GitHub Action runs
every night at 04:23 Kuwait time. It saves an **encrypted** copy of the workspace database in a **private Cloudflare
R2 bucket** (`framedecks-backups`) and keeps each copy for 30 days. Setup is in
[free-hosting.md](../deployment/free-hosting.md), Part B, and the R2 bucket below.

## Where backups are kept (private R2 bucket)

Until 26.11.63 each backup was a workflow artifact. In a public repository anyone signed in to GitHub can download
artifacts, so backups now go to R2, which only your Cloudflare account can read. The workflow uploads to R2 when its
three secrets exist; while they do not, it keeps an artifact **only if the repository is private**, and in a public
repository it refuses to upload anywhere (the run fails, and you get an issue). After the first good copy in R2 it
deletes the backups earlier runs kept as artifacts.

Set it up once (about 10 minutes):
1. Cloudflare → **R2 Object Storage** → **Create bucket** → name `framedecks-backups`, location *Automatic*. Leave
   **Public access** off and add no custom domain.
2. Optional: the bucket → Settings → **Object lifecycle rules** → add a rule that deletes objects with prefix
   `backups/` after 30 days (the workflow also removes copies older than 30 days).
3. R2 → **Manage R2 API Tokens** → **Create API token**: permission **Object Read & Write**, *Apply to specific
   buckets only* → `framedecks-backups`, TTL as you like. Copy the **Access Key ID** and **Secret Access Key** (shown
   once).
4. GitHub → the repository → Settings → Secrets and variables → Actions → add `R2_BACKUP_ACCESS_KEY_ID`,
   `R2_BACKUP_SECRET_ACCESS_KEY` and (if not there yet) `CLOUDFLARE_ACCOUNT_ID`.
5. Actions → **Database backup** → Run workflow. It should end with `Kept in R2: framedecks-backups/backups/<date>/`
   and list the old artifacts it deleted.

**Who this is for:** the owner, and whoever helps them if the database is ever lost.

## What is in a backup

The file is `framedecks-backup-<date>.tar.enc`, in Cloudflare → R2 → `framedecks-backups` → `backups/<date>/`
(older backups, from before R2, were under the run's **Artifacts** in GitHub → Actions → Database backup).
It holds:
- `public.dump`: everything FrameDecks keeps. That is workspaces, people and roles, invitations, synced plans and
  members, history, linked PCs, groups, the audit log, and who may read what.
- `auth.dump`: the sign-in accounts (`auth.users`, `auth.identities`).
- `README.txt`: when it was made.

It is encrypted with AES-256 using your `BACKUP_PASSPHRASE`, and from 9.3 on each backup has a `.mac` file next to it
(an HMAC-SHA256 keyed from the same passphrase) that shows whether the backup was changed or damaged since. Without the passphrase nobody can read it, GitHub
included. **Lose the passphrase and the backups are lost too.**

Made by `tools/db_backup.sh`, which can also be run by hand on any machine with `pg_dump` 17 and `openssl`.

## Restore (only if the database is lost or damaged)

You need:
- **PostgreSQL 17 tools:** the "Command Line Tools" from the PostgreSQL installer for Windows, or WSL/Linux.
- **openssl:** Git for Windows includes it, at `C:\Program Files\Git\usr\bin\openssl.exe`.

1. **Download the backup.** Cloudflare → R2 → `framedecks-backups` → `backups/` → the latest date → download the
   `.tar.enc` file and its `.tar.enc.mac`. (A backup kept as an artifact: download it from the run and unzip it.)
1. **Check it was not changed** (needs Python 3, from the repository folder; the passphrase stays out of the command):
   ```powershell
   $env:BACKUP_PASSPHRASE = "YOUR PASSPHRASE"
   python tools/backup_mac.py verify framedecks-backup-DATE.tar.enc
   ```
   "exactly as it was made" means go on. Anything else: do not restore that file; take the run before it.
2. **Decrypt it** in PowerShell, replacing the passphrase and file name:
   ```powershell
   & "C:\Program Files\Git\usr\bin\openssl.exe" enc -d -aes-256-cbc -pbkdf2 -iter 200000 `
     -pass pass:"YOUR PASSPHRASE" -in framedecks-backup-DATE.tar.enc -out backup.tar
   tar -xf backup.tar
   ```
   "bad decrypt" means the passphrase is wrong.
3. **Choose where to restore:**
   - **A new free Supabase project** if the old one is gone. Create it in the same region. Do **not** run the
     `0001`–`0009` scripts first; the backup already holds everything.
   - **The same project** only if a person deliberately emptied it. Ask for help before doing this.
4. **Get the connection string.** In the target project: Project Settings → Database → Connection string → **Session
   pooler** URI, with the database password. Call it `TARGET` below.
5. **Restore, sign-in accounts first:**
   ```powershell
   pg_restore --no-owner -d "TARGET" auth.dump
   pg_restore --no-owner -d "TARGET" public.dump
   ```
   The message `schema "public" already exists` is expected and harmless. Any other error: stop and send it.
6. **If it is a new project, point everything at it:**
   - Update the GitHub secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the website build reads them), then
     redeploy.
   - Update the GitHub secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_DB_URL`.
   - Set the Authentication settings again: URL configuration, Google/Microsoft providers, SMTP.
   - **Link each PC again:** Settings → FrameDecks account → Unlink, then Link. The plan and members on each PC
     are kept and sync to the restored workspace.

## Tested
On 26 October 2026, against a local PostgreSQL, using a stand-in database with the same shape:
- the backup, decryption and restore round trip;
- no readable names in the encrypted file;
- "bad decrypt" with a wrong passphrase.

A first run against the live project happens when the owner presses **Run workflow** (free-hosting.md, Part B).
