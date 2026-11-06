# Changelog

All notable changes to FrameDecks are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are **YY.MM**, the year and the month of the
release (26.11 is November 2026), with .1, .2 for further releases in the same month (see
[docs/development/changelog-standards.md](development/changelog-standards.md)). Each version links to its full
release notes in [`docs/releases/`](releases/). Dates are the dates of the release commits.

Changes before 26.11 are kept in [docs/archive/changelog-before-26.11.md](archive/changelog-before-26.11.md).

## [Unreleased]

## [26.11] - 2026-11-06

Full notes: [docs/releases/v26.11.md](releases/v26.11.md).

### Added
- **Follow my voice** in the Teleprompter (V): the script moves as you speak. The Vosk speech engine and its small
  English model run in their own process at below-normal priority (`src/voice_worker.py`), only while the mode is on
  and the Teleprompter is pinned, with a grammar of only the script's words; silence is skipped. `src/voice_follow.py`
  downloads the engine and model once (from downloads.framedecks.com/voice/, pinned by size and SHA-256 in
  `src/voice_files.json`), refuses to start below 350 MB of free memory, and stops when the Teleprompter stops asking.
  The matcher (`app/js/voice-follow.js`) moves forward only and holds still off script. `GET/POST /api/voice` are for
  this PC only; app settings `voiceMic` and `voiceSensitivity`.
- `.github/workflows/voice-files.yml`: checks the voice files, runs the real engine on spoken audio
  (`tools/voice_e2e.py`) and mirrors the files to R2.
- `.github/workflows/clean-up-history.yml`: run once by hand after this release, it removes every older GitHub
  Release, tag and workflow run (the latest run of each workflow stays) and the 4.9 to 9.13 installers in R2.

### Fixed
- The Studio's two preview frames (canvas and Up next) left their listener on the main window's state at every reload
  (`store.js` `shareParent`), keeping each old page in memory (about 0.3 MB per Frame chosen) and redrawing it on
  every change. A preview now unsubscribes on `pagehide`, and a listener whose page has gone removes itself.
  `tests/visual/perf-4gb.mjs` checks the whole program on a 4 GB PC (every window, tab and chip, leaks, the server).

### Changed
- Versions are YY.MM (`APP_VERSION = "26.11"`): compared as numbers padded to four parts (`updater.version_tuple`,
  `tools/make_release_manifest.py`), so every 9.x PC sees 26.11 as newer. The first YY.MM release starts a fresh
  release index: no manifest points at a 9.x installer.
- The release notes and changelog of 4.9 to 9.13.0 moved to `docs/releases/archive/release-notes-before-26.11.md`
  and `docs/archive/changelog-before-26.11.md`. The user guides no longer name earlier versions.

