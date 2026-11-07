# Changelog

All notable changes to FrameDecks are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are **YY.MM**, the year and the month of the
release (26.11 is November 2026), with .1, .2 for further releases in the same month (see
[docs/development/changelog-standards.md](development/changelog-standards.md)). Each version links to its full
release notes in [`docs/releases/`](releases/). Dates are the dates of the release commits.

Changes before 26.11 are kept in [docs/archive/changelog-before-26.11.md](archive/changelog-before-26.11.md).

## [Unreleased]

## [26.11.6] - 2026-11-07

Full notes: [docs/releases/v26.11.6.md](releases/v26.11.6.md).

### Fixed
- **The Command Center's grey box** (owner's photo, a real PC after 26.11.5): Windows still drew the whole
  see-through window as a grey rectangle on some PCs. The window is now cut to the shape of what the page paints:
  `app/js/cc-shape.js` measures every painted box (outermost only, cut to clipping parents, full-window backdrops
  never count; while things move the union of before and after, exact within 0.8 s) and posts it as
  `op: "clip"`; `desktop_app` hands it to `desktop_win.clip`, which builds rounded-rect regions
  (`shape_boxes`, at most 48) and calls `SetWindowRgn`. Outside the shape there is no window, so nothing can be
  painted there and clicks reach the window behind. Tests `tests/test_cc_shape_2611_6.py`.

## [26.11.5] - 2026-11-07

Full notes: [docs/releases/v26.11.5.md](releases/v26.11.5.md).

### Changed
- **Floating controls** (owner's request): in the Command Center each chip's panel is the one glass surface and
  nothing inside it has an outline or card (`.cc-t`, `.cc-switch`, the remote's `.spr-*` in the 26.11.5 block at the
  end of `app/css/spotlight.css`). A soft fill shows on hover and press; colour only for meaning (Go Live on air,
  Next Frame gold, Hide all red, a tool that is on); groups by space and one hairline (`.spr-step`, `.spr-mt`).
- The phone remote the same way (26.11.5 block in `app/css/remote.css`): `.card`, `.tool`, Previous and the list rows
  lose their outlines and fills; fields, the top bar, the tab bar and Memory Card messages keep theirs.
- What's new for 26.11.5; the guide's and website's pictures of the Command Center and the phone remote recaptured.

## [26.11.4] - 2026-11-06

Full notes: [docs/releases/v26.11.4.md](releases/v26.11.4.md).

### Added
- **Error codes** (`app/js/help-codes.js`, the only list; the website gets a copy in `hosted/content/help-codes.json`):
  every connection problem has a short code (FD-REM, FD-NET, FD-CLD) shown on the PC, the phone and the website, each
  with what happened, why and the one fix; framedecks.com/help?code=… opens it.
- **Check my connection** (Settings → Phone & iPad Remote): every step from the PC to the phone in order (remote on,
  on a network, listening, Private network, firewall permission, more than one address, the phone arriving), each
  ticked, the first problem with its code and one button that fixes it (turn on, restart the remote, open Wi-Fi or
  network settings, allow through the firewall with Windows asking first). The last step stays open and turns green
  when the phone arrives. Only two Windows settings pages can be opened (`server.SETTINGS_PAGES`).
- The phone remote's **Test connection** (three round trips to the PC, the middle one shown) and codes on its
  messages; linking a PC on the website now waits for the PC to confirm before it says done (FD-CLD-03).
- **"?" Help links** next to the places people get stuck (Phone & iPad Remote, its Fix the connection, FrameDecks vCam,
  Capture Memory, Workspace Sync, Follow my voice): each opens that part of the guide on framedecks.com. One list
  (`LINKS` in `app/js/help-codes.js`), and `tests/test_help_2611_4.py` checks every page and heading exists.
- **Help search** on the Help Center (`lib/help-search.ts`, `lib/help-index.ts`): one box across the Help topics, every
  guide page and section, the step-by-step guide and the error codes, scored in the browser (an exact error code
  first; nothing is sent anywhere). A new **Error codes** topic lists every code; `help?code=FD-NET-02` opens and
  lights that one.
- **Keys on one page** (`app/js/keys.js`, the keys that work anywhere and in the Command Center, each checked against
  the code that answers it): press **?** in the Command Center (or More → Shortcuts) for a Keys sheet; Settings →
  Keyboard shortcuts now lists them above the Studio's own keys; the website's Help search finds them too
  (`content/help-keys.json`).
- **What's new** (`app/js/whats-new.js`): after an update, one small card with the release's three changes, each with
  **Show me** (it opens the place and outlines it for a moment). Once per version, only for someone who used an
  earlier one, never while live.
- **Short clips** in the Help Center, recorded from the real program by `tools/make_help_clips.py` (Go Live,
  Spotlight, Memory Cards, Check my connection, the phone remote): looping animated WebP, a still for less motion
  (the system setting or Reduce effects), loaded only when scrolled near.
- **Was this helpful?** under every Help topic and guide page (`components/help-vote.tsx`). Only the article and the
  vote are kept (migration `0017_help_votes.sql`: no person, no address; anyone may vote through `help_vote()`, nobody
  reads the table from the website). A "No" offers to say what was missing. **Owner: run 0017 in Supabase.**
- **Send a report to support** (Settings → Diagnostics, and from a failed connection check): the report in full first
  (version, setup, the connection check's codes, recent problems; no PIN, keys, paths, plan or members) with a
  reference number, then Email support (`mailto`, nothing sent before), Copy report or Save support bundle.
- **Ask Help** on framedecks.com/help (`components/help-bot.tsx`): choose a problem and go through it one question at a
  time (phone, FrameDecks vCam, something wrong on screen, website and PC out of step, installing, an error code), or
  type a question or a code; answers come from the Help Center's own pages (no AI, nothing sent). The phone remote
  links to it.

### Changed
- New front-page chapter, Memory Cards (owner's request), between Engage and Control: with Capture on, three chat
  messages are copied (Ctrl+C) one after another as the page scrolls; each copied card arcs onto the FrameDecks vCam
  picture and pops up as a bubble in the program's own overlay style, in copy order, while the presenter moves aside
  to make room; the prayer request is then pinned in gold. Drawn live like the Teleprompter chapter.
- The front page's opening reads as one page (owner's request): the finished flowchart stays 5 s before the Studio
  takes over, the Studio has no box (its edges fade into the page), and scrolling carries each screen in as the last
  one rises away (`tour.tsx` sets their place each frame, `MIX` / `RISE`) instead of swapping pictures sideways.
  Scrolling on before the build has finished completes it at once. Reduced motion and Reduce effects keep the plain
  chapter changes.

### Fixed
- The front page's Command Center pictures are now `cc-bar.webp` and `cc-control.webp`: browsers and Cloudflare
  kept serving the old `command-center*.webp` (with the coloured desktop behind them) under the same names, so the
  see-through pictures never showed. New names make every cache fetch them.

## [26.11.3] - 2026-11-06

Full notes: [docs/releases/v26.11.3.md](releases/v26.11.3.md).

### Fixed
- The Command Center showed a black box behind its glass bar and chips over the desktop (plain to see with the
  program in the tray, hidden against the dark Studio). pywebview makes a hidden window by setting its opacity to 0
  and back to 1, which leaves it a layered window, and Windows draws a layered window at one opacity for the whole
  box, so the black form behind the page (`desktop_win.clear_back`) stayed black. `desktop_win.unlayer` takes the
  layered style off (and `clear_back` sets `AllowTransparency = False`) before the glass is set up and on every open;
  `tests/test_command_center_99.py` (`SeeThrough`) holds the order.

### Changed
- Website front page rebuilt around one pinned stage (`hosted/src/components/landing/tour.tsx`, `app/tour.css`): on
  arrival a meeting builds itself (Frame, Decks, Content in the app's level colours) and flies into the real Studio
  screenshot; scrolling then moves through real screenshots of the Command Center, the Teleprompter, Spotlight, the
  live Control chip and the phone remote, each with the app's own keys (Alt+Space, R, V, Ctrl twice, Alt+D, T, Alt+→,
  Alt+H, Alt+B). The old hero, How it works / See it work showcase, drawn previews and press-Next demo are gone, with
  their styles (home page CSS 23.9 → 21.3 KB). `tools/make_product_shots.py` also writes `teleprompter.webp` and
  `phone-remote.webp`; `hosted/tests/motion-rules.test.mjs` now holds tour.css to the same motion rules.
- The front page's Teleprompter chapter is live again (owner's choice): drawn in the program's own Teleprompter style
  (the gold reading band, read words at half strength), it follows the page's scroll word by word as Follow my voice
  follows the presenter; the other chapters stay real screenshots (`teleprompter.webp` and its capture removed).
- Every chapter of the front page's stage now moves with the scroll, drawn over the real screenshots, never into
  them (`Scene.moves` / `ring` / `sweep` in `tour.tsx`): a gold ring walks the Command Center's chips (Prepare,
  Engage, Control); a pointer lands on the spotlit word, then a pen stroke runs along the real underline; the pointer
  switches Go Live on and presses Next Frame; a fingertip taps Next on the phone. Each press ripples once and lights
  its key below the picture (Ctrl twice, Alt+D, Alt+→).
- The website is dark until someone signs in, and its public pages (the front page, Help, Download, the legal pages)
  always: `layout.tsx` sets `html.fd-dark-only` before the first paint for a visitor who is not signed in and on the
  public paths, the public pages' bar (`landing/nav.tsx`) holds it and has no theme button, and Light, Dark and Auto
  live only in the signed-in workspace (`ThemeToggle` in `app-shell.tsx` clears it on arrival).
- The front page's Command Center pictures have nothing behind them (captured see-through, as the window is, by
  `command_center_web` in `tools/make_product_shots.py`), so the Command Center sits on the website's own background
  instead of a coloured desktop; the guide's pictures keep their desktop. After the Studio, each screen stands on the
  page alone.
- The front page's stage has no frame any more: the build, the Studio and each screen float on the page itself, each
  with its own soft shadow, in a soft light that takes the colour of the chapter (`.tr-glows`, one gradient per
  chapter, only its opacity changes).
- The front page's words sit centred above the stage again, as in the owner's mockup (no side column); the headline
  scales with the window's height so the whole stage and its chapter row fit on a laptop screen.
- The user guide's last hand-made pictures are now captured from the program too (`guide_more` in
  `tools/make_product_shots.py`): Annotate on the live picture, the command palette, and the phone remote upright and
  sideways while drawing; the front page's phone chapter follows the new remote picture.
- Help pictures recaptured from the current website and program (`tests/visual/help-shots.mjs`; the website half
  needs a build against the stand-in workspace: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=stub npm run build`).

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

