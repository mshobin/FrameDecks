# PowerPoint in FrameDecks: what is possible, and what v6.5 does

Leaders want to bring their PowerPoint into a Frame. Often they also want only the slide's objects (animated text,
shapes, pictures) on top of the camera, without the slide's background. This page sets out:
- what is technically possible;
- what FrameDecks v6.5 does;
- the risks and limits.

It does not assume that transparent PowerPoint rendering exists, because it does not.

---

## 1. Native rendering (PowerPoint draws the slides)

| Way | What it gives | Transparency | Animations |
| --- | --- | --- | --- |
| **Live slide show window** (capture the running PowerPoint window; *Window* Content) | Exactly what PowerPoint shows, live | **No.** The window is a flat picture | **Yes.** Every animation, transition and video plays live |
| **PowerPoint COM: `SaveAs` PDF / PNG** (the installed PowerPoint saves the file) | Pixel-exact still slides | PNG export has a background; PowerPoint has no "transparent background" switch | No (one picture per slide) |
| **PowerPoint COM: `Slide.Export` per slide / per shape** | Pictures of slides or single shapes | A single shape can be exported with transparency, but its animation is lost and the positions must be rebuilt | No |
| **PowerPoint "Export → Create a Video"** (COM `CreateVideo`) | MP4 or WMV of the whole show with animations | **No.** MP4/H.264 has no alpha channel | Yes, baked into the video |

Rendering PPTX without PowerPoint (LibreOffice, or a home-made renderer) is not reliable enough for a church
projector:
- fonts change;
- SmartArt and animations are wrong or missing;
- it adds a 300 MB dependency.

It was rejected.

**Conclusion:** PowerPoint itself is the only faithful renderer, and it cannot output transparent animated pictures.

---

## 2. Export-based rendering (a file made ahead of time)

Each format was weighed as a way to get *objects only, animated, with transparency* into FrameDecks's picture.

| Format | Alpha (transparency) | Can PowerPoint make it? | Plays in FrameDecks (OpenCV/FFmpeg, CPU) | Size / CPU | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Transparent WebM** (VP8/VP9 with alpha) | Yes | No. It must be converted with an editor (e.g. remove a chroma background in DaVinci Resolve, Premiere or ffmpeg) | Yes, but VP9 alpha decoding needs the libvpx path. OpenCV's default FFmpeg decode drops the alpha plane | Small; moderate CPU | Best *video* option, but an extra tool and a conversion step for every deck |
| **ProRes 4444** (.mov with alpha) | Yes | No | Decodes (FFmpeg); alpha needs the same care | Very large files (≈ 1 GB per 5 min at 1080p); heavy disk and CPU | Too heavy for volunteers' laptops |
| **Animated WebP** | Yes | No | Not supported by OpenCV video reading; would need a custom decoder (Pillow can read it frame by frame) | Large in memory for long animations | Possible later for short loops (logos, lower thirds), not slides |
| **GIF** | 1-bit only (hard edges, no soft shadows) | No | Readable, but 256 colours and jagged text edges | Small | Poor quality for text; not recommended |
| **Lottie** (JSON vector animation) | Yes | No. Needs After Effects + Bodymovin, or LottieFiles | No renderer in the app; it would need a web view or a native Lottie library on the video path | Tiny files; renderer CPU cost | Great for designed motion graphics, but PowerPoint can't make it, so not useful for decks |

**Conclusion:** every route to transparent, animated PowerPoint content goes through a separate editing tool. None
of them is "simple for non-technical volunteers". Transparent WebM is the most practical of them if it is ever needed.

---

## 3. What FrameDecks v6.5 does (production-ready choice)

The recommendation is to cover the two real needs with tools that are dependable on a Sunday morning.

1. **PowerPoint file → slides** (*+ Content → PowerPoint…*)
   - Choose a **.pptx**. The PowerPoint installed on the PC saves it as a PDF, and each slide becomes one picture. The
     PDF is drawn by PDFium, so it is exact.
   - Previous / Next slide works from:
     - the command bar;
     - Page Up / Page Down;
     - the phone (the round ◀ ▶ arrows on a PowerPoint Frame).
   - Set the slide to **Start at** under Content Settings → Media.
   - No PowerPoint on the PC? Save the deck as PDF in PowerPoint (or Keynote or Google Slides) and add the PDF.
   - **26.11.46: animations play.** When the .pptx has animations or transitions and PowerPoint is on the PC,
     FrameDecks runs PowerPoint's own slide show itself, in a window tucked behind every other window (Windows
     Graphics Capture keeps capturing it), and the camera shows the slide part of that window
     (`vcam/powerpoint.LiveShow`, `vcam/layers.LiveShowSource`). Next plays the slide's next click (its next
     animation), then goes to the next slide of the meeting's run order; Previous steps back. The still slides from
     the PDF are shown until PowerPoint is ready, and whenever it cannot play the file. Content Settings → **Play
     animations** switches it off for a deck. The file opens read-only with its macros off; the show advances only
     by Next (rehearsed timings are ignored); FrameDecks ends the show when the Frame leaves the screen or when
     FrameDecks closes.
2. **Live PowerPoint window** (*+ Content → Free Content → Window*)
   - Start the slide show, then choose its window.
   - Animations, transitions and embedded videos play exactly as in PowerPoint, and Next / Previous drive the real
     slide show.
3. **Show objects only** (Content Settings, for both kinds of PowerPoint Content)
   - The slide's **plain background colour becomes see-through**. Text, shapes and pictures sit straight on the
     camera picture.
   - It works by measuring the colour in the slide's corners and making that colour (with a soft edge) transparent.
   - On a live window it updates as animations play, so animated objects appear without a background.
   - Design tip: give the slides a **solid background colour** that the objects don't use (pure green #00FF00 is safest).

Settings the brief asked for, and where they are:

| Setting | Where |
| --- | --- |
| PPTX file | + Content → PowerPoint…, or Content Settings → Media → Choose another file |
| Slide selection | Content Settings → Media → Start at slide; Previous / Next slide |
| Slide range | The slides you step through. To limit a range, save only those slides as the PPTX or PDF |
| Overlay position, size | Drag on the picture, or Content Settings → Centre X / Y, Width, Height |
| Opacity | Content Settings → Opacity |
| Z-order | The Content list (drag, or Move up / down) |
| Auto play, loop | Live PowerPoint window: PowerPoint's own slide show settings |
| Background visibility | Content Settings → **Show objects only** |
| Preview, play, pause, stop | The Studio canvas shows it live; a live window plays as PowerPoint plays |

---

## 4. Risks

- **COM automation depends on the PowerPoint installation.** Some things make PowerPoint refuse to open a file:
  - Click-to-Run updates;
  - Protected View (a file from the internet);
  - a licence prompt.

  FrameDecks then says so in plain language and suggests saving as PDF. The conversion has a 3-minute limit, so
  a hung PowerPoint never blocks the app.
- **Show objects only is a colour key, not true transparency.** It will remove parts of objects that use the
  background's exact colour. Gradients and picture backgrounds stay visible.
- **A captured window is a picture of the screen.** If PowerPoint is minimised, or covered on some graphics drivers,
  the capture may pause. Keep the slide show on a second display or in its own window.

## 5. Limitations

- **Animations:** a PPTX with animations plays them (26.11.46) when PowerPoint is installed on the Windows PC. A PDF,
  or a deck on a PC without PowerPoint, shows still slides. PowerPoint 2010 does not report how many clicks a slide
  has, so Next lets PowerPoint decide and the click count is not shown. The slide-show window must not be minimised.
- **Transparency:** no truly transparent animated PowerPoint output. This is impossible from PowerPoint itself; see
  sections 1 and 2.
- **Platform:** PPTX conversion needs Windows with PowerPoint installed. The PDF route works everywhere.
- **Future option:** if leaders need pre-made transparent motion graphics, the next step would be to read
  transparent WebM (VP9 alpha) through FFmpeg's libvpx decoder in the media Content.
