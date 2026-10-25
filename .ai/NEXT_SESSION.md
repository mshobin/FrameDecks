# NEXT SESSION HANDOFF

Updated 25 October 2026 (end of the session that built hosted sign-in, workspaces and sync steps 1–3).

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
    (`app/js/account.js`), companion `/api/sync-config` (PR #23, open at the time of writing).

## In Progress
Phase 4 sync, step 4 of 5 (nothing started yet). PR #23 waits for the owner's merge; its Windows installer build was
started on GitHub (run 40188686889).

## Pending
- **Step 4 (companion):** a "Computers" page where an owner/admin types the PC's code (`computer_link_approve`) and
  sees and revokes linked PCs (`computers` table, `computer_revoke`); a view-only "Services" page from `sync_pull` +
  `join` in `hosted/src/lib/sync-entities.ts`; a Members view for owners/admins (member records).
- **Step 5 (live):** the owner runs `0002` and `0003` in the Supabase SQL editor (in that order), links a PC, and checks a
  change on one PC appears on another and in the companion. Windows Credential Manager is only exercised there.
- Later, together (owner's choice): Google/Microsoft providers and a live test of invitations.
- Live RLS tests: need `*.supabase.co` allowed in this cloud environment's network settings (it is blocked, as are
  the Vercel preview hosts; the production URL is reachable).
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
None for step 4. Step 5 needs the owner to run `0002` and `0003` in Supabase.

## Recommended Next Task
Step 4 of [metadata-sync.md](../docs/architecture/metadata-sync.md) §9, in `hosted/`. Read
`hosted/node_modules/next/dist/docs/` first (this Next.js has `cacheComponents` on). Reuse `browserSupabase()`,
`useSession()`, the workspace panel's styles and `sync-entities.ts`; test against stand-in responses as for sign-in,
since `*.supabase.co` is blocked here. The public Supabase values are URL `https://slrsykiknlqlivlnpvrb.supabase.co`
and the owner's publishable key; put them only in `hosted/.env.local` (ignored), never in the repo.

## Files Likely To Change Next
`hosted/src/app/` (new `computers/` and `services/` routes), `hosted/src/components/`, `hosted/tests/`,
`docs/architecture/metadata-sync.md`, the continuity files.

## Session Handoff
Run `git status`. Before and after changes: desktop `node tests/run.js`, `python -m unittest discover -s tests -p
"test_*.py"`, `python packaging/check.py`; hosted (in `hosted/`) `npm test`, `npm run lint`, `npm run typecheck`,
`npm run build`; `python tools/check_doc_links.py` and `git diff --check`. Update this file, `PROJECT_STATUS.md` and
`PROJECT_ROADMAP.md` in every PR.
