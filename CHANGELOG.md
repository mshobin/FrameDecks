# Changelog

All notable changes to FRAMEDECKS and its predecessor names are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions are numbered **major.minor** (see
[docs/development/changelog-standards.md](docs/development/changelog-standards.md)). Each version links to its full
release notes in [`docs/releases/`](docs/releases/). Dates are the dates of the release commits.

Versions before 4.9 (when the program had its earlier name) are described in the engineering log,
[docs/architecture/design-history.md](docs/architecture/design-history.md).

## [Unreleased]

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
- The program now uses the Kingdom Connect name everywhere: the program (`Kingdom Connect.exe`), the program folder,
  the data folder (`%APPDATA%\Kingdom Connect`), the data files (`kc-*.json`), the start files, the recordings folder,
  the firewall rule and the Share Window title (*Kingdom Connect Share Window*). Default labels and the About text no
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
- The camera is called **KingdomConnect** in Zoom, Teams, Google Meet and OBS (same device ID as before).
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
- The program got its current name, **Kingdom Connect**, with a navy and gold design in dark and light
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
