# Production audit, 3 November 2026 (FrameDecks 9.1.1, commit 55f973c)

Read-only review of the desktop server, frontend, vCam pipeline, updater and release pipeline, hosted website and
Supabase, sync, dependencies and documentation. Owner's request: report and recommend, change nothing without
approval. The owner then approved the 9.1.2 items below ("start 9.1.2").

**Scores:** security 68, production readiness 74, maintainability 70, performance 76, technical debt 35 (lower is
better). **Critical findings:** none. **Verdict:** GO for 9.1.1 (the High findings predate it); ship a 9.1.2
security patch; no wider distribution until the update chain is signed (H3, M3) and migration 0013 (H5) is in.

## High

| # | Finding | Status |
|---|---|---|
| H1 | Layer file names from the phone (`/api/state`) or cloud sync were joined onto the layers folder unchecked: a UNC name (`\\server\share\a.png`) made every linked PC connect out and leak the Windows sign-in hash; `..\` names put any local file on the camera | **Fixed in 9.1.2** (`src/media_names.py`, `clean_layer`, `scene_media`, `media_check`, `pptx_export`) |
| H2 | Phone PIN lockout raced: parallel guesses got ~150 tries a minute instead of 5; lockout reset after 60 s; no limit across devices | **Fixed in 9.1.2** (one lock; doubling wait that only a right PIN resets; 100 wrong PINs in 10 minutes from all devices together) |
| H3 | Updates trust the R2 bucket alone: the SHA-256 comes from the same bucket, Authenticode is checked only when the manifest says `signed: true`, substring publisher match | Open: 9.2 (Ed25519-signed manifest, Authenticode required once signing is on, exact signer, protected release environment) |
| H4 | The vCam DLL is registered machine-wide (elevated `regsvr32`) from a folder the user can write (`%LOCALAPPDATA%\Programs\FRAMEDECKS`); every update re-runs the elevated step | Open: later, high risk (admin-only folder via an elevated helper / MSI, re-register only when the DLL changes) |
| H5 | A workspace admin can demote then remove the owner (0001 `memberships_update`; 0002 fixed delete only), rewrite `user_id` / `organization_id`, and insert memberships directly | **Fixed by migration 0013** (`hosted/supabase/migrations/0013_protect_owner.sql`, rollback in `hosted/supabase/rollback/`, tests `hosted/tests/supabase-owner.test.mjs`); the owner runs it in Supabase |

## Medium

| # | Finding | Status |
|---|---|---|
| M1 | LAN denial of service before sign-in: no socket timeout, no per-device connection cap, 8 MB bodies accepted for the PIN form | **Fixed in 9.1.2** (90 s timeout, 24 connections per other device, 4 KB bodies until signed in) |
| M2 | Chat-copy parsing backtracked for seconds on long runs of spaces (2.15 s for one 4,000-character copy) | **Fixed in 9.1.2** (runs of spaces collapsed; header patterns only on lines up to 120 characters) |
| M3 | Code signing off; manifest `signed` flag set from a variable, not from the signing result | Open: 9.2 |
| M4 | A tag on any branch can publish (only the version is compared) | Open: 9.2 (tag ruleset, ancestor-of-main check, protected environment) |
| M5 | Python build dependencies pinned without hashes | Open: 9.2 |
| M6 | Anonymous `computer_link_start` can fill the global pending-link cap | Open: cloud hotfix |
| M7 | No Content-Security-Policy (desktop pages, website); website session in localStorage | Open: 9.3, report-only first |
| M8 | Imported ids pasted into CSS selectors could throw and break workspace actions | **Fixed in 9.1.2** (`cssq` in `workspace.js`, `CSS.escape` in `overlay.js`) |
| M9 | Full-frame copies every camera frame | Open: 9.3 |
| M10 | Long-polls serialise the whole state inside the lock | Open: 9.3 |
| M11 | Local overlays poll every 300 ms | Open: 9.3 |

## Low (selected)

- **Fixed in 9.1.2:** settings, studio, vCam, sessions, PIN and scripture files are written atomically
  (`write_atomic`), and app settings are saved under a lock. Scene ids are used as file names only when they are plain
  identifiers. Other devices are refused any path containing `..` or `\`. The camera bubbles now name WhatsApp,
  Messages and Phone (`chatcard.SRC_NAMES`), and a test keeps that list equal to `memory.APP_NAMES`.
- **Open:**
  - The state update race (`update_state` saves outside its lock).
  - Private cards are visible on the phone.
  - PowerPoint files open through COM without `AutomationSecurity`.
  - Updater edge cases: redirects, no downgrade check, environment override honoured when frozen.
  - The workflow `ref_name` sits inside a shell string.
  - Runner and Inno Setup versions are not pinned.
  - The `/connect` page shows the PC name from the URL.
  - Account deletion leaves some data behind.
  - Sync conflicts on records other than Frames.
  - Idle `remote_take` writes.
  - Backups are encrypted without a MAC.
  - The website is close to its size budget.
  - Text wrapping is quadratic on long words.
  - Excel `!ref` is not clamped; `.frame` imports have no size limit.

## Checked and fine

- **Desktop server:** the allowlist in `Handler.allowed`, CSRF and DNS-rebinding guards, `HttpOnly; SameSite=Strict`
  cookie, constant-time PIN compare. No eval, pickle or `shell=True`; no XXE; no SSRF.
- **Frontend:** hostile Memory Card text is always `textContent`. SheetJS 0.20.3 (patched).
- **Supabase:** RLS on all 16 tables; pairing stores only hashes; remote commands allowlisted.
- **Secrets:** none in the tree or history.
- **CI:** actions pinned by SHA; minimal token permissions; softcam commit verified.
- **AI artifacts:** none in code or docs ("Claude" appears only as a chat source app). 153 older commit messages
  carry attribution trailers; they are left in place, since removing them would need a history rewrite.

Tests for the 9.1.2 fixes: `tests/test_hardening.py`.
