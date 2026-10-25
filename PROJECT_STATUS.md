# PROJECT STATUS

Last verified: 25 October 2026 on `main` at `e2eaa22` (Phase 5 step 3 merged; GitHub hosted checks and the Windows
installer build passed there). Locally at step 3: desktop JS 4/4, Python 79 tests OK, `packaging/check.py` (6.10), hosted test 58/58, lint, typecheck and
build pass, doc links 0 problems; the program and the companion checked in browsers against stand-ins. Detail lives in
[docs/FRAMEDECKS_MODERNIZATION_STATUS.md](docs/FRAMEDECKS_MODERNIZATION_STATUS.md).

## Completed
- Desktop app preserved; 6.10 (Quit really quits) merged (PR #7); branding migrated; approved gold-outline emblem
  (`tools/make_emblem_assets.py`), with a heavier version used only at 16–32 px for favicons, tray and small icon
  sizes (PR #18).
- Hosted Next.js companion in `hosted/` (navy/gold theme), CI (`.github/workflows/hosted.yml`), live at
  `https://framedecks.vercel.app/`; PWA manifest and safe shell service worker.
- Supabase project `slrsykiknlqlivlnpvrb` with `0001_tenant_foundation.sql` run by the owner.
- **Sign-in** (emailed link; Google/Microsoft when enabled), PR #18: **confirmed live by the owner**.
- **Profile and workspaces**, PR #19: **confirmed live** (name saved, workspace "BSF Study" as Owner).
- **Members and invitations** (`0002_invitations.sql`), PR #20: built and tested in-repo; not run live yet (owner's
  choice, with Google/Microsoft later).
- Phase 4 sync of service plans, steps 1–3 of 5 ([metadata-sync.md](docs/architecture/metadata-sync.md)): database
  `0003_sync.sql` (PR #21), record mapping (PR #22), PC background sync and Settings → FRAMEDECKS account (PR #23),
  companion Services / Members / Computers pages (PR #24). Windows installer built from `main` for the live test
  (run 40201806083).
- In-repo database tests on PGlite (`hosted/tests/pglite-supabase.mjs` applies every migration): tenant RLS,
  invitations, sync.

## In Progress
- Phase 4 sync: step 5, the live test, which the owner runs (see `.ai/NEXT_SESSION.md` "Pending").
- Phase 5 (control a service from the companion): design agreed (R1–R5 as recommended,
  [remote-control.md](docs/architecture/remote-control.md)); step 1 built (`0004_remote.sql`, 8 PGlite tests in
  `hosted/tests/supabase-remote.test.mjs`, PR #25); step 2 built: `cloud_remote.py`, the window bridge
  (`/api/remote-cloud/*`, `app/js/cloud-remote.js`) and the app setting `cloudRemote` (off; no switch on screen
  until step 3), 13 tests in `tests/test_cloud_remote.py` plus a real-program browser check (PR #26); step 3 built:
  the Settings switch and last ten actions, the companion's **Live** page (`/live`, `0005_remote_live.sql`) and a
  "Can run services" checkbox per member (PR #27, merged; installer from `main` run 40207526698). Next step 4,
  the owner's live test.
- Editing in the companion: design proposed ([companion-editing.md](docs/architecture/companion-editing.md)),
  waiting for the owner's E1–E4.

## Pending
- Owner: run `0002_invitations.sql`, `0003_sync.sql`, `0004_remote.sql` and `0005_remote_live.sql` in the Supabase
  SQL editor (needed for the live tests); later,
  Google/Microsoft providers and a live test of invitations.
- Live RLS tests: need `*.supabase.co` allowed in this cloud environment's network settings.
- Real-device PWA install and offline acceptance on the deployed URL.
- Phase 5 step 4, the owner's live test; `0004` and `0005` to be run in Supabase after `0003`.
- A person checks the real tray icon and Windows Credential Manager on an installed PC.

## Technical Debt
- RLS tests run on PGlite with a stubbed `auth.uid()`, not real Supabase; live-database tests are still needed.
- Sync is tested against a stand-in cloud that follows the database's rules (`tests/test_cloud_sync.py`), not yet
  against live Supabase; D4 (conflict rules) was built as recommended without the owner's explicit answer.
- `npm audit`: high findings in the dev-only ESLint tree (not applied: fix would downgrade `eslint-config-next`).
- Emblem is now a vector master (`assets/brand/framedecks-emblem.svg`); the wordmark in the horizontal/stacked logos is still cropped from the legacy raster `framedecks-logo-source.png`, so it is the only raster-limited part of the brand set.
- Older audit docs still reference version 6.6.

## Risks
- Vercel Root Directory `hosted` is assumed from the working deployment, not read from the dashboard.
- Logo checked on 25 October 2026 ([logo visual QA](docs/qa/2026-10-25-logo-visual-qa.md)): clear in both themes, the
  Speaker/Teleprompter header and the remote. The faint 16 px favicon and 16–20 px tray icon on light backgrounds are fixed by a
  heavier small-size emblem (owner-approved; used only at 16–32 px). The program icon (.ico) carries the new emblem. Unchecked: the real tray
  on an installed PC.
- **Repository drift: parallel work outside `main` contradicts its decisions** (see "Drift" below).
- Service worker caching must never cover `/api/` or `/auth/` once auth exists (guarded and tested).

## Drift (found and resolved 25 October 2026)
Pull requests from an earlier workstream predated `main`'s choices and conflicted with them. Decision (owner asked for
the recommended course): `main`'s plan stands. #7 was brought up to date and merged; #8–#16 were closed with a note.
Their branches are kept, so any of them can be reopened or mined:

| PR | What | Outcome |
|---|---|---|
| #7 | 6.10: Quit really quits (desktop fix) | Merged after `main` was merged in and every check passed. |
| #8 | Flutter port of the Studio and phone remote | Closed: outside `main`'s plan. Branch `claude/flutter-platform`. |
| #9, #10 | Windows 11 and Mac virtual cameras | Closed: desktop function change. Branches `claude/windows11-camera`, `claude/mac-camera`. |
| #11 | SaaS + PWA architecture (Cloudflare) | Closed: `main` uses Vercel + Supabase. Branch `claude/saas-pwa-architecture`. |
| #12 | Alternative rename, logo and Decks model | Closed: `main` has its own approved emblem; desktop UI frozen. Branch `claude/framedecks-branding`. |
| #13–#16 | SaaS Phases 1–4 on Cloudflare | Closed: different backend. Branches `claude/saas-phase1` … `claude/saas-phase4`; unfinished `claude/saas-phase5`. |

**Worth reusing when `main` reaches these steps** (designs and tests, not the Cloudflare code):
- Secure device pairing (`main` Phase 5): `docs/architecture/pairing-protocol.md` on `claude/saas-phase4`: 5-minute
  QR / 6-digit code, approval at the PC, X25519 key agreement bound to the QR or six check digits, AES-GCM sealed
  messages with replay counters, roles enforced by the runtime, revoke in under a second; phone and PC crypto checked
  against one shared test vector (`tests/pair-crypto.test.js`, `tools/make_pairing_vector.py`).
- Runtime channel: `docs/architecture/relay-protocol.md` (same branch): the PC connects outward; relayed requests are
  replayed on a listener that treats them as a phone, never as the PC, so the remote's allow-list and roles hold.
- Metadata sync (`main` Phase 4): `docs/architecture/cloud-api.md` and `app/js/entities.js` on `claude/saas-phase2`:
  per-record revisions, a workspace sequence, conflict rules ("never lose a Frame"), members end-to-end encrypted with
  a recovery key, and a two-computer test harness.

## Assumptions
- Hosted companion is online-first and separate from the LAN remote.

## Blockers
- Step 5 needs the owner to run `0002` and `0003` in Supabase and to link a PC. Google/Microsoft sign-in needs the
  owner's OAuth apps (their secrets go only into the Supabase dashboard).

## Recommended Next Task
See [.ai/NEXT_SESSION.md](.ai/NEXT_SESSION.md).
