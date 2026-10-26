# NEXT SESSION HANDOFF

Updated 26 October 2026 (evening): everything below is on `main` (`0afcc3b` or later). The next session may run in
VS Code (any assistant). Read [CLAUDE.md](../CLAUDE.md) first.

## Where things stand
- **`main`:** has 6.11, the website redesign, motion and About, workspace delete, and the three website settings
  (Branding, Transition style, Birthdays this week). All pushed; nothing waits on a branch.
- **Live:** website at `https://framedecks.pages.dev` (Cloudflare Pages, deploys from `main`); Google, Microsoft and
  email sign-in work; keep-alive and nightly backup run green. Database: `0001`–`0008` run.
- **Checks (cloud session, 26 October):** Python 128 OK; desktop JS 4/4; `packaging/check.py` 6.11; hosted 107/107,
  lint, typecheck and build pass. GitHub: "Hosted companion checks" and "Build Windows installer" green on `main`.

## Completed (merged to `main`, PRs #7–#31)
- Desktop 6.10, the approved emblem, and the drift cleanup.
- Hosted companion on Vercel: sign-in and workspaces confirmed live by the owner; members and invitations.
- Phase 4 sync of service plans, built and not yet live-tested:
  - database `0003`;
  - record mapping;
  - PC sync with Settings → FRAMEDECKS account;
  - companion Services / Members / Computers.
- Phase 5, control from the companion, built and not yet live-tested:
  - database `0004`/`0005`;
  - `cloud_remote.py`;
  - the Settings switch;
  - the Live page.
- Companion editing and 30-day Frame history with restore.
- The owner's live test guide.

## Completed on PR #32 (merged 26 October)
- **Audit:**
  - [architecture audit](../docs/project/2026-10-25-architecture-audit.md);
  - its Phase 1, P1–P4: writing, sync, image memory and screen-capture copying per press;
  - C2: `supervisor.py`, a crash watchdog in the installed exe.
- **Stream Deck plugin:**
  - `streamdeck/` (SDK 3, Node 24), calling the local `/api/command`;
  - CI builds the `.streamDeckPlugin`.
- **Target-architecture migration** (owner's brief):
  - [review](../docs/architecture-review.md), [plan](../docs/migration-plan.md) (owner decisions M-D1–M-D6 in §8),
    and [results](../docs/post-migration-report.md).
  1. `0006_audit_log.sql`: an audit log of people, roles, invitations and PCs.
  2. ESV key moved to Windows Credential Manager.
  3. Missing-media check: `/api/media/check` and Diagnostics.
  - `0007_data_api_grants.sql`: explicit grants for **Supabase's 30 October 2026 change**.
  4. M-D1: Apache 2.0 `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md`; SignPath signing in the Windows build, off until
     the secret exists.
  5. M-D2: the workspace is the member list's source.
     - The companion's Members page adds, edits and removes people.
     - A linked PC rebuilds a lost member file from the workspace.
  6. M-D3: free AI with Ollama on the PC.
     - **Suggest** drafts discussion questions from a Frame's passage, and is hidden without Ollama.
     - Code in `ai.py`; user guide [docs/ai.md](../docs/ai.md).
  7. M-D4: **Export this meeting to PowerPoint** (`pptx_export.py`) and **Audio** Content (`app/js/audio-player.js`).
  8. M-D6: `0008_member_groups.sql`; member groups on the companion's Members page only.
  - M-D5: long-term hosting recommendation, [docs/architecture/hosting.md](../docs/architecture/hosting.md).

## In progress: the free plan (owner's request, 26 October)
Steps, in order, from [docs/project/free-hosting.md](../docs/project/free-hosting.md):
1. **Companion as static files**: **live on Cloudflare Pages** at `https://framedecks.pages.dev` (26 October; Supabase
   Redirect URL `https://framedecks.pages.dev/auth/callback` added). The PC's built-in companion address
   (`cloud_sync.COMPANION_URL`) now points there; the next installer uses it. The owner signed in there with an emailed link
   (26 October). Owner: finish Part A step 7 (open each page) and retire Vercel after a quiet week (step 8).
2. **Keep-alive and encrypted nightly backup**: **code done** (`.github/workflows/db-keepalive.yml`,
   `db-backup.yml`, `tools/db_backup.sh`, restore guide `docs/project/database-backup.md`). **Live:** the owner added the 4 secrets; first runs on 26 October were green (keep-alive: the
   database answered; backup: `framedecks-backup-1`, 113 KB, kept to 25 November).
3. **Fewer database requests**: **done** (`cloud_remote.py` `IDLE_EVERY` 5 → 15 s). Shorter history/audit retention
   was left out on purpose (it would replace `sync_push` in the live database for almost no saving).
4. **Google/Microsoft sign-in first**: **code done** (`sign-in-form.tsx`: provider buttons above the email link when
   switched on). Owner: Part D. Google sign-in works (brand verification pending, retry
   after 24 h in Verification Center). Microsoft sign-in works too (26 October, after a settings fix). Brevo skipped by
   the owner: the email link stays on Supabase's built-in mail.
   Google needs a privacy policy link to publish: `hosted/src/app/privacy/page.tsx` (`/privacy`, linked under the
   sign-in card). Keep it true to what is stored if sync or members change.
5. Public repository, SignPath, GitHub Releases: **owner only** (Part E; the build already publishes on version tags).

**Branch state:** steps 1–4 are on `main` (pushed 26 October, together with the owner's sync-contract / legacy-6.9
work). `hosted/tsconfig.json` gained `allowImportingTsExtensions` so `src/lib/sync/legacy-6.9.mts` typechecks and
builds. Next: the owner's Parts A, B, D and E.

## In progress: 6.11 (owner's request, 26 October; design [meeting-form.md](../docs/architecture/meeting-form.md))
Owner decisions: W1 the website form edits the live plan; W2 keep Excel import in 6.11 but only under the program's
Settings; W3 6.12 removes Excel import, template and export (PowerPoint export stays).
1. **Camera check and "Open FRAMEDECKS on this PC"**: **built** (`hosted/src/lib/pc-setup.ts`,
   `hosted/src/components/pc-setup-card.tsx` on Overview; installer registers `framedecks:` for this user;
   `desktop_app.py` never reads the link; `tests/test_open_link.py`).
2. **Website Meeting Form**: **built** (`hosted/src/lib/meeting-form.ts` row ⇄ layer mapping, checked against the
   Excel import in `hosted/tests/meeting-form.test.mjs`; `hosted/src/components/meeting-form-panel.tsx` on
   `/meeting`: meeting details, add / edit / move / delete Frames and every Content type; conflicts keep the
   person's changes on top). Browser-tested with stand-in Supabase; live test G in the guide.
3. **Excel into Settings → Data / Backup** (`app/dashboard.html` box "Meeting from Excel", wired in
   `app/js/meeting-import.js`; removed from the Meeting menu, Meeting tab, empty Studio; one palette entry opens
   it), **version 6.11** (`server.py`, `docs/releases/v6.11.md`, header picture, CHANGELOG): **built**.
   Owner next: install 6.11 (release `v6.11` or the latest Build Windows installer run), then live test G.
4. **6.12 (after test G):** remove the Excel import, template and export (W3); keep Export to PowerPoint.

## Website redesign (26 October, owner's request)
Built on the branch: Apple-style design for the whole companion (`hosted/src/app/design.css`, tokens in
`globals.css`): landing page for visitors (brand, "How it works" four-step workflow, features, privacy), signed-in
dashboard (greeting, brand, live tiles: next meeting, plan, service PC, people; workflow; account), grouped
sidebar (Plan / Present / People), sticky glass top bar, split sign-in page, document layout for Privacy. All pages
checked at 1440 and 390 px with stand-in data. The program's dark theme now uses the same palette (last block of
`app/css/theme.css`, colours only; owner's request); keep the two in step.

## Deleting a workspace (26 October)
Owners delete a workspace from Overview → Your workspaces → Delete (type its name to confirm). No new migration:
`organizations_delete` (0001) and the grant (0007) already allow it, and every table cascades
(`hosted/tests/supabase-rls.test.mjs` checks owner-only and the cascade). Others use Members → Leave.

## Website motion and About (26 October, owner's request)
Built on the branch: cinematic but quiet motion on every page (words rise in on load, sections rise into view on
scroll, steps of "How it works" arrive in order with their connectors drawing, a pointer-following light on cards, a
shimmer on the gold wordmark, a floating emblem with a morphing glow, a slowly drifting ambient light behind every
page, the hero easing away and the top bar firming up as you scroll where the browser supports it). Palette and
layout unchanged; everything stops under "reduce motion". An (i) About button (top bar, landing bar, sign-in) opens
the program's About page in the website's design, with the same words (brand.json from app/js/brand.js).

## Pending (owner)
1. ~~Run the database scripts~~: **done** on 26 October (`0002`–`0008`, all passed).
2. ~~Merge PR #32~~: **done**. Take the installer from the latest "Build Windows installer" run on `main` (Actions →
   Artifacts); if no run started after the merge, start one with **Run workflow**.
3. **Live tests:** [docs/qa/live-test-guide.md](../docs/qa/live-test-guide.md), tests A–F:
   - A sync, B phone control, C editing, D history;
   - E members from the cloud and groups;
   - F PowerPoint export, Audio, Suggest.
4. **Before using Audio Content:** update every linked PC. Older versions drop Audio Content and would sync the Frame
   without it.
5. **M-D1 signing:** follow [docs/project/code-signing.md](../docs/project/code-signing.md):
   - check the history, then make the repository public;
   - apply to SignPath Foundation;
   - add the `SIGNPATH_API_TOKEN` secret and the three `SIGNPATH_*` variables.
6. **Later (owner's choice):**
   - Google/Microsoft sign-in with the invitation test;
   - the move of the companion to Cloudflare before a public launch ([hosting.md](../docs/architecture/hosting.md));
   - Supabase Pro once churches depend on it.

## Open work (needs a decision or a design first)
- **Media reference checks:** asset references (size and hash in sync records) from migration step 3 need a short
  design first, because of the risk of two PCs rewriting each other's reference.
- **Missing-media warning:** a line on screen needs the owner's approval (desktop UI is frozen).
- **Signing:** C1 (unsigned installer, no auto-update) stays open until signing is on. Auto-update is not designed yet.
- **Live database tests:** RLS tests against the real Supabase need `*.supabase.co` reachable. A local machine can
  reach it; the cloud environment could not.

## Risks
- **Logo/branding:** the 16px favicon remains faint on light tab backgrounds; do not change the approved emblem without owner approval. The packaged tray icon has not been run; `desktop_app.py` uses `app/icons/remote-192.png`.
- **Never tested against live Supabase:** sync, phone control, member editing, groups and grants. They are tested on
  PGlite and against stand-ins only.
- **Audio Content and older versions:** see Pending 4.
- **Vercel Hobby terms:** personal, non-commercial use only; asking for donations counts as commercial (hosting.md).
- **Closed PRs #8–#16:** not `main`'s plan; reuse only what PROJECT_STATUS.md "Worth reusing" lists.

## Assumptions
- The hosted app is separate from the LAN remote and never calls the PC's local server.
- D4 (sync conflict rules): built as recommended (keep both Frames; the last writer wins for settings and people).

## Recommended Next Task
Nothing is left for an assistant to build without the owner. In order:
1. **Owner's live tests** with an installed 6.11 build: A–F and G in
   [docs/qa/live-test-guide.md](../docs/qa/live-test-guide.md), plus the website settings (change Branding on the
   website, see it in the program within a minute). Fix what they find; mark each test done in the four files.
2. **6.12 (W3): remove the Excel Meeting Workbook** (import, template, export) — only **after** the owner reports test G
   passed. Do not start it before.
3. Owner tasks with no code: publish a v6.11 release; Google brand re-verification; E1–E3 (public repo, SignPath).
Do not start new features unless the owner asks. If there is nothing to fix, say so and stop.

## Files Likely To Change Next
Whatever the live tests find:
- `cloud_sync.py`, `cloud_remote.py`, `server.py`, `app/js/frame-lists.js`, `app/js/audio-player.js`,
  `pptx_export.py`, `ai.py`;
- `hosted/src/components/*-panel.tsx`, `hosted/src/lib/*.ts`;
- `hosted/supabase/migrations/`: a **new numbered** migration with its own grants and an undo script in
  `hosted/supabase/rollback/`; never an edited one;
- the four continuity files.

## Session Handoff (VS Code on Windows)
Setup and the full check list are in [CLAUDE.md](../CLAUDE.md) under "Working locally" and "Commands".

Start by fetching and checking out the branch:
- `git fetch origin`
- `git checkout main`
- `git pull`

Before and after every change, run all the checks in CLAUDE.md. At the end of every step, update all four
continuity files in the same commit (owner's rule). Never force-push.

## Three settings on the website (26 October, owner's request)
- **Branding** page (Plan → Branding): Meeting Name, Leader or organization, accent colour, "New Frames include branding".
  Writes the synced `brand` record; the logo is kept as it is (pictures stay on the PC).
- **Transition style** on the Meeting Form: the program's eight profiles; writes `layout/profile` `{value}`.
- **Birthdays this week** on the dashboard, from the synced member list (ISO or `--MM-DD` birth dates; 29 Feb on 28 Feb).
- Fixed in passing: things revealed on scroll inside a block that arrived later (the birthday pills) now appear.
- Owner test: change branding on the website and see it in FRAMEDECKS → Settings → Meeting & Branding within a minute.
