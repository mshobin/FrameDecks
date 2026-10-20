# Code style

Write code that reads like the code around it. These are the conventions the repository already follows.

## General

- **Reliability first.** Prefer the simple, predictable solution. A live service cannot wait for a clever one to be
  debugged.
- **Comments explain why**, not what: the reason for a limit, a measurement, a Windows quirk, a compatibility rule.
  Match the comment density of the file you are editing.
- **Keep compatibility.** Saved data from earlier versions must keep opening. In code and in the saved file, Frames
  are still `scenes` and Content is still `layers`. Don't rename these. Data saved under the program's earlier
  name is moved once by `legacy.py` (and a marked block at the top of `app/js/store.js`); keep that name out of
  every other file.
- **No new dependencies without discussion.** The program runs on the Python standard library; the interface uses no
  npm packages and has no build step.

## JavaScript (`app/js/`)

- **One feature per file**, wrapped in an immediately invoked function in strict mode:
  ```js
  /* Kingdom Connect v6.6 - <feature>: what it does and why, in a sentence or two. */
  (function(){
  'use strict';
  var Store = window.KCStore, SC = window.KCScenes;
  var $ = function(id){ return document.getElementById(id); };
  // …
  window.KCFeatureName = {open: open};   // only what other files need
  })();
  ```
- **ES5 style:** `var`, `function`, plain loops and `Array.prototype` methods. The pages must run in the WebView2
  window, Edge and Chrome app windows, OBS browser sources and phone browsers.
- **Elements** are built with the small `h(tag, attrs, kids)` helper each file defines, not with HTML strings that
  contain user text. Use `textContent` (the `text` attribute of `h`) for anything a user typed.
- **Shared objects** are exposed on `window` with a `KC` prefix (`KCStore`, `KCScenes`, `KCFrameLists`,
  `KCPresenterTools` …). Check that a name is not already taken before adding one.
- **State changes** go through `window.KCCommit(fn)` (the dashboard) or `Store.update(fn)` (the remote). `fn`
  changes the given copy of the state; never change a state object you received from `Store.subscribe`.
- **New state fields** get a default and are cleaned in `app/js/store.js`, so older saved data and bad input can never
  break a page.
- **Redraw only what changed.** Pages compare a signature (`JSON.stringify` of the inputs) before rebuilding a list,
  and never redraw a field the user is typing in.
- **Keyboard:** shortcuts must be ignored while typing in an input, a text area or a select, and while a dialog is
  open.

## Python (`server.py`, `desktop_app.py`, `vcam/`, `packaging/`, `tools/`)

- **Standard library first.** `server.py` must run with nothing installed beyond Python 3. Packages in
  `packaging/requirements-desktop.txt` are used only by the desktop shell and the camera pipeline, imported where
  needed.
- Module docstrings describe what the module does for the user and how it fits the pipeline; constants are
  `UPPER_CASE` with a comment giving the unit or reason.
- Type hints are not used; keep functions small and named for what they do.
- **The camera loop never waits.** Work that can take time (drawing a card, decoding video, the blur model) runs on its
  own thread and hands over its newest result under a short lock. Measure before and after changes to the frame loop
  (Settings → Diagnostics shows the time per frame).
- **Never trust input from the network.** Anything from a request is checked and limited. A path the phone may reach
  must be added deliberately to the allow-list in `server.py`.
- **Write files atomically:** write a temporary file, then `os.replace` it into place.

## CSS (`app/css/`)

- Colours, radii and type sizes are **design tokens** on `:root` in `app/css/theme.css`, with dark and light values.
  Use the tokens (`var(--surface)`, `var(--gold)`, `var(--r-2)` …); don't add raw colours.
- New styles for a feature go in a commented block in `theme.css` (or the page's own stylesheet for `remote.css`,
  `overlay.css` and `speaker.css`).
- Check both the dark and light themes, a 1366×768 laptop window, and a 390 px wide phone for the remote.

## Wording in the interface

- Use the app's terms consistently: **Frame**, **Content**, **Content Settings**, **Go Live**, **Hide all**,
  **Blackout**, **Freeze**, **Annotate**, **Teleprompter**, **Teleprompter window**, **command palette**, **KingdomConnect** (the camera), **Meeting Workbook**.
- Plain English, short sentences, no technical jargon. Say what will happen: "Create a new PIN? Every connected
  phone or iPad will need the new PIN."
- Messages that report a problem say what to do next.
- Name keyboard shortcuts in brackets after the action: "Freeze (F)".

## Design

The visual design (navy and gold, the Book + Candle mark, typography, components) is deliberate. Visual changes are
discussed in an issue first, and new interface elements reuse existing components (`.btn`, `.chip`, `.field`,
`.cs-group` …) rather than introducing new styles.
