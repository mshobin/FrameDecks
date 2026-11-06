# Changelog

All notable changes to FrameDecks are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are **YY.MM**, the year and the month of the
release (26.11 is November 2026), with .1, .2 for further releases in the same month (see
[docs/development/changelog-standards.md](development/changelog-standards.md)). Each version links to its full
release notes in [`docs/releases/`](releases/). Dates are the dates of the release commits.

Changes before 26.11 are kept in [docs/archive/changelog-before-26.11.md](archive/changelog-before-26.11.md).

## [Unreleased]

## [26.11.2] - 2026-11-06

Full notes: [docs/releases/v26.11.2.md](releases/v26.11.2.md).

### Changed
- The main window's top bar fits by measuring (`app/js/bar-fit.js`, `data-bar-fit` / `data-fit` levels 0 to 6 in
  `theme.css`) instead of fixed window widths: one row from 1280 px up, a planned second row below; the old
  `.cmdbar` breakpoints are gone. The Teleprompter's two bar rows use it too (`speaker.html`, `speaker.css`), with
  the window buttons kept on the first row.
- Follow my voice listens while the Teleprompter is pinned or the window in front (`speaker.js` `inFront`, focus and
  blur with a short wait; status `front` in `voice-follow.js`).
- The Vosk engine DLLs go into the installer (`build-windows.yml` "Put the speech engine in", `framedecks.spec`
  `voice_runtime`); `voice_follow.py` uses them when frozen and downloads only the model. The installed app starts
  its listening process at below-normal priority without `CREATE_NO_WINDOW`.

- The content area under the preview: the deck's label and add buttons in `#insp-tools` (title row), the label
  panels removed, questions as a card grid with a "type a new question" card, scripture fetch and passages side by
  side, birthday in three columns, the Frame form as name and settings beside the script (`.sc-main`, reading time),
  and folded settings sections as one row of buttons (`theme.css` 26.11.2 block). The Question / Both / Scripture
  switch is only on the Frame card.
- The preview and the list linked (`preview-edit.js`): a click on a card selects its Content and pings its item
  (`KCFrameLists.ping`); choosing an item outlines its card (`KCPreviewEdit.outline`); edits to words on screen are
  drafts (`KCEditable.float` `draft` / `saveText`: Enter twice or Update screen); a hint on the preview until used.

- Content polish: state colours and pills (`fl-pill`), corner toolbar (`fl-tools`), label chip and ⋯ menu
  (`pop()`), FLIP glide and sliding live light (`glide()`), fade-out remove, roomy cards (`roomy()`), settings buttons
  with values (`foldValues()`) opening as sheets (`.cs-sheet`), writing focus (`kc-writing`), scripture small caps.
- Command Center tab labelled Keep open / Pinned with a pin icon, a one-off nudge on first unfold (`command-center.js`
  `paintFold`, `spotlight.css`).
- Meeting Workbook: the plan is section 2 (`meeting_form.layout`), optional sections after it, a three-step intro,
  conditional formatting by Level (`make_meeting_workbook.py`).
- Website and guide pictures from the new Studio (`tools/make_product_shots.py` also writes the guide's studio.png and
  canvas-edit.png); `tests/visual/help-shots.mjs` gains `ONLY=pc` (the website half no longer reaches its pages).
- Website "See it work" tabs lead with what sets FrameDecks apart: Phone remote, Follow my voice ("Following your
  voice" in the preview), Point it out (`annotate.webp`) and Command Center (`command-center-live.webp`), pictures
  from `make_product_shots.py` (`annotate()`, `web_copies()`), chosen by tab id in `feature-tabs.tsx`.

### Added
- A Microsoft Defender scan of the program folder and the installer in `build-windows.yml`; the release stops if
  anything is flagged.
- `tests/test_bar_fit_2611_2.py`; bar checks for both windows in `tests/visual/layout.mjs`.

### Fixed
- The top bar overflowing when maximized (sideways scroll, empty strip under Hide all) and wrapping the window buttons
  onto their own row.
- The Command Center showing an empty 820 x 720 box before its bar on first open: the window is made off-screen and
  see-through from its first paint (`spotlight.html?glass=1`).
- The Frame form hidden after selecting a Content whose "Show on" section was folded: `#ip-gen` kept `cs-closed`.

## [26.11.1] - 2026-11-06

Full notes: [docs/releases/v26.11.1.md](releases/v26.11.1.md).

### Added
- Motion for the main window (`app/js/motion.js`, `app/css/motion.css`): the Go Live moment (button sweep, canvas ring,
  LIVE pill drop, Up next lift), the canvas sliding on Frame choice (`kc-frame-select` from `workspace.js`), reordered
  Frames gliding (FLIP on `#scene-list`), press feedback, chip panels in and out (`chip-bar.js`), the undo timer
  (`toastAction`), the status pill's states and cross-fade (`dashboard.js`), teaching empty Frames and Decks lists,
  sliding Settings switches, and the Welcome closing into the Studio.
- Follow my voice's reading band (`voice-follow.js`, `speaker.css`), the Teleprompter's script rising in on a new
  Frame (`teleprompter.js`), new Memory Cards and notes animated once (`memory.js`, `notes-pad.js`), finished Setup
  guide steps (`guide.js`), and on the phone remote a swipe for Next / Previous and chip panels sliding in
  (`remote.js`, `remote.css`).
- `tests/test_motion_2611_1.py`: only transform, opacity and a stroke drawing animate; nothing loops while idle;
  reduce motion turns everything off. The 4 GB check is unchanged.

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

