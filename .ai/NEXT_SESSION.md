# NEXT SESSION HANDOFF

Updated 27 October 2026: everything is on `main`; nothing waits on a branch (the cloud session's branch
`claude/peaceful-albattani-6m445e` equals `main`). Continue locally in VS Code: `git checkout main && git pull`, then
read [CLAUDE.md](../CLAUDE.md) ("Working locally" has the set-up and run commands).

## Where things stand (27 October)
- **Release:** **FrameDecks 6.11.1** is published from tag `v6.11.1` on `main` (the "Build Windows installer" workflow
  builds, smoke-tests and publishes it; the installer is now `FrameDecks v6.11.1.exe`). The previous release is 6.11.
- **`main` since 6.11:** audit steps 1–2 (plan recovery, safe sync, support bundle, update notice, pinned build); the
  design roadmap and UX simplification (Prepare / Run, Up next with keys, Practice mode and its start-time reminder,
  How people see it, Advanced, People); the website's four places (Home · Plan · Live · People), first-time steps,
  Help and Your account; the owner's landing brief (approved hero words, Day 1–4, Ready to Serve?, every audience,
  motion back with no animated blur); the name written **FrameDecks** everywhere people read it; About readable in Light.
- **Live:** website at `https://framedecks.pages.dev` (Cloudflare Pages, deploys from `main` by itself); Google,
  Microsoft and email sign-in work; keep-alive and nightly backup run green. Database: `0001`–`0008` run; **`0009`
  not yet** (owner, Supabase SQL editor).
- **Checks (cloud session, 27 October):** Python OK; desktop JS 4/4; `packaging/check.py` 6.11.1; `css_tokens` 0;
  doc links 0; ruff clean; layout and axe (both themes) pass; hosted 124/124, lint, typecheck, build, budget (JS 327 KB,
  CSS 18 KB of 20). GitHub: Desktop checks, Hosted companion checks and Build Windows installer green on `main`.
- **Gotcha for the visual suites:** start `server.py` with nothing else on port 8750 (a leftover server makes them test
  the wrong data and fail on things that are fine).

## Completed (merged to `main`, PRs #7–#31)
- Desktop 6.10, the approved emblem, and the drift cleanup.
- Hosted companion on Vercel: sign-in and workspaces confirmed live by the owner; members and invitations.
- Phase 4 sync of service plans, built and not yet live-tested:
  - database `0003`;
  - record mapping;
  - PC sync with Settings → FrameDecks account;
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
- **Stream Deck plugin:** removed on 26 October at the owner's request (with `/api/command`).
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
1. **Camera check and "Open FrameDecks on this PC"**: **built** (`hosted/src/lib/pc-setup.ts`,
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

## Design audit (26 October, chat only)
The design roadmap is complete (ranks 1–21; ranks 8 and 12–21 on 26 October). For any screen change, follow
`docs/design-system.md`, run `python tools/css_tokens.py` and `node tests/visual/layout.mjs` (needs the program running
and Playwright), and refresh `docs/design/baselines/` and `hosted/public/product/` when a screen changes on purpose.
27 October, UX simplification (owner-approved): `app/js/service.js` holds Prepare / Run (body `run-mode`; Run hides the
editor and blocks rename, drag, menus, Delete, cut, paste and undo in the Studio), Up next (`KCWorkspace.upNext()`),
Before you start (reads the status chips), Practice (Black screen + `practice=1` on the program's own previews,
`overlay.js`; any other Black screen off ends it) and How people see it (`#sec-output`). Hide all is neutral unless
`body.kc-on-air` (set in `dashboard.js` refreshStatus). The command bar wraps to two rows below 1460 px in Prepare and
1240 px in Run; measure with something on screen when changing it. The LAN remote's Advanced view still says
"Blackout" (it is off-limits). Words: `docs/glossary.md`. Owner: Test H in `docs/qa/live-test-guide.md`.
27 October, steps to 90+ after the re-audit: colours only in `app/css/palette.css` (run `python tools/css_palette.py`
after adding a colour; `css_tokens.py` fails otherwise; `teleprompter.css` is exempt because the LAN remote loads it
without the palette), `!important` baseline 16, keyboard editor and About story built on first open (`buildOnce` in
`settings.js`), and `node tests/visual/a11y.mjs` (axe-core 4.10.3, installed `--no-save` in `tests/visual`) in the CI
visual job. Left for the owner: Windows check, NVDA/Narrator pass, a real landing quote or usage fact (never invent one).
27 October, the 10/10 plan, phases 1–2 and the parts of 3–4 that need no owner (owner's request): the website has
four main places (`app-shell.tsx` `main`: Home `/`, Plan `/plan`, Live `/live`, People `/members`) and Settings
(Branding, Service PCs `/computers`, Help `/help`); `/meeting` and `/services` render the same `PlanPage`
(`plan-page.tsx`, `plan-panel.tsx`: Edit the meeting / History and restore, `#history`). Home is `overview.tsx`
(`NextService` in `glance.tsx`, or `FirstSteps` that creates the church inline); `/account` holds the workspace list
and invitations. Sign-in: `SignInChooser` (`#new`). The look: `hosted/src/app/identity.css` (restraint overrides,
`.fd-framed` corners, EB Garamond subset `public/fonts/EBGaramond-latin.woff2`), loaded before `light.css`. Landing:
`landing.tsx` + `next-demo.tsx`; `public/product/live-phone.webp` was retaken from the new nav. Program: Run's Up next
is larger, shows keys (`.rn-keys`, from `KCShortcuts`) and the Practice strip turns amber at the meeting's time
(`remindPractice`). Not done (owner or later): 2–3 design directions (one was built), projector legibility mode and
templates by type (Quick Start already offers types; both change the program's screens, so they need the owner's
go-ahead), the Wi-Fi remote redesign (protected), SignPath, public repo, real quotes/photos, screen-reader pass.
Owner: Test I in `docs/qa/live-test-guide.md` (and Test H step 6).
27 October, the owner's landing brief: the name is **FrameDecks** in everything people read (a guarded replace;
identifiers kept: `APP_NAME`, `FRAMEDECKS_*`, data folder, exe, the ping's `"app"`, `FIREWALL_RULE`, Credential
Manager names, old camera names, `vcam/` comments; the legacy remote's files untouched). Front page rebuilt
(`landing.tsx`, `next-demo.tsx`, new `hosted/src/app/landing.css`): approved hero words verbatim, Day 1–4, Ready to
Serve?, every audience, no OBS/Camo; motion back (`fd-enter`, `data-reveal`, `data-spotlight`, scroll-linked Studio
settle) with no animated `filter` anywhere. Website says team, not church. About readable in Light (`light.css`).
Product pictures retaken from neutral content (`hosted/public/product/`). Left for the owner: the About story and
`brand.js` mission (the owner's own ministry words), the program's own church-flavoured presets and templates
(Sunday Service, Bible Study; program content, protected), docs/ministry, the `Start FRAMEDECKS*.bat` file names.
Visual suites: run `server.py` with no other program server on 8750 (a stray one makes them test the wrong data).
The FRAMECAST panel is still built at start (it updates its controls in place every poll).
Gotcha: `next build` reuses its cache; after CSS changes that do not appear, delete `hosted/.next` and `hosted/out`.
Earlier: ranks 1–7 and 9–11 are done (5–7, 9–11 on 26 October: `hosted/src/lib/when.ts`,
`content-kind.tsx`, the phone tab bar in `app-shell.tsx`, landing screenshots in `hosted/public/product/`; retake those
if the Studio or Live page changes look). Earlier: ranks 1–4 are done (DD-01 camera labels, `tests/test_camera_name.py`; DD-03
first run, DD-02 overlaps and Teleprompter empty state, DD-13 command bar words, `tests/test_ui_labels.py`). Next in
the list: 8 microcopy voice pass (DD-16), 12 state kit (DD-15), 13 typography (DD-04), 14 Lucide icons (DD-06). Desktop items need the owner's go-ahead; website items do not.
Owner checks on Windows: a new data folder shows Welcome to FrameDecks with Start fresh first; the command bar at
the PC's real width.

## Recommended Next Task
Nothing is left for an assistant to build without the owner. In order:
1. **Owner's live tests** with the installed **6.11.1** release: A–I in
   [docs/qa/live-test-guide.md](../docs/qa/live-test-guide.md) (H: Run, Practice and its reminder; I: the website's new
   places and front page), plus the website settings (change Branding on the website, see it in the program within a
   minute). Run `0009` in Supabase first. Fix what they find; mark each test done in the four files.
2. **Owner decisions still open:** the About story's wording (`app/js/brand.js`: mission, vision, story are the
   owner's ministry words; the website shows them too); the program's church-flavoured presets and templates
   (`app/js/store.js` PROFILES and templates: Sunday Service, Bible Study, Funeral…; program content, protected);
   projector legibility and templates by type; the Wi-Fi remote redesign (protected); real quotes and photos.
3. **6.12 (W3): remove the Excel Meeting Workbook** (import, template, export) — only **after** the owner reports test G
   passed. Do not start it before.
4. Owner tasks with no code: Google brand re-verification; E1–E3 (public repo, SignPath); an NVDA/Narrator pass.
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
- Owner test: change branding on the website and see it in FrameDecks → Settings → Meeting & Branding within a minute.

## Old name removed (26 October, owner's request)
- Every "Kingdom Connect" reference is now FrameDecks: docs, release notes, file names (`packaging/framedecks.ico`,
  `samples/FRAMEDECKS-Members-*.xlsx`, `docs/design/framedecks-redesign.html`), the camera files
  (`framedecks_vcam64/32.dll`, `register-/unregister-framedecks-camera.cmd`) and internal names.
- The Excel Meeting Workbook's header said "KINGDOM CONNECT"; regenerated with `tools/make_meeting_workbook.py`.
- The camera picker now recognises its own "FrameDecks" camera again (it looked for the old name).
- Kept on purpose (upgrades only): see CLAUDE.md Gotchas. The installer removes the old-named camera files and
  registers the camera again from the new ones. Owner check: after installing, the camera still shows in Zoom.
- GitHub's old "Kingdom Connect 6.9" release can only be changed by the owner (publish 6.11; delete or rename 6.9).

## FRAMECAST and the 6.11 release (26 October, owner's request)
- The virtual camera is now called **FRAMECAST** (Zoom/Teams/OBS name and every label that names the camera; same
  device ID). The website's camera check also accepts the earlier name. Owner-approved; recorded in CLAUDE.md.
- The tag build for v6.11 failed at "Write the branded release notes": `tools/make_release_notes.py` crashed on the
  empty `motto` in `app/js/brand.js`. Fixed, with `tests/test_release_notes.py`. Release notes rewritten.
- **Published** 26 October: Releases → FrameDecks 6.11 with the About header, notes, `FrameDecks.v6.11.exe` and `.sha256`.

## Fixes from the owner's first 6.11 install (26 October)
- **"Could not reach framedecks.pages.dev: Forbidden"** in FrameDecks account: Cloudflare refuses Python's default
  identity. Every request to the website and the database now says `FrameDecks (Windows; ...)` (`cloud_sync.USER_AGENT`,
  tests in `test_cloud_sync.WebsiteIdentity`). Not verifiable from the cloud session (the host is blocked here).
- **Teleprompter froze the program on unpin:** the window op `on-top` used pywebview's `on_top` setter, which waits on
  the window's thread. Now `desktop_win.set_topmost` (SetWindowPos with SWP_ASYNCWINDOWPOS, never waits). Owner to test.
  If the program is frozen: Task Manager → end every FrameDecks task, then open it again.
- **Settings menu** grouped and described, with "Find a setting" (owner-approved; CLAUDE.md).
- These are on `main` but not in the published v6.11 installer: take it from the latest "Build Windows installer" run
  (Actions → Artifacts), or publish a new release.

## Website performance on older PCs (26 October, owner's request)
- Measured with Playwright + CDP (stand-in data): the main thread was light (4-5 MB heap), but the landing page and
  dashboard ran 9 endless animations: three 58vmax blurred glows drifting behind every page, an emblem glow
  morphing its border-radius (repaint each frame), a wordmark shimmer (repaint), the "How it works" lights moving
  `left` (layout each frame), and a pulsing dot; seven glass surfaces re-blurred what moved behind them.
- Now: the ambient light is one static gradient layer; every animation runs a few times and stops; the moving light
  uses transform; `backdrop-filter` only on the two sticky bars; the pointer light updates once per frame, mouse only.
  After load nothing animates on its own (only scroll-linked effects while scrolling).
- The program's server idles at ~0.1% CPU and 62 MB; its page has no running animations; the Studio preview is
  polled only while the Studio canvas is visible, and unchanged pictures answer 304.

## Production audit (26 October, read-only)
- Report: [docs/project/2026-10-26-production-audit.md](../docs/project/2026-10-26-production-audit.md). No code changed.
- Verdict: conditional GO for the supervised pilot; NO-GO for a public release until H1 (plan-file recovery and sync
  mass-delete guard), H2 (signing) and H3 (pin build inputs by SHA) are done and live tests A–G pass.
- Nothing from it is implemented yet: each fix waits for the owner's approval (SAFE items first, then H1 as 6.11.1).

## 6.11.1: audit steps 1 and 2 (26 October, owner's request)
- Built and on `main`: H3 (Actions and softcam pinned by SHA, Dependabot, release job alone has write access),
  M1 (X-Frame-Options / frame-ancestors / Permissions-Policy), M3 (local API refuses cross-site calls), M8 (42 silent
  `except Exception: pass` now log via `errlog.swallowed`, rate-limited), M10 (`0009_seen_throttle.sql` + undo),
  H1 (damaged plan kept aside, newest backup opened, Diagnostics row; linked PC adopts the workspace; all-Frames-gone
  guard). Version 6.11.1, release notes `docs/releases/v6.11.1.md`, About header recaptured.
- Owner: (1) run `hosted/supabase/migrations/0009_seen_throttle.sql` in the Supabase SQL editor; (2) publish the
  release: tag `v6.11.1` on `main` (Releases → Draft a new release); (3) test on Windows: Teleprompter pin/unpin,
  FrameDecks account linking, the Settings menu, the camera in Zoom.
- Next from the audit (step 3): live tests A–G, M9 (other window operations non-blocking), M7 (one OpenCV).

## Stream Deck plugin removed (26 October, owner's request)
- Deleted `streamdeck/`, its workflow, `tools/make_streamdeck_icons.py`, the local `/api/command` and
  `/api/command/status` endpoints (`server.run_local_command`, `local_status`) and `tests/test_local_command.py`.
  This also closes audit finding N1 (the plugin's vulnerable zod). Companion and Wi-Fi remotes are unchanged.

## Audit roadmap step 2 (26 October, owner's request; all in 6.11.1, not yet published)
- Built: non-blocking window buttons (M9); one OpenCV (M7); Save support bundle; update notice (About, once a day,
  never downloads); Desktop checks workflow (ruff + JS syntax + doc links); website performance budget; installer
  smoke test (install, start, ping, quit, uninstall) in the Windows build; nightly backup self-check + checksum;
  failure issues for the DB workflows; offline-cache trimming; fsync of the plan file; release checklist with
  rollback (`docs/development/release-checklist.md`).
- Owner: publish v6.11.1 (Releases), run `0009`, then the Windows checks and live tests A–G.
- Next (step 3, before going public): signing, full CSP, phone-remote sessions/PIN, backup location, outside
  penetration test, 6.12 Excel removal.
