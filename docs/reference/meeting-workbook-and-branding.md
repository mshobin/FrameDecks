# The Excel Meeting Workbook (v6.9), leader branding and Go Live

> **v6.9:** the Meeting Workbook now has two tabs, **Dashboard** and **Meeting Form** (section 0). The Read Me, Lists
> and one-sheet-per-list tabs are gone. Workbooks from 6.5 to 6.8 (Meeting Overview, Frames, Content, Questions,
> Scriptures) and the v6.2 one-sheet template still import.
>
> **v6.7:** questions and scriptures have no Answer or Notes columns, and each Frame has a **Presenter script** (the
> Frame's Teleprompter script). The Branding Content has new options, and a logo's plain background can be removed
> ([Branding options](#branding-options-v67)).
>
> Sections 1–4 describe v6.2 and use its words: a *scene* is now a **Frame**, and a *layer* is now **Content**.

## 0. The Meeting Workbook (v6.9)

Excel is **optional**. FrameDecks is fully usable without it. The workbook is a **planning, review, handover and
bulk-editing** tool. After an import, the app is the source of truth: the file is not linked, and **Export** gives you
a fresh copy.

### Where
**Settings → Data / Backup → Meeting from Excel** (6.11; before that the ✨ Meeting menu) has these buttons. The website's Meeting Form
([meeting-form.md](../architecture/meeting-form.md)) plans the same meeting online.
- **Download the Excel template**: `templates/FRAMEDECKS-Meeting-Workbook.xlsx`. It opens on the **Dashboard**,
  with an example meeting already filled in on the **Meeting Form**. Type over the examples.
- **Import a meeting from Excel…**:
  1. A preview shows the meeting, the Frames, Content, questions and scriptures that will be made, and every problem
     with where it is, for example *Meeting Form · Content · row 26: …*.
  2. Choose **Append** or **Replace**.
  3. Scripture text left empty is filled from the ESV.
  4. **Undo** is offered afterwards.
- **Export this meeting (Excel)**: the same **Dashboard** and **Meeting Form**, filled in with this meeting. An
  export imports again.

### The two tabs
| Tab | What it is | Imported? |
| --- | --- | --- |
| **Dashboard** | A summary of the meeting, made by formulas from the Meeting Form. You never type on it | No |
| **Meeting Form** | One guided page, read from top to bottom. Everything you plan goes here | Yes |

### The Meeting Form
The form is one page in nine numbered sections. Type in the **cream** boxes; **Tab** moves to the next one.

| Section | Boxes or columns |
| --- | --- |
| **1 · Meeting details** | Meeting name · Date · Time · Location / link · Meeting notes |
| **2 · Speaker** | Speaker name · Speaker contact |
| **3 · Attendees** | Expected attendees · Attendee notes |
| **4 · Presentation** | Presentation owner · Content notes |
| **5 · Frames** | Table: Frame # · Frame name · Purpose / description · Background · Transition · Presenter script |
| **6 · Content** | Table: Frame # · Order · Content type · Item name · Main content / file · On-screen label · Duration (min) · Animation · PPT background · Notes |
| **7 · Discussion questions** | Table: Frame # · Content name · Question # · Label · Question text · Media · Timer (min) · Animation |
| **8 · Scripture readings** | Table: Frame # · Content name · Scripture # · Label · Reference · Scripture text · Translation · Animation |
| **9 · Additional notes** | Anything else: equipment, follow-ups, prayer requests |

**Typing the details**
- **Date**: type it like `2026-10-25`. **Time**: like `19:00`.
- **Expected attendees**: a number, for example `24`.
- The **Meeting name** also names the group of imported Frames.

**The tables**
- Each table starts with a header row beginning **Frame #**. Below it, a few empty rows are open.
- Need more rows? Select the **+** button in the left margin next to the table. The extra rows are grouped (folded)
  until you open them.
- Room in each table: **Frames 60**, **Content 150**, **Discussion questions 150**, **Scripture readings 100**.
- Drop-down lists are built into the cells: Content type, Background, Transition, Animation and PPT background.
  Frame #, Order, Question # and Scripture # accept whole numbers only.

**What the columns mean**

| Table | Column | What to type |
| --- | --- | --- |
| Frames | **Frame #** | 1, 2, 3… One row per Frame, each number used once |
| Frames | **Background** | None, Navy, Black, White, Brand, or a colour like `#1F3A6D` |
| Frames | **Transition** | Frame default, Cut, Fade, Cross Dissolve, Dip to Black / White, Slide Left / Right, Push, Zoom Fade, Soft Scale, Cinema Fade |
| Frames | **Presenter script** | Becomes the Frame's Teleprompter script. Only the presenter sees it |
| Content | **Frame #** · **Order** | Which Frame it belongs to, and its order inside that Frame |
| Content | **Content type** | Question, Scripture, Text, Image, Video, Timer, PowerPoint, Free Content, plus Announcement, Prayer Point, Lower Third, Birthday, Branding, Camera, Screen. Audio and Web Page are accepted but skipped with a note (not yet available) |
| Content | **Item name** | Unique within its Frame. Questions and scriptures use it to find their item |
| Content | **Main content / file** | The text, or a file name for a picture, video or PowerPoint (choose the file in the app afterwards) |
| Content | **Duration (min)** | For a Timer: minutes (`5`) or a time (`10:30`) |
| Content | **Animation** | Content default, Fade, Gentle Rise, Word by Word, Typewriter, Burst, Cut |
| Content | **PPT background** | Show (the whole slide) or Hide (only the slide's objects) |
| Discussion questions | **Frame #** · **Content name** | The Frame and the Question item it belongs to, in **Question #** order |
| Scripture readings | **Scripture text** | Leave it empty to fetch it from the ESV (when a key is set in Settings → Scripture) |

### The Dashboard
The Dashboard fills itself in from the Meeting Form. It has only formulas, so the import never reads it.
- **Logo and name** at the top, with a **status pill**: *In N days*, *Today*, *Held*, or *Add the date*.
- **This meeting**: the name, date, time, location, speaker and days to go.
- **At a glance**: Frames, Content items, Questions, Scriptures and Expected attendees.
- **Meetings**: Total meetings, Upcoming, Recent (last 30 days), **Ready x / 6** and Files to choose (pictures,
  videos and PowerPoint files to choose in the app after the import).
- **Readiness**: a checklist of six things: a meeting name, a date, a speaker, at least one Frame, content in every
  Frame, and a presenter script for every Frame.
- **Quick actions**: links that jump to the right place on the Meeting Form.
- **Content mix**: a chart of the kinds of Content in the meeting.
- **Recent meetings**: a log. Its first row is this meeting. Add a row after each meeting, and the **Meetings**
  tiles count them.

### Import
**Import a meeting from Excel…** reads the **Meeting Form**. It finds the details by their labels (for
example *Speaker name*) and each table by its header row (the row starting with **Frame #**). So a form you make by
hand in the same style imports too. A numbered heading such as *7 · Discussion questions* ends the table above it.

**Older workbooks** still import:
- 6.5 to 6.8: one sheet per list (**Meeting Overview**, **Frames**, **Content**, **Questions**, **Scriptures**).
  Their Meeting Title, Presenter and Notes become the Meeting name, Speaker name and Meeting notes.
- 6.6 and before: a **Presenter Notes** column is read as the Presenter script. **Answer Text** and **Notes** on
  questions and scriptures are added to that Frame's Teleprompter script, so nothing is lost and nothing appears on
  screen.
- The v6.2 one-sheet template ("Scene Name" column; sections 1–4 below).

### Export
**Export this meeting (Excel)** gives the same **Dashboard** and **Meeting Form**, filled in with this
meeting. The program fills in the template, so the file looks exactly like the one you download. It imports again.
- If the FrameDecks program isn't running, or a table has more rows
  than the form has room for, a plain one-sheet **Meeting Form** is saved instead. It imports again too.
- The meeting details are kept with your meeting in `kc-saved-content.json` (`meeting`: title, date, time,
  location, presenter, contact, attendees, attendeeNotes, owner, contentNotes, notes, extra), so an export gives them
  back.

### Validation (the import is refused until these are fixed; each problem names its place and row)
- The Meeting Form must have a **Frames** table and a **Content** table (each with a **Frame #** column).
- Frame numbers must be whole numbers, and each must be used once.
- Content, question and scripture rows must point to an existing Frame. Question and scripture rows must also point
  to an item name in that Frame.
- Content types, Backgrounds, Transitions, Animations and PPT background must come from the lists.
- Item names must be unique within a Frame.
- A Frame has at most one Question, one Scripture, one Birthday and one Branding item. Put all of a Frame's
  questions in its one Question item.
- Question text is required.
- Every scripture needs a Reference, and text unless an ESV key is set.
- At most 400 Frames.

**Notes** let the import go ahead. For example: a picture or PowerPoint file to choose afterwards, Audio / Web Page
skipped, a Timer value that isn't minutes or a time.

### Code
- `app/js/meeting-book.js`: reads the Meeting Form (and older workbooks), validation, building Frames, export (no UI;
  tested in Node by `tests/meeting-workbook.test.js`).
- `app/js/meeting-import.js`: the dialog.
- `app/js/import-worker.js`: reads every sheet in the background.
- `src/meeting_form.py`: the layout of the Meeting Form, and filling the template for an export
  (`POST api/meeting/workbook` in `src/server.py`).
- `tools/make_meeting_workbook.py`: draws the template (`app/templates/FRAMEDECKS-Meeting-Workbook.xlsx`) from
  that layout with openpyxl.
- The Excel library (SheetJS) loads only the first time you import, export or download a workbook, so FrameDecks
   starts faster.

## Branding options (v6.7)

### The Branding Content
Select the Branding Content in a Frame. Its settings are in Content Settings:

| Group | Setting | Choices |
| --- | --- | --- |
| Content | **Display** | **Logo only**, **Name only** or **Logo + Name** |
| Content | **Also show the Leader / Organization Name** | On or off |
| Display Settings | **Position** | **Top left**, **Top right**, **Bottom left**, **Bottom right**, or **Or centred**: Top, Centre, Bottom |
| Display Settings | **Safe margin** | The distance from the edges of the picture, from the edge to 12% |
| Visual Settings | **Size** | **Small**, **Medium** or **Large**, then **Fine size** to adjust it exactly |
| Visual Settings | **Opacity** · **Padding** | How see-through it is · the space around the logo and name |
| Visual Settings | **Background plate** | On: a navy plate with your accent edge. Off: no plate, and a soft shadow keeps it readable |

The badge is drawn the same way on the FRAMECAST camera and on the OBS overlay pages. Its size follows the
picture, so it looks the same at 720p, 1080p or 4K.

### Remove a logo's background
Many church logos come as a JPG with a white box around them. **Settings → Meeting & Branding → Remove background**
(also in the Branding Content's settings) makes that plain background transparent.
- It works on this PC only; the logo is never uploaded anywhere.
- It keeps parts that are already transparent, and the colours inside the logo.
- **Undo** puts the original logo back.
- It works best on one plain background colour. For a busy background, use a transparent PNG or SVG instead.

---

# v6.2: leader branding, the one-sheet Excel template, and Go Live

This document covers the three v6.2 features: leader branding, the global Excel template and import, and the single
Go Live action. For each one it describes the user flow, the data model, the template structure, the validation rules
and where the code is. The tab structure is unchanged (**Studio · Members · Settings**). The About section is
unchanged.

## 1. User flows

### Leader branding: Settings → Meeting & Branding
1. Type the **Meeting Name** and the **Leader / Organization Name**. Since 6.4 the header shows only the Book +
   Candle logo; the names appear in the logo's tooltip and in the window title straight away.
2. Upload a **logo** (PNG, JPG or SVG) by selecting **Upload logo…** or dropping a file on the logo box. The dashboard
   converts every format to PNG (at most 1024 px) before saving it.
3. Optionally tick **Use my accent colour**: pick one of eight swatches or any colour. The accent replaces the gold of
   the cards and badges on FrameDecks and on the overlay pages. The app's own interface keeps its colours.
4. Under **Where branding appears**, tick the scenes that show the **Branding badge** (logo + Meeting Name). Other
   controls in this section:
   - **Brand every scene** and **Remove from every scene**;
   - **Badge position**, with **Apply to all badges**;
   - **New scenes include branding** (off by default).
5. Branding is never forced onto a scene. It appears only:
   - in **Branding layers**, which are opt-in per scene (the tick-list here, the Scene Inspector's **Branding**
     switch, or **+ Layer → Branding**);
   - in **text layers** (Announcement, Prayer, Lower Third, Countdown) that ask for it. These can contain
     `{meeting}` / `{org}` (replaced on screen) or have **Show my logo on this card** ticked.
6. Two branded templates are available here and in the Content Library: **Meeting Title** (a large centred badge)
   and **Meeting Lower Third** (`{meeting}` over `{org}`, with the logo).
7. **Export this meeting (Excel)** produces the meeting in the template format, so the file can be shared with
   co-leaders and imported again. (In v6.2 a Read Me sheet carried the Meeting Name and organization; since 6.9 the
   export is the Dashboard and Meeting Form, section 0.)

### Excel import (Studio → + Scene → Import meeting from Excel…)
The same entry points are on the empty Scenes list and in Settings → Meeting & Branding.
1. **Choose the file** (.xlsx, .xls or .csv), or **Download the template** from the same dialog or from + Scene.
2. **Preview** shows:
   - counts: scenes, layers, questions, verses, text, media, branded and hidden layers, and verses fetched from the ESV;
   - the scenes in order, each with its layer types;
   - **problems to fix**, each with its Excel row number (red; **Import** stays disabled);
   - **notes** (amber; the import can go ahead).
3. If the meeting already has scenes, the preview asks:
   - **Append**: keep your scenes and add these after them; names are de-duplicated.
   - **Replace**: remove your scenes. Saved templates are kept, and there is an option to also replace the question
     and verse lists.
   - **Cancel**: nothing changes.
4. **Import**:
   - Empty Verse Text cells are first filled from the ESV, when a key is set in Settings → Scripture. If a verse
     can't be fetched, nothing is imported.
   - Everything is then created in **one** state update, in Scene Order and Layer Order.
   - The scenes go in a group named after the file, and the first scene is selected.
5. The success screen offers **Undo this import**, which puts back the scenes, the question and verse lists and the
   live state exactly as they were. **Undo the last Excel import** stays in the + Scene menu for the rest of the
   session.

### Go Live
- The bottom bar has a single primary action, **Go Live** (shortcut **T**; double-clicking a scene does the same).
- The label never changes. When the selected scene is already on screen, the line under it reads **● On air: <scene>**.
  Pressing Go Live again replays the scene's transition.
- After Go Live:
  - the canvas outline flashes green once;
  - the canvas badge reads **LIVE**;
  - the scene card shows **LIVE**;
  - a toast says **On air: <scene>**.
- The Inspector no longer has a take button. The scene ⋯ menu, the phone remote (**GO LIVE**), Presentation Mode (removed in 6.9) and
  the keyboard-shortcut list all use the words "Go Live".

## 2. Data model changes (shared state, `app/js/store.js`)

| Where | Field | Meaning |
| --- | --- | --- |
| `state.brand` | `meeting`, `org` | Meeting Name; Leader / Organization Name (max 80 characters each) |
| | `color` | `#rrggbb` accent, or `''` for gold |
| | `logo`, `lw`, `lh` | Version of the uploaded logo (`''` = none) and its size in pixels. The file is `DATA/bcc-brand-logo.png`, served at `api/brand/logo` |
| | `auto` | New scenes get a Branding layer |
| layer kind `brand` | `c.logo`, `c.name`, `c.org`, `c.pos`, `c.scale` | The Branding badge (a text-type layer: switched on and off with the scene like the other text layers) |
| text layers | `c.logo` | Show the logo in the card's label row |
| text layers | `{meeting}`, `{org}` in `c.title` / `c.text` | Replaced on screen (`KCScenes.brandText`) |
| scene | `notes` | Leader notes from the Excel Notes column, editable in the Scene Inspector, never shown on screen |
| library | `lib-meeting-title`, `lib-meeting-lower` | Branded templates |

New helpers in `KCScenes`: `liveBrand`, `brandText`, `hasBrand`, `brandPalette` (accent → card colours, the same
maths as `src/vcam/cards.py accent_palette`), `addBrand`, `autoBrand`. `KCStore.brand()` gives the header a cheap read.

**Server** (`src/server.py`):
- `POST api/brand/logo` (this PC only): stores a PNG of up to 8 MB. The PNG header is checked; the response is
  `{logo, w, h}`.
- `POST api/brand/logo?remove=1`: deletes the logo.
- `GET api/brand/logo`: serves the logo. It is also on the signed-in phone remote's allow-list, so the remote's
  canvas preview shows it.
- `.webp` is served with its type.

**Renderers**:
- `overlay.js` / `overlay.css`: Branding badge, logo on text cards, `{meeting}` / `{org}`, and the accent applied
  through the `--gold-*` variables.
- `src/vcam/program.py`:
  - `live_brand`, `brand_text`, `ProgramFX._badge`;
  - the logo on text cards, through `CardDrawer` `data["logo"]`;
  - about 1.2 ms per 720p frame with a badge and a branded lower third.
- `src/vcam/cards.py`: `accent_palette` and per-draw colours (thread-safe).
- `src/vcam/overlay.py`: passes the accent to the question, verse and birthday cards. It is part of their cache key.

## 3. Excel template structure

The file is made by `KCMeetingSheet.templateBook`, which is the same code for the in-app download and
`docs/templates/FRAMEDECKS-Meeting-Workbook.xlsx` (the same file as `app/templates/`, both written by `python3 tools/make_meeting_workbook.py`).

**Sheets:**
- **Read Me**: how to use the file, every column (needed or not, what to type, an example), the layer types, and
  good-to-know rules.
- **Meeting Content**: header row plus 10 example rows. The examples cover a Text welcome with branding and a navy
  background, a Prayer, a Verse, a Question + Verse with a branding badge, a Question, a PowerPoint, an Image with a
  caption in one scene, and a branded Lower Third with a Hidden Prayer.
- **Allowed Values**: the valid entries for Layer Type, Custom template, Background Style, Yes/No and Status.

**Columns (one row = one layer):**

| Column | Needed | Notes |
| --- | --- | --- |
| Scene Name | Yes | Rows with the same name (any capitalisation) make one scene |
| Scene Order | Recommended | Whole number; every row of a scene uses the same number. Scenes without a number follow, in row order |
| Layer Name | No | Defaults to the type. Must be unique within the scene |
| Layer Type | Yes | Question · Verse · Question + Verse · Text · Image · Video · PowerPoint · Custom (also Announcement, Prayer, Lower Third, Countdown, Branding, Birthday, Camera, Screen; PDF) |
| Question Text | For Question / Question + Verse | |
| Verse Reference | For Verse / Question + Verse | A translation suffix such as `(ESV)` becomes the version |
| Verse Text | For Verse / Question + Verse | Empty → fetched from the ESV if a key is set, otherwise an error |
| Text / Caption | For Text / Announcement / Prayer | Lower Third: `Name \| Role`. Countdown: minutes (`5`) or a time (`10:30`). `{meeting}` / `{org}` allowed |
| Notes | No | Becomes the scene's leader notes |
| Branding | No | Yes → branding for this row (see below) |
| Show Logo / Show Meeting Name | No | Used when Branding is Yes; empty = Yes |
| Background Style or Template | For Custom | Custom rows: the template name. Other rows: the scene background on FrameDecks (None, Navy, Black, White, Brand, `#rrggbb`) |
| Layer Order | No | 1 = in front. Media (pictures, video, slides, camera, screen) always sit behind cards and text |
| Status | No | Active (default) or Hidden (in the scene, switched off) |

**What each type becomes:**

| Type | Becomes |
| --- | --- |
| Question | A question layer pinned to a new item in the question list |
| Verse | A scripture layer pinned to the verse; the verse is also added to the verse list |
| Question + Verse | Both layers. The question and verse list items are paired, so stepping keeps them together, and the scene's Q / S switch shows Q + S |
| Text | An Announcement-style card with no label |
| PowerPoint | A Window layer (choose the PowerPoint window afterwards) |
| Image / Video / PDF | Media layers whose file is chosen afterwards. The preview says so for each one |
| Branding Yes on a Question / Verse / media row | The scene gets one Branding layer |
| Branding Yes on a text row | The card itself carries the logo and/or `{meeting}` |

## 4. Validation rules

**Errors** stop the import. Each one names its row.
- **File:**
  - not .xlsx, .xls or .csv;
  - larger than 20 MB;
  - unreadable;
  - no sheet with a "Scene Name" column;
  - "Scene Name" or "Layer Type" column missing;
  - no rows;
  - more than 1000 rows;
  - the total would exceed 400 scenes.
- **Required fields:**
  - Scene Name;
  - Layer Type;
  - Question Text (Question, Question + Verse);
  - Verse Reference (Verse, Question + Verse);
  - Verse Text (when there is no ESV key);
  - Text / Caption (Text, Announcement, Prayer);
  - the template for Custom rows.
- **Invalid values:**
  - Layer Type or Custom template not in the list;
  - Background Style not in the list;
  - Yes/No columns with anything other than Yes or No;
  - Status other than Active or Hidden;
  - Scene Order or Layer Order that is not a whole number.
- **Duplicates:**
  - the same Scene Name with two different Scene Orders;
  - two scenes with the same Scene Order;
  - the same Layer Name twice in one scene;
  - a second Question, Verse, Birthday, Branding or Background layer in one scene.

**Notes** (the import can go ahead):
- scene names that already exist (they are renamed when you Append);
- Branding Yes when no Meeting Name or logo has been set yet;
- Show Logo / Show Meeting Name on a row with Branding No;
- two layers with the same Layer Order;
- a Question row that also has a verse;
- a countdown value that isn't minutes or a time;
- media layers that need a file, window or screen chosen after the import.

## 5. Implementation map
| File | What |
| --- | --- |
| `app/js/meeting-sheet.js` | Columns, types, `parse` (validation), `apply` (creation), `templateBook`, `exportBook`. Has no user interface; tested in Node |
| `app/js/meeting-import.js` | Import dialog (choose → preview → Append / Replace / Cancel → import → Undo), template download, export |
| `app/js/meeting-brand.js` | Settings → Meeting & Branding, logo conversion and upload, branding per scene |
| `app/js/import-worker.js` | Reads the workbook off the main thread; `want: 'Scene Name'` picks the right sheet |
| `app/js/workspace.js` | + Scene menu entries, empty-state button, Branding layer Inspector, Show logo, scene notes, Go Live bar |
| `app/js/overlay.js`, `app/css/overlay.css` | Overlay rendering of branding |
| `src/vcam/program.py`, `src/vcam/cards.py`, `src/vcam/overlay.py` | FrameDecks rendering of branding and the accent colour |
| `src/server.py` | Logo endpoints; version 6.2 |
| `tools/make_meeting_workbook.py` | Regenerates `app/templates/FRAMEDECKS-Meeting-Workbook.xlsx` and its copy in `docs/templates/` |
