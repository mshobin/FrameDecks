# FRAMEDECKS — AI/maintainer guide

Read this first, then [.ai/NEXT_SESSION.md](.ai/NEXT_SESSION.md).

## Non-negotiable rules
- The desktop UI, branding and functions must NOT change. The work is a stack migration to SaaS + PWA only.
  Owner-approved exceptions: the heavier 16–32 px emblem and one Settings section, "FRAMEDECKS account" (sync, D1 in
  `docs/architecture/metadata-sync.md`), which also gets "Allow control from the companion" and its last ten actions
  (R5 in `docs/architecture/remote-control.md`); a toast on the PC for each companion action; and from the migration
  (`docs/migration-plan.md` §8): **Suggest** in a Frame's question list (only when Ollama answers), **Meeting → Export
  this meeting to PowerPoint**, and **+ Content → Audio…** with its settings; and 6.11 (`docs/architecture/meeting-form.md`, W2): the Excel Meeting
  Workbook moved from the Meeting menu, Meeting tab, empty Studio and palette into **Settings → Data / Backup →
  Meeting from Excel** (it leaves in 6.12, W3); and the website's colour palette in the dark theme (6.11, owner's
  request: the last block of `app/css/theme.css`, colours only; keep it equal to `hosted/src/app/globals.css` :root);
  and the virtual camera's name, **FRAMECAST** (owner's request, 26 October: `packaging/build_vcam.py` NAME,
  `vcam/sink.py` VCAM_NAME, and the labels that name the camera; the program itself stays FRAMEDECKS); and the Settings menu grouped (Your meeting, Presenting, Account,
  This PC, Help), each item with a one-line description, plus "Find a setting" (owner's request, 26 October).
  Nothing else visible may change.
- The codebase is the source of truth; verify docs against it.
- Do not touch the legacy LAN remote or let the hosted app call the local HTTP server.
- Never commit secrets. `.env*` is ignored except `hosted/.env.example`. Never the Supabase `service_role` key; the
  publishable key goes only in Vercel and `hosted/.env.local`. A PC's sync key lives in Windows Credential Manager
  (`kc-sync.json` and `.kc-sync-key` are git-ignored).
- Sync never sends media or anything live, and never changes the Frame that is on screen (see the design).
- The workspace is the member list's source (M-D2). A linked PC keeps a copy and rebuilds it from the workspace if
  its member file goes missing (`cloud_sync.Engine._rebuild_members`; app setting `memberAuthority`, `pc` = before).

## Layout
- `app/`, `server.py`, `packaging/` — the unchanged desktop app (Python server, static UI, port 8750).
- `sync_entities.py` (plan ⇄ sync records) and `cloud_sync.py` (background sync, linking; off until a PC is linked) —
  Phase 4, wired into `server.py` (`SYNC`, `/api/sync`) and Settings (`app/js/account.js`).
- `cloud_remote.py` (Phase 5: commands from the companion, only while linked and the app setting `cloudRemote` is on)
  — wired into `server.py` (`CLOUD_REMOTE`, `CLOUD_BRIDGE`, `/api/remote-cloud/*`, this PC only) and run by the
  program's own window with the keys' functions (`app/js/cloud-remote.js`). `REMOTE` in `server.py` is the Wi-Fi
  phone remote, a different thing.
- `hosted/` — Next.js 16 online-first companion, built as **plain static files** (`output: "export"` → `hosted/out/`;
  free plan, `docs/project/free-hosting.md`). Deployed on Cloudflare Pages at `https://framedecks.pages.dev`
  (Root Directory `hosted`, output `out`; 26 October); `framedecks.vercel.app` stays until the owner retires it. No server code: `/api/sync-config` is a file written by
  `hosted/scripts/write-sync-config.mjs` at build time; the manifest is `hosted/public/manifest.webmanifest`.
- `hosted/supabase/migrations/` — SQL run in order in the Supabase SQL editor: `0001` workspaces, `0002` invitations,
  `0003` sync, `0004` remote control, `0005` the Live page's PC list, `0006` the audit log, `0007` explicit API grants, `0008` member groups, `0009` last-seen throttle (6.11.1; **not yet run live**). `0001`–`0008` have been run in the live project (26 October 2026): never edit
  one, add the next number.
  Each new one gets an undo script in `hosted/supabase/rollback/` (`NNNN_<name>_down.sql`).
- `tools/` — generators and checks (`make_emblem_assets.py`, `check_doc_links.py`, `generate_brand_assets.py`).
- `docs/FRAMEDECKS_MODERNIZATION_STATUS.md` — the detailed phase tracker; `docs/architecture/metadata-sync.md` — the
  agreed sync design and its delivery steps; `docs/architecture/remote-control.md` — the agreed Phase 5 design
  (controlling a service from the companion; R1–R5 as recommended) and its four delivery steps;
  `docs/architecture/companion-editing.md` — editing services in the companion (E1–E4 as recommended);
  `docs/architecture/meeting-form.md` — 6.11: the website Meeting Form, the camera check and `framedecks://` (W1–W3).
- `docs/project/2026-10-25-architecture-audit.md` — architecture, performance and product audit (critical issues
  C1–C10, optimizations P1–P10, budgets, roadmap); no UI changes. P1–P4 and C2 (`supervisor.py`, the crash
  watchdog in the installed exe) are built.
- `docs/architecture-review.md` and `docs/migration-plan.md` — review against the owner's target architecture (cloud
  for people, templates, AI, audit; desktop for media, rendering, camera) and the step order; decisions M-D1–M-D6.
  The owner answered M-D1–M-D6 (plan §8); all eight steps are built and merged (PR #32; `docs/post-migration-report.md`);
  hosting long term: `docs/architecture/hosting.md`.
- `ai.py` — optional free AI (M-D3): Ollama on this PC, or a self-hosted endpoint; cached; `Suggest` in a Frame's
  question list appears only when one answers (`docs/ai.md`). Never call a paid provider from the PC.
- `pptx_export.py` (Meeting → Export this meeting to PowerPoint, python-pptx) and Audio Content (`audio` kind in
  `store.js` SOUND_KINDS, `app/js/audio-player.js`, plays only in the program window while its Frame is live and on).
  Both are owner-approved entries (M-D4). Older versions drop Audio Content: update every linked PC first.
- Free plan (`docs/project/free-hosting.md`): `.github/workflows/db-keepalive.yml` (pings Supabase every 3 days) and
  `db-backup.yml` + `tools/db_backup.sh` (nightly, AES-256 encrypted with `BACKUP_PASSPHRASE`, 30 days; restore:
  `docs/project/database-backup.md`). Both do nothing until their repository secrets exist.
- Licence: Apache 2.0 (`LICENSE`, `NOTICE`); every shipped dependency or vendored file needs a row in
  `THIRD_PARTY_NOTICES.md`. Signing: SignPath, off until its secret exists (`docs/project/code-signing.md`).
- Continuity: `CLAUDE.md`, `PROJECT_STATUS.md`, `PROJECT_ROADMAP.md`, `.ai/NEXT_SESSION.md`. The owner's live tests:
  `docs/qa/live-test-guide.md` (keep it in step when a tested behaviour changes).
- Companion design (26 October redesign): tokens in `hosted/src/app/globals.css` `:root`, the look in
  `hosted/src/app/design.css` (glass surfaces, navy and gold, one large title per page). Signed out, `/` is the landing
  page (`components/landing.tsx`); signed in, the dashboard (`components/overview.tsx`: hero, `glance.tsx` tiles,
  `workflow.tsx` "How it works"). Sign-in is a split layout (`auth-shell.tsx`). Use the tokens, not new hex colours.
  Motion (`motion.css`, `components/motion.tsx`): `data-reveal` rises into view on scroll (marked `data-in`, never a
  class: React rewrites classes), `data-spotlight` follows the pointer (once per frame, mouse only), `.fd-enter`/`Words` play on load, and a
  static ambient light sits behind every page; all of it stops under "reduce motion". Performance rule (owner, 8 GB
  PCs next to the program): an idle page draws nothing — no `infinite` animations, no animated `filter`/layout
  properties, `backdrop-filter` only on the sticky top bars. The About screen (`about-dialog.tsx`,
  `about.css`, the (i) button) shows `src/lib/brand.json`, written from the program's `app/js/brand.js` and
  `server.py` version by `scripts/write-brand.mjs` on every build (`tests/brand.test.mjs` fails if it is stale).
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
- **Branch.** Work from `main` (PR #32 is merged) on a new branch per change. Never
  force-push or rewrite pushed history. The repository is `mshobin/FRAMEDECKS`.
- **Set up once (PowerShell, at the repo root):**
  - `python -m venv .venv`
  - `.venv\Scripts\Activate.ps1`
  - `python -m pip install -r packaging/requirements-desktop.txt -c packaging/constraints.txt` (includes python-pptx
    for the PowerPoint export)
  - `cd hosted; npm ci; cd ..`
- **Run the program:**
  - `python desktop_app.py` (the real window).
  - `python server.py`, then open http://127.0.0.1:8750/dashboard.html in a browser; add `?audio=1` to let a browser
    tab play Audio Content.
  - Data lives in `%APPDATA%\FRAMEDECKS`. Set `KC_DATA_DIR` to a scratch folder for experiments.
- **Companion:**
  - `cd hosted; npm run dev`.
  - Put the public Supabase URL and publishable key in `hosted/.env.local` (never committed), named
    `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **AI (optional):**
  - Install Ollama (https://ollama.com), then run `ollama pull llama3.2`. **Suggest** then appears in a Frame's
    question list.
  - `tests/test_ai.py` uses a stand-in, not a real Ollama.
- **Local-only checks**, which the cloud sessions could not run:
  - the virtual camera in Zoom, Teams and OBS;
  - PowerPoint COM;
  - Credential Manager (the sync and ESV keys);
  - audio through the speakers;
  - Supabase itself.

## Keeping the handoff current (owner's rule)
- Update all four continuity files (`CLAUDE.md`, `PROJECT_STATUS.md`, `PROJECT_ROADMAP.md`, `.ai/NEXT_SESSION.md`)
  at the end of **every** step, in the same PR as the work: what is done, what is live, what the owner must do next.
- In long steps, push work in progress with the four files describing the partial state, so a session cut off by a
  usage limit still leaves a correct handoff.

## Commands
- Before and after every change, all of these must pass (the cloud session's last results are in brackets):
- Desktop JS tests: `node tests/run.js` [4/4]; Python: `python -m unittest discover -s tests -p "test_*.py"` [139 OK];
  packaging: `python packaging/check.py` [6.11.1].
- Hosted (run inside `hosted/`, there is no root package.json): `npm test` [110/110], `npm run lint`, `npm run typecheck`, `npm run build`.
  `npm test` applies every migration to in-memory Postgres (PGlite) and loads `src/lib/sync-entities.ts` with Node's
  type stripping.
- Sync fixtures: `python tools/make_sync_fixtures.py` rebuilds `tests/fixtures/sync/` (needs Node) after changing
  `store.js` normalize or the record mapping; `tests/sync-fixtures.test.js` says when.
- Docs: `python tools/check_doc_links.py`, `git diff --check`.
- Lint: `ruff check .` (`ruff.toml`; CI pins ruff 0.16.8) and `node --check` on `app/js/*.js` (the Desktop checks
  workflow). Website budget: `node hosted/scripts/check-budget.mjs` after `npm run build`.
- Releases: [docs/development/release-checklist.md](docs/development/release-checklist.md) (pilot first; rollback).

## Gotchas
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
- The old name appears only where upgrades need it: `legacy.py` (moves old data folders), `packaging/installer.iss`
  (removes old shortcuts, program folder and camera files), `server.py` `OLD_FIREWALL_RULES`, `tools/undo-ipad-remote.ps1`
  and `tests/test_legacy.py`. Use FRAMEDECKS everywhere else; the camera is called FRAMECAST (files `framedecks_vcam64/32.dll`).
- The companion must stay a static export: no server routes, cookies, server actions, `dynamic`/`revalidate`, metadata
  routes that need a server, or cacheComponents/PPR (they break `output: "export"`).
- `hosted/AGENTS.md`: this Next.js version has breaking changes; read `hosted/node_modules/next/dist/docs/` before writing hosted code.
- The emblem `app/img/kc-emblem.webp` and `hosted/public/framedecks-emblem.webp` must stay identical. Regenerate all emblem/icon files with `tools/make_emblem_assets.py` (master: `assets/brand/framedecks-emblem.svg`).
- The repo auto-commits as "Update project files and documentation"; check `git status` before committing.
- Browser code must name each `NEXT_PUBLIC_` variable in full (`publicSupabaseEnv()`), or Next.js does not inline it.
- Supabase (from 30 October 2026) gives new tables no API access: every migration that creates a table must `grant`
  the operations its RLS policies allow to `authenticated` (never `anon`). `tests/pglite-supabase.mjs` grants nothing
  by itself, and `supabase-schema.test.mjs` fails if a table the companion uses is not granted.
- In SQL permission checks, wrap comparisons that can be null in `coalesce(…, false)`: a null makes an `IF` skip the
  refusal (a test caught this in `computer_revoke`).
- This cloud environment cannot reach `*.supabase.co` or Vercel preview hosts: test hosted features against stand-in
  responses (Playwright `page.route`) and leave live checks to the owner.
