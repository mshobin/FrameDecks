# Post-migration report: steps 1–3

The record of what the [migration plan](migration-plan.md) changed so far, how each change was checked, and what is
left. It covers steps 1–3, the ones that needed no owner decision. They were built on 25 October 2026 on PR #32
(branch `claude/peaceful-albattani-6m445e`). Steps 4–8 wait for decisions M-D1–M-D6 (plan §8). This report gains a
section as each one is done.

**Who this is for:** the owner, who runs the database script and the live checks, and maintainers.

**Nothing visible changed.** The desktop UI, branding, Settings and the companion's pages are as they were. No
feature, API or integration was removed or renamed:
- virtual camera, OBS pages, Share Window, PowerPoint;
- sync, companion control, Stream Deck.

---

## Step 1: audit log of people and computers

| | |
|---|---|
| What | `hosted/supabase/migrations/0006_audit_log.sql`: an `audit_log` table written only by triggers |
| Logged | Members joining, leaving, changing role or "Can run services"; invitations sent and removed (accepted or cancelled); computers linked and unlinked. Each entry has who (the signed-in person, or none for a PC), what, about whom, and when |
| Who reads it | Owners and admins of the workspace (RLS). Nobody can write, change or delete entries; the trigger function cannot be called directly |
| Kept | One year; older entries are dropped as new ones arrive. Deleting a workspace deletes its log |
| Visible | Nothing yet: no page reads it |
| Undo | `hosted/supabase/rollback/0006_audit_log_down.sql` (drops the triggers, functions and table; nothing else changes) |
| Checked | 8 tests in `hosted/tests/supabase-audit.test.mjs` on PGlite: each action, who did it, a no-change update not logged, an unlink logged once, read and write rights, the one-year limit, workspace deletion, the undo script. Hosted suite 76/76, lint clean |
| Owner | Run `0006_audit_log.sql` in the Supabase SQL editor after `0005` ([live test guide](qa/live-test-guide.md) §1) |

## Step 2: the ESV key in Windows Credential Manager

| | |
|---|---|
| What | `server.py` keeps the user's ESV API key in Credential Manager (`FRAMEDECKS/esv-key`). This is the same store as the PC's sync key (`cloud_sync.SecretStore`, which now takes a target name; the sync key's own name is unchanged) |
| Moving an existing key | A key saved by an older version in `bcc-scripture.json` is moved the first time it is read. It leaves the file only after the store reads it back. If Credential Manager fails, the key stays in the file and Scripture works as before |
| Visible | Nothing: Settings → Scripture shows and saves the key the same way, with the same replies |
| Elsewhere | Off Windows (development, tests) the store is `.kc-esv-key`, readable only by its owner (git-ignored) |
| Undo | Revert the commit. An older version finds no key in the file, so the user types it once more |
| Checked | 4 tests in `tests/test_esv_key.py`: the move, saving and clearing, a failing store, no key. Also checked against the real program: an old file's key was moved; a new key was saved to the store and not the file; the file kept only the translation |

## Step 3: missing-media check

| | |
|---|---|
| What | `server.py` `media_check`: the Frames whose pictures, videos or PDFs are not in this PC's media folder, found from file names only (audit C8) |
| Where it shows | `GET /api/media/check` (this PC only), and `missingMedia` in Diagnostics. When a sync brings a Frame that names files this PC lacks, one line goes to `kc-app-log.txt`, once per new set |
| Visible | Nothing on screen |
| Not built yet | Size and hash in sync records (asset references). Two PCs holding different files under one name would keep rewriting each other's reference; this needs a small design first. Showing the check on screen also waits: one line in an existing status text needs the owner's approval |
| Undo | Revert the commit; nothing is stored |
| Checked | 4 tests in `tests/test_media_check.py`: which Frames are listed (templates and unchosen files are skipped); odd and hostile names; Diagnostics; the log line after a sync, said once. Also checked against the real program: the endpoint and Diagnostics answer, and the dashboard loads |

## Also: explicit Data API grants (`0007`)

| | |
|---|---|
| Why | From 30 October 2026, Supabase gives tables created after that date no API access unless they are granted. `0002`–`0006` had not been run yet, so the companion would have been cut off from their tables |
| What | `0007_data_api_grants.sql` grants signed-in people exactly what each table's RLS policies allow, and nothing to `anon`. It is safe to run again. Undo: `rollback/0007_data_api_grants_down.sql` |
| Checked | The PGlite stand-in now grants nothing by itself. Without `0007` the tests fail with "permission denied"; with it, 77/77 pass. A schema test fails if a table the companion uses is not granted |
| Owner | Run `0007` after `0006` |

## Step 4: licence and free code signing (M-D1)

| | |
|---|---|
| What | `LICENSE` (Apache 2.0, the canonical text), `NOTICE`, `THIRD_PARTY_NOTICES.md` (every shipped component and its licence), `"license": "Apache-2.0"` in both `package.json` files. README and CONTRIBUTING are updated, and the README has a code signing policy |
| Installer | The three files are copied into the program folder (`packaging/framedecks.spec`); `packaging/check.py` requires them |
| Signing | `build-windows.yml` signs `FRAMEDECKS.exe`, both camera DLLs and the installer through SignPath. It checks each signature and fails the build if one is missing. It is **off** until the `SIGNPATH_API_TOKEN` secret exists; until then the build is unchanged |
| Visible | Nothing in the program. Once signing is on, Windows shows "FRAMEDECKS" as a verified publisher |
| Owner | Follow [code-signing.md](project/code-signing.md): check, then make the repository public; apply to SignPath Foundation; add the secret and three variables |
| Checked | Packaging check, Python and JS suites, hosted 77/77, Stream Deck tests and `validate`, `npm ci` with both lockfiles. The SignPath steps cannot be run until SignPath approves the project |

## Validation after the three steps

| Check | Result |
|---|---|
| Python (`python -m unittest discover -s tests -p "test_*.py"`) | 109 tests OK (101 before) |
| Desktop JS (`node tests/run.js`) | 4/4 |
| Packaging (`python packaging/check.py`) | Passed (6.10) |
| Hosted (`npm test`, `npm run lint` in `hosted/`) | 76/76 (68 before), lint clean |
| Docs (`python tools/check_doc_links.py`, `git diff --check`) | 0 problems |
| CI on the PR | See PR #32 |

**Not checked here** (the owner's [live test guide](qa/live-test-guide.md)):
- `0006` against live Supabase;
- Credential Manager on a real Windows PC (the sync key's first live use is in the same test);
- the installed program.

## Against the target architecture

| Rule | After steps 1–3 |
|---|---|
| Audit logging | Workspace changes to people and computers are logged. Record history (30 days) and the command log (7 days) as before |
| No secrets in plain text on PCs | Met: both secrets the PC holds (sync key, ESV key) are in Credential Manager |
| Media local-first | Unchanged ($0 cloud); missing files are now found before the service |
| Cloud outages do not stop presenting | Unchanged: none of the three steps is in the presenting path |
| Member data cloud-centric | Not yet: M-D2 |
| Free AI, PPTX export, audio, groups, licence and signing | Not yet: M-D3, M-D4, M-D6, M-D1 |
