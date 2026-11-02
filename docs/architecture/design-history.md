# FrameDecks: architecture, implementation plan and test plan

Covers Camera Looks, screen sharing, layers (image / video / presentation), scenes, diagnostics and test
recording in the program's built-in virtual camera, **FrameDecks**.

> **Design decision: "path A".** This build extends the existing working pipeline, which processes frames
> in system memory with OpenCV/NumPy (CPU), instead of adding a native GPU (D3D11) compositor. The working
> virtual camera (softcam) only accepts frames in system memory, so even a GPU compositor would copy every
> frame back once. Section 9 lists every place where this differs from a GPU-first specification, with
> measurements.

---

## 1. Architecture overview

```
              ┌──────────────────────────────── FrameDecks (one process) ──────────────────────────────┐
 Webcam ──MF──▶ Grabber thread ─▶ mirror ─▶ Camera Look ─▶ background blur ──┐                              │
 (OpenCV MSMF; │                 (flip)    (LUT + 3x3 matrix  (MediaPipe     │                              │
  off when not │                            + vignette)       selfie model)  ▼                              │
  needed)      │                                                    ┌─────────────────┐                     │
 Screen ─DXGI─▶ ScreenCapture thread (only new frames on change) ──▶│   COMPOSITOR    │                     │
 Window ─WGC──▶                                                     │ 1 base layout   │                     │
 PDF deck ────▶ PdfSource (rendered once per page) ────────────────▶│ 2 layers (z)    │─▶ FINAL FRAME ──┬──▶ softcam ─▶ "FrameDecks" ─▶ Zoom / Teams
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
| Camera Looks | `vcam/looks.py` | Data-driven colour grading (`kc-looks.json`) |
| Background blur | `vcam/blur.py` | Person mask (separate thread, 10 Hz) and blur |
| Screen sharing | `vcam/screen.py` | DXGI Desktop Duplication (displays), Windows Graphics Capture (windows) |
| Layers | `vcam/layers.py` | Image, video, PDF and window sources; transforms; z-order |
| Compositor | `vcam/compositor.py` | Layouts, layers, cards, latency clock, test recorder |
| Cards | `vcam/cards.py`, `vcam/overlay.py` | Verse / question / birthday cards and their transitions |
| Virtual camera | `vcam/sink.py` + softcam DLL | "FrameDecks" DirectShow camera (system-memory frames) |
| Control plane | `src/server.py` | Settings, studio, scenes, uploads (this PC only) |
| UI | `app/js/studio.js`, `nav.js`, `vcam-panel.js`, `meeting.js` | Camo-style Studio, four-tab navigation + Directory + Recordings, FrameDecks settings, Meeting preview |

**Threads:** UI (WebView2) · HTTP control · engine loop · webcam grabber · blur model · card drawing ·
screen capture · one per playing video · recorder. Only the engine loop touches the final frame; other
threads hand over their newest picture under a short lock (no waiting).

## 2. Implementation plan (APIs and libraries)

| Need | API / library (licence) | Notes |
|---|---|---|
| Webcam | Media Foundation through OpenCV `CAP_MSMF`; DirectShow `CAP_DSHOW` fallback | Listed by name with `cv2-enumerate-cameras` (MIT) |
| Virtual camera | softcam (MIT), renamed "FrameDecks", own CLSID | `scSendFrame` takes BGR frames in system memory |
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
**Meeting tab:** "On screen now" shows the real FrameDecks frame while it is live; **Look** menu in its header.
**Settings → FrameDecks Camera:** on/off, webcam, picture size, Look, blur, mirror, cards, preview, install.
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

* **`kc-looks.json`** — `{"version": 1, "looks": {"warm": {...}, "dark": {...}, "neutral": {...}, "<your id>": {...}}}`.
  Values are clamped to safe ranges; a damaged file falls back to the built-in looks with a note.
* **`kc-vcam-settings.json`** — on/off, webcam name, resolution, mirror, blur, cards, active look id.
* **`kc-studio.json`**
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

**On the Windows PC (docs/development/building-the-installer.md checklist):**
1. **Latency (glass-to-glass):** Studio → tick *Latency test*. In a Zoom test meeting showing FrameDecks,
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
and its error is reported in the Screen layer's inspector, Diagnostics and `kc-app-log.txt`.

## 11. Version 4.2: changes and performance review

**Data-model changes (all optional; older versions ignore them):**
`layout.panel` minimum 50 (was 55). Library questions gain `num`, `note`, `pair`; verses gain `pair`
(question ↔ verse link from an Excel row). FrameDecks settings gain `blurStrength` 0–100 (old `blur`
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
| Meeting tab live picture while FrameDecks live, Settings preview: continued while minimised | 4 pictures/s | stopped while hidden |
| Presentation window with a still scene: engine rebuilt the frame 30×/s | 22.1 % of a core, 0 frames sent | 4.1 % (idle rhythm 5×/s, woken instantly by any change) |
| Fixed-interval timers (status lights, program tiles, badge copy, file check) | ran always | skipped while hidden / event-driven / 5 s safety net |
| Deleted Studio layers left cached pictures in memory | grew with each edit | freed on deletion |
| Excel import | (new) | parsed in a background worker: 5,000 rows read + previewed in 0.8 s, longest UI pause 63 ms |
| Presentation stream when the window closed with a still scene | kept the engine awake forever | detected within 1 s, stream ends |

**Unchanged by design:** while Zoom uses FrameDecks the engine runs at a steady 30 fps (a camera feed must not
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
  `kc-studio.json` are still applied to existing text layers so they don't suddenly show `{{…}}`.

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
  so Zoom lists the window by its title). Frames come in-process from the compositor (no JPEG), are converted to 32-bit
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
(the person mask sees the true colours) → filter (Camera Look × `filterIntensity`) → adjustments → layers/cards → FrameDecks.
The per-pixel steps run at output size after the single resample; sharpening is last, so nothing resamples a sharpened picture.

**Adjustments** (`vcam/picture.py`, order: exposure, white balance, brightness, contrast, gamma, saturation, vibrance,
hue, sharpness). Exposure and white balance act on linear light inside one 256-entry table per channel; saturation and
hue are 3×3 matrices (folded into one when vibrance is 0); vibrance is a per-pixel blend with a saturated copy weighted by
1 − chroma (4–6 ms at 720p here); sharpness is an unsharp mask (amount ≤ 0.8, σ 1). All neutral → nothing runs.

**Settings schema 2** (`kc-vcam-settings.json`, `schemaVersion: 2`). Files without `schemaVersion` are migrated on read;
the defaults reproduce the version-1 picture exactly (`filterIntensity` 100, `zoom` 1.0, `captureResolution` "auto",
adjustments 0, camera controls untouched). Older app versions ignore the new keys. `filterName` is an alias of `look`;
`backgroundMode` (none/blur) is derived from `blurStrength`. `POST /api/vcam/settings {"applyProfile": "meetings"}` applies
the Meetings profile (720p, 30 fps, 1080p capture, zoom 1.01, auto exposure/white balance, Warm at 25 %); changing a
value the profile sets switches `outputProfile` to "custom". `spotlight`/`retouch` are stored but not implemented (always off).

**Camera controls** go through OpenCV (`cap.set`), best effort: "auto" values are never written, so the driver's own
automatic exposure/white balance stay in charge; manual values report "applied" or "not supported" in Diagnostics.
Power-line frequency (anti-flicker) is not exposed by OpenCV; the setting is stored and reported, and the driver's value is
kept. A future native step: `IKsControl` / `KSPROPERTY_VIDEOPROCAMP_POWERLINE_FREQUENCY` on the webcam's DirectShow filter.

**Output**: softcam offers RGB24 only, so FrameDecks does no YUV conversion of its own (the meeting app converts once).
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
moved into the Studio. **View ids are unchanged** (`meeting`, `overlays`, `studio`, `recordings`): `KCSetTab()`,
`data-goto`, `body.dataset.tab` checks, keyboard shortcuts and the startup view (`meeting`) all behave as before.
Alt+1 Meeting · Alt+2 Canvas · Alt+3 Members · Alt+4 Settings (the old destinations). The saved "last sub-view"
(`kc-subtab`) is migrated from `meetings` to `studio`.

**Studio workspace** (`dashboard.html` `#studio-ws`): `#studio-rail` (Scenes on top, Layers beneath, built by
`studio.js` - same functions, new parent) | `#ws-main` (view switcher `#sub-studio` + the four view panels). The
Canvas view is canvas + Inspector. The rail folds (`body.rail-hidden`, remembered). `studio.js` polls
`/api/vcam/studio` every 1 s with the Canvas open, every 3 s while the rail is visible, otherwise not
(minimised: paced). `.ws-main` is a CSS container; the Meeting grid follows its width (`@container ws`).

**Control bar** (`#ctlbar`, wired in `meeting.js`): calls `KCActions.step/toggle/hideAll`, `KCBirthday.toggle`,
`KCStudio.slide` (or `POST /api/vcam/studio {op:"slide"}`) through the same `guard()` (450 ms) as the Meeting view.
Layout heights `--top-h`, `--ws-top`, `--cb-h` are measured in `nav.js`; `meeting.js fit()` and `studio.js fitStage()`
subtract the bar.

**Design system** (`css/theme.css`, loaded last): radius 8/12/16/20, type scale, motion tokens, dark (default) and
light palettes. Dark-only colours in `dashboard.css`/`console.css`/`members.css` were replaced by tokens whose
fallback is the old value. Appearance (`kc-theme`: dark | light | system) is applied by an inline script before
the first paint. No backdrop-filter, no endless animation; transitions on colour/transform only.

**Blur** (`vcam/blur.py`, `server.clean_vcam`, `vcam-panel.js`): `blurStrength` 0.001…100 in 0.001 steps (decimal
rounding from the shortest repr: no drift), `blurStyle` natural (default) | classic. Natural: full-size sigma =
classic from 10 % up, `25.6 × (s/10)^1.15` below; working scale 1/1…1/8 chosen so the blur is ≥ 2 px there;
mask-normalised blur (no halo); inward-only edge feather growing with strength; mild near/far gradation (0.8×).
Classic is bit-identical to 4.8 (tested). UI: curved slider (`s = 100·x²`), exact number box, ±0.001 (Shift ±0.1),
values held as integer thousandths in JS.

**Performance (large lists).** Each Next/Show used to rebuild the hidden Content lists (2 × N rows), a hidden picker
and the whole run sheet (~0.7 s at N = 1,000). Now: Content lists and effect controls are drawn only while Content /
Settings is open (`KCRenderLists` on open), only rows whose state changed are replaced, the run sheet patches the
rows between the old and new position, and fixed elements are looked up once. ~25 ms per step at N = 1,000.

**Mobile remote protection boundary.** `remote.html`, `js/remote.js`, `css/remote.css`, `js/store.js`,
`remote-manifest.json`, icons and every `/api/remote*`, `/api/state`, `/api/rev` handler are untouched in 4.9
(verified with `git diff` against 4.8). All 4.9 changes are in PC-only files or in local-only (`is_local()`)
endpoints; `theme.css` is linked only from `dashboard.html`.

## 20. Version 5.0: simpler surface and Question · Both · Verse

**Presentation mode** (`js/store.js` → `window.KCPresent`, shared by the dashboard, the remote and the overlays).
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

## 21. Version 5.1: Command Center layout and FrameDecks Mobile Director

Presentation and navigation only: the state model, every API, the remote allowlist, PowerPoint/vCam code, blur and
storage are unchanged. New code reads existing state; every button calls an existing action.

**Desktop**
- Command bar (`dashboard.html` header): brand (`#org-title` = Settings `groupName` + " Command Center", long names
  keep only the group name) · the three section tabs (moved into the header; same ids, `data-group`, Alt keys) · search · `#live-ind`
  · `#sysstat`: the `.hchip` chips are inline on wide windows; ≤1480 px they fold into `#sys-sum` (a button toggling
  `.open`; Esc closes it and still hides all). New chips `#h-rec` / `#h-slides` show only while recording / presenting.
  Search (`nav.js`) adds birthdays, scenes (pointed out in the rail, never applied), PDF decks and Settings pages.
- Rail (`js/rail.js`, new, loaded after `studio.js`): "Broadcast layers" = the three cards as the pinned top of the
  stack (eye = `KCActions.toggle` / `KCBirthday.toggle`, row = open in the Inspector), quick add (clicks the existing
  `#add-text/#add-image/#add-camera/#add-pdf` menu items) and a Library (counts from the store, members API and
  `KCStudio.state()`; each row navigates). `studio.js` exposes `KCStudio.state()` (read-only), marks scene cards
  with `data-scene`, and keeps polling while the Meeting view or a recording is on screen.
- Meeting view: run sheet | program + Live outputs (`#outputs`, `meeting.js renderOutputs()` once a second, DOM
  written only on change: FrameDecks status/size/fps/latency/dropped from `KCVcamStatus`, overlay pages from
  presence, Presentation window and Recording from `KCStudio.state()`, slides from `GET api/remote/studio` every 5 s
  while the view is visible, remote from `remote-info`) | Inspector (`[data-ctx]` target, `[data-itab]` Content / Style).
  Style hosts extra `data-range` / `data-seg` controls bound by the existing `bindRanges` / `buildSegs`;
  `controlsVisible()` counts the Style tab and `KCRefreshControls()` refreshes them when it opens.
- Command bar (bottom): unchanged groups + `#cb-take` "Take live" = `A.toggle(ctxNow)` (birthday: `KCBirthday.toggle`),
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

**Model** (`store.js`, `window.KCScenes`; new top-level keys must also be in `DEFAULT_STATE` because `normalize`
only merges known keys)
- `scenes[]`: `{id, name, group, fav, tpl, created, modified, version, creator, from, template, parent,
  tx {type, ms}, auto {on, sec}, out {vcam, obs}, layers[]}`. Layer: `{id, kind, name, visible, locked, opacity, c}`.
  Kinds: cards (`scripture`, `question`, `birthday` - drive the existing `verse` / `question` / `birthday` state on
  take), text (`announcement`, `prayer`, `lowerthird`, `countdown`) and media (`camera`, `screen`, `window`, `image`,
  `video`, `pdf`, `background`, `text`, `rect`, `ellipse` - converted to/from compositor layers by
  `mediaToComp` / `compToMedia`).
- `live`: `{scene, seq, at, tx, txMs, auto, blackout, emergency, message, on {layerId: bool}, cd {layerId: start}}`;
  `profile` = global transition profile; `v6` = migration done (`KCScenes.migrate`, run once by `workspace.js`).
- `take(st, id, tx)` applies a scene in one `Store.update`; `duplicate(opts)`, `explode`, `uniqueName`,
  `previewState` (a scene as if live, for `stage.html?scene=ID`), `liveText(st, output)` (empty text layers are
  skipped, countdown excepted).

**Server** (`src/server.py`, `APP_VERSION = "6.0"`)
- `save_state` → `apply_live_media`: the live scene's media layers become the compositor layers; `media_sig` avoids
  write-back loops (the `layers` op stores `VCAM["mediaSig"]`).
- Scripture: `GET /api/scripture?ref=&fresh=`, `GET/POST /api/scripture/settings` (local only; the key never reaches
  the remote). ESV v3 text API (`KC_ESV_URL` overrides it for tests), cache `bcc-scripture-cache.json` (400 entries,
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
- `.ws` grid: Scenes + Layers | Studio Canvas (the Studio host when live with FrameDecks, else the overlay iframe with
  media outlines) | Inspector (`#insp-tabs` per selection; `.ip[data-kind][data-itab]` panels hold the moved editors)
  | Live bar (`#ctlbar.livebar`).
- `studio.js` mounts only its centre into `#tab-studio`; canvas edits flow back to the scene via
  `KCStudio.onPush`, canvas selection via `KCStudio.onSelect`.
- Settings gains Scripture, Transitions and Recording (`#tab-recordings` moved there; `KCLoadRecordings` on open).
  Tab aliases (`members.js`): meeting / overlays / canvas → studio, recordings → settings › recording.
- Shortcuts: `takeLive` T, `nextScene` ], `prevScene` [; Ctrl+D duplicates the selected scene.

**Remote** (`remote.html/css/js`, same files so the allowlist is unchanged): Scenes | Live canvas + controls | Layers;
phones use tabs, ≥900 px shows three panes. Every action writes through the same `Store.update` path as the desktop.

## 23. Version 6.1: FrameDecks

**Name.** Visible name "FrameDecks" (window title `DISPLAY_NAME` in `src/desktop_app.py`, tray, messages, dashboard,
remote, installer `AppName`, shortcuts, output file `FrameDecks v<ver>.exe`, workflow artifact). Identity is
unchanged on purpose: `APP_NAME` (data folder under the program's earlier name, single-instance ping `app` field), install
folder and exe name (the phone-remote firewall rule is tied to the exe path), backup file `app` tag, Videos folder,
camera name "FrameDecks" and its CLSID. `[InstallDelete]` removes the old-named shortcuts. (6.9 moved the
remaining identity to the FrameDecks name; see section 31.)

**Brand assets** (`app/img`): `framedecks-emblem.webp` (header, About, remote; in `REMOTE_PUBLIC`),
`framedecks-world-map.svg` (dotted map generated by `tools/make_world_map.py` from rough continent outlines; one `<path>`, shown as an
`<img>`). Icons `app/icons/remote-*.png` and `packaging/framedecks.ico` are cut from the supplied logo. `src/server.py` serves `.webp`.

**About** (`js/about.js` + `css/about.css`, words in `js/brand.js`): hero (static map image, three inline network SVG
layers, two of them fading by `opacity` with `will-change`, a radial glow drifting by `transform` - compositor-only,
off under `prefers-reduced-motion`, stopped when the section is hidden), then mission/vision, why, audiences, values,
impact, rotating Scripture card (14 s, only while visible and not hovered), heart, founder card + story + journey,
commitment, join (Start a Session → `KCQuickStart.open()`, Contact Us = mailto), footer. Header logo → Settings › About.

**Model** (`store.js` `KCScenes`): `library` (16 entries, `libraryCats` five categories), `quickStarts` (four sets of
six), `fromLibrary(st, id | '@kind', opts)`, `quickStart(st, id, opts)` (new group "<Name> · <date>", unique per group),
`qsMode(sc)` / `setQS(n, sid, 'question'|'verse'|'both')` (scene layer visibility; on the live scene also the cards and
`question.mode`; the remote's Q + Scripture control uses it too), `pinQuestionText(n, sid, lid, text, afterId)`.

**Studio** (`workspace.js`): Library view replaces the Templates filter (`renderLibrary`); `qsPill` on scene cards (own
row via `:has()`); Quick Start dialog (`#qs-dlg`, empty-state and + Scene entries); `dupAndEdit` → `editQ` state renders
`editQuestionForm` in the Inspector until Done/Keep; Presentation Mode = `body.pm` (CSS hides Inspector, Layers, tools,
menus and live-bar extras; HIDE ALL stays), shortcut `presentMode` (P, configurable); Basic/Advanced = `kc-insp-adv`
(localStorage), a per-mode tab list filters the tabs, `body.insp-basic` hides `.adv` rows and shows `.basic-only` rows (Theme =
`layout.panel` + `qScale`/`verseScale`; question Position = `qBottom` presets; scripture reuses `data-seg="verseAlign"`;
the birthday position block moves to Style in Basic). The Studio "Presentation Mode" window button is now "Share Window".

**Design** (`theme.css` v6.1 section, `remote.css` tail): navy/gold token overrides for dark and light (accent = gold on
navy, navy on paper), wordmark header; no new effects.

## 24. Version 6.2: leader branding, the meeting Excel template, Go Live

Full description (flows, data model, template columns, validation rules, file map): `docs/reference/meeting-workbook-and-branding.md`.
- `state.brand` {meeting, org, color, logo, lw, lh, auto}; layer kind `brand` (a text-type layer, opt-in per scene);
  `{meeting}` / `{org}` and `c.logo` on text layers; accent colour → `--gold-*` on overlay pages and
  `cards.accent_palette` on FrameDecks (part of the card cache key). Logo = `DATA/bcc-brand-logo.png` via `api/brand/logo`.
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
  - `window.KCLayout` {get, set, reset, focus}.
  The Inspector sits in grid row 3 with a container query that switches its content into columns.
- Remote: role ids are unchanged; the names are now Simple / Standard / Advanced. `body[data-role="presenter"]` is
  the thumb-zone layout.
- Design review: `docs/project/history/framedecks-redesign.html`.

## 26. Version 6.4: Team Space (peer-to-peer over WireGuard), FrameDecks camera, logo only, native window

> **Removed in 6.5.** Team Space (`teamspace.py`, `app/js/teamspace.js`, its routes and settings) was removed in
> version 6.5; see section 27. The notes below are kept as history.

Full description: `docs/reference/features.md`. Set-up: `docs/reference/configuration-guide.md`.

- **Team Space** (`teamspace.py`, `app/js/teamspace.js`).
  > Team Space is available only when authorized peers are online through a secure WireGuard network. No cloud
  > relay or third-party server is required.
  - A second `ThreadingHTTPServer` is bound to this PC's WireGuard address only (port 8790). It answers only
    `POST /team/v1`. The main server stays on `127.0.0.1`, and Team Space's local API (`api/team…`) is
    `is_local()`-only.
  - Authorization:
    - the source IP must be in the peer list (WireGuard's cryptokey routing makes it trustworthy);
    - the message must be signed with HMAC-SHA256 under `sha256("framedecks-team-v1:" + team key)`;
    - `from` / `to` must match the addresses;
    - `|ts − now| ≤ 120 s`;
    - each 128-bit nonce is used once.

    Replies are signed and checked the same way.
  - Messages are sent with `http.client` using `source_address = (WireGuard address, 0)`, so they leave through
    the tunnel.
  - Presence and sync: a `sync` exchange with every peer every 4 s. A peer is Online if it answered within 12 s.
    The doc is `{notes: {text, at, by}, actions: {id: {text, done, del, at, by, created}}}`, merged last writer wins
    (notes whole, actions per item, ties by author). No queue and no relay: a message is delivered only if the peer
    answers now.
  - Ask to Go Live:
    - `ask` is refused locally unless the peer is Online;
    - the receiver keeps it pending; it expires after 120 s or when the sender goes offline;
    - `answer` is sent back if the asker is still connected;
    - the approving dashboard selects the scene and calls `KCWorkspace.take()`.
  - WireGuard detection:
    - Windows: `Get-NetAdapter`, description `*WireGuard*`, status Up;
    - Linux: `DEVTYPE=wireguard`;
    - macOS: `utun`.

    `TEAM.watch()` starts and stops the listener as the tunnel comes and goes.
    `KC_TEAMSPACE_ALLOW_ANY_ADDRESS=1` is for tests only.
  - Files: `kc-teamspace.json` (settings and key), `kc-teamspace-doc.json` (notes and actions).
  - Test: `tools/test_teamspace.py`, which runs two instances on 127.0.0.12 and 127.0.0.13.
- **Camera rename:**
  - `packaging/build_vcam.py` `NAME = "FrameDecks"` (the DirectShow friendly name, pin name and shared-memory
    names); the CLSID is unchanged;
  - the DLLs are now `framedecks_vcam64/32.dll`, registered by `register-framedecks-camera.cmd`;
  - the installer re-registers when the task is ticked **or** the CLSID is already registered (`ShouldRegisterCamera`),
    so upgrades point Windows at the renamed DLL;
  - `vcam/devices.py` skips both the new and the old name;
  - `packaging/check.py` asserts the name.
- **Logo only:**
  - the header `.brand` is the `framedecks-emblem.webp` mark; `#org-title` / `#meeting-title` are `.sr-only` (ids kept for
    `meeting.js`), and the Meeting Name is in the mark's tooltip and `document.title`;
  - the remote login and bar show the mark only;
  - `app/icons/remote-*.png` were regenerated from the mark (no text);
  - the About page is untouched.
- **Native window:**
  - `src/desktop_app.py` `style_title_bar()` sets DWM attributes 20/19 (immersive dark), 35 (caption colour) and 36
    (text colour) on the pywebview window's HWND when it is shown, and again when the page posts `api/app/window`
    {theme};
  - without WebView2, `open_app_window()` starts Edge/Chrome with `--app=<url>?shell=app` and a separate profile
    (`DATA/appwindow`);
  - `app-bridge.js` (only in the app shell: `info.shell === 'webview'` or `?shell=app`) blocks browser accelerators,
    Ctrl+wheel zoom, the context menu outside editable fields and navigation by file drop;
  - `api/app/info` reports `shell`.

## 27. Version 6.5: Frames and Content, per-Frame lists, annotation, Simple remote, Meeting Workbook

User-facing names changed: a **scene** is now a **Frame**, and a **layer** is now **Content**. The code and the saved
state keep the old names (`scenes`, `layers`, `KCScenes`), so existing data loads unchanged.

- **Frame-owned lists** (`app/js/store.js`):
  - Question and Scripture Content holds its own list in `layer.c.items`, with `c.itemId` as the current item and
    `c.label` / per-item `label`. Fields are whitelisted by `ITEM_FIELDS` and cleaned by `cleanItem()`.
  - Appearance (scale, position, panel, transition…) is per Frame in `c.look` (`LOOK`, `cleanLook`); `take()` applies
    it when the Frame goes live.
  - `ownLists(st)` migrates older layers that pointed into the shared library: each gets a copy with deterministic
    ids (`oldId + '_' + layerId`), and `pair`, `itemId` and the live item ids are remapped. It runs in `normalize()`
    and `migrate()`.
  - `duplicate` calls `freshIds(sc)`, so a copied Frame never shares a list, item id or layer id with the original.
  - The pinned-question section and `pinQuestionText` / `qLabel` were removed.
- **Content Settings** (`app/js/workspace.js` `renderInspector`): one panel, in groups (Content, Appearance,
  Position, Timing, Animation, Media, Behavior) with jump links. Basic / Advanced was removed.
- **Lists in the panel** (`app/js/frame-lists.js`): full-height list; click = current, Show, double-click / Enter =
  edit in place; 400 ms debounced autosave; live update when the edited item is on screen. `window.KCCardLook`
  (renamed from `KCLook`, which `studio.js` uses for camera looks) reads and writes `c.look`.
- **+ Frame / + Content** (`workspace.js`): + Frame adds a blank Frame; the Content menu is `CONTENT_ADD` (Question,
  Scripture, Text, Image, Video, Timer, PowerPoint) plus `FREE_ADD`. The Meeting menu sits on `#quick-start`.
- **Annotation and Freeze**:
  - state: `live.ink {on, items, undone}` and `live.freeze`, cleaned by `cleanInk` (at most 300 items, 1,500 points
    each), changed only through `KCScenes.ink(n, op, item)`;
  - PC: `app/js/annotate.js` (toolbar, `#ann-pad` over the 16:9 picture, keys P/H/A/L/R/E/T, Ctrl+Z / Ctrl+Y, Esc);
  - overlay pages: `.pg-ink` canvas drawn by `KCScenes.drawInk` (above Content, below Blackout);
  - FrameDecks: `vcam/annotate.py` `Ink.draw()` / `Ink.freeze()`, called by `ProgramFX` before the black fade.
    The rasterised ink is cached by a crc32 of the items; solid pixels use `cv2.copyTo` and soft pixels a precomputed
    index (about 3 ms at 1080p).
- **PowerPoint**: `src/server.py` upload accepts .pptx / .ppt and converts with `vcam/powerpoint.py` `pptx_to_pdf()`
  (COM, `SaveAs` type 32, 180-second limit). "Show objects only" (`objectsOnly`, pdf and window Content) is a corner
  colour key in `vcam/layers.py` `key_background()`. Background and limits: `docs/reference/powerpoint.md`.
- **Phone remote** (`app/remote.html`, `app/js/remote.js`): the Simple profile (`#simple`, default) has Frame X of N,
  Previous / Next Frame, Current Content with Previous / Next Content (slides, questions or scriptures), Annotate (a
  drawing pad over the stage), Black Screen and Freeze. The Advanced profile adds search, presenter notes and a
  Run-through that previews Frames without changing the picture.
- **Meeting Workbook** (`app/js/meeting-book.js`): five sheets (Meeting Overview, Frames, Content, Questions,
  Scriptures). `parse()` reports problems by sheet and row, `apply()` builds Frames with their own lists, and
  `exportBook()` writes the current meeting. The template is generated by `tools/make_meeting_workbook.py` and
  tested by `tests/meeting-workbook.test.js`. The app is the source of truth after an import.
- **Removed:** Team Space (peer-to-peer collaboration). Local save, autosave, backups, export and version history
  stay.

## 28. Version 6.6: edit on the canvas, phone drawing pad, simpler Content Settings

- **Excel only through the Meeting Workbook.** `app/js/content-import.js` (the per-Content "Import questions & verses"
  bar) was removed with its markup (`#imp-host`) and CSS. Excel import and export are in the Meeting menu
  (`meeting-import.js`, `meeting-book.js`), which build whole Frames.
- **Edit on the canvas** (`app/js/preview-edit.js`):
  - Frame preview: the overlay page in `#program-frame` takes no pointer events, so `dblclick` is caught on `#program`;
    the point is mapped into the page (÷ the iframe's scale) and hit-tested against `.card-question` / `.card-verse`.
  - Live FrameDecks canvas (`#s2-stage`): cards are drawn into the video, so the card zones are estimated from
    `layout` (`qWidth`, `qBottom`, `qScale`, `verseY`, `verseWidth`, `verseAlign`); a double-click outside a zone is
    left to the canvas.
  - The shown item comes from `live` (live Frame) or `SC.previewState(live, sid)`; saving goes through
    `KCFrameLists.save(kind, sid, id, patch)`, which also updates the screen when that item is on it.
- **Phone drawing pad** (`app/js/remote.js`, `app/css/remote.css`):
  - `GET /api/remote/live.jpg` (in `REMOTE_SIGNED_IN`, so PIN-protected) returns the engine's preview JPEG with an
    ETag; 204 when the camera is off. The pad polls it about 5 times a second and falls back to `stage.html` (cards
    only) on 204, so the pad is never a black box.
  - `padFit()` sizes the stage to the largest 16:9 box in `.dp-area`, so the canvas, picture and pointer mapping line
    up exactly. In landscape (`max-height:560px`) the tools become a side column and the page asks for fullscreen
    where the browser allows it (not iPhone Safari).
- **Speaker View** (`app/speaker.html`, `app/js/speaker.js`, `app/css/speaker.css`; this PC only, not in the remote
  lists): reads the shared state and shows the live Frame's item on screen (else the Frame's current item) with its
  answer and notes, the next item or Frame, Frame and meeting notes, a clock, time on this Frame (`live.at`) and a
  local stopwatch. It never writes. Opened from Program → Speaker View: in the desktop app `POST /api/app/speaker`
  calls `DESKTOP["speaker"]` (`src/desktop_app.py`, a pywebview window); in a browser, a pop-up.
- **Drag to reorder** (`frame-lists.js` `dragHooks` / `moveTo`): HTML5 drag and drop on list items, dropping above or
  below by the pointer's half of the target; the list does not redraw while a drag is active.
- **Sharper phone picture:** `engine.want_preview(seconds, sharp=True)` (only from `/api/remote/live.jpg`) sets
  `sharp_until`; previews are 960 wide until it lapses, 640 otherwise. `_preview_w` forces a new picture when the
  width changes, even if nothing else did.
- **Content Settings merges:**
  - the Frame-level Behavior group (`sc.out`) was folded into each card / text Content's Behavior: `cleanScene()`
    moves an older Frame-wide "off" onto those layers (`foldOut`) and keeps `sc.out` true (camera and media layers
    never followed it). `vcam/program.py` still honours `sc.out` for older saved state;
  - text Content: "Show the title" sits under the Title field (it was in Appearance);
  - Timer: only the field for the chosen way of counting (Minutes or Until) is shown;
  - Branding: Position only in the Position group (it was also in Appearance);
  - Scripture: the fetch selector is "Fetch from" (ESV online / Type it myself), so it is not a second "Translation".

## 29. Version 6.7: inline editing, Teleprompter, multi-select, command palette, branding options

The audit, reuse plan and decisions are in [docs/project/history/2026-10-19-v6.7-plan.md](../project/history/2026-10-19-v6.7-plan.md); measurements in
[docs/development/performance.md](../development/performance.md). Still no framework, no build step and no new dependency.

- **EditableField** (`app/js/editable.js`, `window.KCEditable`): one in-place editor for every name, label and text.
  `inline(el, opts)` edits an element where it is; `float(host, rect, opts)` opens over a canvas card (with extra
  `fields`, e.g. reference and translation); `bind(el, opts)` attaches double-click / F2. One editor at a time; keys
  are stopped at the editor so Studio shortcuts never fire while typing; a click outside saves. Lists skip their
  redraw while `KCEditable.within(list)` and redraw on the `kc-edit-done` window event.
- **Canvas editing of every Content** (`preview-edit.js`): text cards carry `data-layer` (overlay.js); `cardAt` takes
  the last (front-most) hit. The live picture is hit-tested by laying `stage.html?preview=1` invisibly
  (`.pv-measure`, opacity 0) over `#s2-stage`, so positions are exact instead of estimated from `layout`; the frame is
  removed after a minute.
- **Answers and notes** are no longer read by any screen. `cleanItem` keeps non-empty older values (never shown);
  `meeting-book.js` marks the old Answer / Notes columns `legacy` (read on import, never written) and appends them to
  the Frame's `notes`, which is now the Teleprompter script (`cleanScene`: 20,000 characters).
- **Inspector** (`workspace.js` `GROUPS`, `orderPanels`): card and text Content show Label, Content, Display Settings,
  Visual Settings, with Animation and Show on as sub-groups; Question / Scripture label panels moved to
  `data-itab="label"`.
- **Teleprompter** (`teleprompter.js`, `KCPrompter.create(host, opts)`): renders `sc.notes` after escaping
  (`render()`: `#`, `-`, `**`, `*`, `[CUE]`, `---`); scrolls with `requestAnimationFrame` only while playing; settings
  per surface in `localStorage` (`kc-tp-<key>`). Used by the main-window dock (`prompter-dock.js`: body classes
  `tp-dock-left|right|bottom|float`, `--tp-w` / `--tp-h`, only in the Studio tab), the Teleprompter window
  (`speaker.html`, rebuilt from the Speaker View) and the phone (`remote.js`; `teleprompter.js/.css` added to
  `REMOTE_PUBLIC`). `tests/teleprompter.test.js` fails if any output page, its scripts or `vcam/*.py` reads `notes`.
- **Multi-select** (`workspace.js`): `picked{frames, layers}` with anchor ranges, marquee selection from empty list
  space, `deleteFrames` / `deleteLayers` with Undo through `KCActions.toastAction`, copy / paste with fresh ids
  (`SC.freshIds`), `BIG_DELETE = 5` for the confirmation.
- **Command palette** (`palette.js`): builds an index from the state when opened (commands, Frames, templates,
  Content, Frame-owned items, Library, brand, settings, members); ranks each query in one pass (word start > inside >
  keywords > letters in order, plus kind and recency bonuses); draws the top 50. Opening keys in
  `localStorage['kc-palette-keys']`, edited in Settings > Keyboard shortcuts; captured on `keydown` in the capture
  phase so they work while typing. `nav.js` keeps the old header search only as a fallback.
- **Branding** (`store.js` brand defaults `plate`, `pad`, `margin` with `TEXT_RANGE`): overlay.css uses `--bp` / `--bm`
  and `.no-plate`; `vcam/program.py` `_badge` scales padding, skips the plate and draws a blurred shadow instead
  (`_shadow`), and `_worker` places Branding with its own margin. Remove background (`meeting-brand.js knockOut`):
  edge-average colour, flood fill from the border within a tolerance plus a soft band, refusing photos (busy edge),
  near-empty or near-total results; the previous PNG stays in memory for Undo.
- **Lazy Excel** (`dashboard.js KCNeedXLSX`): the 930 KB library is injected on first use by members import /
  export / template and meeting export (`meeting-import.js`; workbook import already used a worker).
- **Release pages and README header**: `tools/make_readme_header.py` captures the About screen's hero from the
  running app into `assets/brand/framedecks-about-header.webp` (and the version it shows into `framedecks-about-header.version`); the
  README and every release start with it. `tools/make_release_notes.py` adds the notes in a fixed section order and
  makes relative links absolute; `--check` (in CI) fails on a missing section or a header showing another version.
  The older `kc-banner.svg` ("Connect · Present · Worship") was removed.

## 30. Version 6.8: frameless windows, Teleprompter overlay, tray and Spotlight

The full plan, with the Electron-to-pywebview mapping, is [docs/project/history/2026-10-20-v6.8-plan.md](../project/history/2026-10-20-v6.8-plan.md).

- **No Electron, no new package.** Everything is Win32 through ctypes in `src/desktop_win.py`; every function is a no-op off
  Windows and never raises, so a refusal leaves the previous look.
- **Title bar removal without `frameless`.** pywebview's `frameless` drops the sizing border (no resize, no Snap,
  maximize covers the taskbar). `Chrome(hwnd)` instead subclasses the window procedure and, on `WM_NCCALCSIZE`, restores
  the client top after `DefWindowProc` (plus `SM_CYFRAME + SM_CXPADDEDBORDER` when maximized), the approach Windows
  Terminal uses. The callback object lives in `chromes[name]` for the window's lifetime. Drag: the page sends `drag` after
  4 px of movement; Python posts `WM_SYSCOMMAND SC_DRAGMOVE` after `ReleaseCapture`.
- **See-through overlay.** pywebview's `transparent` only clears the WebView2 background. `glass()` gives the window
  per-pixel alpha with `DwmEnableBlurBehindWindow` (empty region) and, for frost, `DWMWA_SYSTEMBACKDROP_TYPE = 3`
  (Windows 11 22H2+) or `ACCENT_ENABLE_BLURBEHIND` (Windows 10). The page paints `rgba(tint, alpha)` per mode and a text
  halo that grows as alpha falls. WebView2 needs GPU compositing for this, so with *Light on graphics card* on (process-wide
  `--disable-gpu-compositing`) the overlay uses `fade()` (layered window alpha) instead; `overlayFade` forces it.
- **Privacy.** `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` on the overlay, the Teleprompter window and Spotlight
  (`WDA_MONITOR` on older Windows). The script itself still never reaches an output (tests/teleprompter.test.js).
- **Spotlight.** Created hidden at start-up (a hidden transparent pywebview window would show itself on first
  navigation, so Spotlight is opaque with DWM rounded corners). `Hotkeys` owns a thread with a message loop for
  `RegisterHotKey` (re-registration is marshalled to that thread with `PostThreadMessageW`). The index comes from the
  main window (`KCPalette.exportIndex()` through `evaluate_js`) and is cached in the shared localStorage so the window
  opens with results; choices run there with `KCPalette.runKey()`. Commands flagged `bg` keep the main window in the
  tray.
- **Tray** (pystray): Open App (default), Teleprompter, Search, Settings, More (the earlier items), Exit.
- **Settings** gain validated non-boolean values (`APP_SETTING_CHOICES`, shortcut parsing) and a `settings_changed` hook
  so a new Spotlight shortcut applies at once.
- **Teleprompter engine** `toolbar: 'float'`: controls in an absolutely positioned glass bar, shown on input and hidden
  after 2.8 s unless hovered or focused; `.tp-text` width `min(95 %, 30 × font size)`; mirror via `scaleX(-1)`.
- **Not testable in CI:** the subclass, glass, fade, capture exclusion, global shortcut and foreground focus need a real
  desktop. CI runs the shortcut and settings unit tests on Windows; the browser side was tested with a mocked desktop
  API.

## 31. Version 6.9: one name everywhere, a two-tab Meeting Workbook, a quieter top bar

Everything that still carried the program's earlier name now uses FrameDecks: `APP_NAME` and the data folder
(`%APPDATA%\FRAMEDECKS`), the program folder and `FRAMEDECKS.exe`, the data files (`kc-*.json`, `kc-*.txt`),
the recordings folder (`Videos\FRAMEDECKS`), the start files, the environment variables (`KC_DATA_DIR`,
`KC_VCAM_DEMO`, `KC_ESV_URL`, `KC_TEST_COUNT_OWN_ADDRESS`), the PyInstaller spec and icon
(`packaging/framedecks.spec`, `.ico`), the firewall rule ("FrameDecks Phone Remote"), the JavaScript globals
(`KC*`), browser storage keys (`kc-*`), window events (`kc-edit-done`, `kc-app-info`, `kc-select`), the fonts
(`KC Sans`, `KC Serif`) and the Share Window title ("FrameDecks Share Window"). Default labels and the default
Group Name no longer carry a group's name.

**Migration.** The earlier name is kept only where it is needed to find existing data, each place marked `LEGACY`:
- `src/legacy.py`, run by `src/server.py` and `src/desktop_app.py` at start: renames the data folder (or moves its contents one by
  one when the new folder already exists), renames the data files and the files inside `backups\`, moves the
  recordings folder and clears the old default Group Name. It never overwrites a file that already exists under the
  new name. `tests/test_legacy.py` covers it.
- The block at the top of `app/js/store.js` copies browser settings (theme, shortcuts, layout, file-mode state) to the
  `kc-` keys once (`kc-legacy-moved`).
- `packaging/installer.iss`: the same `AppId`, so it installs over every earlier version; `[InstallDelete]` removes the
  old program folder and shortcuts, and `PrepareToInstall` closes an old copy that is still running.
- `tools/allow-ipad-remote.ps1` and `tools/undo-ipad-remote.ps1` remove the old firewall rule with the new one.

A few internal file names that people never see, such as `bcc-brand-logo.png` and `bcc-scripture-cache.json`, are
unchanged.

**Meeting Workbook.** The workbook used to have seven sheets: Read Me, Meeting Overview, Frames, Content, Questions,
Scriptures and Lists. That was too much for people who only want to plan one meeting. It now has two tabs:
- **Dashboard** holds formulas only. The program never reads or writes it, so it can't break an import.
- **Meeting Form** is one page with numbered sections.

The layout lives in one Python module, `src/meeting_form.py`:
- `tools/make_meeting_workbook.py` (openpyxl, at development time) draws the template from it.
- `fill()` writes a meeting into that template for Export. It uses the standard library only, because the
  installed program ships no Excel library. It edits the form sheet's XML in place, keeps every cell's style,
  unfolds only the rows in use and asks Excel to recalculate on open.

The browser no longer builds the export with SheetJS, except when the program is not running, or when a table is
longer than the form. In those cases it saves a plain one-sheet form.

Reading stays in `app/js/meeting-book.js`. `formBook()` turns the form into the same five lists the older workbooks
had, so `parse()` and `apply()` did not change and the 6.5–6.8 layouts still import:
- A table starts at a header row with "Frame #" plus a column that names it.
- It ends at the next numbered section heading.
- A detail is a known label with its value in the next filled cell on the row.

This is why a hand-made form like the one people sent in imports as well. `FIELDS` (JS) and `DETAILS` (Python)
list the meeting details. `FORM_TABLES` (JS) and `TABLES` (Python) list the columns. `tests/test_meeting_form.py`
checks that each pair agrees. `tests/meeting-workbook.test.js` round-trips the template, both exports, a hand-made
form and an older workbook.

**Top bar.** The header search box duplicated the command palette and Spotlight, so it is gone. So are Presentation
Mode, which hid panels that people then could not find, and the Studio's **Hide the app window** button, which the
tray now does better. Hide All is a single flex unit with its Esc hint inside it (`flex:none`). The Program menu is
always a drop-down, so the bar can't overflow. Under 1140 px the bar wraps. This was checked at widths from 1000 to
3440 px and at device-pixel ratios from 1.25 to 2.

## 32. Version 6.10: quitting really quits

6.8 made Spotlight a window that is created at start-up and only ever shown and hidden. pywebview's `webview.start()`
returns when the last window closes. **Quit** closed the main window, but never the hidden Spotlight, so
`webview.start()` never returned and the process never reached `os._exit`. The server's request loop had been stopped
with `shutdown()`, but its socket was never closed, so the port stayed bound and still accepted connections. On
Windows, `SO_REUSEADDR` (the `http.server` default) let the next start bind the same port, and Windows handed
connections to either socket. The new window's requests reached the silent copy, and the page said *refused to
connect*.

The fix closes each link in that chain:
- `quit_app()` closes every window and arms a five-second `os._exit` safety net.
- `stop_everything()` calls `server_close()`.
- `server.MainServer` binds with `SO_EXCLUSIVEADDRUSE` on Windows and never reuses an address there.
- `running_copy()` reports **stuck** when a connection is accepted but no answer comes. `end_stuck_copies()` then ends
  other processes with the program's own executable name, and only in the installed app.
- The installer's `PrepareToInstall` closes a running copy.

## 33. Companion trust layer (27 October 2026)

The companion now maps known service failures to actionable, user-safe messages instead of presenting raw
authentication or database details. Destructive actions use a shared native dialog with a named action and keyboard
cancellation; workspace deletion also requires typing the workspace name. The desktop interface, live-service command
semantics, and PC-local media and presentation state are unchanged.

## 34. Version 6.11.2: repository layout (27 October 2026)

A maintenance release with no change to the desktop interface. The program's Python modules moved to `src/`
(`python src/server.py`), community files to `.github/`, licences to `legal/`, the changelog and roadmap to
`docs/`, and ruff's configuration to `config/`. Release notes before 6.8 are in `docs/releases/archive/`; the
orphaned Stream Deck bundle was removed. `server.py` anchors its data paths to the repository root, and the
installer spec, tests, workflows and tools read the new paths. A real PyInstaller build was run from the new layout.

## 35. Version 6.12: FrameRelay (28 October 2026)

The virtual camera FRAMECAST is renamed **FrameRelay**. `packaging/build_vcam.py` writes the new name into the
softcam build and `src/vcam/sink.py` `VCAM_NAME` matches it; the camera ID (CLSID) is unchanged, so meeting apps keep
the device and only its name changes once the installer registers it again. `src/vcam/devices.py` and the website's
`pc-setup.ts` still recognise the old name, so a PC whose camera was not re-registered is not reported as missing.
Every label, message, help page, document and GitHub template uses the new name.

The website's front page drops the hero's tilt, mouse-following lean, floating phone and swaying light for one
ordered arrival (the window rises, its screen wakes top to bottom, the gold corners settle, the phone slides in, one
light crosses the glass) that then stays still. The demo's quotation became Proverbs 16:3 (KJV), and the Studio
picture on the front page was captured again from the program with that verse live. The About screen's founder
roles and journey no longer include "Ministry Servant".

## 36. Version 6.13: one-click linking and a shorter front page (29 October 2026)

Linking a PC no longer needs a code typed on another device. The program still starts a `computer_link_start`
request, but **Connect to FrameDecks** opens `framedecks.com/connect#code=…&name=…`; the code travels in the URL
fragment, so it never reaches a server log. The page asks the new `computer_link_peek` (migration 0010: security
definer, signed-in callers only, the same 20-failures-an-hour limit as approving) whether the request is pending and
how old it is, shows the PC's name and a two-digit check number (the first two bytes of SHA-256 of the code, mod 90,
plus 10, computed the same way in `cloud_sync.check_number` and `connect-link.ts`), and approves it with the existing
`computer_link_approve`. The PC learns the answer from its own poll (every 1.5 s while waiting) and the page's
`framedecks://linked` link only brings the program forward. A visitor who must sign in first is returned to the
request once, within 15 minutes (`fd-after-sign-in` in local storage, read by the auth callback). Typing the code
under Service PCs remains as the fallback.

The front page went from about nine screens (plus 1.6 pinned) to about four and a half at 1366 × 768. The hero is two
columns with four proof ticks, and the audience marquee became the pill line. How it works replaced the GSAP
scroll-pinned guide with tabs whose gold bar fills over 6 s by a finite CSS animation; its `animationend` moves to the
next step, the section plays only while on screen, holds on hover and focus, stops after one round or a pick, and
never starts under reduced motion or Reduce effects. The demo and the features share one tab set; four questions show
and the rest sit behind "More questions"; the statement moved into the closing panel. GSAP was uninstalled (JavaScript
380 → 339 KB gzipped); mobile Lighthouse stays at 86–89, with the Studio picture's arrival no longer fading from
nothing so it does not hold back the largest paint.

## 37. Version 6.14: the Setup guide (29 October 2026)

The four-step Getting started card became a Setup guide with the plan's seven steps (`app/js/guide-steps.js`, with
the same list in `hosted/src/lib/guide-steps.ts` and in `server.GUIDE_STEPS`, kept equal by tests). `app/js/guide.js`
draws a 360 px panel at the right and ticks steps only from state the program already has: the kind chosen (it runs
that Quick Start), `KCServiceChecks.output()` (FrameRelay, the Share Window or an overlay page), a phone connected,
a linked PC (`api/sync`), a change to the plan after the guide opened (`KCWorkspace.planSig()`, so the starter
Frames and the Quick Start's own Frames do not count), the screen moving on while Practice is on, and every Before
you start line green once the rest are done. Progress is a validated `guide` object in `kc-app-settings.json`
(`server._valid_guide`). "Show me how" is one fixed element with a 9999 px box-shadow around the real control and
one sentence; any click or Esc ends it, and the panel steps aside meanwhile. It opens after "Start fresh", or on
a PC with no Frames; upgrades never see it uninvited. Entrances only, none under reduced motion.

On the website, Home shows the same steps for a workspace (`components/setup-guide.tsx`). It ticks the kind chosen
there (local storage `fd-guide`), a linked PC (`computers`) and a Frame record last saved by a person
(`updatedBy` "user:…"); the program's steps say "On the PC" rather than guess. Help brings a hidden guide back.

## 38. Version 7.0: proprietary, downloaded and updated from framedecks.com (29 October 2026)

FrameDecks became closed-source, free software from a private repository
([plan](../project/2026-10-29-commercial-model-plan.md)). The licence is the EULA in `docs/legal/eula.md`, copied into
`LICENSE` with a header; LGPL components (pystray, FFmpeg inside OpenCV) stay separate, replaceable files and the EULA
keeps their rights. Versions up to 6.14 stay Apache 2.0.

Distribution moved off GitHub Releases. `tools/make_release_manifest.py` lays a release out for R2: immutable
`releases/<v>/` files, then `index.json` and, last, `latest.json`, so a half-finished upload changes nothing for users.
The manifest names the previous release for rollback and refuses notes that mention repository paths. A Worker on
`api.framedecks.com` serves the manifests read-only with CORS for the website; the installers come straight from the
bucket's custom domain. Both the download page (`hosted/src/lib/releases.ts`) and the updater read the same manifest.

The updater (`src/updater.py`) trusts only `https://downloads.framedecks.com/` URLs, a dotted version, a 64-hex
SHA-256 and a size under 600 MB, and deletes any download that does not match. The installed program writes a
PowerShell script to the data folder and starts it detached: it waits for the program's process to exit, runs the
installer with `/VERYSILENT /MERGETASKS=!vcam`, runs the kept previous installer if that fails, writes `result.json`,
and starts the program again; `pending.json` and `result.json` are read once at the next start. `server.update_action`
refuses while `on_screen(state)` unless forced, and "when I close" is honoured by `desktop_app.quit_app`. Integrity
today rests on HTTPS, the bucket's write-only-from-CI token and the checksum; Ed25519-signed manifests are 7.1.

The website renders `docs/legal/` and `docs/guide/` with `marked` at build time from committed copies
(`scripts/write-content.mjs`, checked current by a test), rewriting links that would lead to the repository. Account
deletion (`delete_my_account`) refuses a sole owner of a workspace with other people, removes solo workspaces,
reassigns `created_by`, deletes the auth user and anonymises the audit log; `export_my_data` returns the account's
rows as one JSON document. Terms acceptance is a versioned `profiles` column set by `accept_terms`.

## 39. Version 7.1: workspace looks (29 October 2026)

The 29 October plan's section 4, built without a new table or migration: `entities.kind` is checked against a fixed
list, but `layout` records may have any id, so the look travels as `layout/look`, beside `layout/profile`. Both
mappings (`sync_entities.py`, `hosted/src/lib/sync-entities.ts`) carry it as the document key `look`; without that,
`join` would drop a pulled look and the next push would delete it from the workspace.

A look is `{id, name, a, b, font, base}`: the card surface (two colours), the scripture font and a light or dark base.
The accent stays the existing `brand.color`, so the four places that already apply it did not change; choosing a look
on the website saves the look and then the brand record with the look's accent. All six surfaces are dark so the
cards' white text stays as it is; a test keeps body text and labels at 4.5:1 or more on each surface. The output pages
read `KCScenes.lookSurface` into CSS variables (`--surf-a`/`--surf-b` feed the existing `--navy-a`/`--navy-b`, and
`--scripture` the verse and birthday greeting); the camera swaps `SURFACE` and `SCRIPTURE` per draw under the same
lock as the accent, and the branding plate takes the surface too.

The plan asked that a look never change mid-sentence. Settings were applied at once before; now `cloud_sync` holds
`layout/look`, `brand/brand`, `layout/layout` and `theme/cards` while `on_screen(plan)` (a visible card or live
Content; the updater's rule, moved here) and retries them each round. "Follow my workspace" is a fourth appearance
choice resolved from `look.base`, remembered as `kc-theme-base` for the first paint of every window. Not done from the
plan: per-look lower-third and transition styles (those stay per Content and per meeting), and a light card surface,
which would need dark-text variants in both renderers.

## 40. Version 7.1.1: no shells, after a Defender quarantine (31 October 2026)

On the owner's PC Microsoft Defender quarantined FRAMEDECKS.exe 7.1 as a severe Trojan, "executes commands from an
attacker", a while after it started, and removed its shortcut and uninstall entry. Nothing malicious was found; the
behaviour matched a backdoor: an unsigned executable, a local server accepting commands (the phone remote, Stream
Deck, the website's control), and hidden PowerShell started on a timer (`Get-NetConnectionProfile` every 15 minutes
while the phone remote was on), PowerShell with `-EncodedCommand` and `-Verb RunAs` for the firewall rule, an update
script started with a bypassed execution policy, plus `netsh` and `taskkill`.

7.1.1 starts no shell at all. `src/winapi.py` does each job through the documented API (ShellExecuteExW runas,
CreateToolhelp32Snapshot/TerminateProcess, Network List Manager and HNetCfg.FwPolicy2 through comtypes,
WinVerifyTrust + CertGetNameStringW). The firewall rule is written by the program itself, relaunched elevated with
`--firewall`, handled before the watchdog in `desktop_app.py`. The updater starts the Inno installer with `/UPDATE=1`;
the installer waits five seconds for FrameDecks to close, ends what is still running, and opens the new version; a
failed install is undone by Inno's rollback, and the next start reports it from the version number alone. The build
compiles PyInstaller's bootloader from source, since the shared prebuilt one is common to many flagged programs. A test
walks the syntax tree of every module and fails on any launch of PowerShell, taskkill, netsh, cmd, wmic or schtasks
(it catches all six launches 7.1 had). The lasting fix remains code signing.

## 41. Version 7.1.2: release guards (1 November 2026)

A read-only production audit of the release pipeline (1 November) found that nothing tied a tag to the version it
published: `build-windows.yml` reads `APP_VERSION`, not the tag; the manifest tool always wrote `latest.json`,
`index.latest` and `latest/FrameDecks-Setup.exe`, so an old tag would roll new installs back; `previous` was simply the
most recently uploaded other version; the index was read from the five-minute-cached public address with every error
turned into an empty list; there was no concurrency guard (three tags had just been pushed together); and a re-run
re-uploaded `releases/<v>/` over an installer cached for a year as `immutable`, so a non-reproducible rebuild would
no longer match its own manifest's SHA-256 at the edge.

7.1.2 adds four guards: the tag must equal `v` + `APP_VERSION` and come from a push; tag runs share one concurrency
group; the publish job reads the index from R2 itself, fails on anything but a 404, and refuses a version whose
manifest already exists; the manifest tool refuses a version older than the newest published, picks `previous` as the
next lower version, and sorts the index. A rollback stays the documented manual copy of an older manifest over
`latest.json`. The local pipeline test now extracts and runs the workflow's own read and upload steps against
wrangler's local R2, so the guards are exercised end to end, not only parsed.

## 42. Version 8.0.0: simpler by removal (1 November 2026)

The owner asked for a simpler program before more features. Three ways to show the Teleprompter (a dock in the main
window with four positions, a see-through overlay with five transparency modes, and a separate window) became one:
`speaker.html`, opened by `desktop_app.teleprompter()` as an always-on-top window hidden from capture, with the
transparency gone (an opaque window over Zoom reads better than glass, and needs no GPU path). Its header is reduced
to time, Frame and timer and hidden until the pointer reaches the top edge, so the script has the whole window. The
`overlay*` settings are dropped on load (unknown keys are ignored), and `prompter-dock.js`, `prompter.*` went.

Run was a second Studio with every editor hidden and Practice inside it; with the live controls already in the top
bar, it mainly added a mode to be in. Run, Up next and Practice (which borrowed the Black screen and needed a
`practice=1` preview exception in `overlay.js`) are removed; the ready checks stay as `KCServiceChecks`, now shown by
the Setup guide's last step. The guide became a wizard: one step, a progress bar, Next enabled only when detection
says the step is done, "Do this later" so nobody is trapped by a detection that cannot see their setup, and recovery
tips per step. Saved progress from 7.x keeps its ticks: `app_settings()` drops the retired `rehearse` id before
validation.

The Frame editor lost its three groups (Frame, Timing, History) for one short form and an Advanced section; the
seven duplicate commands became one; three text presets that were only an announcement with words filled in were
removed (Frames that have them keep them: they are ordinary announcements). FrameRelay's quality panel was reworded
for people who do not know what gain or Kelvin are, and Diagnostics answers in one line before the numbers. Major
version, because features were removed.

## 43. Version 8.1.0: transparency back, looks, one Content view (1 November 2026)

8.0 dropped the see-through overlay with the dock; the owner wanted its transparency and pin in the one Teleprompter.
`desktop_app.teleprompter()` now creates the window transparent when the graphics card is in use (the page paints
`rgba` at the chosen level and the text keeps a halo that grows as the background fades) and uses `dw.fade` under
"Light on graphics card"; `prompterLook` and `prompterOnTop` are app settings, set through the window op `look` and
the existing `on-top`.

The Content inspector's jump links (Label, Content, Display Settings, Visual Settings) became one page: the Content
first, then foldable sections whose open state is kept in `kc-insp-open`. The theme gained the website's six looks
(`nav.js` LOOKS, kept equal to `hosted/src/lib/workspace-settings.ts` by a test), as token overrides per
`html[data-look]` in dark and light; 7.x's "Follow my workspace" maps to the look "Same as my workspace". A final
layer in `theme.css` gives the window the website's stage light, card edge and shadow, and gold gradient buttons using
`color-mix` on the look's tokens: static paint only, nothing animated or blurred.


## 44. Version 8.2.0: a bare Teleprompter, Spotlight, Burst and .frame files (2 November 2026)

The owner asked for a Teleprompter whose screen holds nothing but the script. `teleprompter.js` `create()` gained
`controlsHost` (the engine's Scroll, speed and text controls are built into the Speaker page's top bar), `bare` (no
empty-state actions or cues in the script area) and `source()`, which lets the page choose the script: the live
Frame's notes, or with `meeting.scriptMode = 'all'` one `meeting.script` for the whole meeting. Uploads are read in the
page (`script-file.js`): .docx is unzipped from its central directory with `DecompressionStream('deflate-raw')` and
`word/document.xml` turned into the Teleprompter's light Markdown, so no library was added.

Spotlight is a state, not a drawing: `live.spot` (`cleanSpot`) holds the word's box on the picture, colour, size,
length and strength, with a fresh id each time. Each renderer plays it once from the moment it first sees the id
(FrameRelay `spotlight.py`, the overlay pages' `Program.spotlight`), so a clock difference between PCs and phones never
cuts it short, and one already present when a renderer starts is not replayed. Annotate finds the word by walking the
text nodes of the picture's iframe and measuring each word's range, because the cards ignore the pointer and
`caretRangeFromPoint` only saw the page body.

The transition list had grown look-alikes. One per effect remains; the old ids are aliases (`TX_ALIAS` in `store.js`,
`program.py` and the website's `meeting-form.ts`) applied when a plan loads, so nothing saved breaks. Burst cuts the old
picture into a grid of grains that a sweep releases; the solid part is copied with `cv2.copyTo` and only moving grains
are blended, which brought it from 40–100 ms to 12–20 ms a frame at 1080p. The overlay pages do the same on a canvas
from the outgoing cards' boxes.

The .frame file replaces the Excel workbook as the way to carry a plan by hand. It is the PC's own plan shapes in JSON
(`docs/reference/frame-file.md`), written by the website from the synced plan (`frame-file.ts`, import-free so Node's
type stripping can test it) and read and written by the PC (`frame-file.js`, UMD so the same `check` and `apply` run
in Node tests). Media stays off the cloud, as the owner chose: the website's file has none, a PC's file embeds it
(base64 with SHA-256, up to 300 MB) and import writes it through the existing upload endpoint, renaming on clash. Sync
gained a `phase` (synced, syncing, offline, failed) shown as a header chip; offline is not shown as a problem, because a
service PC without internet is normal.

## 45. Version 8.3.0: the website Plan as a guided workflow (2 November 2026)

The owner asked for a frame-creation workflow on the website that guides a volunteer from the meeting to the service
PC: large buttons with plain labels, a timeline arranged by dragging, a preview, and sync or export at the end. The
Plan page keeps its one editor (`meeting-form-panel.tsx`, every save still a `sync_push` on top of the revision read)
and gains a layer above it. `lib/frame-flow.ts` (import-free, tested with Node's type stripping) holds the five steps
and their state, `moveFrameTo` (a drag drops a Frame at any place; templates in the order keep theirs) and
`previewOf`, the picture the Preview draws from a Frame record: its background, the first item of each card, the files
it uses and the transition it will play (its own, or the meeting's transition style through `PROFILE_TX`).

The steps are ticked from facts, not from clicks: a meeting name, at least one Frame, every Frame with a script or
something in it, a Preview opened, and an export or a linked PC with the last save synced. The Sync status comes
from `workspace-sync.ts`, which now tells a watcher when a push starts and ends; the browser's online state turns it
into Offline. The timeline uses the browser's own drag and drop, with Alt + arrow keys for the keyboard and the
cards' arrows on touch screens. The Preview is a `<dialog>` whose scene is re-mounted per Frame, so each transition
plays as a CSS animation named by the transition's id; reduced motion turns them off.

Media stays off the cloud, as decided for 8.2. A file chosen on the website is kept in the browser's IndexedDB under
the workspace and the safe file name the Frame records (`local-media.ts`); Export for Service PC embeds the kept files
the plan uses, and the PC's existing import writes them. The website's CSS was at its 24 KB budget, so the new styles
were paid for by removing about 6 KB of rules no page used any more (earlier Overview and onboarding designs), found
by comparing the class names in the stylesheets with those in the components. `tests/visual/plan-flow.mjs` runs the
whole workflow in Chromium against a stand-in workspace, with axe, on desktop and phone widths in both themes.

## 46. Version 8.4.0: the same plan on both sides, Resync, and a guide with real screenshots (2 November 2026)

The owner reported that a plan exported from the website did not look the same on the service PC. Following one plan
through the code (website records → `join` → .frame → the PC's `check`, `apply` and `normalize`) showed the data
survived; the import did not. Its default, "Add after my Frames", kept the PC's own Frames and only took the meeting's
title. 8.4 makes **Use this plan** the main action (a backup first) and adds two checks, so nothing is lost silently.
Before: a file declares `integrity` (Frames, Content, items, files), counted the same way by `frame-file.ts` and
`frame-file.js` (a test keeps them equal), and a file whose plan does not match is refused. After: `verify()` compares
every Frame (id, order, name, script, transition, each Content's words, items and file) and the meeting with the file,
in plain words, and the server's missing-media check names files the Frames use that the PC lacks.
`tests/visual/frame-roundtrip.mjs` drives the whole path in two browsers: a plan made on the website with a picture
chosen there, exported, imported on a running program, compared field by field and byte for byte.

Meeting Details on the website are three fields. The record keeps every older field, because `meetingFromForm` writes
on top of the record as it was; nothing is migrated or dropped.

Resync is one sync round on request (`cloud_sync.resync`), under the same lock as the timer's rounds, answering
complete, nochange or failed from the round's own summary; the timer is moved a minute on so the two do not run back
to back. The Sync chip opens a small panel, anchored to the status button when the header has folded the chips into it.

The Help guide is data (`help-guide.ts`): eight steps for each side in the core order, each naming the labels on
screen, a screenshot and the place to circle. `help-shots.mjs` takes the screenshots from the real screens (the
website against a stand-in workspace, the program running) and records each circled place as percentages; the page
zooms the picture onto that place so it is readable on a phone. A test fails when a named label no longer exists in
the website's or the program's code, or a picture or place is missing, which is how the guide stays current.

Multiple meetings were moved to 8.5 by the owner's choice. Sync accepts a fixed list of record kinds and every PC
normalizes its plan to known fields, then sends back what differs, so a PC still on 8.3 would strip per-meeting
details from the workspace. 8.5 stores the meeting as each Frame's `group` (which every PC keeps) and ships once
PCs have 8.4.

The website's CSS was at its budget. Rather than raise it, the budget now measures the CSS one page loads (the
heaviest page), and the landing page's own styles (`landing-page.css`) and the Plan page's (`plan.css`) are imported
by their components, so the signed-in app loads about 7 KB less; screenshots of four public pages at two widths in both
themes were compared pixel for pixel before and after.

## 47. Version 8.5.0: several meetings and a timeline beside the plan (2 November 2026)

The owner asked for several meetings in one workspace, each with its own Frames, and chose that a service PC shows one
at a time. The constraint was compatibility. Sync accepts a fixed list of record kinds (older PCs delete kinds they
do not know), and every PC normalizes its plan and pushes back what differs, so an older PC strips fields it does
not know. A new record kind or a new field on the Frame would be erased by the first PC still on 8.4.

So a meeting is a name: a Frame's `group`, which every PC version has always kept, names its meeting, and a Frame
whose group names no meeting belongs to the first. The list of meetings (id, name, date, notes) lives in the meeting
record as `meetings`; with no list there is one meeting made from the record's title, date and notes, so every plan
before 8.5 is unchanged. The website's rules (`hosted/src/lib/meetings.ts`) and the PC's (`Scenes.meetings` in
`app/js/store.js`) are written twice and kept equal by `hosted/tests/meetings.test.mjs`.

The one field older PCs could still strip is `meetings` itself. Migration 0012 puts a trigger on `entities` that
keeps the list when a meeting record arrives without it, or with an empty one; an older PC then re-saves its version
about once a minute and the trigger puts the list back each time, which is harmless and stops when the PC updates.
The website offers a second meeting only when `meetings_supported()` exists, so a workspace whose owner has not run
the migration never makes a list that an older PC could erase.

The PC's choice of meeting is its own (`live.meeting`, not synced): two PCs can show different meetings. The record's
title, date and notes mirror the meeting a PC shows, because every screen and every older PC reads them there.
`Scenes.order` returns only that meeting's Frames when there are several, and Next, Previous, the phone remote and
the Teleprompter all go through it, so one filter covers them all.

The .frame file stays version 1 and carries one meeting: the Frames' groups and the meeting's own name, date and
notes. **Use this plan** replaces only that meeting when the PC has others (or a meeting of another name), so a file
from the website never wipes the PC's other meetings; the import check counts the meeting's Frames and says how many
others it has.

The 8.3 horizontal timeline became a vertical flowchart on the right (under the plan below 1100 px): the meeting at
the top, then each Frame as a card joined by a line. Reordering uses FLIP with the Web Animations API (measure, apply
the new order, animate from the old place), so there is no animation library and nothing moves when the system asks
for reduced motion. A move is shown at once and saved after; a failed save puts it back. The grid column on phones is
`minmax(0, 1fr)`, so a long meeting name cannot widen the page.

`plan-flow.mjs` makes, switches, renames and exports meetings and deletes in the timeline at 390, 820 and 1366 px in
both themes; `frame-roundtrip.mjs` imports into a PC that already has another meeting and checks both survive.

## 48. Version 8.6.0: one import everywhere, a marked Teleprompter bar, and a website that uses its width (2 November 2026)

The owner found that a .frame file opened in Settings but not from Quick Start. The ✨ Meeting menu's import was the
older single-Frame import (`accept=".json"`), so a .frame file could not even be chosen, and the Quick Start dialog had
no import at all. Rather than a second copy of the .frame import, `importFrameFile` decides by content: a file whose
`format` is `framedecks-frame` (or named `.frame`) is checked with `KCFrameFile.check` while the Quick Start dialog is
still open, so a refusal is shown where the person is, and only then handed to `KCFrameFile.importFile`, the function
Settings uses; anything else is tried as a single exported Frame. `importFile` now answers what happened
(`{ok, mode, error}`) instead of only writing the Settings box, which is also why the round-trip test no longer awaits
it.

The Teleprompter's bar tab was already in the page but invisible until hovered (a later rule in `speaker.css` hid it), so nobody knew the bar
existed. It is now always shown at low contrast and follows the bar's lower edge; the bar's height is measured with a
ResizeObserver because the bar wraps on a narrow window.

Sign-out had three copies, each calling `signOut()` and moving on whether it worked or not. One helper now signs out,
falls back to the local scope when the server cannot be reached, clears the browser's `sb-…` entries, and goes to
framedecks.com; only a browser that could not be signed out at all stays, with a message.

The Help page became a Help Center. The topics are data in one component with the content written as React, so the
words stay checkable in review; the topic lives in the address so links and Back work, and the anchors the program
opens (`#guide`) map to Getting Started. The old Help styles in `identity.css` were removed.

On the Plan the cards were one level of type. The name is now the largest text on the card, with tags underneath and
the Content as tiles on a darker field, so the eye reads name, then contents, then actions. The steps use a container
query, not a viewport one, because the timeline column decides how wide the plan is. Landing sections and the signed-in
pages were widened (1320 and 1560 px), vertical spacing reduced, and the landing CSS stays within its 24 KB budget.

## 49. Version 8.7.0: a soft Spotlight, and a landing that shows its tools (2 November 2026)

The owner found the 8.2 Spotlight (a gold ring with sparks) too small and asked for a bigger, see-through circle like
a presenter's pointer highlight, with better entry and exit. `live.spot` gained a `style`: `disc`, the new default,
and `ring`, the 8.2 look kept as a choice. The disc is drawn the same way in the two places people see it: a radial
gradient with a brighter rim in `overlay.css` (landing with an overshoot and one ripple, breathing while it stays,
closing on the way out) and the same shape in `vcam/spotlight.py` for FrameRelay, computed only in the square around it
while it plays. A PC whose saved setting was the old gold default moves to the white disc once; any other saved choice
is kept. The settings panel is built once (`spotPanel`) and shown both beside the Annotate toolbar and in Settings →
Transitions, so they cannot disagree.

On the landing page the Teleprompter returned to See it work only, and How it works got a fifth day, Point it out,
drawn in HTML like the others (a pointer, the disc, a pen line). See it work now tours its tabs while it is on screen,
because visitors did not discover the other tabs; the tour stops for good when someone chooses a tab and never runs
under reduced motion. The landing's CSS is at 23.7 of its 24 KB budget.


## 50. Version 8.8.0: the Audience Dock (2 November 2026)

The owner wanted viewers' chat questions on screen during a live meeting without pasting. Three feasibility reports
came first (a Zoom API route, a zero-click route, Ctrl+C); the Ctrl+C route won because it works with every chat app,
needs no account or API, and keeps the presenter choosing each message. The analysis, plan, risks, testing checklist
and rollback plan are in [audience-dock.md](audience-dock.md).

Capture uses Windows' own clipboard listener on a message-only window and only while the switch is on: no keyboard
hook, which antivirus treats as a keylogger. It honours the markers password managers set on secrets and ignores the
program's own copies. Parsing lives in `audience.py`, pure Python with no Windows calls, so every rule is tested on
the Linux CI. The queue is in memory only: nothing about viewers is written to disk or synced.

The card on screen is `live.audience`, so it rides the existing state: every page sees it, Hide all clears it, and
`live` never syncs. The server owns the timer (it clears the card when its seconds are up), so all outputs agree.
It is drawn as its own chat window rather than the gold question card, so viewers read it as a viewer's message and
not as the presenter's content: unfold, typing dots, then the message, the same in HTML (`overlay.css`) and on
FrameRelay (`vcam/chatcard.py`, two pre-drawn pictures, the message one unrolling from the compact height). It sits on a
chat rail at the right edge, centred at 42 % of the height and kept between 12 % and 62 %, the one band the other
overlays leave free: question, scripture and lower-third cards at the bottom centre, the birthday card at the top,
Branding badges in the corners, a camera inset in a bottom corner. A message copied from a chat app goes on screen at
once (the owner asked for it to open when copied); private messages and copies from other programs still wait for
Show. FrameRelay draws it after the Spotlight and before Blackout. Because the Share Window
shows the camera's final frame, "Also show on Share Window" off is done by keeping a copy of the frame from just before
the card, only while the card is on screen and a Share Window is open. `store.js` writes `audience` into `live` only
when a card is on screen, so the shared sync fixtures (and the website) see no change.

The dock window is click-through (`WS_EX_TRANSPARENT` on a layered window) and never activates (`WS_EX_NOACTIVATE`), so
Zoom keeps the keyboard. Because a click-through window cannot be clicked, a second small window, the handle, sits on
its edge and is never click-through; Ctrl+Shift is read by a light poll (`GetAsyncKeyState`), again without a hook.
The decisions per tick are in `dock.py` with the Windows calls passed in, so they are tested without Windows. The
click-through WebView2, focus and the clipboard need the real-PC checklist in the design document.

