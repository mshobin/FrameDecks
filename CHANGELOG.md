# Changelog

All notable changes to FrameDecks (earlier: FrameDecks) are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions are numbered **major.minor** (see
[docs/development/changelog-standards.md](docs/development/changelog-standards.md)). Each version links to its full
release notes in [`docs/releases/`](docs/releases/). Dates are the dates of the release commits.

Versions before 4.9 (when the program had its earlier name) are described in the engineering log,
[docs/architecture/design-history.md](docs/architecture/design-history.md).

## [Unreleased]

### Added (SaaS + PWA, Phase 4: pairing)
- **Pair a phone or iPad** (Settings → Phone & iPad Remote → Control from anywhere): a QR code or 6-digit code (5
  minutes, once), the same six check digits on both screens, and Approve at the PC with a role. A paired phone opens
  the remote with no PIN. Guide: [docs/remote-anywhere.md](docs/remote-anywhere.md).
  - Everything a paired phone and the PC send each other is sealed end to end (X25519, AES-GCM); the cloud cannot
    read it, and replayed or reordered messages are refused.
  - Trusted devices: Viewer (changes nothing), Operator, Presenter, Administrator; Revoke cuts a phone off within a
    second. The PC has the final say on every role.
  - Since Phase 4 the remote from anywhere needs a paired phone; the Wi-Fi remote and its PIN are unchanged.
- The cloud: pairing, devices, device credentials, revoke closing the phone's connection
  ([docs/architecture/pairing-protocol.md](docs/architecture/pairing-protocol.md)). The Windows build adds the
  `cryptography` package.

### Added (SaaS + PWA, Phase 3: the remote from anywhere)
- **Control from anywhere (optional):** Settings → Phone & iPad Remote. The phone or iPad remote reaches the PC
  through the FrameDecks account when it is not on the same Wi-Fi. Same remote, same PIN. Guide:
  [docs/remote-anywhere.md](docs/remote-anywhere.md).
  - Off until switched on at the PC. The PC connects outward (no port, no router change), and through it a phone is
    exactly a phone on the Wi-Fi: PIN needed, members data and the Studio never reachable.
  - The remote installs as an app (Add to Home Screen, Install) and opens offline.
- The cloud relay (one per PC, stores nothing), tickets, the list of PCs and CORS; the remote published to Cloudflare
  Pages unchanged (`tools/build_pwa.py`, `.github/workflows/pages.yml`). Contract:
  [docs/architecture/relay-protocol.md](docs/architecture/relay-protocol.md).
- `tools/relay_e2e.py`: the real cloud, the program and the published remote: identical pictures and answers
  through the relay, and a press on the phone reaches the PC.
- The PC's name in the account follows Settings (a computer may rename itself).

### Added (SaaS + PWA, Phase 2: accounts and sync)
- **FrameDecks account (optional):** Settings → FrameDecks account. Sign in with an email code, or with Google,
  Microsoft or Apple in the browser, to keep Frames (with their Decks and Content), templates, saved lists, branding
  and card looks the same on every computer. Guide: [docs/account.md](docs/account.md).
  - Saved on this computer first, as always; sync follows a few seconds later and checks every minute. Presenting
    never waits for it, and going live or stepping is never sent.
  - No Frame is ever lost: a Frame changed on two computers keeps both versions ("‹Frame› (from ‹computer›)").
  - Meeting details sync only when "Sync meeting details" is on.
  - The members list syncs only when turned on, end-to-end encrypted with a printable recovery key; the cloud stores
    only the locked copy. Changed on two computers, the lists are combined person by person.
  - Download a copy of your account, or delete it, from Settings.
  - The Mac and desktop app (Flutter) syncs the same way: Settings → FrameDecks account, the same rules
    (`framedecks_app/lib/engine/cloud_sync.dart`), its sign-in in the system keychain.
  - A new computer joining the account does not double Frames the account already has (such as the starter Frames).
  - The sign-in is kept in Windows Credential Manager (`cloud_link.py`); the Studio does the sync
    (`app/js/cloud-sync.js`).
- **The cloud** (`cloud/`): email-code and Google / Microsoft / Apple sign-in, rotating sign-in tokens, your account,
  export and delete, computers, the audit log, and sync with conflict detection
  ([docs/architecture/cloud-api.md](docs/architecture/cloud-api.md)).
- `tools/cloud_e2e.py`: the real cloud (`wrangler dev`) and two copies of the program, syncing both ways, a conflict
  included.

### Added (SaaS + PWA, Phase 1: Foundation; nothing changes for users yet)
- **The runtime protocol**, `docs/architecture/runtime-protocol.md`: the `api/*` contract that the remote, the Flutter
  app and the coming cloud relay follow, Deck fields included.
- **Sync entities:** `app/js/entities.js` and `framedecks_app/lib/engine/entities.dart` split the saved document into the
  records the cloud will store and join them back exactly.
  - Each Frame (with its Decks and Content) is one record; the running order, the card looks and the settings are
    their own records.
  - What is live and what the cards show at the moment never leave the computer.
  - Shared fixtures (`tests/fixtures/entities/`, `tools/make_entity_fixtures.js`) keep the two engines identical.
- **One transport seam:** every request of `store.js` and `remote.js` goes through `KCTransport.fetch` (the browser's
  `fetch` today, the cloud relay from Phase 3). `tools/remote_screens.py` proves the remote looks the same before and
  after, and through a loopback relay.
- **The cloud skeleton**, `cloud/`: a Cloudflare Worker (`framedecks-api`) with `GET /v1/health`, the D1 schema
  (`migrations/0001_init.sql`), tests, and CI that deploys to staging only when the Cloudflare secrets are set.
- **CI:** `app-tests.yml` runs the JavaScript and Python tests and the remote check on every push and pull request;
  `cloud.yml` tests the Worker.

### Changed
- **The program is now FrameDecks** — *Present • Equip • Inspire*. Every name people read is updated: window titles,
  the About page, the sign-in screens, messages, the installer, the store and web metadata (including Open Graph), and
  the documentation.
  - A new logo system replaces every icon, favicon, launcher icon and splash. It comes in horizontal, stacked and
    icon-only versions, each for light and dark backgrounds, plus Teams, Zoom and marketing pictures. All are drawn by
    `tools/make_brand_assets.py`. Guide: [docs/brand/framedecks-brand-guide.md](docs/brand/framedecks-brand-guide.md).
  - Every internal name is FrameDecks too: the program (**FrameDecks.exe** in `%LOCALAPPDATA%\Programs\FrameDecks`),
    the installer (`FrameDecks v<version>.exe`), the data and recordings folders, the firewall rule, the start files,
    the Meeting Workbook and downloads, and the Flutter app (`framedecks_app`, IDs `org.framedecks.framedecks`).
  - The virtual camera is now **FrameCast**. It keeps its camera ID, so Zoom, Teams and OBS keep the device and show the
    new name.
  - Updating keeps everything: data and recordings move to the new folders on first start (`legacy.py`), the installer
    removes the earlier program folder and shortcuts, and the old firewall rule is replaced when the phone remote is
    allowed again (Settings → Phone & iPad Remote).

### Added
- **Decks: Frame → Deck → Content.** A Frame now holds one or more Decks, and each Deck holds its Content. One Deck is
  on screen at a time; Next and Previous (PC, phone, Auto advance) step through the live Frame's Decks before moving to
  the next Frame.
  - The Content list groups Content under Deck headings: show a Deck now, rename, reorder, delete, **+ Deck**, **Move to
    Deck**. The phone shows "Deck 2 of 3 · name"; FrameCast shows the live Deck's camera and media; the Meeting Workbook
    has an optional **Deck** column.
  - Existing Frames get one Deck holding all their Content, so they look and work as before. A file saved now still
    opens in an earlier version (all of a Frame's Content as one list).
  - The Flutter app has the same Decks, checked against `store.js` with parity tests.
- **FrameDecks for every platform (Flutter)** in `framedecks_app/`: a native rebuild of the Windows app
  with the same design, Frames and saved file.
  - Windows, macOS and Linux get the Studio (top bar, Frames, Content, canvas, inspector, Settings) and a
    full-screen Share Window.
  - iPhone, iPad and Android get the remote control for FrameDecks on the PC, signed in with its PIN.
  - Its engine is a port of `store.js`, checked against the JavaScript with parity tests.

  Plan and what still lives only in the Windows program:
  [docs/project/flutter-platform-plan.md](docs/project/flutter-platform-plan.md). CI:
  `.github/workflows/flutter-app.yml`.

## [6.9] - 2026-10-20

Full notes: [docs/releases/v6.9.md](docs/releases/v6.9.md)

### Added
- **Meeting Workbook with two tabs.**
  - **Dashboard**, made only of formulas: this meeting, KPI tiles, meeting counts from a log, readiness checks,
    quick links into the form and a content-mix chart.
  - **Meeting Form**, one guided page: meeting details, speaker, attendees, presentation, the Frames, Content,
    question and scripture tables, and additional notes. Spare rows fold away behind Excel's + button.
- `meeting_form.py` holds the form's layout. It also fills the form for **Export this meeting to Excel**, through
  `POST api/meeting/workbook`, so an export looks like the template.
- The import reads the form by its labels and header rows, so a hand-made form in the same style imports too.
- The meeting now stores time, location, speaker contact, expected attendees, attendee notes, presentation owner,
  content notes and additional notes.
- `legacy.py` moves data saved under the program's earlier name (tested by `tests/test_legacy.py`).
- `tests/test_meeting_form.py`.

### Changed
- The program now uses the FrameDecks name everywhere: the program (`FrameDecks.exe`), the program folder,
  the data folder (`%APPDATA%\FrameDecks`), the data files (`kc-*.json`), the start files, the recordings folder,
  the firewall rule and the Share Window title (*FrameDecks Share Window*). Default labels and the About text no
  longer mention the program's earlier name, and the default Group Name is empty.
- On first start, 6.9 moves data saved by earlier versions (folder, files, backups, recordings and browser settings)
  to the new names once, never overwriting newer data. The installer installs over every earlier version and removes
  the old program folder and shortcuts.
- **Hide All** and its **Esc** hint form one unit that never overlaps or clips. The top bar wraps under 1140 px, and
  the Program menu is always a drop-down.
- The import preview shows the meeting's date, time, location and speaker. Problems name the form section, for
  example *Meeting Form · Content · row 26*.

### Removed
- The search box in the top bar, with its shortcuts and code. The command palette and Spotlight cover search.
- **Presentation Mode**: its button, its **P** shortcut, its command and its state.
- The **Hide the app window** button in the Studio.
- The workbook's Read Me and Lists sheets, and the one-sheet-per-list layout. Older workbooks still import.
- The unused rail toggle code and styles.
- `docs/reference/legacy-manual-v4.6.txt`.

### Fixed
- The Teleprompter overlay and the other frameless windows can be moved and resized again (6.8).

## [6.8] - 2026-10-20

Full notes: [docs/releases/v6.8.md](docs/releases/v6.8.md) · Plan: [docs/project/v6.8-plan.md](docs/project/v6.8-plan.md)

### Added
- **Teleprompter overlay** (Meeting Leader mode, Shift+R): a see-through window over Zoom, Teams or Meet with five
  transparency modes (Solid, Presenter, Meeting, Conference, Ghost), frosted glass, stay on top, mirror, a floating
  toolbar that hides itself, and exclusion from screen sharing and recordings.
- **Modern window:** no Windows title bar; the app's ribbon moves and maximizes the window, with one shared set of
  window buttons (`app/js/window-chrome.js`) in every window. Snap and edge resizing keep working.
- **Minimize to tray** with *Hide application to system tray?* (Hide To Tray / Stay In Taskbar / Remember my choice);
  tray menu Open App, Teleprompter, Search, Settings, More, Exit.
- **Spotlight:** a system-wide shortcut (Alt+Space by default) opens the command palette in its own window, also from
  the tray; background-safe commands run without the main window; Frequently used items.
- Settings → General → **Window and tray**.
- `desktop_win.py` (Win32 via ctypes: window chrome, glass, fade, capture exclusion, global shortcuts) and
  `tests/test_desktop.py`, run in CI.

### Changed
- Teleprompter window: the script takes the full width; *On screen & next* slides in on request; floating toolbar.
- Teleprompter engine: optional floating toolbar, mirror mode, reading width that adapts to the text size.
- The README and release header picture is regenerated for 6.8; CI fails if it shows another version.

## [6.7] - 2026-10-19

Full notes: [docs/releases/v6.7.md](docs/releases/v6.7.md)

### Added
- **Teleprompter** (Program → Teleprompter, **R**): the Frame's script docked left, right or bottom of the Studio, or
  floating; auto and manual scrolling at five speeds, size, line spacing, contrast and Focus mode, cues for the next
  Frame and item, simple formatting. Never shown on any output. Also in its own window (**Program → Teleprompter
  window**, formerly Speaker View) and on the phone remote (full screen in the Simple remote).
- **Inline editing** of every Content on the Studio Canvas (body and label) and of Frame and Content names in the
  lists (double-click or F2); Enter saves, Esc cancels, clicking away saves.
- **Command palette** (Ctrl+K / Ctrl+Space, configurable): fuzzy search over Frames, Content, questions and
  scriptures, templates, the Content Library, branding, settings and members, recent items, and commands.
- **Multi-select** of Frames and Content (Ctrl/Shift+Click, box select) with delete (Undo), copy, cut, paste,
  duplicate and move; right-click menu.
- **Branding options:** Logo only / Name only / Logo + Name, four corners, Small / Medium / Large, opacity, padding,
  safe margin, background plate on or off. **Remove background** for logos, done locally, with Undo.
- Content presets **Discussion topic**, **Icebreaker** and **Poll**, also in the Content Library.
- Branded GitHub release pages, generated by `tools/make_release_notes.py` (the About screen's logo, name, tagline and
  motto, then What's New, Enhancements, Fixes, Performance Improvements and Known Issues).
- Tests: the Teleprompter script never reaches an output; script rendering is escaped; Branding defaults and ranges.
- A documentation suite for churches: getting started, installation, service planning, presentations, Frames,
  Content, media, remote control, troubleshooting, FAQ, architecture, and guides for each ministry role.
- Contributor documentation: developer guide, branching strategy, release process, changelog standards, testing
  and code style.
- GitHub issue forms (bug report, feature request, service-day problem) and a pull request template with a
  service-safety checklist.
- `ROADMAP.md`, `SECURITY.md`, `SUPPORT.md` and `CODE_OF_CONDUCT.md`.
- Automated store tests (Frame-owned lists, independent duplicates, conversion of older data, output folding) and a
  test runner, `node tests/run.js`, which the installer build now runs.

### Changed
- Inspector order: Label, Content, Display Settings, Visual Settings (then Animation and Show on).
- The Frame's **Leader notes** are its **Teleprompter script** (up to 20,000 characters).
- The Meeting Workbook has no Answer or Notes columns. Older workbooks still import; their answers and notes are added
  to the Frame's Teleprompter script.
- The Excel library loads on first use (main window: 10.8 → 4.0 MB JS heap, 1,590 → 742 KB of scripts).
- The header search opens the command palette.
- Repository organization: earlier guides moved to `docs/reference/`, the engineering log to
  `docs/architecture/design-history.md`, the installer build guide to `docs/development/building-the-installer.md`,
  and tests to `tests/`. Program code and the installer are unchanged.
- Installer builds use the exact package versions of the last good build (`packaging/constraints.txt`), so every
  build of the same code produces the same app.
- The scripture message for non-ESV translations no longer mentions the Excel import removed in 6.6.

### Removed
- Answers and presenter notes from every screen (main window, Teleprompter window, phone, Inspector). Stored data is
  kept.

### Fixed
- Typing in an editor no longer triggers Studio shortcuts.
- Double-clicking overlapping cards on the live picture edits the card in front.

## [6.6] - 2026-10-18

Full notes: [docs/releases/v6.6.md](docs/releases/v6.6.md)

### Added
- **Speaker View** (Program → Speaker View): a window only the leader sees, with the question or scripture on
  screen, its answer and notes, what comes next, Frame and meeting notes, the time, time on this Frame and a timer.
- **Edit on the canvas:** double-click a question or scripture card on the Studio Canvas to edit it in place.
- **Drag to reorder** questions and scriptures in a Frame's list.

### Changed
- The phone's drawing pad shows the real live picture (what Zoom and Teams see), 960 pixels wide while it is open,
  and fills the screen in landscape.
- Content Settings: where Content appears is set only in each Content's Behavior group (older Frame-wide settings
  carry over); "Show the title" sits under the title; Timer shows only the field for its mode; Branding position is
  in one place; the scripture fetch selector is now **Fetch from**.

### Removed
- The Excel import inside Question Content. Excel is used only through the Meeting Workbook.

### Fixed
- The phone's drawing pad no longer shows a black picture when the Frame contains camera, screen or PowerPoint
  Content.

## [6.5] - 2026-10-18

Full notes: [docs/releases/v6.5.md](docs/releases/v6.5.md)

### Added
- **Annotate (D):** pen, highlighter, arrow, line, rectangle, ellipse and text over everything on screen, with undo,
  redo and clear. **Freeze (F)** holds the picture.
- **PowerPoint Content:** a .pptx becomes slides through the installed PowerPoint; **Show objects only** removes a
  plain slide background.
- **Simple phone remote** (the new default) with very large Frame and Content buttons, Annotate, Freeze and Black
  Screen; the **Advanced** remote adds search, presenter notes and a run-through mode.
- **Excel Meeting Workbook:** a five-sheet template (Meeting Overview, Frames, Content, Questions, Scriptures) with
  import preview and export.
- SHA-256 checksum file published with each installer.

### Changed
- Scenes are now **Frames** and layers are now **Content** throughout the app.
- Every Frame owns its questions and scriptures; Duplicate makes a fully independent copy.
- **+ Frame** adds a blank Frame; **+ Content** lists Question, Scripture, Text, Image, Video, Timer, PowerPoint and
  Free Content.
- One **Content Settings** panel with groups replaces Basic / Advanced.

### Removed
- Team Space (co-leader collaboration over WireGuard).
- The pinned-question section.

## [6.4] - 2026-10-15

Full notes: [docs/releases/v6.4.md](docs/releases/v6.4.md)

### Added
- Team Space: co-leaders connected directly between PCs over WireGuard (removed again in 6.5).
- New guides: user, installation, configuration and feature documentation.

### Changed
- The camera is called **FrameCast** in Zoom, Teams, Google Meet and OBS (same device ID as before).
- The app shows only the Book + Candle logo as its branding.
- The installed app is a real desktop window: no address bar or browser controls, and the title bar follows the
  theme.

## [6.3] - 2026-10-15

Full notes: [docs/releases/v6.3.md](docs/releases/v6.3.md)

### Changed
- One command bar at the top replaces the top bar and the bottom live bar.
- Studio panels can be resized, folded and reset; sizes are remembered.
- Phone remote profiles: Simple, Standard and Advanced.

## [6.2] - 2026-10-13

Full notes: [docs/releases/v6.2.md](docs/releases/v6.2.md)

### Added
- **Meeting & Branding** settings: Meeting Name, organization name, logo and accent colour, shown only where you
  choose; `{meeting}` and `{org}` placeholders in text.
- One Excel file builds a whole meeting, with a preview listing each problem by row; export a meeting to Excel.

### Changed
- The live action is one clear **Go Live** button.

## [6.1] - 2026-10-13

Full notes: [docs/releases/v6.1.md](docs/releases/v6.1.md)

### Added
- **Quick Start** builds a complete set of scenes for a meeting; **Presentation Mode** (P); a built-in Content
  Library of ready-made scenes; Duplicate & edit question.

### Changed
- The program got its current name, **FrameDecks**, with a navy and gold design in dark and light
  themes, and a new About page.

## [6.0] - 2026-10-12

Full notes: [docs/releases/v6.0.md](docs/releases/v6.0.md)

### Added
- **Scenes · Layers · Canvas:** scenes with layers, smart duplicate, templates, version history and transitions.
- Scripture lookup from the ESV API (with a free key), with context, read aloud, recent and favourite references.
- Phone and tablet layouts of the remote with scenes, canvas and layers.

## [5.1] - 2026-10-12

Full notes: [docs/releases/v5.1.md](docs/releases/v5.1.md)

### Added
- Command Center layout: production panel, live outputs under the picture, an Inspector, and Take live (T).
- Mobile Director remote with a run sheet and tablet control surface.

### Changed
- Wider search (birthdays, scenes, slide decks, settings); faster stepping through long lists.

## [5.0] - 2026-10-11

Full notes: [docs/releases/v5.0.md](docs/releases/v5.0.md)

### Added
- Presentation modes **Question · Both · Verse**, including a `PresentationMode` column in Excel.

### Changed
- Simpler screens: one way to do each thing, one LIVE indicator, one status button, search with Ctrl+K.

## [4.9] - 2026-10-11

Full notes: [docs/releases/v4.9.md](docs/releases/v4.9.md)

### Added
- Studio workspace with Scenes and Layers, a control bar, and Dark / Light / Match Windows appearance.
- Natural background blur with fine control, alongside the Classic style.

### Changed
- Three tabs: Studio · Members · Settings.
- Much faster stepping through long question and verse lists.

[Unreleased]: docs/releases/
[6.6]: docs/releases/v6.6.md
[6.5]: docs/releases/v6.5.md
[6.4]: docs/releases/v6.4.md
[6.3]: docs/releases/v6.3.md
[6.2]: docs/releases/v6.2.md
[6.1]: docs/releases/v6.1.md
[6.0]: docs/releases/v6.0.md
[5.1]: docs/releases/v5.1.md
[5.0]: docs/releases/v5.0.md
[4.9]: docs/releases/v4.9.md
