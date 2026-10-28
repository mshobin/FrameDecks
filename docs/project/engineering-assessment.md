# Engineering assessment — FrameDecks 6.9

**Assessment date:** 22 October 2026  
**Repository state:** `main`, clean worktree at assessment time  
**Product model:** Windows-first, local-first presentation and service-planning application

## Executive summary

FrameDecks is a deliberately self-contained desktop application. A Python process serves a vanilla HTML/CSS/JavaScript interface, stores application data in local JSON files, and runs an OpenCV-based compositor for the virtual camera and presentation output. The optional phone remote is a PIN-protected web interface served over the local network. The core design avoids accounts, cloud services, a database server, and runtime npm dependencies.

This architecture is well matched to an offline service PC: it has few operational dependencies, predictable local data ownership, and a shared state model across the dashboard, phone, overlays, and camera. Build and release automation is stronger than the runtime architecture's test coverage: CI builds the Windows installer and runs JavaScript/Python tests and packaging checks, but does not exercise the complete user interface, remote security flows, or camera pipeline automatically.

The largest concerns are the security properties of the optional plaintext-HTTP LAN remote, the concentration of responsibilities in `src/server.py` and several large UI modules, limited automated integration coverage, and the product's lack of hosted-service fundamentals. The existing manifest and icons make the remote PWA-adjacent, but it is not an offline-capable PWA. SaaS readiness is intentionally low; converting it to SaaS would be a product and architecture redesign, not a deployment change.

### At-a-glance assessment

| Area | Assessment |
|---|---|
| Technology and framework | Python 3.12, standard-library threaded HTTP server, vanilla JavaScript, WebView2/pywebview, OpenCV/NumPy |
| Architecture | Single process, local-first, file-backed state, shared compositor |
| Authentication | No user accounts; optional remote uses a six-digit PIN and long-lived bearer session cookie |
| Database | None; JSON files and browser `localStorage` |
| Security posture | Sensible local boundaries and opt-in remote controls; plaintext LAN transport and local data-at-rest exposure remain material limits |
| Performance | No large general-purpose server stack; camera/compositing and state/UI growth are likely costs; published measurements are historical, not a 6.9 benchmark |
| PWA readiness | Partial metadata only; no service worker or offline operation; LAN access is HTTP |
| SaaS readiness | Low by design; no tenant, identity, cloud persistence, or hosted operations model |
| Technical debt | High module-size concentration, backend/UI integration-test gaps, legacy migration complexity, incomplete licensing/signing |

## 1. Current technology stack

| Layer | Current implementation |
|---|---|
| Primary language | Python 3.12 for server, desktop shell, Windows integration, and camera pipeline; JavaScript for UI and state logic |
| Server/runtime | Python standard library `http.server` using `ThreadingHTTPServer`; custom routing and response handling in [src/server.py](../../src/server.py) |
| UI | Static HTML, CSS, and vanilla JavaScript under [app/](../../app); no framework build step and no npm dependency manifest |
| Desktop shell | `pywebview` hosting WebView2, `pystray` for tray behavior, plus custom Windows integration through `ctypes` in [src/desktop_app.py](../../src/desktop_app.py) and [src/desktop_win.py](../../src/desktop_win.py) |
| Video/capture | OpenCV, NumPy, MediaPipe selfie-segmentation model, Windows Graphics Capture/DXGI capture, and a bundled softcam-derived DirectShow virtual-camera driver in [src/vcam/](../../src/vcam) |
| Document/media support | `pypdfium2` for PDF rendering; installed Microsoft PowerPoint and `comtypes` for PowerPoint conversion/control; SheetJS is vendored for workbook import/export |
| Persistence | JSON files in the application data directory, copied media assets, backup directories, and browser `localStorage` in file/no-install mode |
| Packaging/release | PyInstaller, Inno Setup, and GitHub Actions workflow in [.github/workflows/build-windows.yml](../../.github/workflows/build-windows.yml) |
| Tests | Node.js test runner without npm packages, Python `unittest`, and packaging/documentation self-check scripts |

Python runtime dependencies are declared with compatible version ranges in [requirements-desktop.txt](../../packaging/requirements-desktop.txt). The release build uses exact tested transitive versions from [constraints.txt](../../packaging/constraints.txt), which improves build repeatability. The codebase itself has no frontend package manager, bundler, transpiler, or framework dependency.

## 2. Frameworks and major libraries

- **pywebview + WebView2:** native desktop window hosting for the HTML UI; Windows desktop behavior is built on Win32 APIs.
- **Python `http.server`:** custom local HTTP server; this is not Flask, Django, FastAPI, or another full web framework.
- **OpenCV and NumPy:** frame capture, image transforms, compositing, effects, and camera image processing.
- **MediaPipe model:** local selfie segmentation for background blur.
- **softcam:** native virtual-camera component compiled and packaged through CI.
- **Windows Capture / DXGI / Media Foundation:** screen/window capture and webcam input.
- **pypdfium2 and comtypes:** PDF rendering and Windows PowerPoint integration.
- **SheetJS (vendored):** Excel workbook parsing/export support, loaded on demand.
- **pystray:** Windows notification-area icon and menu.

The application favors direct modules and lightweight runtime behavior over framework conventions. This reduces install and startup complexity, but means routing, request validation, security controls, and lifecycle behavior are maintained in application code.

## 3. Architecture overview

### Runtime shape

1. `src/server.py` starts a threaded HTTP server on loopback, normally port 8750 (with a small fallback port range).
2. The desktop shell in `src/desktop_app.py` opens the dashboard and supporting windows in WebView2. In source/browser mode, the same UI can be opened in an external browser.
3. The browser UI reads and mutates a shared state document. In desktop/server mode, the authoritative state is held in memory and persisted to JSON. File/no-install mode instead uses browser `localStorage`, `BroadcastChannel`, and a periodic cross-tab safety check.
4. When enabled, the phone remote adds listeners on the host's network interfaces. The remote shares the same state and presentation model, constrained by a server-side route allow-list.
5. The `vcam` package reads the in-memory live state and composes webcam, screen/window capture, media layers, cards, annotations, branding, and program effects into the final frame.
6. The same composed output feeds the virtual camera, a native presentation window, and on-demand preview endpoints. OBS/browser overlay pages are separately rendered from the shared state.

### Data flow and consistency

The server assigns a monotonically increasing revision to state changes. Clients send a base revision when saving; conflicting writes receive a `409` response and are reconciled against the latest state. A condition variable wakes long-polling clients on changes. State is written to a temporary JSON file and replaced atomically. The library can be omitted from state responses when a client already has the matching library revision.

This keeps all local screens coordinated without a database or message broker. It also concentrates state mutation and persistence in the server process: there is no independent durable transaction log, multi-host coordination, or remote synchronization service.

### Main boundaries

- [src/server.py](../../src/server.py): HTTP routing, local and remote access checks, state, settings, backups, uploads, scripture integration, and application control.
- [app/js/store.js](../../app/js/store.js): state normalization, browser/local mode, API synchronization, and shared client-side behavior.
- [app/js/workspace.js](../../app/js/workspace.js): workspace/dashboard interactions.
- [src/desktop_app.py](../../src/desktop_app.py) and [src/desktop_win.py](../../src/desktop_win.py): desktop lifecycle, windows, tray, shortcuts, and native Windows integration.
- [src/vcam/](../../src/vcam): camera and media capture/composition pipeline.

## 4. Authentication mechanism

### Desktop/local application

There is no user identity, account, password, or role-based login for the desktop UI. The trust boundary is primarily the local Windows account and the local machine. The server binds to `127.0.0.1` for the normal local mode and checks the `Host` header to reject non-local hostnames. POST requests additionally check the `Origin` header when one is present.

### Optional phone remote

- Disabled by default unless enabled in settings or started with `--remote`.
- User enters the six-digit PIN shown by the host application.
- Failed attempts are rate-limited by client IP: five failures trigger a 60-second lockout.
- A successful login creates a random URL-safe session token, stored server-side with an expiry, and returned as an `HttpOnly`, `SameSite=Strict` cookie lasting 30 days.
- PIN reset clears active sessions and rotates the PIN.
- A server-side allow-list limits non-local devices to remote pages, presentation state, selected overlays, and the live preview; local-only APIs include member data, settings, uploads, scripture settings, and camera controls.

This is a practical trusted-LAN control mechanism, not a full identity system. It has no per-person identities, administrator roles, short-lived refresh flow, device revocation UI beyond resetting all sessions, or cryptographic transport on the LAN.

## 5. Database dependencies and persistence

There is **no database dependency**: no SQLite, PostgreSQL, MySQL, MongoDB, Redis, Firebase, or Supabase integration is present.

The primary state and private member/settings data are JSON files (including `kc-saved-content.json` and `kc-members-private.json`). Additional JSON/text files hold application settings, remote PIN/session state, camera settings, scripture cache/settings, and related metadata. Backups are local files. Media is copied into the data directory. In browser-only mode, state and preferences use `localStorage`; cross-tab updates use `BroadcastChannel` with a timed fallback check.

**Benefits:** no database installation or service administration, simple backup/restore, and good offline behavior.  
**Limits:** persistence is single-machine and single-process oriented; large state documents are serialized and rewritten as a unit; concurrent multi-PC editing and server-side querying/reporting are not natural extensions of the current model. JSON is not encrypted at rest by the application and inherits the protection of the user's OS account and filesystem.

## 6. Security concerns

This section records material security properties and residual risks visible from repository inspection. It is an engineering assessment, not a penetration test or a claim that every code path has been exhaustively audited.

### Existing controls

- Local-only binding by default; remote listeners are opt-in.
- Host validation intended to prevent DNS-rebinding access to the loopback server.
- Origin validation for POST requests when an `Origin` header is supplied.
- Non-local path allow-list, including explicit exclusion of member/private and settings routes.
- `HttpOnly` and `SameSite=Strict` session cookie attributes; cryptographically random session tokens and constant-time PIN comparison.
- Login lockout, request-body size cap, resolved-path containment for static files, and filename basenames for selected file operations.
- `X-Content-Type-Options: nosniff`, atomic state replacement, and private-member data separation.
- Optional ESV access sends the requested reference and API key to the ESV service; this is described in [SECURITY.md](../../.github/SECURITY.md).

### Residual risks and concerns

1. **Plaintext LAN remote transport (high operational concern).** The phone remote uses `http://<host-LAN-IP>`; the session cookie does not have the `Secure` attribute because the service has no HTTPS certificate. PINs and session tokens can therefore be exposed to an attacker able to observe or interfere with the same network. Keep the remote on a trusted private Wi-Fi network; do not treat guest/public Wi-Fi as safe. This limitation is acknowledged in [SECURITY.md](../../.github/SECURITY.md).
2. **PIN is a shared secret, not user authentication.** Six digits and per-IP throttling are reasonable for a controlled local remote, but provide no user attribution or role boundaries. Lockout state is in memory, so restarting the server resets it. A compromised or shared PIN authorizes the entire remote capability set until reset/expiry.
3. **Local data is not encrypted at rest.** Member names/contact details, meeting content, and settings are files protected by Windows account/filesystem permissions. A copied profile or access to the logged-in account can expose them. This is also documented in [SECURITY.md](../../.github/SECURITY.md).
4. **No application security headers policy beyond `nosniff`.** Responses do not appear to set a Content Security Policy or a general frame-embedding policy. The UI intentionally embeds local pages in iframes, so any CSP needs to preserve that design; a documented policy would still reduce the impact of an injection defect.
5. **HTTP server has limited request auditing.** `BaseHTTPRequestHandler.log_message` is disabled. This avoids noisy logs but leaves little built-in visibility into anomalous request patterns or remote access history.
6. **Unsigned Windows installer.** SHA-256 checksums help verify file integrity against the published checksum but do not identify the publisher. SmartScreen warnings and distribution trust remain concerns until code signing is available.
7. **Test coverage does not provide security assurance.** CI does not appear to run automated tests for Host/Origin checks, non-local route authorization, login throttling, cookie behavior, file/path handling, or the full remote workflow. The existing [testing guide](../development/testing.md) describes broad manual checks but no automated security suite.

No database server or public cloud API is part of the normal architecture, which materially reduces remote attack surface. The main security boundary changes when LAN remote access is enabled.

## 7. Performance bottlenecks and scaling limits

The application is not a conventional high-concurrency web service. It is a local desktop workload, and its dominant cost is expected to be media processing rather than request routing.

### Likely cost centers

- **Camera/compositor pipeline:** webcam capture, background segmentation, transforms, multiple media layers, frame composition, and virtual-camera output can be CPU/GPU intensive, especially at higher resolutions and with blur or moving media.
- **Preview and presentation encoding:** live preview JPEGs and the presentation MJPEG stream require encoding work. The implementation throttles and makes previews on demand; multiple viewers or high frame rates can still increase CPU and bandwidth.
- **State serialization and disk writes:** each state mutation serializes and rewrites the JSON document while holding the state synchronization lock. Large meetings/libraries or frequent high-rate mutations can increase lock duration and local I/O.
- **Large client modules and UI state:** `workspace.js`, `store.js`, and `members.js` are large single files. Complex screens can incur parse/initialization costs and make performance regressions harder to isolate.
- **Polling:** overlay and local UI revision checks are frequent (the architecture documentation describes roughly 300 ms for overlay polling); the phone uses long polling. This is an intentional simplicity/latency trade-off and not currently evidenced as a material bottleneck.

The repository's [performance note](performance.md) reports historical 6.7 measurements: dashboard load around 370 ms with 742 KB of scripts and 4.0 MB JS heap; phone remote around 52 ms; and teleprompter around 76 ms. These are not identified as a v6.9 benchmark, so they should be treated as a prior baseline rather than current verified performance. The same document records on-demand loading for SheetJS and inactive-feature construction as optimizations.

### Scale boundary

The current single-process architecture is appropriate for one operator PC and a small number of local clients. It is not designed to horizontally scale, serve multiple organizations, or provide a shared central state service. Any future performance work should first collect current per-platform measurements for camera load, frame latency, preview encoding, large meeting state, and idle request volume.

## 8. PWA readiness

**Assessment: partial shell metadata; not a complete/offline PWA.**

Positive indicators in the remote include a web app manifest, standalone display metadata, touch icons, responsive/mobile layout, and a dedicated remote entry page. The manifest is linked from [remote.html](../../app/remote.html) and describes the Director app in [remote-manifest.json](../../app/remote-manifest.json).

Material gaps:

- No service worker, Cache API strategy, install/offline fallback, or background sync was found.
- The remote depends on the host PC's process and network connection; without it, there is no usable offline app.
- The LAN URL is plain HTTP rather than HTTPS. On phones, a private LAN IP over HTTP is not generally a secure context for browser PWA installation/service-worker features.
- The existing manifest describes app metadata but does not itself make the application installable or offline-capable.

For the current use case, the remote is best described as a mobile web app that can be bookmarked or added to a home screen where the browser permits, not as an offline-first PWA. A true PWA would require a secure delivery model and an explicit offline strategy; offline control of a disconnected host would still not be meaningful.

## 9. SaaS readiness

**Assessment: low; the product is intentionally not SaaS today.**

The code and product documentation explicitly position the application as no-account, no-cloud, local-first software. SaaS foundations that are absent include:

- tenant and organization model, identity provider, account lifecycle, role/permission system, and audit trail;
- remote API authentication, TLS termination, abuse controls, and service-side secrets management;
- centralized database, migrations, multi-user transaction semantics, and disaster recovery;
- hosted deployment, observability, alerting, support operations, backups, availability objectives, and incident response;
- subscription/billing, entitlement, data-retention, and privacy/compliance processes;
- separation of tenant media and member data.

These are not defects relative to the current product promise. A SaaS initiative would require deliberate product, privacy, security, and architecture decisions. Reusing the existing local server as a publicly exposed web service would be unsafe and insufficient.

## 10. Technical debt and engineering risks

### Structural debt

- **Responsibility concentration:** [src/server.py](../../src/server.py) contains HTTP routing, authorization, persistence, backups, uploads, remote sessions, scripture integration, desktop actions, and device/camera orchestration. Several frontend files are also large: `workspace.js` (~1,345 lines), `store.js` (~1,121), and `members.js` (~1,044). These increase review cost, coupling, merge conflicts, and the difficulty of testing units independently.
- **Custom server framework:** the standard-library server keeps dependencies low, but request routing and middleware/security behavior are custom. Changes need careful regression coverage because framework guarantees are not available.
- **State schema evolution:** normalization and migration logic are shared across the Python server, browser state, and legacy data migration. This is important compatibility code and needs explicit schema-version and migration tests as formats evolve.
- **File-backed whole-document persistence:** convenient for a single PC, but increasingly costly for large state and unsuitable for multi-host concurrent updates without a redesign.
- **Windows-specific core capability:** the desktop shell, capture, and virtual-camera integration are Windows-oriented; portable browser mode does not provide feature parity for the camera and native windows.

### Quality and operations debt

- **Integration-test gap:** unit tests cover store behavior, workbook handling, desktop settings/shortcuts, and legacy migrations. Camera engine, HTTP authorization, remote login/session behavior, end-to-end UI, and real Office/Zoom/Teams behavior remain largely manual.
- **Limited performance freshness:** the published measurements cover 6.7 rather than the current 6.9 release; no automated performance budget currently gates CI.
- **Unsigned installer:** no publisher-authenticated Windows package; checksum verification is helpful but cannot substitute for signing.
- **Licensing clarity:** the root README notes the application does not yet have a published project license. Vendored libraries/assets have their own licenses, but the project's distribution/contribution terms need a clear top-level license decision.
- **Operational diagnostics:** minimal request logging and no crash/telemetry pipeline are consistent with privacy goals, but make production issue diagnosis dependent on local logs and user reports.
- **PWA mislabeling risk:** manifest and icons can suggest PWA completeness even though service-worker caching and secure-context deployment are absent. Documentation should describe the remote as a mobile web app unless those gaps are addressed.

## Recommended priorities

1. **Protect the current local/LAN model:** add focused automated tests for Host/Origin validation, local-only endpoints, remote allow-listing, PIN throttling, and session reset; retain the documented trusted-network warning.
2. **Improve release trust and compliance:** publish a project license and pursue Authenticode code signing for distributed Windows installers.
3. **Add current release telemetry-free performance checks:** refresh the 6.9 baseline on representative Windows hardware and add repeatable checks for state size, camera frame latency, preview encoding, and idle traffic.
4. **Build integration coverage:** add browser-driven smoke tests for the dashboard and phone remote, plus deterministic tests for the server route/auth boundary and compositor components where feasible.
5. **Reduce change risk incrementally:** extract server responsibilities into cohesive modules and split the largest UI modules only alongside tests; avoid a broad rewrite.
6. **Keep SaaS and PWA work gated by product intent:** do not expose the local server publicly. If hosted multi-tenant use becomes a goal, design identity, tenant isolation, encrypted transport/storage, migrations, observability, and operations as a separate architecture.

## Scope and limitations

This assessment reviewed repository documentation, dependency manifests, entry points, server request handling, client state synchronization, remote manifest/page, packaging workflow, tests, and the camera package structure. It did not execute the application, conduct a penetration test, inspect a running network deployment, benchmark v6.9, or validate all platform-specific runtime behavior. Security and performance statements that depend on deployment or workload are identified as risks or likely cost centers rather than measured findings.
