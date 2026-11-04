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
