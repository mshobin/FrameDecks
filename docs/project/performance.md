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
