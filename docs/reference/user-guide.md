# Kingdom Connect: user guide (v6.6)

Kingdom Connect runs your online Bible study, prayer meeting, small group or training on Zoom, Microsoft Teams or
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
| Search (Ctrl+K) | Frames, Content, Bible references, questions, members, settings |
| ◀ Frame · **Go Live** · Frame ▶ | Put the selected Frame on screen (T), or step to the previous or next Frame |
| Transition · Auto · ◀ Question ▶ | How the next Frame appears; auto-advance; step through the Frame's questions or scriptures |
| Program | Hide Content · **Blackout** (K) · Emergency · **Annotate** (D) · **Freeze** (F) · **Speaker View** |
| Hide all | Hide everything (Esc) |
| ● Off air / LIVE | What is on screen now |

## 2. Frames and Content
- **Meeting** (the ✨ button next to + Frame) has:
  - Import / Export / Download the Excel Meeting Workbook;
  - Quick Start;
  - the Content Library;
  - your Frame templates.
- **+ Frame** adds one **blank** Frame after the selected one. Name it by double-clicking it, or under
  *Content Settings → Frame*.
- Select the Frame, then **+ Content**:
  - **Question**, **Scripture**, **Text**, **Image**, **Video**, **Timer**, **PowerPoint**;
  - **Free Content**: announcement, prayer point, lower third, birthday, branding, camera, screen share, a live
    window, logo, watermark, free text, shape, background.
- **Content belongs to its Frame.** Changing it never changes another Frame.
- **Duplicate** (⋯ on a Frame) makes a completely separate copy. Every question, scripture, label and setting is
  copied, not shared.
- Select a Frame and press **Go Live**. Double-click a Frame, or press **T**, to do the same.

## 3. Content Settings
Select any Content (or the Frame itself) and every setting is in one panel, in groups:
- **Content**
- **Appearance**
- **Position**
- **Timing**
- **Animation**
- **Media**
- **Behavior**

The group names along the top jump to their group. There is no Basic / Advanced switch: everything is visible.
Where each piece of Content appears (KingdomConnect, OBS pages) is set once, in that Content's **Behavior** group.

### Questions and Scriptures
A Question (or Scripture) Content holds **its own list**, shown full height in Content Settings:
- **Click** an item to make it the Frame's current one.
- **Show** puts it on screen.
- **Double-click** (or Enter) opens it for editing **in the same panel**:
  - its own **Label** (for example *Question 1*, *Opening question* or *John 15:5*);
  - the text;
  - an **Answer** and **Notes** for you (never on screen);
  - its own transition.
- Press **Done** (or Esc) to go back to the list.
- **Or edit it on the canvas:** double-click the question or scripture card on the Studio Canvas (the preview, or the
  live picture). An editor opens over the card: **Enter** saves, **Shift+Enter** starts a new line, **Esc** cancels,
  and a click outside saves. If the card is on screen, the screen changes too.
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
- **Speaker View** (Program → Speaker View) opens a window only you see, ideal on a second screen:
  - the question or scripture on screen now, with its **Answer** and **Notes**;
  - what comes **next** (the next item, then the next Frame);
  - the Frame's leader notes and the meeting notes;
  - the **time**, how long this Frame has been on screen, and a **Timer** you can start, pause and reset.

  It follows the meeting by itself; change what is on screen from the main window or the phone.

## 5. The KingdomConnect camera
Choose **KingdomConnect** as the camera in Zoom, Teams, Google Meet or OBS. Participants see your webcam with the live
Frame on top. Background blur and Camera Looks are in **Settings → KingdomConnect Camera**. If an app doesn't list
KingdomConnect, restart that app.

## 6. Phone and tablet remote
**Settings → Phone & iPad Remote** → turn it on, scan the QR code, enter the PIN.
- **Simple remote** (the default): one screen, very large buttons, nothing to set up.
  - **Current Frame** (*Frame 4 of 18*) with **PREVIOUS FRAME** / **NEXT FRAME**.
  - **Current Content** (*Question 2 of 5*, *Scripture*, or *PowerPoint · Slide 3 of 12*) with **PREVIOUS CONTENT** /
    **NEXT CONTENT**. **Change** appears when a Frame has more than one.
  - **ANNOTATE**: draw with your finger on the live picture (exactly what Zoom / Teams see). Turn the phone sideways
    and the picture fills the screen, with the tools in a narrow column at the side.
  - **FREEZE** and **BLACK SCREEN**.
  - The connection status is spelled out at the top, next to **HIDE ALL**.
- **Advanced remote** (⋯ → Advanced remote):
  - every Frame, with search across Frames and Content;
  - the Frame's Content (tap to show or hide);
  - presenter notes and the question's answer;
  - PowerPoint slides;
  - **Run-through**: step through Frames on your phone without changing the screen;
  - Annotate, Freeze, Blackout and Emergency.

## 7. Excel (optional)
Kingdom Connect works fully without Excel. The **Meeting Workbook** is for planning, review, handover and bulk editing.

It has five sheets:
- **Meeting Overview**
- **Frames**
- **Content**
- **Questions**
- **Scriptures**

Use it through **Meeting**:
- **Download the Excel template** (drop-down lists, examples);
- **Import meeting from Excel…** (preview with every problem and its row, Append or Replace, Undo);
- **Export this meeting to Excel**.

After an import the app is the source of truth.

## 8. Your branding
**Settings → Meeting & Branding**: your Meeting Name, organisation, logo and accent colour. They appear only where you
put them: Branding Content, text that uses `{meeting}` / `{org}`, and **Show my logo on this card**.

## 9. Saving and backups
Everything saves automatically on this PC. **Settings → Data / Backup** keeps daily backups and lets you make one now or
restore one. Each Frame keeps its version and history (Content Settings → History). Kingdom Connect has no accounts,
shared workspaces or cloud: your meeting stays on your PC unless you export it.

## 10. Help
- **Settings → Diagnostics → Copy diagnostics** collects the information needed for support. It contains no PIN or
  member details.
- **Settings → About** has the story, contact and version.
