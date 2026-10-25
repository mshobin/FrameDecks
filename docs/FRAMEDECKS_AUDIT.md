# FRAMEDECKS repository audit

**Assessment date:** 22 October 2026  
**Repository baseline:** FRAMEDECKS 6.9 on branch `modernization-v1`  
**Scope:** Repository architecture, dependencies, security, performance, technical debt, SaaS/PWA readiness, offline capability, and migration risks.

## Executive assessment

FRAMEDECKS is a mature local-first Windows presentation application, not a partially built SaaS product. A Python
process serves its HTML/CSS/vanilla-JavaScript interface, persists application state to local JSON, and coordinates
presentation, remote-control, overlay, and camera paths. A native desktop shell and the `vcam` package provide
Windows integration, capture, media composition, and virtual-camera output.

This architecture supports the existing offline service-day workflow. The hosted target must therefore be additive:
a metadata-only cloud control plane and browser PWA paired with local runtime software. The local runtime remains
responsible for media files, presentation playback, capture, and output devices. Replacing the application wholesale
with a Vercel-hosted browser app would not preserve those responsibilities.

The highest-risk work is not choosing a frontend framework. It is proving tenant isolation, secure account/device
pairing, metadata compatibility, offline recovery, and preservation of live-control behavior. The prior product
roadmap conflicted with the modernization direction; the root roadmap has now been updated to record this change.
FRAMEDECKS is to remain free: no Stripe, subscriptions, payments, trials, paywalls, feature gating, or licensing
restrictions.

## 1. Current architecture

| Boundary | Current implementation |
|---|---|
| Desktop shell | Python desktop application using pywebview/WebView2 and pystray. Windows-specific window, shortcut, capture, and camera behavior is integrated through native APIs. |
| Local HTTP server | `server.py` uses Python's standard-library threaded HTTP server. It serves the application and APIs on loopback; optional phone-remote mode opens LAN listeners and applies a route allow-list. |
| UI | Static HTML, CSS, and vanilla JavaScript under [app/](../app/). There is no React, Next.js, TypeScript, npm package manifest, or frontend build pipeline. |
| State | The server keeps shared state in memory and persists it to JSON with a revision counter and atomic replacement. Browser/file mode uses `localStorage`, `BroadcastChannel`, and a periodic check. |
| Media and output | [vcam/](../vcam) captures and composes camera, media, cards, overlays, and effects. The final frame can feed a virtual camera, presentation output, and previews. |
| Local storage | Meeting state, private members/settings, local media, backups, and configuration live on the computer. There is no database, cloud sync, identity, or tenant model. |
| Delivery | PyInstaller/Inno Setup Windows installer built with GitHub Actions. CI runs JS/Python tests, packaging checks, release-note checks, and documentation-link checks. |

The control server currently combines routing, state/persistence, access controls, remote sessions, uploads, scripture
integration, settings, and device orchestration. The existing engineering assessment describes `server.py` as
approximately 2,100 lines and identifies `store.js`, `workspace.js`, and `members.js` as other large, coupled modules.
These are refactoring risks, not a reason to replace tested behavior in a single rewrite.

## 2. Technology and dependency inventory

| Concern | Current implementation |
|---|---|
| Languages | Python 3.12 and vanilla JavaScript; HTML and CSS |
| Desktop | pywebview/WebView2, pystray, Win32 integration via `ctypes` |
| HTTP | Python `http.server` / `ThreadingHTTPServer`, with custom routing and authorization |
| Persistence | JSON files, local filesystem, browser `localStorage`; no database |
| Camera/media | OpenCV, NumPy, MediaPipe model, Windows capture APIs, `pypdfium2`, `comtypes`, bundled softcam-derived DirectShow camera |
| Workbook | Vendored SheetJS and Python workbook import/export code |
| Packaging | PyInstaller, Inno Setup |
| CI | GitHub Actions Windows workflow; release dependencies are pinned in `packaging/constraints.txt` |
| Tests | Node test runner with no frontend package installation; Python `unittest`; packaging self-check |

Build dependencies are declared in [requirements-desktop.txt](../packaging/requirements-desktop.txt) with tested
versions recorded in [constraints.txt](../packaging/constraints.txt). The pinned build also lists both
`opencv-python` and `opencv-python-headless`, which share the `cv2` module; the repository marks this as a tested
pair and a future maintenance risk. The desktop application remains separate from the Next.js/TypeScript hosted
foundation in [hosted/](../hosted/). That foundation currently has no Supabase, authentication, tenant data,
service-worker, pairing, deployment, Flutter, Stripe, or Cloudflare integration. The presence of
`app/remote-manifest.json` is manifest metadata only, not a complete PWA implementation.

### Phase 1 baseline checks

| Command | Result |
|---|---|
| `node tests/run.js` | Passed — 3 of 3 test files |
| `python -m unittest discover -s tests -p "test_*.py" -v` | Passed — 24 tests; 1 skipped |
| `python packaging/check.py` | Passed — FRAMEDECKS 6.9 self-check; OpenCV absent in this environment and reported as needed only to build the app |

These checks establish a repository baseline. They do not constitute browser end-to-end, security, camera hardware,
Zoom/Teams, Mac, or production-cloud validation.

## 3. Security assessment

### Existing controls

- Loopback-only service by default; remote access is opt-in.
- Host checks intended to resist DNS-rebinding requests and Origin checks for POST.
- Non-local request allow-list separates remote pages/routes from local-only member, settings, and camera APIs.
- Six-digit remote PIN, per-IP failed-login throttling, cryptographically random session tokens, constant-time PIN
  comparison, and `HttpOnly`/`SameSite=Strict` session cookie.
- Request-body cap, path containment for static assets, `X-Content-Type-Options: nosniff`, and atomic state writes.
- Member records are separated from ordinary remote state; no telemetry is part of the current product.

### Security gaps and SaaS requirements

1. **LAN remote is plaintext HTTP.** PIN and session cookie are not protected by TLS on the local network. Current
   security documentation warns users to use a trusted Wi-Fi network. Public hosting requires HTTPS everywhere.
2. **Shared PIN is not user authentication.** It has no user attribution or fine-grained access roles; session validity
   can be long-lived. Hosted identity must not reuse the PIN as an account credential.
3. **No tenant boundary exists.** Organization membership, role checks, tenant-owned database records, and
   isolation tests are absent. Tenant isolation must be enforced in PostgreSQL RLS and server-side
   authorization, not by hiding data in the client.
4. **Local data relies on OS protection.** Member details and meeting data are not application-encrypted at rest.
   Define whether any private/member data is permitted to enter cloud storage; default to exclusion and minimize
   fields.
5. **Custom server and limited auditing.** Request handling and authorization are app-maintained; request logging
   is suppressed. Add privacy-conscious security/audit events, rate limits, monitoring, and incident handling to the
   hosted service.
6. **Hosted PWA/browser security boundaries are not implemented.** The existing LAN remote is HTTP. The approved
   hosted PWA is a separate online-first HTTPS client; direct calls from it to local HTTP are prohibited.
7. **Pairing and account recovery are new trust boundaries.** Short-lived one-time codes, runtime approval, device
   revocation, scoped roles, replay prevention, and auditable pairing events need a threat model and tests.
8. **Secret management is new.** Supabase elevated keys and OAuth provider secrets must remain server-side; validate
   environment separation and deployment secrets before public launch.

This is a repository architecture assessment, not a penetration test or security certification.

## 4. Performance assessment

### Existing workload

- Camera capture, blur, composition, media decoding, and virtual-camera output are the likely dominant CPU/GPU
  workloads, not local HTTP routing.
- State changes serialize and replace the JSON state document; cost and lock duration can grow with state size and
  mutation frequency.
- Preview JPEG generation, video/PDF/image handling, and multiple clients can add CPU, memory, and I/O pressure.
- Large JavaScript modules raise parse, startup, change-isolation, and regression costs.
- Existing preview-on-demand and phone long-poll behavior are deliberate optimizations.

The published [performance note](project/performance.md) reports measurements for 6.6/6.7, not a complete 6.9
baseline. Refresh measurements before selecting performance targets.

### Hosted-target risks

- Do not send video frames, audio, media bytes, or high-frequency UI events through PostgreSQL or database Realtime.
- Use Realtime for presence and small control notifications; persist versioned metadata and recover by fetching the
  authoritative state after reconnection.
- Do not run persistent camera loops or unbounded media conversion in Vercel request functions.
- Set limits for metadata payload size, per-organization change volume, concurrency, live-control latency, reconnect
  time, database usage, and service cost. Keep media bytes local.

## 5. Technical debt

- Large modules concentrate server and UI responsibilities, coupling features and increasing review/merge risk.
- State shape and compatibility logic are spread across Python, browser JavaScript, and legacy migration code.
- There is no central schema registry or database migration history for evolving meeting definitions.
- Custom HTTP behavior requires application-owned request parsing, access control, validation, and error handling.
- Automated tests do not fully cover server authorization, remote login/session lifecycle, browser workflows, media
  engine, or camera hardware integration.
- Performance measurements are historical; UI automation, engine test coverage, and current release budgets are
  incomplete.
- The current application is Windows-first; Mac camera, capture, native presentation, and PowerPoint behavior are
  not implemented as equivalent runtime capabilities.
- Older documents that mention version 6.6 do so as history (measurements taken on 6.6, former names of features);
  the 6.6 repository audit is marked as a snapshot. The current version is 6.10.

## 6. SaaS readiness

**Readiness: low by design.** The current app is a single-computer product, not a horizontally scalable service.
Absent SaaS foundations include identity, organization/member roles, tenant-aware persistence, schema migrations,
cloud audit operations, deployment environments, disaster recovery, account support/recovery, and incident response.
The modernization must create those foundations before porting workflows. Supabase does not provide tenant
isolation automatically; RLS policies and tests are application responsibilities.

The requested target is a **free service**. Do not add Stripe, billing, payments, subscription tiers, entitlement
gates, trials, or licensing restrictions. Keep media files local; sync only accounts, profiles, settings, themes,
templates, presentation definitions/metadata, pairing records, and audit logs.

## 7. PWA readiness

**Existing LAN remote: partial metadata only. Hosted companion: unconnected foundation implemented.** The existing
remote has a manifest and icons, but no service worker, cache strategy, offline shell, install/update lifecycle, or
HTTPS deployment; it remains tied to the local host and its network. The separate hosted Next.js/TypeScript app has
a responsive static shell, shared UI foundation, boundary test, and independent CI workflow. It has no
authentication, tenant data, service worker, pairing, or deployment yet and does not access or proxy the local HTTP
listener. Cache only safe app-shell assets; do not cache private APIs, pairing challenges, or credentials. Validate
installation, storage/lifecycle behavior, and recovery on current iOS Safari and Android Chrome before claiming
support.

## 8. Offline capability

**Current product: strong local operation.** Meetings, local media, camera composition, and presentation output are
designed around the local computer and do not require cloud services. The optional ESV lookup is the documented
online exception.

**Target invariant:** internet loss must not interrupt presentation rendering, slide navigation, video/audio
playback, virtual-camera output, or the local Zoom/Teams/OBS output paths. Queue metadata mutations locally and
resume synchronization automatically when connectivity returns, using idempotent operations and explicit version
conflict handling.

The hosted PWA may be unavailable offline; the existing LAN remote remains the separate local option. The
HTTPS-to-local-HTTP conflict is resolved by keeping those origins and transports separate, not by relaxing browser
security. Do not remove or silently weaken the current remote.

## 9. Scalability and platform risks

- Single-process JSON persistence and one local runtime do not provide multi-organization coordination or horizontal
  scaling.
- Hosted concurrency introduces multi-user edits, ordering, conflict resolution, presence fan-out, account lifecycle,
  and tenant-aware audit records.
- Cloud sync of metadata must have version limits and a tested recovery model; local media means no cloud media
  bandwidth, but each runtime still needs local media resolution.
- Windows camera/PowerPoint integrations are native and hardware-bound. Vercel is not their execution environment.
- The attachment requests Mac runtime parity, but the current repository does not provide that parity. Treat the Mac
  port as a separate platform engineering stream and a release blocker for any claim of equivalent support.
- Mobile remains a remote-control client only. Next.js PWA fits this boundary; Flutter is not required unless
  product requirements later demand native mobile features that the PWA cannot provide.

## 10. Recommended migration sequence

1. **Phase 1 — Audit and architecture:** document current state, constraints, tests, risks, and non-negotiable
   behavior; establish the `modernization-v1` branch and resumable status.
2. **Phase 2 — Frontend foundation:** add isolated Next.js/TypeScript/Tailwind/shadcn scaffolding without replacing
   the desktop UI or altering existing workflows.
3. **Phase 3 — Auth and tenant data:** Supabase Auth (email, Google, Microsoft), membership and role model,
   Postgres migrations, deny-by-default RLS, and cross-tenant tests.
4. **Phase 4 — Metadata sync:** typed/versioned metadata contracts, local outbox, idempotent sync, conflict
   resolution, and representative 6.9 import/export. No media upload.
5. **Phase 5 — PWA and secure pairing:** HTTPS PWA, one-time QR/6-digit pairing, runtime approval, device trust and
   revocation, role enforcement, replay protection, and tested reconnect/offline behavior.
6. **Phase 6 — Vercel/edge deployment:** start with Vercel-provided URLs. Integrate Cloudflare only when a custom
   domain exists and is configured; keep the domain dependency explicit.
7. **Phase 7 — Branding/terminology:** update user-facing brand and specified labels only; keep API/model/table/env
   names stable and preserve layouts/navigation.
8. **Phase 8 — Compatibility validation:** compare all critical workflows on existing Windows runtime, supported
   phones, and Mac only after a native implementation exists. Keep rollback and previous stable release available.

See [FRAMEDECKS_MODERNIZATION.md](FRAMEDECKS_MODERNIZATION.md) for target architecture, pairing/sync designs,
deployment, rollback, and phase gates. Progress is recorded in
[FRAMEDECKS_MODERNIZATION_STATUS.md](FRAMEDECKS_MODERNIZATION_STATUS.md).
