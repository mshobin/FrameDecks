# Changelog

All notable changes to FrameDecks are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are **YY.MM**, the year and the month of the
release (26.11 is November 2026), with .1, .2 for further releases in the same month (see
[docs/development/changelog-standards.md](development/changelog-standards.md)). Each version links to its full
release notes in [`docs/releases/`](releases/). Dates are the dates of the release commits.

Changes before 26.11 are kept in [docs/archive/changelog-before-26.11.md](archive/changelog-before-26.11.md).

## [Unreleased]

## [26.11.22] - 2026-11-09

Full notes: [docs/releases/v26.11.22.md](releases/v26.11.22.md).

### Added
- Undo for 5 seconds after Next, Previous, Hide all, Black screen and Emergency off (Studio toasts via
  `KCActions.toastAction`, Command Center `tell(msg, bad, undo)` with `.spr-undo`, voice commands). `Store.snapshot` /
  `Store.restore` cover live, question, verse and birthday; `Store.undoable(fn)` wraps one change.
- Smart Next (`smartNext`, off by default): `KCScenes.smartNext` / `smartApply` walk the live Frame's questions, then
  its scriptures, then the next Frame; the place is kept in `live.smart = {scene, at}`. Used by the Studio, the
  Command Center, the phone (`/api/remote/studio` carries `smartNext`) and voice commands.
- Crash-proof live: `kc-running.flag` in the data folder; a flag left behind at start means a crash, and
  `/api/app/info` carries `recovered` so the Studio says so once (`app/js/studio-feel.js`).
- Optional sounds (`uiSounds`, off by default): `app/js/ui-sound.js`, Web Audio tones, no sound files.
- Settings: search looks inside each page and lights the setting up (`.kc-found`); "Reset this section"
  (`POST /api/app/settings-reset`, never `guide` or `onboarding`).
- FrameDecks icons `fd-frame`, `fd-deck`, `fd-golive` in `app/js/icons.js`.

### Changed
- `Store.update` draws the change at once (optimistic) and puts it back if the PC refuses it (not on a conflict,
  which retries as before).
- One motion language (`--m-quick`, `--m-gentle`, `--m-ease`) and elevation (`--elev-1..3`) in theme.css and
  spotlight.css; tabular numbers; press scale; the Studio inspector desaturates while live until reached for (`filter: saturate`, so text keeps its contrast); a shimmer on
  the picture until its first frame; Hide all neutral in the Command Center and on the phone; icon stroke 1.75.

## [26.11.21] - 2026-11-08

Full notes: [docs/releases/v26.11.21.md](releases/v26.11.21.md).

### Added
- `voiceKey` also takes `lctrl` and your own key(s) `k:<vk>+<vk>` (up to three, `voice_commands.parse_key` /
  `valid_key`, `KEY_NAMES`), recorded in Settings → Scripture (Your own key…; window capture-phase listener, so the
  palette's Ctrl+Space does not open while recording).

### Changed
- The hold key starts listening after `HOLD_DELAY` (0.25 s) held alone; any other key pressed meanwhile (`OTHER_KEYS`)
  cancels it and the result is dropped without a message (`_hold(..., discard=True)`). `VoiceCommands.key_step` is one
  look at the key (tested without a keyboard).

## [26.11.20] - 2026-11-08

Full notes: [docs/releases/v26.11.20.md](releases/v26.11.20.md).

### Added
- Voice commands, hold to talk (`src/voice_commands.py`): settings `voiceCommands` (off) and `voiceKey` (`rctrl`, `f8`,
  `off`); a third grammar in `src/voice_worker.py` heard only while `{"hold": true}` (the other grammars hear nothing
  then); `voice_follow.command_start/hold/stop`; `GET|POST /api/voice-commands` (hold, enable, done, say) and the
  signed-in `/api/remote/voice-commands` (hold only); the Studio runs commands with the buttons' own steps
  (`app/js/voice-commands.js`), the Command Center's hold microphone (`app/js/cc-voice.js`), the phone's Hold to talk
  (`app/js/remote-voice.js`); a spoken verse goes through `ScriptureListen.ask`. `desktop_win.key_down` reads the key
  only while on and live.

### Fixed
- Presses waiting seconds: every window held several long-polls (state, verse-listen, Memory Cards, cloud remote) and
  the shared six-connection limit made other requests queue (measured 0.5 to 9 s). Riders (`Store.ride`, `also=` on
  `/api/state` and `/api/rev`, `riders_asked` in `src/server.py`): one waiting request per window, with an
  `{"unchanged": true, "riders": ...}` answer when only a rider moved. `cloud-remote.js` waits only while it is on.
- The 26.11.19 Control tightening also enlarged the header's Show / Dismiss buttons: now scoped to `.spr`.

## [26.11.19] - 2026-11-08

Full notes: [docs/releases/v26.11.19.md](releases/v26.11.19.md).

### Fixed
- The black box behind the Command Center (and 26.11.17's bare search bar). `gdi32.DeleteObject` was called without
  argtypes, so a region handle with its top bit set raised "int too long to convert" and `desktop_win.clip` gave up
  before `SetWindowRgn`. Every GDI call that takes a handle is now declared (`DeleteObject`, `CreateRectRgn`),
  `_free()` can never cost the shape, and `desktop_app.shape_later` applies shapes on one worker, newest last.

### Changed
- Live Control fits the 720 px window: tighter rows in the 26.11.19 block of `app/css/spotlight.css` (the Meeting row
  and volume were below the edge).

### Performance
- `command-center.js` removes `cc-enter` 0.95 s after opening, so a chip's panel no longer waits the opening's
  0.24 s `animation-delay` (325 ms to 95 ms at 4x CPU).
- `app/js/cc-shape.js` ignores text-only mutations (the meeting clock ticked five measurements a second); the
  Control panel (`spotlight-remote.js` `setHidden`/`setCls`, `cc-listen.js`) writes attributes only on change.

## [26.11.18] - 2026-11-08

Full notes: [docs/releases/v26.11.18.md](releases/v26.11.18.md).

### Fixed
- The Command Center showed only its search bar on Windows in 26.11.17. `app/js/cc-shape.js` is back to the 26.11.13
  timing (a few looks while something moves, then one exact shape after 0.8 s); the 26.11.14 frame-by-frame following
  is removed. Kept: the traced tray curves (`fillets()`, now 11 steps a side), square joins, and a timer-only exact
  check (120, 500, 1200 ms after opening, then every 2 s when nothing moves); the extras sit in a try/catch so they
  can never cost the shape.

### Changed
- The opening pour is gentler (`cc-pour` from translateY(-10px) scaleY(.82); `cc-drop` from -8px).

## [26.11.17] - 2026-11-08

Full notes: [docs/releases/v26.11.17.md](releases/v26.11.17.md).

### Changed
- The Command Center opens as a waterfall: `cc-pour` (the tray unrolls from the bar, transform-origin top),
  `cc-drop` (the chips, staggered by `--i`), the panel after them (`.cc.cc-enter .cc-panel.in` delay); the hover
  unfold uses the same, every time (the 26.11.14 `!open` condition removed); bottom placement pours upward.

### Fixed
- `app/js/cc-shape.js`: the tray's concave joins (`.cc-tray::before/::after`, 22 px) are traced into the window shape
  (`fillets()`, 22 steps a side); a piece hanging under another keeps square top corners (no notches); the shape is
  checked on a timer after opening (80, 350, 1000 ms) and every 1.5 s while open, so an old shorter shape cannot cut
  Control short. `desktop_win.MAX_SHAPES` 48 → 96.

## [26.11.16] - 2026-11-08

Full notes: [docs/releases/v26.11.16.md](releases/v26.11.16.md).

### Added
- Emergency screen on the Command Center (`spr-emergency`, two presses to turn on) and the phone (`#t-emergency`, two
  taps); chips.js `emergency` on cc, app and phone; an empty message becomes "We'll be right back."
- The meeting clock in Control: `#spr-clock` (Command Center) and `#rclock` (phone), from `live.since`, `live.at` and
  the Frame's `plan`; gold when over; ticks only while live and visible.
- Mute and Camera from the phone: signed-in `GET/POST /api/remote/meeting-key` (`REMOTE_MEETING_ACTS = ("mute",
  "camera")`, never Leave or Share); `#mtg` card in the phone's Control; chips.js `meetingapp` on cc and phone.
- Listen for scripture: `history` of the last 3 references (`earlier` in the body), op `replay` (allowed from the
  phone) shown as Earlier chips in the Studio card, the Command Center's Control header and the phone's card;
  `planned` (server `_plan_passage`): a spoken reference inside a passage of the meeting's Scripture Decks is offered
  as that passage (`planned: true`, "in your plan"), and the Studio shows it from the plan without a lookup
  (`inPlan` in `app/js/verse-listen.js`).

### Changed
- The Teleprompter is in Engage only (chips.js, no `alsoIn`; the phone's tile moved to Engage, violet); guides, website
  Help and the landing eyebrow say Engage → Teleprompter.
- The Command Center's Play button shows only when the Frame has a video (`.spr-b[hidden]`).

## [26.11.15] - 2026-11-08

Full notes: [docs/releases/v26.11.15.md](releases/v26.11.15.md).

### Added
- Listen for scripture on every surface, in Control (chips.js `listen`, on cc, app and phone): the Command Center's
  Control header (`app/js/cc-listen.js`: Off / Ask / Auto, a listening dot, the verse just heard with Show and
  Dismiss in place of the header's description, because the 720 px window is full while live), the top bar's Control
  chip (`chip-bar.js` `DO.listen`, Ask / Off), the phone and tablet remote (`app/js/remote-listen.js`, a card in
  Control) and the palette (`cmd:listen`). One action for all: `{op: "mode", value: "off" | "ask" | "auto"}` on
  `POST /api/verse-listen` and the new signed-in `/api/remote/verse-listen` (show and dismiss only; never hear,
  shown or failed), `server.verse_listen_action`.
- Freeze in the Command Center's Control remote (`spr-freeze`, Alt+F, `app/js/keys.js`); Hide the cards on the phone
  (`#cm-hideall`, `api/remote/memory` `hideall`).

### Changed
- `scripture_speech.find_all(text, settled)`: up to four filler words or `[unk]` may stand before "verse" or
  "chapter"; "one oh five" is 105; "Psalm one nineteen" is 119 when a verse follows; `settled=False` (a partial
  result) takes a reference only once other words follow it.
- `scripture_listen.heard(text, final)`: the newest new reference in a phrase, not the first; partial results count
  (the worker now sends tagged scripture partials, `voice_worker.py`, routed by `voice_follow.py`); REPEAT 45 → 20 s
  and a suggested reference is remembered, so its partial and final results are one suggestion; an `error` stop is
  retried after RETRY (15 s); new op `failed` (from the Studio) offers it again with the reason.
- `app/js/verse-listen.js`: the Studio waits on the program with no timer between requests (a hidden Studio's timers
  are slowed to once a minute); a Show asked on another screen is tried again after a failure.
- The phone's "Capture Memory" heading reads Memory Cards.

### Fixed
- The palette had two commands keyed `guide`; the website guide one is now `helpguide`.

## [26.11.14] - 2026-11-08

Full notes: [docs/releases/v26.11.14.md](releases/v26.11.14.md).

### Added
- The draw pad (`app/js/cc-drawpad.js`, `window.KCDrawPad`): the Command Center's Draw and Spotlight open a pad under
  the bar with the live picture (`api/remote/live.jpg` about four times a second, only while open; `stage.html` as a
  fallback): Pen, Highlight, Arrow, Spotlight, three colours, Undo / Ctrl+Z, Clear, Done / Esc. Strokes go to
  `live.ink` as the phone pad's do. With How people see it set to Share a window, the Share Window is used as before.
- Listen for scripture: `src/scripture_speech.py` (a strict spoken-reference parser: book, chapter and verse, one-chapter
  books, ranges forward by at most 60) and `src/scripture_listen.py` (the server listens only while `scriptureListen`
  is on and a Frame is live, checked every 2 s; one suggestion at a time; 45 s before the same one is offered again).
  `src/voice_worker.py` gains a second recognizer (`--scripture`) in the Follow my voice process, so one microphone and
  one model serve both. `GET/POST /api/verse-listen` (this PC only). `app/js/verse-listen.js`: the Heard … Show /
  Dismiss card at the top of `#stage-status`, Auto, and the settings box in Settings → Content → Scripture.
- The run sheet (`app/js/run-sheet.js`): the meeting clock in the Frames pane (`live.since`, set by the first Go Live or
  after 6 quiet hours, `app/js/store.js`), and each Frame's time against its Planned time (`sc.plan`, minutes, the
  Frame's settings), gold once over. Ticks once a second only while live.

### Changed
- The Command Center: a chip is its own pin (`kc-cc-tray` now holds the pinned chip's id; old `1` / `0` pin nothing).
  Opening a chip pins it, its second click (or Esc) unpins; a pinned chip is open again the next time the Command
  Center opens, and a search only steps in front of it. The arrow tab (`.cc-handle`) is gone; pointing at the bar
  shows the chips.
- A grip on the border under the stage (`.kc-hsplit::before`); badges read Live (a Frame) and On screen (its Decks and
  Content); while live (`body.kc-live`) the top bar brings Control forward and the planning chips step back.

### Fixed
- No box behind the Command Center while a panel or the draw pad moves: `app/js/cc-shape.js` follows the move frame by
  frame (this frame's boxes and the one before) instead of covering where it was and where it was going for most of a
  second, and sends its shapes one at a time so an older one can never land after a newer one.

## [26.11.13] - 2026-11-08

Full notes: [docs/releases/v26.11.13.md](releases/v26.11.13.md).

### Added
- The Live Stage, Mockup B (owner-approved): the canvas header, Up next and the stage's tools moved into one column
  beside the picture (`#stage-status`, `app/dashboard.html`); `app/js/live-stage.js` adds the one button (`#ls-go`:
  Go Live, then Next, pressing the top bar's own `#cb-take` / `#lb-next`) and, in Advanced, In this Frame (`#ls-list`,
  `KCActions.showItem`) with Up next written on the button. `.stage-row` is a size container: the picture is
  `min(100cqw - var(--rail) - 16px, 100cqh * 16 / 9)` beside a `clamp(236px, 21cqw, 280px)` column, the two centred as
  one group; Advanced shows the status as four tiles. 615 × 345 → 780 × 439 at 1366 × 768 (Simple).
- `app/js/panels.js`: the border under the stage snaps (14 px) to `fitPx()`, where the picture fills the width;
  double-click and Layout → Fit the picture jump there. Dragged under 250 px of stage height it switches to `.wrap`
  (picture column `--wrap-w` 320–470 px, the column under the picture, the editor beside at full height; the border
  turns vertical); dragged past 470 px, double-clicked or **Big stage** (`#kc-big`) brings `bigStage()` back. One drag
  changes one layout (`split.dataset.from`). `wrap` and `wrapW` are kept in `kc-layout`.
- Tests `tests/test_live_stage_2611_13.py`; `tests/visual/layout.mjs` (Up next beside or under the picture).

### Changed
- `app/js/simple-mode.js`: the Simple | Advanced switch moved to the editor's bar (`#insp-tools`) and stays when the
  editor is folded. `app/js/stage-status.js`: Video and Connection rows read as short values with their source below.
- Website landing (`hosted/src/components/landing/tour.tsx`, `motion.tsx`): the flowchart shows on arrival, the Studio
  (Advanced, `tools/make_product_shots.py`) takes over sooner, the chapters and the section reveals follow the scroll
  smoothly (also with a touchpad) and reverse on scroll up; the replay button is gone. Product pictures retaken.

### Fixed
- Settings: the phone remote and vCam switches (`.big-switch`) drew a second, larger knob over the 26.11.1 switch
  (`#tab-settings .big-switch input::after{content:none}` in `app/css/motion.css`).

## [26.11.12] - 2026-11-08

Full notes: [docs/releases/v26.11.12.md](releases/v26.11.12.md).

### Added
- Scan to join (owner's request: passwordless, simple and secure; `docs/architecture/scan-to-join.md`). Migration
  `0018_scan_to_join.sql` (+ rollback, `hosted/tests/supabase-0018.test.mjs`): new devices are Supabase anonymous
  users; join codes (8 characters, SHA-256 only, once, 2 or 5 minutes), wrong codes limited per person, PC and
  network and answered as `{"status":"wrong"}` so the count is kept; invites (Helper/Admin), join requests, one
  devices list, removal, recovery codes; `organizations_insert` refuses anonymous people. PC: Settings → Sync
  (`app/js/account.js`, `src/cloud_sync.py`, `/api/sync` actions start/invite/allow-peek/allow/devices/remove/
  sync-now) with Add a device (QR + code), Invite someone, Allow a device, Devices and one status line; the Welcome
  tour shows the QR. Website: `/join`, `/allow`, a simpler `/sync` (Show a code for this browser; email code and
  recovery code as other ways in), one `/devices` page (Service PCs merged; `/computers` forwards), recovery code
  and emergency email; its own QR encoder (`lib/qr.ts`). Help codes FD-CLD-02/04 reworded, FD-CLD-06 added.
  Tests `tests/test_scan_to_join_2611_12.py`, `hosted/tests/scan-to-join.test.mjs`.
- How people see it: Camera / Share a window / Both (app setting `peopleSee`, `apply_people_see`): with Share a
  window the vCam engine is not started; Welcome tour and Settings → How people see it ask; the vCam panel offers
  Use the camera too. Tests `tests/test_people_see_2611_12.py`.
- Simple by default (owner's choice of changes 2–10 from the design review; no renames): `app/js/simple-mode.js`,
  `body.simple` / `body.advanced`, app setting `studioMode` (+ localStorage `kc-studio-mode` for the first paint), a
  Simple | Advanced switch above the Studio Canvas and a Design button in the editor. Simple: a green ring round the
  live picture instead of the badges, Transition and Auto-advance in Advanced, chip names kept, technical lines
  tucked, the Live output panel as one sentence with the next step, Position and size / Look / Animation / Show on
  behind Design. Command Center and phone remote say Go Live and Black screen. Tests
  `tests/test_simple_mode_2611_12.py`.

### Changed
- Studio: the Live Presentation Stage (owner's request, after three reference pictures). The picture of what Zoom /
  Teams receive is the hero: 16:9, centred, as large as the room allows (about 20 % wider at 1366x768 and 1920x1080).
  A compact **Live output** panel sits in the margin beside it (`#stage-status`, `app/js/stage-status.js`), built only
  from what the program already knows: FrameDecks vCam from the top bar's status chip and its frame rate, the program
  and phone-remote connections, the live Frame and how many of its Decks are on screen, and warnings (black screen,
  frozen picture, emergency screen, nothing shown, a very busy PC, a camera problem). Sound is stated plainly: it
  comes from the meeting app, FrameDecks sends pictures only. The camera view (vCam Studio) keeps the same centred
  band, so the panel never covers it; below 760 px of stage width the panel steps aside. Up next is a slimmer strip
  (80 px thumbnail); the stage's default share of the height is 66 % (was 64 %). Same ids, scripts, shortcuts,
  drag and drop, sidebar, toolbar and editor; the editor scrolls on its own and the page never does.
  Tests `tests/test_live_stage_2611_12.py`; tests/visual/layout.mjs and a11y.mjs pass.

## [26.11.11] - 2026-11-07

Full notes: [docs/releases/v26.11.11.md](releases/v26.11.11.md).

### Fixed
- Owner's photo in a Zoom meeting: the grey box behind the Command Center was back. Cause: da0be19 (26.11.7) made
  `cc-shape.js` measure only while `document.hasFocus()`; the shortcut brings the window forward but WebView2's page
  often has no focus (and a pinned Command Center stays open behind the meeting), so no `clip` was ever sent and
  the window had no region. Reproduced in a browser with `hasFocus` false: 0 shapes sent before, 13 after.
  Now the program calls `KCShape.wake()` on every open (always resends) and `KCShape.rest()` on hide, keeps the
  last rects (`state["spot_rects"]`) and re-applies them before `show()` and after the `fit` resize.
  Tests `tests/test_cc_shape_2611_11.py`.

## [26.11.10] - 2026-11-07

Full notes: [docs/releases/v26.11.10.md](releases/v26.11.10.md).

### Added
- Command Center Control: a **Shows** switch (Question / Both / Scripture, `#spr-qs` in `app/js/spotlight-remote.js`)
  for a live Frame with both cards, through `KCScenes.setQS` like the phone remote's `[data-qs]` and the Studio's
  `qsPill` (owner's request). The support report's vCam line adds `outputSize` and `captureInfo`.

### Changed
- Owner's 26.11.9 report: 13.9 fps out of 29.7 in, 71.9 ms per frame, blur model 45 ms, level 2. The camera loop was
  one core in series. `vcam.engine.BlurStage`: the blur of frame N runs on its own thread (`bcc-vcam-stage`) while
  the loop finishes frame N-1 (look, adjustments, cards, send); one frame of delay, throughput set by the slower half.
  `BackgroundBlur.want` lets the outline thread build `_natural_masks` right after each model run (`masks_ms`), so
  the camera thread no longer rebuilds them (11 ms at 1080p here, about 5x that on the owner's PC) every 200 ms.

### Fixed
- `_natural_masks` with no person in the picture: `cv2.merge` of an empty box raised and closed the camera (26.11.9).
  An empty box now means all background. Tests `tests/test_camera_stage_2611_10.py`.

## [26.11.9] - 2026-11-07

Full notes: [docs/releases/v26.11.9.md](releases/v26.11.9.md).

### Added
- `vcam.engine.Pace` (owner's 26.11.8 report: webcam 30.7 fps in, 7.5 fps out, 133 ms per frame, 9760 dropped; the
  graphics card was fine at 22-29 %): checked once a second while a meeting app uses FrameDecks vCam with blur on;
  under 80 % of the frame rate with frames over their slot for 2 s steps down (1: outline found 5/s, 2: `blur.coarse`,
  the same mask-normalised natural blur at twice the working-size divisor, max 8; never classic, which has a halo),
  under 60 % of the slot for 10 s steps back up. Status `lighterBlur`; the support report's FrameDecks vCam line says
  so. The meeting guard's busy flag now goes through `engine.guard_busy`.

### Changed
- `vcam.blur` natural style: the final blend in uint8 (`cv2.multiply`/`cv2.add` with a cached 3-channel alpha, within
  1/255 of the float `blendLinear`), 20-30 % faster at 1080p; `_scale_for` never works at full size (d >= 2): a full
  1080p Gaussian took 40-50 ms here for a blur of a pixel or two. The blend runs only inside the bounding box of
  `alpha < 255` (outside it the picture is all background; equal to the whole-picture blend), and the near layer is
  skipped when it would differ from the far one by under half a pixel. Measured at 1080p, one thread: strength 2
  46.3 -> 27.5 ms, 10: 10.7 -> 7.3, 30: 9.3 -> 6.7, 55: 10.0 -> 7.5; with `coarse`, strength 2 9.4 ms, 5: 5.1 ms.
- Owner's request (blur must feel organic, no halo): `blurStyle` is always `natural`. `clean_vcam` reads a saved
  `classic` as `natural`, the engine always passes `natural`, and the Blur style choice is gone from the vCam panel
  (the classic code path stays in `vcam.blur` for older callers only). Tests `tests/test_camera_pace_2611_9.py`.

## [26.11.8] - 2026-11-07

Full notes: [docs/releases/v26.11.8.md](releases/v26.11.8.md).

### Added
- **Branding → Background** (owner's request): `c.bg` 0..1 on the brand layer (`TEXT_DEFAULTS.brand.bg = 1`,
  `TEXT_RANGE.bg`), replacing the Background plate switch (`plate` stays for older plans: false = 0). Overlay:
  the plate is `.card-brand::after` at `--bga`, the accent ring and shadow fade with it, `.faint-plate` below 0.5
  adds the no-plate shadows. Camera (`vcam/program.py _badge`): plate alpha `225 * bg`, ring `255 * bg`, soft
  shadows below 0.5; at 1 the picture is unchanged (checked pixel for pixel).
- Meeting meter, sharper (owner's report: FrameDecks 37-87 % of the GPU, camera at 4 fps): `meeting_guard.split_gpu`
  gives FrameDecks' graphics use by process (pages = WebView2, program) and by engine kind; `desktop_app.windows_now`
  (`DESKTOP["windows"]`) says which FrameDecks windows are on screen and which is in front; request counts name the
  page (`page stage.html`) instead of lumping pages and files together.
- `app/js/meeting-mode.js` in the Studio and Teleprompter: asks `/api/app/guard?brief=1` every 5 s, sets
  `html.kc-meeting` and `KCGuardRest(window)`.

### Changed
- In a meeting: the Teleprompter's bars without `backdrop-filter`, its listening band still; the Studio picture,
  Settings camera preview and Up next rest unless Windows has the Studio in front.

### Fixed
- Up next reloaded its page on every switch between the meeting app and the Studio (26.11.7 swapped it to
  about:blank); now hidden (`.kc-rest`).
- `server.process_memory_mb` read 0 on Windows (the process handle was cut to 32 bits); it uses
  `meeting_guard.process_memory`.

## [26.11.7] - 2026-11-07

Full notes: [docs/releases/v26.11.7.md](releases/v26.11.7.md).

### Added
- **The meeting guard** (`src/meeting_guard.py`, owner's request; order: measure, then lighter FrameDecks, then the
  before-you-go-live line, then the busy hint). While a meeting app uses FrameDecks vCam (`engine.status.inUse`) it
  looks every 3 s: the PC's processor (`GetSystemTimes`), memory (`GlobalMemoryStatusEx`), FrameDecks' own share
  (its process and everything it started, i.e. its WebView2 pages: `GetProcessTimes`, `GetProcessMemoryInfo`), the
  graphics card (PDH `\GPU Engine(*)\Utilization Percentage`, as Task Manager) and, at 85 % and more, the busiest
  other program. Otherwise it only checks whether a meeting is using the camera. Busy after 3 looks at 90 %
  processor or 95 % graphics, calm after 2 under 80 %. Other camera users come from Windows' camera privacy record
  (`ConsentStore\webcam`, read-only); battery saver from `GetSystemPowerStatus`. Nothing starts a shell or ends a
  program; Close it posts WM_CLOSE to the Windows Camera app's window. `GET /api/app/guard`,
  `POST /api/app/guard {do: close-camera | power}`, `ms-settings:batterysaver` added to `SETTINGS_PAGES`.
- Lighter FrameDecks in a meeting: the Studio picture (`studio.js` `resting()`) and Up next preview
  (`workspace.js`) rest while the Studio is not in front; the blur model runs at 5 a second while busy
  (`_guard_lighten`).
- The Command Center's Control chip shows what is in the way (`.cc-guard`, read only while Control is open and in
  front); a quiet Studio note when the PC turns very busy (once in 5 minutes); `Meeting guard:` line in the support
  report.
- The Teleprompter also sits in the Command Center's Engage chip (`alsoIn` in `app/js/chips.js`).
- Guide: Troubleshooting → The meeting guard. Tests `tests/test_meeting_guard_2611_7.py`.

### Changed
- `app/js/cc-shape.js` measures only while the Command Center has focus, so a hidden Command Center does no work.

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

