# NEXT SESSION HANDOFF

Updated 25 October 2026, after Phase 5 step 1 (the owner chose R1–R5 as recommended).

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
  `hosted/tests/supabase-remote.test.mjs`.

## Pending
- **Step 5 (live, the owner):** in the Supabase SQL editor run `hosted/supabase/migrations/0002_invitations.sql`, then
  `0003_sync.sql` (once each, in that order; `0004_remote.sql` can follow, nothing uses it yet). Then on the service PC: Settings → FRAMEDECKS account → Link to a
  workspace; in the companion: Computers → type the code. Check: Services shows the plan; edit a Frame on the PC and
  it appears within a minute; Members shows the member list. Credential Manager is exercised here for the first time.
- After step 5: editing in the companion (D3 "view first"), a second PC, and the record history view.
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
Step 5 needs the owner to run `0002` and `0003` in Supabase and to have the PR-built desktop app on the service PC
(an installer from "Build Windows installer" on `main`, or running `server.py` from source).

## Recommended Next Task
Help the owner through sync step 5 and fix what it finds. Then Phase 5 step 2 of
[remote-control.md](../docs/architecture/remote-control.md) §8: `cloud_remote.py` (takes commands about once a second
while the Settings switch is on, hands them to the program's own window, which runs the same `KCScenes` code as the
keys, reports results, publishes the status) with tests against a stand-in cloud and the real program in a browser.
Read `hosted/node_modules/next/dist/docs/` before hosted code (`cacheComponents` is on). The public Supabase values
are URL `https://slrsykiknlqlivlnpvrb.supabase.co` and the owner's publishable key; only in `hosted/.env.local`.

## Files Likely To Change Next
Whatever step 5 finds: `cloud_sync.py`, `hosted/src/components/*-panel.tsx`, `hosted/supabase/migrations/` (a new numbered
migration only, never an edited one), the continuity files.

## Session Handoff
Run `git status`. Before and after changes: desktop `node tests/run.js`, `python -m unittest discover -s tests -p
"test_*.py"`, `python packaging/check.py`; hosted (in `hosted/`) `npm test`, `npm run lint`, `npm run typecheck`,
`npm run build`; `python tools/check_doc_links.py` and `git diff --check`. Update all four continuity files
(`CLAUDE.md`, `PROJECT_STATUS.md`, `PROJECT_ROADMAP.md`, this file) at the end of every step (owner's rule).
