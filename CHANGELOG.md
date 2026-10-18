# Changelog

All notable changes to Kingdom Connect are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions are numbered **major.minor** (see
[docs/development/changelog-standards.md](docs/development/changelog-standards.md)). Each version links to its full
release notes in [`docs/releases/`](docs/releases/). Dates are the dates of the release commits.

Versions before 4.9 (when the product was called BSF Command Center, then BCC) are described in the engineering log,
[docs/architecture/design-history.md](docs/architecture/design-history.md).

## [Unreleased]

### Added
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
- Repository organization: earlier guides moved to `docs/reference/`, the engineering log to
  `docs/architecture/design-history.md`, the installer build guide to `docs/development/building-the-installer.md`,
  and tests to `tests/`. Program code and the installer are unchanged.
- Installer builds use the exact package versions of the last good build (`packaging/constraints.txt`), so every
  build of the same code produces the same app.
- The scripture message for non-ESV translations no longer mentions the Excel import removed in 6.6.

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
- New name: **Kingdom Connect** (formerly BSF Command Center / BCC), with a navy and gold design in dark and light
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
