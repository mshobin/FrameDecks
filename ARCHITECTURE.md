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
