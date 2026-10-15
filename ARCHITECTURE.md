# BCC vCam: architecture, implementation plan and test plan

Covers Camera Looks, screen sharing, layers (image / video / presentation), scenes, diagnostics and test
recording in the BSF Command Center's built-in virtual camera, **BCC vCam**.

> **Design decision: "path A".** This build extends the existing working pipeline, which processes frames
> in system memory with OpenCV/NumPy (CPU), instead of adding a native GPU (D3D11) compositor. The working
> virtual camera (softcam) only accepts frames in system memory, so even a GPU compositor would copy every
> frame back once. Section 9 lists every place where this differs from a GPU-first specification, with
> measurements.

---

## 1. Architecture overview

```
              ┌────────────────────────────── BSF Command Center (one process) ─────────────────────────────┐
 Webcam ──MF──▶ Grabber thread ─▶ mirror ─▶ Camera Look ─▶ background blur ──┐                              │
 (OpenCV MSMF; │                 (flip)    (LUT + 3x3 matrix  (MediaPipe     │                              │
  off when not │                            + vignette)       selfie model)  ▼                              │
  needed)      │                                                    ┌─────────────────┐                     │
 Screen ─DXGI─▶ ScreenCapture thread (only new frames on change) ──▶│   COMPOSITOR    │                     │
 Window ─WGC──▶                                                     │ 1 base layout   │                     │
 PDF deck ────▶ PdfSource (rendered once per page) ────────────────▶│ 2 layers (z)    │─▶ FINAL FRAME ──┬──▶ softcam ─▶ "BCC vCam" ─▶ Zoom / Teams
 Image/video/ ─▶ LayerManager (cached transforms; video decode     ▶│ 3 cards         │   (BGR, 720p/   ├──▶ preview (Studio, Meeting, Settings)
 presentation    on its own thread)                                 │ 4 latency clock │    1080p)       └──▶ test recorder (MP4, own thread)
 Live state ──▶ OverlayLayer: verse / question / birthday cards ───▶└─────────────────┘                     │
 (dashboard, phone, keyboard)  drawn once, blended per frame                                                 │
              └──────────────────────────────────────────────────────────────────────────────────────────┘
```

**One authoritative final frame.** The virtual camera, every preview and the recorder all use the same
composed frame; nothing bypasses the compositor.

| Module | File | Responsibility |
|---|---|---|
| Engine | `vcam/engine.py` | Frame loop, webcam on/off, look, blur, compositor, sink, measurements |
| Webcam | `vcam/devices.py` | Webcams by name (Media Foundation, DirectShow fallback), "why it won't open" |
| Camera Looks | `vcam/looks.py` | Data-driven colour grading (`bsf-looks.json`) |
| Background blur | `vcam/blur.py` | Person mask (separate thread, 10 Hz) and blur |
| Screen sharing | `vcam/screen.py` | DXGI Desktop Duplication (displays), Windows Graphics Capture (windows) |
| Layers | `vcam/layers.py` | Image, video, PDF and window sources; transforms; z-order |
| Compositor | `vcam/compositor.py` | Layouts, layers, cards, latency clock, test recorder |
| Cards | `vcam/cards.py`, `vcam/overlay.py` | Verse / question / birthday cards and their transitions |
| Virtual camera | `vcam/sink.py` + softcam DLL | "BCC vCam" DirectShow camera (system-memory frames) |
| Control plane | `server.py` | Settings, studio, scenes, uploads (this PC only) |
| UI | `app/js/studio.js`, `nav.js`, `vcam-panel.js`, `meeting.js` | Camo-style Studio, four-tab navigation + Directory + Recordings, BCC vCam settings, Meeting preview |

**Threads:** UI (WebView2) · HTTP control · engine loop · webcam grabber · blur model · card drawing ·
screen capture · one per playing video · recorder. Only the engine loop touches the final frame; other
threads hand over their newest picture under a short lock (no waiting).

## 2. Implementation plan (APIs and libraries)

| Need | API / library (licence) | Notes |
|---|---|---|
| Webcam | Media Foundation through OpenCV `CAP_MSMF`; DirectShow `CAP_DSHOW` fallback | Listed by name with `cv2-enumerate-cameras` (MIT) |
| Virtual camera | softcam (MIT), renamed "BCC vCam", own CLSID | `scSendFrame` takes BGR frames in system memory |
| Camera Looks | OpenCV `cv2.LUT`, `cv2.transform`, `cv2.multiply` | 2–3 whole-frame operations |
| Display capture | DXGI Desktop Duplication via `windows-capture` (MIT) | `acquire_frame()` returns nothing when the screen didn't change; cursor drawn by us |
| Window capture | Windows Graphics Capture via `windows-capture` | `window_hwnd`, `cursor_capture`, `dirty_region` |
| PDF slides | PDFium via `pypdfium2` (Apache/BSD) | Rendered per page at the layer's pixel width |
| PowerPoint control | PowerPoint COM via `comtypes` (MIT) | `SlideShowWindows(1).View.Next()/Previous()`; Page Down/Up message fallback |
| Video layers | FFmpeg in OpenCV (`CAP_FFMPEG`, `VIDEO_ACCELERATION_ANY`) | Hardware decoding requested; the result shows in Diagnostics |
| Recording | Media Foundation H.264 (`CAP_MSMF`, fourcc `H264`); MPEG-4 fallback | Hardware encoder used by Windows when available |
| SVG | The browser (WebView2) rasterises to PNG before upload | No native SVG library needed |

## 3. Shader examples (future GPU path) and what this build runs

### 3.1 Colour grade (HLSL) — one pass
```hlsl
cbuffer Grade : register(b0) {
    float brightness, contrast, gamma, saturation;
    float3 gain;            // temperature/tint as per-channel gains, computed on the CPU
    float vignette;         // 0 = off
};
Texture2D cam : register(t0); SamplerState s : register(s0);

float4 PS(float4 pos : SV_Position, float2 uv : TEXCOORD) : SV_Target {
    float3 c = cam.Sample(s, uv).rgb;
    c = (c + brightness - 0.5) * contrast + 0.5;                       // brightness + contrast
    c = pow(max(c * gain, 0.0), 1.0 / max(gamma, 0.001));             // temperature/tint + gamma
    float l = dot(c, float3(0.2126, 0.7152, 0.0722));
    c = lerp(l.xxx, c, saturation);                                    // saturation (Rec.709 luma)
    float r = length(uv - 0.5) * 1.41421;                              // optional, very mild vignette
    c *= 1.0 - vignette * pow(saturate((r - 0.45) / 0.55), 2.0);
    return float4(saturate(c), 1.0);
}
// gain = float3(1 + 0.0045*T + 0.002*N,  1 - 0.004*N,  1 - 0.0045*T + 0.002*N)   (T = temperature, N = tint)
```
**This build (CPU, `vcam/looks.py`):** the four per-channel steps are folded into one 256-entry table per
channel (`cv2.LUT`); saturation is one 3×3 matrix (`cv2.transform`); the vignette is a precomputed gain map.
Highlights that pass white before the saturation step are stored with headroom so the result matches the
shader. Verified within **1 level of 255** against the reference formula.

### 3.2 Layer composition (HLSL) — textured quads, premultiplied alpha
```hlsl
cbuffer Layer : register(b0) { float4x4 transform; float opacity; };   // position, scale, rotation
Texture2D tex : register(t0); SamplerState s : register(s0);
struct VSOut { float4 pos : SV_Position; float2 uv : TEXCOORD; };
VSOut VS(float2 corner : POSITION) {                                    // unit quad 0..1
    VSOut o; o.pos = mul(float4(corner, 0, 1), transform); o.uv = corner; return o;
}
float4 PS(VSOut i) : SV_Target {
    float4 c = tex.Sample(s, i.uv);
    return float4(c.rgb * c.a, c.a) * opacity;                          // premultiplied
}
// Blend state: Src = ONE, Dest = INV_SRC_ALPHA, Op = ADD. Draw visible layers bottom-to-top.
```
**This build (CPU, `vcam/layers.py`):** each layer's transformed, premultiplied picture (`cv2.resize`,
`cv2.warpAffine`) and its "keep" mask are **cached** and rebuilt only when the source or transform
changes. Per frame each layer is one blend: `dst = colour + dst × (1 − α)` with OpenCV 8-bit operations.

## 4. Capture → compose → camera pipelines

**Windows (this build):**
```
DXGI AcquireNextFrame ──(changed only)──▶ to_bgr ─▶ fit (once per change) ─┐
WGC FrameArrived (window, cursor) ────────────────────────────────────────▶ compositor ─▶ cards ─▶ final BGR
Webcam (MSMF) ─▶ look ─▶ blur ─────────────────────────────────────────────┘                     │
                                                                  softcam shared memory ◀─────────┘
                                                                  (Zoom/Teams then encode)
```
**Windows (GPU path B, if ever needed):** DXGI/WGC already deliver D3D11 textures; the webcam frame is
uploaded once; grade and layers run as the shaders above into one render target; one staging-texture
read-back per frame feeds softcam (or a Windows 11 Media Foundation virtual camera could take the texture).

**macOS (not implemented — this app is Windows-only):** ScreenCaptureKit `SCStream` → `CMSampleBuffer`
→ `CVMetalTextureCache` texture → Metal compute/render pass (same shaders in MSL) → CoreMediaIO Camera
Extension. `vcam/screen.py` keeps all capture behind `ScreenCapture`, so a macOS backend fits there.

**Encoding:** a virtual camera hands **uncompressed** frames to the meeting app, which encodes with its own
low-delay encoder; this app doesn't add a second encode (that would only add delay). Hardware H.264
is used for the **test recording** only.

## 5. UI wireframes

**Studio tab (Alt+2) — superseded in 4.1 by the Camo-style layout in §10; original wireframe kept for reference**
```
┌ Controls ─────────────┐┌ Final picture ─────────────────────────┐┌ Layers ──────── [+ Add layer ▾]┐
│ Scene [Presentation ▾]││ ┌────────────────────────────────────┐ ││ ⋮⋮ 🎬 1. Intro      [👁] [×]   │
│ [Save as][Update][Del]││ │  exactly what Zoom/Teams receive   │ ││ ⋮⋮ 📑 2. Sermon deck [👁] [×]   │
│ Look  [Warm ▾]        ││ │  (live, ~5 fps)                    │ ││ ⋮⋮ 🖼 3. Logo        [👁] [×]   │
│ SCREEN SHARE          ││ └────────────────────────────────────┘ ││ Quick presets: [Logo] [Lower   │
│ Source [Display 1 ▾]  ││ camera 30 fps → output 30 fps · 4 ms · ││  third] [Slide+camera] [Intro] │
│ [Start screen share]  ││ capture-to-send 6 ms · dropped 0 · CPU ││ ── Selected: Logo ──           │
│ LAYOUT [Cam|Scr|S+C|SbS]│ [● Record test] [Open recordings]     ││ X ━━━●━━ Y ━●━━━ Size ━●━━━    │
│ Corner ↖ ↗ ↙ ↘ Size S M L│ ☐ Latency test (running clock)       ││ Rotation ━━●━━ Opacity ━━━━●   │
│ SLIDES [◀ Prev][Next ▶]││                                        ││ (video: ▶ ⏸ ⏹ ☐ Loop)         │
└───────────────────────┘└────────────────────────────────────────┘└────────────────────────────────┘
```
**Meeting tab:** "On screen now" shows the real BCC vCam frame while it is live; **Look** menu in its header.
**Settings → BCC vCam:** on/off, webcam, picture size, Look, blur, mirror, cards, preview, install.
**Tray menu (icon near the clock):** Open · **Look ▸** (Off / Warm / Dark / Neutral / custom) · **Scene ▸**
(saved scenes) · **Stop screen share** · **Hide all overlays** · Phone remote ✓ · Quit.

## 6. Hotkeys

| Keys | Action | Where |
|---|---|---|
| Ctrl+Alt+1 / 2 / 3 / 0 | Look: Warm / Dark / Neutral / Off | Any tab |
| Ctrl+Shift+1 / 2 / 3 | Show/hide layer 1 / 2 / 3 (top of the Layers list) | Any tab |
| Page Down / Page Up | Next / previous slide (PDF deck or PowerPoint slide show) | Any tab, when a presentation is active |
| → ← ⇧→ ⇧← Q V B Esc | Existing meeting shortcuts (configurable in Settings) | Meeting and Content tabs |
| Alt+1 … Alt+4 | Meetings & Content · Studio · Members · Settings | Any tab |

All hotkeys are ignored while typing in a box or while a dialog is open. They work while the Command
Center window has focus (no system-wide keyboard hooks).

## 7. Storage (versioned JSON in the data folder)

* **`bsf-looks.json`** — `{"version": 1, "looks": {"warm": {...}, "dark": {...}, "neutral": {...}, "<your id>": {...}}}`.
  Values are clamped to safe ranges; a damaged file falls back to the built-in looks with a note.
* **`bsf-vcam-settings.json`** — on/off, webcam name, resolution, mirror, blur, cards, active look id.
* **`bsf-studio.json`**
```json
{ "version": 1,
  "layout": {"mode": "pip", "corner": "br", "size": "small", "custom": false, "x": 0.82, "y": 0.78, "scale": 0.3},
  "layers": [{"id": "L1a2b3c4d", "type": "image", "name": "Logo", "file": "logo.png", "visible": true,
              "x": 0.88, "y": 0.13, "w": 0.16, "rotation": 0, "opacity": 0.9, "loop": true, "page": 0}],
  "scenes": [{"id": "presentation", "name": "Presentation", "look": "neutral", "layout": {...},
              "screen": {"kind": "pdf", "file": "Sermon.pdf"}, "layers": [...]}],
  "activeScene": "presentation" }
```
* **`layers\`** — copies of pictures, videos and PDFs you add (scenes keep working if the originals move).
* IDs are stable and separate from names. Switching scenes reuses running sources (no pipeline rebuild).

## 8. Test plan

**Automated (in this repository's development environment, with simulated webcam/screen and sink):**
show/hide cards × 3 cycles; preview = virtual-camera frame; looks vs reference formula (±1/255); looks
leave cards untouched; layouts; layer types, transforms, hide, reorder; play-once video; PDF next/previous;
scenes save/switch/restore; uploads (wrong types refused); test recording; tray actions; Studio UI clicks
and hotkeys.

**On the Windows PC (BUILD-AND-INSTALL.md checklist):**
1. **Latency (glass-to-glass):** Studio → tick *Latency test*. In a Zoom test meeting showing BCC vCam,
   screenshot the Studio clock and your Zoom self-view together; difference = full delay (target < 200 ms).
   Settings → Diagnostics shows *capture-to-send* (this app's part, target < 15 ms).
2. **CPU:** Diagnostics shows the app's CPU %; compare with Task Manager. Test each layout, each look,
   blur on/off, with a playing video layer. Dropped frames should stay at 0.
3. **Frame rate:** camera fps vs output fps must match (about 30).
4. **Visual quality:** share a document with small text — readable in Zoom at 720p and 1080p; check skin
   tones with Warm/Dark/Neutral in daylight and lamp light; cards sharp on top of a shared screen.
5. **Recording:** Studio → *Record test* for 30 s, play the MP4: smooth, matches what Zoom showed.
6. **Screen sharing:** a display (cursor visible, nothing changing → app CPU stays low), a PowerPoint
   slide show window with Page Down/Up, a PDF deck.

## 9. Differences from a GPU-first specification (measured, this development machine)

| Specification | This build | Measured (720p unless noted) |
|---|---|---|
| Grading on the GPU | CPU: LUT + matrix (+ vignette) | Neutral 1.9 ms · Warm 2.3 ms · Dark+vignette 3.1 ms (1080p 4.3–7.1 ms) |
| Layer compositing on the GPU, zero-copy | CPU, cached transforms, one 8-bit blend per layer | camera + logo + playing video + PDF slide: 1.1–1.3 ms |
| Screen layouts | CPU, screen resized only when it changes | 1–1.5 ms unchanged screen; +3–4 ms on frames where it changed |
| Grade + compose + layers < 5–8 ms | met in the measured scenes | full heavy scene: 6.7 ms of work per frame, capture-to-send 6.7 ms, 0 dropped |
| Hardware encoder for the camera | not applicable (uncompressed hand-over to Zoom/Teams) | — |
| GPU usage in Diagnostics | GPU not used, shown as such | — |
| macOS | not implemented (Windows-only app); capture isolated behind one interface | — |

These figures come from a slow shared development machine; your laptop's figures appear in
Settings → Diagnostics and the Studio tab.

## 10. Version 4.1: Camo-style Studio and scene model

**Everything is a layer.** Layer types: `camera` (the webcam), `screen` (the shared display/window/PDF),
`text`, `image`, `rect`, `ellipse`, `background`, `video`, `pdf`, `window`.
Every layer has `x, y` (centre), `w, h` (independent size; `h = 0` keeps the source's proportions),
`rotation`, `opacity`, `radius` (corner radius), `visible`, `locked`, and type-specific `props`.
A scene that contains camera, screen or background layers is drawn entirely from layers ("scene mode");
older scenes made with the fixed layouts keep working unchanged.

**Cost control.** Text and shapes are drawn once and cached (text re-drawn only when its resolved text
changes, e.g. `{{time}}` once a minute). Camera and screen layers are copied straight in; rounded corners
blend only the four corner squares. A shared screen is resized only when its picture changes (DXGI/WGC
deliver frames only on change). Measured (camera + screen with rounded corners + name bar + text):
720p 6.2 ms/frame with a still slide, 14.8 ms when the screen also changes every frame;
1080p 13.9 / 26.6 ms.

**Preview / Output.** In Preview the Studio edits a private copy (`staged`), rendered on demand at
640×360; *Send to output* swaps it in. **Scene collections** group scenes; each saved scene gets a
320×180 thumbnail (`scenes/<id>.jpg`). (Version 4.3 removed the Personalise / variables panel; `variables` values saved earlier are still used by existing text layers.)

**Screen-sharing reliability (4.1 fix).** Displays: Windows Graphics Capture first (works on laptops with
two graphics chips, includes the cursor), DXGI Desktop Duplication as fallback. Each attempt must deliver a
first frame within 3 s; options step down from (cursor + borderless) → (cursor) → (Windows defaults) because
borderless/dirty-region/update-interval settings are only available on newer Windows builds. Every attempt
and its error is reported in the Screen layer's inspector, Diagnostics and `bsf-app-log.txt`.

## 11. Version 4.2: changes and performance review

**Data-model changes (all optional; older versions ignore them):**
`layout.panel` minimum 50 (was 55). Library questions gain `num`, `note`, `pair`; verses gain `pair`
(question ↔ verse link from an Excel row). BCC vCam settings gain `blurStrength` 0–100 (old `blur`
off/light/strong is still written: ≤45 → light, else strong; old files map off→0, light→30, strong→80).
Studio: the private Preview copy (`staged`) is no longer exposed; a leftover one is applied once.

**New pieces:** `app/present.html` (Presentation window), `GET /api/present.mjpg` (this PC only; motion-JPEG,
a frame only when the picture changes, repeated once so a still frame displays, stops when the window
closes), `POST /api/app/present` (opens/closes the pywebview window), `app/js/content-import.js` +
`app/js/import-worker.js` (Excel/CSV parsed in a Web Worker), resource monitor in Diagnostics.

**Performance review — resource-heavy areas found and what changed (measured on the development machine):**

| Area | Before (4.1) | After (4.2) |
|---|---|---|
| Update checks: dashboard + every embedded preview polled every 0.3 s, even minimised | 651 requests/min on Run meeting | 261/min (previews share the dashboard's updates); ~20/min when minimised |
| Minimised dashboard with Studio open kept requesting live pictures (camera engine + webcam kept running, preview encoding) | 1,407 requests/min, 19.4 % of a core | 57 requests/min, 1.6 % |
| Meeting tab live picture while BCC vCam live, Settings preview: continued while minimised | 4 pictures/s | stopped while hidden |
| Presentation window with a still scene: engine rebuilt the frame 30×/s | 22.1 % of a core, 0 frames sent | 4.1 % (idle rhythm 5×/s, woken instantly by any change) |
| Fixed-interval timers (status lights, program tiles, badge copy, file check) | ran always | skipped while hidden / event-driven / 5 s safety net |
| Deleted Studio layers left cached pictures in memory | grew with each edit | freed on deletion |
| Excel import | (new) | parsed in a background worker: 5,000 rows read + previewed in 0.8 s, longest UI pause 63 ms |
| Presentation stream when the window closed with a still scene | kept the engine awake forever | detected within 1 s, stream ends |

**Unchanged by design:** while Zoom uses BCC vCam the engine runs at a steady 30 fps (a camera feed must not
stutter); OpenCV is limited to 2 threads so Zoom keeps the rest of the CPU; the Studio canvas, when visible,
is a live editor (~5 pictures/s).

**Safeguards:** idle pacing everywhere (`Store.pace`), visibility-aware loops, engine idle rhythm + kick on
change, stream disconnect detection, cache cleanup, and Settings → Diagnostics → Resources (memory, threads,
requests/min by kind, Presentation windows, per-stage camera timings, plain-language tips).

## 12. Version 4.3

* **Presentation window**: pywebview `frameless=True, easy_drag=True`, 1280×720 content. Full Screen calls the
  window's own `toggle_fullscreen()` through `POST /api/app/present {"fullscreen": "toggle"|true|false}`;
  `{"query": true}` reports `{desktop, fullscreen}` so Esc leaves full screen before closing. Browser popups
  (no installed app) keep the page's fullscreen API (a browser cannot hide its own popup frame).
* **Blur steps**: `blurStrength` is 0 (off) or 0.5…100 in 0.5 steps; values are rounded half-up (same as the
  screen) and clamped. The engine's `blurMs` now follows `blurStrength` (it was tied to the old `blur` field).
* **Camera quality**: MJPG requested for Media Foundation too (with a check of the delivered size and a fallback
  to the default mode, keeping the larger picture); `fit_cover()` keeps the aspect ratio (INTER_AREA shrinking,
  INTER_CUBIC enlarging); previews 960 px at JPEG 85 (only while a preview is open: about +0.9 ms/frame);
  the delivered webcam mode is shown as `captureInfo`.
* **Personalise / variables removed** from the Studio UI and API (`op: "variables"`, `variables`,
  `builtinVariables`); new text layers default to plain text. Values saved by older versions in
  `bsf-studio.json` are still applied to existing text layers so they don't suddenly show `{{…}}`.

## 13. Version 4.4: smooth multitasking (GPU / compositor load)

Report: Task Manager showed GPU 100 % (Desktop Window Manager 68.5 %, the app's WebView2 GPU process 27.9 %).
Measured causes and fixes (Chromium timeline: frames the window presents per second, nothing changing):

| Cause | Fix | Before → after |
|---|---|---|
| Endless pulse on the LIVE dot (whenever anything is live) | pulses 3×, then static; recording dot static | Meeting tab: 60.2 → 2.3 frames/s |
| Header `backdrop-filter: blur()` (GPU re-blurs the page under it on every change) | near-opaque background | — |
| In-app live pictures at 960 px, 3–5×/s | 640 px q80; Meeting 2/s, Studio 3/s (7/s while dragging), Settings 2/s | Studio: 11.7 → 8.3 frames/s, 23.5 → 16.7 paints/s |
| Pictures decoded even when unchanged | numbered previews (`ETag` / `If-None-Match` → 304); the engine skips encoding unchanged frames | no work for still scenes |
| Presentation window streamed up to 30 fps | 15 fps default (`presentFps`, Smooth = 30); engine runs at that rate when only the window needs pictures | 23.3 → 12.1 frames/s to the window |
| Helpers competing with the desktop and Zoom | blur model, card drawing, video decode, recorder, screen capture, Presentation encoding at THREAD_PRIORITY_BELOW_NORMAL (`vcam/priority.py`); camera loop normal | — |

## 14. Version 4.5: removing the browser engine's GPU load

Report after 4.4: "Microsoft Edge WebView2" still used ~90 % GPU, including the Presentation window.

* **Native Presentation window** (`vcam/present_window.py`): a Win32 popup window (WS_POPUP + WS_THICKFRAME with
  WM_NCCALCSIZE → frameless but resizable and snappable; WM_NCHITTEST → drag to move / resize edges; WS_EX_APPWINDOW
  so Zoom lists "BSF Presentation"). Frames come in-process from the compositor (no JPEG), are converted to 32-bit
  once per new picture (~0.5 ms) and drawn with GDI: `SetDIBitsToDevice` at 1:1, `StretchDIBits` (HALFTONE) when
  scaled, black bars with `PatBlt`. The Full screen / Exit buttons (Pillow, Source Sans, same design as the web
  version) are two small patches drawn only while shown (~0.5 ms). Repaints only when the picture changes, at
  `presentFps`. Esc: leave full screen, then close; F / F11 / double-click: full screen. Falls back to the
  WebView2 window (`present.html`) if the native window can't be created.
* **Light on graphics card** (`app settings: lowGpu`, default on): the desktop app sets
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--disable-features=ElasticOverscroll --disable-gpu --disable-gpu-compositing"`
  before WebView2 starts (the environment variable takes precedence over pywebview's arguments set in code; pywebview's
  own argument is kept). The dashboard is mostly static after 4.4, so CPU drawing is cheap.
* Verified here with a simulated Win32 layer (message flow, painting, hit-testing, full screen, close) and the
  desktop app with stand-in window/tray libraries; real Windows behaviour must be confirmed on the PC.

## 15. Version 4.5.1: second-open crash fixed

Opening the native Presentation window a second time crashed the app. Cause: each window registered the window
class with its own handler; Windows keeps the first registration (the second RegisterClassEx fails), so the new
window was driven by the first window's handler, which had already been freed → access violation. Fix: one window
class with one permanent handler for the app's lifetime (`_route`), which forwards each message to the window it
belongs to (by handle); windows register on creation and are removed on WM_NCDESTROY / end of their loop.
Verified with a simulated Win32 layer that behaves like Windows here (second registration fails): 2nd and 3rd
opens, closing from the app, 5 rapid open/close cycles. New safety switch `nativePresent` (Settings > General >
Performance) to fall back to the WebView2 Presentation window.

## 16. Version 4.6

* **Birthday bottom panel removed.** Its member chooser (`#bb-member`) and Country option (`#bb-country`) moved into
  the Meeting tab's Birthday card (same IDs, so the birthday logic is unchanged); its Show / Hide / Clear duplicated
  the Meeting tab and shortcuts. The 84 px bottom padding reserved for it is gone.
* **Blur in 0.1 % steps**: `blurStrength` 0 (off) or 0.1…100, rounded half-up to 0.1; any positive value ≥ 0.1.
* **PowerPoint slides** (`vcam/layers.py`): all COM calls go through one helper thread with `CoInitialize`
  (web request threads never had COM initialised, so Next slide silently failed); `GetActiveObject(…, dynamic=True)`
  (no comtypes code generation, which fails in the installed app); slide show (prefers the show whose HWND is the
  captured window) or normal view (`GotoSlide`); fallback Page Down/Up to the window and its child windows
  (PowerPoint reads keys in a child window). Results: `{"page", "pages"}` or `{"error"}`. Presentation layers are
  now loaded on demand for slide moves (previously only once the camera engine had drawn them).
* **Remote Studio controls**: `GET/POST /api/remote/studio` on the PIN-protected remote allowlist. POST allows only
  `{"op": "scene", "id"}` and `{"op": "slide", "step"}`; everything else in the Studio stays PC-only.

## 17. Version 4.7: picture quality profile and remote Navigation Dashboard

**Pipeline order** (`vcam/engine.py`): webcam → crop + zoom + resize in **one** resample (`fit_cover(…, zoom)`; area
when shrinking, bicubic when enlarging) → mirror → colour-range fix (optional 16–235 → 0–255) → background blur
(the person mask sees the true colours) → filter (Camera Look × `filterIntensity`) → adjustments → layers/cards → BCC vCam.
The per-pixel steps run at output size after the single resample; sharpening is last, so nothing resamples a sharpened picture.

**Adjustments** (`vcam/picture.py`, order: exposure, white balance, brightness, contrast, gamma, saturation, vibrance,
hue, sharpness). Exposure and white balance act on linear light inside one 256-entry table per channel; saturation and
hue are 3×3 matrices (folded into one when vibrance is 0); vibrance is a per-pixel blend with a saturated copy weighted by
1 − chroma (4–6 ms at 720p here); sharpness is an unsharp mask (amount ≤ 0.8, σ 1). All neutral → nothing runs.

**Settings schema 2** (`bsf-vcam-settings.json`, `schemaVersion: 2`). Files without `schemaVersion` are migrated on read;
the defaults reproduce the version-1 picture exactly (`filterIntensity` 100, `zoom` 1.0, `captureResolution` "auto",
adjustments 0, camera controls untouched). Older app versions ignore the new keys. `filterName` is an alias of `look`;
`backgroundMode` (none/blur) is derived from `blurStrength`. `POST /api/vcam/settings {"applyProfile": "meetings"}` applies
the Meetings profile (720p, 30 fps, 1080p capture, zoom 1.01, auto exposure/white balance, Warm at 25 %); changing a
value the profile sets switches `outputProfile` to "custom". `spotlight`/`retouch` are stored but not implemented (always off).

**Camera controls** go through OpenCV (`cap.set`), best effort: "auto" values are never written, so the driver's own
automatic exposure/white balance stay in charge; manual values report "applied" or "not supported" in Diagnostics.
Power-line frequency (anti-flicker) is not exposed by OpenCV; the setting is stored and reported, and the driver's value is
kept. A future native step: `IKsControl` / `KSPROPERTY_VIDEOPROCAMP_POWERLINE_FREQUENCY` on the webcam's DirectShow filter.

**Output**: softcam offers RGB24 only, so BCC does no YUV conversion of its own (the meeting app converts once).
`outputPacing` "fixed" creates the camera with a frame rate (`scCreateCamera(w, h, 30)`) instead of 0 (follow the webcam);
test on the PC before making it the default. Diagnostics add input/output size, pacing, late frames, black/white level
(1st/99th luma percentile) and camera-control results.

**Remote** (`app/remote.html`, `js/remote.js`, `css/remote.css`): `body[data-view]` = home | question | verse | birthday |
studio | scenes | slides | preview | all. The remote opens on the Navigation Dashboard (big buttons with live status).
Section views show the existing panes (hidden/shown with `.off-view`, never rebuilt), so slide, scene and list state is kept.
Home button, Esc and the phone's back gesture (history state) return to the dashboard; arrow keys move between buttons.
"All controls" is the previous all-in-one Live Control screen (quick-switch bar and folding work there as before).
No API or command changed.

## 18. Version 4.8: PowerPoint reliability, compact remote, live-meeting efficiency

**PowerPoint** (`vcam/powerpoint.py`, no OpenCV needed). Root causes fixed: (1) Next/Previous only reached PowerPoint
when the slide show was captured as a Studio screen/layer - a full-screen show shared directly in Zoom/Teams got
nothing, and the remote hid Slides; `server.slide_move()` now falls back to the running slide show (the active one,
or the captured window's), and `remote_studio_info()` reports it (cached 2 s). (2) A slow COM call (5 s timeout) was
followed by a Page Down fallback while the COM call was still queued -> two slides; keys are now sent only to a
captured window that is not PowerPoint. (3) Presses queued behind a slow call fired late; now one command at a time,
presses during a running command or within 120 ms are dropped (`busy`), atomically. The PowerPoint connection is kept
and re-made after a restart; a paused (black/white screen) show resumes on Next. PC Page Up/Down ignore key-repeat.

**Remote** (`remote.html/js/css`): every section is a compact card - controls first (`[Prev][Show][Next][▼]`,
Birthday `[Show][▼]`, Slides `[Prev][Next][▼]` with "5 / 18", Scenes = scene buttons, Preview = `[Show preview]`),
details on ▼ (text, next item, list, hold-to-clear, slide source). Cards open independently, start collapsed, and keep
their state between screens. Details are rendered only while open; the preview iframe loads only while open. Slide
buttons send one command at a time. Updates are event-driven (`Store.start({longPoll: true})`). Toasts at the bottom.

**Efficiency.** Phone remote and PC dashboard: long-poll `/api/state?since=&wait=10` instead of `/api/rev` every
300 ms (~200 -> ~6 requests/min idle; overlay pages keep short polls - OBS sources share one connection pool).
Library skipping: the server tracks `libraryRev`; a save with `keepLibrary` and a long-poll with `librev` leave the
library out (1,000-item library: ~1.1 MB -> ~2.6 KB per tap). Older clients get the full state as before.
Network check (PowerShell) cached 15 min (60 s with Settings > Remote open) instead of starting every minute; LAN
addresses cached 10 s; Studio's window/display list cached 3 s; vCam top-bar light uses `?lite=1` (no webcam
enumeration); one presence poll instead of two; header chips/lights write to the page only on change; Meeting
safety re-render 2 s -> 10 s; background polls slow down while minimised.

## 19. Version 4.9: Studio workspace, control bar, natural blur, design system

**Navigation.** Three top tabs: Studio · Members · Settings (`nav.js` GROUPS). The former *Meetings & Content* views
moved into the Studio. **View ids are unchanged** (`meeting`, `overlays`, `studio`, `recordings`): `BSFSetTab()`,
`data-goto`, `body.dataset.tab` checks, keyboard shortcuts and the startup view (`meeting`) all behave as before.
Alt+1 Meeting · Alt+2 Canvas · Alt+3 Members · Alt+4 Settings (the old destinations). The saved "last sub-view"
(`bsf-cc-subtab`) is migrated from `meetings` to `studio`.

**Studio workspace** (`dashboard.html` `#studio-ws`): `#studio-rail` (Scenes on top, Layers beneath, built by
`studio.js` - same functions, new parent) | `#ws-main` (view switcher `#sub-studio` + the four view panels). The
Canvas view is canvas + Inspector. The rail folds (`body.rail-hidden`, remembered). `studio.js` polls
`/api/vcam/studio` every 1 s with the Canvas open, every 3 s while the rail is visible, otherwise not
(minimised: paced). `.ws-main` is a CSS container; the Meeting grid follows its width (`@container ws`).

**Control bar** (`#ctlbar`, wired in `meeting.js`): calls `BSFActions.step/toggle/hideAll`, `BSFBirthday.toggle`,
`BSFStudio.slide` (or `POST /api/vcam/studio {op:"slide"}`) through the same `guard()` (450 ms) as the Meeting view.
Layout heights `--top-h`, `--ws-top`, `--cb-h` are measured in `nav.js`; `meeting.js fit()` and `studio.js fitStage()`
subtract the bar.

**Design system** (`css/theme.css`, loaded last): radius 8/12/16/20, type scale, motion tokens, dark (default) and
light palettes. Dark-only colours in `dashboard.css`/`console.css`/`members.css` were replaced by tokens whose
fallback is the old value. Appearance (`bsf-cc-theme`: dark | light | system) is applied by an inline script before
the first paint. No backdrop-filter, no endless animation; transitions on colour/transform only.

**Blur** (`vcam/blur.py`, `server.clean_vcam`, `vcam-panel.js`): `blurStrength` 0.001…100 in 0.001 steps (decimal
rounding from the shortest repr: no drift), `blurStyle` natural (default) | classic. Natural: full-size sigma =
classic from 10 % up, `25.6 × (s/10)^1.15` below; working scale 1/1…1/8 chosen so the blur is ≥ 2 px there;
mask-normalised blur (no halo); inward-only edge feather growing with strength; mild near/far gradation (0.8×).
Classic is bit-identical to 4.8 (tested). UI: curved slider (`s = 100·x²`), exact number box, ±0.001 (Shift ±0.1),
values held as integer thousandths in JS.

**Performance (large lists).** Each Next/Show used to rebuild the hidden Content lists (2 × N rows), a hidden picker
and the whole run sheet (~0.7 s at N = 1,000). Now: Content lists and effect controls are drawn only while Content /
Settings is open (`BSFRenderLists` on open), only rows whose state changed are replaced, the run sheet patches the
rows between the old and new position, and fixed elements are looked up once. ~25 ms per step at N = 1,000.

**Mobile remote protection boundary.** `remote.html`, `js/remote.js`, `css/remote.css`, `js/store.js`,
`remote-manifest.json`, icons and every `/api/remote*`, `/api/state`, `/api/rev` handler are untouched in 4.9
(verified with `git diff` against 4.8). All 4.9 changes are in PC-only files or in local-only (`is_local()`)
endpoints; `theme.css` is linked only from `dashboard.html`.

## 20. Version 5.0: simpler surface and Question · Both · Verse

**Presentation mode** (`js/store.js` → `window.BSFPresent`, shared by the dashboard, the remote and the overlays).
State: optional `question.mode` (last chosen) and `library.questions[].mode` (per question; Excel `PresentationMode`);
`''` = unset = `question` = the pre-5.0 behaviour. `mode(st)` = the item's mode, else the last chosen. Hooks (inside
`Store.update`): `afterShow(n)` after existing code makes the question visible (Both: load the linked verse -
`pair` - else keep the loaded verse, and show it; Verse: also hide the question), `hide(n)`, `setMode(n, m)` (if on
screen, the picture follows at once), `live(st)`, `preview(st)` (what Show would do; used by `stage.html?pending=1`),
`combined(st)` (Both with both on screen). Callers: `dashboard.js` show/hide/toggle (so the action bar, keyboard,
run sheet and Content all follow), `remote.js` toggle/showItem, `meeting.js` selectors. Unit tests cover the rules.

**Both layout:** `overlay.js effective()` and `vcam/cards.py effective_layout()` scale the verse ×0.86 and the
question ×1.06 only when `combined()`; `placeVerse` / `place_verse` use the same numbers, so the verse still shrinks
and reflows above the question. The vCam card cache key includes the layout, so a mode change redraws at once.

**UI consolidation** (presentation only; every handler, id used by code, API and data flow kept):
- Header: brand · search (`nav.js`, navigation only - never shows anything) · `#live-ind` (from `refreshStatus`) ·
  `#sysstat` (the four `.hchip` elements inside; summary via MutationObserver). Removed: About button (Settings →
  About), header Hide all, on-air pills (JS guarded with null checks).
- Meeting view: run sheet | program | details panel (`[data-ctx]` tabs, `[data-ctx-panel]`); Prev/Show/Next only in
  the action bar; `data-state`/`data-text`/`data-next` hooks kept so `meeting.js render()` is unchanged.
- Action bar: mode selector + key hints; birthday Show disabled when nobody to celebrate (as the Meeting button was).
- Content: Hide/Clear/Previous/Next removed (action bar / details panel); style rows in `<details class="adv">`;
  row tools shown on hover / focus-within (CSS only).
- Canvas: scene select, collection filter and Look select no longer appended (objects kept; no code path changed).
- Excel: `PresentationMode` column (import with validation, template, new Export to Excel; same columns round-trip).

**Measured (1600×900, first screen, excluding list rows):** header controls 6 → 2; Meeting workspace 13 → 7;
Content workspace 41 → 21; Canvas workspace 8 → 5 (while adding the mode selector and search).

## 21. Version 5.1: Command Center layout and BCC Mobile Director

Presentation and navigation only: the state model, every API, the remote allowlist, PowerPoint/vCam code, blur and
storage are unchanged. New code reads existing state; every button calls an existing action.

**Desktop**
- Command bar (`dashboard.html` header): brand (`#org-title` = Settings `groupName` + " Command Center", long names
  keep "BSF") · the three section tabs (moved into the header; same ids, `data-group`, Alt keys) · search · `#live-ind`
  · `#sysstat`: the `.hchip` chips are inline on wide windows; ≤1480 px they fold into `#sys-sum` (a button toggling
  `.open`; Esc closes it and still hides all). New chips `#h-rec` / `#h-slides` show only while recording / presenting.
  Search (`nav.js`) adds birthdays, scenes (pointed out in the rail, never applied), PDF decks and Settings pages.
- Rail (`js/rail.js`, new, loaded after `studio.js`): "Broadcast layers" = the three cards as the pinned top of the
  stack (eye = `BSFActions.toggle` / `BSFBirthday.toggle`, row = open in the Inspector), quick add (clicks the existing
  `#add-text/#add-image/#add-camera/#add-pdf` menu items) and a Library (counts from the store, members API and
  `BSFStudio.state()`; each row navigates). `studio.js` exposes `BSFStudio.state()` (read-only), marks scene cards
  with `data-scene`, and keeps polling while the Meeting view or a recording is on screen.
- Meeting view: run sheet | program + Live outputs (`#outputs`, `meeting.js renderOutputs()` once a second, DOM
  written only on change: BCC vCam status/size/fps/latency/dropped from `BSFVcamStatus`, overlay pages from
  presence, Presentation window and Recording from `BSFStudio.state()`, slides from `GET api/remote/studio` every 5 s
  while the view is visible, remote from `remote-info`) | Inspector (`[data-ctx]` target, `[data-itab]` Content / Style).
  Style hosts extra `data-range` / `data-seg` controls bound by the existing `bindRanges` / `buildSegs`;
  `controlsVisible()` counts the Style tab and `BSFRefreshControls()` refreshes them when it opens.
- Command bar (bottom): unchanged groups + `#cb-take` "Take live" = `A.toggle(ctxNow)` (birthday: `BSFBirthday.toggle`),
  shortcut `takeLive` (default T, configurable; Space/Enter are reserved by the shortcut editor).
- Theme: cooler graphite tokens, `--accent` (selection/focus), `--take`, `--mica` (a static gradient, no backdrop blur).

**Remote** (`remote.html/css/js`; same three files, so the server allowlist is unchanged)
- Phones: tabs Live · Run sheet · Scenes · Preview · All (`body[data-tab]`, history-aware); Live = Now panel
  (`renderNow()` from state) + quick show/hide (`data-do="toggle"`, same handler and 0.6 s guard) + target picker
  (`body[data-target]`) + that card. The preview iframe runs only on the Preview tab (tablets: open by default).
- Tablets (≥900 px): run sheet column + Now/preview + every card. Portrait: run sheet below.
- Run sheet replaces the Lists drawer: same `showItem`, rows patched in place on each step, double-tap guard.
- Layouts (`body[data-role]`, localStorage `bcc-remote-role`): Presenter / Leader / Producer / Admin choose tabs,
  targets and cards. They are a view preference, not permissions: the PIN still governs access.

## 22. Version 6.0: Scenes · Layers · Canvas

One Studio workspace replaces the Meeting / Content / Canvas / Recordings tabs and the run sheet. Old ids are kept
inside the Inspector where possible, so the existing editors (`dashboard.js`, `content-import.js`, birthday) still
bind unchanged; `rail.js` is removed.

**Model** (`store.js`, `window.BSFScenes`; new top-level keys must also be in `DEFAULT_STATE` because `normalize`
only merges known keys)
- `scenes[]`: `{id, name, group, fav, tpl, created, modified, version, creator, from, template, parent,
  tx {type, ms}, auto {on, sec}, out {vcam, obs}, layers[]}`. Layer: `{id, kind, name, visible, locked, opacity, c}`.
  Kinds: cards (`scripture`, `question`, `birthday` - drive the existing `verse` / `question` / `birthday` state on
  take), text (`announcement`, `prayer`, `lowerthird`, `countdown`) and media (`camera`, `screen`, `window`, `image`,
  `video`, `pdf`, `background`, `text`, `rect`, `ellipse` - converted to/from compositor layers by
  `mediaToComp` / `compToMedia`).
- `live`: `{scene, seq, at, tx, txMs, auto, blackout, emergency, message, on {layerId: bool}, cd {layerId: start}}`;
  `profile` = global transition profile; `v6` = migration done (`BSFScenes.migrate`, run once by `workspace.js`).
- `take(st, id, tx)` applies a scene in one `Store.update`; `duplicate(opts)`, `explode`, `uniqueName`,
  `previewState` (a scene as if live, for `stage.html?scene=ID`), `liveText(st, output)` (empty text layers are
  skipped, countdown excepted).

**Server** (`server.py`, `APP_VERSION = "6.0"`)
- `save_state` → `apply_live_media`: the live scene's media layers become the compositor layers; `media_sig` avoids
  write-back loops (the `layers` op stores `VCAM["mediaSig"]`).
- Scripture: `GET /api/scripture?ref=&fresh=`, `GET/POST /api/scripture/settings` (local only; the key never reaches
  the remote). ESV v3 text API (`BSF_ESV_URL` overrides it for tests), cache `bcc-scripture-cache.json` (400 entries,
  stale entries served when offline), settings `bcc-scripture.json`.
- `remote_studio_info` adds `vcam {state, inUse, fps}` and `recording {on, seconds}`.

**Renderers**
- `vcam/program.py` `ProgramFX` (set as `Compositor.program_fx`, applied after the cards): text layers drawn on a
  worker thread with `CardDrawer`, scene transitions blended from a snapshot of the previous program frame,
  Blackout and the Emergency slate. About 0.9 ms per 720p frame. `vcam/overlay.py` hides cards on Blackout /
  Emergency or when `out.vcam` is false.
- `overlay.js`: `TextLayers` and `Program` (black, slate, dips; `body[data-stx]` makes card entries follow the scene
  transition), output rules (`out.obs`), `?scene=ID` preview. `stage.html` mounts both.

**Desktop** (`dashboard.html`, `js/workspace.js` new, `js/scripture.js` new, `meeting.js` slimmed)
- `.ws` grid: Scenes + Layers | Studio Canvas (the Studio host when live with BCC vCam, else the overlay iframe with
  media outlines) | Inspector (`#insp-tabs` per selection; `.ip[data-kind][data-itab]` panels hold the moved editors)
  | Live bar (`#ctlbar.livebar`).
- `studio.js` mounts only its centre into `#tab-studio`; canvas edits flow back to the scene via
  `BSFStudio.onPush`, canvas selection via `BSFStudio.onSelect`.
- Settings gains Scripture, Transitions and Recording (`#tab-recordings` moved there; `BSFLoadRecordings` on open).
  Tab aliases (`members.js`): meeting / overlays / canvas → studio, recordings → settings › recording.
- Shortcuts: `takeLive` T, `nextScene` ], `prevScene` [; Ctrl+D duplicates the selected scene.

**Remote** (`remote.html/css/js`, same files so the allowlist is unchanged): Scenes | Live canvas + controls | Layers;
phones use tabs, ≥900 px shows three panes. Every action writes through the same `Store.update` path as the desktop.

## 23. Version 6.1: Kingdom Connect

**Name.** Visible name "Kingdom Connect" (window title `DISPLAY_NAME` in `desktop_app.py`, tray, messages, dashboard,
remote, installer `AppName`, shortcuts, output file `Kingdom Connect v<ver>.exe`, workflow artifact). Identity is
unchanged on purpose: `APP_NAME` (data folder `%APPDATA%\BSF Command Center`, single-instance ping `app` field), install
folder and exe name (the phone-remote firewall rule is tied to the exe path), backup file `app` tag, Videos folder,
camera name "BCC vCam" and its CLSID. `[InstallDelete]` removes the old-named shortcuts.

**Brand assets** (`app/img`): `kc-emblem.webp` (header, About, remote; in `REMOTE_PUBLIC`),
`kc-world.svg` (dotted map generated by `tools/make_world_map.py` from rough continent outlines; one `<path>`, shown as an
`<img>`). Icons `app/icons/remote-*.png` and `packaging/bsf.ico` are cut from the supplied logo. `server.py` serves `.webp`.

**About** (`js/about.js` + `css/about.css`, words in `js/brand.js`): hero (static map image, three inline network SVG
layers, two of them fading by `opacity` with `will-change`, a radial glow drifting by `transform` - compositor-only,
off under `prefers-reduced-motion`, stopped when the section is hidden), then mission/vision, why, audiences, values,
impact, rotating Scripture card (14 s, only while visible and not hovered), heart, founder card + story + journey,
commitment, join (Start a Session → `BSFQuickStart.open()`, Contact Us = mailto), footer. Header logo → Settings › About.

**Model** (`store.js` `BSFScenes`): `library` (16 entries, `libraryCats` five categories), `quickStarts` (four sets of
six), `fromLibrary(st, id | '@kind', opts)`, `quickStart(st, id, opts)` (new group "<Name> · <date>", unique per group),
`qsMode(sc)` / `setQS(n, sid, 'question'|'verse'|'both')` (scene layer visibility; on the live scene also the cards and
`question.mode`; the remote's Q + Scripture control uses it too), `pinQuestionText(n, sid, lid, text, afterId)`.

**Studio** (`workspace.js`): Library view replaces the Templates filter (`renderLibrary`); `qsPill` on scene cards (own
row via `:has()`); Quick Start dialog (`#qs-dlg`, empty-state and + Scene entries); `dupAndEdit` → `editQ` state renders
`editQuestionForm` in the Inspector until Done/Keep; Presentation Mode = `body.pm` (CSS hides Inspector, Layers, tools,
menus and live-bar extras; HIDE ALL stays), shortcut `presentMode` (P, configurable); Basic/Advanced = `kc-insp-adv`
(localStorage), `tabsFor()` filters tabs, `body.insp-basic` hides `.adv` rows and shows `.basic-only` rows (Theme =
`layout.panel` + `qScale`/`verseScale`; question Position = `qBottom` presets; scripture reuses `data-seg="verseAlign"`;
the birthday position block moves to Style in Basic). The Studio "Presentation Mode" window button is now "Share Window".

**Design** (`theme.css` v6.1 section, `remote.css` tail): navy/gold token overrides for dark and light (accent = gold on
navy, navy on paper), wordmark header; no new effects.

## 24. Version 6.2: leader branding, the meeting Excel template, Go Live

Full description (flows, data model, template columns, validation rules, file map): `docs/meeting-import-and-branding.md`.
- `state.brand` {meeting, org, color, logo, lw, lh, auto}; layer kind `brand` (a text-type layer, opt-in per scene);
  `{meeting}` / `{org}` and `c.logo` on text layers; accent colour → `--gold-*` on overlay pages and
  `cards.accent_palette` on BCC vCam (part of the card cache key). Logo = `DATA/bcc-brand-logo.png` via `api/brand/logo`.
- `js/meeting-sheet.js` (parse / validate / apply / template / export, no DOM, Node-tested) + `js/meeting-import.js`
  (dialog, Append / Replace / Cancel, ESV fill, one-commit apply, Undo) + `js/meeting-brand.js` (Settings section).
- Go Live: one primary action in the live bar (label constant, "● On air" sub-label, canvas flash); no take button
  in the Inspector; remote and menus renamed.

## 25. Version 6.3: one command bar, elastic panels, remote modes

- Command bar: `#ctlbar` moved inside `header.console-top.cmdbar` with `display:contents`; its controls are ordered in
  the header row by CSS `order`. Ids, handlers and shortcuts are unchanged. `#lb-prog` groups Hide layer, Blackout
  and Emergency; it becomes the Program ▾ menu below 1760 px. `--cb-h` measures 0 because a `display:contents`
  element has no height.
- `js/panels.js`: three splitters (`.kc-vsplit`, `.kc-hsplit`, `.kc-lsplit`) inserted into `#studio-ws`, which is a
  grid (≥1081 px):
  - CSS variables `--kc-left` (px), `--kc-canvas` (% of rows) and `--kc-scenes` (% of the left column);
  - classes `c-left`, `c-scenes`, `c-layers`, `c-insp` (folded) and `autohide` (`.ws-right.peek` opens over the
    preview);
  - drag via pointer capture and requestAnimationFrame; one `resize` event after a drag;
  - keyboard and ARIA separators;
  - saved in localStorage `kc-layout`;
  - `window.BSFLayout` {get, set, reset, focus}.
  The Inspector sits in grid row 3 with a container query that switches its content into columns.
- Remote: role ids are unchanged; the names are now Simple / Standard / Advanced. `body[data-role="presenter"]` is
  the thumb-zone layout.
- Design review: `docs/design/kingdom-connect-redesign.html`.
