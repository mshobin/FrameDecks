# FrameDecks: configuration guide (v6.5)

This guide covers what to set up after installing:
- the FrameRelay camera;
- the app window;
- where settings are stored.

For installing, see `docs/development/building-the-installer.md`. For what each feature does, see `docs/reference/features.md`.

---

## 1. FrameRelay camera

1. Install with **Install the FrameRelay camera for Zoom and Teams** ticked, and allow the administrator prompt.
   - Already installed without it? Use **Settings → FrameRelay Camera → Install FrameRelay**.
2. Restart Zoom, Teams, OBS or the browser you use for Google Meet. They read the camera list when they start.
3. Choose **FrameDecks** as the camera in each app:
   - **Zoom:** Settings → Video → Camera → FrameDecks. Tick **HD**, and turn off Zoom's own background blur.
   - **Microsoft Teams:** Settings → Devices (or Video and effects) → Camera → FrameDecks.
   - **Google Meet:** ⋮ → Settings → Video → Camera → FrameDecks.
   - **OBS:** Sources → + → Video Capture Device → Device: FrameDecks.
4. **Settings → FrameRelay Camera** sets:
   - which webcam is behind it;
   - the resolution (720p or 1080p);
   - background blur;
   - the Camera Look;
   - whether your cards appear on the camera;
   - **Picture quality** (folded): a **Quick setting** (Setting, Strength of the look, Zoom in); **Light and colour**
     (Brightness and Colour, each Automatic or Set it myself, with Shutter speed, Light boost and Warm ↔ cool; Bright
     window behind you; Flickering lights; **Fine-tune light and colour** with **Put these back to normal**); and
     **More webcam options** (Webcam picture, Smoothness, Dark areas / Fix grey blacks).
5. **Diagnostics** (folded, in the same page) gives a one-line answer: *Everything looks normal.*, or what to try.
   **Technical details (for support)** holds the numbers to send to support.

**Upgrading from a version before 6.4:** the camera had its earlier name. The installer renames it and keeps the
same device ID. In OBS, point any old source that used the camera's earlier name at FrameDecks once.

---

## 2. App window

- The installed app opens in its own window. Since 6.8 it has no Windows title bar: the top bar is the ribbon (drag
  to move, double-click to maximize), with **Minimize**, **Maximize/Restore** and **Close** at the top right.
  **Settings → General → Window and tray**:
  - **Modern window**: off brings back the Windows title bar (restart), which follows **Settings → General →
    Appearance** (dark, light or match Windows);
  - **Minimize button**: Ask each time, Hide to tray, or Stay in taskbar;
  - **Spotlight**: the system-wide search shortcut (Alt+Space by default; Ctrl+Space, Ctrl+Alt+Space,
    Ctrl+Shift+Space, Win+Shift+K or Off), with a line saying whether it works.
  (The Teleprompter overlay settings were removed in 8.0: the one Teleprompter window always stays on top and is
  left out of screen sharing, with nothing to set.)
- **Close (X)** asks whether to keep running in the background (camera, overlays and phone remote keep
  working) or quit. The icon near the clock opens it again.
- If **Microsoft Edge WebView2 Runtime** is missing, the app opens as an Edge app window instead (no address bar or
  tabs). Install WebView2 from microsoft.com for the full app window.
- **Settings → General → Light on graphics card** (on by default) draws the window without the GPU, which keeps Zoom
  and Windows smooth.

---

## 3. Where settings are stored

Everything is in the data folder, `%APPDATA%\FRAMEDECKS`. Earlier versions, published under the program's
earlier name, used a folder and file names carrying that name; on first start, 6.9 moves them here once (including
backups and recordings) and never overwrites newer data.

| File | Contents |
| --- | --- |
| `kc-saved-content.json` | Frames, their Content (with their own question and scripture lists), branding, the meeting details (`meeting`, see below), live state (including drawings) |
| `kc-members-private.json` | Members and member settings (never sent to the remote or the overlays) |
| `kc-app-settings.json` | App options: remote autostart, Light on graphics card, native Presentation window |
| `kc-remote-pin.txt`, `kc-remote-sessions.json` | Phone remote PIN and signed-in phones |
| `bcc-brand-logo.png` | Your uploaded logo (internal file name kept for compatibility) |
| `webview\`, `appwindow\` | The app window's browser storage |
| `backups\` | Daily and manual backups |

(Files called `kc-teamspace*.json` from v6.4 are no longer used and can be deleted.)

**The meeting details (6.9).** `kc-saved-content.json` keeps the meeting's details under `meeting`. They come from the
Meeting Workbook's **Meeting Form** when you import it, and go back into it when you export.

| Field | On the Meeting Form | Longest |
| --- | --- | --- |
| `title` | Meeting name (also names the group of imported Frames) | 80 characters |
| `date` · `time` | Date (`2026-10-25`) · Time (`19:00`) | 40 each |
| `location` | Location / link | 200 |
| `presenter` · `contact` | Speaker name · Speaker contact | 80 · 120 |
| `attendees` · `attendeeNotes` | Expected attendees · Attendee notes | 20 · 2000 |
| `owner` · `contentNotes` | Presentation owner · Content notes | 80 · 2000 |
| `notes` | Meeting notes | 2000 |
| `extra` | Additional notes | 4000 |

### Environment variables (developers and tests)
| Variable | Effect |
| --- | --- |
| `KC_DATA_DIR` | Use another data folder |
