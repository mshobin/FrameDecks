# The Excel Meeting Workbook (v6.5), leader branding and Go Live

> **v6.5:** the Excel template is now the five-sheet **Meeting Workbook** (section 0). Files made with the v6.2
> one-sheet template ("Scene Name" column) still import. Sections 1–4 describe v6.2 and use its words: a *scene* is now
> a **Frame**, and a *layer* is now **Content**.

## 0. The Meeting Workbook (v6.5)

Excel is **optional**. Kingdom Connect is fully usable without it. The workbook is a **planning, review, handover and
bulk-editing** tool. After an import, the app is the source of truth: the file is not linked, and **Export** gives you
a fresh copy.

### Where
**Meeting** (the ✨ button next to + Frame) has three items:
- **Download the Excel template**: `templates/Kingdom-Connect-Meeting-Workbook.xlsx`. It has drop-down lists,
  whole-number checks, example rows, a Read Me and a Lists sheet.
- **Import meeting from Excel…**:
  1. A preview shows the Frames, Content, questions and scriptures that will be made, and every problem with its
     **sheet and row**.
  2. Choose **Append** or **Replace**.
  3. Text left empty in the Scriptures sheet is filled from the ESV.
  4. **Undo** is offered afterwards.
- **Export this meeting to Excel**: the same five sheets, filled in. An export imports again.

### The sheets
| Sheet | Columns | Notes |
| --- | --- | --- |
| **Meeting Overview** | Field · Value | Rows: Meeting Title, Date, Presenter, Notes. The title names the group of imported Frames |
| **Frames** | Frame Number · Frame Name · Description · Background · Transition · Presenter Notes | One row per Frame, numbered 1, 2, 3… Background: None, Navy, Black, White, Brand or #RRGGBB. Transition: Frame default, Cut, Fade, Cross Dissolve, Dip to Black / White, Slide Left / Right, Push, Zoom Fade, Soft Scale, Cinema Fade |
| **Content** | Frame Number · Content Order · Content Type · Content Name · Main Content · Label · Duration · Animation · PowerPoint Background Visibility · Notes | One row per Content. Types: Question, Scripture, Text, Image, Video, Timer, PowerPoint, Free Content, plus Announcement, Prayer Point, Lower Third, Birthday, Branding, Camera, Screen. Audio and Web Page are accepted but skipped with a note (not yet available). Timer: Duration in minutes or a time (10:30). PowerPoint: Main Content = file name (choose it in the app afterwards); PowerPoint Background Visibility Hide = Show objects only |
| **Questions** | Frame Number · Content Name · Question Number · Label · Question Text · Answer Text · Media · Timer · Animation · Notes | The list of a Question Content (same Frame Number and Content Name), in Question Number order. Labels and answers are per question; answers and notes are never on screen |
| **Scriptures** | Frame Number · Content Name · Scripture Number · Label · Reference · Text · Translation · Animation · Notes | The list of a Scripture Content. Empty Text is fetched from the ESV when a key is set |

### Validation (the import is refused until these are fixed; each problem names its sheet and row)
- The Frames and Content sheets must exist and have a Frame Number column.
- Frame Numbers must be whole numbers, and each must be used once.
- Content, Questions and Scriptures rows must point to an existing Frame. Questions and Scriptures rows must also
  point to a Content Name in that Frame.
- Content Types, Backgrounds, Transitions, Animations and PowerPoint Background Visibility must come from the lists.
- Content Names must be unique within a Frame.
- A Frame has at most one Question, one Scripture, one Birthday and one Branding Content. Put all of a Frame's
  questions in its one Question Content.
- Question Text is required.
- Every scripture needs a Reference, and Text unless an ESV key is set.
- At most 400 Frames.

**Notes** let the import go ahead. For example: a picture or PowerPoint file to choose afterwards, Audio / Web Page
skipped, a Timer value that isn't minutes or a time.

### Code
- `app/js/meeting-book.js`: the sheets, validation, building Frames, export (no UI; tested in Node by
  `tools/test_meeting_workbook.js`).
- `app/js/meeting-import.js`: the dialog.
- `app/js/import-worker.js`: reads every sheet in the background.
- `tools/make_meeting_workbook.py`: writes the template with openpyxl.

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
   the cards and badges on KingdomConnect and on the overlay pages. The app's own interface keeps its colours.
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
7. **Export this meeting (Excel)** produces the meeting in the template format. The Read Me sheet carries the
   Meeting Name and organization, so the file can be shared with co-leaders and imported again.

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
- The Inspector no longer has a take button. The scene ⋯ menu, the phone remote (**GO LIVE**), Presentation Mode and
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
| text layers | `{meeting}`, `{org}` in `c.title` / `c.text` | Replaced on screen (`BSFScenes.brandText`) |
| scene | `notes` | Leader notes from the Excel Notes column, editable in the Scene Inspector, never shown on screen |
| library | `lib-meeting-title`, `lib-meeting-lower` | Branded templates |

New helpers in `BSFScenes`: `liveBrand`, `brandText`, `hasBrand`, `brandPalette` (accent → card colours, the same
maths as `vcam/cards.py accent_palette`), `addBrand`, `autoBrand`. `BSFStore.brand()` gives the header a cheap read.

**Server** (`server.py`):
- `POST api/brand/logo` (this PC only): stores a PNG of up to 8 MB. The PNG header is checked; the response is
  `{logo, w, h}`.
- `POST api/brand/logo?remove=1`: deletes the logo.
- `GET api/brand/logo`: serves the logo. It is also on the signed-in phone remote's allow-list, so the remote's
  canvas preview shows it.
- `.webp` is served with its type.

**Renderers**:
- `overlay.js` / `overlay.css`: Branding badge, logo on text cards, `{meeting}` / `{org}`, and the accent applied
  through the `--gold-*` variables.
- `vcam/program.py`:
  - `live_brand`, `brand_text`, `ProgramFX._badge`;
  - the logo on text cards, through `CardDrawer` `data["logo"]`;
  - about 1.2 ms per 720p frame with a badge and a branded lower third.
- `vcam/cards.py`: `accent_palette` and per-draw colours (thread-safe).
- `vcam/overlay.py`: passes the accent to the question, verse and birthday cards. It is part of their cache key.

## 3. Excel template structure

The file is made by `BSFMeetingSheet.templateBook`, which is the same code for the in-app download and
`docs/templates/Kingdom-Connect-Meeting-Template.xlsx` (written by `node tools/make_meeting_template.js`).

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
| Background Style or Template | For Custom | Custom rows: the template name. Other rows: the scene background on KingdomConnect (None, Navy, Black, White, Brand, `#rrggbb`) |
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
| `vcam/program.py`, `vcam/cards.py`, `vcam/overlay.py` | KingdomConnect rendering of branding and the accent colour |
| `server.py` | Logo endpoints; version 6.2 |
| `tools/make_meeting_template.js` | Regenerates `docs/templates/Kingdom-Connect-Meeting-Template.xlsx` |
