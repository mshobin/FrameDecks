# Performance

How FrameDecks stays fast on an ordinary 8 GB Windows PC, and the numbers behind it.

**Who this is for:** the maintainer and contributors.

---

## How it is measured

Chromium (the engine of the WebView2 the app runs in), the demo meeting, median of three loads.
The numbers are load time, JavaScript heap, DOM nodes and the size of the scripts each page loads.

## 6.6 baseline

| Page | Load | JS heap | DOM nodes | Scripts |
| --- | ---: | ---: | ---: | ---: |
| Main window (`dashboard.html`) | 351 ms | 10.8 MB | 2,134 | 1,590 KB |
| Phone remote (`remote.html`) | 47 ms | 2.6 MB | 320 | 112 KB |
| Speaker View (`speaker.html`) | 52 ms | 1.1 MB | 75 | 77 KB |

Server process (with the camera engine running on the test camera): 126 MB resident (allocator arenas limited, see below).

## 6.7

| Page | Load | JS heap | DOM nodes | Scripts |
| --- | ---: | ---: | ---: | ---: |
| Main window (`dashboard.html`) | 370 ms | **4.0 MB** (−63 %) | 2,208 | **742 KB** (−53 %) |
| Phone remote (`remote.html`) | 52 ms | 2.9 MB | 333 | 126 KB |
| Teleprompter window (`speaker.html`) | 76 ms | 1.2 MB | 99 | 98 KB |

Server process, same data, fresh start, main window open for 30 s, allocator arenas held equal
(`MALLOC_ARENA_MAX=2`): **117.7 MB** in 6.7 against 126.2 MB in 6.6. The same requests reach the server in both
versions; without the arena limit, Linux reports up to 25 MB more for 6.7 only because the faster page sends
its first requests closer together (glibc gives each busy thread its own memory arena). Windows uses a
different heap.

What changed:

- **The Excel library loads on first use.** `vendor/xlsx.full.min.js` (930 KB) used to load and stay in memory at
  start-up. It now loads the first time you import, export or download a template (`KCNeedXLSX` in
  `dashboard.js`), which takes about 100 ms once.
- **New features cost nothing while closed.** The Teleprompter builds itself the first time it is opened and
  scrolls with `requestAnimationFrame` only while playing. The command palette builds its list when opened
  (about 3 ms) and discards it when closed. The editor exists only while editing.
- **No polling was added.** Idle requests are unchanged (81 against 80 per 10 s with the camera preview open).
- Load time is within measurement noise of 6.6. The Teleprompter window is slightly heavier because it now
  holds the Teleprompter.

Budgets for later versions: no page heavier than these numbers without a reason written here.

## 9.5.1: older PCs, drawing without the graphics card

The app window runs with **Light on graphics card** by default (`--disable-gpu --disable-gpu-compositing`, see
`src/desktop_app.py`), so everything on screen is drawn by the processor. `tests/visual/perf.mjs` measures the same
way (Chromium without the GPU, processor slowed 4×, 1366 × 768) and fails above the budget below.

| What | 9.5.0 | 9.5.1 |
| --- | ---: | ---: |
| Welcome screen at rest | 6 fps, worst frame 383 ms | **60 fps**, worst 17 ms |
| Welcome page change | 7–8 fps, worst 300 ms | **60 fps**, worst 50 ms |
| Welcome left open (after its pictures settle) | 17 % busy, 60 style updates a second | **3 %**, about 1 a second |
| Studio at rest | 12 % busy | 10 % |
| Studio, selecting a Frame | 45 % busy, worst frame 100 ms | 33 %, 83 ms |
| Phone remote at rest | 8 % busy | 6 % |
| FrameDecks vCam follow Spotlight (1080p, moving) | 11.4 ms a frame | **2.2 ms** |

What changed:

- **No blur filters on large or moving things.** The welcome's three soft lights were 42 vw circles under
  `filter: blur(90px)`, animated for ever; without a graphics card every frame re-blurred the whole window. They are
  now radial gradients that fade to nothing (the same look), painted once. Pages slide and fade instead of
  un-blurring; the pictures' entrance and the emblem's glow have no filter.
- **Nothing loops for ever.** The welcome's cursor, highlight, question counter and emblem play a few times when a
  page appears, then rest.
- **Covered means not drawn.** While the welcome covers the window, the window behind it (with its live previews) is
  `visibility: hidden`.
- **The follow Spotlight keeps its shape.** `vcam/spotlight.py` works out the disc once per size and strength
  (`_disc_mask`) and blends it with OpenCV's `blendLinear`; the picture is the same to within one level.
- Checked and left as they are: the Teleprompter's frosted toolbar (no measurable cost), the Studio's timers (under
  10 ms of script in 8 s), the main window's size (1,981 elements on a fresh install).

Budget (`tests/visual/perf.mjs`): the welcome at 45 fps or more with no frame over 120 ms; the Studio and the
remote under 25 % busy at rest.

## 9.10.2: the Command Center

It runs beside Zoom, Teams or a browser, often on the same older PC, so it is measured the same way (no graphics
card, processor slowed 4x; `tests/visual/perf.mjs`).

| | 9.10.1 | 9.10.2 |
|---|---|---|
| At rest | 3 % busy | 2 % |
| Opening a chip | 29 % busy, worst frame 100 ms | **15 %**, worst 33 ms |
| Moving between chips (five in three seconds) | 44 % busy, 399 ms of style | **29 %**, 266 ms, no long frames |

What changed:

- **The window never resizes.** It keeps one see-through size (`SPOT_H` in `desktop_app.py`); resizing the window
  while a panel opened relaid the whole page and the WebView on every chip.
- **Only transform and opacity move.** The panel unfolded by animating its height (`grid-template-rows`), was revealed
  with an animated `clip-path` circle, and its buttons came into focus from `filter: blur()`; each of those costs the
  processor on every frame without a graphics card. The panel now shows at once and rises and grows from the chosen
  chip; its glow is a radial gradient instead of a blur filter; the icons have no drop-shadow filter.
- **Fewer moving parts.** The buttons came in one by one, each with its icon; they now come in together, so the grid
  moves as one piece.
- **Built once.** Each chip's panel is built the first time and kept; the pointer light updates once a frame.
- Ready before it shows: the window is made see-through when it is created, so the first open no longer flashes grey.

Budget: opening a chip and moving between chips at 45 fps or more with no frame over 120 ms; at rest under 25 % busy.

## 26.11: the whole program on a 4 GB PC

`tests/visual/perf-4gb.mjs` goes through every window, tab, chip and panel with a 40-Frame meeting, the processor
slowed 4× and nothing drawn by the graphics card, then opens and closes everything 15 times and checks that memory comes
back. Budget: at most 15 % busy at rest, 40 MB of JavaScript memory and 6,000 elements per window, no frame over
250 ms, at most 2 MB kept after 15 rounds, and the program (the Python server) under 260 MB.

| What | Busy at rest | JS memory | Elements |
| --- | ---: | ---: | ---: |
| Studio, 40 Frames (idle / live) | 4 % / 4 % | 6–8 MB | 2,800 |
| Members, Settings (each of the six groups) | 2–6 % | 6.5–7 MB | 2,800–3,000 |
| Top-bar chips, command palette | 3–10 % (opening) | 7–10 MB | 2,800 |
| Teleprompter (idle / scrolling) | 4 % / 7 % | 2.7 MB | 310 |
| Command Center (idle / each chip) | 4 % / 6–7 % | 3–3.7 MB | 350–1,100 |
| Phone remote (idle / each chip) | 2 % / 2–3 % | 3.8–4.7 MB | 600–1,300 |
| Share Window, overlay pages | 3–6 % | 1.7–2.6 MB | 50–180 |
| The program (Python server) | | 75–81 MB resident | |

Every frame took 33 ms or less. Opening and closing tabs, chips and the palette 15 times kept nothing; the server
stayed at 79 MB through 500 changes with the phone remote connected. Follow my voice adds its own process (about
150–250 MB) only while it is on, and does not start below 350 MB of free memory.

**Fixed: the Studio's previews kept every old page.** The two preview frames (the canvas and Up next) reload each time
a Frame is chosen, and each reload left its listener on the main window's state (`store.js`, `shareParent`): every old
page stayed in memory, about 0.3 MB each, and kept redrawing on every change. 120 Frame choices kept 33 MB; after
480 the main window would have held over 130 MB and spent processor time on dead pages. A preview now lets go when
it is replaced (`pagehide`, and a listener whose page has gone removes itself): after 480 choices the main window
stays at 4 MB with no extra documents (`tests/test_perf_4gb.py`).

## 26.11.1: motion within the same budget

The animations added in 26.11.1 follow four rules, checked by `tests/test_motion_2611_1.py`: only `transform`,
`opacity` (and one small stroke drawing) move; each is a one-off of 0.1 to 0.9 s (the reading band breathes only
while it hears a voice; the empty-list shimmer plays twice); nothing runs while nothing happens; and the system's
"reduce motion" turns all of them off. `tests/visual/perf-4gb.mjs` gives the same results as 26.11: 2–5 % busy at
rest on every screen, no frame over 34 ms, nothing kept after 15 rounds, the program at 72 MB.

## 26.11.2: the top bar measures itself

`app/js/bar-fit.js` sets a bar's `data-fit` level from 0 up until its buttons fit on one row. It runs only on a window
resize, a change in the bar's buttons (shown, hidden, new words: a MutationObserver that ignores its own attribute) and
once the fonts are ready, at most once per drawn frame; it never polls. A fit is a handful of layout reads (one per
level tried). The 4 GB check is unchanged: studio idle 4 % busy, worst frame 17 ms.

