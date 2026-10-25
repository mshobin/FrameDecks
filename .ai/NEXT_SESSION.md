# NEXT SESSION HANDOFF

Updated 25 October 2026, after the architecture review and migration plan (PR #32).

## Completed
- **6.10** (Quit really quits) merged (PR #7). Logo QA done, with a heavier small-size emblem for 16–32 px (PR #18;
  [report](../docs/qa/2026-10-25-logo-visual-qa.md)). Repository drift resolved: `main`'s plan stands, PRs #8–#16
  closed with their branches kept ([PROJECT_STATUS.md](../PROJECT_STATUS.md) "Drift").
- **Hosted sign-in** (Supabase Auth, emailed link; Google/Microsoft buttons appear once enabled): PR #18, deployed with
  the Vercel variables, **confirmed live by the owner**.
- **Profile and workspaces** (`hosted/src/components/workspace-panel.tsx`): PR #19, **confirmed live** (name "Shobin",
  workspace "BSF Study" as Owner).
- **Members and invitations** (`0002_invitations.sql`, `hosted/src/components/workspace-members.tsx`): PR #20. Not run
  live yet: the owner will run `0002` and test it together with Google/Microsoft sign-in later.
- **Phase 4 sync of service plans**, design agreed ([metadata-sync.md](../docs/architecture/metadata-sync.md), owner
  decisions in its §10):
  - Step 1 database `0003_sync.sql` (PR #21).
  - Step 2 record mapping `sync_entities.py` / `hosted/src/lib/sync-entities.ts` with shared fixtures (PR #22).
  - Step 3 PC background sync `cloud_sync.py`, `server.py` `/api/sync`, Settings → FRAMEDECKS account
    (`app/js/account.js`), companion `/api/sync-config` (PR #23; the Windows installer build passed).
  - Step 4 companion pages (PR #24, merged; Windows installer built from `main`, run 40201806083): **Services** (view-only plan: Frames, Content, scripts; media named only),
    **Members** (owners/admins), **Computers** (type the PC's code, see and disconnect PCs), a shared sidebar
    (`app-shell.tsx`) and a workspace picker. Browser-tested against stand-in responses as owner, member, on a phone
    and before `0003` is run.

## In Progress
- Phase 4 sync: steps 1–4 built. Step 5 (live test) needs the owner.
- Phase 5, design agreed ([remote-control.md](../docs/architecture/remote-control.md); R1–R5 as recommended: actions
  run in the PC's own window, the listed actions, owners/admins plus members given "Can run services", no end-to-end
  encryption yet, a Settings switch off by default). Step 1 built: `hosted/supabase/migrations/0004_remote.sql`
  (`remote_send`, `remote_take`, `remote_report`, `remote_publish`, `memberships.can_run_services`), tested in
  `hosted/tests/supabase-remote.test.mjs` (PR #25, merged).
- Phase 5 step 2 built: `cloud_remote.py` (asks `remote_take` about once a second while a phone is active, every
  5 seconds otherwise; reports; publishes the status), wired into `server.py` (`CLOUD_REMOTE`, `CLOUD_BRIDGE`,
  local-only `/api/remote-cloud/next` and `/done`, app setting `cloudRemote` off by default, `remote` in
  `GET /api/sync`) and `app/js/cloud-remote.js` in the dashboard (runs each command with the keys' functions; toast
  "Go Live · from Shobin"). Tested by `tests/test_cloud_remote.py` (13) and in the real program in a browser against
  a stand-in cloud: Go Live, Next (same Frame as the `]` key), blackout on/off, Hide all, an unknown Frame refused,
  switch off leaves commands untaken (PR #26, merged; Windows installer built).
- Phase 5 step 3 built: Settings → FRAMEDECKS account (linked) gets "Control from the companion": the switch "Allow
  control from the companion" (app setting `cloudRemote`, off by default) and the last ten actions (`app/js/account.js`).
  Companion: a **Live** page (`/live`, `hosted/src/components/live-panel.tsx`, helpers in `hosted/src/lib/live-view.ts`):
  the PC with Online / Not connected (status younger than 45 s by the database's clock), the Frame on screen, big
  Previous / Next, Hide all, Black screen, show/hide question and scripture, the Frame list with Go Live, the
  Teleprompter script, and the PC's answer to the last press. Reads `remote_computers(org)` every 2 s, a new
  `0005_remote_live.sql` (members cannot read `computers`). "Can run services" checkbox per member for owners/admins
  in the Overview's member list (`workspace-members.tsx`; the existing admin-only update policy on `memberships`
  allows it, no new function). Tested: PGlite (`remote_computers` only for people who may run services), Python check
  that the PC's status fields match `LiveStatus`, `hosted/tests/live-view.test.mjs`, and browsers against stand-in
  responses (phone and desktop, owner, a member without permission) and the real program (switch, last actions).
  QA pictures: `docs/qa/2026-10-25-companion-live-*.png`, `-can-run-services.png`, `-settings-control-from-companion.png`.
  PR #27 merged; hosted checks and the Windows installer build from `main` passed (run 40207526698, the installer for
  the owner's live tests).
- **Editing in the companion** (D3's "next step"; [companion-editing.md](../docs/architecture/companion-editing.md),
  E1–E4 as recommended; design PR #28 merged). Steps 1–2 built: `hosted/src/lib/frame-edit.ts` (name, group, script,
  questions, scripture reference/translation/text, Frame order; the PC's limits; only changed fields are sent,
  `applyDraft`/`rebase`) and editing on the Services page for owners and admins (`services-panel.tsx`: Edit, up/down,
  "on screen" note from `remote_computers` when available, conflict → latest version with the person's changes
  kept). Saves with `sync_push` (no database change). Tested: `hosted/tests/frame-edit.test.mjs` (6; the desktop's
  `store.js` normalize keeps every edit unchanged) and a browser run against stand-ins serving the shared fixture
  (edit, on-screen note, conflict keeps the PC's newer script, reorder, phone, a member sees no Edit). QA pictures
  `docs/qa/2026-10-25-companion-edit-frame*.png`. PR #29 merged; Windows installer built from `main` (run 40209063094).
- **Frame history and restore** (the "record history view" of the plan; [companion-editing.md](../docs/architecture/companion-editing.md) §6):
  on the Services page every Frame has History (versions kept 30 days by `entity_history`, who/when/what changed;
  `hosted/src/lib/history-view.ts`, `hosted/src/components/frame-history.tsx`), owners and admins can Restore a
  version, and "Deleted in the last 30 days" brings a deleted Frame back. No database change. Tested:
  `hosted/tests/history-view.test.mjs` (4) and a browser run against stand-ins (versions, restore, deleted Frame back,
  member view-only on a phone). QA picture `docs/qa/2026-10-25-companion-frame-history.png`. PR #30 merged.
- **Live test guide** for the owner: [docs/qa/live-test-guide.md](../docs/qa/live-test-guide.md), one pass through the
  database scripts, the installer, and tests A (sync), B (phone control), C (editing), D (history), with what to
  expect and what to send back (PR #31, merged). Installer for it: the latest "Build Windows installer" run on
  `main` (run 40209501557 at `2a418b4` passed; later runs only add documentation).
- **Architecture, performance and product audit** (owner's brief, no UI changes):
  [docs/project/2026-10-25-architecture-audit.md](../docs/project/2026-10-25-architecture-audit.md). Verdict: the
  boundaries are right (local rendering and media, text-only cloud, phones send commands). Critical: unsigned
  installer and no auto-update (C1), no restart if the process dies mid-meeting (C2). High: whole-plan disk write
  and a sync round on every live press (C3, C4 → P1, P2), full-resolution images and 4K screen frames held in RAM
  (C5, C6 → P3, P4). Phase 1 of its roadmap is the proposed next work.
- **Audit Phase 1 on PR #32** (owner: "continue with 2"): P1+P2 (`server.py` `plan_fingerprint`, live presses
  written behind after 1 s, `flush_state` on quit/backup/import, sync poked only for plan changes;
  `tests/test_save_state.py`), P3 (`vcam/layers.py` `fit_for_drawing`), P4 (`vcam/screen.py` DXGI stores changed
  frames only; `tests/test_resources.py`), C2 (`supervisor.py`, `tests/test_supervisor.py`; packaged as a hidden import).
- **Stream Deck plugin on PR #32** (owner: "I need a plugin"): `streamdeck/` (SDK 3, Node 24; Next, Previous,
  Go Live with a Frame number, Hide all, Black screen, question, scripture), `server.py` `/api/command` and
  `/api/command/status` (this PC only), run through the window bridge with `quiet` (no toast);
  `.github/workflows/streamdeck.yml` builds the `.streamDeckPlugin`; `docs/remote-control.md` "Stream Deck".
  Checked end to end against the real program in a browser.
- **Target architecture review and migration plan** (owner's MISSION brief; documents first, no code):
  [docs/architecture-review.md](../docs/architecture-review.md), [docs/migration-plan.md](../docs/migration-plan.md).
  Free code signing: SignPath Foundation, only for a public OSI-licensed repository (M-D1).
- **Migration step 1 (audit log)** on PR #32: `hosted/supabase/migrations/0006_audit_log.sql` (`audit_log`, written
  only by triggers on memberships, invitations and computers; owners/admins read; kept one year), undo script
  `hosted/supabase/rollback/0006_audit_log_down.sql`, 8 PGlite tests `hosted/tests/supabase-audit.test.mjs`.
- **Migration step 2 (ESV key)** on PR #32: `server.py` `ESV_KEY` (`cloud_sync.SecretStore` with target
  `FRAMEDECKS/esv-key`); a key in `bcc-scripture.json` from an older version is moved the first time it is read and
  removed from the file only after the store reads it back; if the store fails the file keeps it. Settings unchanged.
  `tests/test_esv_key.py` (4) and checked against the real program.
- **Migration step 3 (missing-media check)** on PR #32: `server.py` `media_check` (Frames naming files not in the
  media folder), `GET /api/media/check` (this PC only), `missingMedia` in Diagnostics, one log line when a sync
  brings such a Frame; `tests/test_media_check.py` (4). Size/hash in sync records and an on-screen line are not
  built (design needed; owner approval). Results of steps 1–3: [docs/post-migration-report.md](../docs/post-migration-report.md).
- **Explicit API grants** `0007_data_api_grants.sql` (Supabase's 30 October 2026 change); the PGlite stand-in grants
  nothing by itself; a schema test checks every table the companion uses is granted.
- **Step 4 (M-D1, licence and signing)**: `LICENSE` (Apache 2.0), `NOTICE`, `THIRD_PARTY_NOTICES.md` (shipped in the
  program folder), README code signing policy, SignPath steps in `build-windows.yml` (off until the
  `SIGNPATH_API_TOKEN` secret exists). Owner steps: [docs/project/code-signing.md](../docs/project/code-signing.md).
- **Step 5 (M-D2)**: the companion's Members page adds, edits and removes people (`member-edit.ts`, same shape as the
  desktop's normalize); a linked PC rebuilds a missing member file from the workspace (`memberAuthority`).
- **Step 8 (M-D6)**: `0008_member_groups.sql`; groups on the companion's Members page only.
- **Step 6 (M-D3)**: `ai.py` + `/api/ai/*` + **Suggest** in `app/js/frame-lists.js` (hidden without Ollama);
  `tests/test_ai.py` (6); user guide `docs/ai.md`.
- **Step 7 (M-D4)**: PowerPoint export (`pptx_export.py`, `/api/export/pptx`, Meeting menu) and Audio Content
  (`+ Content → Audio…`, `audio-player.js`, `/api/media/audio`); python-pptx added to the Windows build.
- Tidy-up: the "older docs reference 6.6" debt is closed (they mention 6.6 as history; the 6.6 audit is marked as a
  snapshot; the coding-standards comment template no longer names a version).

## Pending
- **Step 5 (live, the owner):** in the Supabase SQL editor run `hosted/supabase/migrations/0002_invitations.sql`, then
  `0003_sync.sql`, `0004_remote.sql`, `0005_remote_live.sql`, `0006_audit_log.sql`, `0007_data_api_grants.sql`, `0008_member_groups.sql` (once each, in that order; `0007` is
  needed since Supabase's 30 October 2026 change and is safe to run again). Then on the service PC: Settings → FRAMEDECKS account → Link to a
  workspace; in the companion: Computers → type the code. Check: Services shows the plan; edit a Frame on the PC and
  it appears within a minute; Members shows the member list. Credential Manager is exercised here for the first time.
- **Phase 5 step 4 (live, the owner)**, after sync step 5 with the same installer: on the PC, Settings → FRAMEDECKS
  account → tick "Allow control from the companion"; on a phone on mobile data, open the companion → Live: the PC shows
  Online; press Next (the Frame moves within about a second; the PC shows "Next Frame · from ‹name›"), Go Live on a
  Frame, Black screen, Hide all; untick the switch: the page shows "Not connected" within 45 s and presses do nothing.
- **Companion editing step 3 (live, the owner):** with sync linked, edit a Frame's script on the Services page from a
  phone; it appears on the PC within a minute; edit the Frame that is on screen: it is applied when it leaves.
- After step 5: a second PC (sync already supports it; test with two data folders or PCs).
- Later, together (owner's choice): Google/Microsoft providers and a live test of invitations.
- Live RLS tests: need `*.supabase.co` allowed in this cloud environment's network settings.
- A person checks the real tray icon on an installed PC. Real-device PWA install test. Device pairing (Phase 5).

## Technical Debt
See [PROJECT_STATUS.md](../PROJECT_STATUS.md).

## Risks
- Sync is tested against a stand-in cloud with the database's rules (`tests/test_cloud_sync.py`) and the database on
  PGlite, not yet against live Supabase.
- Closed PRs #8–#16 are not `main`'s plan; reuse only what PROJECT_STATUS.md "Worth reusing" lists.

## Assumptions
- The hosted app is separate from the LAN remote and online-first; it never calls the PC's local server.
- D4 (sync conflict rules) was not answered by the owner; built as recommended ("keep both" for Frames, last writer
  wins for settings and people).

## Blockers
Step 5 needs the owner to run `0002`–`0005` in Supabase and to have the PR-built desktop app on the service PC
(an installer from "Build Windows installer" on `main`, or running `server.py` from source).

## Recommended Next Task
All eight migration steps are built on PR #32 ([report](../docs/post-migration-report.md)). Next: the owner's live
tests (database `0002`–`0008`, then [the live test guide](../docs/qa/live-test-guide.md) A–F), the owner's M-D1 steps
([code-signing.md](../docs/project/code-signing.md)), and later the companion's move to Cloudflare
([hosting.md](../docs/architecture/hosting.md)). Open from step 3: size/hash asset references (design) and an
on-screen missing-media line (approval). Meanwhile:
Help the owner through [the live test guide](../docs/qa/live-test-guide.md) (sync step 5, Phase 5 step 4, companion
editing step 3 and history; installer from the latest "Build Windows installer" run on `main`, migrations
`0002`–`0005`). Fix what they find and mark each test done in the four files. Then: Google/Microsoft sign-in with the
invitation test (owner's choice, later), live RLS tests, real-device PWA test.
Read `hosted/node_modules/next/dist/docs/` before hosted code (`cacheComponents` is on). The public Supabase values
are URL `https://slrsykiknlqlivlnpvrb.supabase.co` and the owner's publishable key; only in `hosted/.env.local`.

## Files Likely To Change Next
Whatever the live tests find: `hosted/src/lib/frame-edit.ts`, `hosted/src/components/services-panel.tsx`,
`hosted/src/components/frame-history.tsx`, `cloud_remote.py`, `app/js/cloud-remote.js`, `hosted/src/components/live-panel.tsx`, `cloud_sync.py`, `hosted/src/components/*-panel.tsx`, `hosted/supabase/migrations/` (a new numbered
migration only, never an edited one), the continuity files.

## Session Handoff
Run `git status`. Before and after changes: desktop `node tests/run.js`, `python -m unittest discover -s tests -p
"test_*.py"`, `python packaging/check.py`; hosted (in `hosted/`) `npm test`, `npm run lint`, `npm run typecheck`,
`npm run build`; `python tools/check_doc_links.py` and `git diff --check`. Update all four continuity files
(`CLAUDE.md`, `PROJECT_STATUS.md`, `PROJECT_ROADMAP.md`, this file) at the end of every step (owner's rule).
