# NEXT SESSION HANDOFF

Updated 25 October 2026, after companion editing steps 1–2 (E1–E4 as recommended).

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
  `docs/qa/2026-10-25-companion-edit-frame*.png`.

## Pending
- **Step 5 (live, the owner):** in the Supabase SQL editor run `hosted/supabase/migrations/0002_invitations.sql`, then
  `0003_sync.sql`, `0004_remote.sql`, `0005_remote_live.sql` (once each, in that order). Then on the service PC: Settings → FRAMEDECKS account → Link to a
  workspace; in the companion: Computers → type the code. Check: Services shows the plan; edit a Frame on the PC and
  it appears within a minute; Members shows the member list. Credential Manager is exercised here for the first time.
- **Phase 5 step 4 (live, the owner)**, after sync step 5 with the same installer: on the PC, Settings → FRAMEDECKS
  account → tick "Allow control from the companion"; on a phone on mobile data, open the companion → Live: the PC shows
  Online; press Next (the Frame moves within about a second; the PC shows "Next Frame · from ‹name›"), Go Live on a
  Frame, Black screen, Hide all; untick the switch: the page shows "Not connected" within 45 s and presses do nothing.
- **Companion editing step 3 (live, the owner):** with sync linked, edit a Frame's script on the Services page from a
  phone; it appears on the PC within a minute; edit the Frame that is on screen: it is applied when it leaves.
- After step 5: a second PC, and the record history view.
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
Help the owner through the live tests, all with the installer from `main` and migrations `0002`–`0005`: sync step 5,
Phase 5 step 4, and companion editing step 3 (edit a script on the phone; it appears on the PC within a minute;
editing the live Frame waits until it leaves the screen). Fix what they find. Then: Google/Microsoft sign-in with the
invitation test (owner's choice, later), live RLS tests, real-device PWA test.
Read `hosted/node_modules/next/dist/docs/` before hosted code (`cacheComponents` is on). The public Supabase values
are URL `https://slrsykiknlqlivlnpvrb.supabase.co` and the owner's publishable key; only in `hosted/.env.local`.

## Files Likely To Change Next
Whatever the live tests find: `hosted/src/lib/frame-edit.ts`, `hosted/src/components/services-panel.tsx`, `cloud_remote.py`, `app/js/cloud-remote.js`, `hosted/src/components/live-panel.tsx`, `cloud_sync.py`, `hosted/src/components/*-panel.tsx`, `hosted/supabase/migrations/` (a new numbered
migration only, never an edited one), the continuity files.

## Session Handoff
Run `git status`. Before and after changes: desktop `node tests/run.js`, `python -m unittest discover -s tests -p
"test_*.py"`, `python packaging/check.py`; hosted (in `hosted/`) `npm test`, `npm run lint`, `npm run typecheck`,
`npm run build`; `python tools/check_doc_links.py` and `git diff --check`. Update all four continuity files
(`CLAUDE.md`, `PROJECT_STATUS.md`, `PROJECT_ROADMAP.md`, this file) at the end of every step (owner's rule).
