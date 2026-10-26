# FRAMEDECKS: user guide (v6.8)

FRAMEDECKS runs your online Bible study, prayer meeting, small group or training on Zoom, Microsoft Teams or
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
| Program ▾ | A drop-down menu: Hide Content · **Blackout** (K) · Emergency · **Annotate** (D) · **Freeze** (F) · **Teleprompter** (R) · **Teleprompter window** · **Teleprompter overlay** (Shift+R) |
| Hide all **Esc** | Hide everything. The **Esc** key is shown inside the button |
| ● Off air / LIVE | What is on screen now |
| Window buttons | Minimize, Maximize / Restore and Close, at the top right |

**Search and commands.** The command bar has no search box (6.9). Press **Ctrl+K** or **Ctrl+Space** for the **command
palette** (from anywhere in Windows: **Spotlight**, Alt+Space). It finds Frames, Content, questions, scriptures, text,
templates, the Library, branding, settings, members, Bible references and recent items, and runs commands such as Go
Live, New Frame, Duplicate, Teleprompter, Export meeting, switch theme and Add Content. **↑ / ↓** and **Enter**
choose; **Esc** closes. Change the keys in Settings → Keyboard shortcuts → Command palette.

The command bar fits any window: narrow, maximized, ultra-wide or on a high-resolution screen. Under 1140 px wide it
wraps onto two rows, so nothing is cut off (6.9).

**The window (6.8).** There is no Windows title bar: the command bar is the window's ribbon. Drag its empty space to
move the window, and double-click it to maximize. Snap and resizing from the edges work as usual. Every FRAMEDECKS
 window has the same three buttons at the top right.
- **Minimize** asks *Hide application to system tray?*: **Hide To Tray** or **Stay In Taskbar**, with **Remember my
  choice**. In the tray, the camera, overlays, phone remote and shortcuts keep working.
- The **tray icon** near the clock: click it to open the app. Its menu has **Open App**, **Teleprompter** (the
  overlay), **Search** (Spotlight), **Settings**, **More** (Look, Frame, Stop screen share, Hide all overlays,
  Presentation window, Phone remote) and **Exit**.
- **Spotlight** (Alt+Space, or Ctrl+Alt+Space if another program has Alt+Space) opens the command palette's search in
  the middle of the screen, from anywhere, even with the app in the tray. Go Live, Next / Previous Frame, Hide all,
  Blackout, Freeze and the Teleprompter run without bringing the main window back. An empty search shows Recent,
  Frequently used and Suggested.
- **Settings → General → Window and tray**: Modern window (off brings the Windows title bar back, after a restart),
  Minimize button (Ask each time / Hide to tray / Stay in taskbar), the Spotlight shortcut (Alt+Space, Ctrl+Space,
  Ctrl+Alt+Space, Ctrl+Shift+Space, Win+Shift+K or Off, with a line saying whether it works), and the overlay's
  starting Transparency, Frosted glass, Stay on top and Compatibility transparency.

## 2. Frames and Content
- **Meeting** (the ✨ button next to + Frame) has:
  - Import / Export / Download the Excel Meeting Workbook;
  - Quick Start;
  - the Content Library;
  - your Frame templates.
- **+ Frame** adds one **blank** Frame after the selected one. Name it by double-clicking its **name** (or F2), or
  under *Content Settings → Frame*. The name is edited right in the list: **Enter** saves, **Esc** cancels.
- Select the Frame, then **+ Content**:
  - **Question**, **Scripture**, **Text**, **Discussion topic**, **Icebreaker**, **Poll (show of hands)**, **Image**,
    **Video**, **Timer**, **PowerPoint**. The Poll only shows the choices; people answer by a show of hands or in the
    chat, and nothing is counted;
  - **Free Content**: announcement, prayer point, lower third, birthday, branding, camera, screen share, a live
    window, logo, watermark, free text, shape, background.
- **Content belongs to its Frame.** Changing it never changes another Frame.
- **Duplicate** (⋯ on a Frame) makes a completely separate copy. Every question, scripture, label and setting is
  copied, not shared.
- Select a Frame and press **Go Live**. Double-click the Frame's row (not its name), or press **T**, to do the same.
- **Select several** Frames or Contents with **Ctrl+Click**, **Shift+Click** or by dragging a box in empty list
  space (**Ctrl+A** selects all). Then:
  - **Delete** / **Backspace** deletes them; the message offers **Undo**, and you are asked first only for 5 or more;
  - **Ctrl+C** / **Ctrl+X** / **Ctrl+V** copy, cut and paste; **Ctrl+D** duplicates;
  - drag them to move them, or right-click for a menu.

## 3. Content Settings
Select any Content and every setting is in one panel, most used first:
- **Label**
- **Content**
- **Display Settings** (with **Animation** and **Show on** inside it)
- **Visual Settings**

Pictures, video and PowerPoint have a **Media** group. A Frame on its own has **Frame**, **Timing** and **History**.

The group names along the top jump to their group. There is no Basic / Advanced switch: everything is visible.
Where each piece of Content appears (FRAMEDECKS, OBS pages) is set once, in that Content's **Show on** group.

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
  prayer, discussion topic, icebreaker, poll, lower third, timer) to edit its text; double-click the card's label
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
    **Text** (T).
  - Six colours and three thicknesses.
  - **Eraser** or **Undo** (Ctrl+Z), **Redo** (Ctrl+Y), **Clear**.
  - The drawings appear above everything: slides, PowerPoint, cards. Everyone sees them in Zoom or Teams. **Esc**
    hides them.
- **Freeze (F)** holds the picture while you get the next thing ready. You can still draw on it.
- **Blackout (K)** makes the picture black.
- **Teleprompter** (Program → Teleprompter, or **R**) shows the Frame's **Teleprompter script**. Only you see it;
  it is never on any output.
  - Write the script in Frame settings → **Teleprompter script** (up to 20,000 characters), or double-click the
    teleprompter text (or **✎**). Markup: `# Heading`, `- bullet`, `**bold**`, `*italic*`, `[PAUSE]` cue chips,
    `---` divider.
  - Dock it **Left**, **Right** or **Bottom** of the Studio, or **Float** it; drag to resize. **Follows: Live / Selected**
    chooses which Frame's script it shows.
  - Scroll play / pause (Space), speeds from Very slow to Very fast, **A− / A+** (− / + keys), line spacing, high
    contrast, Focus mode (F), back to top (Home), arrow and Page keys, the mouse wheel and touch.
  - The cue line shows *Frame 3 of 9*, **LIVE**, the next Frame and the next question or scripture.
- **Teleprompter window** (Program → Teleprompter window; it was Speaker View) opens the Teleprompter in its own
  window for a second screen. The script takes the whole width; **On screen & next** slides in the clocks, a timer,
  what is on screen and what comes next (hidden at first, remembered). The controls float and fade. **M** mirrors
  the text.
- **Teleprompter overlay** (Program → Teleprompter overlay, **Shift+R**, the tray, Spotlight, the palette, or
  **Overlay** in the docked Teleprompter) shows the script in a see-through window over Zoom, Teams or Meet.
  - Five modes, keys **1**–**5**: Solid (0 %), Presenter (20 %), Meeting (40 %, the default), Conference (65 %),
    Ghost (85 %). The outline around the letters gets stronger as it gets more see-through.
  - **Frosted glass** (Acrylic on Windows 11 22H2+, blur on Windows 10); **Stay on top** (📌, **P**), remembered.
  - Never in screen sharing or recordings (Windows 10 2004+). The Teleprompter window and Spotlight are left out
    too.
  - The script takes about 95 % of the width. A glass toolbar floats at the bottom and fades after about 3 seconds:
    Play / Pause (Space), speed, A− / A+, line spacing, contrast, Mirror (M), top, edit ✎, transparency, frost,
    pin and Exit (Esc). A thin ribbon appears with it at the top: drag it to move the overlay; resize from the
    edges.
  - It follows the Frame on screen (the first Frame before you go live).
  - With **Light on graphics card** on (the default) the overlay fades as a whole, text included. For solid text,
    turn that setting off and restart. **Compatibility transparency** forces the whole-window fade if the meeting
    does not show through.

## 5. The FRAMECAST camera
Choose **FRAMEDECKS** as the camera in Zoom, Teams, Google Meet or OBS. Participants see your webcam with the live
Frame on top. Background blur and Camera Looks are in **Settings → FRAMECAST Camera**. If an app doesn't list
FRAMEDECKS, restart that app.

## 6. Phone and tablet remote
**Settings → Phone & iPad Remote** → turn it on, scan the QR code, enter the PIN.
- **Simple remote** (the default): one screen, very large buttons, nothing to set up.
  - **Current Frame** (*Frame 4 of 18*) with **PREVIOUS FRAME** / **NEXT FRAME**.
  - **Current Content** (*Question 2 of 5*, *Scripture*, or *PowerPoint · Slide 3 of 12*) with **PREVIOUS CONTENT** /
    **NEXT CONTENT**. **Change** appears when a Frame has more than one.
  - **ANNOTATE**: draw with your finger on the live picture (exactly what Zoom / Teams see). Turn the phone sideways
    and the picture fills the screen, with the tools in a narrow column at the side.
  - **FREEZE** and **BLACK SCREEN**.
  - **TELEPROMPTER** opens the Frame's script full screen on the phone.
  - The connection status is spelled out at the top, next to **HIDE ALL**.
- **Advanced remote** (⋯ → Advanced remote):
  - every Frame, with search across Frames and Content;
  - the Frame's Content (tap to show or hide);
  - a **Teleprompter** panel on the **Live** tab;
  - PowerPoint slides;
  - **Run-through**: step through Frames on your phone without changing the screen;
  - Annotate, Freeze, Blackout and Emergency.

## 7. Excel (optional)
FRAMEDECKS works fully without Excel. The **Meeting Workbook** is for planning, review, handover and bulk editing.

It has two tabs (6.9):
- **Meeting Form**: one guided page, top to bottom, in numbered sections: 1 · Meeting details, 2 · Speaker,
  3 · Attendees, 4 · Presentation, 5 · Frames, 6 · Content, 7 · Discussion questions, 8 · Scripture readings,
  9 · Additional notes. Type in the cream boxes; **Tab** moves on. Each table shows a few empty rows; the **+**
  button on the left opens more.
- **Dashboard**: fills itself in from the form (days to go, counts, a Readiness checklist, Quick actions, a Content
  mix chart and a Recent meetings log). It is never imported.

Use it through **Settings → Data / Backup → Meeting from Excel** (6.11; the website's Meeting Form does the same online):
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
restore one. Each Frame keeps its version and history (Content Settings → History). FRAMEDECKS has no accounts,
shared workspaces or cloud: your meeting stays on your PC unless you export it.

## 10. Help
- **Settings → Diagnostics → Copy diagnostics** collects the information needed for support. It contains no PIN or
  member details.
- **Settings → About** has the story, contact and version.
