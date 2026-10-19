# Testing

Kingdom Connect is tested in three layers: automated tests that run in seconds, a self-check that proves the program
starts and serves everything it needs, and a manual service-safety test on a real Windows PC before each release.

## Automated tests

```bash
node tests/run.js            # runs every tests/*.test.js; exit code 0 = all passed
VERBOSE=1 node tests/run.js  # also prints each test's output
```

No packages need to be installed: the tests use only Node.js.

| Test | What it checks |
| --- | --- |
| `tests/store.test.js` | The shared state in `app/js/store.js`: older saved data is converted so every Frame owns its question and scripture lists, the conversion gives the same ids every time, taking a Frame live shows its own items, Duplicate makes a fully independent copy, "one Frame per question" works, and an older Frame-wide output switch moves onto its Content. |
| `tests/meeting-workbook.test.js` | The Excel Meeting Workbook: the bundled template parses into the expected Frames and Content, and an exported meeting reads back the same. |

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

Prefer testing behaviour through the same helpers the app uses (`Store.normalize`, `BSFScenes`), not internal details.

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
BSF_DATA_DIR=/tmp/kc-test BSF_VCAM_DEMO=1 python server.py --no-browser --remote
```

- `BSF_DATA_DIR` keeps test data away from real meetings and members.
- `BSF_VCAM_DEMO=1` gives a moving test picture, so the camera pipeline, previews and the phone's live picture work
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
- [ ] The **Presentation window** opens and can be shared in Zoom as "BSF Presentation".

**Closing**
- [ ] Close the window and choose **Keep running in the background**: Zoom still shows the picture.
- [ ] Quit from the tray icon, reopen: everything is still there.

Record the Windows version, the webcam, the Zoom or Teams version and the result in the pull request or release
checklist.
