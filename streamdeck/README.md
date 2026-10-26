# FRAMEDECKS for Stream Deck

Keys that run FRAMEDECKS exactly like its keyboard shortcuts, even while Zoom or Teams has the focus: **Next Frame**,
**Previous Frame**, **Go Live** (a chosen Frame number), **Hide all**, **Black screen**, **Question** and **Scripture**.
Black screen, Question, Scripture and Go Live keys light up to match what is on screen.

**Who this is for:** people running services with an Elgato Stream Deck, and maintainers of the plugin.

## Install

1. Needs Stream Deck 7.1 or later on the same Windows PC as FRAMEDECKS.
2. Download **FRAMEDECKS Stream Deck plugin** from the latest "Stream Deck plugin" run on GitHub (Actions), unzip it
   and double-click `com.framedecks.control.streamDeckPlugin`.
3. Drag the FRAMEDECKS keys onto your Stream Deck. For Go Live, choose the Frame number in the key's settings.

If FRAMEDECKS is not running, a key shows a warning triangle. Nothing goes over the network: the plugin talks only to
FRAMEDECKS on this PC (`127.0.0.1`, ports 8750–8760).

## How it works

Each press goes to the program (`POST /api/command`, this PC only), which hands it to its own window; the window runs
it with the keys' code (`app/js/cloud-remote.js`, the same path as the companion's commands), so a Stream Deck press
and a key press behave the same, including the guard against double takes within half a second. The keys read what is
on screen once a second while visible (`GET /api/command/status`).

## Develop

```bash
cd streamdeck
npm ci
npm test            # src/framedecks.js: ports, commands, key states
npm run build       # bundles src/plugin.js into com.framedecks.control.sdPlugin/bin/plugin.js
npm run validate    # checks the manifest
npm run pack        # dist/com.framedecks.control.streamDeckPlugin
```

Images: `python tools/make_streamdeck_icons.py` redraws `imgs/` (glyphs in the companion's navy and gold, the
FRAMEDECKS emblem for the plugin icon).
