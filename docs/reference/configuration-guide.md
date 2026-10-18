# Kingdom Connect: configuration guide (v6.5)

This guide covers what to set up after installing:
- the KingdomConnect camera;
- the app window;
- where settings are stored.

For installing, see `docs/development/building-the-installer.md`. For what each feature does, see `docs/reference/features.md`.

---

## 1. KingdomConnect camera

1. Install with **Install the KingdomConnect camera for Zoom and Teams** ticked, and allow the administrator prompt.
   - Already installed without it? Use **Settings → KingdomConnect Camera → Install KingdomConnect**.
2. Restart Zoom, Teams, OBS or the browser you use for Google Meet. They read the camera list when they start.
3. Choose **KingdomConnect** as the camera in each app:
   - **Zoom:** Settings → Video → Camera → KingdomConnect. Tick **HD**, and turn off Zoom's own background blur.
   - **Microsoft Teams:** Settings → Devices (or Video and effects) → Camera → KingdomConnect.
   - **Google Meet:** ⋮ → Settings → Video → Camera → KingdomConnect.
   - **OBS:** Sources → + → Video Capture Device → Device: KingdomConnect.
4. **Settings → KingdomConnect Camera** sets:
   - which webcam is behind it;
   - the resolution (720p or 1080p);
   - background blur;
   - the Camera Look;
   - whether your cards appear on the camera.

**Upgrading from a version before 6.4:** the camera was called *BCC vCam*. The installer renames it and keeps the
same device ID. In OBS, point any old "BCC vCam" source at KingdomConnect once.

---

## 2. App window

- The installed app opens in its own window, with Windows' **Minimize**, **Maximize/Restore** and **Close**. The
  title bar follows **Settings → General → Appearance** (dark, light or match Windows).
- **Close (X)** asks whether to keep running in the background (camera, overlays and phone remote keep
  working) or quit. The icon near the clock opens it again.
- If **Microsoft Edge WebView2 Runtime** is missing, the app opens as an Edge app window instead (no address bar or
  tabs). Install WebView2 from microsoft.com for the full app window.
- **Settings → General → Light on graphics card** (on by default) draws the window without the GPU, which keeps Zoom
  and Windows smooth.

---

## 3. Where settings are stored

Everything is in the data folder, `%APPDATA%\BSF Command Center`. The folder keeps its original name so upgrades
keep your data.

| File | Contents |
| --- | --- |
| `bsf-saved-content.json` | Frames, their Content (with their own question and scripture lists), branding, the Meeting Overview, live state (including drawings) |
| `bsf-members-private.json` | Members and member settings (never sent to the remote or the overlays) |
| `bsf-app-settings.json` | App options: remote autostart, Light on graphics card, native Presentation window |
| `bsf-remote-pin.txt`, `bsf-remote-sessions.json` | Phone remote PIN and signed-in phones |
| `bcc-brand-logo.png` | Your uploaded logo (internal file name kept for compatibility) |
| `webview\`, `appwindow\` | The app window's browser storage |
| `backups\` | Daily and manual backups |

(Files called `kc-teamspace*.json` from v6.4 are no longer used and can be deleted.)

### Environment variables (developers and tests)
| Variable | Effect |
| --- | --- |
| `BSF_DATA_DIR` | Use another data folder |
