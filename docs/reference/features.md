# Kingdom Connect: feature documentation (v6.7)

## v6.7 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Inline editing** | No pop-up windows. Double-click a Frame's or Content's **name** to rename it (or F2); double-clicking elsewhere on a Frame row still Goes Live. In a Frame's question / scripture list, double-click the label or text. On the Studio Canvas, double-click any card (question, scripture, announcement, prayer, discussion topic, icebreaker, poll, lower third, timer) to edit its body, or its label (top line) to edit the label. Enter saves, Shift+Enter new line, Esc cancels, clicking away saves | `app/js/editable.js`, `app/js/preview-edit.js`, `app/js/frame-lists.js` |
| **New Content presets** | **+ Content → Discussion topic, Icebreaker, Poll (show of hands)**: text cards with a ready label and sample text. The Poll is display only (no voting devices, nothing counted). Also in the Content Library, under Discussion Questions | `app/js/workspace.js` (`TEXT_PRESETS`), `app/js/store.js` (Library) |
| **No answers or presenter notes on screens** | Removed from the main app, the Teleprompter window, the phone remote and Content Settings. Old data is kept, not deleted | `app/js/frame-lists.js`, `app/js/speaker.js`, `app/js/remote.js` |
| **Content Settings order** | **Label**, **Content**, **Display Settings** (with **Animation** and **Show on**), **Visual Settings**; Media for pictures, video and PowerPoint | `app/js/workspace.js` (`GROUPS`) |
| **Teleprompter** | The Frame's **Teleprompter script** (was Leader notes; up to 20,000 characters; `# Heading`, `- bullet`, `**bold**`, `*italic*`, `[PAUSE]`, `---`). Program → Teleprompter (R) docks it Left / Right / Bottom or Float, resizable, **Follows: Live / Selected**. Scroll play / pause (Space), five speeds, A− / A+, line spacing, high contrast, Focus mode (F), Home, arrow / Page keys, wheel and touch. Cue line: Frame i of n, LIVE, next Frame, next question or scripture. Never on any output | `app/js/teleprompter.js`, `app/js/prompter-dock.js` |
| **Teleprompter window** | Program → Teleprompter window (was Speaker View): the Teleprompter in its own window for a second screen, with clocks, a timer, what is on screen and what is next | `app/speaker.html`, `app/js/speaker.js` |
| **Phone teleprompter** | A Teleprompter panel on the Live tab of the Advanced remote; a **TELEPROMPTER** button in the Simple remote opens it full screen | `app/remote.html`, `app/js/remote.js` |
| **Branding options** | Display (Logo only / Name only / Logo + Name, optional Organization), Position (four corners or centred), Safe margin, Size (Small / Medium / Large + fine size), Opacity, Padding, Background plate (off = soft shadow). The same on the camera and the OBS pages; scales with resolution. **Remove background** makes a plain logo background transparent on the PC, with Undo | `app/js/workspace.js` (`brandForm`), `app/js/meeting-brand.js`, `vcam/program.py`, `app/js/overlay.js` |
| **Multi-select** | Ctrl+Click, Shift+Click or a drag box in empty list space selects several Frames or Contents. Delete / Backspace (Undo in the message; confirmation only for 5 or more), Ctrl+C / X / V, Ctrl+D, Ctrl+A, right-click menu, drag to move | `app/js/workspace.js` |
| **Command palette** | Ctrl+K or Ctrl+Space (Settings → Keyboard shortcuts → Command palette), or the header search box. Finds Frames, Content, questions, scriptures, text, templates, Library, branding, settings, members, Bible references, recent items; runs commands (Go Live, New Frame, Duplicate, Teleprompter, Export meeting, theme, Add Content…). Arrow keys + Enter; Esc closes | `app/js/palette.js` |
| **Meeting Workbook** | No Answer / Notes columns; the Frames sheet's last column is Teleprompter Script. Older workbooks still import, with answers and notes going into the Frame's Teleprompter script | `app/js/meeting-book.js` |
| **Faster start-up** | The Excel library loads only when first needed | `app/js/dashboard.js` |

## v6.5 at a glance

Some rows below changed in 6.7 (Content Settings groups, the list editor, the Advanced remote's notes); the table
above describes them as they are now.

| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Meeting → Frame → Content** | **+ Frame** makes one blank Frame. **+ Content** adds Question, Scripture, Text, Image, Video, Timer, PowerPoint or Free Content to the selected Frame | `app/js/workspace.js` |
| **Independent Frames** | Each Question / Scripture Content owns its list (`layer.c.items`) and its appearance (`layer.c.look`). Duplicate gives new ids to the Frame, every Content and every item. Older data is converted on load with ids derived from the old ones | `app/js/store.js` (`ownLists`, `freshIds`, `applyLook`) |
| **Content Settings** | One panel per selection, every setting visible in groups (Content, Appearance, Position, Timing, Animation, Media, Behavior); no Basic / Advanced | `app/js/workspace.js` (`renderInspector`) |
| **Question / Scripture lists** | Full-height list; click = current, double-click = edit in the same panel (label, text, answer, notes, transition) | `app/js/frame-lists.js` |
| **Annotate** | Pen, highlighter, arrow, line, rectangle, ellipse, text; colours, thickness, undo / redo / clear; above all Content, PowerPoint and cards on KingdomConnect, the overlay pages and the phone | `app/js/annotate.js`, `vcam/annotate.py`, state `live.ink` |
| **Freeze / Black screen** | Hold the picture (drawings stay on top) / black picture; keys F and K | `vcam/program.py`, state `live.freeze`, `live.blackout` |
| **PowerPoint** | A .pptx becomes slides via the installed PowerPoint (COM SaveAs PDF); a live window keeps animations; **Show objects only** keys out a plain slide background | `vcam/powerpoint.py` (`pptx_to_pdf`), `vcam/layers.py` (`key_background`), `docs/reference/powerpoint.md` |
| **Simple / Advanced remote** | Simple (default): Frame and Content steppers, Annotate, Freeze, Black Screen. Advanced: search, notes, run-through, PowerPoint, annotation | `app/remote.html`, `app/js/remote.js` |
| **Meeting Workbook** | Five-sheet Excel template with drop-downs, import with preview, export | `app/js/meeting-book.js`, `tools/make_meeting_workbook.py` |
| **No collaboration** | Team Space removed; local save, autosave, export, backups and Frame history remain | — |

The rest of this document describes the v6.4 features that are still current: the KingdomConnect camera, logo-only
branding and native desktop behaviour.


This document describes what each v6.4 feature does, how it is built and where its limits are:

- the KingdomConnect camera;
- logo-only branding;
- native desktop behaviour.

For the earlier features, see `docs/reference/meeting-workbook-and-branding.md` (v6.2), `docs/architecture/design-history.md` and the release notes in
`docs/releases/`.

---

## 1. The KingdomConnect camera

Kingdom Connect has its own camera for Zoom, Microsoft Teams, Google Meet, OBS and other apps that read Windows
cameras. Windows lists it as **KingdomConnect**. It sends the finished picture: your webcam with optional background
blur and a Camera Look, plus the live scene (cards, text, pictures, slides, branding).

| | |
| --- | --- |
| Name in other apps | **KingdomConnect** |
| Registered by | The installer, with the option **Install the KingdomConnect camera for Zoom and Teams** (asks for administrator permission once) |
| Driver files | `kingdomconnect_vcam64.dll` and `kingdomconnect_vcam32.dll` in `_internal\vcam\bin`. They are built from softcam (MIT licence) by `packaging/build_vcam.py` |
| Camera ID (CLSID) | `{6F2B8C3E-4D7A-4B9E-9C11-B5CC0A1E7D21}`. This is the same ID as before, so apps that remembered the camera keep it |
| Settings | **Settings → KingdomConnect Camera** |
| Status | The status menu in the command bar: **KingdomConnect** · Off / Ready / In use |

### Upgrading from "BCC vCam"
Before 6.4 the same camera was called **BCC vCam**. Installing 6.4 does the following:
- It registers the camera again under its new name. This happens even if the option is not ticked, as long as the
  camera was already installed, because the driver file was renamed.
- Zoom, Teams, Meet and OBS show **KingdomConnect** after they are restarted. They read the camera list when they
  start.
- An OBS scene that used "BCC vCam" as a *Video Capture Device* may need that source pointed at KingdomConnect once.

The app also still recognises its old name, so it never captures its own picture during the upgrade.

### Limits
- Windows only (DirectShow). Apps that read only Media Foundation cameras without the Windows 11 DirectShow bridge
  may not list it. Zoom, Teams, Google Meet in Chrome or Edge, and OBS do list it.
- One app at a time can use the webcam behind it. Choose KingdomConnect in every meeting app, not the webcam itself.

---

## 2. Team Space (removed in v6.5)

Team Space (co-leaders' presence, shared notes and actions, Ask to Go Live over WireGuard) was removed in v6.5 to keep
Kingdom Connect a simple, single-PC app. No settings, listener or peer protocol remain. Old `kc-teamspace*.json`
files in the data folder are ignored and can be deleted. Meetings are shared by **exporting** them (Excel Meeting
Workbook or a Frame file) instead.

---

## 3. Logo-only branding

The app's own branding is the **Book + Candle** mark (`app/img/kc-emblem.webp`) and nothing else:
- **Command bar (dashboard header):** the mark alone, 30 px wide. There is no "Kingdom Connect" wordmark or text
  beside it. The name and the Meeting Name are kept for screen readers, in the mark's tooltip and in the window
  title.
- **Phone remote:** the sign-in screen shows the mark alone, and the remote's top bar shows the mark and the mode
  (Simple / Standard / Advanced).
- **Home-screen icons** (`app/icons/remote-*.png`): the mark on a navy tile, with no text. The Windows app icon
  (`packaging/bsf.ico`) was already the mark alone.
- **Dialogs and overlays** show no product branding. The leader's own logo and Meeting Name (Settings → Meeting &
  Branding) still appear only where the leader puts them.
- **About page:** unchanged. It keeps its own branding and content.

The wordmark styles are no longer used in the header. `.sr-only` keeps the text available to assistive technology.

---

## 4. Native desktop behaviour

The installed app is a desktop application, not a web page in a browser:
- **Its own window (WebView2):** no address bar, tabs, browser toolbar or browser buttons.
- **Title bar:** the Windows title bar keeps **Minimize**, **Maximize/Restore** and **Close** (with Snap Layouts),
  drawn by Windows. It follows the app's theme:
  - dark or light caption on Windows 10 and 11;
  - on Windows 11, the exact colour of the command bar, so the window reads as one surface like Teams or Slack.

  The page tells the app when the theme changes (`POST api/app/window`).
- **No browser behaviour inside the window:**
  - Reload (F5, Ctrl+R), Print (Ctrl+P), Save (Ctrl+S), View source (Ctrl+U), zoom (Ctrl + + / − / 0 / wheel),
    history (Alt+← / →) and developer tools keys do nothing;
  - the browser right-click menu appears only in text boxes;
  - a file dropped outside a drop zone does not replace the page.
- **Without WebView2:** the app opens as an Edge (or Chrome) **app window** (`--app` mode, separate profile in
  `appwindow` in the data folder). It also has no address bar, tabs or browser buttons, and the same guards apply.
  Only if neither browser exists does it fall back to a normal browser tab.
- **Close (X):** asks whether to keep running in the background (so the camera, overlays and Team Space keep
  working) or quit. This is unchanged.
- A browser tab opened by hand at `http://localhost:8750` behaves like a normal web page.

A fully custom-drawn title bar was not needed. Windows' own caption, coloured to match, keeps Snap Layouts,
accessibility and the expected window behaviour.
