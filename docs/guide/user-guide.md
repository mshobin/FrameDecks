# FrameDecks: user guide (v6.8)

FrameDecks runs your online Bible study, prayer meeting, small group or training on Zoom, Microsoft Teams or
Google Meet. It is meeting-first:

1. **Meeting**: one meeting, for example *Romans · Week 5*.
2. **+ Frame**: one screen or one step of the meeting (Welcome, Worship, Scripture Reading, Questions, Closing).
3. **+ Content**: what is shown inside a Frame (a question, a scripture, text, a picture, a video, a timer, PowerPoint).
4. **Present**: Go Live, then step through the Frames.
5. **Annotate**: draw on the picture.
6. **Phone**: run all of it from a phone if you like.

Everything runs on your PC.

- Installing: `docs/development/building-the-installer.md` (Installation Guide)
- Setting up the camera and the phone remote: `docs/reference/configuration-guide.md`
- How each feature works: `docs/reference/features.md`
- PowerPoint (what works, and why): `docs/reference/powerpoint.md`
- The Excel Meeting Workbook: `docs/reference/meeting-workbook-and-branding.md`

---

## 1. The window
The **command bar** across the top holds everything you need live:

| Part | What it does |
| --- | --- |
| Studio · Members · Settings | The three sections (Alt+1, Alt+3, Alt+4) |
| ◀ Frame · **Go Live** · Frame ▶ | Put the selected Frame on screen (T), or step to the previous or next Frame |
| Transition · Auto · ◀ Question ▶ | How the next Frame appears; auto-advance; step through the Frame's questions or scriptures |
| Live tools ▾ | A drop-down menu: Hide the selected Content · **Black screen** (K) · **Freeze the picture** (F) · **Draw on the picture** (D) · **Teleprompter** (R) · Emergency screen |
| Hide all **Esc** | Hide everything. The **Esc** key is shown inside the button |
| ● Off air / LIVE | What is on screen now |
| Window buttons | Minimize, Maximize / Restore and Close, at the top right |

**Search and commands.** The command bar has no search box (6.9). Press **Ctrl+K** or **Ctrl+Space** for the **command
palette** (from anywhere in Windows: **Spotlight**, Alt+Space). It finds Frames, Content, questions, scriptures, text,
templates, the Library, branding, settings, members, Bible references and recent items, and runs commands such as Go
Live, New Frame, Duplicate, Teleprompter, Export meeting, *Look: <name>* and Add Content. **↑ / ↓** and **Enter**
choose; **Esc** closes. Change the keys in Settings → Keyboard shortcuts → Command palette.

The command bar fits any window: narrow, maximized, ultra-wide or on a high-resolution screen. Under 1140 px wide it
wraps onto two rows, so nothing is cut off (6.9).

**The window (6.8).** There is no Windows title bar: the command bar is the window's ribbon. Drag its empty space to
move the window, and double-click it to maximize. Snap and resizing from the edges work as usual. Every FrameDecks
 window has the same three buttons at the top right.
- **Minimize** asks *Hide application to system tray?*: **Hide To Tray** or **Stay In Taskbar**, with **Remember my
  choice**. In the tray, the camera, overlays, phone remote and shortcuts keep working.
- The **tray icon** near the clock: click it to open the app. Its menu has **Open App**, **Teleprompter**, **Search** (Spotlight), **Settings**, **More** (Look, Frame, Stop screen share, Hide all overlays,
  Presentation window, Phone remote) and **Exit**.
- **Spotlight** (Alt+Space, or Ctrl+Alt+Space if another program has Alt+Space) opens the command palette's search in
  the middle of the screen, from anywhere, even with the app in the tray. Go Live, Next / Previous Frame, Hide all,
  Blackout, Freeze and the Teleprompter run without bringing the main window back. An empty search shows Recent,
  Frequently used and Suggested.
- **Settings → General → Window and tray**: Modern window (off brings the Windows title bar back, after a restart),
  Minimize button (Ask each time / Hide to tray / Stay in taskbar), the Spotlight shortcut (Alt+Space, Ctrl+Space,
  Ctrl+Alt+Space, Ctrl+Shift+Space, Win+Shift+K or Off, with a line saying whether it works). **Settings →
  General** is now just *Window, tray and performance*.
- **The look of the window (8.1):** **Settings → Meeting & Branding → Look**. Pick a colour card: **Gold & Navy**
  (the standard), **Morning Light**, **Chapel Stone**, **Deep Ocean**, **Forest** or **Quiet Mono** (the same looks
  as on framedecks.com, Branding → Look), or **Same as my workspace** to follow the look chosen on the website,
  light or dark included. Under it, **Light or dark**: **Dark**, **Light** or **Match Windows**. A look picks its own
  light or dark (Morning Light is light), and you can change it. Only this window changes: the camera picture, the
  overlays and the phone remote keep their own look.

## 2. Frames and Content
- **Meeting (8.5):** with several meetings, the **Meeting** list above the Frames chooses the one this PC shows and
  runs; **New** makes another. See [Frames](frames.md#name-group-and-order).
- **Meeting** (the ✨ button next to + Frame) has:
  - Import / Export / Download the Excel Meeting Workbook;
  - Quick Start;
  - the Content Library;
  - your Frame templates.
- **+ Frame** adds one **blank** Frame after the selected one. Name it by double-clicking its **name** (or F2), or
  in its **Name** box in Content Settings. The name is edited right in the list: **Enter** saves, **Esc** cancels.
- Select the Frame, then **+ Content** (the **Decks** section under the Frames list shows its Content):
  - **Question**, **Scripture**, **Text**, **Image**, **Video**, **Timer**, **PowerPoint**;
  - **Free Content**: announcement, prayer point, lower third, birthday, branding, camera, screen share, a live
    window, logo, watermark, free text, shape, background.
- **Content belongs to its Frame.** Changing it never changes another Frame.
- **Duplicate Frame** (right-click a Frame, or **Ctrl+D**) puts a completely separate copy right after it. Every
  question, scripture, label and setting is copied, not shared.
- Select a Frame and press **Go Live**. Double-click the Frame's row (not its name), or press **T**, to do the same.
- **Select several** Frames or Contents with **Ctrl+Click**, **Shift+Click** or by dragging a box in empty list
  space (**Ctrl+A** selects all). Then:
  - **Delete** / **Backspace** deletes them; the message offers **Undo**, and you are asked first only for 5 or more;
  - **Ctrl+C** / **Ctrl+X** / **Ctrl+V** copy, cut and paste; **Ctrl+D** duplicates;
  - drag them to move them, or right-click for a menu.

## 3. Content Settings
Select any Content and its settings are in one view:
- **Content** first: its label and its words (or list);
- then sections that open with a click: **Position and size**, **Look**, **Animation** and **Show on**.

FrameDecks remembers on this PC which sections you left open. Pictures, video and PowerPoint have a **Media** group. A Frame on its own shows its **Name**, its **Teleprompter
script** (with **Open the Teleprompter**), **Move to the next Frame after N seconds** and a **Duplicate Frame** button.
Its **Advanced** section holds the Group, the Transition into this Frame and its Length (ms), Branding, Favourite,
Template, **Save as template**, **One Frame per question / per verse**, and its history (Created, Changed, Copied
from, Original Frame).

Where each piece of Content appears (FrameDecks, OBS pages) is set once, in that Content's **Show on** group.

**Branding Content** has: **Display** (Logo only, Name only, Logo + Name, and optionally the Organization Name);
**Position** (a corner, or centred at the top, centre or bottom) and **Safe margin**; **Size** (Small, Medium,
Large, plus a fine size), **Opacity**, **Padding** and **Background plate** (off = a soft shadow). It looks the same
on the camera and the OBS pages, at any resolution.

### Questions and Scriptures
A Question (or Scripture) Content holds **its own list**, shown full height in Content Settings:
- **Click** an item to make it the Frame's current one.
- **Show** puts it on screen.
- **Double-click** its **label** or its **text** to edit it right there in the list. **Enter** saves,
  **Shift+Enter** starts a new line, **Esc** cancels, and a click outside saves.
- **Enter** on a selected item opens all its settings **in the same panel**: its own **Label** (for example
  *Question 1* or *John 15:5*), the text and its own transition. Press **Done** (or Esc) to go back to the list.
- **Or edit it on the canvas:** double-click any card on the Studio Canvas (question, scripture, announcement,
  prayer, lower third, timer) to edit its text; double-click the card's label
  (its top line) to edit the label. The same keys apply. If the card is on screen, the screen changes too.
- Questions have no Answer or Notes fields any more (6.7). Old ones are kept in your data but not shown; put
  reminders in the Frame's **Teleprompter script**.
- **+ Question** / **+ Scripture** adds one; **Add several** pastes many at once.
- **Drag** an item by its handle (⋮⋮) to move it, or use the ↑ / ↓ buttons. A line shows where it will land.
- For scripture, type a reference above the list and press **Fetch scripture** (ESV, with a key in Settings →
  Scripture). Choose **Fetch from → Type it myself** for other translations.
- Questions and scriptures come from Excel only through the **Meeting Workbook** (section 7), which builds whole
  Frames. There is no Excel import inside a Question or Scripture Content.
- When the Frame is on screen:
  - **→ / ←** step through its questions;
  - **Shift + → / ←** step through its scriptures.

## 4. Present, Annotate, Freeze, Black screen
- **Go Live** puts the selected Frame on screen; **◀ Frame / Frame ▶** step through the meeting.
- **Annotate (D)** turns the canvas into a drawing surface:
  - Tools: **Pen** (P), **Highlighter** (H), **Arrow** (A), **Line** (L), **Rectangle** (R), **Ellipse** (E),
    **Text** (T), **Spotlight** (S).
  - Six colours and three thicknesses.
  - **Eraser** or **Undo** (Ctrl+Z), **Redo** (Ctrl+Y), **Clear**.
  - The drawings appear above everything: slides, PowerPoint, cards. Everyone sees them in Zoom or Teams. **Esc**
    hides them.
  - **Spotlight** (S, or press **Ctrl** twice quickly over the picture): click a word and a glowing circle grows
    around it, pulses, then opens out with a few sparks and fades. Click empty space to spotlight a point. Its panel
    sets the colour, **Size**, **Length** (1–15 s) and **Strength**, with **Try it**. It shows on FrameDecks vCam (Zoom,
    Teams), recordings and the overlay pages.
- **Freeze (F)** holds the picture while you get the next thing ready. You can still draw on it.
- **Blackout (K)** makes the picture black.
- **Teleprompter** (Live tools → Teleprompter, **R**, the command palette's *Teleprompter on / off*, or the tray's
  **Teleprompter**) shows the Frame's **Teleprompter script** in one window that stays on top of Zoom, Teams or Meet.
  Only you see it: it is never on any output, and it is hidden from screen sharing and recordings.
  - Write the script in Frame settings → **Teleprompter script** (up to 20,000 characters), with **✎ Write Script**
    in the Teleprompter, or by double-clicking its text. **⇪ Upload** loads a .txt, .md or Word (.docx) file (Word
    headings, bullets and bold are kept) and asks before it replaces a script. Markup: `# Heading`, `- bullet`,
    `**bold**`, `*italic*`, `[PAUSE]` cue chips, `---` divider.
  - **Each Frame** (one script per Frame) follows the Frame on screen (the first Frame before you go live).
    **Whole meeting** shows one script for the whole meeting, kept in the meeting details.
  - The script area shows only the script text, which fills the whole window at every text size. All the controls
    are in the **top bar**, which is hidden at first. The small arrow (**▾**) at the top always marks it: point at
    it (or the top edge) to slide the bar down, or choose it to keep the bar open.
  - First row: **Time**, the current **Frame** (*name · 3 of 9*), **Next Frame ▸** (puts the next Frame on screen),
    a **Timer** (Start / Pause, Reset), **Transparency** (Solid, 20%, 40%, 65%, 85%) and **Pin** (*Pinned* keeps it
    above Zoom, Teams and PowerPoint; click to unpin), with **Keep open** / **Hide bar** and the window buttons. Drag
    the bar to move the window; resize from the edges.
  - Second row: **▶ Scroll** (Space), speed from Very slow to Very fast, A− / A+, line spacing, contrast, Mirror (M),
    **✎ Write Script**, **⇪ Upload** and **Each Frame** / **Whole meeting**.
  - Transparency and pin are remembered, and work only in the installed app. With **Light on graphics card** on (the
    default) the whole window fades, text included; with it off, only the background is see-through.
  - The docked Teleprompter, the separate Teleprompter overlay and **Shift+R** were removed in 8.0: this one window
    replaces them, with transparency and pin in its top bar.

## 5. The FrameDecks vCam
Choose **FrameDecks** as the camera in Zoom, Teams, Google Meet or OBS. Participants see your webcam with the live
Frame on top. Background blur and Camera Looks are in **Settings → FrameDecks vCam**. If an app doesn't list
FrameDecks, restart that app.

## 6. Phone and tablet remote
**Settings → Phone & iPad Remote** → turn it on, scan the QR code, enter the PIN.
One screen with large buttons, nothing to set up. Scroll down for the rest.
- The top bar: the meeting name, the connection status and **Hide all** (solid red while something is on screen).
- **On screen now**: the live picture with a badge (*Off air*, *On screen*, *Black screen*, *Frozen* or *Emergency*),
  *Frame 4 of 18*, the Frame's name and what it is showing, plus **FrameDecks vCam** and **Recording** chips.
- **Previous** / **Next** (gold; it says **Start** before anything is live).
- The Frame's questions, scriptures or PowerPoint slides (*Question 2 of 5*, *Slide 3 of 12*) with round **◀ ▶**
  arrows. Chips choose which when a Frame has more than one; a **Question / Both / Scripture** switch appears when it
  has both.
- **Teleprompter** opens the Frame's script full screen on the phone (**Done** closes it).
- **Draw**: draw with your finger on the live picture (exactly what Zoom / Teams see). Turn the phone sideways and the
  picture fills the screen, with the tools in a narrow column at the side.
- **Freeze** and **Black screen** (it reads **Show picture** while on).
- **All Frames**: every Frame as a card; tap one to put it on screen (**Live** and **Next** tags). On a tablet the list
  sits beside the controls.
- **Disconnect this device** at the bottom. The **Emergency** screen is on the PC only.

## 7. Excel (optional)
FrameDecks works fully without Excel. The **Meeting Workbook** is for planning, review and bulk editing. To move a
plan to another PC, use a .frame file instead (see [Service planning](service-planning.md#move-a-plan-to-a-service-pc)).

It has two tabs (6.9):
- **Meeting Form**: one guided page, top to bottom, in numbered sections: 1 · Meeting details, 2 · Speaker,
  3 · Attendees, 4 · Presentation, 5 · Frames, 6 · Content, 7 · Discussion questions, 8 · Scripture readings,
  9 · Additional notes. Type in the cream boxes; **Tab** moves on. Each table shows a few empty rows; the **+**
  button on the left opens more.
- **Dashboard**: fills itself in from the form (days to go, counts, a Readiness checklist, Quick actions, a Content
  mix chart and a Recent meetings log). It is never imported.

Use it through **Settings → Data / Backup → Meeting from Excel** (6.11):
- **Download the Excel template** (drop-down lists, an example meeting);
- **Import a meeting from Excel…** (preview with every problem and where it is, such as *Meeting Form · Content ·
  row 26*; Append or Replace; Undo);
- **Export this meeting (Excel)** (the same Dashboard and Meeting Form, filled in).

After an import the app is the source of truth. Workbooks from 6.5 to 6.8 (one sheet per list) and the 6.2
one-sheet template still import; their answers and notes go into the Frame's Teleprompter script. The Excel library
loads only when you first need it, so the app starts faster.

## 8. Your branding
**Settings → Meeting & Branding**: your Meeting Name, organisation, logo and accent colour. They appear only where you
put them: Branding Content, text that uses `{meeting}` / `{org}`, and **Show my logo on this card**.
**Remove background** makes a plain logo background transparent, on this PC, with **Undo**.

## 9. Saving and backups
Everything saves automatically on this PC. **Settings → Data / Backup** keeps daily backups and lets you make one now or
restore one. Each Frame keeps its version and history (Content Settings → Advanced). **Import Frame File…** and
**Export Frame File** (same place) move a whole plan to or from another PC as one .frame file. When you import, choose
**Use this plan** to see exactly what is in the file (your Frames are kept in a backup first), or **Add after my
Frames** to keep yours and add the file's at the end. The **Frame files** box then shows the check against the file.

A PC linked to your team (**Settings → FrameDecks account**) also syncs its plans with framedecks.com. The **Sync**
chip in the header shows **Synced**, **Syncing**, **Offline** (changes wait and go up later; presenting is not
affected) or **Sync failed** (see Settings → FrameDecks account for why). It syncs by itself every minute. To sync
now, choose **Resync Linked PCs** in Settings → FrameDecks account or in the **Sync** chip's panel. Media is never put
in the cloud. Without a
link, your meeting stays on your PC unless you export it.

## 10. Help
- **framedecks.com/help** starts with a **Step-by-step guide**. It has two tabs, **Website** and **Service PC**, with
  eight steps each: sign in, create a meeting, add Frames, write or upload scripts, transitions and drawing, preview,
  sync, export or import, and run the meeting. Each step has a screenshot zoomed on the place to click (tap it for the
  whole screen). Use the search box to find a step. On the PC, **Settings → Help → Step-by-step guide** opens it in
  your browser. It is also in the command palette.
- **Settings → Diagnostics → Copy diagnostics** collects the information needed for support. It contains no PIN or
  member details.
- **Settings → About** has the story, contact and version.
