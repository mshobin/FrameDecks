# Planning a meeting on the website (6.11 design)

**Status:** agreed with the owner on 26 October 2026: W1, W3 as recommended. For W2 the owner chose to keep the
Excel import in 6.11, but only under Settings in the program. Step 1 is built. Steps 2 and 3 follow. Section 6
lists the steps.
**Builds on:**
- sync ([metadata-sync.md](metadata-sync.md));
- editing in the companion ([companion-editing.md](companion-editing.md), whose option B, "new Frames and
  delete", this design delivers);
- the Excel Meeting Workbook (`app/js/meeting-book.js`).

## In short (for the owner)

- **The website gets a Meeting Form.** It has the same sections as the Excel Meeting Form:
  - meeting details;
  - Frames, with name, purpose, background, transition and presenter script;
  - each Frame's Content, with type, name, main content, label, duration, animation and PowerPoint background;
  - discussion questions and scripture readings.
- **Saving works like any edit.** The PC shows the new or changed Frames within about a minute. The Frame on
  screen is never changed while it is live.
- **The Excel import moves into Settings** in 6.11 (decision W2). It leaves the program in 6.12, once the owner's
  live test shows the website form covers it (W3).
- **The website checks for the FRAMEDECKS camera.**
  - If the camera is missing, it offers the installer.
  - If it is found, it offers **Open FRAMEDECKS on this PC**, through a `framedecks://` link the installer registers.
  - The website never talks to the program directly.

## 1. Decisions

| | Decision | Owner's answer |
|---|---|---|
| W1 | What the form edits | The live plan itself: add, change and remove Frames. No separate draft. |
| W2 | When Excel leaves the program | 6.11 adds the form. Import Excel stays, moved into the program's Settings. |
| W3 | What leaves in 6.12 | Import Meeting Workbook, the template download and the Excel export. Export to PowerPoint stays. |

The Settings entry is a new owner-approved desktop change. It is recorded in `CLAUDE.md` with the other exceptions.

## 2. How a form row becomes a Frame

The form works on the same synced records as the Services page:
- it reads them with `sync_pull`;
- it saves with `sync_push`, carrying the revision each record was read at.

**New and changed Frames.**
- A new Frame is a new `frame` record (base revision 0), and its id is added to the `order` record in the same push.
- If only the order conflicts, the Frame is still saved. The PC puts a Frame missing from the order at the end, and
  the form adds it to the order again.

**The layer format.** The form writes each Frame's layers in the shape `meeting-book.js` `build()` makes for the
same Excel row, and the PC's `store.js` `cleanLayer` fills in every default (positions, sizes, limits). So a
Frame made on the website matches one imported from Excel. The mapping lives in
`hosted/src/lib/meeting-form.ts`:

| Row | Layer |
|---|---|
| Question / Scripture with its list | `question` / `scripture` with `items` (label, text, media, timer / ref, version, text), `label`; animation in `look.transition` |
| Text | `announcement` (title = label, `label` on when there is one) |
| Announcement, Prayer Point | `announcement`, `prayer` (title = label, text) |
| Lower Third | `lowerthird` (title, text) |
| Timer | `countdown` (minutes, or `until` a time) |
| Branding, Birthday, Camera, Screen | `brand`, `birthday`, `camera`, `screen` (name only) |
| Image, Video, PowerPoint, Audio | `image`, `video`, `pdf` (`objectsOnly` from PPT background), `audio`; file name only |
| Background (Frame) | a `background` layer (Navy, Black, White, Brand colour, or `#rrggbb`) |

**Changing existing Content.**
- Editing Content changes only the fields the form shows. The rest stays as the PC made it: position, size, look,
  and the item shown now.
- Content the form does not know (shapes, free text, windows) is listed as "edited on the service PC" and left alone.

**What the PC has to do: nothing new.** Records arrive through `cloud_sync.py` like edits from another PC. The
window's normalize (`cleanScene` / `cleanLayer`) completes them. The completed Frame goes back up once, as edits do
today.

## 3. Media

Sync never carries media. For a picture, video, PowerPoint or audio item, the form takes the **file name in the
service PC's media folder**. The program's missing-media check (`/api/media/check`, Diagnostics) lists names it
cannot find, and the operator chooses the file in the Studio, as after an Excel import.

## 4. The camera check and "Open FRAMEDECKS"

- **Detection (Chrome or Edge on Windows):**
  - After the person allows camera access once, `navigator.mediaDevices.enumerateDevices()` names the cameras.
  - A video input whose name contains `FRAMEDECKS` means the program is installed. Older names (`BCC vCam`,
    `Kingdom Connect`) count too.
  - No camera is ever opened.
- **Camera missing:** an "Install FRAMEDECKS for Windows" card with the latest release.
- **Camera found:**
  - the card offers **Open FRAMEDECKS on this PC** (`framedecks://open`);
  - if no PC of the workspace is linked yet, it gives the linking steps.
- **The link:**
  - The installer registers `framedecks:` for the current user (HKCU `Software\Classes\framedecks`), pointing at
    `FRAMEDECKS.exe "%1"`.
  - `desktop_app.py` accepts the argument: it starts normally, or brings the open window forward.
  - It never acts on anything else in the link.
- The check is optional. A person who does not allow camera access still sees the download and open buttons.

## 5. Limits and safety

- Owners and admins edit; everyone else sees the form read-only, as on the Services page. `sync_push` already
  enforces this.
- The desktop's limits are applied before saving:
  - 400 Frames;
  - 60 Content per Frame;
  - 1,000 items per list;
  - the text lengths of `cleanScene` / `cleanItem`.
- The Frame on screen is never changed live: the PC holds the change until the Frame leaves the screen.
- Deleting a Frame keeps it 30 days under **Deleted in the last 30 days** on the Services page.

## 6. Delivery

1. **Website:** the camera check and install card, and the **Open FRAMEDECKS on this PC** button. **Installer:**
   registers `framedecks:`. **Program:** accepts the link. *(built)*
2. **Website:** the Meeting Form page (`hosted/src/app/meeting/`, `hosted/src/lib/meeting-form.ts`), with tests for
   the row ⇄ layer mapping against `meeting-book.js` and browser tests with stand-in Supabase.
3. **Program:** Import Excel, the template and the Excel export move from the Meeting tab, the Studio and the
   palette into **Settings → Data**. Then version 6.11, release notes and the owner's live test (G in
   `docs/qa/live-test-guide.md`).
4. **6.12, after the owner's test:** remove the Excel import, template and export (W3).
