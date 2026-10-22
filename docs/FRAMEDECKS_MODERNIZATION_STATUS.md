# FRAMEDECKS modernization status

**Last updated:** 22 October 2026  
**Working branch:** `modernization-v1`  
**Current milestone:** Hosted foundation validated locally; Vercel branch/root configuration needs correction

**Overall implementation state:** Repository assessment, branding, and architecture are documented. The HTTPS-to-local-HTTP path is rejected; the hosted PWA is a separate online-first companion. A responsive static Next.js shell, shadcn-style UI base, boundary test, and independent CI workflow now exist and pass local checks. Vercel deployment, authentication, tenant data, pairing, and PWA install/cache remain unimplemented.

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
| PWA readiness | Partially Complete | Existing LAN remote has manifest/icons only. Hosted app now has a static shell and independent checks; no auth, service worker, pairing, or deployment exists yet. |
| Offline capability assessment | Completed | Desktop workflows remain offline; hosted PWA is explicitly online-first and separate from the unchanged LAN remote. |
| Test baseline | Completed | Node tests: 3/3 files pass. Python tests: 24 run, 1 skipped, pass. Packaging self-check passes; OpenCV unavailable in this environment. |
| Audit and architecture documents | Completed | [Audit](FRAMEDECKS_AUDIT.md), [modernization architecture](FRAMEDECKS_MODERNIZATION.md), and [migration roadmap](project/saas-migration-roadmap.md) added/updated. |
| Product roadmap alignment | Completed | Root [ROADMAP.md](../ROADMAP.md) now describes free, metadata-only cloud modernization while preserving local presenting. |

## Modernization work

| Milestone | Status | Next action / acceptance gate |
|---|---|---|
| Phase 1 — Repository audit and architecture | Completed | Baseline checks pass; constraints, target design, risks, rollback, and preservation matrix documented. |
| Phase 2 — Next.js / TypeScript / Tailwind / shadcn foundation | Partially Complete | Separate responsive app shell and CI pass locally without changing the desktop UI. Vercel's default branch is `main`, which does not contain `hosted/`; the app exists on `modernization-v1`. Set the Vercel production branch to `modernization-v1` before setting Root Directory to `hosted`, or merge the app into the intended production branch. |
| Phase 3 — Supabase Auth and tenant foundation | Not Started | Email, Google, Microsoft providers; define organization roles; add migrations and deny-by-default RLS tests before real data. |
| Phase 4 — Metadata-only synchronization | Not Started | Define versioned contracts, local outbox, idempotency, conflict handling, and 6.9 import/export; prove no media bytes sync. |
| Phase 5 — Hosted PWA and secure device pairing | Not Started | Online-first hosted companion; implement five-minute QR/6-digit challenge, authenticated user, runtime approval, trusted devices, roles, replay protection, revocation. No connection to the LAN HTTP server. |
| Phase 6 — Vercel operations / future Cloudflare edge | Not Started | Vercel-provided URL first; Cloudflare integration waits for custom domain. Add backup/restore, monitoring, and incident procedures. |
| Phase 7 — User-facing branding/terminology | Partially Complete | Existing desktop, workbook, remote/PWA, favicon, installer, and marketing-header surfaces use the supplied logo. The phone remote PIN screen is covered; no splash screen or hosted account-login page exists yet. See [branding asset inventory](FRAMEDECKS_BRANDING_ASSETS.md). |
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
| Phase 5 — Next.js hosted foundation | Partially Complete | Static responsive shell, shadcn-style base, no-local-HTTP test, and independent lint/typecheck/test/build workflow are implemented. Local checks pass. Vercel root selection fails because the default `main` branch lacks `hosted/`; the app is on `modernization-v1`. Correct the branch/root configuration and provide a Ready URL to validate deployment. |
| Phase 6 — Supabase authentication and tenancy | Not Started | Requires implementation and project/provider credentials before OAuth or hosted auth can be end-to-end validated. |
| Phase 7 — Metadata sync, hosted control, and pairing | Not Started | Requires versioned contracts, tenant RLS, runtime adapter, pairing, and authorization tests. |
| Phase 8 — PWA install/cache and operations | Not Started | Safe app-shell cache only, real-device acceptance, and Vercel deployment/operations. |

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
| Vercel preview | Blocked | The repository default branch is `main`, where `hosted/` is absent; `hosted/` exists on `modernization-v1`. This explains Vercel's “specified Root Directory does not exist” message. Set the project's production branch to `modernization-v1` before selecting Root Directory `hosted`, or merge the app to the intended production branch. A successful Ready deployment is still required before continuing. |
| Legacy project assessment references | Partially Complete | The active root roadmap and README are aligned to the approved modernization direction; older project assessment documents still contain historical 6.6 references and should be refreshed when those audits are next revised. |
| Mac runtime parity | Blocked | Current camera/capture/native runtime is Windows-oriented. Scope and implement a Mac-native runtime before claiming feature parity. |
| Cloudflare edge | Blocked | No custom domain exists. Start with Vercel-provided URLs; do not make Cloudflare a deployment prerequisite. |

## Validation record

Commands run from the repository root on `modernization-v1`:

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
- From `hosted/`, `npm audit` — reports 5 high-severity findings in the development-only Next.js ESLint dependency tree (`braces` through `fast-glob`/`micromatch`); the suggested automated fix downgrades `eslint-config-next` to 14.2.35, so it was not applied to the Next.js 16 app.

The original `https://framedecks.vercel.app/` URL was opened on 22 October 2026 and returned Vercel
`404: NOT_FOUND` (request ID `bom1::wmnz7-1792679474767-cfc0b5588a8e`). The deployment-specific URL
`https://framedecks-epvyztg97-mshobin.vercel.app/` first redirected to `vercel.com/login` with an SSO return URL.
After the user indicated access should be available, both URLs were reopened on 22 October 2026 and returned
Vercel `404: NOT_FOUND` (request IDs `bom1::sxxx2-1792680248887-6e8c376ff6d0` and
`bom1::jjlcz-1792680253940-929a7167cae3`, respectively). The hosted page remains unavailable for validation.
The additional deployment URL `https://framedecks-dkposl86b-mshobin.vercel.app/` was opened on 22 October 2026
and also returned `404: NOT_FOUND` (request ID `bom1:bom1::bcmzn-1792680485748-dd0042d4bd7a`). These checks do not
validate hosted authentication, RLS, OAuth, PWA installation, phone pairing, Mac support, or camera behavior on
real Zoom/Teams/OBS installations.
