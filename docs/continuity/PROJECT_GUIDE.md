# FrameDecks — project and maintainer guide

Read this first, then [NEXT_SESSION.md](NEXT_SESSION.md).

## Non-negotiable rules
- The desktop UI, branding and functions must NOT change. The work is a stack migration to SaaS + PWA only.
  Owner-approved exceptions: the heavier 16–32 px emblem and one Settings section, "FrameDecks account" (sync, D1 in
  `docs/architecture/metadata-sync.md`), which also gets "Allow control from the companion" and its last ten actions
  (R5 in `docs/architecture/remote-control-design.md`); a toast on the PC for each companion action; and from the migration
  (`docs/project/history/migration-plan.md` §8): **Suggest** in a Frame's question list (only when Ollama answers), **Meeting → Export
  this meeting to PowerPoint**, and **+ Content → Audio…** with its settings; and 6.11 (`docs/architecture/meeting-form.md`, W2): the Excel Meeting
  Workbook moved from the Meeting menu, Meeting tab, empty Studio and palette into **Settings → Data / Backup →
  Meeting from Excel** (it leaves in 6.12, W3); and the website's colour palette in the dark theme (6.11, owner's
  request: the last block of `app/css/theme.css`, colours only; keep it equal to `hosted/src/app/globals.css` :root);
  and the virtual camera's name, **FrameRelay** (owner's request, 26 October: `packaging/build_vcam.py` NAME,
  `src/vcam/sink.py` VCAM_NAME, and the labels that name the camera; the program itself stays FrameDecks); and the Settings menu grouped (Your meeting, Presenting, Account,
  This PC, Help), each item with a one-line description, plus "Find a setting" (owner's request, 26 October); and design
  audit ranks 2–4 (owner's request, 26 October): the first-run dialog (Start fresh first, then a Getting started card),
  the Teleprompter's empty state, and the command bar's words (Transition label, Auto-advance, Live tools, Ready / Off air
  in words, sentence-case Go Live and Hide all; `tests/test_ui_labels.py`); and design audit rank 10 (owner's request,
  26 October): no desktop label under 12 px (keyboard hints aside) and `--faint` at 4.5:1 or more in both themes. The
  legacy phone remote's CSS (`app/css/remote.css`) is unchanged; and the rest of the design roadmap (owner's request,
  26 October, "Complete all pending"): sentence-case headings and labels in Source Sans 3 (serif only for scripture),
  Lucide icons in the Settings menu and Teleprompter, one email composer on Members → Email with an Import / Export
  menu, Frame actions Duplicate + More…, a compact Settings → About, help text under checkboxes, and every CSS value
  on the scale in `docs/development/design-system.md` (`tools/css_tokens.py`, `tests/visual/layout.mjs`, `tests/visual/a11y.mjs`).
  Colours live only in `app/css/palette.css` (`tools/css_palette.py`). Follow that document for any new screen.
  And the UX simplification (owner's request, 27 October; `docs/development/design-system.md` "Running a service", `app/js/service.js`):
  Prepare / Run, Up next, Before you start, Practice mode, How people see it (Settings; the camera and display pages
  under it), Advanced (Transitions, Keyboard shortcuts, Security, Diagnostics), FrameRelay presets with Fine-tune,
  Members → People (List / Table), labelled main tabs, worded Previous / Next, Hide all red only while something is on
  screen, one status pill, grouped Live tools (one Teleprompter entry, Esc closes), "Black screen" for Blackout, the
  four-step first-service card, and the words in `docs/guide/glossary.md`. And the 10/10 plan (owner's request, 27 October): Run's larger Up next with key
  hints and the Practice reminder at service time (`app/js/service.js`, end of `app/css/theme.css`). And the name written
  **FrameDecks** (owner's brief, 27 October) in every label, title and message, with the About wordmark and header
  no longer forced to capitals; identifiers keep FRAMEDECKS (`APP_NAME`, data folder, `FRAMEDECKS_*` variables, the
  exe, the ping's `"app"`, `FIREWALL_RULE`, Credential Manager names, old camera names). Nothing else visible may change.
- The codebase is the source of truth; verify docs against it.
- Do not touch the legacy LAN remote or let the hosted app call the local HTTP server.
- Never commit secrets. `.env*` is ignored except `hosted/.env.example`. Never the Supabase `service_role` key; the
  publishable key goes only in Vercel and `hosted/.env.local`. A PC's sync key lives in Windows Credential Manager
  (`kc-sync.json` and `.kc-sync-key` are git-ignored).
- Sync never sends media or anything live, and never changes the Frame that is on screen (see the design).
- The workspace is the member list's source (M-D2). A linked PC keeps a copy and rebuilds it from the workspace if
  its member file goes missing (`cloud_sync.Engine._rebuild_members`; app setting `memberAuthority`, `pc` = before).

## Layout
- `app/`, `src/server.py`, `packaging/` — the unchanged desktop app (Python server, static UI, port 8750).
- `src/sync_entities.py` (plan ⇄ sync records) and `src/cloud_sync.py` (background sync, linking; off until a PC is linked) —
  Phase 4, wired into `src/server.py` (`SYNC`, `/api/sync`) and Settings (`app/js/account.js`).
- `src/cloud_remote.py` (Phase 5: commands from the companion, only while linked and the app setting `cloudRemote` is on)
  — wired into `src/server.py` (`CLOUD_REMOTE`, `CLOUD_BRIDGE`, `/api/remote-cloud/*`, this PC only) and run by the
  program's own window with the keys' functions (`app/js/cloud-remote.js`). `REMOTE` in `src/server.py` is the Wi-Fi
  phone remote, a different thing.
- `hosted/` — Next.js 16 online-first companion, built as **plain static files** (`output: "export"` → `hosted/out/`;
  free plan, `docs/deployment/free-hosting.md`). Canonical address **`https://framedecks.com`** (`hosted/src/lib/site.ts`;
  domains, redirects and Cloudflare settings in `docs/deployment/cloudflare-domains.md`), served by Cloudflare Pages, whose own `https://framedecks.pages.dev` stays as a noindexed fallback
  (Root Directory `hosted`, output `out`; 26 October); `framedecks.vercel.app` stays until the owner retires it. No server code: `/api/sync-config` is a file written by
  `hosted/scripts/write-sync-config.mjs` at build time; the manifest is `hosted/public/manifest.webmanifest`.
- `hosted/supabase/migrations/` — SQL run in order in the Supabase SQL editor: `0001` workspaces, `0002` invitations,
  `0003` sync, `0004` remote control, `0005` the Live page's PC list, `0006` the audit log, `0007` explicit API grants, `0008` member groups, `0009` last-seen throttle (6.11.1). `0001`–`0008` were run in the live project on 26 October 2026 and `0009` on
  27 October: never edit one (not even a comment), add the next number.
  Each new one gets an undo script in `hosted/supabase/rollback/` (`NNNN_<name>_down.sql`).
- `tools/` — generators and checks (`make_emblem_assets.py`, `check_doc_links.py`, `generate_brand_assets.py`); `tools/launchers/` holds the Windows batch launchers and the Mac `.command` launcher. The Windows scripts resolve the repository root themselves, so they can be double-clicked from that folder.
- `docs/project/history/modernization-status.md` — the detailed phase tracker; `docs/architecture/metadata-sync.md` — the
  agreed sync design and its delivery steps; `docs/architecture/remote-control-design.md` — the agreed Phase 5 design
  (controlling a service from the companion; R1–R5 as recommended) and its four delivery steps;
  `docs/architecture/companion-editing.md` — editing services in the companion (E1–E4 as recommended);
  `docs/architecture/meeting-form.md` — 6.11: the website Meeting Form, the camera check and `framedecks://` (W1–W3).
- `docs/project/history/2026-10-25-architecture-audit.md` — architecture, performance and product audit (critical issues
  C1–C10, optimizations P1–P10, budgets, roadmap); no UI changes. P1–P4 and C2 (`src/supervisor.py`, the crash
  watchdog in the installed exe) are built.
- `docs/project/history/architecture-review.md` and `docs/project/history/migration-plan.md` — review against the owner's target architecture (cloud
  for people, templates, AI, audit; desktop for media, rendering, camera) and the step order; decisions M-D1–M-D6.
  The owner answered M-D1–M-D6 (plan §8); all eight steps are built and merged (PR #32; `docs/project/history/post-migration-report.md`);
  hosting long term: `docs/architecture/hosting.md`.
- `src/ai.py` — optional free AI (M-D3): Ollama on this PC, or a self-hosted endpoint; cached; `Suggest` in a Frame's
  question list appears only when one answers (`docs/guide/ai.md`). Never call a paid provider from the PC.
- `src/pptx_export.py` (Meeting → Export this meeting to PowerPoint, python-pptx) and Audio Content (`audio` kind in
  `store.js` SOUND_KINDS, `app/js/audio-player.js`, plays only in the program window while its Frame is live and on).
  Both are owner-approved entries (M-D4). Older versions drop Audio Content: update every linked PC first.
- Free plan (`docs/deployment/free-hosting.md`): `.github/workflows/db-keepalive.yml` (pings Supabase every 3 days) and
  `db-backup.yml` + `tools/db_backup.sh` (nightly, AES-256 encrypted with `BACKUP_PASSPHRASE`, 30 days; restore:
  `docs/operations/database-backup.md`). Both do nothing until their repository secrets exist.
- Licence: Apache 2.0 (`LICENSE` and `NOTICE` at the top level, where GitHub's licence detection, the website footer
  link and the installer build read them); every shipped dependency or vendored file needs a row in
  `docs/legal/THIRD_PARTY_NOTICES.md`. Signing: SignPath, off until its secret exists (`docs/deployment/code-signing.md`).
- Continuity: `docs/continuity/PROJECT_GUIDE.md`, `docs/continuity/PROJECT_STATUS.md`,
  `docs/continuity/PROJECT_ROADMAP.md`, `docs/continuity/NEXT_SESSION.md`. The owner's live tests:
  `docs/qa/live-test-guide.md` (keep it in step when a tested behaviour changes).
- Current handoff (29 October 2026; version 6.14 on `main`: the Setup guide (`app/js/guide.js`, `guide-steps.js`, website `setup-guide.tsx`); 6.13 one-click linking and a four-screen front page; the owner runs `0010_link_by_url.sql` and tags `v6.12`, `v6.13`, `v6.14`; framedecks.com live, its redirects, HSTS and the Supabase/Google URLs still the owner's; FRAMECAST is now FrameRelay): v6.11.2 (repository layout + companion trust fixes, no desktop change; tag `v6.11.2`) follows v6.11.1 and the README/release wordmark refresh (PR #38). Trust
  fixes merged in PR #39 (`27cfb4b`); production deployment verification and the owner's live tests remain. See
  `docs/continuity/NEXT_SESSION.md`. Repository clean-up (merged): Python modules are in `src/`
  (`python src/server.py`), `README.md`, `LICENSE`, `NOTICE` and `ruff.toml` at the top level, `CONTRIBUTING`/`SECURITY`/`SUPPORT` in `.github/`,
  `THIRD_PARTY_NOTICES.md` in `docs/legal/`, the camera package in `src/vcam/`, the sample spreadsheets in `assets/samples/`,
  `CHANGELOG`/`ROADMAP`/`README` at the top of `docs/`, user guides in `docs/guide/`, developer docs (architecture, coding
  standards, developer guide, design system) in `docs/development/`, role guides in `docs/guide/roles/`, finished plans and audits in `docs/project/history/` (dated names), the visual reference screens in
  `tests/visual/baselines/`. The layout every repository follows, and this one's exceptions (`app/`, `hosted/`, `kc-*.json`),
  is in `docs/development/repository-structure.md`: keep new files in line with it. Release notes before v6.8 live in
  `docs/releases/archive/`; deployment docs in `docs/deployment/`; the backup runbook in `docs/operations/`.
- Companion design (26 October redesign): tokens in `hosted/src/app/globals.css` `:root`, the look in
  `hosted/src/app/design.css` (glass surfaces, navy and gold, one large title per page). Signed out, `/` is the landing
  page (`components/landing.tsx`); signed in, the dashboard (`components/overview.tsx`: hero, `glance.tsx` tiles,
  `workflow.tsx` "How it works"). Sign-in is a split layout (`auth-shell.tsx`). Use the tokens, not new hex colours.
  Motion (`motion.css`, `components/motion.tsx`): `data-reveal` rises into view on scroll (marked `data-in`, never a
  class: React rewrites classes; content is visible without JavaScript and hidden only once `html.fd-reveal-ready` is
  set, with a scroll/hash safety net so an anchor jump never leaves a section invisible), `data-spotlight` follows the
  pointer (once per frame, mouse only), `.fd-enter` plays on load, and the stage light (two glows) drifts for about a
  minute and then rests; all of it stops under "reduce motion". Performance rule (owner, 8 GB PCs next to the
  program): an idle page draws next to nothing — an endless animation must be declared `paused` and run only while its
  `data-loop` element is on screen (`data-live`), and never under "reduce motion" or **Reduce effects**
  (`effects-toggle.tsx`, `html.fd-calm`; `tests/idle-performance.test.mjs`); no animated layout properties;
  `backdrop-filter` only on the sticky top bars. The About screen (`about-dialog.tsx`,
  `about.css`, the (i) button) shows `src/lib/brand.json`, written from the program's `app/js/brand.js` and
  `src/server.py` version by `scripts/write-brand.mjs` on every build (`tests/brand.test.mjs` fails if it is stale).
- Website places (27 October): Home `/` (`overview.tsx`), Plan `/plan` (also `/meeting`, `/services`; `plan-page.tsx`),
  Live, People `/members`; Settings: Branding, Service PCs `/computers`, Help `/help`; Your account `/account`. The
  look on top of `design.css` is `hosted/src/app/identity.css` (`.fd-framed` corners, EB Garamond for scripture, warm
  gold main action) and, for the front page, `hosted/src/app/landing.css` with `components/landing.tsx` and its parts in
  `components/landing/` (6.13, about four screens: nav, two-column hero with proof ticks, How it works as four tabs
  that play once by themselves, one tab set for the press-Next demo and the features, four questions plus "More
  questions", Ready to Serve? with the promise; `docs/development/design-system.md` "Landing" has the autoplay and
  reduced-motion rules). No GSAP. `/connect` (`components/connect-panel.tsx`, `lib/connect-link.ts`) is where an
  owner or admin allows a PC that chose Connect to FrameDecks. Website words: team, not church; no named
  streaming products on the front page. `filter` animates only in two one-off entrances (hero words, step screens).
- `hosted/src/app/meeting` — 6.11 the Meeting Form: the Excel form's sections on the live plan (`hosted/src/lib/meeting-form.ts`),
  plus the meeting's Transition style (the synced `layout/profile` record).
- `hosted/src/app/branding` — the program's Meeting & Branding settings (the synced `brand` record; the logo stays on the PC).
  Shapes and the dashboard's "Birthdays this week" live in `hosted/src/lib/workspace-settings.ts`, tested against store.js normalize.
- `hosted/src/app/{services,live,members,computers}` — the synced plan (owners and admins edit its words and order,
  `hosted/src/lib/frame-edit.ts`, sent with `sync_push`; History and restore from `entity_history`,
  `hosted/src/components/frame-history.tsx`), running a service from a phone
  (Phase 5), the member list (owners/admins add, edit and remove people; the workspace is its source, M-D2;
  groups, M-D6: `hosted/src/lib/member-edit.ts`, `hosted/src/components/members-panel.tsx`) and linking PCs; `hosted/src/components/app-shell.tsx` is the shared sidebar and top bar.

## Working locally (VS Code on Windows)
- **Branch (owner's rule, 28 October).** Commit and push directly to `main`, only after every check below passes;
  no working branches unless the owner asks for one. Never force-push or rewrite pushed history. The repository is
  `mshobin/FrameDecks`.
- **Set up once (PowerShell, at the repo root):**
  - `python -m venv .venv`
  - `.venv\Scripts\Activate.ps1`
  - `python -m pip install -r packaging/requirements-desktop.txt -c packaging/constraints.txt` (includes python-pptx
    for the PowerPoint export)
  - `cd hosted; npm ci; cd ..`
- **Run the program:**
  - `python src/desktop_app.py` (the real window).
  - `python src/server.py`, then open http://127.0.0.1:8750/dashboard.html in a browser; add `?audio=1` to let a browser
    tab play Audio Content.
  - Or double-click `tools\launchers\Start FRAMEDECKS.bat`; use `tools\launchers\Start FRAMEDECKS with Phone Remote.bat` to enable the legacy phone remote.
  - Data lives in `%APPDATA%\FRAMEDECKS`. Set `KC_DATA_DIR` to a scratch folder for experiments.
- **Companion:**
  - `cd hosted; npm run dev`.
  - Put the public Supabase URL and publishable key in `hosted/.env.local` (never committed), named
    `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **AI (optional):**
  - Install Ollama (https://ollama.com), then run `ollama pull llama3.2`. **Suggest** then appears in a Frame's
    question list.
  - `tests/test_ai.py` uses a stand-in, not a real Ollama.
- **Local-only checks**, which the remote build environment cannot run:
  - the virtual camera in Zoom, Teams and OBS;
  - PowerPoint COM;
  - Credential Manager (the sync and ESV keys);
  - audio through the speakers;
  - Supabase itself.

## Keeping the handoff current (owner's rule)
- Update all four continuity files (`docs/continuity/PROJECT_GUIDE.md`,
  `docs/continuity/PROJECT_STATUS.md`, `docs/continuity/PROJECT_ROADMAP.md`,
  `docs/continuity/NEXT_SESSION.md`)
  at the end of **every** step, in the same PR as the work: what is done, what is live, what the owner must do next.
- In long steps, push work in progress with the four files describing the partial state, so a session cut off by a
  usage limit still leaves a correct handoff.

## Commands
- Before and after every change, all of these must pass (the last recorded results are in brackets):
- Desktop JS tests: `node tests/run.js` [4/4]; Python: `python -m unittest discover -s tests -p "test_*.py"` [139 OK];
  packaging: `python packaging/check.py` [6.11.2].
- Hosted (run inside `hosted/`, there is no root package.json): `npm test` [124/124], `npm run lint`, `npm run typecheck`, `npm run build`.
  `npm test` applies every migration to in-memory Postgres (PGlite) and loads `src/lib/sync-entities.ts` with Node's
  type stripping.
- Optional local Windows installer build: `tools\launchers\build.bat`.
- Sync fixtures: `python tools/make_sync_fixtures.py` rebuilds `tests/fixtures/sync/` (needs Node) after changing
  `store.js` normalize or the record mapping; `tests/sync-fixtures.test.js` says when.
- Docs: `python tools/check_doc_links.py`, `git diff --check`.
- Lint: `ruff check .` or `ruff check --config ruff.toml .` (same rules; `ruff.toml`; CI pins ruff 0.16.8) and `node --check` on `app/js/*.js` (the Desktop checks
  workflow). Website budget: `node hosted/scripts/check-budget.mjs` after `npm run build`.
- Actions (27 October): checkout v7, setup-python v7, setup-msbuild v3, download-artifact v8, action-gh-release v3; the
  last two run only in the release job, so watch the next tag's release job.
- Releases: [release-checklist.md](../development/release-checklist.md) (pilot first; rollback). Publish by
  pushing a tag `vX.Y.Z` on `main`: "Build Windows installer" builds, smoke-tests and publishes `FrameDecks vX.Y.Z.exe` with
  `docs/releases/vX.Y.Z.md` as the notes (`tools/make_release_notes.py`). Push the tag from a local clone.

## Gotchas
- Moving code changes two layouts, not one: from source `src/vcam/` sits under `src/`, but the installer bundles it as
  `_internal/vcam/` next to `_internal/app/`. Never find a data folder by counting parents of `__file__` alone; use
  `sys._MEIPASS` when installed (as `server.py` RES and `vcam/layers.py` `fonts_folder()` do). `tests/test_vcam_fonts.py`
  covers the fonts.
- Audit roadmap step 2 (6.11.1, 26 October): the Stream Deck plugin is removed (no `/api/command`); window buttons use
  `desktop_win.show_async` / `set_topmost` and threads, never pywebview setters from the web-server thread; one
  OpenCV (`opencv-python`; `packaging/check.py` fails on two); `server.support_bundle` (Diagnostics; never plan,
  members, PIN, sessions or keys); `server.check_for_update` asks GitHub once a day (About shows a link, never
  downloads; `FRAMEDECKS_NO_UPDATE_CHECK=1` off); the installer smoke test in `build-windows.yml`; the nightly backup
  proves it decrypts and lists tables; failed DB workflows open a GitHub issue.
- Production audit (`docs/project/2026-10-26-production-audit.md`), steps 1–2 built in 6.11.1:
  - every GitHub Action and the softcam clone are pinned to a full commit (update the SHA and its comment together;
    Dependabot proposes updates); only the `release` job has `contents: write`;
  - `server.Handler.cross_site_api`: `/api/*` refuses `Sec-Fetch-Site: cross-site` (other websites);
  - `errlog.swallowed(where, e)`: write it in every `except Exception` that carries on (never a bare `pass`);
  - `server.load_state` keeps a damaged plan as `kc-saved-content.json.damaged-<time>`, opens the newest readable
    backup, and records `PLAN_RECOVERY` (Diagnostics); a linked PC then calls `SYNC.adopt_workspace()` (one full
    pull where the workspace's version wins). `cloud_sync.MASS_DELETE_FRAMES`: when every Frame vanishes at once,
    no deletions are sent and the Frames are restored from the workspace.
- The old name appears only where upgrades need it: `src/legacy.py` (moves old data folders), `packaging/installer.iss`
  (removes old shortcuts, program folder and camera files), `src/server.py` `OLD_FIREWALL_RULES`, `tools/undo-ipad-remote.ps1`
  and `tests/test_legacy.py`. Use FrameDecks everywhere else; the camera is called FrameRelay (files `framedecks_vcam64/32.dll`). Any label that
  means the camera (switch, status, picture, preview) says FrameRelay; `tests/test_camera_name.py` fails otherwise.
- The companion must stay a static export: no server routes, cookies, server actions, `dynamic`/`revalidate`, metadata
  routes that need a server, or cacheComponents/PPR (they break `output: "export"`).
- Next.js 16 has breaking changes: read `hosted/node_modules/next/dist/docs/` before writing hosted code. `agentRules: false`
  in `hosted/next.config.ts` keeps `next dev` from writing a notes file into `hosted/`.
- The emblem `app/img/framedecks-emblem.webp` and `hosted/public/framedecks-emblem.webp` must stay identical. Regenerate all emblem/icon files with `tools/make_emblem_assets.py` (master: `assets/brand/framedecks-emblem.svg`).
- The repo auto-commits as "Update project files and documentation"; check `git status` before committing.
- The README header and GitHub release body both embed `assets/brand/framedecks-about-header.webp`. The FrameDecks wordmark
  refresh was published in PR #38; for a future image change, publish the image commit and update the existing release
  body's image URL to that commit because the release tag is immutable.
- Browser code must name each `NEXT_PUBLIC_` variable in full (`publicSupabaseEnv()`), or Next.js does not inline it.
- Supabase (from 30 October 2026) gives new tables no API access: every migration that creates a table must `grant`
  the operations its RLS policies allow to `authenticated` (never `anon`). `tests/pglite-supabase.mjs` grants nothing
  by itself, and `supabase-schema.test.mjs` fails if a table the companion uses is not granted.
- In SQL permission checks, wrap comparisons that can be null in `coalesce(…, false)`: a null makes an `IF` skip the
  refusal (a test caught this in `computer_revoke`).
- This cloud environment cannot reach `*.supabase.co` or Vercel preview hosts: test hosted features against stand-in
  responses (Playwright `page.route`) and leave live checks to the owner.
