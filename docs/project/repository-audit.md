# Repository audit — Kingdom Connect v6.6

An independent review of the product and the repository: what it is, how it is built, how ready it is for
churches, and what to improve next. Scores are out of 10.

**Who this is for:** the maintainer, contributors and church technology leads deciding whether to adopt it.

**Audit date:** October 2026 · **Version reviewed:** 6.6 (branch `claude/peaceful-albattani-6m445e`)

**On this page**
- [Summary scorecard](#summary-scorecard)
- [1. Product purpose](#1-product-purpose)
- [2. Feature set](#2-feature-set)
- [3. Architecture](#3-architecture)
- [4. Technology stack](#4-technology-stack)
- [5. Strengths](#5-strengths)
- [6. Weaknesses and risks](#6-weaknesses-and-risks)
- [7. UX review](#7-ux-review)
- [8. Volunteer experience](#8-volunteer-experience)
- [9. Reliability](#9-reliability)
- [10. Documentation](#10-documentation)
- [11. Production readiness](#11-production-readiness)
- [12. Recommendations](#12-recommendations)

---

## Summary scorecard

| Area | Before this review | After this review | Notes |
| --- | :---: | :---: | --- |
| Product clarity | 6 | 8 | Clear "Meeting → Frame → Content → Present" model; positioning now written down |
| Feature completeness (for Bible study / hybrid services) | 8 | 8 | Strong for teaching, discussion and online services |
| Feature completeness (for full worship services) | 5 | 5 | No song / lyrics library, no stage display for musicians (see Roadmap) |
| Architecture | 7 | 7 | Simple, single-process, one source of truth; `server.py` is a large single file |
| Code quality | 7 | 7 | Consistent idioms and comments; few automated tests for the camera engine |
| UX (operator) | 8 | 8 | Command bar, one Content Settings panel, canvas editing, Speaker View |
| Volunteer experience | 8 | 9 | Simple phone remote, plain language; team guides and checklists now exist |
| Reliability | 8 | 8 | Offline, atomic saves, conflict-safe sync, one-key recovery |
| Testing and CI | 4 | 6 | CI builds, self-checks and now runs every test file; still no UI or engine tests in CI |
| Documentation | 5 | 9 | Was thorough but scattered and version-shaped; now a task-based suite with role guides |
| Developer experience | 3 | 8 | Templates, contributing guide, branching, release and changelog standards added |
| Security and privacy | 8 | 8 | Local-only by default, PIN remote with lockout, allow-list, no telemetry |
| Release engineering | 6 | 7 | Reproducible CI build, checksum file; installer still unsigned |
| **Overall** | **6.3** | **7.7** | Ready for churches using it for teaching and hybrid meetings; worship-lyrics workflows need the roadmap items |

"Before" reflects the repository at v6.6 before this documentation and organization pass; "after" includes it.
Code behaviour did not change in this pass, so the product scores are the same in both columns.

---

## 1. Product purpose

Kingdom Connect is a Windows presentation app for churches and ministries. One leader's PC builds the meeting
as **Frames** (Welcome, Worship, Scripture, Discussion, Prayer, Closing), each holding **Content** (questions,
scriptures, text, timers, pictures, video, PowerPoint). It presents in three ways at once:

- the **KingdomConnect camera** — a virtual webcam, so Zoom, Teams, Google Meet and OBS show the webcam with the
  live Frame on top;
- the **Presentation window** — a clean full-screen picture for a projector or a "share window" in Zoom;
- **overlay pages** — transparent browser sources for OBS.

A **phone remote** and a **Speaker View** let the leader run the meeting without touching the PC.
Its sweet spot today is **teaching, Bible study, small groups, prayer meetings and hybrid services**.

## 2. Feature set

| Area | Today | Gaps |
| --- | --- | --- |
| Service planning | Frames, Content, templates, Quick Start, groups, favourites, notes, Excel Meeting Workbook (Dashboard and Meeting Form, import preview, undo, export) | No calendar or service-plan integration (by design: no cloud) |
| Presentation | Go Live, transitions, auto advance, Show modes, Hide all, Blackout, Emergency, Freeze, Annotate, Speaker View | No separate stage display output for musicians |
| Worship lyrics | Possible with Text Content or a PowerPoint / PDF of the lyrics | No song library, verse / chorus order, CCLI fields |
| Bible | ESV fetch (online, API key), any translation typed or pasted (offline), per-Frame scripture lists | No offline Bible database (translation licensing) |
| Media | Images, video, PowerPoint (.pptx → slides), PDF, live window and screen capture, webcam, backgrounds, logos | No shared media library across meetings |
| Camera | Virtual camera, 720p / 1080p, background blur, Camera Looks, cards on camera | Windows only (DirectShow) |
| Remote | Simple and Advanced phone profiles, drawing pad with the live picture, run-through, PIN | LAN only (by design) |
| Data | Local files, autosave, daily backups, Frame history, Excel export | No built-in sync between two PCs (by design since v6.5) |

## 3. Architecture

A single Python process serves a vanilla-JavaScript UI and runs an OpenCV compositor that feeds a DirectShow
virtual camera. State is one JSON document with a revision counter; every screen reads it, writes go through a
conflict check, and the camera reads it directly from memory. See [architecture.md](../architecture.md).

**Assessment.** The design is well matched to a church PC: few moving parts, no services, no database, no build
step, and one authoritative picture. The main structural debt is size concentration: `server.py` (about 2,100 lines)
mixes HTTP routing, state, uploads, scripture, remote sign-in and backups; `store.js` and `workspace.js` are also
large (about 1,100 lines each). Splitting them into modules would make review and testing easier without changing behaviour.

## 4. Technology stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Python 3.12, pywebview (WebView2), pystray |
| Server | Python standard library `http.server` (threaded), JSON files |
| Camera engine | OpenCV, NumPy, MediaPipe selfie model (blur), pypdfium2, windows-capture (DXGI / WGC), comtypes (PowerPoint) |
| Virtual camera | softcam (MIT), built in CI as `kingdomconnect_vcam64/32.dll` |
| UI | HTML, CSS (design tokens), vanilla JavaScript (no framework, no npm) |
| Excel | SheetJS (vendored) in a Web Worker |
| Packaging | PyInstaller, Inno Setup, GitHub Actions (`windows-latest`) |

**Assessment.** Pragmatic and dependency-light. Python dependencies use version ranges rather than a lock file,
so two builds months apart may differ; pinning exact versions for releases would improve reproducibility.

## 5. Strengths

1. **Offline and private by default.** No accounts, no telemetry, data on the PC.
2. **One picture everywhere.** Preview, camera and Presentation window cannot disagree.
3. **Volunteer-centred design.** Plain words, one settings panel, big phone buttons, Esc / K always recover.
4. **Hybrid-service strength.** The virtual camera with cards on top is unusual among church presentation tools.
5. **Frame independence.** Duplicating last week's service can never change it by accident.
6. **Careful engineering record.** Every version has release notes and a design-history section with
   measurements and trade-offs.
7. **Safe sync.** Revision counter, 409 conflict handling and atomic writes.

## 6. Weaknesses and risks

| # | Issue | Impact | Suggested fix |
| --- | --- | --- | --- |
| 1 | No song / lyrics library | Worship teams must build lyrics as text or slides | Song library with sections and arrangement (Roadmap) |
| 2 | Unsigned installer | SmartScreen warning erodes trust for new churches | Code-signing certificate |
| 3 | Few automated tests for the engine and UI | Regressions found late | Playwright smoke tests and engine unit tests in CI |
| 4 | Large single files (`server.py`, `store.js`, `workspace.js`) | Harder review, merge conflicts | Split by responsibility |
| 5 | No licence file | Unclear terms for churches and contributors | Maintainer to choose and publish a licence |
| 6 | Windows-only camera | Mac churches cannot use the camera features | Document clearly; consider only with demand |
| 7 | Dependency ranges, no lock file | Builds can drift | **Done:** `packaging/constraints.txt` pins every package to the last good build |
| 7a | Two OpenCV packages installed together (`opencv-python` 5.0 via a dependency, `opencv-python-headless` 4.14) sharing one module | A future version change could break the camera | Pinned as a tested pair; remove one when the dependency allows it |
| 8 | Internal names (data folder, install folder, exe) still carried the program's earlier name | Confusing in support conversations | **Done (6.9):** everything uses Kingdom Connect; `legacy.py` moves earlier data once |
| 9 | GitHub Actions on Node 20 actions | Deprecation warnings today, failures later | Update action versions once verified |

## 7. UX review

- **Command bar** keeps every live control in one row: Go Live, Frame and item steppers, transitions,
  Program menu, Hide all. Good for muscle memory.
- **Content Settings** shows every setting in named groups with jump links. Duplicate controls were merged in
  6.6, which lowers the learning curve.
- **Direct manipulation** (drag media on the canvas, double-click a card to edit it, drag list items) matches
  what users expect from ProPresenter-style tools.
- **Status is always visible**: LIVE / PREVIEW badges, output chips, the Program button turning red for Blackout.
- **Opportunities:** a first-run tour, keyboard-shortcut overlay (`?`), and a "service mode" that hides editing
  controls during a live service.

## 8. Volunteer experience

- The **Simple phone remote** is the standout: five large controls, connection status in words, nothing to set up.
- **Speaker View** removes the need for printed notes or a second phone.
- Plain-language errors ("Can't reach api.esv.org", "Allow pop-ups…") point at the fix.
- **Gaps before this pass:** no role guides, no checklists, no onboarding path. Now covered by
  [docs/ministry/](../ministry/README.md).

## 9. Reliability

| Check | Result |
| --- | --- |
| Works with no internet | Yes (except the optional ESV fetch) |
| Survives a crash or power cut | Atomic state writes; daily backups; restart restores the meeting |
| Two operators at once | Conflict-safe (409 + retry) |
| Recovery in one action | Hide all (Esc), Blackout (K), Emergency |
| Resource use | Previews only on demand; "Light on graphics card"; idle phone ~6 requests a minute |
| Build verification | Self-check, tests and a checksum in every CI build |
| Not yet verified automatically | Camera output in real Zoom / Teams, PowerPoint conversion on real Office installs |

## 10. Documentation

**Before:** accurate and detailed but organized by version (each release added sections), with user, admin and
engineering material mixed at the root; no contributor guidance; README of 16 lines.

**After:** a task-based suite (getting started → installation → planning → presenting → Frames → Content →
media → remote → troubleshooting → FAQ), architecture with diagrams, role guides and checklists for church
teams, and developer documentation. Earlier guides are kept under [docs/reference/](../reference/) and the
engineering log under [docs/architecture/](../architecture/design-history.md).

## 11. Production readiness

| Criterion | Status |
| --- | :---: |
| Installs and upgrades without losing data | ✅ |
| Works offline | ✅ |
| Automated build and checksum | ✅ |
| Self-check and tests in CI | ✅ |
| User, operator and team documentation | ✅ |
| Security policy and private reporting path | ✅ (SECURITY.md) |
| Code-signed installer | ❌ |
| Automated UI / engine tests | ❌ |
| Published licence | ❌ (maintainer decision) |
| Tested on a range of real church PCs | ⚠️ manual, per release |

**Verdict:** ready for churches that use it for teaching, discussion and hybrid meetings, with the service-day
checklist. For full worship services, plan around the missing song library (use Text Content or PowerPoint) until
the Roadmap delivers it.

## 12. Recommendations

**Next 30 days**
1. Publish a licence.
2. Add Playwright smoke tests (Go Live, step, Hide all, phone remote) to CI.
3. ~~Pin dependency versions for release builds~~ (done: `packaging/constraints.txt`); update GitHub Actions versions.

**Next quarter**
1. Song and lyrics library (sections, arrangement, CCLI number field).
2. Code-sign the installer.
3. Split `server.py` into modules (routes, state, remote, media, scripture).
4. First-run tour and shortcut overlay.

**Later**
1. Stage display for musicians (builds on Speaker View).
2. Shared media library across meetings.
3. Localization.

See [../../ROADMAP.md](../../ROADMAP.md).
