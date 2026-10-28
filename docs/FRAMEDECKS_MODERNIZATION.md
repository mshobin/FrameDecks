# FrameDecks modernization architecture and migration plan

**Status:** Hosted PWA architecture accepted; implementation is staged and gated
**Branch:** `modernization-v1`  
**Product constraint:** FrameDecks remains free; no payments, subscriptions, paywalls, trials, feature gates, or licensing restrictions.

## 1. Modernization principles

- Modernize the product incrementally; do not redesign or replace working user flows in a big-bang rewrite.
- Preserve the existing desktop application, presentation engine, local media, and current LAN remote unchanged.
  The new hosted PWA is a separate, authenticated companion; it does not replace the LAN remote.
- Keep media bytes local. Cloud synchronization is limited to account/profile data, settings, themes, templates,
  presentation definitions and metadata, pairing records, and audit logs.
- A network outage must not interrupt local presentation rendering, navigation, local video/audio playback, the
  virtual camera, or the existing local Zoom/Teams/OBS output workflows.
- Use the hosted browser/PWA for secure cloud administration, notes, monitoring, session management, and paired
  remote commands. Do not run the presentation engine or media playback on mobile.
- The hosted PWA may initially require an internet connection. The existing LAN remote remains the local/offline
  option; do not proxy an HTTPS page to the local HTTP server.
- Treat compatibility tests, security controls, data export, and rollback as release features.

## 2. Current-to-target architecture

### Current runtime

```mermaid
flowchart LR
  subgraph Local["Windows service PC"]
    UI["HTML/CSS/vanilla JS"]
    Server["Python ThreadingHTTPServer"]
    JSON[("Local JSON state<br/>and backups")]
    Engine["Python/OpenCV<br/>presentation compositor"]
    Media["Local media files"]
    Camera["DirectShow virtual camera"]
    Projector["Presentation window"]
  end
  Phone["Phone remote<br/>LAN HTTP"]
  Meeting["Zoom / Teams / OBS"]
  UI <--> Server
  Server <--> JSON
  Server --> Engine
  Media --> Engine
  Engine --> Camera --> Meeting
  Engine --> Projector
  Phone <--> Server
```

### Updated target architecture

```mermaid
flowchart LR
  subgraph Web["Hosted control plane"]
    PWA["Hosted companion PWA<br/>Next.js · TypeScript"]
    App["Next.js server boundary<br/>validation · authorization"]
    Auth["Supabase Auth<br/>authenticated sessions"]
    DB[("Supabase Postgres<br/>metadata · RLS · migrations")]
    RT["Supabase Realtime<br/>presence · small control events"]
    Vercel["Vercel HTTPS deployment<br/>online-first"]
    CF["Cloudflare edge<br/>future custom-domain path"]
    PWA --> Vercel --> App
    App --> Auth
    App --> DB
    PWA <--> RT
    Vercel -. "only after a custom domain is configured" .-> CF
  end
  subgraph Runtime["Local presentation runtime"]
    Agent["Paired FrameDecks desktop runtime"]
    LocalState[("Local state and<br/>sync outbox")]
    LocalMedia["Local-only media"]
    Engine["Existing presentation<br/>and camera engine"]
    Outputs["Virtual camera · projector<br/>Zoom · Teams · OBS"]
    Agent <--> LocalState
    LocalMedia --> Engine --> Outputs
    Agent --> Engine
  end
  Phone["iOS / Android / tablet<br/>hosted companion"]
  LanPhone["Existing phone remote<br/>LAN HTTP; unchanged"]
  Desktop["Desktop operator UI"]
  Phone --> PWA
  Desktop --> Engine
  LanPhone <--> Server
  Agent <-->|Outbound HTTPS/WSS<br/>metadata + scoped commands| App
```

The local runtime is not a Vercel function. The Python/Windows runtime remains responsible for local asset lookup,
presentation timing, capture, composition, native output, and offline operation. The hosted system coordinates
identity, organization metadata, settings, templates, notes, monitoring, pairing, session management, and audit
records. The existing LAN remote remains a separate same-origin HTTP client and is not modified or routed through
the hosted application.

### Target stack responsibilities

| Technology | Responsibility |
|---|---|
| Next.js + TypeScript | Hosted control plane and browser client; strict types and validated API contracts |
| Tailwind CSS + shadcn/ui | Styling system and accessible primitives introduced without changing the established UI layout |
| Supabase Auth | Email, Google, and Microsoft sign-in; user session lifecycle |
| Supabase Postgres | Organization-scoped metadata, migrations, audit records, RLS |
| Supabase Realtime | Presence and low-volume control notifications; not durable state or media streaming |
| Vercel | Hosted Next.js deployment and preview environments; start with Vercel-provided URLs |
| Cloudflare | Future edge routing/protection after a custom domain is available; not a prerequisite to the initial Vercel deployment |
| GitHub Actions | Keep the existing Windows build/tests and add hosted-app checks independently |
| Flutter | Not in the target implementation: iOS/Android are browser/PWA remote-control clients. Reassess only if a specific native-only requirement emerges. |

Stripe is excluded because the product must remain free and must not add payments, subscriptions, paywalls, trials,
feature gating, or licensing restrictions.

## 3. Cloud data and local media contract

### Permitted cloud data

- User accounts and profiles.
- Organization/membership identity and role assignment.
- User and organization settings, themes, templates.
- Versioned presentation definitions and metadata.
- Pairing records, trusted device metadata, revocation state.
- Security and administrative audit logs with defined retention.

### Prohibited cloud data

- Images, video, audio, motion backgrounds, countdown videos, slide decks, or any other presentation media bytes.
- Media libraries or media backups.
- Local absolute paths, device credentials, access tokens, PINs, or private keys embedded in presentation definitions.

Presentation definitions may refer to an opaque logical local-asset identifier and expected media type. A local
runtime maintains the mapping from that identifier to a local file. The mapping must not leak local absolute paths
to the cloud. Missing local assets must be reported visibly and must not block unrelated presentation content.

### Versioning and compatibility

- Version cloud and local presentation-definition schemas explicitly.
- Validate, bound, and normalize every imported/synced definition before it reaches the renderer.
- Keep API routes and internal field/table/service names stable unless a separately reviewed compatibility change
  is approved. User-facing terminology does not rename persisted schema.
- Add forward/backward compatibility tests using representative data from FrameDecks 6.9 and older supported
  formats.

## 4. Authentication, authorization, and pairing

### Account authentication

- Supabase Auth provides email login plus Google and Microsoft OAuth providers.
- Use Supabase's supported JWT/session lifecycle; do not invent a token format or place a service-role key in a
  browser bundle.
- Prefer server-managed secure cookies for the Next.js session boundary. Use `Secure`, `HttpOnly`, and an
  appropriate `SameSite` policy; add CSRF defenses to cookie-authenticated state-changing routes.
- Keep access checks on trusted server code and in database RLS. Client role checks are UX only.
- Revoke sessions/devices on account removal, organization membership removal, explicit revocation, or security
  response.

### Roles

| Role | Proposed capability |
|---|---|
| Viewer | Read permitted meeting metadata, notes, timer, confidence monitor, and queue |
| Operator | Standard remote controls and navigation within granted meetings |
| Presenter | Operator capabilities plus presenter-specific notes/control functions |
| Administrator | Organization membership, pairing approvals, role assignment, device revocation, and settings |

Exact permission mapping must be validated against current remote controls before implementation. The design must
not silently remove existing remote actions; users without a required role receive a clear authorization result.

### Pairing architecture

1. An authenticated administrator selects a runtime and requests pairing.
2. The server creates a cryptographically random, one-time pairing challenge bound to that organization/runtime,
   with a five-minute expiry and server-side rate limits.
3. The app displays a QR code and a six-digit code that resolve to the same challenge. The code is not an
   authentication credential and cannot grant access without the authenticated account and runtime approval.
4. The mobile PWA authenticates, scans/enters the code, and requests pairing. The runtime displays the device/user
   identity and requested role for explicit approval.
5. Approval atomically consumes the challenge, creates a trusted-device record, and issues a scoped, revocable
   session. Reuse, expiry, denial, or revocation invalidates the challenge/device.
6. Pairing, approval, role changes, and revocation create audit events without logging secrets or pairing codes.

```mermaid
sequenceDiagram
  participant Admin as Authenticated admin
  participant Cloud as Next.js + Supabase
  participant Runtime as Local FrameDecks runtime
  participant Phone as Remote PWA
  Admin->>Cloud: Request pairing (runtime, role scope)
  Cloud-->>Admin: QR + six-digit, one-time code (5 min)
  Phone->>Cloud: Sign in; submit QR/code challenge
  Cloud->>Runtime: Pending device approval
  Runtime-->>Admin: Show identity/device and requested scope
  Admin->>Runtime: Approve or deny
  Runtime->>Cloud: Approve challenge
  Cloud->>Cloud: Atomically consume challenge; record trusted device
  Cloud-->>Phone: Scoped revocable authenticated session
```

### Rejected transport: hosted HTTPS to local HTTP

**Decision (22 October 2026): do not connect the hosted HTTPS PWA directly to the existing local HTTP server.**
This is not solved by adding CORS headers, relaxing Origin checks, switching cookies, or using a service worker.
Those workarounds would weaken browser/server boundaries and still would not make the local server a secure,
authenticated cloud transport.

Verified current behavior: `app/remote.html` and `app/js/remote.js` use same-origin relative HTTP requests.
`src/server.py` binds the optional LAN remote over HTTP, checks `http://<Host>` for state-changing requests, does not
provide CORS, and issues an HttpOnly `SameSite=Strict` cookie. A hosted HTTPS origin cannot reuse that flow by
changing a base URL: the page would make cross-origin requests to a private HTTP address, where mixed-content,
private-network access, Origin, and cookie policies apply. A service worker is scoped to its own origin and cannot
bypass these policies.

Browser constraints vary by browser/version and must be confirmed on supported devices. In general, iOS Safari
requires a secure context for service workers and installable web-app capabilities; Home Screen installation and
notification behavior differ from desktop browser behavior and depend on supported iOS versions and user actions.
Android Chrome also requires a secure context for service workers/installability and enforces mixed-content,
cross-origin, cookie, and private-network protections. Browser permissions do not turn arbitrary LAN HTTP endpoints
into trusted HTTPS endpoints. No platform-specific browser exception is assumed by this design.

### Accepted transport architecture

The hosted PWA is an **online-first, HTTPS-only companion**. It talks only to the hosted Next.js application and
Supabase through same-origin HTTPS/API and approved authenticated channels. It does not issue requests to private
LAN addresses and does not access or proxy the legacy LAN HTTP server. Internet loss makes hosted management and
cloud remote features unavailable with a clear offline state; it does not affect local presenting. The existing
phone remote remains the separate local/offline option, unchanged.

```mermaid
flowchart LR
  subgraph Internet["Hosted HTTPS trust boundary"]
    Browser["Installed or browser PWA"]
    Next["Next.js API / server actions"]
    Auth["Supabase Auth"]
    DB[("Supabase Postgres + RLS")]
    Relay["Authenticated command channel"]
    Browser <-->|HTTPS same-origin| Next
    Browser <-->|Supabase session| Auth
    Next --> DB
    Browser <-->|WSS / HTTPS| Relay
  end
  subgraph Local["Desktop trust boundary"]
    Runtime["FrameDecks desktop runtime"]
    LocalData[("Local state + media")]
    Engine["Presentation / media / camera"]
    Outputs["Projector · virtual camera<br/>Zoom · Teams · OBS"]
    Runtime --> LocalData
    LocalData --> Engine --> Outputs
    Runtime <-->|Outbound TLS only<br/>paired identity| Relay
  end
  LanPhone["Existing LAN phone remote"]
  LanPhone <-->|Existing same-origin HTTP<br/>LAN only; unchanged| Runtime
  Internet -. "No HTTPS-to-local-HTTP traffic" .-> Runtime
```

Future ways to revisit local phone control without weakening transport security include:

1. A separately researched local HTTPS endpoint with a trusted-certificate provisioning and renewal story on both
   mobile platforms. Do not ship until first-use trust, revocation, and recovery are usable for volunteers.
2. A native companion app with an explicitly authenticated secure local channel, only if the PWA cannot meet a
   validated user requirement.
3. A desktop-initiated outbound secure tunnel/relay, with explicit consent and a reviewed threat model; this
   requires internet and is not an offline substitute.
4. Keep the legacy LAN remote as-is for offline operation until an option passes the device validation matrix.

Never tunnel browser traffic from hosted HTTPS to the legacy HTTP listener, expose that listener publicly, or imply
the hosted PWA works offline when its cloud service or paired runtime is unreachable.

### Hosted cloud remote architecture

```mermaid
sequenceDiagram
  participant User as Signed-in operator
  participant PWA as Hosted PWA (HTTPS)
  participant API as Next.js authorization boundary
  participant DB as Supabase (RLS)
  participant RT as Authenticated relay / Realtime
  participant PC as Paired desktop runtime
  User->>PWA: Request notes, status, or session action
  PWA->>API: HTTPS request with Supabase session
  API->>API: Validate input, org membership, role, CSRF
  API->>DB: Authorized metadata read/write
  DB-->>API: Tenant-scoped result
  API-->>PWA: Response or explicit offline/unpaired state
  PC->>RT: Outbound TLS connection with scoped device credential
  PWA->>RT: Authorized low-volume command
  RT->>PC: Deliver command to paired runtime
  PC->>PC: Validate scope and execute supported action
  PC-->>RT: Acknowledge result / current status
  RT-->>PWA: Runtime status and acknowledgement
```

The hosted remote is additive and internet-dependent. It supports secure cloud administration, notes, monitoring,
and paired session management. It does not embed the legacy phone remote or expose the desktop HTTP server.
Commands are accepted only while the runtime is online, paired, authorized, and in an allowed state. Camera frames,
media, and high-frequency rendering updates never pass through the cloud.

### Device pairing architecture

```mermaid
sequenceDiagram
  participant Admin as Authenticated organization admin
  participant PWA as Hosted PWA
  participant API as Next.js pairing API
  participant DB as Supabase
  participant PC as Desktop runtime
  Admin->>PWA: Start pairing for named runtime
  PWA->>API: HTTPS create challenge
  API->>API: Verify admin role; generate high-entropy one-time challenge
  API->>DB: Store challenge hash, org/runtime binding, expiry
  API-->>PWA: Display QR + short code, expires in 5 minutes
  PC->>API: Outbound TLS request for pending pairings
  API-->>PC: Challenge metadata (no reusable secret)
  Admin->>PC: Approve displayed runtime/user/device and scope
  PC->>API: Signed approval with challenge proof
  API->>DB: Atomically consume challenge; create scoped device record
  API-->>PC: Short-lived credential / rotation instructions
  PC->>API: Establish authenticated outbound channel
  API-->>PWA: Pairing result and device status
```

Pairing requires an authenticated administrator, explicit approval at the desktop runtime, organization/runtime
binding, short expiry, one-time consumption, rate limits, replay protection, audit events, credential rotation, and
immediate revocation. The QR/short code is a locator, never a standalone login credential. Do not display or log
the challenge after consumption.

### Authentication architecture

```mermaid
flowchart LR
  User["User"]
  Browser["PWA browser"]
  Next["Next.js server boundary"]
  Supabase["Supabase Auth"]
  Policies["Postgres RLS"]
  Secrets["Vercel server secrets"]
  User -->|Email / OAuth| Browser
  Browser <-->|Authorization code, PKCE| Supabase
  Browser -->|Secure session cookie| Next
  Next -->|Validated session and role| Supabase
  Next -->|User-scoped access| Policies
  Secrets --> Next
  Browser -. "Never receives service-role key" .-> Secrets
```

Use Supabase Auth with supported session/refresh handling and OAuth PKCE. Prefer secure, HttpOnly cookies at the
Next.js boundary with CSRF defenses on mutations. Google and Microsoft OAuth require provider credentials and
callback configuration; until those are supplied, implement email/provider-independent boundaries and keep OAuth
providers explicitly unconfigured rather than simulating sign-in. The Supabase service-role key stays server-side.
Require membership and role authorization in trusted server code and RLS, not only in UI.

### Synchronization architecture

```mermaid
sequenceDiagram
  participant UI as Hosted planning UI
  participant PWA as PWA local draft
  participant API as Next.js API
  participant DB as Supabase Postgres
  participant RT as Realtime
  UI->>PWA: Edit versioned metadata
  PWA->>PWA: Validate schema; mark unsynced draft
  PWA->>API: HTTPS mutation (operationId, baseRevision, schemaVersion)
  API->>API: Authenticate; authorize tenant; validate bounds
  API->>DB: Transactional version check and write
  DB-->>API: Canonical revision or explicit conflict
  API-->>PWA: Ack / conflict details
  API->>RT: Publish revision notification only
  RT-->>PWA: Authorized small change notification
  PWA->>API: Fetch canonical metadata after reconnect
```

Cloud synchronization is between the hosted PWA and Supabase; do not claim a local runtime sync/outbox exists until
that adapter is implemented. Pairing/remote commands use the separate authenticated runtime channel. Persist only
versioned metadata and opaque local asset IDs; never upload media bytes, member data excluded by policy, local file
paths, PINs, tokens, or keys. Use stable operation IDs for idempotency, explicit base revisions for conflicts, and
clear unsynced/error state. Offline browser drafts are bounded and user-visible; they do not imply that remote
commands can be delivered.

### Security architecture

```mermaid
flowchart TB
  subgraph Edge["Public HTTPS boundary"]
    TLS["Vercel TLS + security headers"]
    Limits["Abuse controls / rate limits"]
  end
  subgraph App["Trusted application boundary"]
    Session["Supabase session validation"]
    CSRF["CSRF / Origin checks"]
    Schema["Schema + size validation"]
    Role["Organization / role authorization"]
    Audit["Secret-free audit events"]
  end
  subgraph Data["Tenant data boundary"]
    RLS["Postgres RLS, deny by default"]
    Rows[("Metadata only")]
  end
  subgraph Device["Paired runtime boundary"]
    Credential["Scoped, rotating device credential"]
    Agent["Outbound TLS channel"]
    Local["Local media + rendering never leave device"]
  end
  TLS --> Limits --> Session --> CSRF --> Schema --> Role
  Role --> RLS --> Rows
  Role --> Audit
  Credential --> Agent
  Agent -->|Authorized command / metadata| Role
  Local -. "No cloud media transport" .-> Rows
```

Security defaults: HTTPS/WSS only for hosted services, deny-by-default authorization, organization-level RLS,
least-privilege roles, short-lived/revocable credentials, request size limits, rate limits, CSRF/Origin validation,
secret-free logs, and no cloud media. Threat modeling and tenant-isolation tests precede real user data.

## 5. Synchronization and offline architecture

### Data flow

1. The local runtime remains authoritative for active presentation execution and local assets.
2. Each metadata change is schema-validated and stored locally with a stable operation ID, schema version, base
   revision, and sync status.
3. When online, the runtime sends queued metadata changes over HTTPS/WSS using a scoped device identity.
4. Server authorization checks account, organization membership, runtime pairing, and role before applying a
   mutation. Database changes use transactions and tenant RLS.
5. Realtime announces a small revision/event, not the full source of truth. Clients fetch current authorized
   metadata and reconcile against the durable revision.
6. Retries reuse operation IDs so duplicate delivery is idempotent. Conflicts are explicit and resolved by a
   defined merge/review flow; do not silently apply last-write-wins to an entire meeting.
7. On connectivity return, queued sync resumes automatically and records progress/errors for the operator.

```mermaid
sequenceDiagram
  participant UI as Desktop / PWA
  participant Local as Local runtime + outbox
  participant Cloud as Next.js API
  participant DB as Supabase Postgres
  participant RT as Realtime
  UI->>Local: Edit presentation metadata
  Local->>Local: Validate and persist locally
  alt Internet available
    Local->>Cloud: HTTPS mutation (operationId, baseRevision)
    Cloud->>DB: Authorize with membership + RLS; commit version
    DB-->>Cloud: Committed version
    Cloud-->>Local: Acknowledgement and canonical revision
    Cloud->>RT: Publish small revision notification
  else Offline
    Local->>Local: Queue change; keep presenting locally
  end
  RT-->>UI: Revision changed
  UI->>Cloud: Fetch current authorized metadata
```

### Offline invariants

**Must continue without internet:** existing PC presentation workflow, rendering, local slide/frame navigation,
video/audio playback, local media resolution, virtual camera, projector output, Zoom/Teams/OBS paths, and local
state saving.

**May pause until connectivity returns:** hosted account operations, cloud sync, hosted PWA session management,
notes/monitoring updates, and paired runtime commands that depend on the cloud relay. The existing LAN remote
continues to provide the existing local phone-control workflow; the hosted PWA is not promised to work offline.

Service worker behavior is limited to the application shell and explicitly safe user-approved drafts. Do not cache
private APIs, member records, pairing responses, or privileged session data. Logout, revocation, and account
switching clear protected cached state.

## 6. PWA design

- Serve from HTTPS, initially using the Vercel-provided URL.
- Build a separate hosted companion; do not replace or migrate `remote.html`, its layout, navigation, APIs,
  authentication, or LAN behavior.
- Serve the hosted app over HTTPS and use Supabase authentication. The initial hosted control experience may
  require internet and a paired runtime.
- Add a service worker only for safe versioned app-shell assets. Never cache auth responses, private APIs, pairing
  challenges, privileged commands, member records, or session secrets. The UI must clearly show unavailable
  network/runtime states.
- Keep iOS/Android/tablets as management and remote clients; no presentation rendering, hosting, media playback, or
  virtual camera on mobile.
- Validate install/update and auth recovery on current iOS Safari and Android Chrome. Test browser-specific
  installation, storage eviction/recovery, background suspension, notification permission, and network transitions;
  do not assume identical platform behavior.
- Cloudflare is deferred until a custom domain exists; Vercel URL deployment must work independently.

### PWA phase completion plan

| Gate | Work | Exit evidence |
|---|---|---|
| PWA-0 — Scope and separation | Online-first hosted companion; existing LAN remote and desktop remain untouched | Architecture and route ownership documented; no HTTPS-to-local-HTTP request path |
| PWA-1 — Web foundation | Separate Next.js/TypeScript app, responsive FrameDecks shell, HTTPS deployment target, independent CI | Type/lint/test/build pass; desktop workflow remains independently green |
| PWA-2 — Identity and tenancy | Supabase email auth first; OAuth when provider credentials exist; organizations, roles, migrations, RLS | Auth lifecycle and cross-tenant deny tests pass in non-production project |
| PWA-3 — Hosted management | Notes, monitoring, session controls, administrative features backed by scoped server APIs | Role tests, audit events, no sensitive or media data in logs/cloud |
| PWA-4 — Pairing and runtime channel | Authenticated expiring challenge, runtime-side approval, scoped rotating credential, outbound TLS/WSS | Expiry/replay/revoke/reconnect tests; no public inbound desktop listener |
| PWA-5 — Safe install and cache | HTTPS manifest, icons, safe app-shell service worker, explicit online/offline status | Cache audit confirms private responses/secrets excluded; update/logout behavior tested |
| PWA-6 — Device acceptance | iOS Safari and Android Chrome current supported versions plus tablet layouts | Install, login/recovery, lifecycle, reconnect, storage, and accessibility matrix passes on real devices |
| PWA-7 — Operations | Vercel deployment, environment separation, alerts, backup/restore, incident/runbook | Successful preview and production deploy; restore and revocation exercises documented |

The hosted companion may be deployed before every gate, but features remain unavailable until their security and
device acceptance criteria pass. Do not mark the whole PWA complete based only on a manifest or service worker.

## 7. Security architecture requirements

- HTTPS everywhere for hosted pages, APIs, and runtime connections; WSS for persistent channels.
- Supabase-managed JWT/session lifecycle with refresh/revocation; short-lived, scoped local-runtime credentials.
- Organization membership and role checks on every operation; deny by default and enforce tenant RLS.
- Secure cookies and CSRF protection for cookie-authenticated state changes; validate Origin/Host where applicable.
- Rate limits on login, pairing, sensitive actions, and API writes; lockouts must not create easy cross-user denial
  of service.
- Pairing challenges are one-time, five-minute, authenticated, runtime-approved, and replay-resistant.
- Device/session revocation, auditable security events, and defined log retention.
- No service-role keys, OAuth secrets, or reusable pairing credentials in client code, PWA caches, URLs after
  challenge consumption, or logs.
- No media bytes in cloud requests, database rows, audit logs, or PWA caches.
- Test tenant isolation and authorization at both API and database layers before importing real user data.

## 8. Deployment architecture

```mermaid
flowchart LR
  Dev["GitHub<br/>modernization-v1"]
  CI["GitHub Actions<br/>desktop tests + web checks"]
  Preview["Vercel preview URL"]
  Prod["Vercel production URL"]
  Supabase["Supabase project<br/>Auth · Postgres · Realtime"]
  Future["Cloudflare edge<br/>after custom domain"]
  Runtime["Local runtimes"]
  Dev --> CI
  CI --> Preview
  CI --> Prod
  Preview --> Supabase
  Prod --> Supabase
  Prod -. "future domain only" .-> Future
  Runtime -->|outbound HTTPS/WSS| Prod
```

- Keep the existing Windows installer/build workflow intact and independently releasable.
- Add separate hosted-app CI for lint, typecheck, unit/security-policy tests, browser tests, and production build.
- Separate development, preview, and production Supabase projects/secrets. Avoid production user data in preview.
- Use Vercel-provided URLs first; do not invent or assume a domain. Cloudflare custom-domain routing is deferred.
- Make database changes through reviewed, versioned migrations. Define backup and restore procedures and test them.
- No payment provider, billing webhooks, subscription tables, or paid-entitlement service.

## 9. Risk register and mitigations

| Risk | Severity | Mitigation / gate |
|---|---|---|
| Tenant data leak through incorrect RLS or API authorization | Critical | Deny-by-default policies, cross-tenant tests, independent review, no real data until passed |
| Existing workflows regress during UI migration | High | Preserve current screens and behaviors; port by vertical slice; automated baseline and side-by-side acceptance tests |
| HTTPS-hosted PWA cannot safely call local HTTP server | Accepted / mitigated | Separate online-first hosted companion; preserve existing LAN remote; no insecure bridge or CORS workaround |
| Cloud outage blocks live presentation | Critical | Keep rendering, media, and outputs local; test internet cuts during presentation |
| Metadata schema/import loses user content or asset bindings | High | Versioned schema, dry-run import, export/backup, idempotency, data-diff reports, rollback |
| Mac parity estimated as a web-only change | High | Treat native Mac camera/capture/presentation as a separate platform project and gate support claims |
| Local media identifiers/paths leak to cloud | Medium/High | Opaque IDs in cloud, local-only path mapping, payload inspection tests |
| Pairing-code theft/replay or persistent device access | High | Authenticated challenge, five-minute expiry, runtime approval, atomic one-time use, revocation, audit |
| Vercel/Cloudflare topology conflicts with no custom domain | Medium | Deploy directly to Vercel URL first; defer Cloudflare edge until domain configuration |
| Hosted service costs exceed free product sustainability | High | Metadata-only architecture, quotas/abuse controls, budgets and alerts; do not introduce feature gating |
| OAuth/provider setup delays initial deployment | Medium | Build/test email auth first; configure Google/Microsoft as separate provider acceptance gates |

## 10. Implementation phases and exit criteria

| Phase | Scope | Exit criteria |
|---|---|---|
| 1. Audit and architecture | Current-state evidence, security/debt/performance/offline assessment, target architecture, status tracking | Audit, roadmap, risks, and baseline test results documented |
| 2. Frontend foundation | Isolated Next.js + TypeScript + Tailwind + shadcn/ui app and CI | Existing desktop app unchanged; web lint/type/test/build gates pass; Vercel preview works |
| 3. Authentication and tenant model | Supabase email/Google/Microsoft auth, organizations, roles, Postgres migrations, RLS | Tenant isolation tests pass; account/session revocation works; restore/deletion procedures exercised |
| 4. Metadata synchronization | Versioned contracts, local outbox, idempotent sync, conflict recovery, 6.9 data importer | Offline operation unaffected; no media bytes uploaded; representative data round-trips without loss |
| 5. PWA and pairing | Online-first HTTPS PWA, QR/6-digit codes, five-minute expiry, runtime approval, device trust/revocation | iOS/Android/browser tests pass; replay, expiry, role, revocation, online reconnect tested; no local HTTP bridge |
| 6. Deployment and operations | Vercel production, secrets, monitoring, audit retention, backup/restore; future Cloudflare | Vercel URL production ready; restore drill and incident process complete; no custom domain assumed |
| 7. Branding and terminology | User-facing FrameDecks brand/tagline and approved wording only | Layout/navigation unchanged; internal API, model, table, and environment names unchanged |
| 8. Compatibility rollout | Pilot, side-by-side workflows, migration/rollback, platform coverage | Preservation matrix passes; no unresolved critical/high security or data-loss issues |

Phases are gated; a later phase does not begin merely because its row follows the prior one. Hosted PWA operation is
initially online-only and is not offline phone-remote parity. The existing LAN remote remains available separately.

### Branding and terminology migration

When Phase 7 begins:

- Use the user-facing brand **FrameDecks** and tagline **Present • Equip • Inspire**.
- Apply the requested visible hierarchy **Frame → Deck → Content** and replace the user-facing phrase
  **“Decks & Elements”** with **“Decks & Content”** where it exists.
- Generate/replace the horizontal, stacked, and icon logos, favicon, app icons, splash/login branding, and
  marketplace assets without changing application behavior.
- Do not rename APIs, database tables or fields, internal models/services, or environment variables.
- Capture before/after screenshots and run the preservation matrix to verify that branding work changes no layout,
  navigation, or interaction behavior.

## 11. Preservation and compatibility validation

No claim of complete modernization is valid until this matrix is tested against the existing 6.9 release and target
runtime(s):

| Area | Required validation |
|---|---|
| Visual identity/layout | Existing dashboard, studio, settings, overlays, speaker view, and remote screen comparisons show no unintended layout/navigation changes |
| Planning workflows | Meeting/Frame/Content creation, edit, reorder, duplicate, delete, undo, templates, workbook import/export, notes, and settings |
| Presentation | Go Live, frame/content stepping, transitions, timer, notes, blackout, emergency, freeze, annotation, queue, confidence monitor |
| Remote | Same screens, buttons, placement, interactions, and connection states; login/pairing changes do not remove existing capabilities |
| Media | Image, video, audio where supported, PDF/PowerPoint, local capture, and missing-file recovery operate offline |
| Outputs | Virtual camera, presentation window/projector, OBS overlays, Zoom, and Teams verified on supported platforms/hardware |
| Local data/API | Existing user data opens; old local endpoints/contracts remain compatible or use an explicit adapter; no destructive migration |
| Offline | Disconnect internet during an active presentation; all required local outputs continue and queued metadata sync resumes after reconnect |
| Security | Cross-tenant denial, role enforcement, CSRF/rate limit/session revocation, pairing expiry/replay, cache privacy, and secret scan |
| Platform | Windows baseline retained; Mac support is not declared equivalent until a Mac-native runtime and hardware tests pass |

## 12. Rollback plan

1. Keep the current 6.9 desktop installer and local data format readable throughout the migration.
2. Develop the hosted application alongside the desktop product; never make the existing local application depend on
   Supabase or Vercel for presentation.
3. Back up source data before migration and run import in dry-run mode with a field-by-field diff and explicit user
   confirmation.
4. Use additive database migrations first. Prefer forward-fix migrations over destructive rollback after user data
   has been written.
5. Gate new sync and pairing behavior behind separately configurable capabilities; preserve the local-only launch
   path and provide a documented disable/rollback procedure.
6. On failed rollout, disable cloud sync/pairing, continue with the last local state and local media, export any
   cloud metadata, and restore the previous stable desktop release.
7. Verify rollback on a non-production copy before broad pilot; communicate any data reconciliation required.

## 13. Phase 1 completion record

Phase 1 is complete for the repository assessment and architecture deliverables. This does **not** mean SaaS,
PWA, Supabase, pairing, or cloud synchronization has been implemented. Phase 7 branding work has started in the
desktop/local product and remains incomplete for future hosted login/splash surfaces.

- Audit: [FRAMEDECKS_AUDIT.md](project/FRAMEDECKS_AUDIT.md)
- Status: [FRAMEDECKS_MODERNIZATION_STATUS.md](FRAMEDECKS_MODERNIZATION_STATUS.md)
- Existing detailed report: [SaaS migration roadmap](project/saas-migration-roadmap.md)
- Existing Windows/Python application remains the tested production runtime.
- Supplied logo source and generated application assets are documented in the asset generator at
  `tools/generate_brand_assets.py`.
- `Stripe` is explicitly excluded; product is free.
- Open blockers: secure offline mobile remote transport; product roadmap conflict; Mac-native runtime scope;
  Cloudflare custom domain availability.
