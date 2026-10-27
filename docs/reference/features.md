# FrameDecks: feature documentation (v6.9)

## v6.9 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Meeting Workbook: Dashboard + Meeting Form** | Two tabs only. **Meeting Form**: one guided page in numbered sections (1 · Meeting details, 2 · Speaker, 3 · Attendees, 4 · Presentation, 5 · Frames, 6 · Content, 7 · Discussion questions, 8 · Scripture readings, 9 · Additional notes); cream boxes to type in, drop-downs in the cells, a few open rows per table and more behind Excel's **+** button (Frames 60, Content 150, questions 150, scriptures 100). **Dashboard**: formulas only, never imported: status pill, This meeting, counts, Meetings tiles, Readiness (x / 6), Quick actions, Content mix chart, Recent meetings log | `src/meeting_form.py`, `tools/make_meeting_workbook.py`, `app/templates/FRAMEDECKS-Meeting-Workbook.xlsx` |
| **Meeting Form import** | Finds the details by their labels and the tables by their **Frame #** header rows, so a hand-made form in the same style imports too. Problems read *Meeting Form · Content · row 26: …*. Workbooks from 6.5–6.8 (one sheet per list) and the 6.2 one-sheet template still import | `app/js/meeting-book.js`, `app/js/import-worker.js` |
| **Meeting Form export** | The program fills the template (`POST api/meeting/workbook`), so the export has the same Dashboard and Meeting Form. Without the program, or when a table is longer than the form, a plain one-sheet Meeting Form. Both import again | `app/js/meeting-import.js`, `src/server.py`, `src/meeting_form.py` |
| **Meeting details** | The meeting keeps title, date, time, location, speaker (`presenter`), contact, attendees, attendee notes, owner, content notes, notes and additional notes (`extra`) | `app/js/store.js` (`meeting`) |
| **A tidier command bar** | No search box (use the command palette, Ctrl+K / Ctrl+Space, or Spotlight, Alt+Space). No Presentation Mode (and no **P** shortcut for it). No **Hide the app window** button in the Studio (Minimize and the tray do this). **Hide all** shows its **Esc** key inside the button; the **Program** menu always opens as a drop-down. The bar no longer overflows on narrow, maximized, ultra-wide or high-DPI windows: under 1140 px wide it wraps to two rows | `app/dashboard.html`, `app/css/theme.css` |

Rows in the tables below that mention the header search box, Presentation Mode or the five-sheet workbook describe
those versions; the table above describes the app as it is now.

## v6.8 at a glance
| Feature | What it does | Where it lives |
| --- | --- | --- |
| **Teleprompter overlay (Meeting Leader mode)** | Program → Teleprompter overlay (Shift+R), the tray (**Teleprompter**), Spotlight, the palette, or **Overlay** in the docked Teleprompter's header. A see-through window over Zoom, Teams or Meet. Modes (keys 1–5): Solid 0 %, Presenter 20 %, Meeting 40 % (default), Conference 65 %, Ghost 85 %; the letter outline grows as it gets more see-through. Frosted glass (Acrylic on Windows 11 22H2+, blur on Windows 10). Stay on top (📌, P), remembered. Left out of screen sharing and recordings (Windows 10 2004+). Script about 95 % of the width; a floating glass toolbar fades after about 3 s (Play / Pause, speed, A− / A+, line spacing, contrast, Mirror (M), top, edit, transparency, frost, pin, Exit (Esc)); a thin ribbon to drag and resize. Follows the Frame on screen (the first Frame before going live). With Light on graphics card on, the window fades as a whole; Compatibility transparency forces that | `app/prompter.html`, `app/js/prompter.js`, `app/js/teleprompter.js`, `src/desktop_app.py`, `src/desktop_win.py` |
| **Modern window** | No Windows title bar: the app's top bar is the ribbon (drag to move, double-click to maximize); Snap and edge resizing kept. Minimize, Maximize / Restore and Close at the top right of every window. Settings → General → Window and tray → **Modern window** off brings the title bar back (restart) | `src/desktop_win.py`, `src/desktop_app.py`, `app/js/window-chrome.js` |
| **Hide to tray** | Minimize asks *Hide application to system tray?* (Hide To Tray / Stay In Taskbar, Remember my choice; or Settings → Minimize button). In the tray the camera, overlays, phone remote and shortcuts keep working. Tray menu: Open App, Teleprompter, Search, Settings, More (Look, Frame, Stop screen share, Hide all overlays, Presentation window, Phone remote), Exit; a click opens the app | `src/desktop_app.py`, `app/js/window-chrome.js` |
| **Spotlight** | A system-wide shortcut (default Alt+Space; Ctrl+Alt+Space if another program has Alt+Space; also Ctrl+Space, Ctrl+Shift+Space, Win+Shift+K or Off). Opens centred on the screen with the mouse, above everything, even from the tray. The command palette's search; Go Live, Next / Previous Frame, Hide all, Blackout, Freeze, Teleprompter window and overlay run without bringing the main window back. Empty search: Recent, Frequently used, Suggested. Esc or clicking away closes it | `app/spotlight.html`, `app/js/palette.js`, `src/desktop_app.py`, `src/desktop_win.py` |
| **Teleprompter window** | The script takes the whole width; **On screen & next** slides the side panel in on request (hidden by default, remembered); floating toolbar like the overlay; the ribbon has the window buttons | `app/speaker.html`, `app/js/speaker.js`, `app/js/teleprompter.js` |
| **Command palette** | A **Teleprompter overlay** command, and **Frequently used** items | `app/js/palette.js` |
| **Settings → General → Window and tray** | Modern window, Minimize button, Spotlight shortcut (with a status line), and the overlay's Transparency, Frosted glass, Stay on top and Compatibility transparency | `app/js/app-bridge.js` |

Section 4 below describes the window as it was in 6.4–6.7. With **Modern window** on (the default since 6.8), the
Windows title bar is replaced by the app's ribbon, as in the table above.

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
| **Command palette** | Ctrl+K or Ctrl+Space (Settings → Keyboard shortcuts → Command palette); the header search box until 6.9. Finds Frames, Content, questions, scriptures, text, templates, Library, branding, settings, members, Bible references, recent items; runs commands (Go Live, New Frame, Duplicate, Teleprompter, Export meeting, theme, Add Content…). Arrow keys + Enter; Esc closes | `app/js/palette.js` |
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
| **Annotate** | Pen, highlighter, arrow, line, rectangle, ellipse, text; colours, thickness, undo / redo / clear; above all Content, PowerPoint and cards on FrameDecks, the overlay pages and the phone | `app/js/annotate.js`, `vcam/annotate.py`, state `live.ink` |
| **Freeze / Black screen** | Hold the picture (drawings stay on top) / black picture; keys F and K | `vcam/program.py`, state `live.freeze`, `live.blackout` |
| **PowerPoint** | A .pptx becomes slides via the installed PowerPoint (COM SaveAs PDF); a live window keeps animations; **Show objects only** keys out a plain slide background | `vcam/powerpoint.py` (`pptx_to_pdf`), `vcam/layers.py` (`key_background`), `docs/reference/powerpoint.md` |
| **Simple / Advanced remote** | Simple (default): Frame and Content steppers, Annotate, Freeze, Black Screen. Advanced: search, notes, run-through, PowerPoint, annotation | `app/remote.html`, `app/js/remote.js` |
| **Meeting Workbook** | Five-sheet Excel template (two tabs since 6.9) with drop-downs, import with preview, export | `app/js/meeting-book.js`, `tools/make_meeting_workbook.py` |
| **No collaboration** | Team Space removed; local save, autosave, export, backups and Frame history remain | — |

The rest of this document describes the v6.4 features that are still current: the FRAMECAST camera, logo-only
branding and native desktop behaviour.


This document describes what each v6.4 feature does, how it is built and where its limits are:

- the FRAMECAST camera;
- logo-only branding;
- native desktop behaviour.

For the earlier features, see `docs/reference/meeting-workbook-and-branding.md` (v6.2), `docs/architecture/design-history.md` and the release notes in
`docs/releases/`.

---

## 1. The FRAMECAST camera

FrameDecks has its own camera for Zoom, Microsoft Teams, Google Meet, OBS and other apps that read Windows
cameras. Windows lists it as **FrameDecks**. It sends the finished picture: your webcam with optional background
blur and a Camera Look, plus the live scene (cards, text, pictures, slides, branding).

| | |
| --- | --- |
| Name in other apps | **FrameDecks** |
| Registered by | The installer, with the option **Install the FRAMECAST camera for Zoom and Teams** (asks for administrator permission once) |
| Driver files | `framedecks_vcam64.dll` and `framedecks_vcam32.dll` in `_internal\vcam\bin`. They are built from softcam (MIT licence) by `packaging/build_vcam.py` |
| Camera ID (CLSID) | `{6F2B8C3E-4D7A-4B9E-9C11-B5CC0A1E7D21}`. This is the same ID as before, so apps that remembered the camera keep it |
| Settings | **Settings → FRAMECAST Camera** |
| Status | The status menu in the command bar: **FrameDecks** · Off / Ready / In use |

### Upgrading from the camera's earlier name
Before 6.4 the same camera had an earlier name. Installing 6.4 does the following:
- It registers the camera again under its new name. This happens even if the option is not ticked, as long as the
  camera was already installed, because the driver file was renamed.
- Zoom, Teams, Meet and OBS show **FrameDecks** after they are restarted. They read the camera list when they
  start.
- An OBS scene that used the camera under its earlier name as a *Video Capture Device* may need that source pointed at FrameDecks once.

The app also still recognises its old name, so it never captures its own picture during the upgrade.

### Limits
- Windows only (DirectShow). Apps that read only Media Foundation cameras without the Windows 11 DirectShow bridge
  may not list it. Zoom, Teams, Google Meet in Chrome or Edge, and OBS do list it.
- One app at a time can use the webcam behind it. Choose FrameDecks in every meeting app, not the webcam itself.

---

## 2. Team Space (removed in v6.5)

Team Space (co-leaders' presence, shared notes and actions, Ask to Go Live over WireGuard) was removed in v6.5 to keep
FrameDecks a simple, single-PC app. No settings, listener or peer protocol remain. Old `kc-teamspace*.json`
files in the data folder are ignored and can be deleted. Meetings are shared by **exporting** them (Excel Meeting
Workbook or a Frame file) instead.

---

## 3. Logo-only branding

The app's own branding is the **Book + Candle** mark (`app/img/kc-emblem.webp`) and nothing else:
- **Command bar (dashboard header):** the mark alone, 30 px wide. There is no "FrameDecks" wordmark or text
  beside it. The name and the Meeting Name are kept for screen readers, in the mark's tooltip and in the window
  title.
- **Phone remote:** the sign-in screen shows the mark alone, and the remote's top bar shows the mark and the mode
  (Simple / Standard / Advanced).
- **Home-screen icons** (`app/icons/remote-*.png`): the mark on a navy tile, with no text. The Windows app icon
  (`packaging/framedecks.ico`) was already the mark alone.
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
