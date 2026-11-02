# The .frame file

A `.frame` file carries a whole plan to a service PC without internet. Make one on framedecks.com (Plan → **Export
for Service PC**) or on a PC (Settings → Data / Backup → **Export Frame File**). Open it on the service PC with
Settings → Data / Backup → **Import Frame File…**, Studio → **Quick Start** → **Import a Frame file…** (8.6, the same
import), or the command palette: "Import Frame File".

A PC linked to a workspace keeps syncing by itself (the header shows **Synced**, **Syncing**, **Offline** or
**Sync failed**); the .frame file is for a PC that is offline or not linked. It replaces the Excel workbook as the way
to move a plan by hand. Excel import stays available for lists of verses and questions.

## What it holds

- Every Frame in order, with its id, name, script (speaker notes), Content, transition and look.
- The meeting details, including the whole-meeting Teleprompter script and the script mode.
- Branding words (meeting name, group name, colour) and the layout. The logo file stays on each PC.
- Card settings for the question, scripture and birthday cards (not what is on screen right now).
- The verse and question library.
- The Burst transition's look (dust, direction, colour, strength).
- From a PC: the pictures, video, audio and slides the Frames use (up to 300 MB in all). Media is never sent to the
  cloud; a file the website cannot hold is added on the PC.
- From a PC: that PC's Teleprompter text settings and Spotlight settings.
- What it holds, counted (Frames, Content, questions and readings, files used, files included), so a file that is
  cut short or changed by hand is refused.

## Importing

The PC checks the file first. A file that is not a Frame file, comes from a newer FrameDecks, has no Frames or has a
damaged picture is refused with a plain message, and nothing changes.

A file also says what it holds (`integrity`, see below). A file that is cut short, or was changed by hand after it was
made, holds less than it says. It is refused before anything changes: "This Frame file is incomplete or was changed
after it was made… Export it again." Make the file again and copy it again.

Then it asks:

- **Use this plan** (the main button): the PC then shows exactly what is in the file. The same Frames, with the same
  ids, in the same order, with their words, scripts and transitions, and the meeting name, date, notes and
  Teleprompter script. Branding words, layout, card settings, library and Burst look are set as in the file too. The
  PC's Frames are kept in a backup first (Data / Backup → backups list).

  Since 8.5 a file holds one meeting. When the PC has several meetings, or its one meeting has another name, **Use
  this plan** replaces only the meeting named in the file (or adds it), keeps the PC's other meetings and their
  Frames, and shows the file's meeting. The check then also says "The meeting also has N other Frames" when it does.
- **Add after my Frames**: keeps the PC's Frames and adds the file's at the end. A Frame whose id is already used gets
  a new one, and names stay unique. Nothing of yours changes. Shown only when the PC already has Frames.
- **Cancel**.

Before 8.4, **Add after my Frames** was the default. That is why a plan could look different from the website: the
PC's own Frames were still there.

Media is copied into the program's layers folder. A name already used there gets "(2)", and the Frames follow the new
name. A file from a PC also carries that PC's Teleprompter text settings and Spotlight settings. Importing applies
them.

### The import check

After the import, the PC compares every Frame with the file. The result is in the **Frame files** box (Settings →
Data / Backup):

- When all is well: "✓ Checked against the file: N Frames in the same order, N Content, N questions and readings, N
  files copied, meeting name, date, notes and Teleprompter script. Everything matches."
- Otherwise, a list of the differences, each marked ⚠.
- "⚠ Not on this PC yet: …" lists the pictures and videos the Frames use that are not on this PC. Add them (Decks →
  the Content → **Choose file**), or export the .frame file again from a computer that has them.

### Exporting from the website

Plan → **Export for Service PC** exports the meeting you are planning (8.5). It says exactly what is in the file: the Frames, Content, questions and readings, and
files. It also lists the files the Frames use that are not in the file: "Not in the file (not in this browser): … The
service PC must already have them."

## Format (version 1)

UTF-8 JSON:

```json
{
  "format": "framedecks-frame",
  "version": 1,
  "exported": "2026-11-02T18:00:00.000Z",
  "source": "program",
  "app": "8.4.0",
  "title": "Tuesday Bible Study",
  "plan": { "scenes": [], "meeting": {}, "brand": {}, "layout": {}, "profile": "", "question": {}, "verse": {},
            "birthday": {}, "library": {}, "fx": {} },
  "media": [{ "file": "photo.png", "type": "image/png", "size": 1234, "sha256": "…", "data": "<base64>" }],
  "counts": { "frames": 5, "media": 1 },
  "integrity": { "frames": 5, "layers": 9, "items": 12, "files": ["photo.png"], "included": ["photo.png"] },
  "settings": { "kc-spot": "…", "kc-tp-window": "…" }
}
```

With several meetings (8.5), every Frame's `group` is the meeting's name and `plan.meeting` is that meeting's name,
date and notes, without the workspace's list of meetings (`meetings`).

`plan` uses the PC's own shapes (`app/js/store.js`); the PC cleans every Frame with the same rules as its own plan
file. `source` is `website` or `program`. A reader refuses a `version` above the one it knows. Media file names may
not contain a path or start with a dot.

`integrity` (8.4) says what the file holds: `frames` (Frames), `layers` (Content), `items` (questions and readings),
`files` (the files the Frames use) and `included` (the files inside the file). The PC counts the file again and
refuses it when the Frames, Content or questions and readings do not match. A file without `integrity` (made before
8.4) is read as before.

`settings` (8.4, PC exports only) holds the exporting PC's own local settings: `kc-spot` (Spotlight) and
`kc-tp-window` (Teleprompter text). Importing applies them. The website does not write it.

The website writes it with `hosted/src/lib/frame-file.ts`; the PC reads and writes it with `app/js/frame-file.js`.
Both check files with the same rules (`hosted/tests/frame-file.test.mjs`, `tests/frame-file.test.js`).
