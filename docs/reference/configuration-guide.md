# FRAMEDECKS: configuration guide (v6.5)

This guide covers what to set up after installing:
- the FRAMEDECKS camera;
- the app window;
- where settings are stored.

For installing, see `docs/development/building-the-installer.md`. For what each feature does, see `docs/reference/features.md`.

---

## 1. FRAMEDECKS camera

1. Install with **Install the FRAMEDECKS camera for Zoom and Teams** ticked, and allow the administrator prompt.
   - Already installed without it? Use **Settings → FRAMEDECKS Camera → Install FRAMEDECKS**.
2. Restart Zoom, Teams, OBS or the browser you use for Google Meet. They read the camera list when they start.
3. Choose **FRAMEDECKS** as the camera in each app:
   - **Zoom:** Settings → Video → Camera → FRAMEDECKS. Tick **HD**, and turn off Zoom's own background blur.
   - **Microsoft Teams:** Settings → Devices (or Video and effects) → Camera → FRAMEDECKS.
   - **Google Meet:** ⋮ → Settings → Video → Camera → FRAMEDECKS.
   - **OBS:** Sources → + → Video Capture Device → Device: FRAMEDECKS.
4. **Settings → FRAMEDECKS Camera** sets:
   - which webcam is behind it;
   - the resolution (720p or 1080p);
   - background blur;
   - the Camera Look;
   - whether your cards appear on the camera.

**Upgrading from a version before 6.4:** the camera had its earlier name. The installer renames it and keeps the
same device ID. In OBS, point any old source that used the camera's earlier name at FRAMEDECKS once.

---

## 2. App window

- The installed app opens in its own window. Since 6.8 it has no Windows title bar: the top bar is the ribbon (drag
  to move, double-click to maximize), with **Minimize**, **Maximize/Restore** and **Close** at the top right.
  **Settings → General → Window and tray**:
  - **Modern window**: off brings back the Windows title bar (restart), which follows **Settings → General →
    Appearance** (dark, light or match Windows);
  - **Minimize button**: Ask each time, Hide to tray, or Stay in taskbar;
  - **Spotlight**: the system-wide search shortcut (Alt+Space by default; Ctrl+Space, Ctrl+Alt+Space,
    Ctrl+Shift+Space, Win+Shift+K or Off), with a line saying whether it works;
  - **Teleprompter overlay**: its starting Transparency, Frosted glass, Stay on top and Compatibility transparency.
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
