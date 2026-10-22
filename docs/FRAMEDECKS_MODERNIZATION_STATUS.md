# FRAMEDECKS modernization status

**Last updated:** 22 October 2026  
**Working branch:** `modernization-v1`  
**Current milestone:** Phase 4 — PWA enablement (blocked on secure local transport validation)

**Overall implementation state:** Repository assessment, asset migration, and current-reference cleanup are complete. PWA/cloud implementation has not started; safe phone-remote parity is blocked on a validated HTTPS local transport.

## Status definitions

- **Completed:** inspected or implemented and validated against its stated acceptance criteria.
- **Partially Complete:** some supporting implementation exists, but required behavior or validation is missing.
- **Not Started:** no implementation work has begun.
- **Blocked:** cannot proceed safely until a named decision, dependency, or validation is resolved.

## Repository baseline

| Area | Status | Evidence / remaining work |
|---|---|---|
| Current architecture and stack inventory | Completed | Documented in [FRAMEDECKS_AUDIT.md](FRAMEDECKS_AUDIT.md); existing application remains Python/HTML/CSS/vanilla JS. |
| Dependency and build assessment | Completed | Python build requirements and pinned constraints reviewed; no Next.js/npm/Supabase/Flutter/Stripe stack exists. |
| Security assessment | Completed | Existing loopback/LAN remote controls and SaaS security gaps documented; no penetration test claimed. |
| Performance assessment | Completed | Current workload and historical 6.6/6.7 metrics documented; current 6.9 hosted performance baseline remains future work. |
| Technical debt assessment | Completed | Large modules, custom server, cross-language state compatibility, and test gaps recorded. |
| SaaS readiness | Completed | Low by design; no accounts, tenants, cloud database, or hosted operations model. |
| PWA readiness | Partially Complete | Remote manifest and icons exist; HTTPS deployment, service worker, cache strategy, and offline shell do not. |
| Offline capability assessment | Completed | Local presentation/output works by design; secure offline phone-remote transport is unresolved for the target PWA. |
| Test baseline | Completed | Node tests: 3/3 files pass. Python tests: 24 run, 1 skipped, pass. Packaging self-check passes; OpenCV unavailable in this environment. |
| Audit and architecture documents | Completed | [Audit](FRAMEDECKS_AUDIT.md), [modernization architecture](FRAMEDECKS_MODERNIZATION.md), and [migration roadmap](project/saas-migration-roadmap.md) added/updated. |
| Product roadmap alignment | Completed | Root [ROADMAP.md](../ROADMAP.md) now describes free, metadata-only cloud modernization while preserving local presenting. |

## Modernization work

| Milestone | Status | Next action / acceptance gate |
|---|---|---|
| Phase 1 — Repository audit and architecture | Completed | Baseline checks pass; constraints, target design, risks, rollback, and preservation matrix documented. |
| Phase 2 — Next.js / TypeScript / Tailwind / shadcn foundation | Not Started | Build a separate app shell and CI without altering the existing desktop UI; confirm Vercel preview on its generated URL. |
| Phase 3 — Supabase Auth and tenant foundation | Not Started | Email, Google, Microsoft providers; define organization roles; add migrations and deny-by-default RLS tests before real data. |
| Phase 4 — Metadata-only synchronization | Not Started | Define versioned contracts, local outbox, idempotency, conflict handling, and 6.9 import/export; prove no media bytes sync. |
| Phase 5 — PWA and secure device pairing | Not Started | Implement five-minute QR/6-digit challenge, authenticated user, runtime approval, trusted devices, roles, replay protection, revocation. |
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
| Phase 3 — Remaining branding references | Completed | Current stale repository links and contributor setup instructions were updated; remaining historical/internal matches are classified in [branding audit](FRAMEDECKS_BRANDING_AUDIT.md). Commit `0c7556534190f6a2721fb9fa1afcfdca14a153e9` is pushed to `modernization-v1`. |
| Phase 4 — PWA enablement | Blocked | The existing remote is tied to the local PC origin and HTTP session. Do not register an offline service worker or claim HTTPS/offline phone-control parity until the transport gate below is met. |

### Phase 4 blocker and acceptance gate

The browser remote in `app/remote.html` and `app/js/remote.js` uses relative HTTP requests to the PC, a PIN login,
and an HttpOnly `SameSite=Strict` session cookie. `server.py` checks an exact `http://<Host>` origin for state
changes and does not implement CORS. A hosted HTTPS page cannot direct those relative requests to the PC, and
repointing them to its HTTP LAN address would introduce cross-origin, mixed-content, private-network, and cookie
restrictions. A service worker is origin-scoped and cannot bypass those browser controls.

Do not add a service worker to the current LAN remote as a stand-in for a hosted PWA: LAN IP HTTP is not a secure
context on supported phones, and an offline cached control screen could falsely suggest that the disconnected PC
is controllable. PWA implementation may resume when either:

1. a secure local transport and onboarding design has been selected and passes the existing remote's required
   flows on current iOS Safari and Android Chrome, including reconnect, session isolation, and revocation; or
2. the product explicitly scopes the first hosted PWA to online-only hosted control and postpones local/offline
   control, with its API, authentication, and user experience defined independently of the current LAN server.

Until then, preserve the existing HTTP LAN remote unchanged. The existing desktop presentation and output must
remain usable without internet.

## Product constraints and blockers

| Item | Status | Required resolution |
|---|---|---|
| Free product; no payments | Completed | Stripe is excluded. No payment/subscription/paywall/trial/feature-gating implementation. |
| Cloud data is metadata only | Completed | Account/profile/settings/themes/templates/presentation definitions/pairing/audit logs only; no cloud media, media libraries, or media backups. |
| Existing local presentation remains offline | Completed | Must not depend on Vercel, Supabase, or internet for rendering, navigation, local media playback, virtual camera, Zoom, Teams, or OBS output. |
| Secure offline phone remote over HTTPS | Blocked | Existing LAN remote uses HTTP. Validate a secure local transport and certificate/onboarding model on iOS and Android before replacing or claiming parity. |
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

These checks do not validate hosted application behavior, RLS, OAuth, PWA installation, phone pairing, Mac support,
or camera behavior on real Zoom/Teams/OBS installations.
