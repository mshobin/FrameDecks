# Testing

Kingdom Connect is tested in three layers: automated tests that run in seconds, a self-check that proves the program
starts and serves everything it needs, and a manual service-safety test on a real Windows PC before each release.

## Automated tests

```bash
node tests/run.js            # runs every tests/*.test.js; exit code 0 = all passed
VERBOSE=1 node tests/run.js  # also prints each test's output
```

No packages need to be installed: the tests use only Node.js.

The desktop settings and shortcut logic (6.8) is tested in Python, with no extra packages:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

| Test | What it checks |
| --- | --- |
| `tests/store.test.js` | The shared state in `app/js/store.js`: older saved data is converted so every Frame owns its question and scripture lists, the conversion gives the same ids every time, taking a Frame live shows its own items, Duplicate makes a fully independent copy, "one Frame per question" works, and an older Frame-wide output switch moves onto its Content. |
| `tests/meeting-workbook.test.js` | The Excel Meeting Workbook: the bundled template parses into the expected Frames and Content, and an exported meeting reads back the same. |
| `tests/test_desktop.py` | The 6.8 desktop logic: Spotlight shortcut parsing and formatting, validation of the window and overlay settings, and safe no-ops of `desktop_win.py` off Windows. The window features themselves need a real Windows desktop (see the manual checks below). |

`tests/helpers/load-store.js` loads `app/js/store.js` into Node with small browser stand-ins and returns
`{Store, Scenes, Present}`, so store behaviour can be tested without a browser.

### Writing a test

Create `tests/<name>.test.js`. A test is a plain Node script that throws, or exits with a non-zero code, on failure:

```js
const env = require('./helpers/load-store.js')(), assert = require('assert');
const st = env.Store.normalize({scenes: [{id: 'sc_a', name: 'A', layers: []}]});
assert.strictEqual(st.scenes[0].name, 'A');
console.log('my feature: OK');
```

Prefer testing behaviour through the same helpers the app uses (`Store.normalize`, `KCScenes`), not internal details.

## Self-check

```bash
python packaging/check.py
```

The self-check starts the program on a temporary data folder and checks that:

- every page and script the app needs is served (the list in `packaging/check.py`; add new files there);
- the camera ID and name in the app match the ones compiled into the KingdomConnect camera;
- the background-blur model loads, and the camera's card drawing works;
- in the GitHub build, the camera driver files were built.

## Continuous integration

The **Build Windows installer** workflow (`.github/workflows/build-windows.yml`) runs on `windows-latest` for every
push to `main`, every version tag and every manual run. It builds the KingdomConnect camera, runs the self-check and
the tests, and only then packages the app and the installer. A failing check stops the build, so a broken installer is
never produced.

## Interface testing during development

Changes to the interface have been checked during development by driving the real app in a headless Chromium with
[Playwright](https://playwright.dev/): start the program with a test data folder and the test camera, open the
dashboard and the phone remote (at phone size), click through the flow, and compare screenshots. You don't need this to
contribute, but screenshots of before and after are expected in pull requests that change the interface. Automating
these flows in CI is on the [roadmap](../../ROADMAP.md).

Useful set-up for any manual or automated test:

```bash
KC_DATA_DIR=/tmp/kc-test KC_VCAM_DEMO=1 python server.py --no-browser --remote
```

- `KC_DATA_DIR` keeps test data away from real meetings and members.
- `KC_VCAM_DEMO=1` gives a moving test picture, so the camera pipeline, previews and the phone's live picture work
  without a webcam.
- `http://localhost:8750/api/remote-info` shows the phone remote's PIN and addresses on this PC.

## Manual service-safety test

Run this on a real Windows PC with the installed app before every release, and for any change that touches the live
flow. Use a test Zoom or Teams meeting, a real webcam and a phone on the same Wi-Fi. Allow about 20 minutes.

**Preparation**
- [ ] Install over the previous version. Meetings, members and settings are still there.
- [ ] Zoom or Teams lists **KingdomConnect**; choose it. Your webcam picture appears.

**Running a meeting**
- [ ] Select a Frame and press **Go Live** (or T). It appears in Zoom.
- [ ] **◀ / ▶ Frame** moves through the meeting; the Frame list and the picture agree.
- [ ] **→ / ←** steps through a Frame's questions; **Shift + → / ←** through its scriptures.
- [ ] **Hide all** (Esc) clears every card at once.
- [ ] **Blackout** (K) gives a black picture; pressing it again brings the picture back.
- [ ] **Freeze** (F) holds the picture; unfreeze returns to live video.
- [ ] **Annotate** (D): draw with the pen and a rectangle; undo; Esc hides the drawings.
- [ ] A PowerPoint Content shows its slides and Page Down / Page Up move through them.
- [ ] Double-click a question on the canvas, change it, press Enter: the screen updates. Double-click its label, change it, press Esc: nothing changes.
- [ ] Double-click a Frame's name: it renames in place. Double-click elsewhere on the row: the Frame goes live.
- [ ] Ctrl+Click two Frames, press Delete, then **Undo** in the message: both come back.
- [ ] **Ctrl+K** opens the command palette; type a Frame's name and press Enter.

**Phone remote**
- [ ] Turn on the remote, scan the QR code, sign in with the PIN.
- [ ] Simple remote: **Next Frame**, **Next Content**, **Black Screen**, **Freeze** all work and the PC agrees.
- [ ] **Annotate** on the phone shows the live picture; a stroke appears in Zoom where you drew it.
- [ ] Turn off the PC's Wi-Fi for 10 seconds and back on: the remote shows it is disconnected, then reconnects.

**Other windows**
- [ ] **Teleprompter** (R) docks Left, Right, Bottom and Float; **Space** scrolls it. Its text never appears in Zoom, the Presentation window or the OBS pages.
- [ ] **Teleprompter window** shows the Frame's script, the item on screen and the next item (no answers or notes).
- [ ] The phone's **TELEPROMPTER** button opens the script full screen.
- [ ] The **Presentation window** opens and can be shared in Zoom as "Kingdom Connect Share Window".

**Window, tray and Spotlight (6.8)**

These need a real Windows desktop; CI cannot run them. Test on Windows 10 and Windows 11 if you can.
- [ ] **Ribbon:** drag an empty part of the command bar: the window moves. Drag it to a screen edge: Snap works
      (also Windows key + arrows). Double-click the ribbon: it maximizes; again: it restores. Resize from every edge
      and corner. A maximized window does not cover the taskbar.
- [ ] **Buttons:** Minimize, Maximize / Restore (the icon follows the state) and Close at the top right of the main
      window, the Teleprompter window and the overlay. Close on the main window still asks *keep running or quit*.
- [ ] **Minimize question:** Minimize asks *Hide application to system tray?* **Hide To Tray** removes the taskbar
      button and the camera keeps sending to Zoom. **Stay In Taskbar** minimizes as usual. **Remember my choice**
      stops the question; Settings → General → Window and tray → **Minimize button** changes it back.
- [ ] **Tray menu:** a click on the icon opens the app. **Open App**, **Teleprompter** (overlay on / off), **Search**
      (Spotlight), **Settings**, each item under **More** (Look, Frame, Stop screen share, Hide all overlays,
      Presentation window, Phone remote) and **Exit** all work.
- [ ] **Spotlight:** with the app hidden in the tray, press **Alt+Space**: Spotlight opens in the middle of the
      screen under the mouse, in front, with the cursor in the search box. Do it again with Zoom (or another app)
      focused. **Go Live** and **Next Frame** run without bringing the main window back; a setting opens the main
      window. **Esc** and a click away close it. With PowerToys Run on Alt+Space, Settings shows
      **Ctrl+Alt+Space** working. Change the shortcut and set it **Off**.
- [ ] **Overlay modes:** open the overlay (**Shift+R**) over a Zoom meeting window. With **Light on graphics card**
      off (restart after changing it), keys **1** to **5** go from Solid to Ghost, the meeting shows through and the
      text stays solid and readable. With it on, the whole window fades, text included.
- [ ] **Frost:** frosted glass blurs the meeting behind (Acrylic on Windows 11 22H2+, blur on Windows 10).
- [ ] **Stay on top:** with 📌 on (or **P**), the overlay stays above Zoom, Teams, a browser and a PowerPoint slide
      show running full screen. Turn it off and on again; close and reopen the overlay: the choice is remembered.
- [ ] **Toolbar:** it fades after about 3 seconds and comes back on mouse movement, with the ribbon. Drag the ribbon
      to move the overlay; resize from the edges. **Space**, **M** (mirror) and **Esc** (exit) work.
- [ ] **Never shared:** share the whole screen in Zoom and in Teams: participants (a second device) do not see the
      overlay, the Teleprompter window or Spotlight. An OBS **Display Capture** does not show the overlay either
      (Windows 10 2004 or later).
- [ ] **Modern window off:** Settings → General → Window and tray → **Modern window** off, restart: the Windows
      title bar is back and every window works normally. Turn it on again.
- [ ] **Compatibility transparency:** turn it on, reopen the overlay: the whole window fades in every mode.

**Command bar and Meeting Workbook (6.9)**
- [ ] **Command bar:** no search box, no Presentation Mode button, no **Hide the app window** button. **Hide all**
      shows **Esc** inside the button; **Program ▾** opens as a drop-down. Resize the window below 1140 px wide:
      the bar wraps to two rows and nothing is cut off. Check maximized, on an ultra-wide screen and at 150 % or
      200 % display scaling.
- [ ] **Template:** ✨ Meeting → *Download the Excel template*. It has two tabs, **Dashboard** and **Meeting Form**.
      The Dashboard updates when you change the Meeting Form (date, speaker, Frames). The **+** buttons on the left
      open more table rows.
- [ ] **Import and export:** import the template; the preview names problems as *Meeting Form · Content · row …*.
      Export the meeting: the file has the same two tabs, filled in, and imports again. A 6.5–6.8 workbook (one
      sheet per list) still imports.

**Closing**
- [ ] Close the window and choose **Keep running in the background**: Zoom still shows the picture.
- [ ] Quit from the tray icon, reopen: everything is still there.

Record the Windows version, the webcam, the Zoom or Teams version and the result in the pull request or release
checklist.
