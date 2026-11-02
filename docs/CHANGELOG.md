# Changelog

All notable changes to FrameDecks and its predecessor names are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions are numbered **major.minor** (see
[docs/development/changelog-standards.md](development/changelog-standards.md)). Each version links to its full
release notes in [`docs/releases/`](releases/). Dates are the dates of the release commits.

Versions before 4.9 (when the program had its earlier name) are described in the engineering log,
[docs/architecture/design-history.md](architecture/design-history.md).

## [Unreleased]

### Added
- The program can take commands from the FrameDecks companion (Next/Previous Frame, Go Live, Hide all, black screen,
  question, scripture) and run them exactly as the keys do, showing "‹action› · from ‹person›" on the PC. Off by
  default and only for a linked PC: Settings → FrameDecks account → "Allow control from the companion", with the
  last ten actions. The Wi-Fi phone remote is unchanged.
- Companion: **Live** page to run a service from a phone (Previous / Next, Go Live on any Frame, Hide all, Black
  screen, question and scripture, the Teleprompter script, whether the PC is online), and a "Can run services"
  checkbox for members. Needs `0004_remote.sql` and `0005_remote_live.sql` run in Supabase.
- Settings → **FrameDecks account**: link this PC to a workspace in the FrameDecks companion with a short code, and
  its service plans, Teleprompter scripts and member list sync in the background (pictures, videos, what is live and
  the phone remote PIN stay on the PC). Optional and off until linked; services always run from the PC, online or
  not.
- Companion: **History** on each Frame of the Services page (the last 30 days: who changed what, and when). Owners and
  admins can restore an earlier version, and bring back a Frame deleted in the last 30 days.
- Companion: owners and admins can **edit services** on the Services page: a Frame's name, group, Teleprompter
  script, questions and scripture, and the order of Frames. The service PC picks changes up within about a minute; a
  Frame that is on screen is changed only when it leaves the screen; if the PC changed the same Frame meanwhile, the
  companion shows the latest version with your changes kept and asks you to save again.
- Companion: **Services** (the synced plan, view only: Frames, Content, scripts; pictures and videos named, never
  uploaded), **Members** (owners and admins only) and **Computers** (link a PC with its code, see and disconnect
  linked PCs). Needs `0003_sync.sql` run in Supabase; until then the pages say so.
- Hosted companion: sign-in with an emailed link (and Google or Microsoft once they are switched on in Supabase),
  a sign-in return page and a top-bar account button. The desktop app is unchanged.
- Hosted companion: signed-in people can set a display name and create their church's workspace (they become its
  owner) and see the workspaces they belong to, with their role.
- Hosted companion: workspace members and invitations. Owners and admins invite people by email (as Member or
  Admin); the invited person sees "You're invited" after signing in and joins with one click. Needs
  `hosted/supabase/migrations/0002_invitations.sql` run in Supabase.

### Changed
- Updated the FrameDecks logo and tagline across the desktop app, phone remote, PWA icons, favicons, workbook,
  Windows installer, and marketing header. Presentation workflows are unchanged.
- The favicons, the tray icon and the small program-icon sizes (16–32 px) use a heavier version of the emblem, so it
  stays visible on light browser tabs and a light taskbar. Larger sizes are unchanged.

## [8.4.0] - 2026-11-02

Full notes: [docs/releases/v8.4.0.md](releases/v8.4.0.md).

### Added
- .frame import check: files declare `integrity` (Frames, Content, items, files used, files included) and are refused
  when it does not match; after an import, `verify()` compares every Frame and the meeting with the file and the PC
  names missing media (`app/js/frame-file.js`, `hosted/src/lib/frame-file.ts`).
- **Use this plan** as the main import action; a PC's export carries its Teleprompter and Spotlight settings.
- **Resync Linked PCs**: `api/sync` action `resync` runs a round now and answers complete / nochange / failed
  (`cloud_sync.resync`); in the Sync chip's panel, Settings → FrameDecks account and the command palette.
- Help: a step-by-step guide (`hosted/src/lib/help-guide.ts`, `components/help-guide.tsx`) with screenshots made by
  `tests/visual/help-shots.mjs`, kept true by `hosted/tests/help-guide.test.mjs`; Settings → Help → Step-by-step guide.
- `tests/visual/frame-roundtrip.mjs`: website → .frame → program, compared field by field.

### Changed
- Website Meeting Details: Meeting name, Date and Meeting notes; older fields are kept in the record.
- Website CSS per page: `landing-page.css` and `plan.css` load only on their pages; the budget measures the heaviest
  page (24 KB).

### Fixed
- Website plans imported on the PC looked different: the default added the Frames after the PC's own and dropped
  the meeting's date and notes.

## [8.3.0] - 2026-11-02

Full notes: [docs/releases/v8.3.0.md](releases/v8.3.0.md).

### Added
- Website Plan: five guided steps (`hosted/src/lib/frame-flow.ts`, `components/frame-flow.tsx`) with Edit details,
  Add Frame, Write Script, Preview and Export for Service PC, and the Sync status (`watchSync` in `workspace-sync.ts`).
- A drag-and-drop timeline of the Frames (Alt + arrow keys too); the order is saved with `moveFrameTo`.
- Preview of each Frame with its transition and script; Choose Animation as buttons.
- Media chosen on the website is kept in the browser (IndexedDB, `local-media.ts`) and embedded in the .frame file.
- `tests/visual/plan-flow.mjs`: the workflow in a browser against a stand-in workspace, with axe.

### Changed
- Transition style descriptions: Fade, Slow fade, Gentle fade.

### Removed
- About 6 KB of unused website CSS from earlier designs.

## [8.2.0] - 2026-11-02

Full notes: [docs/releases/v8.2.0.md](releases/v8.2.0.md).

### Added
- Teleprompter: **⇪ Upload** (.txt, .md, .docx) and a script mode, **Each Frame** or **Whole meeting**
  (`meeting.script`, `meeting.scriptMode`).
- Annotate → **Spotlight** (S, or Ctrl twice): a glowing circle around the word under the pointer (`live.spot`), drawn
  by FrameRelay (`src/vcam/spotlight.py`) and the overlay pages.
- **Burst** transition (`src/vcam/burst.py`, overlay canvas), with dust, direction, colour and strength (`fx.burst`).
- **.frame files** ([docs/reference/frame-file.md](reference/frame-file.md)): Export for Service PC on the website;
  Import / Export Frame File on the PC (Settings → Data / Backup, command palette). Local-only `GET /api/media/file`.
- Header **Sync** chip and Settings wording: Synced, Syncing, Offline, Sync failed (`api/sync` `phase`).

### Changed
- Every Teleprompter control is in its folding top bar, with **Next Frame**; the script area holds only the text, at
  full width.
- Transitions are one per effect: Cut, Fade, Dip to Black, Dip to White, Blur Fade, Zoom, Slide, Push, Wipe, Burst.
  Dissolve, Cinema and Church become Fade, Slide Right becomes Slide, Soft Scale becomes Zoom (on load, on the
  website and in the Meeting Workbook).

## [8.1.0] - 2026-11-01

Full notes: [docs/releases/v8.1.0.md](releases/v8.1.0.md).

### Added
- Teleprompter: **transparency** (Solid, 20%, 40%, 65%, 85%) and **Pin** (stay on top) in its top bar, remembered.
- **Looks**: Settings → Meeting & Branding → Look, the six looks of framedecks.com or "Same as my workspace", with
  Dark / Light / Match Windows; "Look: …" commands in the command palette.

### Changed
- Content settings are one view: the Content first, then Position and size, Look, Animation and Show on, each
  opening on a click (remembered). The Label / Content / Display Settings / Visual Settings tabs are gone.
- The desktop window is restyled to match framedecks.com (static, no extra resource use).
- Settings → General is "Window, tray and performance"; the Look moved to Meeting & Branding.

### Removed
- "Your details & email wording" in Settings → General.

### Fixed
- The About header image (README and release notes) was captured with the Setup guide in front of it;
  `tools/make_readme_header.py` now clears overlays first.

## [8.0.0] - 2026-11-01

Full notes: [docs/releases/v8.0.0.md](releases/v8.0.0.md). A major version: several features were removed to make
FrameDecks simpler. Saved meetings, settings and Setup guide progress carry over.

### Added
- **The Setup guide is a step-by-step wizard**: one step at a time with a progress bar, Back and Next (Next waits until
  the step is really done), "Do this later", and "Something not working?" tips for each step. The Ready step lists
  every check with a button to fix what needs attention.
- **The phone remote is one view**: the live picture, Previous / Next, the Frame's questions, scriptures or slides,
  Teleprompter, Draw, Freeze, Black screen and every Frame as a tappable card, with Hide all at the top.
- FrameRelay **Diagnostics** starts with a one-line answer ("Everything looks normal", or what to try).

### Changed
- **One Teleprompter**: a window above Zoom and Teams, kept out of screen sharing and recordings, with a top bar
  (time, current Frame, timer) that appears at the top edge or from its button. Live tools → Teleprompter, or R.
- **Frames are compact cards**; the right-click menu has one **Duplicate Frame** (Ctrl+D). The selected Frame shows
  name, Teleprompter script, auto-advance and Duplicate; everything else is under **Advanced**.
- The section under the Frames is called **Decks**.
- FrameRelay **Picture quality** uses plain words in three groups (quick setting, light and colour, more webcam
  options); the technical numbers are under Diagnostics → Technical details.
- The Setup guide has six steps; Your phone as a remote is optional.

### Removed
- The docked Teleprompter (left, right, bottom, floating), the see-through Teleprompter overlay with its transparency
  modes and settings (Settings → General), the Teleprompter window's side panel, and Shift+R.
- The **Run** view (Prepare / Run switch, Up next, Before you start): the Studio is the one view.
- **Practice mode** and the Setup guide's Rehearse step.
- The Discussion topic, Icebreaker and Poll ready-made Content and Library entries.
- The other Duplicate choices (with options, as template, structure only, variant, to group, & edit question).
- Phone remote: the Simple / Advanced layouts, tabs, Frame search, Content list, transition picker, Run-through,
  Emergency button and the Frame actions sheet.

## [7.1.2] - 2026-11-01

Full notes: [docs/releases/v7.1.2.md](releases/v7.1.2.md). The program is unchanged from 7.1.1; this hardens
publishing (the 1 November release audit).

### Fixed
- **A tag could publish another version, or an old one.** The `build` job now stops when the tag is not `v` +
  `APP_VERSION`, or when a release is started by a manual run instead of a pushed tag.
- **Version tags could publish at the same time** and race on `releases/index.json` and `latest.json`:
  `concurrency: publish-releases` runs them one at a time.
- **The release list was read from the cached public address, and any error turned into an empty list**; a
  published version could also be uploaded again over its year-long cached installer. The `publish` job now reads
  `releases/index.json` from R2 with `aws s3api head-object`/`s3 cp`, fails on anything but "not there yet", and
  refuses a version whose `releases/<v>/manifest.json` already exists.
- **"latest" could move backwards, and `previous` followed upload order.** `tools/make_release_manifest.py` refuses a
  version older than one already published, takes `previous` as the next lower version, sorts the index newest first,
  and stops on an unreadable index.

- **A tag run without the R2 settings showed green** while publishing nothing: it now fails with an error.
- The AWS CLI sends integrity checksums only when an operation requires one
  (`AWS_REQUEST_CHECKSUM_CALCULATION`/`AWS_RESPONSE_CHECKSUM_VALIDATION: when_required`); R2 has rejected the newer
  default ones.

### Changed
- `infra/update-api/local-test.sh` runs the workflow's own read and upload steps against the local bucket, checks
  that republishing and an older version are refused with nothing changed, and guards its removals (`${W:?}`).
- `tests/test_release_manifest.py`: the refusals, the ordering, and the workflow guards.

## [7.1.1] - 2026-10-31

Full notes: [docs/releases/v7.1.1.md](releases/v7.1.1.md)

### Fixed
- Microsoft Defender quarantined `FRAMEDECKS.exe` 7.1 as `Trojan` ("executes commands from an attacker"): an unsigned
  program that kept starting hidden PowerShell (the phone remote's network check every 15 minutes, an encoded command
  for the firewall rule, a camera install through `Start-Process -Verb RunAs`, an update script with a bypassed script
  policy) plus `netsh` and `taskkill`. All of it now goes through `src/winapi.py`: ShellExecuteEx "runas" for
  administrator prompts, Toolhelp + TerminateProcess for a stuck copy, the Network List Manager and
  `HNetCfg.FwPolicy2` (comtypes) for the network type and firewall rule, WinVerifyTrust for signatures. The firewall
  rule is added by `FRAMEDECKS.exe --firewall allow|undo` run with administrator rights.

### Changed
- Updates start the installer directly with `/UPDATE=1`; `installer.iss` waits for FrameDecks to close and opens
  the new version (`IsUpdate`). Inno Setup's own rollback replaces the 7.0 script's fallback installer.
- The network check runs only while Settings → Phone & iPad Remote asks for it.
- The Windows build compiles PyInstaller's launcher from source instead of using the shared prebuilt one.
- `tests/test_winapi.py`: no file in `src/` may start PowerShell, `taskkill`, `netsh`, `cmd`, `wmic` or `schtasks`;
  on the Windows runner the real signature, process, network and firewall calls are exercised.

## [7.1] - 2026-10-29

Full notes: [docs/releases/v7.1.md](releases/v7.1.md)

### Added
- **Workspace looks:** Branding → Look on the website offers six looks (Gold & Navy, Morning Light, Chapel Stone,
  Deep Ocean, Forest, Quiet Mono). A look is the synced record `layout/look` (`{id, name, a, b, font, base}`): the card
  surface and scripture font, applied by the output pages (`--surf-a`, `--surf-b`, `--scripture` in `overlay.css`)
  and the FrameRelay camera (`vcam/cards.py` `surface_of`); choosing one also sets the brand accent. No database
  change: `layout` already accepts any id.
- **Follow my workspace** in Settings → General → Appearance and the command palette: the window follows the look's
  light or dark base.

### Changed
- Settings that change what the audience sees (`layout/look`, `brand`, `layout/layout`, `theme/cards`) are applied
  by a PC only while nothing is on its screen; until then they are held, like the live Frame (`cloud_sync.on_screen`,
  also used by the updater).

### Also since 7.0
- The download page offers a download link only from a checked manifest ("Download opens soon" until the download
  service answers), and `infra/update-api/local-test.sh` tests the release pipeline end to end on one computer.

## [7.0] - 2026-10-29

Full notes: [docs/releases/v7.0.md](releases/v7.0.md) · plan:
[docs/project/2026-10-29-commercial-model-plan.md](project/2026-10-29-commercial-model-plan.md)

### Added
- **Downloads from framedecks.com.** `/download` detects the visitor's system and shows the newest version, size,
  release notes and SHA-256 from `api.framedecks.com/releases/latest`. Version tags are published to Cloudflare R2
  (`downloads.framedecks.com`) by the workflow's new `publish` job (`tools/make_release_manifest.py`), and the
  manifests are served by a read-only Worker (`infra/update-api`). See
  [release-pipeline.md](deployment/release-pipeline.md).
- **Automatic updates** (`src/updater.py`): a daily check of the FrameDecks manifest; downloads only from
  `downloads.framedecks.com`, kept only when size and SHA-256 match (and Authenticode once signed); a silent install
  after the program closes, never while something is on screen unless confirmed; the previous version put back if
  the install fails; the outcome told once at the next start. Settings → About shows the notes, Update now, Update
  when I close FrameDecks, and Reinstall the previous version.
- **Legal and security pages** on framedecks.com from the Markdown in `docs/legal/`: Terms, Privacy, Cookies, EULA,
  Security, Vulnerability Disclosure, legal notices; plus About, Contact, Roadmap, Documentation (the user guides),
  Status, a five-column footer, a cookie notice and `/.well-known/security.txt`.
- **Accounts:** a required Terms and Privacy tick when an account is created, a one-time acceptance screen for
  existing accounts, Account → Your data (download everything as JSON, delete the account). Needs
  `hosted/supabase/migrations/0011_accounts_legal.sql` run in Supabase.

### Changed
- **FrameDecks is proprietary software**, free to download and use: `LICENSE` is the FrameDecks End User License
  Agreement, `NOTICE` and the third-party notices were rewritten, and the installer shows the EULA. Versions up to
  6.14 remain under the Apache License 2.0.
- The program no longer asks GitHub for new versions; every website download link goes to `/download`.
- Contacts are hello@, security@ and privacy@framedecks.com (Cloudflare Email Routing).

## [6.14] - 2026-10-29

Full notes: [docs/releases/v6.14.md](releases/v6.14.md)

### Added
- **Setup guide** in the program: a panel at the right with seven steps (kind of gathering, how people see it, the
  phone remote, Connect to FrameDecks (optional), your first Frame, rehearse in Practice mode, Ready). Each step
  ticks itself when the program sees it is true; "Show me how" dims the window around the real control. It opens on
  a new PC, can be made smaller or skipped, keeps its progress in `kc-app-settings.json`, and returns from
  Settings → About → Guided tour or the command palette. It replaces the Getting started card.
- **Setup guide on the website's Home**: the same seven steps (one list, kept equal by a test), ticked only where the
  website can see them (the kind chosen, a linked PC, a Frame added or changed on the website); the PC's steps say
  "On the PC". Help → "Show the Setup guide on Home" brings it back.

## [6.13] - 2026-10-29

Full notes: [docs/releases/v6.13.md](releases/v6.13.md)

### Added
- **One-click linking.** Settings → FrameDecks account → **Connect to FrameDecks** opens `framedecks.com/connect` in
  the browser; a signed-in owner or admin sees "Allow ‹PC› to use your workspace?" with the PC's two-digit check
  number, picks the workspace and presses Allow. The PC turns to "Linked" by itself (it checks every 1.5 s while
  waiting). Signing in on the way comes straight back to the request. Typing the code under Service PCs still works.
  Needs `hosted/supabase/migrations/0010_link_by_url.sql` (`computer_link_peek`) run in Supabase.

### Changed
- framedecks.com is the website's one address: canonical links, Open Graph, `robots.txt` and `sitemap.xml` use it;
  signed-in pages are not indexed; the Pages address answers `noindex`. Each page has its own title in the browser
  tab and when shared. The program links through `https://framedecks.com` and falls back to
  `https://framedecks.pages.dev`. Cloudflare DNS, redirects (framedecks.app and www → 301), TLS, cache, security and
  WAF settings: [docs/deployment/cloudflare-domains.md](deployment/cloudflare-domains.md).
- Website front page: about four screens instead of nine. The hero has the words and the product side by side with
  four proof ticks; **How it works** plays its four steps by itself once (tabs with a filling bar, pause on hover or
  focus, Previous / Pause / Next), with no scroll pinning; the demo and the features share one set of tabs; four
  questions show and the rest open from "More questions"; the promise moved into the closing panel. GSAP is removed.

## [6.12] - 2026-10-28

Full notes: [docs/releases/v6.12.md](releases/v6.12.md)

### Changed
- The virtual camera FRAMECAST is renamed **FrameRelay** everywhere: the registered camera name, the program, the
  website, the documentation, the installer and the GitHub templates. Same Windows camera ID; FrameDecks still
  recognises a camera registered under the old name.
- Website front page: the Studio picture arrives once (rise, screen on, corners, phone, one light across the glass)
  instead of tilting, following the mouse, floating and swaying; the closing light is still too.
- The quotation in the website's demo is replaced by Proverbs 16:3 (KJV), and the front page's Studio picture was
  captured again with that verse.
- About screen: "Ministry Servant" removed from the founder's roles and journey.

## [6.11.2] - 2026-10-27

Full notes: [docs/releases/v6.11.2.md](releases/v6.11.2.md)

### Changed
- The FrameDecks website explains problems in plain words and asks for confirmation in a FrameDecks dialog (trust
  fixes, PR #39). The program on the PC is unchanged.
- Repository layout: the program's Python modules are in `src/`, community files in `.github/`, licences in `legal/`
  and the changelog and roadmap in `docs/`. The installer, the launchers and the program behave exactly as before.

### Fixed
- The website's size check (`hosted/scripts/check-budget.mjs`) works on Windows.

## [6.11.1] - 2026-10-26

Full notes: [docs/releases/v6.11.1.md](releases/v6.11.1.md)

### Added
- A damaged saved plan is kept aside and the newest readable daily backup opens instead; a linked PC then restores
  the plan from its workspace. Settings → Diagnostics says what happened.
- Settings menu grouped (Your meeting, Presenting, Account, This PC, Help), with descriptions and Find a setting.
- First run: Start fresh is the main choice when no earlier data is found; a Getting started card (3 steps) follows.
- Settings → Diagnostics → Save support bundle (log, Diagnostics, settings; never plan, members, PIN or keys).
- About announces a newer published version once a day (never downloads; `FRAMEDECKS_NO_UPDATE_CHECK=1` turns it off).
- CI: Desktop checks (ruff, JS syntax, doc links), the website's performance budget, an installer smoke test, and
  a backup check that the nightly copy decrypts and lists its tables; failed scheduled runs open a GitHub issue.

### Changed
- Design roadmap completed (ranks 8, 12–21): website state kit, skip link and landmarks, gold discipline, task-first
  Overview, light theme, Source Sans 3; program sentence-case labels in Source Sans 3, Lucide icons, one email composer,
  Import / Export menu, Frame actions More…, compact About, help text under checkboxes; one type scale, weights, radii
  and elevations (`tools/css_tokens.py`), visual layout checks in CI (`tests/visual/layout.mjs`), `docs/development/design-system.md`.
- Running a service (owner-approved simplification, 27 October; `app/js/service.js`): Prepare / Run (Run hides every
  editor and blocks rename, drag, menus, Delete, cut, paste and undo in the Studio), Up next, Before you start,
  Practice mode (Black screen for the audience, `practice=1` previews), How people see it (Settings), Advanced
  (Transitions, Keyboard shortcuts, Security, Diagnostics), FrameRelay presets with Fine-tune, Members → People (List /
  Table), labelled main tabs, worded Previous / Next, Hide all red only while something is on screen, one status pill,
  Live tools grouped (one Teleprompter entry) and closed by Esc, Blackout renamed Black screen, Q + S → Both, no
  "350 ms" or double PREVIEW badges, a four-step first-service guide, `docs/guide/glossary.md`. Website: Services is now
  **Running order**, cross-links with the Meeting Form, and a factual trust strip on the front page.
- The name is written **FrameDecks** everywhere people read it: the program, the installer's names and messages, the
  website, its metadata and the guides (identifiers stay: data folder, settings names, the exe, the local API's
  `app` value, the firewall rule, the old camera names that upgrades look for). The legacy Wi-Fi phone remote is
  unchanged (protected).
- Website front page for every gathering (owner's brief, 27 October): "Prepare with Purpose. Present with
  Excellence.", the approved line about every screen, every stream and every member of your team, made-for pills,
  a bento of features, Day 1–4, **Ready to Serve?**; no church-only words or named streaming products; new neutral
  product pictures. Motion is back and lighter (transform and opacity only, plays once, nothing animated when idle,
  no animated blur). The website says **team** where it said church. The About screen is readable in the light theme.
- Website, one place per job (owner-approved, 27 October): four main places, **Home · Plan · Live · People**, with
  Branding, **Service PCs** and **Help** under Settings; the Meeting Form and the running order are one **Plan** page
  (Edit the meeting / History and restore; old addresses still open it); Home shows the next service and whether it is
  ready (volunteers who may run services get **Run the service**); your churches and invitations moved to **Your
  account** (the avatar); sign-in asks **New here?** or **Welcome back** and a first visit walks through naming the
  church, installing and linking the service PC; the transition style is a dropdown; empty lists say **+ Add a
  question**. A **Help** page (getting started, Sunday morning, problems, words, contact, version) and a tablet layout
  for Live.
- Website look (identity): no glows, glass, word-by-word headline or pointer spotlight; one flat gold main action;
  gold frame corners around product pictures; scripture in EB Garamond. The front page is rebuilt: what it is in one
  sentence, Download first, a press-Next demo, a week with FrameDecks, a verse, what it does, questions churches ask,
  and a full footer.
- Run: **Up next** as large as the picture on screen, keyboard hints under it (from your own shortcuts), and at the
  meeting's start time a reminder if Practice mode is still on.
- Steps to 90+ after the re-audit: every program colour in `app/css/palette.css` (`tools/css_palette.py`; the token
  check fails on a colour anywhere else), radii and shadows on tokens (`--el-2-up`), `!important` 42 → 16; the keyboard
  editor and About story built on first open (page 2,220 → 1,796 elements); an axe WCAG 2.1 AA scan in CI
  (`tests/visual/a11y.mjs`, both themes) and its fixes: list rows, inspector links and Theme radios with the right ARIA,
  light-theme green `#15803d`, faint `#5f6678`, undimmed light menu text, full-strength Esc hint.
- Website (design audit ranks 5, 6, 7, 9, 10, 11): one date helper (`src/lib/when.ts`: "2 h ago", exact on hover);
  a bottom tab bar on phones; landing with real product screenshots and specific copy, mission and lockup once;
  destructive actions styled apart with named confirmations; labels at 12 px+ and `--text-3` #8793ad (4.5:1+);
  Content previews with kind icons on Services and Meeting cards. Program: labels at 12 px+, `--faint` 4.5:1+.
- Command bar in words (design audit DD-13): Transition label, Auto-advance, Live tools ▾, Ready / Off air,
  sentence-case Go Live and Hide all, tooltips on the icon-only tabs. Teleprompter empty state with Write a script.
- Sync no longer deletes every Frame in the workspace when they all vanish from one PC; they are restored instead.
- The program's local API refuses calls from other websites (`Sec-Fetch-Site: cross-site`).

### Fixed
- Companion errors now use clear, actionable messages instead of exposing database or authentication details.
- Destructive companion actions use named, keyboard-accessible confirmation dialogs; deleting a workspace requires
  typing its name.
- README installation and companion descriptions now reflect the published release and shipped online features.
- Errors the program recovers from are logged (at most once a minute each).
- Window buttons (minimise, maximise, restore, close) never wait on the window's thread.
- One OpenCV (opencv-python 5.0); the unused opencv-python-headless 4.14 is gone from the installer.
- Build: every GitHub Action and the softcam source pinned to a reviewed commit; only the release job can write.
- Database `0009_seen_throttle.sql`: a PC's last-seen time is written at most once a minute.

### Removed
- The Stream Deck plugin (`streamdeck/`) and the local `/api/command` endpoints it used (owner's decision).

### Fixed
- "Could not reach https://framedecks.pages.dev: Forbidden" in FrameDecks account (requests now identify FrameDecks).
- Unpinning the Teleprompter overlay froze the program.
- Camera labels that still said FrameDecks (switch, status, Teams step, Cards, Camera Look, Diagnostics) now say
  FrameRelay; `tests/test_camera_name.py` guards it (design audit DD-01).
- The camera's start-file message no longer sits over the Studio canvas (Members' tab switch showed the camera
  picture panel on every visit). `tests/test_ui_labels.py` guards ranks 2–4.

## [6.11] - 2026-10-26

Full notes: [docs/releases/v6.11.md](releases/v6.11.md)

### Added
- Companion: **Meeting Form** page. Plan the whole meeting online as in the Excel Meeting Form (meeting details,
  Frames, every Content type, questions, scripture); a linked PC shows it within about a minute.
- Companion: on a Windows PC, the Overview checks for the FrameDecks camera and offers the download or **Open
  FrameDecks on this PC**; the installer registers the `framedecks:` link for the current user.

### Changed
- The Excel Meeting Workbook (import, template, export, undo) moved to **Settings → Data / Backup**; the Meeting
  menu, Meeting tab and empty Studio no longer show it (owner decision W2).
- The dark theme uses the website's colour palette (colours only), so the program and the website match.

## [6.10] - 2026-10-20

Full notes: [docs/releases/v6.10.md](releases/v6.10.md)

### Fixed
- After **Quit**, the program kept running out of sight: the hidden Spotlight window kept `webview.start()` from
  returning. The next start then showed *127.0.0.1 refused to connect*, because on Windows its server could share port
  8750 with the silent copy.
  - Quit now closes every window, and a five-second safety net ends the process.
  - The server releases its port at once.
  - On Windows the main server binds its port exclusively (`SO_EXCLUSIVEADDRUSE`, `server.MainServer`).
  - A start that finds a copy which holds the port but does not answer ends that copy. Only processes with the
    program's own name are ended, never the starting one.
  - The installer closes a running copy before it updates.
  - Tests: `tests/test_desktop.py` → `Restart`.

## [6.9] - 2026-10-20

Full notes: [docs/releases/v6.9.md](releases/v6.9.md)

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
- The program now uses the FrameDecks name everywhere: the program (`FRAMEDECKS.exe`), the program folder,
  the data folder (`%APPDATA%\FRAMEDECKS`), the data files (`kc-*.json`), the start files, the recordings folder,
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

Full notes: [docs/releases/v6.8.md](releases/v6.8.md) · Plan: [docs/project/history/2026-10-20-v6.8-plan.md](project/history/2026-10-20-v6.8-plan.md)

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

Full notes: [docs/releases/archive/v6.7.md](releases/archive/v6.7.md)

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

Full notes: [docs/releases/archive/v6.6.md](releases/archive/v6.6.md)

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

Full notes: [docs/releases/archive/v6.5.md](releases/archive/v6.5.md)

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

Full notes: [docs/releases/archive/v6.4.md](releases/archive/v6.4.md)

### Added
- Team Space: co-leaders connected directly between PCs over WireGuard (removed again in 6.5).
- New guides: user, installation, configuration and feature documentation.

### Changed
- The camera is called **FrameDecks** in Zoom, Teams, Google Meet and OBS (same device ID as before).
- The app shows only the Book + Candle logo as its branding.
- The installed app is a real desktop window: no address bar or browser controls, and the title bar follows the
  theme.

## [6.3] - 2026-10-15

Full notes: [docs/releases/archive/v6.3.md](releases/archive/v6.3.md)

### Changed
- One command bar at the top replaces the top bar and the bottom live bar.
- Studio panels can be resized, folded and reset; sizes are remembered.
- Phone remote profiles: Simple, Standard and Advanced.

## [6.2] - 2026-10-13

Full notes: [docs/releases/archive/v6.2.md](releases/archive/v6.2.md)

### Added
- **Meeting & Branding** settings: Meeting Name, organization name, logo and accent colour, shown only where you
  choose; `{meeting}` and `{org}` placeholders in text.
- One Excel file builds a whole meeting, with a preview listing each problem by row; export a meeting to Excel.

### Changed
- The live action is one clear **Go Live** button.

## [6.1] - 2026-10-13

Full notes: [docs/releases/archive/v6.1.md](releases/archive/v6.1.md)

### Added
- **Quick Start** builds a complete set of scenes for a meeting; **Presentation Mode** (P); a built-in Content
  Library of ready-made scenes; Duplicate & edit question.

### Changed
- The program got its current name, **FrameDecks**, with a navy and gold design in dark and light
  themes, and a new About page.

## [6.0] - 2026-10-12

Full notes: [docs/releases/archive/v6.0.md](releases/archive/v6.0.md)

### Added
- **Scenes · Layers · Canvas:** scenes with layers, smart duplicate, templates, version history and transitions.
- Scripture lookup from the ESV API (with a free key), with context, read aloud, recent and favourite references.
- Phone and tablet layouts of the remote with scenes, canvas and layers.

## [5.1] - 2026-10-12

Full notes: [docs/releases/archive/v5.1.md](releases/archive/v5.1.md)

### Added
- Command Center layout: production panel, live outputs under the picture, an Inspector, and Take live (T).
- Mobile Director remote with a run sheet and tablet control surface.

### Changed
- Wider search (birthdays, scenes, slide decks, settings); faster stepping through long lists.

## [5.0] - 2026-10-11

Full notes: [docs/releases/archive/v5.0.md](releases/archive/v5.0.md)

### Added
- Presentation modes **Question · Both · Verse**, including a `PresentationMode` column in Excel.

### Changed
- Simpler screens: one way to do each thing, one LIVE indicator, one status button, search with Ctrl+K.

## [4.9] - 2026-10-11

Full notes: [docs/releases/archive/v4.9.md](releases/archive/v4.9.md)

### Added
- Studio workspace with Scenes and Layers, a control bar, and Dark / Light / Match Windows appearance.
- Natural background blur with fine control, alongside the Classic style.

### Changed
- Three tabs: Studio · Members · Settings.
- Much faster stepping through long question and verse lists.

[Unreleased]: releases/
[6.6]: releases/archive/v6.6.md
[6.5]: releases/archive/v6.5.md
[6.4]: releases/archive/v6.4.md
[6.3]: releases/archive/v6.3.md
[6.2]: releases/archive/v6.2.md
[6.1]: releases/archive/v6.1.md
[6.0]: releases/archive/v6.0.md
[5.1]: releases/archive/v5.1.md
[5.0]: releases/archive/v5.0.md
[4.9]: releases/archive/v4.9.md
