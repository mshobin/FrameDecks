# NEXT SESSION HANDOFF

Updated 25 October 2026, after sync step 4 (companion pages; PR open at the time of writing).

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
  - Step 4 companion pages (PR after #23): **Services** (view-only plan: Frames, Content, scripts; media named only),
    **Members** (owners/admins), **Computers** (type the PC's code, see and disconnect PCs), a shared sidebar
    (`app-shell.tsx`) and a workspace picker. Browser-tested against stand-in responses as owner, member, on a phone
    and before `0003` is run.

## In Progress
Phase 4 sync: steps 1–4 built. Step 5 (live test) needs the owner.

## Pending
- **Step 5 (live, the owner):** in the Supabase SQL editor run `hosted/supabase/migrations/0002_invitations.sql`, then
  `0003_sync.sql` (once each, in that order). Then on the service PC: Settings → FRAMEDECKS account → Link to a
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
Help the owner through step 5 and fix what it finds. If the owner is not ready: Phase 5 (secure device pairing),
starting from the design on branch `claude/saas-phase4` (`docs/architecture/pairing-protocol.md`), adapted to Supabase,
or companion editing of Frames (`sync_push` with the person's session; owners/admins only, as the database allows).
Read `hosted/node_modules/next/dist/docs/` before hosted code (`cacheComponents` is on). The public Supabase values
are URL `https://slrsykiknlqlivlnpvrb.supabase.co` and the owner's publishable key; only in `hosted/.env.local`.

## Files Likely To Change Next
Whatever step 5 finds: `cloud_sync.py`, `hosted/src/components/*-panel.tsx`, `hosted/supabase/migrations/` (a new
`0004` only, never an edited `0003`), the continuity files.

## Session Handoff
Run `git status`. Before and after changes: desktop `node tests/run.js`, `python -m unittest discover -s tests -p
"test_*.py"`, `python packaging/check.py`; hosted (in `hosted/`) `npm test`, `npm run lint`, `npm run typecheck`,
`npm run build`; `python tools/check_doc_links.py` and `git diff --check`. Update all four continuity files
(`CLAUDE.md`, `PROJECT_STATUS.md`, `PROJECT_ROADMAP.md`, this file) at the end of every step (owner's rule).
