# FrameDecks: user guide (v6.8)

FrameDecks runs your online Bible study, prayer meeting, small group or training on Zoom, Microsoft Teams or
Google Meet. It is meeting-first:

1. **Meeting**: one meeting, for example *Romans · Week 5*.
2. **+ Frame**: one screen or one step of the meeting (Welcome, Worship, Scripture Reading, Questions, Closing).
3. **+ Deck**: what is shown inside a Frame (a question, a scripture, text, a picture, a video, a timer, PowerPoint).
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
| ◀ Frame · **Go Live** · Frame ▶ | Put the selected Frame on screen (T), or step to the previous or next Frame. In the Studio these live in the big button of the right rail, which says where Next goes (*Next ▸ Chorus*); the top bar shows them on the Members and Settings tabs (26.11.57) |
| Transition · Auto · ◀ Question ▶ | How the next Frame appears; auto-advance; step through the Frame's questions or scriptures |
| Prepare · Engage · Control · Notes · More | The five chips (in place of Live tools), the same as in the Command Center and on the phone remote. Each opens a panel under it; **Esc** closes it. **Prepare**: meetings, **Teleprompter** (R), share, Quick Start, library, import, camera. **Engage**: Memory Cards, Capture copies, **Draw** and **Spotlight** (on the desktop app they open the Command Center on Engage with that tool ready, or the Share Window when people see a shared window), clear drawings, hide cards. **Control**: Hide the selected Content, **Black screen** (K), **Freeze the picture** (F), Emergency screen. **Notes**: your private notes for this meeting. **More**: settings and help |
| Hide all **Esc** | Hide everything. The **Esc** key is shown inside the button |
| ● Ready / Live / LIVE | What is on screen now. Press it to see every output (camera, Share Window, overlays); a separate warning shows only when something needs you (26.11.57) |
| Window buttons | Minimize, Maximize / Restore and Close, at the top right |

**Search and commands.** The command bar has no search box. Press **Ctrl+K** or **Ctrl+Space** for the **command
palette** (from anywhere in Windows: **Spotlight**, Alt+Space). It finds Frames, Content, questions, scriptures, text,
templates, the Library, branding, settings, members, Bible references and recent items, and runs commands such as Go
Live, New Frame, Duplicate, Teleprompter, Export meeting, *Look: <name>* and Add Content. **↑ / ↓** and **Enter**
choose; **Esc** closes. Change the keys in Settings → Keyboard shortcuts → Command palette.

The command bar fits any window: narrow, maximized, ultra-wide or on a high-resolution screen. Under 1140 px wide it
wraps onto two rows, so nothing is cut off.

**The window.** There is no Windows title bar: the command bar is the window's ribbon. Drag its empty space to
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
- **Settings → Controls → General → Window and tray**: Modern window (off brings the Windows title bar back, after a restart),
  Minimize button (Ask each time / Hide to tray / Stay in taskbar), the Spotlight shortcut (Alt+Space, Ctrl+Space,
  Ctrl+Alt+Space, Ctrl+Shift+Space, Win+Shift+K or Off, with a line saying whether it works). **Settings →
  General** is now just *Window, tray and performance*.
- **The look of the window:** **Settings → Meeting & Branding → Look**. Pick a colour card: **Gold & Navy**
  (the standard), **Morning Light**, **Chapel Stone**, **Deep Ocean**, **Forest** or **Quiet Mono** (the same looks
  as on framedecks.com, Branding → Look), or **Same as my workspace** to follow the look chosen on the website,
  light or dark included. Under it, **Light or dark**: **Dark**, **Light** or **Match Windows**. A look picks its own
  light or dark (Morning Light is light), and you can change it. Only this window changes: the camera picture, the
  overlays and the phone remote keep their own look.


**Settings** has six groups: **Meeting look** (Meeting & Branding, Transitions), **Content** (Scripture,
Birthdays), **Screens & camera** (How people see it, FrameDecks vCam, Projector TV and OBS, Recording), **Controls**
(General, Phone & iPad Remote, Keyboard shortcuts), **Workspace & privacy** (Sync, Security) and **Data &
help** (Data / Backup, Diagnostics, About). A group's pages are tabs under its title; **Find a setting** searches all
of them.

### A whole service (26.11.57)
- **Song Library** (Prepare → Song Library, or the command palette): keep every song once. **Paste the words** and
  FrameDecks splits them into verses and choruses (*[Verse 1]*, *Chorus:* or a blank line), or use **Import…**
  (text, ChordPro or OpenLyrics files) or **From PowerPoint** (the selected Frame's slides). Each song has its author,
  copyright and CCLI number; type your church's **CCLI licence** once, at the bottom of the list, and the credit line
  shows on screen. **Arrangement** repeats parts without copying words (*V1 C V2 C B C*).
  **Add to this Frame** or **Add as a new Frame** puts it in the meeting. While it is live, press **1–9** for a verse, **C** chorus, **B**
  bridge, **P** pre-chorus, **E** ending. **Usage report** lists the songs used in a month (each once per service) for
  your CCLI report.
- **The room screen:** Settings → How people see it → Projector, TV and OBS → **Room screen (projector or TV)**: choose
  the screen by its name. **Open on it now** opens the Share Window full screen there; with **Go Live opens the Share
  Window full screen on this screen** ticked, Go Live does it for you.
- **Stage screen for musicians and speakers** (the box below it): **Open on this PC**, or open its link on a tablet
  signed in to the phone remote. It shows what is on screen now, what comes next, the clock and the time left. Type a
  **Message** and press **Show** (or *Message to the stage screen* in the command palette).
- **Themes** (Settings → Meeting & Branding → Themes, or the palette): one picture or looping video behind every song,
  scripture or announcement. **Apply to this meeting** puts it behind each such Frame; songs added later get it too.
- **Videos:** in a video's settings, **When it ends** → **Play once, then Next**: the time left shows above Next and the
  next step follows by itself.
- **Show a verse:** while live, type a reference in the box above Next (*Rom 8 28*) and press **Enter**. A long passage
  is split into parts that fit; Next shows the rest.
- **Sunday Service** in Quick Start: a **Welcome Loop** (a countdown with announcements taking turns; when it reaches
  zero the service starts), songs, the reading, the message, the offering and the blessing.
- **One order per Frame:** **Question · Scripture · Both** chooses what comes first, **Set order** sets every step, and
  **Smart Next** (on by default) walks a Frame's scripture and questions before the next Frame. **Auto** steps through
  the order on a timer and can loop it. **Run order** opens beside the Frames list; **Open large** gives the big view.
- **Import** (one menu) takes a PowerPoint, a lesson, an Excel file or a .frame file. **Add** groups Content by
  **Worship**, **Word**, **Church life** and **Camera and screen**.
- While live in Simple, the editor folds away to give the stage room; open it again any time.

## 2. Frames and Content
- **Meeting:** with several meetings, the meetings are tabs above the Frames, each with its date and number of
  Frames (the next one by date reads *Next*); click one to show and run it. The line under them says which meeting
  this PC runs. **New** makes another: **Blank** (one empty Frame) or **Copy of** the meeting shown (the same Frames,
  Decks and looks, with the scripture and questions left empty). The bin button beside the meeting's name deletes the
  whole meeting (its Frames, Decks and Content, nothing of any other meeting) after asking; **Undo** brings it back.
  See [Frames](frames.md#name-group-and-order).
- **Meeting** (the ✨ button next to + Frame) has:
  - Import / Export / Download the Excel Meeting Workbook;
  - Quick Start;
  - the Content Library;
  - your Frame templates.
- **+ Frame** adds one **blank** Frame after the selected one. Name it by double-clicking its **name** (or F2), or
  in its **Name** box in Content Settings. The name is edited right in the list: **Enter** saves, **Esc** cancels.
- Select the Frame, then **+ Deck** (the **Decks** section under the Frames list shows its Content):
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
A Question (or Scripture) Content holds **its own list**, in the area under the preview. Its **Label** and the
**+ Question** / **+ Scripture**, **Add several** and **Remove all** buttons sit in the title row; questions are
cards across the width, and scriptures are rows beside **Fetch scripture**. Since 26.11.50 the area under the
preview shows the settings as cards (**Position and size**, **Look**, **Animation**, **Show on**) and you type in the
preview; turn on **Show text fields** to see the list and the typing boxes here as well.
- **Set order:** under the preview, **Set order** lets you click the Content in the order it should appear (any kind
  of Content; Shift-click puts it together with the step before). Gold numbers and a dotted path show the order;
  drag a step to move it, **×** removes it, **Done** saves. When the Frame is live, **Next step** shows each step,
  then Next goes to the next Frame. **Look** in the preview's toolbar copies a look, pastes it, or uses it for every
  one of that kind in this meeting, all meetings or chosen Frames (never the words; one Undo).
- **Slides in the order** (26.11.56): a PowerPoint can be a step of Set order, for example scripture, then question,
  then the slides. On that step the big button reads **Next slide** and walks the slides (and their animations); after
  the last slide it goes on to the next step. Previous goes back through the slides first.
- **Put slides after this Frame** (26.11.56): in a PowerPoint's menu (⋯ on the Deck), this moves the deck out into a
  Frame of its own, right after this one, so Next goes: this Frame, then the slides, then the Frame that followed.
  One **Undo** puts it back.
- **Run order** (26.11.56): beside **Next week**, it opens every Frame of the meeting in the order Next walks them,
  each with its steps (① Scripture → ② Question) and its slides (*Talk · 12 slides*), and a total. Drag a row, or use
  its arrows, to move a Frame; click a name to select it in the Studio.
- **Type in the preview:** click a card on the preview to select it (a gold outline with its name), then
  double-click it or press **Enter** to type. The toolbar above it has **Edit**, **A−** / **A+**, **◀ 2 of 5 ▶**,
  **+ Question** / **+ Scripture**, **Show** / **Hide** and **Delete** (with Undo). Drag the card to move it, drag a
  corner to resize it. **Double-click empty space** to add Content there. With the preview focused, **Tab** /
  **Shift+Tab** go from card to card, the arrow keys nudge (**Shift**: further) and **Delete** deletes.
- **Click** an item to make it the Frame's current one.
- **Show** puts it on screen.
- **Double-click** its **label** or its **text** to edit it right there in the list. **Enter** saves,
  **Shift+Enter** starts a new line, **Esc** cancels, and a click outside saves.
- **Enter** on a selected item opens all its settings **in the same panel**: its own **Label** (for example
  *Question 1* or *John 15:5*), the text and its own transition. Press **Done** (or Esc) to go back to the list.
- **Or edit it on the canvas:** double-click any card on the Studio Canvas (question, scripture, announcement,
  prayer, lower third, timer) to edit its text; double-click the card's label
  (its top line) to edit the label. The same keys apply. If the card is on screen, the edit is a draft until you
  select **Update screen** (or press **Enter** twice). Clicking a card selects it and lights up its item in the
  list; choosing an item outlines its card on the preview.
- Questions have no Answer or Notes fields any more. Old ones are kept in your data but not shown; put
  reminders in the Frame's **Teleprompter script**.
- **+ Question** / **+ Scripture** adds one; **Add several** pastes many at once. Or type a new question into
  the last card (**Type a new question and press Enter**); it stays ready for the next one.
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
  - **Spotlight** (S): double-click a word, or press **Ctrl** twice quickly with the mouse over it, and the light
    lands on it, breathes, then blooms open with a last ripple and a few sparks and fades. Nothing follows the mouse
    in between. Double-click empty space to spotlight a point. Its panel
    sets the colour, **Size**, **Length** (1–15 s) and **Strength**, with **Try it**. It shows on FrameDecks vCam (Zoom,
    Teams), recordings and the overlay pages.
- **Freeze (F)** holds the picture while you get the next thing ready. You can still draw on it.
- **Blackout (K)** makes the picture black.
- **Teleprompter** (Engage → Teleprompter, **R**, the command palette's *Teleprompter on / off*, or the tray's
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
  - Second row: **▶ Scroll** (Space), **Follow my voice** (V: the script moves as you speak; it listens only on
    this PC and only while the Teleprompter is pinned or in front), speed from Very slow to Very fast, A− / A+, line spacing, contrast, Mirror (M),
    **✎ Write Script**, **⇪ Upload** and **Each Frame** / **Whole meeting**.
  - Transparency and pin are remembered, and work only in the installed app. With **Light on graphics card** on (the
    default) the whole window fades, text included; with it off, only the background is see-through.
- **PowerPoint slides** (26.11.45). When you add a deck, its Content Settings say at once how it will play, for
  example *Ready: 24 slides, 3 with animations · PowerPoint will play it*, or *still slides (PowerPoint is not on this
  PC)*. Since 26.11.53 a deck's settings are cards like every other Content: **Slides** (the file, Start at slide and
  the ready line), **Playback** (Play animations, On members' phones, Show objects only), **Position and size** and
  **Look**. Pictures, video, camera and sound use the same cards, and the cards always fill their rows evenly. In
  Simple, Slides and Playback stay; the others are behind **Design**.
  - **Present slides** (26.11.49): with a Frame that has slides selected, the big button reads **Present slides**:
    it goes live and shows the slide large, with big **Back** and **Next**, the next slide, its notes and a strip of
    the slides in this meeting's order. While slides are on screen the big button says what it will do: **Next
    animation**, **Next slide**, then, after the last slide, **Next** to the next Frame.
  - **Presenter view** (26.11.55): Present slides opens inside the Studio, in place of the preview, with Go Live,
    Next and Up next still beside it. It is marked *Presenter view · only you see this*, and the slide people see is
    marked **ON SCREEN**. **Pop out** gives the large window (for a second screen); **← Back to Studio** (or Esc)
    closes it and the slide stays on screen. The arrow keys and Page Up / Page Down step through the slides.
  - The window people see is the **Share Window**, called *FrameDecks Share Window – what people see* in Zoom's list.
    When you move the mouse over it, it shows *Share Window · what people see*; while it is open, the Studio's
    **Share Window** button has a green edge.
  - On the phone remote, **Clicker** under *Slide 3 of 12* turns the phone into a clicker: the slide, two big buttons
    and what Next will do.
  With a Frame that has a PowerPoint deck on screen:
  - **Animations play** (26.11.46). A .pptx with animations or transitions is played by PowerPoint itself, behind
    your windows, so every animation, transition and video plays as in PowerPoint. **Next** plays the next animation,
    then the next slide; the grid and the Teleprompter show *animation 1 of 3*. Needs PowerPoint on this PC; leave its
    slide-show window open (it sits behind your other windows). Content Settings → **Play animations** switches it off.
  - **Every slide at once**: press **Slide 3 / 12** in the top bar (or Control → **Every slide**, the command
    palette's *Every slide*, or **Slide 3 of 12** in the Command Center and on the phone). The slide on screen and the
    next one are marked; click any slide to put it on screen. **Search** finds words in the slides' titles, text and
    speaker notes.
    The bar keeps **Previous**, **Next** (it says *Next animation* or *Next slide*), **Zoom** and **Present**; Run
    order, the hold screens, where you are and members' phones are under **More ▾**. The line under the
    title says how the deck plays in plain words (*PowerPoint is playing this deck*, *Still slides (no animations)*,
    *Slide 4 is not on members' phones*).
  - **Run order**: hide a slide or move it for this meeting only (drag it, or ◀ ▶). The PowerPoint file is not
    changed, and Next and Previous follow the new order everywhere.
    **📱 On phones / Off phones** keeps one slide off members' phones (they read *This slide is not shown on phones*);
    Content Settings → **On members' phones** keeps the whole Deck off them.
  - **Zoom**: click the part of the slide to show larger (1.5× to 4×); **Whole slide** goes back. The next slide
    starts whole again.
  - **Hold ▾**: Black screen, "We'll be right back" or "Please stay with us" over the slides, and back.
    **You ▾**: the slide fills the picture, you beside the slide, or you in a corner over it.
  - A slide that names a passage (John 10:11) shows **Show John 10:11**, and it is offered as the scripture card when
    the slide comes on screen (Settings → Listening → **Scripture on a slide**). Nothing shows until you press Show.
  - Select song slides in Run order and choose **Make a Songs Deck**: one verse per slide.
  - **Slides to members' phones** puts the slides' text on members' phones; while members' phones is open they also
    see the slide on screen.
  - The **Teleprompter** shows the slides beside the script: the slide on screen, the next one, its speaker notes and
    how long it has been up, with **Next slide** and **All**.
  - Voice commands: "next slide", "previous slide", "slide twelve", "the slide about grace".

## 5. The FrameDecks vCam
Choose **FrameDecks** as the camera in Zoom, Teams, Google Meet or OBS. Participants see your webcam with the live
Frame on top. Background blur and Camera Looks are in **Settings → FrameDecks vCam**. If an app doesn't list
FrameDecks, restart that app.

## 6. Phone and tablet remote
**Settings → Phone & iPad Remote** → turn it on, scan the QR code, enter the PIN. Run the whole meeting from it:
- Always in view: the meeting name, the connection status and **Hide all** (solid red while something is on screen);
  the **live picture** with its badge (*Off air*, *On screen*, *Black screen*, *Frozen* or *Emergency*); *Frame 4 of
  18*, the Frame's name and what it shows; **Previous** / **Next** (gold; it shows the next Frame's name and says
  **Start** before anything is live).
- **Spotlight** on the picture: drag a finger and the spotlight follows it on every screen; tap for a quick circle.
  **Draw** opens the drawing pad (turn the phone sideways for a bigger picture).
- Five chips, the same as the PC's top bar and Command Center. **Control**: the Frame's questions, scriptures
  or slides with ◀ ▶ arrows, the Question / Both / Scripture switch, video play / pause / from the start, every Deck
  with an eye, Black screen and Freeze. **Prepare**: meeting details, switch meeting, every Frame > Deck > Content
  (1 · 1.1 · 1.1.1, tap to show any of them) and the Teleprompter. **Engage**: Draw, Spotlight, Clear drawings and
  Capture Chats. **Notes**: add a note to this meeting (reading them is off unless the PC turns it on). **More**: PC
  status, **Disconnect this device**.
- Upright: chips at the bottom. Sideways or on a tablet: the picture on the left, the chips on the right.
- The **Emergency** screen is on the PC only.

### Members' phones (for members, on their own phones)
Not the phone remote: this is for everyone in the meeting, with nothing to install. In Engage, under
**On members' phones**:
- **Members' phones** → **Open for members' phones**. Members scan the QR code or type the code at
  framedecks.com/follow. On their phones they **follow along** (the Frame, scripture and question on screen), send
  **prayer requests** (with or without their name) and keep the **sermon notes** you share.
- On their phones the meeting fills the screen: the FrameDecks name, your meeting's name below it, then what is on
  screen, with **On screen · Prayer · Notes** at the bottom. A PowerPoint slide is shown as people see it (with the
  animations played so far); tapping it opens it full screen, sharp, to **pinch or double-tap to zoom**, and to
  **swipe back** through the slides already shown (never the ones still to come). When you share the sermon notes,
  **Include the slides shown** adds those slides at the end, so they are kept and printed with the notes.
- **Show the code on screen** puts the code and a QR code to scan on the camera and the Share Window for people on
  Zoom or Teams. It stays until you press **Take the code off screen** (or close members' phones).
- For people who arrive late: Settings → Meeting & Branding → **Members' phones QR code** puts a small QR code beside
  or below your logo on the Branding badge while members' phones is open.
- **Polls**: ask yes or no, a choice or a 1–5 rating; members answer on their phones and **Show** puts the answers
  on screen.
- **Typed answers** (26.11.57; command palette → *Typed answers*, or **Ask for typed answers instead** in Polls): ask
  everyone to type a short answer (*What stood out to you?*). Phones get a box under the screen, one answer each, no
  names. Answers arrive in the Studio, newest first; **Show** puts the one you choose on screen as a Memory Card, with
  the question as its title. When you share the notes, the answers you showed are added as **What we shared**.
- **Discussion minutes** (26.11.57): in a question's editor, **Discussion minutes** gives it a time. When the question
  is shown, the time left counts down above Next and on the stage screen, and FrameDecks tells you when it is up.
  **Breakout** puts the countdown on screen (at the top) with the question kept visible, for breakout rooms or table
  groups; phones following the meeting see the question too.
- **A co-leader can take over:** give them the phone remote (Settings → Phone & iPad Remote, or search *hand over* in
  the command palette). Their Next, Previous and Go Live work alongside yours.
- Prayer requests wait in the list for you. Nothing is shown unless you choose it, and a name only if you choose.
- It needs this PC connected to your workspace (Settings → Sync). In Settings → Features these switches are together
  under **On members' phones**.

## 7. Import a lesson
A study lesson becomes Frames in one go (26.11.54). Choose **Meeting ▾ → Import a lesson (PDF or Word)…**, or
**Import a lesson…** in Quick Start or **Settings → Data / Backup → Meeting from a lesson**, then pick the lesson: a
PDF, a Word file (.docx) or a text file.
- FrameDecks reads it on this PC and finds its **days or parts** (*Day 1*, *First Day*, *Lesson 3*, *Week 2*,
  *Part One*…), its **numbered questions** (*3*, *3a*, *3b*) and every **Bible reference** (*John 3:16*,
  *Gen. 12:1-3; 15:6*, *1 Cor 13:4-7*, *Ps 23*).
- You see one card per part with its scriptures and questions, each ticked. Untick what you don't want, type a new
  name for a Frame, and choose the translation (ESV with your key, or KJV or WEB, which need none). A whole chapter
  (*Genesis 13*) is offered but not ticked, because it is long on screen.
- **Make Frames** creates one Frame per part with a Scripture and a Question Content, and sets the order:
  the scripture first, then the questions (turn this off in the dialog). **Undo this import** puts the meeting back.
- A lesson with several days can start with a **Reading Frame** (26.11.57): one Frame with every passage of the
  week, in order, before the Frame for each day.
- Headers, footers and page numbers are left out. A scanned lesson (pictures of pages) has no text to read: use the
  lesson's PDF from its website, or type the questions in.

## 8. Excel (optional)
FrameDecks works fully without Excel. The **Meeting Workbook** is for planning, review and bulk editing. To move a
plan to another PC, use a .frame file instead (see [Service planning](service-planning.md#move-a-plan-to-a-service-pc)).

It has two tabs:
- **Meeting Form**: one guided page, top to bottom, with three steps across the top. 1 · Meeting details,
  2 · Meeting plan, then the optional sections: 3 · Speaker, 4 · Attendees, 5 · Presentation, 6 · Additional notes.
  Type in the cream boxes; **Tab** moves on. Each plan row colours itself by its Level as you choose it. The Meeting plan is one table in the app's order, Frame > Deck > Content, numbered by itself
  (1 · 1.1 · 1.1.1); the **+** button on the left opens more rows.
- **Dashboard**: fills itself in from the form (days to go, counts, a Readiness checklist, Quick actions, a Content
  mix chart and a Recent meetings log). It is never imported.

Use it through **Settings → Data / Backup → Meeting from Excel**:
- **Download the Excel template** (drop-down lists, an example meeting);
- **Import a meeting from Excel…** (preview with every problem and where it is, such as *Meeting Form · Content ·
  row 26*; Append or Replace; Undo);
- **Export this meeting (Excel)** (the same Dashboard and Meeting Form, filled in).

After an import the app is the source of truth. Workbooks made with earlier versions still
import; their answers and notes go into the Frame's Teleprompter script. The Excel library
loads only when you first need it, so the app starts faster.

## 9. Your branding
**Settings → Meeting & Branding**: your Meeting Name, organisation, logo and accent colour. They appear only where you
put them: Branding Content, text that uses `{meeting}` / `{org}`, and **Show my logo on this card**.
**Remove background** makes a plain logo background transparent, on this PC, with **Undo**.

## 10. Saving and backups
Everything saves automatically on this PC. **Settings → Data / Backup** keeps daily backups and lets you make one now or
restore one. Each Frame keeps its version and history (Content Settings → Advanced). **Import Frame File…** and
**Export Frame File** (same place) move a whole plan to or from another PC as one .frame file. When you import, choose
**Use this plan** to see exactly what is in the file (your Frames are kept in a backup first), or **Add after my
Frames** to keep yours and add the file's at the end. The **Frame files** box then shows the check against the file.

A PC linked to your team (**Settings → Sync**) also syncs its plans with framedecks.com. The **Sync**
chip in the header shows **Synced**, **Syncing**, **Offline** (changes wait and go up later; presenting is not
affected) or **Sync failed** (see Settings → Sync for why). It syncs by itself as soon as the workspace changes. To sync
now, choose **Sync now** in Settings → Sync or in the **Sync** chip's panel. Media is never put
in the cloud. Without a
link, your meeting stays on your PC unless you export it.

## 11. Help
- **framedecks.com/help** starts with a **Step-by-step guide**. It has two tabs, **Website** and **Service PC**, with
  eight steps each: sync your workspace, create a meeting, add Frames, write or upload scripts, transitions and drawing, preview,
  sync, export or import, and run the meeting. Each step has a screenshot zoomed on the place to click (tap it for the
  whole screen). Use the search box to find a step. On the PC, **Settings → Help → Step-by-step guide** opens it in
  your browser. It is also in the command palette.
- **Settings → Diagnostics → Copy diagnostics** collects the information needed for support. It contains no PIN or
  member details.
- **Settings → About** has the story, contact and version.
