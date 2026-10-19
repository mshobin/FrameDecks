# Performance

How Kingdom Connect stays fast on an ordinary 8 GB Windows PC, and the numbers behind it.

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

Server process (with the camera engine running on the test camera): 126 MB resident.

## 6.7

Results are added when 6.7 is measured against the baseline above. See the [6.7 plan](v6.7-plan.md).
