# The .frame file

A `.frame` file carries a whole plan to a service PC without internet. Make one on framedecks.com (Plan → **Export
for Service PC**) or on a PC (Settings → Data / Backup → **Export Frame File**). Open it on the service PC with
Settings → Data / Backup → **Import Frame File…** (or the command palette: "Import Frame File").

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

## Importing

The PC checks the file first. A file that is not a Frame file, comes from a newer FrameDecks, has no Frames or has a
damaged picture is refused with a plain message, and nothing changes.

Then it asks:

- **Add after my Frames** (the default): the file's Frames go after yours. A Frame whose id is already used gets a new
  one, and names stay unique. Nothing of yours changes.
- **Replace my Frames**: asks once more, makes a backup (Data / Backup → backups list), then sets the Frames, meeting
  details, branding words, layout, card settings, library and Burst look exactly as in the file.
- **Cancel**.

Media is copied into the program's layers folder. A name already used there gets "(2)", and the Frames follow the new
name.

## Format (version 1)

UTF-8 JSON:

```json
{
  "format": "framedecks-frame",
  "version": 1,
  "exported": "2026-11-02T18:00:00.000Z",
  "source": "website",
  "app": "8.2.0",
  "title": "Tuesday Bible Study",
  "plan": { "scenes": [], "meeting": {}, "brand": {}, "layout": {}, "profile": "", "question": {}, "verse": {},
            "birthday": {}, "library": {}, "fx": {} },
  "media": [{ "file": "photo.png", "type": "image/png", "size": 1234, "sha256": "…", "data": "<base64>" }],
  "counts": { "frames": 5, "media": 1 }
}
```

`plan` uses the PC's own shapes (`app/js/store.js`); the PC cleans every Frame with the same rules as its own plan
file. `source` is `website` or `program`. A reader refuses a `version` above the one it knows. Media file names may
not contain a path or start with a dot.

The website writes it with `hosted/src/lib/frame-file.ts`; the PC reads and writes it with `app/js/frame-file.js`.
Both check files with the same rules (`hosted/tests/frame-file.test.mjs`, `tests/frame-file.test.js`).
