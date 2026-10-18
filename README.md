<p align="center"><img src="assets/brand/kc-banner.svg" alt="Kingdom Connect — Connect. Present. Worship." width="620"></p>

# Kingdom Connect

**Connect. Present. Worship.**

A service presentation platform for churches and ministries. Plan each service as **Frames** — Welcome, Worship,
Scripture, Discussion, Prayer, Closing — fill them with questions, scriptures, text, timers, pictures, video and
PowerPoint, and present to the room, to Zoom / Teams / Google Meet and to your stream at the same time. Run it from
the PC, a phone or an iPad. It runs **entirely on your PC**: no accounts, no subscriptions, no cloud, no telemetry.
The only feature that ever goes online is the optional ESV scripture fetch.

> **Status: Kingdom Connect 6.6 is ready for teaching, Bible study, small-group and hybrid services, with documented
> gaps.** The biggest: no song / lyrics library yet (lyrics are shown as Text Content or a PowerPoint), an unsigned
> installer, no automated UI tests, and no published licence. See the
> [repository audit](docs/project/repository-audit.md) and the [roadmap](ROADMAP.md).

## What it does
- **Frames and Content**: one Frame per moment of the service; **+ Content** adds a Question, Scripture, Text,
  Image, Video, Timer, PowerPoint or Free Content (announcement, prayer, lower third, branding, camera, screen,
  window, shapes). Every Frame owns its Content, so duplicating last week's service never changes it
  ([FRAMES](docs/frames.md) · [CONTENT](docs/content.md)).
- **Presenting**: **Go Live** (T), Frame and item steppers, transitions and auto-advance, Hide all (Esc), Blackout
  (K), Emergency screen, Freeze (F) and Annotate (D) — pen, highlighter, arrow, shapes and text above everything
  ([PRESENTATIONS](docs/presentations.md)).
- **Questions and scriptures**: per-Frame lists with labels, answers and notes; Show question, scripture or both;
  drag to reorder; double-click a card on the canvas to edit it in place. ESV fetch online, or any translation
  typed for offline use.
- **Outputs**: the **KingdomConnect** virtual camera (your webcam with the Frame on top, background blur, Camera
  Looks) for Zoom, Teams, Google Meet and OBS; a full-screen **Presentation window** for a projector; transparent
  **overlay pages** for OBS ([MEDIA](docs/media.md)).
- **Media**: images, video (muted), PowerPoint (.pptx converted by the PowerPoint on the PC, or PDF), live window
  capture that keeps PowerPoint animations, screen capture, and *Show objects only* for plain slide backgrounds
  ([POWERPOINT](docs/reference/powerpoint.md)).
- **Phone remote**: a **Simple** remote with large PREVIOUS / NEXT FRAME and CONTENT, ANNOTATE, FREEZE and BLACK
  SCREEN buttons, and an **Advanced** remote with search, notes and run-through. PIN-protected, local network only;
  draw on the real live picture, full screen in landscape ([REMOTE_CONTROL](docs/remote-control.md)).
- **Speaker View**: a window only the leader sees — the answer, notes, what comes next, the time, time on this
  Frame and a timer.
- **Planning**: Quick Start, templates, groups, favourites, leader notes, and the five-sheet **Excel Meeting
  Workbook** with import preview, undo and export ([SERVICE_PLANNING](docs/service-planning.md)).
- **Data**: everything in one folder on the PC, saved atomically, with daily backups and Frame history.

## Install
See [INSTALLATION](docs/installation.md) and [GETTING_STARTED](docs/getting-started.md). In short: run
`Kingdom Connect v6.6.exe` (unsigned, so check it against its `.sha256` file first and choose **More info → Run
anyway** at the SmartScreen prompt), keep **Install the KingdomConnect camera** ticked, and allow the one
administrator prompt. Windows 10 or 11 (64-bit) is required. The installer comes from the **Build Windows
installer** workflow ([BUILDING_THE_INSTALLER](docs/development/building-the-installer.md)).

## Run, build, package (developers)
Prerequisites: Python 3.12 and Node.js (for the tests). There is no UI build step and there are no npm packages.
See [CONTRIBUTING](CONTRIBUTING.md) and the [developer guide](docs/contributing.md).

```powershell
python server.py                                    # run from source in your browser at http://localhost:8750
$env:BSF_VCAM_DEMO=1; python server.py --remote     # with a built-in test camera and the phone remote on
python -m pip install -r packaging/requirements-desktop.txt -c packaging/constraints.txt   # desktop + camera
python desktop_app.py                               # the desktop app window (WebView2)
node tests/run.js                                   # the automated tests
python packaging/check.py                           # start-up self-check
python tools/check_doc_links.py                     # every documentation link and anchor
build.bat                                           # local Windows build (CI is the usual way)
```

## Quality gates (`.github/workflows/build-windows.yml`)
| Gate | What it checks |
|---|---|
| camera build | Builds the KingdomConnect camera (softcam, 64- and 32-bit) and records SHA-256 hashes of the DLLs |
| self-check | `packaging/check.py`: the program starts, serves every page and script, camera name and ID match the build, blur model loads |
| tests | `node tests/run.js`: Frame-owned lists, independent duplicates, conversion of older data, output folding, Meeting Workbook template, import and export |
| doc-links | `tools/check_doc_links.py`: every relative link and heading anchor in the Markdown docs resolves |
| pinned packages | Builds install `packaging/constraints.txt`: the exact versions of the last good build |
| app folder | The built app contains its window, pages and camera driver |
| installer | Inno Setup builds `Kingdom Connect v<version>.exe` with a `.sha256` file |
| release | On a `v*` tag, publishes the installer and checksum with `docs/releases/v<version>.md` as the notes |

Not automated yet: UI end-to-end tests, the camera in a real Zoom / Teams call, and PowerPoint conversion on real
Office installs — these are covered by the manual [testing script](docs/development/testing.md) before each release.

## Documentation
| Topic | Documents |
|---|---|
| Using it | [GETTING_STARTED](docs/getting-started.md) · [INSTALLATION](docs/installation.md) · [SERVICE_PLANNING](docs/service-planning.md) · [PRESENTATIONS](docs/presentations.md) · [FRAMES](docs/frames.md) · [CONTENT](docs/content.md) · [MEDIA](docs/media.md) · [REMOTE_CONTROL](docs/remote-control.md) |
| Help | [TROUBLESHOOTING](docs/troubleshooting.md) · [FAQ](docs/faq.md) · [SUPPORT](SUPPORT.md) |
| Church teams | [OPERATIONS_HUB](docs/ministry/README.md) · [WORSHIP_LEADERS](docs/ministry/worship-leaders.md) · [MEDIA_TEAM](docs/ministry/media-team.md) · [SERVICE_OPERATORS](docs/ministry/service-operators.md) · [REMOTE_OPERATORS](docs/ministry/remote-operators.md) · [VOLUNTEERS](docs/ministry/volunteers.md) · [SERVICE_DAY_CHECKLIST](docs/ministry/service-day-checklist.md) |
| Architecture | [ARCHITECTURE](docs/architecture.md) (service flow, engine, remote, media, rendering, sync) · [DESIGN_HISTORY](docs/architecture/design-history.md) · [CONFIGURATION](docs/reference/configuration-guide.md) |
| Security | [SECURITY](SECURITY.md) · [Security boundaries](docs/architecture.md#security-boundaries) |
| Development | [CONTRIBUTING](CONTRIBUTING.md) · [DEVELOPER_GUIDE](docs/contributing.md) · [BRANCHING](docs/development/branching.md) · [RELEASE_PROCESS](docs/development/release-process.md) · [TESTING](docs/development/testing.md) · [CODE_STYLE](docs/development/code-style.md) |
| Quality | [REPOSITORY_AUDIT](docs/project/repository-audit.md) |
| Reference | [USER_GUIDE](docs/reference/user-guide.md) · [FEATURES](docs/reference/features.md) · [MEETING_WORKBOOK](docs/reference/meeting-workbook-and-branding.md) · [POWERPOINT](docs/reference/powerpoint.md) |
| Project | [ROADMAP](ROADMAP.md) · [CHANGELOG](CHANGELOG.md) · [RELEASE_NOTES](docs/releases/) · [DOCS_INDEX](docs/README.md) |

## Principles
Reliability over features. Volunteers over experts. Offline over online. Privacy over convenience. Honesty over
marketing. Nothing may put a live service at risk, and the screen must always be one key away from safe (Esc, K).
No feature, test result or screenshot in this repository is faked; where something isn't done or isn't verified,
the docs say so.

## License
No licence has been published yet; until one is, all rights are reserved by the author. Third-party components keep
their own licences: softcam (MIT), MediaPipe selfie segmentation model (Apache 2.0), SheetJS and Lucide icons (see
`app/vendor/`), EB Garamond and Source Sans 3 (SIL Open Font License).

<sub>Formerly **BSF Command Center**: the install folder, data folder and program file keep that name so every update
installs over the previous one and keeps each church's data.</sub>
