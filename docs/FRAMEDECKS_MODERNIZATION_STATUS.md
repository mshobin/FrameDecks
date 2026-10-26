# FRAMEDECKS modernization status

**Last updated:** 25 October 2026 ·
**Working branch:** `main`
**Current milestone:** Hosted foundation validated locally and live on Vercel; next is Supabase auth and tenant foundation (Phase 3)

**Overall implementation state:** Repository assessment, branding, and architecture are documented. The HTTPS-to-local-HTTP path is rejected; the hosted PWA is a separate online-first companion. A responsive static Next.js shell, shadcn-style UI base, boundary test, and independent CI workflow now exist and pass local checks, and the shell is deployed at `https://framedecks.vercel.app/`. Authentication UI, live tenant data, pairing, and real-device PWA install acceptance remain unimplemented; the manifest, safe shell service worker, and Supabase migration scaffold exist.

## Status definitions

- **Completed:** inspected or implemented and validated against its stated acceptance criteria.
- **Partially Complete:** some supporting implementation exists, but required behavior or validation is missing.
- **Not Started:** no implementation work has begun.
- **Blocked:** cannot proceed safely until a named decision, dependency, or validation is resolved.

## Repository baseline

| Area | Status | Evidence / remaining work |
|---|---|---|
| Current architecture and stack inventory | Completed | Documented in [FRAMEDECKS_AUDIT.md](FRAMEDECKS_AUDIT.md); existing application remains Python/HTML/CSS/vanilla JS. |
| Dependency and build assessment | Completed | Python build requirements and pinned constraints reviewed; the separate hosted/ app now adds Next.js/TypeScript/Tailwind. Supabase/Flutter/Stripe remain absent. |
| Security assessment | Completed | Existing loopback/LAN remote controls and SaaS security gaps documented; no penetration test claimed. |
| Performance assessment | Completed | Current workload and historical 6.6/6.7 metrics documented; current 6.9 hosted performance baseline remains future work. |
| Technical debt assessment | Completed | Large modules, custom server, cross-language state compatibility, and test gaps recorded. |
| SaaS readiness | Completed | Low by design; no accounts, tenants, cloud database, or hosted operations model. |
| PWA readiness | Partially Complete | Existing LAN remote has manifest/icons only. Hosted app now has a static shell, manifest, safe app-shell service worker (verified locally on a production build: registers, caches, loads offline) and independent checks; no auth, pairing, or real-device install test yet. |
| Offline capability assessment | Completed | Desktop workflows remain offline; hosted PWA is explicitly online-first and separate from the unchanged LAN remote. |
| Test baseline | Completed | Node tests: 3/3 files pass. Python tests: 24 run, 1 skipped, pass. Packaging self-check passes; OpenCV unavailable in this environment. |
| Audit and architecture documents | Completed | [Audit](FRAMEDECKS_AUDIT.md), [modernization architecture](FRAMEDECKS_MODERNIZATION.md), and [migration roadmap](project/saas-migration-roadmap.md) added/updated. |
| Product roadmap alignment | Completed | Root [ROADMAP.md](../ROADMAP.md) now describes free, metadata-only cloud modernization while preserving local presenting. |

## Modernization work

| Milestone | Status | Next action / acceptance gate |
|---|---|---|
| Phase 1 — Repository audit and architecture | Completed | Baseline checks pass; constraints, target design, risks, rollback, and preservation matrix documented. |
| Phase 2 — Next.js / TypeScript / Tailwind / shadcn foundation | Completed | Separate responsive app shell and CI pass locally without changing the desktop UI. `hosted/` is on `main` and deployed to Vercel (see the Vercel preview row). |
| Phase 3 — Supabase Auth and tenant foundation | Partially Complete | Scaffolded without credentials: `hosted/supabase/migrations/0001_tenant_foundation.sql` (organizations, memberships, profiles, deny-by-default RLS, owner trigger), `hosted/.env.example`, `hosted/src/lib/supabase-config.ts`, and static schema tests. Owner created the Supabase project and ran the migration (25 October 2026). Sign-in UI built: `/sign-in` (emailed link; Google/Microsoft buttons only when enabled in Supabase), `/auth/callback` (PKCE), top-bar account chip; env-gated so the site works without keys; browser-tested against stand-in Supabase responses (link request, error, PKCE exchange, sign-out) at 1280 and 390 px. Merged (PR #18) and deployed with the Vercel variables; the owner signed in on `https://framedecks.vercel.app` with an emailed link on 25 October 2026. Workspace panel added: display name (upsert on `profiles`), create a workspace (the trigger makes the creator owner), list own workspaces with role; PGlite RLS test covers these writes; confirmed live on 25 October 2026 (the owner saved a display name and created a workspace, shown as Owner). Members and invitations added (`0002_invitations.sql`: invitations table with RLS, `my_invitations`, `accept_invitation`, `workspace_members`, admins can no longer remove the owner); PGlite-tested and browser-tested; to be run and tested live later together with Google/Microsoft sign-in. Not yet done: Google/Microsoft providers and live RLS tests against the real database. |
| Phase 4 — Metadata-only synchronization | In progress (steps 1–4 of 5 built; step 5 is the owner's live test) | Design agreed with the owner on 25 October 2026: [metadata-sync.md](architecture/metadata-sync.md) (D1 settings section yes, D2 members and scripts sync with members visible to owners/admins only, D3 view first, D4 assumed as recommended). Step 1 built: `hosted/supabase/migrations/0003_sync.sql` (records with per-record revisions and an in-order workspace counter, 30-day history, linked computers with their own key, link codes), PGlite-tested in `hosted/tests/supabase-sync.test.mjs`; not yet run in Supabase. Step 2 built: the record mapping in `sync_entities.py` (desktop) and `hosted/src/lib/sync-entities.ts` (companion), both checked against shared fixtures made with the app's own `store.js` (`tests/fixtures/sync/`, `tools/make_sync_fixtures.py`): exact round trip, nothing live, no media bytes, a push carries only what changed. Step 3 built: `cloud_sync.py` (background sync, outbox state in `kc-sync.json`, conflict rules, live Frame held back, linking with a PC-made key in Windows Credential Manager) wired into `server.py` (`/api/sync`, this PC only), Settings → FRAMEDECKS account, and the companion's `/api/sync-config`; 21 tests against a stand-in cloud with the database's rules (`tests/test_cloud_sync.py`). Step 4 built: companion pages Services (view-only plan), Members (owners/admins) and Computers (link with the PC's code, see and disconnect PCs), a shared sidebar and a workspace picker; browser-tested against stand-in responses as owner, member, on a phone and before `0003` is run. Not yet run against the live project: the owner runs `0002` and `0003` in Supabase and links a PC (step 5). Editing in the companion (D3's next step, [companion-editing.md](architecture/companion-editing.md), E1–E4 as recommended): steps 1–2 built (`frame-edit.ts`, Services page editing for owners and admins; the desktop's normalize keeps every edit; browser-tested against stand-ins), plus Frame history with restore and deleted Frames brought back (30 days, `entity_history`); step 3 is the owner's live test. Define versioned contracts, local outbox, idempotency, conflict handling, and 6.9 import/export; prove no media bytes sync. Reusable design and tests from closed PR #14 (branch `claude/saas-phase2`): see PROJECT_STATUS.md "Worth reusing". |
| Phase 5 — Hosted PWA and secure device pairing | In progress (steps 1–3 of 4; step 4 is the owner's live test): design agreed, [remote-control.md](architecture/remote-control.md) (commands through the workspace, PC fetches them; R1–R5 as recommended); `0004_remote.sql` built and PGlite-tested; PC side `cloud_remote.py` with the window bridge built and tested (stand-in cloud, real program in a browser); Settings switch "Allow control from the companion" with the last ten actions, companion Live page (`/live`, `0005_remote_live.sql`) and a "Can run services" checkbox per member, browser-tested on phone and desktop against stand-ins | Online-first hosted companion; implement five-minute QR/6-digit challenge, authenticated user, runtime approval, trusted devices, roles, replay protection, revocation. No connection to the LAN HTTP server. A worked, tested protocol exists on branch `claude/saas-phase4` (closed PR #16): see PROJECT_STATUS.md "Worth reusing". |
| Phase 6 — Vercel operations / future Cloudflare edge | Not Started | Vercel-provided URL first; Cloudflare integration waits for custom domain. Add backup/restore, monitoring, and incident procedures. |
| Phase 7 — User-facing branding/terminology | Partially Complete | Existing desktop, workbook, remote/PWA, favicon, installer, and marketing-header surfaces use the supplied logo. The emblem is now a gold-only transparent image so it sits on the page background; the hosted overview uses the same palette and emblem, and the desktop light-theme header logos are darkened for contrast. Local browser QA confirms the emblem in the light-theme desktop header and teleprompter/speaker window and on the dark remote page. Remaining: verify the tray icon in a packaged Windows run, review the known faint 16px favicon with the owner before any mark change, and supply a higher-resolution original for true pixel-level sharpness. See [branding asset inventory](FRAMEDECKS_BRANDING_ASSETS.md). |
| Phase 8 — Compatibility rollout | Not Started | Pass preservation matrix on real supported devices; keep local 6.9 rollback available. |

## Autonomous modernization execution milestones

This table tracks the execution order requested for the current modernization run. The numbered phases here are
distinct from the target-architecture workstreams above.

| Execution phase | Status | Evidence / gate |
|---|---|---|
| Phase 1 — Repository audit | Completed | Audit and target architecture documented; no unsupported security test claims. |
| Phase 2 — Branding asset migration | Completed | Supplied logo is canonical; current app, remote/PWA, favicon, installer, workbook, and header assets were regenerated and checked. |
| Phase 3 — Architecture/foundation planning | Completed | Target architecture, preservation boundaries, and staged modernization plans are documented. |
| Phase 4 — PWA transport decision and architecture | Completed | Rejected HTTPS-to-local-HTTP. Approved the separate online-first hosted companion with Supabase auth and a paired outbound runtime channel; the current LAN remote remains unchanged. |
| Phase 5 — Next.js hosted foundation | Completed | Static responsive shell, shadcn-style base, no-local-HTTP test, and independent lint/typecheck/test/build workflow are implemented; local checks pass and the production URL `https://framedecks.vercel.app/` serves the shell (verified 25 October 2026). |
| Phase 6 — Supabase authentication and tenancy | Not Started | Requires implementation and project/provider credentials before OAuth or hosted auth can be end-to-end validated. |
| Phase 7 — Metadata sync, hosted control, and pairing | Not Started | Requires versioned contracts, tenant RLS, runtime adapter, pairing, and authorization tests. |
| Phase 8 — PWA install/cache and operations | Partially Complete | Manifest (`src/app/manifest.ts`), safe app-shell service worker (`public/sw.js`; same-origin GET only, never `/api/` or `/auth/`) and a production-only registrar are implemented with static tests. Real-device install and offline acceptance still need a deployed build. |

### Phase 4 metadata contract foundation

`hosted/src/lib/sync/contracts.mts` defines the first versioned, metadata-only presentation envelope and sync operation. Runtime validation is allowlist-based: presentation content has bounded text fields, media is represented only by an opaque UUID plus media type, and unknown properties (including local paths or raw media fields) are rejected. Operation IDs are stable across retries, duplicate enqueue is idempotent, reuse with changed content is rejected, and a stale base revision returns an explicit conflict rather than applying last-write-wins. JSON operations are capped at 512 KiB; the pure outbox helpers cap the queue at 100 operations / 5 MiB.

This is a contract and queue-logic foundation, not a durable outbox or a claim that sync is active. There is no local runtime adapter, IndexedDB/disk persistence, API/database write path, or import/export bridge yet. The desktop app and LAN remote remain untouched. The next Phase 4 slice is a versioned 6.9 JSON importer/exporter with dry-run validation and representative round-trip fixtures, followed by durable outbox persistence and authenticated transport only after the tenant/auth boundary is ready.

### Phase 4 transport decision and boundary

The browser remote in `app/remote.html` and `app/js/remote.js` uses relative HTTP requests to the PC, a PIN login,
and an HttpOnly `SameSite=Strict` session cookie. `server.py` checks an exact `http://<Host>` origin for state
changes and does not implement CORS. A hosted HTTPS page cannot direct those relative requests to the PC, and
repointing them to its HTTP LAN address would introduce cross-origin, mixed-content, private-network, and cookie
restrictions. A service worker is origin-scoped and cannot bypass those browser controls.

The accepted resolution is a separate online-first hosted companion, with no requests from hosted HTTPS to the
local HTTP listener. Browser-specific install, cache, lifecycle, and authentication behavior still require testing
on current iOS Safari and Android Chrome before advertising platform support. The hosted app must make its online
requirement explicit; the existing LAN remote remains available unchanged for local/offline use.

The previous transport analysis remains relevant as a prohibition: no mixed-content request, permissive CORS,
weakened Origin check, shared cookie, or service-worker proxy may bridge the hosted and legacy origins.

## Product constraints and blockers

| Item | Status | Required resolution |
|---|---|---|
| Free product; no payments | Completed | Stripe is excluded. No payment/subscription/paywall/trial/feature-gating implementation. |
| Cloud data is metadata only | Completed | Account/profile/settings/themes/templates/presentation definitions/pairing/audit logs only; no cloud media, media libraries, or media backups. |
| Existing local presentation remains offline | Completed | Must not depend on Vercel, Supabase, or internet for rendering, navigation, local media playback, virtual camera, Zoom, Teams, or OBS output. |
| HTTPS hosted PWA to local HTTP | Resolved by scope | Hosted companion is online-first and separate; it never calls the legacy server. Keep the existing LAN remote unchanged. Future secure local transport is optional research, not a prerequisite for hosted PWA implementation. |
| Vercel preview | Completed (production URL verified) | On 25 October 2026 `https://framedecks.vercel.app/` returned HTTP 200 from Vercel and served the current hosted page: dark navy/gold shell, transparent emblem (`/framedecks-emblem.webp`, 455,316 bytes, identical to the repository file), no horizontal overflow at 390px. `hosted/vercel.json` pins `framework: nextjs`. The older deployment-specific URL `framedecks-epvyztg97-mshobin.vercel.app` still returns 404 and is treated as a superseded deployment. Project settings (Root Directory `hosted`) were not inspected because that needs Vercel dashboard access; the working production deployment implies they are correct. |
| Legacy project assessment references | Partially Complete | The active root roadmap and README are aligned to the approved modernization direction; older project assessment documents still contain historical 6.6 references and should be refreshed when those audits are next revised. |
| Mac runtime parity | Blocked | Current camera/capture/native runtime is Windows-oriented. Scope and implement a Mac-native runtime before claiming feature parity. |
| Cloudflare edge | Blocked | No custom domain exists. Start with Vercel-provided URLs; do not make Cloudflare a deployment prerequisite. |

## Validation record

Historical commands below were run from the repository root on `modernization-v1`; later checks are dated inline:

- `node tests/run.js` — passed, 3 of 3 test files.
- `python -m unittest discover -s tests -p "test_*.py" -v` — passed, 24 tests ran, 1 skipped.
- `python packaging/check.py` — passed, version 6.9 self-check; OpenCV was not installed in the environment.
- `python tools/generate_brand_assets.py` — passed; generated icon, launcher, favicon, workbook, app emblem, and installer derivatives from the canonical source image.
- `python tools/make_readme_header.py --url http://127.0.0.1:8750/dashboard.html` — passed; captured the updated About page and wrote version marker `6.9`.
- `node tests/run.js` — passed, 3 of 3 test files after branding changes.
- `python -m unittest discover -s tests -p "test_*.py"` — passed, 24 tests ran, 1 skipped after branding changes.
- `python tools/make_release_notes.py --check` — passed, release notes 6.9 valid.
- `python tools/check_doc_links.py` — passed after branding documentation; 64 files, 0 problems.
- `git diff --check` — passed after branding changes.
- From `hosted/`, `npm run lint` — passed after the hosted shell was added.
- From `hosted/`, `npm run typecheck` — passed after the hosted shell was added.
- From `hosted/`, `npm test` — passed; 1 local-HTTP boundary test.
- From `hosted/`, `npm run build` — passed; static `/` and not-found routes generated.
- Production-build browser smoke check — passed on desktop and a 390px mobile viewport; the page rendered, disabled future navigation remained unavailable, the local-first notice stayed visible, and the document had no horizontal overflow.
- From `hosted/`, `npm audit --omit=dev` — passed; no runtime dependency vulnerabilities.
- 25 October 2026, after the transparent-emblem work: `node tests/run.js` (3/3), Python unittest (24 run, 1 skipped),
  `python packaging/check.py` (6.9), `python tools/check_doc_links.py` (70 files, 0 problems), `git diff --check`, and
  hosted `lint`, `typecheck`, `test`, `build` all passed. `python tools/make_transparent_emblem.py` reproduces the
  committed emblem pixel-for-pixel. Visual check on the dark theme against the running `server.py`: dashboard header,
  teleprompter header and the About page show the emblem embedded in the background; the light-theme header logo was
  low contrast and is now darkened. The tray icon and a real packaged Windows run were not checked.
- From `hosted/`, `npm audit` — reports 5 high-severity findings in the development-only Next.js ESLint dependency tree (`braces` through `fast-glob`/`micromatch`); the suggested automated fix downgrades `eslint-config-next` to 14.2.35, so it was not applied to the Next.js 16 app.
- 25 October 2026, local browser logo QA: the 1024px emblem loaded at 30px in the light desktop header, 34px in the light teleprompter/speaker window, and 26px in the dark remote. The CSS contrast filter applied in light mode; no desktop code or assets were changed. The 16px favicon remains visibly faint. The tray uses `app/icons/remote-192.png`, whose gold emblem asset is present, but there is no packaged executable in `dist/` and no packaged Windows run was possible: `python -m PyInstaller --version` failed because PyInstaller is absent; `python packaging/check.py` passed and noted that OpenCV is not installed.
- 25 October 2026, Phase 4 contract slice: `hosted/tests/sync-contract.test.mjs` exercises v1 serialization/parsing, opaque media references, rejection of path/raw-byte/unknown fields and data URLs, byte limits, stable operation-id semantics, and explicit revision conflicts. Hosted tests, lint, typecheck, build, documentation links, and diff whitespace checks are recorded for this change after they run. No cloud service or local desktop state is contacted or modified.

History (22 October 2026, now superseded): the original `https://framedecks.vercel.app/` URL
returned Vercel `404: NOT_FOUND` (request ID `bom1::wmnz7-1792679474767-cfc0b5588a8e`) because `hosted/` was not yet
on `main`. Deployment-specific URLs `framedecks-epvyztg97-mshobin.vercel.app` and
`framedecks-dkposl86b-mshobin.vercel.app` also returned `404: NOT_FOUND`. The app was later moved into `hosted/` on
`main` (commits `2fc6224`, `1b1c09e`), and on 25 October 2026 the production URL returned HTTP 200 and the hosted
page (request ID `bom1::prkd5-1792915095986-a8a0c059d2eb`). These checks do not
validate hosted authentication, RLS, OAuth, PWA installation, phone pairing, Mac support, or camera behavior on
real Zoom/Teams/OBS installations.
