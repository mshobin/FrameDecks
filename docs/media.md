# Media

How to show pictures, videos, PowerPoint, PDFs, windows, your screen and your camera, and how to send the finished picture to Zoom, Teams, Google Meet, OBS or a projector.

**Who this is for:** media teams, service operators and anyone preparing slides or videos for a service.

**On this page**
- [Media at a glance](#media-at-a-glance)
- [Adding media to a Frame](#adding-media-to-a-frame)
- [Images, logos and backgrounds](#images-logos-and-backgrounds)
- [Videos](#videos)
- [PowerPoint and PDF](#powerpoint-and-pdf)
- [Windows, screens and cameras](#windows-screens-and-cameras)
- [The FRAMECAST camera](#the-framecast-camera)
- [Camera Looks and background blur](#camera-looks-and-background-blur)
- [Projectors and the Presentation window](#projectors-and-the-presentation-window)
- [OBS and browser overlay pages](#obs-and-browser-overlay-pages)
- [Preparing media](#preparing-media)
- [Performance tips](#performance-tips)

---

## Media at a glance

Media Content is part of the **FRAMEDECKS picture**: the finished 16:9 image that FRAMEDECKS builds on your PC and sends to your meeting app, your projector and your recordings. Cards (questions, scriptures, birthdays) and text Content are always drawn in front of camera and media Content.

| Content | What it shows | Where you add it |
| --- | --- | --- |
| **Image** | A picture (photo, graphic, announcement slide) | + Content → Image |
| **Video** | A video file, playing in the picture | + Content → Video |
| **PowerPoint** | A .pptx (or PDF) as still slides you step through | + Content → PowerPoint |
| **Window** | A live window on your PC, such as a running PowerPoint slide show | + Content → Free Content → Window |
| **Screen** | A whole display | + Content → Free Content → Screen share |
| **Camera** | Your webcam | + Content → Free Content → Camera |
| **Background** | A full-screen background behind everything | + Content → Free Content → Background |
| **Logo / Watermark** | Your logo in a corner | + Content → Free Content |
| **Shape / free text** | A rectangle, ellipse or simple text on the picture | + Content → Free Content |

> **Note:** FRAMEDECKS does not carry sound. Audio from your microphone (and from a video you play) reaches Zoom or Teams through your normal audio settings. See [Troubleshooting](troubleshooting.md#audio).

## Adding media to a Frame

1. Select the Frame in the **Frames** list.
2. Select **+ Content** and choose the type.
3. Choose the file. FRAMEDECKS keeps its own copy in the data folder (`%APPDATA%\FRAMEDECKS\layers\`), so the Frame keeps working if the original file is moved or deleted.
4. Set it up in **Content Settings → Media**: the file, position (Centre X / Y), size (Width / Height) and **Opacity**.
5. When the Frame is live and the FRAMECAST camera is on, you can also **drag** the Content on the Studio Canvas and resize it with its handles. Turn on **Snap to guides** for neat alignment.

> **Tip:** The order in the **Content** list is the stacking order: the top item is in front. Drag items to change it.

## Images, logos and backgrounds

- **Image**: any picture. Use it for announcement slides, sermon title graphics or a welcome screen.
- **Logo / Watermark**: a small image in a corner, shown on every Frame you add it to.
- **Background**: fills the whole picture behind everything else.

Your organisation's own logo and Meeting Name are set once in **Settings → Meeting & Branding**. They appear only where you put them: Branding Content, text that uses `{meeting}` / `{org}`, and cards with **Show my logo on this card** ticked. See [Meeting Workbook and branding](reference/meeting-workbook-and-branding.md).

## Videos

1. **+ Content → Video**, then choose the file.
2. Set its position and size in **Content Settings → Media**, or drag it on the canvas.
3. The video plays while its Frame is live.

> **Important:** Video Content plays **without sound** — FRAMEDECKS shows the picture only. If people need to hear a video, play it in a media player with sound and share that (for example, Zoom's **Share Screen** with **Share Sound**), or play it through your sound desk.

## PowerPoint and PDF

FRAMEDECKS offers two ways to show a PowerPoint. Choose the one that fits the deck.

| | **PowerPoint Content (slides)** | **Live slide show (Window Content)** |
| --- | --- | --- |
| How | + Content → **PowerPoint**, choose a .pptx (or a PDF) | Start the slide show in PowerPoint, then + Content → Free Content → **Window** and choose its window |
| Animations and transitions | No (each slide is a still picture) | **Yes**, exactly as in PowerPoint |
| Embedded videos | No | Yes |
| Needs PowerPoint on this PC | Yes for .pptx (the PDF route works without it) | Yes |
| Next / previous slide | Command bar, **Page Down / Page Up**, or the phone (**NEXT CONTENT**) | Same controls drive the real slide show |
| Best for | Sermon notes, announcements, song words, reliable still slides | Decks that depend on animation |

### Adding a PowerPoint file

1. **+ Content → PowerPoint**, then choose the **.pptx**.
2. The PowerPoint installed on this PC saves it as a PDF. This can take a moment for a big deck. FRAMEDECKS gives it up to **3 minutes**, so a stuck PowerPoint never freezes the app.
3. Set **Start at slide** in **Content Settings → Media** if you want to begin part-way through.
4. During the service, step through the slides with **Page Down / Page Up**, the slide buttons in the command bar, or the phone.

> **Tip:** No PowerPoint on this PC? In PowerPoint, Keynote or Google Slides, use **Save as / Download → PDF**, then add the PDF the same way.

### Show objects only

**Content Settings → Show objects only** makes a plain slide background see-through, so text and pictures sit straight on top of the camera picture. It works on both PowerPoint Content and live Window Content.

- It removes the colour found in the slide's corners (with a soft edge).
- Design the slides with **one solid background colour** that the text and pictures don't use. Pure green (#00FF00) is safest.
- Gradients and picture backgrounds stay visible. Parts of objects that use the exact background colour also disappear.

For the technical background, limits and the formats that were evaluated (transparent WebM, ProRes 4444, animated WebP, GIF, Lottie), see [PowerPoint in detail](reference/powerpoint.md).

## Windows, screens and cameras

- **Window**: a live view of one window on your PC (a PowerPoint slide show, a web page, a Bible app). It updates as the window changes.
- **Screen share**: a whole display.
- **Camera**: your webcam, placed and sized like any other Content.

> **Important:** Keep a captured window open and not minimised. On some graphics drivers a covered or minimised window stops updating. A second display, or a separate window for the slide show, is the most reliable.

## The FRAMECAST camera

FRAMEDECKS has its own camera, listed as **FRAMEDECKS** in Windows. It sends the finished picture: your webcam (with optional blur and Camera Look) plus the live Frame. Zoom and Teams then see your cards, slides and drawings exactly as you see them in the Studio Canvas.

1. Install FRAMEDECKS with **Install the FRAMECAST camera for Zoom and Teams** ticked (Windows asks for administrator permission once). Missed it? Use **Settings → FRAMECAST Camera → Install FRAMECAST**.
2. **Restart** your meeting app. Apps read the camera list when they start.
3. Choose **FRAMEDECKS** as the camera:

| App | Where to choose it |
| --- | --- |
| **Zoom** | Settings → Video → Camera → **FRAMEDECKS**. Tick **HD**. Turn off Zoom's own background blur and "mirror my video" if text looks reversed to you only. |
| **Microsoft Teams** | Settings → Devices (or Video and effects) → Camera → **FRAMEDECKS** |
| **Google Meet** | ⋮ → Settings → Video → Camera → **FRAMEDECKS** (in Chrome or Edge) |
| **OBS Studio** | Sources → **+** → Video Capture Device → Device: **FRAMEDECKS** |

4. In **Settings → FRAMECAST Camera**, choose:
   - the **webcam** behind it;
   - the **resolution** (720p or 1080p);
   - **background blur**;
   - the **Camera Look** (colour style);
   - whether your **cards** appear on the camera.

> **Important:** Choose **FRAMEDECKS** in every meeting app, not your webcam itself. Only one app at a time can open a webcam.

## Camera Looks and background blur

- **Camera Looks** adjust colour and warmth (Warm, Dark / Polished, Neutral / Clean, or Off). Use them to make a dim room or a lamp-lit home look natural.
- **Background blur** softens what is behind the speaker, using a person-detection model on your PC. No video leaves the PC for this.
- Both are in **Settings → FRAMECAST Camera** and apply to the webcam only, never to your cards or slides.

## Projectors and the Presentation window

For an in-room projector or TV, use the **Presentation window**:

1. On the Studio Canvas, select **Share Window**. A separate window called **FRAMEDECKS Share Window** opens, showing only the live picture.
2. Drag it to the projector display and switch it to **full screen**.
3. To share it in Zoom instead, choose **Share Screen → FRAMEDECKS Share Window**.

The Presentation window, the FRAMECAST camera and the Studio Canvas all show the same picture.

## OBS and browser overlay pages

If you already produce your stream in OBS, you can use FRAMEDECKS's overlay pages as **Browser Sources**. They show the cards and text on a transparent background, so they sit on top of your OBS scenes.

- The pages are served from your PC at `http://localhost:8750/` (for example `http://localhost:8750/stage.html`).
- The command bar's status shows how many overlay pages are open (for example **OBS · 1 open**).
- Each piece of Content can be limited to the FRAMECAST camera or the overlay pages in **Content Settings → Show on**.

> **Note:** Overlay pages show cards and text. Camera and media Content are part of the FRAMEDECKS picture, so in OBS use the **FRAMEDECKS** camera source for those.

## Preparing media

| Topic | Recommendation |
| --- | --- |
| Shape | **16:9** (widescreen). Slides and images at **1920 × 1080** look sharp at 720p and 1080p |
| Pictures | PNG or JPG. Use PNG for graphics with text |
| Video | MP4 (H.264) is the safest choice |
| Slides | Large text (at least 32 pt), high contrast, few words per slide. Leave the bottom fifth clear if questions or scriptures will appear there |
| Song words | Use Text Content or a PowerPoint/PDF deck (see [FAQ](faq.md#worship-and-lyrics)) |
| Files | Keep them on the PC, not on a network drive or USB stick that may be removed |
| Rehearsal | Open every Frame once before the service so files are loaded and checked |

## Performance tips

- Keep **Settings → General → Light on graphics card** on (the default). The app window then uses the processor, leaving the graphics card free for Zoom and Windows.
- Close what you don't need: extra browser tabs, other video apps and unused overlay pages.
- Prefer 720p if the PC is older or the internet connection is weak.
- **Settings → Diagnostics** shows frame rate, dropped frames and processor use. The Studio Canvas shows the same figures under the picture while live.

## Related
- [Content](content.md)
- [Presentations](presentations.md)
- [PowerPoint in detail](reference/powerpoint.md)
- [Configuration guide](reference/configuration-guide.md)
- [Troubleshooting](troubleshooting.md)
- [Media team guide](ministry/media-team.md)
