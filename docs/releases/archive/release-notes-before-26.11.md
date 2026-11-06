# FrameDecks release notes before 26.11

Internal history: the notes of every release before the version numbers became YY.MM (26.11). Kept for the record;
users see only the current release notes (`docs/releases/`) and the changelog (`docs/CHANGELOG.md`).


## Version 9.13.0

### FrameDecks v9.13.0

The same five chips everywhere: **Prepare**, **Engage**, **Control**, **Notes** and **More** are now in the Studio's
top bar (in place of Live tools), in the Command Center and on the phone remote, with the same names, icons and
colours, and each action in one chip only. Download from **framedecks.com/download**, or let FrameDecks update itself.
It installs over 9.12.1 and earlier and keeps all your meetings, members, settings, notes, pinned Memory Cards and
recordings.

### What's New
- **Chips in the top bar**: the five chips replace the **Live tools** menu. Each opens its panel under it; **Esc** or
  a click elsewhere closes it. Previous, Go Live, Next and Hide all stay in plain view.
- **Chips on the phone remote**: its tabs are now the same five chips, with **Control** first.
- **Notes from the phone**: the phone's **Notes** chip adds a note to this meeting's notes on the PC, stamped with the
  time and the Frame on screen. Reading your notes on the phone is off unless you turn it on (Settings → Controls →
  Phone & iPad Remote → Notes on the phone).
- **Draw opens the Share Window**: in the desktop app, **Engage → Draw** in the top bar opens the Share Window (the
  window you share in Zoom or Teams) to draw on, just as Spotlight does. Choose it again to give the window back.

### Enhancements
- The Command Center, the top bar and the phone remote read one list of chips, so they can no longer drift apart.
- The Control chip reads **Black screen on**, **Emergency on** or **Frozen** while one is on, and Engage turns gold
  while you draw or point, so you never forget one is on.
- The Notes pad is the same on the PC, in the Command Center and on the phone: Copy all, Save as a file and Email to
  me on the PC; add only on the phone.
- On the phone, notes you read hide again after a minute, when you leave the chip or when the phone sleeps. Nothing of
  them is kept on the phone, and the phone can never edit or delete a note.
- A tab saved by an older remote opens the chip it moved to.
- Below 1500 pixels wide, the top-bar chips show their icons only, so the bar still fits.

### Fixes
- **Live tools** no longer offers the same actions as the Command Center under different names.

### Performance Improvements
- The chips are built once from one small file; the notes pad loads only when you open Notes.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 9.12.1

### FrameDecks v9.12.1

The Spotlight now appears only when you ask for it: double-click a word, or press Ctrl twice over it, and the word
lights up, then the light blooms away. Download from **framedecks.com/download**, or let FrameDecks update itself. It
installs over 9.12.0 and earlier and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **Spotlight on demand**: with the Spotlight chosen, **double-click a word** (or press **Ctrl twice** with the mouse
  over it) and it lights up on every screen: the Studio, the Share Window, FrameDecks vCam and the overlay pages.
- **A new way out**: the light draws in a breath, blooms open into light, sends out a last ripple and a few fine
  sparks, and fades.

### Enhancements
- Nothing follows the mouse any more while the Spotlight is chosen, so you can move freely and light the next word
  whenever you like.
- On the Share Window, a double-click or Ctrl twice finds the word under the mouse as the Studio does.

### Fixes
- A single click with the Spotlight no longer lights anything by accident.

### Performance Improvements
- No pointer moves are sent while the Spotlight is chosen: nothing runs until you double-click or press Ctrl twice.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 9.12.0

### FrameDecks v9.12.0

Private notes in the Command Center, a smaller Command Center that can open at the bottom of the screen, and Settings
in six groups instead of sixteen entries. Download from **framedecks.com/download**, or let FrameDecks update itself.
It installs over 9.11.2 and earlier and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **Notes** in the Command Center (**Alt+5**): a small sticky note for the meeting shown. Each note is saved as you
  press Enter, with the time and the Frame on screen. Copy them, save them as a file, or email them to yourself. They
  stay on this PC: never synced, never on screen, never on the phone.
- **Command Center size**: **Compact** gives slim chips in one row and a narrower bar.
- **Command Center place**: open it at the **top**, **centre** or **bottom** of the screen. At the bottom the chips
  sit above the search bar and the panels open upwards.
- **Settings in six groups**: Meeting look, Content, Screens & camera, Controls, Workspace & privacy, Data & help.
  Each group's pages are tabs under its title, and Find a setting still searches them all.

### Enhancements
- Each thing in the Command Center is in one chip only: Draw, Spotlight and Clear drawings in Engage; Studio,
  Teleprompter, Share Window and the camera check in Prepare; the phone remote in More. Alt+L and Alt+D still work in
  Control.
- A group in the Settings menu shows its pages' status dot (for example the camera or the phone remote).

### Fixes
- The Command Center no longer showed the same buttons in two chips.

### Performance Improvements
- The Command Center keeps one window size whatever its size or place: only what is drawn changes, and only by
  position and fade.
- Notes are small files (one per meeting) read only when the Notes chip opens.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 9.11.2

### FrameDecks v9.11.2

A website update: the home page moves with one calm rhythm and comes to life in small, quiet ways, while costing
nothing when you are not looking at it. Download from **framedecks.com/download**, or let FrameDecks update itself.
It installs over 9.11.1 and earlier and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **A living picture at the top**: every few seconds, Next is pressed on the phone, Go Live glows and the room
  screen changes, just as it does in a real meeting.
- **Frame, Deck and Content come together** above **Ready to Serve?** at the end of the page.
- **A gold line follows you** down the How it works stage as you scroll (in browsers that support it).
- In dark mode, **a slow gold light** drifts behind the headline.

### Enhancements
- **One rhythm for everything**: sections and pages now arrive in about a third of a second, rising a short way,
  instead of a slower, longer rise.
- **A soft light follows the pointer** over the questions, the call to download, and the download page's cards.
- **Buttons respond**: the download arrow nudges down and the arrow on Start a free workspace slides on when you point
  at them.

### Fixes
- None in this release.

### Performance Improvements
- Only position and fade move, so the graphics chip does the work, even on an older PC.
- Every loop runs only while it is on screen, and nothing moves when your device asks for less motion or **Reduce
  effects** is on.
- The new touches load just after the page appears, so the first picture is no slower (its styles stay within the
  same 24 KB).

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 9.11.1

### FrameDecks v9.11.1

A website update: when you are already in your workspace, the website takes you straight to Home instead of asking
for your email again, and the home page is a screen shorter, with How it works and See it work now one animated
stage. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over 9.11.0 and earlier
and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **How it works and See it work share one stage** on the home page: the five days play through, then it glides into
  the features and back, by itself. A switch above it picks either part, and the header's **How it works** and
  **See it work** both land on it.

### Enhancements
- **Go to Home**: when you are already in your workspace on this browser, the website's top bar says **Go to Home**,
  and **Open Workspace** goes straight there instead of showing the email form again.
- The steps move on quicker: 3 seconds a day and 3.5 seconds a feature, with shorter changes between them.

### Fixes
- Already in your workspace, Open Workspace no longer showed the email form, as if you were not.

### Performance Improvements
- The changes between the steps move by position and fade only (the blur that cost the processor is gone).
- The home page is about a quarter shorter: about one screen less on a computer, 1.4 on a phone.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 9.11.0

### FrameDecks v9.11.0

FrameDecks now hears about changes the moment they happen instead of asking every few seconds. A press on the
website's Live page reaches the screen right away, every time, and plans edited on the website arrive on the PC
straight away. It also uses far less internet and puts far less load on your workspace: about 85 to 95 percent fewer
requests. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over 9.10.3 and
earlier and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **Live push.** A linked PC is told when a phone sends a command, when the workspace changes and when someone opens
  the Live page. It listens only while it is needed (presenting, in use, or watched) and rests otherwise, checking in
  once a minute.
- **The Command Center's chips fold away** under the search bar behind a small arrow, as the Teleprompter's top bar
  does: point at the arrow to see Prepare, Engage, Control and More, click it to keep them open (remembered), click
  again to fold them. **Alt+1** to **Alt+4** still open a chip at once.
- **The Live page reads only when something changed**, and wakes a resting PC when you open it. Its badge now says
  **Online**, **Waking up…** (usually under a minute) or **Not connected**.

### Enhancements
- **A shorter welcome**: three pages instead of five (Frames, Decks and Content now share one page), and the counter
  matches the bars: Step 1 of 3.
- **A slimmer Up next** in the Studio: one line beside a small picture, so the canvas keeps its room. Warnings still
  show first.
- **Clearer website buttons**: **Open Workspace** for people who already have one, and **Start a free workspace**
  for new people (they were Sync Workspace and Save Workspace). On the PC, **Sync Workspace** keeps its name: it
  connects this PC to your workspace.
- **The website on a phone** keeps the FrameDecks name in its header, and the cookie notice is one slim line at the
  bottom.
- Settings → Workspace Sync shows how this PC gets updates: **Live connection on**, **Resting** or **Regular checks**.
- The workspace owner can switch live push off for everyone with one line in the database, without a new version.

### Fixes
None in this version.

### Performance Improvements
- A PC that is open but not in use asks about 60 times an hour instead of about 420.
- Running a service from a phone uses about 400 to 600 requests an hour instead of about 6,300.
- No new software on the PC: the connection uses Windows' own encryption and proxy settings.
- Folded, the Command Center draws only its bar; unfolding moves by position and fade alone (no frame over 17 ms on a
  simulated older PC).

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Live push needs the workspace's database updated once (migration 0016). Until then everything works as in 9.10.
- On networks that block long-lived connections, FrameDecks goes back to checking every few seconds by itself.


## Version 9.10.3

### FrameDecks v9.10.3

Linking a new PC to your workspace no longer depends on the website answering first: FrameDecks now knows where your
workspace lives by itself, and the website is only the backup. Download from **framedecks.com/download**, or let
FrameDecks update itself. It installs over 9.10.2 and earlier and keeps all your meetings, members, settings, pinned
Memory Cards and recordings. PCs that are already linked carry on exactly as before.

### What's New
None in this version.

### Enhancements
- **Workspace Sync → Connect** finds your workspace straight away, without first asking framedecks.com for its
  address. If framedecks.com cannot be reached, the PC still starts linking; you approve it on the website as before.
- The address and the public key it uses are the same two public values every visitor's browser receives from the
  website. Only the public key can ever be built in: a secret key is refused by the build.

### Fixes
None in this version.

### Performance Improvements
- Linking starts without one round trip to the website.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Approving a new PC still happens on the website (framedecks.com/connect), by design: it keeps an unknown PC from
  joining your workspace.


## Version 9.10.2

### FrameDecks v9.10.2

A smoother Command Center, made for older PCs running beside Zoom, Teams or a browser. It opens without the grey box,
even the very first time, and moving between Prepare, Engage, Control and More stays smooth and light on the
processor, with the same look and the same motion. Download from **framedecks.com/download**, or let FrameDecks update
itself. It installs over 9.10.1 and earlier and keeps all your meetings, members, settings, pinned Memory Cards and
recordings.

### What's New
None in this version.

### Enhancements
- The Command Center is set up when it is first made (see-through, no frame), so it is ready before it ever shows.

### Fixes
- The grey box no longer flashes behind the Command Center the first time it opens after starting FrameDecks.

### Performance Improvements
- Moving between chips no longer resizes the window: the window keeps one see-through size, so nothing is laid out
  again while a panel opens.
- Every animation moves only by position, size and fade, which the computer does cheaply. The blur effects and the
  growing circle that cost the processor on every frame are replaced by gradients and a rise-and-grow with the same
  look.
- Each chip's panel is built once and kept, so choosing it again only swaps it in.
- On a simulated older PC (no graphics card, processor slowed four times) opening a chip now uses about half the
  processor it did, with no frame slower than a thirtieth of a second.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 9.10.1

### FrameDecks v9.10.1

A fix for the new Command Center. On some PCs a light grey box showed behind the search bar and its chips, both when
it opened and when a chip was chosen. Now only the glass bar, the tray and the open panel show, with nothing around
them. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over 9.10.0 and earlier
and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
None in this version.

### Enhancements
None in this version.

### Fixes
- The Command Center no longer shows a light grey box behind its glass. The window behind the page was painted in
  the Windows default grey; it is now painted in the colour Windows treats as see-through.

### Performance Improvements
None in this version.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 9.10.0

### FrameDecks v9.10.0

The Command Center, redesigned. Press **Alt+Space** and a glass search bar with a bright white rim floats on your
screen, with a tray of four chips tucked right under it: **Prepare**, **Engage**, **Control** and **More**. There is
no window around it any more, and it looks the
same every time you open it. Choose a chip and its panel unfolds under it with everything that belongs there. Like the
Teleprompter, only you see it, even when you share your screen. Download from **framedecks.com/download**, or let
FrameDecks update itself. It installs over 9.9.0 and earlier and keeps all your meetings, members, settings, pinned
Memory Cards and recordings.

### What's New
- **Four chips, everything inside them** (also **Alt+1** to **Alt+4**):
  - **Prepare:** Meetings, Teleprompter, Share Window, Studio, Quick Start, Content Library, Import .frame, Camera
    check, and what you chose last;
  - **Engage:** Memory Cards, Capture copies, Draw and Spotlight on the Share Window, Clear drawings, Hide the cards;
  - **Control:** **Go Live** as a switch, and while you are live the meeting remote: Previous / Next Frame, the
    Content one by one, Hide all, Black screen, the Live tools and your meeting app's Mute, Camera and Share;
  - **More:** Workspace Sync, Camera, How people see it, Phone remote, Meeting & Branding, Shortcuts, All settings,
    Help & tour.
- **Go Live as a switch.** On puts the first Frame of the meeting on screen; off takes everything off screen.
- **No window around it.** Only the bar, the tray under it and an open panel show, as glass in the FrameDecks
  colours. The tray hangs from the bar like a drawer, and an open panel continues it.

### Enhancements
- Glossy icons: each one a small jewel of its chip's colour, with a soft top sheen and a glow under it.
- Opening it, the bar springs in and the chips follow one after another. Choosing a chip makes its icon bounce, sends
  a ring of its colour and a ripple from where you clicked, slides a light under it, and grows the panel out of that
  chip as a circle; the buttons then all come into focus together as their icons pop in. With **Reduce motion** on in
  Windows, all of this stays still.
- A small green dot on **Control** while you are live, and on **Engage** while copies are captured.
- A click anywhere outside the glass closes it, as a click on another window does.
- The welcome's Going live page and the user guide show the new Command Center.

### Fixes
None in this version.

### Performance Improvements
- The window draws nothing but its glass shapes, and nothing moves once it has opened.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Without a window frame the glass cannot use the Windows blur, so it is a little more solid than before.


## Version 9.9.0

### FrameDecks v9.9.0

Everything in FrameDecks starts here. Press **Alt+Space** anywhere and the new **Command Center** opens (it was
called Spotlight): one bar that finds and runs anything, five modules for the things you reach for most, and what you
used last. While you are live it is your meeting remote, and only you see it, even when you share your screen. The
phone and tablet remote now has the same look. Download from **framedecks.com/download**, or let FrameDecks update
itself. It installs over 9.8.1 and earlier and keeps all your meetings, members, settings, pinned Memory Cards and
recordings.

### What's New
- **The Command Center.** Dark glass with a floating search bar, and under it:
  - a row that shows whether you are on air, the meeting this PC shows, Workspace Sync, and *Only you can see this*;
  - five modules, also on **Alt+1** to **Alt+5**: **Meetings**, **Memory Cards**, **Present**, **Camera** and **More**.
    Each one narrows the bar to what it holds; **Backspace** or **Esc** goes back to everything;
  - **Recent**: what you chose last, one click away.
- **Meetings in the search.** Your meetings appear in the bar; choosing one shows it on this PC.
- **Memory Cards from the Command Center.** Turn **Capture copies** on or off, and show or hide any card with Enter.
- **Narrow the search with a sign:** **>** commands, **#** meetings and Frames, **@** people, **?** Ask AI.
- **Ask AI** (**Tab**): drafts discussion questions from the selected Frame's scriptures with a free AI on this PC
  (Ollama), when it is installed. You check them before they are added; nothing leaves the PC.
- **The phone remote in the same look:** a floating top bar, glass cards, the tabs as a floating dock, and each tool's
  icon in a square of its own colour.

### Enhancements
- While a Frame is live, the Command Center shows the meeting remote in the same glass style.
- The tray menu's **Search** is now **Command Center**, and so is its shortcut in **Settings → General → Window and
  tray**.
- The welcome's Going live page introduces the Command Center.
- The user guide shows the Command Center and its live remote.

### Fixes
- The search icon in the command palette and the Command Center was missing; it shows again.

### Performance Improvements
- The Command Center draws no blur of its own: the frosted glass comes from Windows, so it costs FrameDecks nothing.
  The phone remote's new look uses no blur and nothing that loops, so the phone stays cool.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Ask AI needs Ollama installed on this PC; without it, the Command Center says so and nothing else changes.


## Version 9.8.1

### FrameDecks v9.8.1

Spotlight stays out of the way. After installing, opening or reopening FrameDecks, the Spotlight search no longer
appears by itself: it opens only when you press its shortcut (Alt+Space) or choose Search in the tray. This version
also brings clearer legal pages, a Security page that lists every protocol FrameDecks uses, and fresh Help pictures
for the new Sync Workspace page. Download from **framedecks.com/download**, or let FrameDecks update itself. It
installs over 9.8.0 and earlier and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **Security, in the open.** The Security page on framedecks.com now lists the protocols and controls in one table:
  - HTTPS (TLS 1.2 or later) with HSTS on every page;
  - the one-time link (OAuth 2.0 with PKCE, single use, 10 minutes) and short-lived signed sessions;
  - Trusted Device tokens (256-bit, kept in the cloud only as a SHA-256 hash, 180 days);
  - row-level security, AES-256 encryption at rest and encrypted, integrity-checked backups;
  - how linked PCs, the phone remote and updates are protected, and the limits we know of.

### Enhancements
- The Privacy, Terms, Cookies and Vulnerability Disclosure pages use the new words: your workspace, the one-time
  link, Trusted Devices and Manage Devices. What you agreed to is unchanged.
- The Cookies page lists the new storage used by Trust This Device.
- Help: the first website step shows the Sync Workspace page.

### Fixes
- The Spotlight search no longer opens with the program after installing or when reopening it. It is now made only
  the first time you ask for it, and hides itself again if Windows tries to show it.

### Performance Improvements
- The program starts with one window fewer: Spotlight is created only when you first open it.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Links are emailed, so the first time on a new device needs your inbox. After that, a Trusted Device opens by itself.


## Version 9.8.0

### FrameDecks v9.8.0

Your workspace, with nothing to remember. The FrameDecks website has no sign-in pages any more. Choose **Sync
Workspace**, **Save Workspace** or **Continue on Another Device**, enter your email, and open the one-time link we
send. Then choose **Trust This Device**, and your workspace opens there by itself for 180 days. **Manage Devices**
shows every Trusted Device and removes one at once. On the PC, the section for linking to your workspace is now called
**Workspace Sync** and works as before. Download from **framedecks.com/download**, or let FrameDecks update itself. It
installs over 9.7.0 and earlier and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **Sync Workspace, Save Workspace, Continue on Another Device.** One short form on framedecks.com: your email, then
  a one-time link that works once, for 10 minutes. No passwords, and no Google or Microsoft buttons.
- **Your workspace, straight away.** After the link, your workspace opens. If you have none yet and nobody invited
  you, FrameDecks makes one for you called *My Workspace*, and you can rename it any time.
- **Trust This Device.** After the link, choose **Trust This Device** and your workspace opens on this device with no
  new link for 180 days. **Just this visit** keeps it open only in this tab.
- **Manage Devices.** A new page under Settings:
  - your Trusted Devices, with when each was trusted and last used;
  - **Remove**, which ends a device's access at once;
  - recent activity: links asked for, links opened, devices trusted and removed;
  - **Continue on Another Device**, with the address to open on your phone or another computer.

### Enhancements
- On the PC, **Settings → FrameDecks account** is now **Settings → Workspace Sync**. Connect to FrameDecks, syncing
  and the remote from the website work exactly as before.
- The welcome's Finish page offers **Sync Workspace**.
- The button next to your name on the website reads **Disconnect this device**. On a Trusted Device it also removes
  that device from your Trusted Devices.
- Workspace owners and admins see Trusted Devices being added or removed, and workspace syncs, in the workspace's
  activity log.

### Fixes
None in this version.

### Performance Improvements
- A Trusted Device checks itself once when it opens and at most once a minute after that, with one small request.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Links are emailed, so the first time on a new device needs your inbox. After that, a Trusted Device opens by itself.


## Version 9.7.0

### FrameDecks v9.7.0

Draw and point on what your meeting sees. In Spotlight (Alt+Space), choose **Draw** or **Spotlight** and the Share
Window you share in Zoom or Teams comes to the front, ready for your mouse. Spotlight now shows its remote only while
you are live, with arrows for each question, verse or slide. The phone remote gives Previous and Next the room when
held upright. FrameDecks opens maximized, and the welcome shows how to run a meeting. Download from
**framedecks.com/download**, or let FrameDecks update itself. It installs over 9.6.0 and earlier and keeps all your
meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **Draw and Spotlight on the Share Window.** In Spotlight, choose **Draw** or **Spotlight**, or type *draw* or
  *spotlight*. The Share Window comes to the front and Spotlight closes.
  - **Draw:** drag with the mouse. Keys **1**–**5** choose pen, highlighter, arrow, box or circle, and **G**, **R** and
    **W** choose the colour.
  - **Spotlight:** the spotlight follows your mouse on every screen. A click circles that spot.
  - **Undo**, **Clear** and **Done** appear near the top of the window. **Esc** finishes.

  Everyone sees the drawings and the spotlight: in the meeting, on FrameDecks vCam, on the overlay pages and on the
  phone remote.
- **The Content, one by one, in Spotlight.** While you are live, Spotlight has the phone remote's arrows for the live
  Frame's questions, scriptures or slides (Alt+↑ / Alt+↓).
- **Going live, in the welcome.** A new page before Finish shows Spotlight (Alt+Space), the Content arrows, and Draw
  and Spotlight on the Share Window.

### Enhancements
- **Spotlight only when you ask.** It opens only with its shortcut or the tray's **Search**, never when FrameDecks
  starts, after an install or when you open it again.
- **The remote only while you are live.** When nothing is live, Spotlight is just the search field.
- **Maximized from the start.** The main window opens maximized after an install and at every start. Bringing it back
  from the tray keeps it maximized.
- **The phone remote, upright and sideways.**
  - Upright, the live picture steps aside, so Previous, Next and the Content have the room. A small **On screen**
    badge stays.
  - Sideways, the picture is there as before.
  - **Spotlight** fills the whole screen, with **Done** to come back.

### Fixes
- Bringing FrameDecks back from the tray no longer un-maximizes the window.

### Performance Improvements
- Held upright, the phone remote no longer loads the live picture. It loads it only sideways or while Spotlight is
  on.
- The Share Window sends each stroke to the other screens about ten times a second while you draw, and nothing while
  the mouse rests.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- While you draw, the Share Window's **Undo**, **Clear** and **Done** buttons can be seen in the meeting when you move
  the mouse near the top. Use the keys (Ctrl+Z, Delete, Esc) to keep them hidden.


## Version 9.6.0

### FrameDecks v9.6.0

Spotlight becomes a meeting remote. Press **Alt+Space** anywhere, even while FrameDecks sits in the tray, and a calm,
compact panel lets you move through your Frames and slides, play a video, hide everything or go black, and mute,
switch the camera, share or leave in Zoom, Microsoft Teams or Google Meet. Only you see it, even when you share your
whole screen. The website now takes its colours from the program, so both look the same. Download from
**framedecks.com/download**, or let FrameDecks update itself. It installs over 9.5.1 and earlier and keeps all your
meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **Spotlight as a meeting remote.** Spotlight now opens as a compact remote:
  - **On screen:** Live, Off air, Black screen or Frozen, the Frame number and what comes next.
  - **FrameDecks:** Previous and **Next Frame** (**Start** when nothing is live), slide back and forward for a
    PowerPoint or PDF, **Play / Pause** for a video, **Hide all** and **Black**.
  - **Meeting:** **Mute**, **Camera**, **Share screen** and **Leave** (press twice) in Zoom, Teams or Google Meet,
    whichever has a meeting open, and the PC's volume.
  - **Open:** the Studio, the Teleprompter, the Share Window and the phone remote.

  Each has a key while Spotlight is open: Alt+← / Alt+→ for Frames, Alt+↑ / Alt+↓ for slides, Alt+P, Alt+H, Alt+B,
  Alt+M, Alt+V, Alt+S, and Alt+- / Alt+= for the volume.
- **Search only when you type.** Type and the results appear, and the window grows to show them. Clear the search and
  the compact remote comes back.
- **Only you see Spotlight.** Like the Teleprompter, it is left out of screen sharing and recordings, even when you
  share the whole screen.

### Enhancements
- Spotlight and the phone and tablet remote share one button style: soft raised buttons, each icon in a tinted
  circle, and Next as the one gold action.
- On Windows, Spotlight uses Windows' own frosted glass when it is there, and a solid panel otherwise.
- The website uses the program's colours, corners and type sizes, in dark and light. When the program's look changes,
  the website follows with one command.
- The website's Plan shows its Frame cards in the Frame colour, like the Studio.
- The website's picture of the Studio is a fresh capture of this version.
- A **Studio** command in Spotlight and the command palette brings the main window back.

### Fixes
None in this version.

### Performance Improvements
- Spotlight draws no blur itself. Windows draws the glass behind the window, so it costs FrameDecks nothing, and the
  window is only as tall as the remote until you type.
- Spotlight asks what is happening only while it is open and in front, every few seconds, and nothing while hidden.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- The meeting buttons press each app's own keyboard shortcut. Google Meet has no shortcut for sharing or leaving, so
  those two are off for Meet. Zoom asks to confirm when you leave.
- If an app changes its shortcuts, its button may stop working until FrameDecks is updated.


## Version 9.5.1

### FrameDecks v9.5.1

A speed update for older and lighter PCs. FrameDecks draws its windows without the graphics card by default, so
that Windows, Zoom and Teams stay smooth. On such PCs the new welcome screen could stutter. It now runs smoothly and
looks the same, and the Spotlight that follows your pointer costs the camera far less. Download from
**framedecks.com/download**, or let FrameDecks update itself. It installs over 9.5.0 and earlier and keeps everything.

### What's New
None in this version.

### Enhancements
- The welcome screen keeps its soft coloured light, its gliding pages and its moving pictures, drawn in a way that
  needs far less work.

### Fixes
- The welcome screen stuttered (about 7 frames a second) on PCs drawing without the graphics card. It now runs at a
  steady 60.

### Performance Improvements
- **Welcome screen:** smooth page changes at 60 frames a second. Left open, it now needs about a sixth of the work it
  did, because its pictures play a few times and then rest.
- **Behind the welcome:** while the welcome covers the window, the window behind it (with its live previews) is no
  longer drawn.
- **Following Spotlight:** the soft circle that follows your mouse or finger on FrameDecks vCam is five times quicker
  to draw: about 2 ms a frame instead of 11.
- A new check measures the app on a slowed-down PC without its graphics card, so later changes cannot quietly make it
  slower.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 9.5.0

### FrameDecks v9.5.0

A warmer first start and a FrameDecks for every kind of gathering. The first time FrameDecks opens on a PC, a
full-screen welcome shows how a meeting is built, in four short pages. Scripture now comes in the KJV and the World
English Bible as well as the ESV, with no key needed, and new Frames use neutral words that suit a Bible study, a
church service or any gathering. Download from **framedecks.com/download**, or let FrameDecks update itself. It
installs over 9.4.0 and earlier and keeps all your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **Welcome to FrameDecks.** The first time FrameDecks opens on a PC, a full-screen welcome walks through four pages:
  - **Adding Frames:** a Frame is one moment on screen.
  - **Adding Decks:** a Deck is one block on a Frame.
  - **Adding Content:** each question or verse in a Deck.
  - **Finish.**

  Each page has a picture of the Studio that builds itself, and the pages glide from one to the next. On Finish you
  can start with a ready-made meeting, or bring in data from an earlier version when FrameDecks finds some.

  The Finish page also offers **Sign in and connect**, so you can plan on framedecks.com with your team and have
  every plan sync to this PC. It uses the same linking as Settings → FrameDecks account.

  It appears once on each PC: after a new install, an update or a reinstall, until you choose **Finish** or **Skip**.
  It never appears on the phone remote. To see it again, open **Settings → About → Welcome tour**.

  It replaces the "Welcome to FrameDecks / Start fresh" box and the Setup guide that opened by itself. The Setup guide
  is still in **Settings → About**.
- **KJV and World English Bible.** In a Scripture Deck, **Fetch from** now offers the KJV and the World English
  Bible beside the ESV. Both are public domain, so they need no key. Like the ESV, every passage is saved on the PC
  for offline use.

  In the Meeting Workbook, write *KJV* or *WEB* after a reference and the import fills in the text.
- **Church Service** joins the ready-made meetings in Quick Start: a countdown, welcome, announcements, the reading,
  the message, a blessing and a thank-you.

### Enhancements
- **A colour for each level.** Frames are gold, Decks blue and Content violet, in soft see-through tints like the
  welcome, in the Studio (dark and light) and on the phone remote's Plan. Green still means "on screen now".
- The Decks list's button now reads **+ Deck**, so the Studio, the Meeting Workbook and the welcome all say Frame ›
  Deck › Content.
- New question and scripture cards are labelled **Question** and **Scripture**. Your saved Frames keep their own
  labels.
- Sample questions and closing slides no longer assume a weekly meeting.
- The example roles in Members are Leader and Host.
- The AI drafts questions for any meeting around a passage, not only a church small group.
- Leftover mentions of the program's earlier names were removed from the guides.

### Fixes
- In the Studio's Frames list, screen readers now read the meeting groups correctly.

### Performance Improvements
- The welcome's pictures are drawn by the page itself, with no images to download. They move only while the welcome
  is open, and not at all when Windows asks for reduced motion.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Fetching the KJV or the World English Bible needs internet the first time. The free service allows about 15
  passages in 30 seconds, so a very large Meeting Workbook import may ask you to wait a moment and try again.


## Version 9.4.0

### FrameDecks v9.4.0

Run the whole meeting from your phone. The remote has been redesigned around the live picture: point at it with the
Spotlight, step through every Frame, Deck and question, play videos and switch meetings, upright or sideways. On the
PC, the Spotlight now follows your mouse, and the Meeting Workbook plans a meeting the same way the app does. Download
from **framedecks.com/download**, or let FrameDecks update itself. It installs over 9.3.0 and earlier and keeps all
your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **A new phone and tablet remote.** The live picture, what is on screen and **Previous / Next** stay in view, with
  five tabs under them:
  - **Show**: the Frame on screen, with its questions, scriptures or slides, its videos, and every Deck with an eye.
  - **Plan**: the whole meeting, numbered 1 · 1.1 · 1.1.1. Tap any Frame, Deck or question to show it.
  - **Tools**: Draw, Spotlight, Teleprompter, Freeze, Black screen and Clear drawings.
  - **Memory**: Capture Memory.
  - **Meeting**: the meeting's details, Switch meeting, what the PC is doing, and Disconnect.

  Hold the phone upright and the tabs sit at the bottom. Turn it sideways, or use a tablet, and the picture sits on
  the left with the tabs on the right.
- **Spotlight from the phone.** Tap **Spotlight** on the live picture, then drag a finger: the spotlight follows it
  on every screen. Tap once for a quick circle.
- **The Spotlight follows the mouse on the PC.** With the Spotlight tool chosen, move the pointer over the picture and
  the spotlight moves with it, live, on FrameDecks vCam and the overlay pages. It fades away when the pointer leaves
  the picture. Click a word to circle it, as before.
- **Video controls on the remote.** Play, pause or restart a video that is in the picture.
- **The Meeting plan in the Meeting Workbook.** The Meeting Form's plan is now one table in the app's own order,
  Frame > Deck > Content:
  - Choose a Level from the list. The No. column numbers itself: Frame 1, Decks 1.1 and 1.2, Contents 1.1.1 and
    1.1.2.
  - A Frame can have several Decks, and a Deck several questions or verses.
  - The Dashboard tab is unchanged in purpose: it counts Frames, Decks, questions and scriptures, and its readiness
    list now also checks that every Deck has a Type.
- **Import from Excel in Quick Start**, under *Import from a file*, as well as in Settings.

### Enhancements
- The remote's **Next** button shows the name of the Frame it will put on screen.
- The remote shows a chip when the screen is black or frozen, or has drawings on it.
- The remote remembers the tab you used last.
- Its buttons pause while the PC can't be reached.
- Upright or sideways, the remote uses the whole screen and never scrolls behind its own buttons.
- Hand-made Meeting Forms still import. When the Level column is empty, it is worked out from the numbering.

### Fixes
- With the Spotlight tool chosen, the pointer no longer froze over the picture.
- In the Studio, screen readers now read the meeting groups in the Frames list correctly.

### Performance Improvements
- The spotlight moves on the phone and the PC send only their newest position, one at a time, so a slow network
  never queues up old movements.
- Screens only check where the spotlight is while it is on.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- On iPhone, Safari does not allow vibration, so remote presses are confirmed by a message only.
- On the phone, the **Paste** button needs the installed web app or https; otherwise long-press the box and choose
  **Paste**.


## Version 9.3.0

### FrameDecks v9.3.0

A security and reliability release that completes the November 2026 review. On screen, little changes: private chat
messages stay off the phone, and the team owner can hand a team to someone else. Download from
**framedecks.com/download**, or let FrameDecks update itself. It installs over 9.2.0 and earlier and keeps all your
meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **Make owner.** On the website, a team's owner can hand the team to another member (Members → **Make owner**). The
  old owner stays in the team as an admin. Before you delete your account, use it to pass on a team you share.

### Enhancements
- **Private messages stay on the PC.** A private chat message in Capture Memory (for example a Zoom message sent to
  you privately) shows on the phone remote as "Private message. Read it on the PC." Its sender and actions are still
  there. Once you put it on screen, the phone shows its text like everyone else sees it.
- **The camera driver now lives in a protected folder.** FrameDecks vCam is installed in Program Files, where only an
  administrator can change it. Windows asks for permission only when the camera itself changed in an update, not
  with every update.
- **Linking a PC is harder to block.** One network can ask for only a few link codes at a time, so nobody can stop
  other churches linking their PCs.
- **The link page names your PC as FrameDecks knows it**, not as the link says.
- **Edits are never lost in sync.** When a setting or list item was changed on two computers, the version that was
  replaced is now also kept on the PC.
- **Deleting your account removes your name** from remote commands and records you changed.
- FrameDecks' own pages and the website now carry a security policy that tells the browser what they may load. It
  only reports for now, so nothing can stop working.
- PowerPoint files you add are turned into slides with their macros switched off.
- Database backups are checked for changes before they are restored.

### Fixes
- A change from the tray (such as Hide all) can no longer be overwritten by a phone pressing Next at the same moment.
- A badly formed request to the PC now gets a clear answer instead of a dropped connection.
- A very long word with no spaces no longer slows down a card on the camera.
- An Excel file that claims to be enormous opens quickly, and a file far larger than any Frame file is refused before
  it is read.

### Performance Improvements
- With several screens open (Studio, phone remote, Teleprompter), each change is prepared once for all of them instead
  of once per screen, and no screen waits for another while it is sent.
- FrameDecks vCam no longer makes a new copy of the picture for every frame, which gives the PC less work during a
  meeting.
- A linked PC with nothing waiting no longer writes to the cloud every 15 seconds.
- The website loads the About page's styles only when you open it.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- On the phone, the **Paste** button needs the installed web app or https; otherwise long-press the box and choose
  **Paste**.


## Version 9.2.0

### FrameDecks v9.2.0

A security release for updates. Nothing on screen changes. Download from **framedecks.com/download**, or let
FrameDecks update itself. It installs over 9.1.2 and earlier and keeps all your meetings, members, settings, pinned
Memory Cards and recordings.

### What's New
- No new features in this release. FrameDecks is ready to check a digital signature on every update notice; that
  check is switched on in a later release.

### Enhancements
- **Update now** only ever installs a newer version; going back stays a separate, deliberate choice (**Reinstall the
  previous version**).
- Downloads follow redirects only to FrameDecks' own servers.
- When releases are code-signed, the signature must name exactly FrameDecks' publisher.

### Fixes
- The installed app always asks FrameDecks' own update service, even if a testing setting on the PC points elsewhere.

### Performance Improvements
- None in this release.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- On the phone, the **Paste** button needs the installed web app or https; otherwise long-press the box and choose
  **Paste**.


## Version 9.1.2

### FrameDecks v9.1.2

A security and reliability update. Nothing on screen changes. Download from **framedecks.com/download**, or let
FrameDecks update itself. It installs over 9.1.1 and earlier and keeps all your meetings, members, settings, pinned
Memory Cards and recordings.

### What's New
- No new features in this release.

### Enhancements
- Camera chat bubbles now show **WhatsApp**, **Messages** or **Phone** as the app, as the overlay pages already did.

### Fixes
- **Media file names.** A picture, video or PDF in a plan is now always just a file name in your Content folder.
  A plan arriving from the phone remote, a linked PC or an imported file can no longer point FrameDecks at a file
  elsewhere on your PC, or make Windows connect to another computer.
- **Phone remote PIN.** Wrong PINs sent all at once can no longer get past the lockout. After every five wrong PINs
  the wait doubles (up to an hour) until the right PIN is entered, and many wrong PINs from different devices slow
  everyone down.
- **Wi-Fi devices.** A device on the network that has not entered the PIN can send only small requests and hold only
  a few connections, and idle connections are closed, so one misbehaving device cannot slow FrameDecks down.
- **Settings files.** Settings, Studio scenes and the remote's sign-ins are saved so that a power cut or a full disk
  cannot leave them empty or half written.
- **Copied chats.** Copying a message with very long runs of spaces could keep FrameDecks busy for seconds; it is now
  read at once.
- **Imported plans.** A Frame or item id with quotes or brackets in an imported file no longer breaks selecting or
  renaming it.

### Performance Improvements
- Copied chat text is read up to a thousand times faster on unusual input.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- After 20 wrong PINs from one device it waits 8 minutes, and the wait keeps doubling (up to an hour) until the
  right PIN is entered. Check the PIN in **Settings → Phone & iPad Remote**.
- On the phone, the **Paste** button needs the installed web app or https; otherwise long-press the box and choose
  **Paste**.


## Version 9.1.1

### FrameDecks v9.1.1

Capture Memory now works on the phone remote. Download from **framedecks.com/download**, or let FrameDecks update
itself. It installs over 9.1.0 and earlier and keeps all your meetings, members, settings, pinned Memory Cards and
recordings.

### What's New
- No new features in this release.

### Enhancements
- A test now checks that the phone remote may load every file its page uses.

### Fixes
- **Capture Memory on the phone remote did nothing.** The PC refused to send the phone the part of the remote that
  runs Capture Memory, so pasting a WhatsApp, Teams, Zoom or Messages message and tapping **Show on screen** had no
  effect, and the list of cards stayed empty. It only worked on the PC itself. The phone now gets it after signing in
  with the PIN, and a pasted message is on the live screen as a chat bubble at once.

### Performance Improvements
- None in this release.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- If the phone still shows the remote from before the update, reload the page (or close and reopen the remote from
  the home screen).
- On the phone, the **Paste** button needs the installed web app or https; otherwise long-press the box and choose
  **Paste**.


## Version 9.1.0

### FrameDecks v9.1.0

Capture Memory as chat bubbles, from your PC and your phone. The virtual camera is now called **FrameDecks vCam**.
Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over 9.0.0 and earlier and
keeps all your meetings, members, settings, pinned Memory Cards and recordings.

### What's New
- **Only chat bubbles on screen.** When you click **Show**, the Memory Card appears on FrameDecks vCam as a chat
  bubble on top of your video: the sender's initials on their own colour, their name, the app it came from and the
  message. There is no chat window, title bar or panel around the bubbles any more, and your video is never resized:
  only the other overlays (question and scripture cards, lower thirds, branding) become smaller and move aside while
  bubbles are beside or below. Each bubble pops open from its avatar; one that leaves
  fades away and the others glide into place.
- **Several chats at once.** Copy as many messages as you like: each keeps its sender's name and its message. Copying
  a whole conversation (WhatsApp, Teams, Slack, Discord or Zoom chat) makes one card per message. Tick several cards
  and click **Show selected**: they appear together as separate bubbles, in the order they were copied.
- **Capture Memory on the phone remote.** A new **Capture Memory** section on the phone remote: copy a message in
  WhatsApp, Teams, Zoom, Messages or any app on your phone, paste it and tap **Show on screen**. It is on the live
  screen at once. The phone lists every Memory Card with **Show**, **Hide** and **Remove**, and can show several
  selected cards together.
- **FrameDecks vCam.** The virtual camera is called **FrameDecks vCam** in Zoom, Microsoft Teams, Google Meet, OBS
  and every other app's camera list, and everywhere in FrameDecks, the installer, the website and the guides.

### Enhancements
- Floating bubbles (*Over the picture*) keep clear of the question, scripture and birthday cards, lower thirds,
  branding and the camera inset: they move up or down their edge, or to the other edge.
- Up to six bubbles on screen at once (pinned ones first, then the newest).
- The Studio pane is called **Capture Memory**; *Hide all bubbles* takes every bubble off screen.

### Fixes
- A card shown again no longer jumps to the bottom of the chat: bubbles keep the order they were copied in.

### Performance Improvements
- Each bubble is drawn once when it changes; the pop and the glide only move or scale the finished picture, so the
  camera keeps its frame rate with six bubbles on screen.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- After updating, close and reopen Zoom, Teams or OBS once to see the new camera name. The camera keeps its ID, so
  meeting apps keep it selected.
- The Windows **Camera** app lists only Windows' own camera type; FrameDecks vCam appears in meeting apps, browsers
  (Google Meet) and OBS.
- On the phone, the **Paste** button needs the installed web app or https; otherwise long-press the box and choose
  **Paste**.
- Capturing copies on the PC is Windows only. Elsewhere, type a note in the Capture Memory pane or paste on the phone.


## Version 9.0.0

### FrameDecks v9.0.0

Memory Cards: what you copy from a chat or an assistant goes straight into the chat overlay on your FrameRelay camera.
The Audience Dock is gone. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over
8.9.0 and earlier and keeps all your meetings, members, settings and recordings.

### What's New
- **Memory Cards.** Turn on **Capture**, select text in Teams, Zoom, Google Meet, Webex, Slack, Discord, ChatGPT,
  Claude, Copilot or a browser, and press **Ctrl+C**. A Memory Card (a title and the text) appears in the chat
  overlay on FrameRelay, in the same chat window design as before. A new card arrives with typing dots, then its text.
- **Show and Pin.** A small card appears in the corner of your screen with **Show** and **Pin**. It never takes the
  keyboard from your meeting and screen sharing leaves it out. **Show** puts a card in the chat overlay with its full
  text. **Pin** keeps it there, and pinned cards are still there after a restart. Unpinned cards leave after 12
  seconds (you choose how long).
- **Beside the video.** By default the whole picture shrinks to the left and the chat overlay takes a column on the
  right, so it never covers you, the question and scripture cards, drawings or the camera inset. Or choose **Below
  the video** (the cards along the bottom) or **Over the picture** (a window at the edge, clear of the camera inset).
  Everything is sized from the camera's resolution, in Teams, Zoom, Google Meet, Webex, Discord, OBS and any app that
  uses the FrameRelay camera.
- **Memory Cards in the Studio.** A **Memory Cards** pane under Decks lists the cards with Show, Pin, Hide and
  Delete, takes typed notes and holds the settings. Folded, it is one line with the Capture switch. Live tools →
  **Capture copies**, the tray and the command palette turn Capture on and off.

### Enhancements
- Several cards at once in the chat overlay (up to four: pinned ones first, then the newest).
- The Studio preview shows the chat overlay where FrameRelay puts it.

### Fixes
- **Crash: Illegal Instruction (0xC000001D) while dragging.** The Audience Dock and its handle are removed, with the
  window-style changes they made many times a second while being dragged. Turning Capture off and on again could
  also leave Windows calling a released part of FrameDecks; capture now keeps one handler for the program's life.

### Performance Improvements
- The chat overlay is drawn once per change of cards and blended into the FrameRelay picture; no window polls the
  keyboard or the pointer any more.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Capturing copies is Windows only. Elsewhere, type a note in the Memory Cards pane.
- The OBS / browser overlay pages float the chat overlay over the picture: they cannot shrink the video under them.
- The card's title is who wrote it when the copied text says so, otherwise its first words.


## Version 8.9.0

### FrameDecks v8.9.0

See what Next will put on screen before you press it, and an Audience Dock that is easier to run from the keyboard.
Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over 8.8.1 and earlier and
keeps all your meetings, members, settings and recordings.

### What's New
- **Up next (Safe Next).** Under the Studio Canvas, a strip shows the Frame **Next** will put on screen: a small live
  picture of it, its name, its place in the meeting, its transition, and in plain words what appears (the question,
  the scripture, text, pictures, video, audio). It warns you before you press Next when:
  - the next Frame shows nothing,
  - the black screen or the emergency screen is still on,
  - a picture, video or PowerPoint in it has no file chosen yet.

  **Hide preview** keeps just the line; FrameDecks remembers your choice. The **Next** button's tooltip names the
  next Frame too.
- **Audience Dock: Waiting and Shown.** Messages you show move from **Waiting** to **Shown**, so the queue holds only
  what is still to come and you can show an earlier message again.
- **Audience Dock: keys.** With the dock usable (📌 on the handle): **↑ ↓** choose a card, **Enter** shows it, **P**
  pins it, **H** hides what is on screen, **Del** deletes the chosen card, **N** goes to the question box, **Esc**
  hides.

### Enhancements
- The chat window on the FrameRelay camera keeps clear of the camera inset: a large inset in a corner moves it up,
  and with the camera beside the screen it moves to the other edge.

### Fixes
- No separate fixes in this version.

### Performance Improvements
- The Up next picture is only drawn while it is shown and the FrameDecks window is visible.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Up next follows the Studio's order (the meeting this PC shows). When a Frame moves on by itself (Auto-advance), the
  strip updates as soon as the new Frame is live.


## Version 8.8.1

### FrameDecks v8.8.1

A fix for the Audience Dock. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs
over 8.8.0 and earlier and keeps all your meetings, members, settings and recordings.

### What's New
- No new features in this version.

### Enhancements
- If the Audience Dock is already open, choosing **Audience Dock** again brings it back onto the main screen, above
  other windows.

### Fixes
- **The Audience Dock did not appear.** On a display scaled above 100% (125% or 150%, the usual setting on laptops),
  the dock and its handle opened past the right edge of the screen, and stayed there each time they were opened. They
  now open at the right of the main screen, sized for the display, and a saved place that is off every screen is
  ignored.
- With the handle's **📌** on, you can now type in a card's name and message. Before, the dock could still not take
  the keyboard.

### Performance Improvements
- No changes in this version.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Clipboard capture, click-through and Ctrl+Shift are Windows only. In a browser the dock opens as a pop-up and takes
  typed questions.
- Exclusive full-screen apps may cover the dock.


## Version 8.8.0

### FrameDecks v8.8.0

The Audience Dock: put a viewer's chat message on screen with Ctrl+C. Download from **framedecks.com/download**, or let
FrameDecks update itself. It installs over 8.7.0 and earlier and keeps all your meetings, members, settings and
recordings.

### What's New
- **Audience Dock.** Live tools → **Audience Dock** (also in the tray and the command palette) opens a narrow window that
  floats above Zoom, Teams or a browser chat. Clicks pass through it to the chat underneath, it never takes the
  keyboard from your meeting, and it is left out of screen sharing and recordings.
- **Capture with Ctrl+C.** Turn on **Capture**, select a message in any chat (Zoom, Teams, YouTube, Twitch, Facebook
  Live, Discord or anything else) and press **Ctrl+C**. The message becomes a card in the dock with
  *✓ Audience Question Captured*: no pasting. FrameDecks fills in the sender when the copied text says who wrote it
  (Zoom's *From Sarah to Everyone*, a name line above the message, or *Sarah: message*) and marks the app it came from.
  Empty copies and repeats are ignored.
- **A live chat window on screen.** The message appears as its own chat window, not like the question cards: a
  title bar with a pulsing live dot, *Live chat* and the app it came from, and a chat bubble with the sender's initials
  in a coloured circle, their name and the message. It opens like a real chat: the window unfolds from the edge, typing
  dots appear, then the message unrolls. It sits on a **chat rail at the right edge** (or the left), a little above
  the middle of the picture, so it stays clear of the question, scripture and lower-third cards at the bottom, the
  birthday card at the top, Branding badges in the corners and a camera inset in a bottom corner.
- **Opens when you copy.** A message copied from a chat app goes on screen at once (**Show as soon as it's copied**, on
  by default). Private messages and copies from other programs wait for **Show**.
- **Show, Pin, Hide.** **Show** puts a card on the FrameRelay camera for 12 seconds with a thin countdown line along
  the window's foot; **Pin** keeps it until you hide it; **Hide** (or **Esc**) slides it away. A new message replaces
  the one on screen. *Currently live* in the dock shows what is on screen. Sender and message can be edited before or
  while shown.
- **Ctrl+Shift to use the dock.** Hold **Ctrl+Shift** and the dock becomes fully visible and clickable; let go and clicks
  pass through again. The small handle on the dock's top edge is always clickable: move, resize, **📌** keep the dock
  usable (to type in a card), **⚙** settings and **✕** close.

### Enhancements
- The dock is 85% visible, and fades to 20% while the pointer is over it so the chat beneath stays readable. It
  remembers where it was and its size.
- Settings in the dock: seconds on screen (3–120, default 12), **Show as soon as it's copied**, **Place on screen**
  (right or left edge; the window on screen moves at once) and **Also show on Share Window** (off: the chat window is
  on FrameRelay only; on: also on the Share Window and the overlay pages). The Studio's preview always shows it.
- Hide all (**Esc** in the Studio, the tray's Hide all overlays) hides the audience card too.
- You can also type a question into the dock.

### Fixes
- No separate fixes in this version.

### Performance Improvements
- The clipboard is watched only while Capture is on, with Windows' own clipboard notice: no polling, no keyboard hook.
- The dock checks the keys and the pointer about 30 times a second while the pointer is near it and 10 times a second
  otherwise, only while the dock is open.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Clipboard capture, click-through and Ctrl+Shift are Windows only. In a browser the dock opens as a pop-up and takes
  typed questions.
- The sender's name is found only when the copied text includes it; otherwise the card says *Audience* and the name can
  be typed in.
- Copies that password managers mark as private are never captured. Zoom's private messages are marked **Private** and
  need a second click to show.
- Exclusive full-screen apps may cover the dock.


## Version 8.7.0

### FrameDecks v8.7.0

A new look for the Spotlight: press Ctrl twice and a soft, see-through circle lands where you point. Download from
**framedecks.com/download**, or let FrameDecks update itself. It installs over 8.6.0 and earlier and keeps all your
meetings, members, settings and recordings.

### What's New
- **Soft disc Spotlight.** Press **Ctrl** twice over the Studio Canvas (or use the Spotlight tool in Annotate) and a
  bigger, see-through white disc lands on the word with a ripple, breathes gently while it stays, then closes softly.
  Everyone sees it: on FrameRelay in Zoom or Teams, in recordings and on the overlay pages.
- **Spotlight settings.** Choose **Soft disc** or **Gold ring** (the glowing gold circle with sparks of 8.2), the
  colour, the size, how long it stays and how see-through it is, beside the Annotate toolbar or in **Settings →
  Transitions → Spotlight (Ctrl twice)**, with **Try it**.

### Enhancements
- The Spotlight is bigger by default, so it is easy to see on a projector and in a video meeting.

### Fixes
- No separate fixes in this version.

### Performance Improvements
- The soft disc on the FrameRelay picture is drawn only while it plays, in the small square around it.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- A Spotlight set to gold on this PC before 8.7 becomes the white soft disc; choose **Gold ring** to go back.


## Version 8.6.0

### FrameDecks v8.6.0

Frame files open from Quick Start, the Teleprompter shows where its top bar is, and the website looks and reads
better: clearer Frame cards on the Plan, a Help Center with topics, and pages that use the whole screen. Download from
**framedecks.com/download**, or let FrameDecks update itself. It installs over 8.5.0 and earlier and keeps all your
meetings, members, settings and recordings.

### What's New
- **Import from Quick Start.** Quick Start has **Import a Frame file…**, and the ✨ Meeting menu's import now opens
  .frame files too. Both use exactly the same import as Settings → Data / Backup: **Use this plan** or **Add after my
  Frames**, then the check that everything matches. A file that is not a Frame file, was made by a newer FrameDecks or
  is damaged gets a plain message, and nothing changes.
- **The Teleprompter's arrow.** A small arrow at the top of the Teleprompter always shows that a top bar is there.
  Point at it and the bar slides down; choose it to keep the bar open.
- **Help Center.** framedecks.com/help has topics on the left (Getting Started, Studio, Frames, Teleprompter,
  Account, Billing, Troubleshooting, Contact Support) and the chosen one on the right. On a phone, the topics are one
  button above the page.

### Enhancements
- **Plan cards.** Each Frame's name stands out, with tags for its Content, its animation and whether it has a script;
  its Content shows as tiles, and Write Script, Choose Animation and Preview sit in the card's footer.
- The five Plan steps sit in one row when there is room, and the signed-in pages use more of a wide screen.
- The landing page uses the full width: wider sections, less empty space, the features on a full-width band and the
  questions beside their heading. The features now open with "Powerful tools. Effortless creation."
- Signing out ends the session, clears it from this browser and takes you to framedecks.com.

### Fixes
- A .frame file exported from the website or Settings could not be chosen in the ✨ Meeting menu's **Import a Frame
  file…**, which only accepted single exported Frames. It now opens both.
- Signing out without internet left the browser signed in. The session is now cleared here even when the server
  cannot be reached; if this browser cannot be signed out at all, it says so.

### Performance Improvements
- The Help page's old styles are gone; the Help Center's load only on the Help page.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Service PCs on 8.4 or earlier show every meeting's Frames together. Update them to see one meeting at a time.


## Version 8.5.0

### FrameDecks v8.5.0

Plan more than one meeting in the same workspace, each with its own Frames, and see the meeting Frame by Frame on a
timeline beside the plan. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over
8.4.0 and earlier and keeps all your meetings, members, settings and recordings.

**Workspace owners, once:** run `0012_meetings.sql` in Supabase (SQL Editor) before making a second meeting. It keeps
the meeting list safe from service PCs that are still on an older version. Until it has run, the website plans one
meeting as before and says so.

### What's New
- **Several meetings.** On the website's Plan page, **New meeting** makes another meeting, with its own name, date,
  notes and Frames. Choose a meeting at the top to plan it; **Rename** renames it, and its Frames stay with it.
- **One meeting at a time on the PC.** Above the Frames, the **Meeting** list chooses the meeting this PC shows and
  runs. **New** makes another. Next, Previous, the phone remote and the Teleprompter follow only that meeting's Frames.
- **The timeline.** Beside the plan, the timeline shows the meeting from its name down to the last Frame, with a
  picture of each Frame. Drag a Frame to move it, select it and press Alt + ↑ or ↓, or delete it there. Frames glide
  to their new place. **Hide timeline** folds it away; on a phone it sits under the plan.
- **A .frame file per meeting.** **Export for Service PC** exports the meeting you are planning. On the PC, **Use this
  plan** replaces only that meeting; the PC's other meetings and their Frames are kept.

### Enhancements
- The Help guide's steps and screenshots show the meetings and the timeline.
- Each meeting at the top shows its date and how many Frames it has.
- The timeline respects the system's "reduce motion" setting: Frames then move without gliding.

### Fixes
- No separate fixes in this version.

### Performance Improvements
- The timeline's movement uses the browser's own animation, with no extra download; the Plan page's styles stay
  within the same size budget.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- Service PCs on 8.4 or earlier show every Frame of every meeting together. Update them to 8.5 to see one meeting at
  a time.


## Version 8.4.0

### FrameDecks v8.4.0

What you plan on the website now arrives on the service PC exactly as planned, with a check that says so. Meeting
Details are three fields, a linked PC can be resynced with one button, and Help has a step-by-step guide with real
screenshots. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over 8.3.0 and
earlier and keeps all your meetings, members, settings and recordings.

### What's New
- **Use this plan.** Importing a .frame file now offers **Use this plan** first: the PC then shows exactly the
  website's Frames, in the same order, with the same words, scripts, transitions, meeting name, date and notes. Your
  Frames are kept in a backup first. **Add after my Frames** is still there.
- **An import check.** After an import, FrameDecks compares every Frame with the file and says "Everything matches",
  or lists exactly what differs and which pictures or videos are not on this PC yet. A .frame file that was cut short
  or changed by hand is refused before anything changes.
- **Resync Linked PCs.** On a linked PC, the Sync panel (the status button at the top right, then Sync) and Settings →
  FrameDecks account have **Resync Linked PCs**: it syncs now and says Sync complete, No changes found or Sync failed,
  with the last successful sync. Automatic sync carries on every minute as before.
- **Step-by-step guide.** framedecks.com/help starts with a guide for the website and for the service PC: eight steps
  each, from signing in to running the meeting, with screenshots zoomed on the place to click, and a search. On the
  PC: Settings → Help → Step-by-step guide.
- **Simpler Meeting Details.** On the website: Meeting name, Date and Meeting notes. Details from earlier versions
  (speaker, location and so on) are kept, just not shown.

### Enhancements
- Export for Service PC says exactly what is in the file, and which files the Frames use that it does not carry.
- A .frame file from a PC also carries its Teleprompter text settings and Spotlight settings.
- The website loads less: the landing page's and the Plan page's own styles load only on those pages.

### Fixes
- A plan exported from the website and imported on the service PC could look different from the website: the import
  added the Frames after the PC's own and left out the meeting's date and notes. **Use this plan** now gives the same
  plan, checked field by field.

### Performance Improvements
- Pages of the signed-in website load about 7 KB less style.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- On most screen sizes the Sync status sits inside the status button at the top right; choose it, then Sync.
- Multiple meetings, each with its own Frames, and the right-side meeting timeline come in 8.5.


## Version 8.3.0

### FrameDecks v8.3.0

Planning on framedecks.com is now guided, step by step, with a timeline you arrange by dragging and a Preview of
every Frame. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over 8.2.0 and
earlier and keeps all your meetings, members, settings and recordings. The website changes are live for everyone.

### What's New
- **Plan in five steps** on framedecks.com: **Your meeting**, **Add Frames**, **Words and media**, **Preview**, then
  **Sync or export**. Each step is ticked when it is done, and the next one has a large gold button: **Edit details**,
  **Add Frame**, **Write Script**, **Preview** or **Export for Service PC**.
- **A timeline of your Frames.** Drag a Frame to a new place, or select it and press Alt + ← or →. Click one to open it.
- **Preview.** See each Frame as people will, with its transition and the presenter's script underneath. ← and → move
  through the meeting.
- **Choose Animation.** A Frame's transition is now a set of buttons that show their movement, Burst included.
- **Pictures, video, audio and slides from the website.** **Choose file** keeps the file in your browser (never in the
  cloud), and **Export for Service PC** puts it in the .frame file, so the service PC gets it with the plan.
- **Sync status on the website**: Synced, Syncing…, Offline or Sync failed, next to Export for Service PC.

### Enhancements
- Each Frame on the Plan page has **Write Script**, **Choose Animation** and **Preview** buttons.
- The transition styles read Fade, Slow fade and Gentle fade (the names left over from before 8.2 are gone).
- The website's styles are smaller: unused rules from older designs were removed, so pages load a little faster.

### Fixes
- None in this release.

### Performance Improvements
- The website's stylesheet stays within its 24 KB budget with the new Plan page, after removing about 6 KB of unused
  rules.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- A file chosen on the website stays in that browser. Export the .frame file from the same browser, or add the file on
  the service PC.
- The Preview is an approximation of the picture. The service PC shows it exactly (Studio, or the Share Window).
- Dragging Frames on the timeline needs a mouse or a touchpad. On a phone or tablet, use the arrows on each Frame.


## Version 8.2.0

### FrameDecks v8.2.0

A cleaner Teleprompter, a Spotlight for the word you are talking about, a Burst transition and .frame files that take a
whole plan to a service PC without internet. Download from **framedecks.com/download**, or let FrameDecks update
itself. It installs over 8.1.0 and earlier and keeps all your meetings, members, settings and recordings.

### What's New
- **Teleprompter: only your words on screen.** Every control now sits in the Teleprompter's top bar, which folds
  away: Scroll, speed, font size and the other text settings, **✎ Write Script**, **Next Frame ▸**, transparency and
  Pin. The script area shows the script and nothing else, and the text uses the whole window at every font size.
- **Upload a script.** **⇪ Upload** in the Teleprompter bar reads a .txt, .md or Word (.docx) file. Word headings,
  bullets and bold are kept.
- **One script or one per Frame.** Choose **Each Frame** (as before: the script follows the live Frame) or **Whole
  meeting** (one script for the whole meeting).
- **Spotlight.** Annotate → Spotlight (key S, or press Ctrl twice): click a word on the picture and a glowing circle
  grows around it, pulses, then opens out with a few sparks and fades. Choose its colour, size, length and strength.
  It shows in Zoom and Teams (FrameRelay), recordings and the overlay pages.
- **Burst transition.** The old Frame breaks into dust that drifts away and uncovers the next one. Choose how fine the
  dust is, which way it drifts, its colour and its strength.
- **.frame files.** On framedecks.com, Plan → **Export for Service PC** saves the whole plan in one file. On the
  service PC, Settings → Data / Backup → **Import Frame File…** adds it after your Frames or replaces them (after a
  backup). A PC can export one too, with its pictures, videos, audio and slides.
- **Sync status.** A PC linked to a workspace shows **Synced**, **Syncing**, **Offline** or **Sync failed** in the
  header.

### Enhancements
- Transitions: one of each kind. The list is Cut, Fade, Dip to Black, Dip to White, Blur Fade, Zoom, Slide, Push,
  Wipe and Burst. Frames that used Dissolve, Cinema or Church now use Fade; Slide Right uses Slide; Soft Scale uses
  Zoom. They look the same as before.
- Settings → FrameDecks account says Synced, Syncing, Offline or Sync failed, and when offline, how to use a .frame
  file instead.

### Fixes
- None in this release.

### Performance Improvements
- Burst and Spotlight are drawn only while they play: about 12–20 ms and 6 ms a frame at 1080p, nothing otherwise.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- A .frame file made on framedecks.com holds no pictures or videos (they are kept off the cloud). Add them on the PC,
  or export the .frame file from a PC that has them.
- With "Light on graphics card" on (the default), the Teleprompter fades as a whole, text included. For solid text over
  a see-through background, turn it off in Settings → General → Performance and restart FrameDecks.


## Version 8.1.0

### FrameDecks v8.1.0

A more beautiful FrameDecks, with the Teleprompter's transparency back. Download from **framedecks.com/download**, or
let FrameDecks update itself. It installs over 8.0.0 and earlier and keeps all your meetings, members, settings and
recordings.

### What's New
- **Teleprompter transparency and pin.** The Teleprompter's top bar has Solid, 20%, 40%, 65% and 85%, so your meeting
  shows through, and a **Pin** button that keeps it above Zoom, Teams and PowerPoint. Both are remembered.
- **Colour looks.** Settings → Meeting & Branding → **Look**: Gold & Navy, Morning Light, Chapel Stone, Deep Ocean,
  Forest or Quiet Mono (the same looks as on framedecks.com), or "Same as my workspace". Then Dark, Light or Match
  Windows.
- **Content settings on one page.** Select Content in Decks: its words come first, then Position and size, Look,
  Animation and Show on, each opening with a click. No more tabs.

### Enhancements
- The whole window now matches framedecks.com: a soft light behind everything, rounder cards with a faint gold edge,
  gold main buttons and larger page titles. It uses no extra processor or graphics power.
- Settings → General is simpler: the window, the tray and performance. "Your details & email wording" is gone.

### Fixes
- The picture at the top of the release notes and the README shows the About screen again (8.0.0's caught the Setup
  guide in front of it).

### Performance Improvements
- None in this release.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- With "Light on graphics card" on (the default), the Teleprompter fades as a whole, text included. For solid text over
  a see-through background, turn it off in Settings → General → Performance and restart FrameDecks.


## Version 8.0.0

### FrameDecks v8.0.0

A simpler FrameDecks. One Teleprompter, one Studio, tidier Frames, a new phone remote, plainer camera settings and a
friendlier Setup guide. Download from **framedecks.com/download**, or let FrameDecks update itself. It installs over 7.1.2 and earlier
and keeps all your meetings, members, settings and recordings.

### What's New
- **One Teleprompter.** Your script opens in one window that stays above Zoom and Teams and is never shown in screen
  sharing or recordings. The top bar (time, the current Frame and a timer) stays out of the way: move the pointer to
  the top edge, or press the small button there, to see it. Live tools → Teleprompter, or press R.
- **Tidier Frames.** Each Frame is a compact card. Right-click a Frame for one **Duplicate Frame** (Ctrl+D), which puts
  the copy right after it. The selected Frame shows only what you change often: name, Teleprompter script,
  moving on by itself, and Duplicate. Group, transition, branding, favourite, template and history are under
  **Advanced**.
- **A new phone remote, all on one screen.** What is on screen now, big Previous and Next buttons, the Frame's
  questions, scriptures or slides with their own arrows, Teleprompter, Draw, Freeze and Black screen, and every Frame
  one tap away. Hide all is always at the top. No layouts or tabs to choose.
- **A step-by-step Setup guide.** One step at a time, with a progress bar, Back and Next. Each step says whether it is
  done, and "Something not working?" lists what to try. Steps you can't do yet can wait ("Do this later").

### Enhancements
- The section under the Frames is now called **Decks**; **+ Content** adds to it as before.
- **One Studio.** The separate Run view is gone: Previous, Next, Go Live, Hide all and Live tools are always in the
  top bar. The Share Window is unchanged.
- **FrameRelay camera settings in plain words.** Picture quality is grouped into a quick setting, light and colour,
  and More webcam options. **Diagnostics** gives a one-line answer first ("Everything looks normal", or what to try);
  the technical numbers are folded away for support.

### Fixes
- The Teleprompter's top bar can always be closed again, even while the pointer is over it.

### Removed
- The docked Teleprompter (left, right, bottom, floating) and the see-through overlay with its five transparency
  settings: the one Teleprompter replaces them. The phone remote's Teleprompter is unchanged.
- **Practice mode**, and the Rehearse step of the Setup guide. To try things out before a meeting, use
  Live tools → Black screen.
- The ready-made **Discussion topic**, **Icebreaker** and **Poll** cards. Frames that already have them keep them.
- The other Duplicate choices (with options, as template, structure only, variant, to group). Save as template is
  under Advanced.
- On the phone remote: the Simple and Advanced layouts, the tabs, Frame search, the Content list, the transition
  picker, Run-through and the Emergency button (Emergency stays on the PC).

### Performance Improvements
- Fewer windows and less code at start-up: the Teleprompter dock and the separate overlay window are gone.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- If Practice mode was on when you updated, the Black screen stays on: turn it off under Live tools.


## Version 7.1.2

### FrameDecks v7.1.2

Safer publishing of new versions. The program works exactly as 7.1.1. Download from **framedecks.com/download**, or
let FrameDecks update itself. It installs over 7.1.1 and earlier and keeps all your meetings, members, settings and
recordings.

### What's New
- **Updates only move forward.** The download page and new installs always get the newest version; an older version
  can no longer be published by mistake in its place.

### Enhancements
- A version, once published, never changes. Every PC that downloads FrameDecks 7.1.2 gets exactly the file whose
  fingerprint is shown on the download page.
- "Reinstall the previous version" in Settings → About always offers the version just before yours.

### Fixes
- Fixed a case where publishing two versions at the same moment could leave the older one offered as the newest.

### Performance Improvements
- None in this release.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
  If Microsoft Defender removed an earlier FrameDecks: Windows Security → Virus & threat protection → Protection
  history → the entry → Actions → Restore, then install this version.
- PCs on 7.0 or 7.1 install this update with their own, older updater; if Defender objects at that moment, install
  7.1.2 once from framedecks.com/download instead.


## Version 7.1.1

### FrameDecks v7.1.1

A safety update after Microsoft Defender quarantined FrameDecks 7.1 as a false alarm. Download from
**framedecks.com/download**. It installs over 7.1 and earlier and keeps all your meetings, members, settings and
recordings.

### What's New
- **Fewer antivirus false alarms.** FrameDecks no longer starts hidden helper programs (PowerShell, netsh or taskkill)
  in the background. Microsoft Defender treated that pattern, from a program that is not yet code-signed, as remote
  control by an attacker and removed FrameDecks 7.1 from some PCs. Everything those helpers did now goes through
  Windows' own built-in functions.

### Enhancements
- **Allow through Windows Firewall** and **Install the FrameRelay camera** ask for administrator permission with
  Windows' standard prompt.
- Updates start the installer directly. It waits for FrameDecks to close, installs, and opens the new version. If it
  cannot finish, it undoes its changes and the version you had stays.
- The installer's code-signing check, used once releases are signed, uses Windows' own signature check.
- The network type and firewall check for the phone remote run only while Settings → Phone & iPad Remote is open.

### Fixes
- FrameDecks no longer disappears after a while on PCs where Microsoft Defender quarantined it (see Known Issues to
  bring back a copy that was removed).

### Performance Improvements
- Nothing is started in the background every few minutes any more; the phone remote's network check costs nothing
  while its settings are closed.

### Known Issues
- If Microsoft Defender removed FrameDecks 7.1: Windows Security → Virus & threat protection → Protection history →
  the entry → Actions → Restore, then install 7.1.1. Until the installer is code-signed, adding an exclusion for the
  FrameDecks folder (Manage settings → Exclusions → Folder: your AppData\Local\Programs\FRAMEDECKS) avoids
  repeat alarms.
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
- The public-network warning in the header appears after Settings → Phone & iPad Remote has been opened once.


## Version 7.1

### FrameDecks v7.1

Choose one look for your whole team on framedecks.com, and every linked PC follows it. Download from
**framedecks.com/download**, or let FrameDecks update itself. It installs over 7.0 and earlier and keeps all your
meetings, members, settings and recordings.

### What's New
- **Workspace looks.** On framedecks.com, **Branding → Look** offers six looks for the cards your room and stream
  see: Gold & Navy (the standard), Morning Light, Chapel Stone, Deep Ocean, Forest and Quiet Mono. Each sets the card
  colour, the edge and label colour, and the scripture font (serif or sans). Every linked PC changes to it within
  about a minute, on the room screen, the overlay pages and the FrameRelay camera alike.
- **Never mid-sentence.** A PC changes its look, and any branding or card setting changed elsewhere, only once nothing
  is on its screen. While a question, scripture or Content is showing, the change waits.
- **Follow my workspace.** Settings → General → Appearance has a fourth choice: the FrameDecks window turns light or
  dark with your workspace look. It is also in the command palette (Ctrl+K, "follow my workspace").

### Enhancements
- Choosing a look also sets its accent colour; you can still pick another accent colour under Meeting & Branding.
- Every look keeps the card text easy to read: a contrast of at least 4.5:1 on its own colour.

### Fixes
- None in this release.

### Performance Improvements
- Changing the look redraws only the cards; nothing reloads, and the camera draws the new cards in the background
  while it keeps showing the old ones.

### Known Issues
- Looks are chosen on framedecks.com, so the PC needs to be linked to a workspace. A PC that is not linked keeps
  the standard Gold & Navy look and its own accent colour.
- If something stays on screen for a whole service (for example a logo that is never hidden), a new look waits until
  you press **Hide all** (Esc).
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 7.0

### FrameDecks v7.0

FrameDecks now comes from framedecks.com and keeps itself up to date. Download it from
**framedecks.com/download**. It installs over 6.14 and earlier and keeps all your meetings, members, settings and
recordings.

### What's New
- **Download from framedecks.com.** The download page finds the right installer for your computer, always offers the
  newest version, and shows its size, release notes and SHA-256 checksum.
- **Automatic updates.** FrameDecks looks for a new version once a day. When one is ready, Settings → About shows
  what is new, with **Update now** and **Update when I close FrameDecks**. The update downloads and installs by
  itself, keeps your choices, and opens FrameDecks again.
- **Safe updates.** An update is installed only if it comes from FrameDecks' download service and matches its
  published size and fingerprint. FrameDecks never updates while something is on screen unless you say so. If an
  update cannot be installed, the previous version is put back and FrameDecks tells you at the next start.
  **Reinstall the previous version** in Settings → About does the same by hand.
- **Legal and security pages.** Terms of Service, Privacy Policy, Cookie Policy, End User License Agreement,
  Security and Vulnerability Disclosure are on framedecks.com, linked from every page's footer, along with Download,
  Roadmap, Documentation, Help, About, Contact and Status.
- **Your account, your data.** Account → Your data downloads everything your account holds as one file, and deletes
  your account when you ask. New accounts agree to the Terms and Privacy Policy when they are created; existing
  accounts are asked once.

### Enhancements
- FrameDecks is now proprietary software, free to download and use. The installer shows the End User License
  Agreement, and Settings → About links to it and to the privacy policy.
- The documentation is on framedecks.com/docs, with the same guides as before.
- A short cookie notice explains the few things the website keeps in your browser. FrameDecks uses no advertising or
  tracking cookies.
- Questions go to hello@framedecks.com; security reports to security@framedecks.com.

### Fixes
- Download links on the website now open the download page in the same tab instead of a code-hosting site.

### Performance Improvements
- The update check is one small request a day, and the download page's newest version is cached for five minutes.

### Known Issues
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.
  Compare the SHA-256 checksum on the download page if you want to check the file.
- FrameDecks is for Windows 10 and 11 (64-bit). Mac and Linux versions are planned.
- Copies of 6.14 and earlier may not offer 7.0 by themselves: install 7.0 once from framedecks.com/download. From
  then on, updates arrive by themselves.
- Pictures, video, PowerPoint and audio files stay on the service PC. On the website, type the file name as it is in
  the PC's media folder.


## Version 6.14

### FrameDecks v6.14

A Setup guide takes a new PC from install to "ready for the first gathering". Download **FrameDecks v6.14.exe** from
**Assets** below and run it. It installs over 6.13 and keeps all your meetings, members, settings and recordings.

A `.sha256` file is attached so you can check the download.

### What's New
- **Setup guide.** On a new PC a calm panel opens at the right with seven steps: what kind of gathering you lead (it
  makes a ready set of Frames), how people will see it, your phone as a remote, Connect to FrameDecks (optional), your
  first Frame, rehearsing in Practice mode, and Ready. Each step ticks itself when FrameDecks sees it is done; nothing
  is ticked just by clicking it. **Show me how** dims the window around the button to press. Make the panel smaller,
  or skip it; it comes back from **Settings → About → Guided tour** or the command palette (Ctrl+K, "Setup guide").
- **The same guide on the website.** Home on framedecks.com shows the same seven steps. It ticks what it can see from
  the website (your kind of gathering, a linked PC, a Frame added or changed there) and marks the rest "On the PC".

### Enhancements
- The Setup guide replaces the four-step Getting started card. If that card was still open on your PC, the guide
  opens in its place once.
- When the guide is finished it says so: "You're ready for your first gathering", with **Open Run**. Settings →
  About then shows **Setup complete**, and the tour can still point at each control.

### Fixes
- None in this release.

### Performance Improvements
- The guide checks its steps every 2 seconds only while it is open, from what the program already knows; closed or
  made smaller, it does nothing.

### Known Issues
- **Owners, once (if not done for 6.13):** run `hosted/supabase/migrations/0010_link_by_url.sql` in the Supabase SQL
  editor so Connect to FrameDecks can finish.
- People upgrading from 6.13 or earlier do not see the guide unless they open it (Settings → About → Guided tour).
- Pictures, video, PowerPoint and audio files stay on the service PC. On the website, type the file name as it is in
  the PC's media folder.
- The Excel Meeting Workbook is still in the program; it leaves in a later version, once the website form has been
  tested in a real meeting.
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 6.13

### FrameDecks v6.13

Connecting a PC to your FrameDecks workspace is now one click. Download **FrameDecks v6.13.exe** from **Assets**
below and run it. It installs over 6.12 and keeps all your meetings, members, settings and recordings.

A `.sha256` file is attached so you can check the download.

### What's New
- **Connect to FrameDecks in one click.** In the program, open **Settings → FrameDecks account** and choose
  **Connect to FrameDecks**. Your browser opens framedecks.com and asks: "Allow ‹this PC› to use your workspace?" Sign
  in if asked, choose the workspace and press **Allow**. The program turns to **Linked** by itself within a few
  seconds; there is nothing to type. Both the PC and the browser show the same two-digit check number, so you can see
  it is the right PC. Only a workspace's owners and admins can allow a PC, and a request lasts 10 minutes.
- **No browser on the service PC?** The code is still shown under the check number. Type it on any device under
  **Service PCs** on framedecks.com, as before.

### Enhancements
- **framedecks.com is the website's address.** The program links through framedecks.com, and every page has its own
  name in the browser tab and when a link is shared.
- **A shorter front page.** The website's front page is about four screens instead of nine. The words and the
  product sit side by side at the top; **How it works** plays its four steps by itself once (hover or tap to pause,
  or step through with Previous and Next); the try-it demo and the features share one set of tabs; the first four
  questions show, and the rest open from **More questions**.
- **Clearer wording about linking.** The website's Home and Service PCs pages describe the one-click way first.

### Fixes
- Every page of the website showed the same title when shared; each now has its own.

### Performance Improvements
- **The front page loads less.** The scroll animation library is gone (about 40 KB less JavaScript), and nothing is
  pinned while you scroll.
- **Linking answers sooner.** While a request is waiting, the program checks every 1.5 seconds instead of every 3.

### Known Issues
- **Owners, once:** run `hosted/supabase/migrations/0010_link_by_url.sql` in the Supabase SQL editor before using
  Connect to FrameDecks. Until then the browser page says the request can't be checked; typing the code under
  **Service PCs** still works.
- Pictures, video, PowerPoint and audio files stay on the service PC. On the website, type the file name as it is in
  the PC's media folder.
- The Excel Meeting Workbook is still in the program; it leaves in a later version, once the website form has been
  tested in a real meeting.
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 6.12

### FrameDecks v6.12

The FrameDecks camera has a new name: **FrameRelay**. Download **FrameDecks v6.12.exe** from **Assets** below and run
it. It installs over 6.11 and keeps all your meetings, members, settings and recordings. Close any video meeting or
streaming app first, because it keeps the camera in use, and leave **Install the FrameRelay camera** ticked so Windows
learns the new name.

A `.sha256` file is attached so you can check the download.

### What's New
- **FRAMECAST is now FrameRelay.** The built-in virtual camera, its settings page, every message in the program, the
  website, the help pages and the installer use the new name. In Zoom, Teams, Google Meet or OBS choose **FrameRelay**
  as the camera. It is the same camera underneath (the same Windows ID), so your meeting apps keep their settings;
  restart them once after installing to see the new name.

### Enhancements
- **A calmer front page.** On the FrameDecks website, the Studio picture no longer floats, tilts or sways. It arrives
  once, in order: the window rises into place, its screen comes on, the gold corners settle, the phone slides in, and a
  single soft light passes across the glass. Then everything is still.
- **Scripture in the website's demo.** The press-Next demo shows Proverbs 16:3 (KJV), "Commit thy works unto the LORD,
  and thy thoughts shall be established.", in place of the earlier quotation, and the front page's Studio picture was
  taken again with that verse on screen.
- **The About screen reads more simply.** The founder's roles and journey were shortened; the story is unchanged.

### Fixes
- None in this release.

### Performance Improvements
- **The front page does less.** The floating phone and the swaying light behind the Studio picture no longer run at
  all, so the page is still once it has arrived.

### Known Issues
- If you untick **Install the FrameRelay camera** while installing, Windows keeps showing the old name FRAMECAST until
  the camera is installed again (Settings → FrameRelay Camera → Install). FrameDecks recognises both names.
- Pictures, video, PowerPoint and audio files stay on the service PC. On the website, type the file name as it is in
  the PC's media folder.
- The Excel Meeting Workbook is still in the program; it leaves in a later version, once the website form has been
  tested in a real meeting.
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 6.11.2

### FrameDecks v6.11.2

A small maintenance release. Nothing changes in how you run a service. Download **FrameDecks v6.11.2.exe** from
**Assets** below and run it. It installs over 6.11.1 and keeps all your meetings, members, settings and recordings.
Close any video meeting or streaming app first, because it keeps the camera in use.

A `.sha256` file is attached so you can check the download.

### What's New
- **Nothing new on the PC.** The program, its screens and its keys are the same as in 6.11.1. This release brings the
  program in step with the FrameDecks website and tidies how the project is built.

### Enhancements
- **The website says what went wrong in plain words.** When something cannot be saved or loaded, the FrameDecks
  website now explains it in a sentence and what to do, instead of showing a technical message.
- **Clear confirmations on the website.** Removing a person, disconnecting a PC and similar steps ask first, in a
  FrameDecks dialog that says exactly what will happen, instead of the browser's plain pop-up.
- **The website's People, Live and Plan pages read the same everywhere.** A few labels and messages were made
  consistent.

### Fixes
- **The website's size check now works on Windows**, so every release is measured the same way on any PC.

### Performance Improvements
- None in this release.

### Known Issues
- Pictures, video, PowerPoint and audio files stay on the service PC. On the website, type the file name as it is in
  the PC's media folder.
- The Excel Meeting Workbook leaves the program in 6.12, once the website form has been tested in a real meeting.
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 6.11.1

### FrameDecks v6.11.1

Running a meeting gets simpler and safer: **Prepare** and **Run**, **Up next** with its keys, **Practice mode**, a
clearer Settings menu, and the name written **FrameDecks**. Underneath: plan recovery, a safer sync, a support bundle
and update notices. Download **FrameDecks v6.11.1.exe** from **Assets** below and run it. It installs over 6.11 and
keeps all your meetings, members, settings and recordings. Close any video meeting or streaming app first, because it
keeps the camera in use.

A `.sha256` file is attached so you can check the download.

### What's New
- **Your plan is protected if its file is damaged.** If the saved plan cannot be read (after a power cut, a full disk
  or antivirus interference), FrameDecks keeps the damaged file aside, never overwrites it, and opens the newest
  daily backup instead. On a PC linked to a workspace, the plan is then restored from the workspace.
  **Settings → Diagnostics** shows what happened.
- **Sync never empties the workspace by accident.** If every Frame disappears from a linked PC at once, FrameDecks no
  longer deletes them in the workspace and on your other PCs. It brings them back from the workspace instead.
- **Save support bundle.** Settings → Diagnostics → **Save support bundle** saves one file with the log, Diagnostics
  and settings to send when asking for help. It never contains your plan, members, the phone-remote PIN or any key.
- **New versions are announced.** About shows when a newer FrameDecks is published, with a link to download it.
  Nothing is downloaded or installed by itself.
- **A clearer Settings menu.** Settings is grouped into Your meeting, Presenting, Account, This PC and Help. Each item
  has a one-line description, and **Find a setting** filters the list as you type (Enter opens the first match).
- **A friendlier first start.** On a new PC, **Start fresh** is the main choice (importing from a folder is still
  offered), and a small **Getting started** card then lists three steps: your meeting name and logo, your first Frame,
  and choosing FrameRelay in Zoom or Teams. Close it with **×** whenever you like.

### Enhancements
- **Prepare and Run.** A switch at the top of the window. **Run** is the service view: your running order, what is on
  screen, what is **Up next**, and Previous, Next, Go Live and Hide all. Nothing can be edited by accident in Run.
- **Practice mode.** In Run, rehearse while your audience sees a black screen; your own preview shows everything.
- **Before you start.** In Run, a short checklist: your Frames, how people will see it, the program and the phone remote.
- **How people see it.** One page in Settings with three choices: FrameRelay in Zoom or Teams, the Share Window, or a
  projector, TV or OBS.
- **Clearer top bar.** Studio, Members and Settings have their names; **◀ Previous** and **Next ▶** are large and
  labelled; **Hide all** is calm while nothing is on screen and turns red when something is; Off air and Ready sit in
  one status pill.
- **Live tools in three groups:** On screen, Teleprompter (one entry: in this window, over Zoom or its own window) and
  Emergency. **Blackout** is now called **Black screen**, as on the website and the phone. Esc closes the menu.
- **Simpler Settings.** Transitions, Keyboard shortcuts, Security and Diagnostics are under **Advanced**. FrameRelay shows
  its blur presets first, with the exact numbers under **Fine-tune**.
- **Members → People.** One list with two views (List and Table) instead of Directory and Manage.
- **Your first service in four steps.** The Getting started card now ends with practising a service in Run.
- **A command bar in plain words.** The transition list is labelled **Transition**, **Auto** reads **Auto-advance**,
  **Program ▾** is now **Live tools ▾** (it reads **Blackout on ▾**, **Frozen ▾** and so on while one is on), the
  status button says **Ready** or what needs attention, **Off air** / **Live** stay in words, and **Go Live** and
  **Hide all** are no longer in capitals. On narrower windows the shortest forms are used; every button has a tooltip.
- **Easier-to-read small labels.** No label in the program is smaller than 12 px, and the faintest text now has at
  least 4.5:1 contrast in the dark and light themes (helpful on projectors and for older eyes).
- **One look with the website.** Headings and labels use the same typeface as the website, in sentence case; the
  serif stays for scripture. The Settings menu and Teleprompter buttons use clear line icons instead of symbols.
- **Members: one place to write emails.** Prepare buttons take you to **Members → Email**; import and export are in one
  **Import / Export** menu; the preview matches the window's theme; "New Joinee" is now **Prepare a welcome email**.
- **Tidier Frame settings.** **Duplicate…** stays in view and the rarer actions are under **More…**; checkboxes have
  one line of help underneath instead of notes in brackets.
- **Settings → About is short:** name, version and links, with **Read our story** for the rest. The Settings menu lines
  up with the page title.
- **Easier to read in the light theme.** Go Live, Play and On screen use a deeper green, and the Settings menu's small
  text and the faintest labels are darker, so all text reaches 4.5:1 contrast. The **Esc** hint on Hide all is clearer.
- **Better with screen readers.** The Frame and Content lists, the inspector's group links and the Theme choice now
  announce correctly; every screen of the program passes an automatic WCAG 2.1 AA check in both themes.
- **A lighter Settings page.** The keyboard shortcut list and the About story are built the first time you open them.
- **The Teleprompter's empty state.** A Frame without a script shows one centred message and a **Write a script**
  button.
- **Safer local connections.** Other websites open in your browser can no longer call FrameDecks on this PC. The
  program's own windows, the phone remote, OBS and the Stream Deck plugin work as before.
- **The window buttons never freeze the program.** Minimise, maximise, restore and close no longer wait on the window
  (the same cause as the Teleprompter freeze).
- **Better error logs.** Problems the program used to recover from silently are now written to `kc-app-log.txt`, at
  most once a minute each, so support can see what happened.
- **The Stream Deck plugin is no longer part of FrameDecks.** The keyboard shortcuts, the phone remote and the
  website's Live page work as before.
- **A more trustworthy build.** The installer is built from exact, reviewed versions of every tool and of the camera
  driver's source code, and only the release step can publish.

### On the website (framedecks.pages.dev, live as soon as it deploys)
- **Running order** (the page that was called Services) and the **Meeting Form** each say what they are for and link
  to the other.
- The front page lists four promises the product keeps: services run on your PC, private by design, nothing is lost,
  free and open source.
- **A phone-friendly menu.** On a phone, Overview, Meeting, Live and Members sit in a tab bar at the bottom of the
  screen; Services, Branding, Computers and the download are under **More**.
- **Readable times.** Times read "5 min ago" or "2 h ago" (older ones "12 Oct"); hover for the exact time.
- **Cards show the meeting.** Each Content line on the Services and Meeting Form cards has an icon and shows the first
  question, the reading or the text, never the same word twice; empty ones say "No questions yet".
- **Safer delete buttons.** Disconnect, Remove, Leave, Delete and cancelling an invitation look different from Edit
  (red outline) and always ask first, naming what they act on.
- **A landing page that shows the product:** real pictures of the Studio and of the Live page on a phone, and what
  FrameDecks does in plain words. The brand and the mission are shown once, not on every page.
- **Larger, clearer small text** (12 px or more, at least 4.5:1 contrast).
- **Light or dark.** The website follows your device, or choose Light or Dark with the button in the top bar.
- **Clear loading, empty and error states.** Pages show grey placeholders while they load, a short note with one action
  when there is nothing yet, and **Try again** if something did not load.
- **Calmer colours.** Gold marks only the main action and what is selected; links are underlined; On screen is green.
- **The Overview gets to work.** A short welcome and your meeting at a glance; How it works shows only before you have a
  workspace.
- **Keyboard and screen readers.** A Skip to content link, one main area per page and a clear focus ring everywhere.
- **One typeface with the program** (Source Sans 3).

#### One place per job, and a calmer look (27 October)
- **Home · Plan · Live · People**, with Branding, Service PCs and Help under Settings. **Plan** joins the Meeting Form
  and the running order (Edit the meeting / History and restore). The old addresses (`/meeting`, `/services`) still work.
- **Home** shows your next service and whether it is ready. A first visit walks through three steps: name your church,
  install FrameDecks, link the service PC. Your churches and invitations are under **Your account** (your avatar).
- **Sign in** asks: New here? or Welcome back.
- **Help** explains getting started, Sunday morning, common problems and the words we use, with the version and a
  contact address.
- The front page leads with the download, lets you press Next to see the room change, and answers the questions
  churches ask. Glows and moving lights are gone; product pictures carry gold frame corners; scripture is set in
  EB Garamond.
- In the program's **Run**, Up next is larger, shows its keys, and reminds you at the start time if Practice mode is
  still on.

#### FrameDecks, for every gathering (27 October)
- The name is written **FrameDecks** everywhere you read it.
- The website's front page speaks to meetings, classes, conferences, events and services: "Prepare with Purpose.
  Present with Excellence." It moves again, gently, and costs nothing once it is still.
- The website says **team** where it said church.
- **Fixed:** in the light theme the About screen could not be read.

### Fixes
- **FrameDecks account showed "Could not reach https://framedecks.pages.dev: Forbidden".** The program now identifies
  itself to the website, so linking and sync work.
- **Unpinning the Teleprompter overlay froze the program.** Stay on top now changes without waiting on the window.
  If an older version is frozen, end every FrameDecks task in Task Manager, then open the program again.
- **The Studio's media divider says FrameRelay picture** (it still said FrameDecks).
- **Text no longer covers the Studio canvas.** On a PC without the camera (or the start-file version), its message
  sat over the preview and its PREVIEW badge.
- **The camera's own labels now say FrameRelay.** The on/off switch, its status, the Teams step ("choose
  **FrameRelay**"), the Cards option, Camera Look and Diagnostics still used the program's name.

### Performance Improvements
- The installer is smaller: it carries one copy of OpenCV instead of two.
- A linked PC no longer writes to the database on every sync check. The workspace needs the optional database update
  `0009_seen_throttle.sql`, which the owner runs once.
- The FrameDecks website no longer animates while it sits open next to the program (older 8 GB PCs).

### Known Issues
- Deleting **every** Frame on a linked PC now brings them back from the workspace. To clear a whole meeting, delete the
  Frames on the website, or leave at least one Frame.
- Pictures, video, PowerPoint and audio files stay on the service PC. On the website, type the file name as it is in
  the PC's media folder.
- The Excel Meeting Workbook leaves the program in 6.12, once the website form has been tested in a real meeting.
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 6.11

### FrameDecks v6.11

FrameDecks 6.11 brings planning to the web. Prepare the whole meeting from any computer or phone at
**[framedecks.pages.dev](https://framedecks.pages.dev)**, and your service PC has it ready within a minute. The program
also takes on the website's look, so FrameDecks feels like one product wherever you use it.

#### Install
1. Download **FrameDecks v6.11.exe** from **Assets** below and run it.
2. It installs over earlier versions and keeps all your meetings, members, settings and recordings.
3. Close Zoom, Teams and OBS first, because they keep the camera in use.

A `.sha256` file is attached so you can check the download.

### What's New
- **Plan the meeting on the website.** The new **Meeting Form** at framedecks.pages.dev has the same sections as the
  Excel Meeting Form: meeting details, Frames, their Content, discussion questions and scripture readings. Add,
  change, reorder and delete Frames there; a linked PC shows them within about a minute. Owners and admins edit;
  everyone else can read.
- **Branding from the website.** Set the Meeting Name, the leader or organization, the accent colour and whether
  new Frames include branding, with a live preview. Your logo stays on the service PC.
- **Transition style from the website.** Choose how Frames move on screen (Sunday Service, Bible Study, Youth,
  Conference, Wedding, Funeral, Christmas or Livestream) on the Meeting Form.
- **Birthdays this week.** The website's Overview lists members whose birthday is in the next seven days.
- **Open FrameDecks from the website.** On a Windows PC, the Overview checks for the FrameRelay camera and offers
  either the download or **Open FrameDecks on this PC**. The installer sets up that link for you.
- **Meet FrameRelay.** The program's virtual camera is now called **FrameRelay**. In Zoom, Teams, Google Meet and
  OBS, choose **FrameRelay** as your camera; in the program it is **Settings → FrameRelay Camera**. Restart those apps
  once after installing so they see the new name.
- **A redesigned website.** A new landing page, dashboard and sign-in, a "How it works" guide, an About screen, and
  quiet motion that respects your device's "reduce motion" setting. Owners can now delete a workspace.

### Enhancements
- **One look everywhere.** The program uses the website's colours: a deeper navy, gold for selection and the main
  buttons, and the same text and border shades. Only colours changed; everything is where it was. The light theme
  is unchanged.
- **The Excel Meeting Workbook** (import, template, export and undo) now lives in **Settings → Data / Backup**. The
  command palette's "Meeting from Excel" opens it there.
- **FrameDecks everywhere.** The last traces of the earlier name are gone from the program's files, the camera's
  files and the Excel Meeting Workbook.

### Fixes
- The Excel Meeting Workbook's title now reads **FrameDecks** (it still showed the earlier name).
- The camera list in Settings again hides the program's own camera, so it cannot be picked as its own source.

### Performance Improvements
- Planning on the website sends only the Frames that changed, and nothing is sent while you present.
- The website is plain static pages served from a global network, so it opens quickly on any connection.

### Known Issues
- Pictures, video, PowerPoint and audio files stay on the service PC. On the website, type the file name as it is in
  the PC's media folder; **Diagnostics** on the PC lists any name it cannot find.
- Scripture added on the website without its text shows the reference until the PC fetches the text.
- The camera's name and files are new. The installer sets it up again automatically, keeping the same device, so
  Zoom and Teams usually switch over by themselves. If **FrameRelay** is not listed, open **Settings → FrameRelay
  Camera** and click **Install FrameRelay** once. In OBS, re-select the camera in its source once.
- The Excel Meeting Workbook leaves the program in 6.12, once the website form has been tested in a real meeting.
- The installer is not yet code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 6.10

### FrameDecks v6.10

A fix release for 6.9. Download **FrameDecks v6.10.exe** below and run it. It installs over earlier versions and
keeps all your data. A `.sha256` file is attached so you can check the download.

If FrameDecks shows **"127.0.0.1 refused to connect"** when you open it, install this version. It fixes that.

### What's New
- Nothing new: this release only fixes the problem below.

### Enhancements
- When FrameDecks starts and finds an earlier copy of itself that stopped answering, it closes that copy and opens
  normally, instead of showing an empty window.
- The installer also closes such a copy before it updates the program.

### Fixes
- **"127.0.0.1 refused to connect" after closing and opening FrameDecks.** In 6.8 and 6.9, **Quit** closed the
  window but the program kept running out of sight. The hidden Spotlight window stayed open. The next start then
  connected to that silent copy and showed an error page. Now:
  - **Quit** closes every window, including Spotlight, the Teleprompter, the overlay and the Share Window.
  - Quitting frees the program's connection straight away, so the next start gets it.
  - A safety net ends the program if a window will not close.
  - On Windows, the program no longer shares its connection with another program. Before, that sharing sent the
    window's requests to the silent copy.

### Performance Improvements
- Quitting is complete and immediate. The camera, the phone remote and the program's memory are all released, where
  6.8 and 6.9 could leave them in use until you signed out.

### Known Issues
- If you still see the error, an older stuck copy may be running. Install 6.10, or restart the PC once. You can also
  end **FrameDecks** in Task Manager (Ctrl+Shift+Esc).
- The installer is still not code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 6.9

### FrameDecks v6.9

Download **FrameDecks v6.9.exe** below and run it. It installs over earlier versions and keeps all your data.
Close Zoom, Teams and OBS first, because they keep the camera in use. A `.sha256` file is attached so you can check the
download.

### What's New

#### A new Meeting Workbook: Dashboard + Meeting Form
- The Excel workbook now has just two tabs.
- **Meeting Form** is one guided page that you fill in from top to bottom:
  1. Meeting details: name, date, time, location or link, and notes.
  2. Speaker: name and contact.
  3. Attendees: how many you expect, and notes.
  4. Presentation: who prepares it, and content notes.
  5. Then the **Frames**, **Content**, **Discussion questions** and **Scripture readings** tables, and **Additional
     notes**.
- Type in the cream boxes and press Tab to move to the next one. Each table shows a few empty rows, and Excel's
  **+** button opens more. Drop-down lists are built into the cells.
- **Dashboard** fills itself in from the form:
  - **This meeting**, with how many days are left until it.
  - Tiles for Frames, Content, questions, scriptures and expected attendees.
  - Total, upcoming and recent meetings, counted from a **Recent meetings** log.
  - A **Readiness** checklist and a content-mix chart.
  - **Quick actions** that jump to the right place in the form.
- **Export this meeting to Excel** gives you the same two tabs, filled in and styled like the template. An export
  imports again.
- **Import** reads the Meeting Form. Each problem shows its section and row, for example *Meeting Form · Content ·
  row 26*. Workbooks from 6.5–6.8 still import.

#### One name everywhere
- FrameDecks is now the only name on screen, in files and in Windows:
  - the program, its folders and data files;
  - the Share Window (*FrameDecks Share Window*);
  - the start files, the recordings folder and the firewall rule.
- The first start of 6.9 moves your existing data, settings and recordings to the new names. It never overwrites
  anything.

### Enhancements
- **A cleaner top bar:**
  - The search box is gone. Search and commands are in the command palette (**Ctrl+K**) and Spotlight
    (**Alt+Space**).
  - The **Presentation Mode** button and the **Hide the app window** button are gone.
  - The Program menu always opens as a drop-down.
- **Hide All** and its **Esc** hint are now one button. They never overlap or get cut off, whether the window is
  normal, maximized, ultra-wide (3440 px) or on a high-DPI screen. Under 1140 px the bar wraps onto two rows.
- The meeting keeps more details: time, location, speaker contact, expected attendees, presentation owner and notes.
- The import preview shows the meeting's date, time, location and speaker.

### Fixes
- **The Teleprompter overlay and the other frameless windows** can again be moved by dragging, and resized from
  every edge and corner. Windows now runs the move and resize, so Snap works. You can drag the overlay from anywhere
  on it.

### Performance Improvements
- Nothing new runs in the background. The Dashboard is all Excel formulas, so the program does no work for it.
- The program fills the export in the template file itself, with no extra library. The file is about 50 KB.
- Less code loads at start-up:
  - the search box, Presentation Mode and the hide-window button are removed;
  - so are a hidden rail toggle and its styles.

### Known Issues
- Excel works out the Dashboard's formulas when it opens the file. Some file previewers, such as phone previews,
  show the tiles empty until the file is opened in Excel.
- The Meeting Form has room for 60 Frames, 150 Content items, 150 questions and 100 scriptures. A longer meeting
  exports as a plain one-sheet Meeting Form, which still imports.
- The installer is still not code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 6.8

### FrameDecks v6.8

Download **FrameDecks v6.8.exe** below and run it. It installs over earlier versions and keeps all your data.
Close Zoom, Teams and OBS first, because they keep the camera in use. A `.sha256` file is attached so you can check the
download.

### What's New

#### Teleprompter overlay (Meeting Leader mode)
- **Program → Teleprompter overlay** (or **Shift+R**, the tray, or Spotlight) opens your script in a see-through
  window you can place over Zoom, Teams or Google Meet. You still see the participants, shared screens and chat
  behind it.
- Five transparency modes: **Solid** (0 %), **Presenter** (20 %), **Meeting** (40 %), **Conference** (65 %) and
  **Ghost** (85 %). The more see-through it is, the stronger the outline around the letters, so the text stays easy
  to read. Press **1** to **5** to switch.
- **Frosted glass** blurs what is behind the overlay.
- **Stay on top** keeps it above Zoom, Teams, PowerPoint and browsers. The overlay remembers your choices.
- **It is never shared:** screen sharing and recordings leave the overlay out, even when you share your whole
  screen (Windows 10 version 2004 or later).
- The script uses nearly the whole width of the window. A small glass toolbar floats at the bottom and fades after
  a few seconds; move the mouse to bring it back. It has Play, speed, text size, line spacing, contrast, **Mirror**
  (for a teleprompter glass), the transparency modes, frost, stay on top and Exit.

#### A modern window
- The Windows title bar is gone. The app's own top bar is the ribbon: drag its empty space to move the window, and
  double-click it to maximize. Snap, resizing from the edges and the shadow work as before.
- The window buttons (**Minimize**, **Maximize / Restore** and **Close**) sit at the top right of every FrameDecks
   window and look the same everywhere.

#### Hide to the tray
- **Minimize** asks *Hide application to system tray?*: **Hide To Tray** or **Stay In Taskbar**, with **Remember my
  choice**.
- In the tray, FrameDecks keeps working: the camera, overlays, phone remote and shortcuts.
- The tray menu: **Open App**, **Teleprompter**, **Search**, **Settings**, **More** and **Exit**. Click the icon to
  open the app.

#### Spotlight, everywhere
- Press **Alt+Space** anywhere in Windows, even while FrameDecks is in the tray, to open Spotlight in the middle
  of your screen. It finds Frames, Content, questions and scriptures, settings and members, and runs commands.
- Go Live, Next / Previous Frame, Hide all, Blackout, Freeze and the Teleprompter run without bringing the main
  window back. **Frequently used** items appear with your recent ones.
- If another program already uses Alt+Space (for example PowerToys Run), FrameDecks uses **Ctrl+Alt+Space** and
  says so in Settings. You can choose another shortcut, or turn it off.

### Enhancements
- **Teleprompter window:** the script takes the whole width. **On screen & next** slides in from the right only when
  you ask for it. The controls float and fade like the overlay's.
- **Settings → General → Window and tray:** turn the modern window on or off, choose what Minimize does, pick the
  Spotlight shortcut, and set how the overlay looks.
- **Command palette:** a **Teleprompter overlay** command, and **Frequently used** items.

### Fixes
- None in this version: 6.8 adds features and changes no 6.7 behaviour except the window look.

### Performance Improvements
- Nothing new runs in the background. Spotlight is one window prepared at start-up and only shown and hidden, so it
  opens instantly. The overlay exists only while it is open, and the toolbar's timer runs only when you move the
  mouse.
- The floating toolbar takes about 4 % of the overlay window, and nothing while it is hidden.
- No new packages: the window features use Windows' own functions.

### Known Issues
- The see-through overlay needs the graphics card. With **Light on graphics card** on (the default), the overlay
  fades as a whole, text included. For solid text over your meeting, turn off **Settings → General → Performance →
  Light on graphics card** and restart. Turn on **Compatibility transparency** if your meeting does not show through
  on your PC.
- **Frosted glass** is Acrylic on Windows 11 (22H2 and later) and a plain blur on Windows 10.
- Alt+Space used to open the window menu of the program in front. With Spotlight on Alt+Space, choose another
  shortcut in Settings if you need that menu.
- If the ribbon ever misbehaves on your PC, turn off **Modern window** in Settings → General → Window and tray and
  restart. The Windows title bar comes back.
- In a web browser (not the installed app), the overlay cannot be see-through or stay on top.
- The installer is still not code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 6.7

### FrameDecks v6.7

Download **FrameDecks v6.7.exe** below and run it. It installs over earlier versions and keeps all your data.
Close Zoom, Teams and OBS first, because they keep the camera in use. A `.sha256` file is attached so you can check the
download.

### What's New

#### Teleprompter
- **Program → Teleprompter** (or press **R**) opens your script beside the Studio. Dock it **Left**, **Right** or
  **Bottom**, or let it **Float**, and drag its edge to resize it. Only you see it: no camera picture, overlay page or
  Presentation window ever shows it.
- The script is each Frame's **Teleprompter script** (Frame settings). It follows the Frame on screen, or the selected
  Frame while you rehearse.
- Scroll it automatically (five speeds, from Very slow to Very fast) or by hand, with the mouse wheel, touch or the
  arrow keys. Change the text size and line spacing, and switch on high contrast or Focus mode.
- Simple formatting: `# Heading`, `- bullet`, `**bold**`, `*italic*`, `[PAUSE]` cues and `---` dividers.
- A cue line shows where you are (Frame 3 of 9, LIVE), the next Frame and the next question or scripture.
- **Program → Teleprompter window** (formerly Speaker View) opens it in its own window for a second screen, with the
  clocks and the timer.
- On the phone: a Teleprompter panel on the Live tab, and a **TELEPROMPTER** button in the Simple remote that opens it
  full screen.

#### Edit everything where it is
- Double-click any card on the Studio Canvas to edit it in place: questions, scriptures, announcements, prayer points,
  discussion topics, icebreakers, polls, lower thirds and timers. Double-click the card's label (its top line) to
  rename the label.
- Double-click the name of a Frame or Content in the lists to rename it (or press **F2**). Double-clicking elsewhere
  on a Frame still puts it live.
- **Enter** saves, **Shift+Enter** starts a new line, **Esc** cancels, and clicking away saves. No pop-up windows.

#### Command palette
- Press **Ctrl+K** or **Ctrl+Space** to find anything and do anything: Frames, Content, the questions and scriptures
  in your Frames, announcements, templates, the Content Library, branding, settings, members, a Bible reference,
  recent items, and commands such as Go Live, New Frame, Duplicate, Teleprompter, Export the meeting or Switch theme.
- Change the keys in **Settings → Keyboard shortcuts → Command palette**.

#### Select many at once
- **Ctrl+Click**, **Shift+Click**, or drag a box in the empty part of the list, to select several Frames or several
  Content.
- Then **Delete**, **Ctrl+C** / **Ctrl+X** / **Ctrl+V**, **Ctrl+D** to duplicate, or drag them to a new place. The
  right-click menu has the same actions.
- Deleting shows **Undo**. Only deleting five or more asks first.

#### Branding options and Remove background
- Branding Content now has **Display** (Logo only, Name only, Logo + Name), **Position** (the four corners), **Size**
  (Small, Medium, Large), **Opacity**, **Padding**, a **Safe margin** from the edges, and the **background plate** on or
  off. Without the plate, a soft shadow keeps the logo readable on any picture. It looks the same at 720p, 1080p and 4K.
- **Remove background** (Settings → Meeting & Branding, or the Branding Content) makes a plain background around
  your logo transparent, on your PC, with Undo. Transparency your PNG already has is kept.

#### New Content
- **Discussion topic**, **Icebreaker** and **Poll** in **+ Content** and the Content Library. A poll shows the question
  and its choices for a show of hands.

### Enhancements
- The Inspector puts the most-used settings first: **Label**, **Content**, **Display Settings**, **Visual Settings**,
  with less scrolling and wider fields.
- Lists always show the label of each question or scripture.
- The Frame setting **Leader notes** is now **Teleprompter script**, with a larger box and room for up to 20,000
  characters.
- The header search box opens the command palette.

### Fixes
- Typing in an editor can no longer trigger a Studio shortcut (for example **K**, Blackout) by accident.
- Double-clicking a card on the live picture edits the card in front when cards overlap.

### Performance Improvements
- The main window starts lighter: the Excel library (930 KB) now loads only the first time you import, export or
  download a template. In our measurements, memory for the main window's scripts went from 10.8 MB to 4.0 MB, and the
  scripts it loads from 1,590 KB to 742 KB.
- The new features do no work while closed. The Teleprompter scrolls only while playing, and the palette builds its
  list in about 3 ms when opened.
- No new background requests. Details: [performance.md](../../development/performance.md).

### Known Issues
- **Answers and presenter notes are no longer shown anywhere.** Nothing was deleted: older meetings keep them, and
  answers and notes from older Meeting Workbooks are added to the Frame's Teleprompter script when imported.
- The docked Teleprompter is part of the Studio. On other tabs, use the Teleprompter window.
- On the phone, the Teleprompter is read-only. Edit the script on the PC.
- Remove background works on plain or near-plain backgrounds. A logo on a photo needs a transparent PNG made in a
  picture editor.
- A poll is display-only. FrameDecks has no voting from the audience's phones.
- The installer is still not code-signed, so Windows SmartScreen may ask you to confirm: **More info → Run anyway**.


## Version 6.6

### FrameDecks v6.6

Download **FrameDecks v6.6.exe** below and run it. It installs over earlier versions and keeps all your data.
Close Zoom, Teams and OBS first, because they keep the camera in use. A `.sha256` file is attached so you can check the
download.

#### Edit questions and scriptures on the canvas
- Double-click the question or scripture card on the Studio Canvas, in the preview or on the live picture. An editor
  opens over the card: **Enter** saves, **Shift+Enter** starts a new line, **Esc** cancels.
- If the card is on screen, the screen changes as soon as you save.

#### Speaker View
- **Program → Speaker View** opens a window only you see: the question or scripture on screen with its answer and
  notes, what comes next, the Frame's notes, the time, how long this Frame has been on screen, and a timer.
- Put it on a second screen, and you don't need the phone for your notes.

#### Reorder by dragging
- Drag questions and scriptures by their handle to reorder them. The ↑ / ↓ buttons still work.

#### Drawing from your phone
- The phone's drawing pad now shows the real live picture (exactly what Zoom / Teams see), not a black box, and
  sharper (960 pixels wide) while the pad is open.
- Turn the phone sideways and the picture fills the screen, with the tools in a narrow column at the side, for more
  accurate drawing.

#### Simpler Content Settings
- Where Content appears (FrameDecks, OBS pages) is set in one place: that Content's **Behavior** group. Frames no
  longer have a second, overlapping switch; your existing settings carry over.
- Text Content: **Show the title** sits right under the title.
- Timer: you see only the field for the way you count (minutes, or until a time).
- Branding: Position is set in one place.
- Scripture: the fetch selector is now **Fetch from**, so it is not confused with the scripture's own translation.

#### Excel
- Excel import is now only through **Meeting → Import meeting from Excel…** (the Meeting Workbook), which builds whole
  Frames. The Excel bar inside Question Content was removed.


## Version 6.5

### FrameDecks v6.5

This release makes FrameDecks meeting-first: a meeting is a set of **Frames**, and each Frame holds its own
**Content**. It adds ZoomIt-style annotation, a much simpler phone remote, PowerPoint files and an optional Excel
Meeting Workbook. The look of the app is unchanged.

Download **FrameDecks v6.5.exe** below and run it. It installs over earlier versions and keeps all your data.
Close Zoom, Teams and OBS first, because they keep the camera in use. A `.sha256` file is attached so you can check the
download.

#### Frames and Content
- *Scenes* are now **Frames** and *layers* are now **Content**. Your existing meetings open as before.
- **+ Frame** adds a blank Frame. Select it, then **+ Content**: Question, Scripture, Text, Image, Video, Timer,
  PowerPoint, or Free Content (announcement, prayer, lower third, camera, screen, window, logo, shape…).
- **Every Frame owns its Content.** Questions and scriptures belong to the Frame they are in, with their own labels.
  **Duplicate** makes a completely separate copy.

#### One Content Settings panel
- No more Basic / Advanced: every setting is in one panel, in groups (Content, Appearance, Position, Timing,
  Animation, Media, Behavior).
- Questions and scriptures are a full-height list. Double-click one to edit it in the same panel, with its label,
  answer, notes and transition. Changes save as you type.
- The pinned-question section was removed.

#### Annotate and Freeze
- **Annotate (D):** pen, highlighter, arrow, line, rectangle, ellipse and text, six colours, three thicknesses, undo,
  redo and clear. The drawings are above everything, and everyone in Zoom or Teams sees them. Esc hides them.
- **Freeze (F)** holds the picture while you get ready. You can still draw on it.

#### PowerPoint
- **+ Content → PowerPoint** takes a .pptx (or a PDF). The PowerPoint on your PC turns it into slides; step through
  them from the command bar, Page Up / Page Down or your phone. Choose the slide to start at.
- **Show objects only** makes a plain slide background see-through, so text and pictures sit on your camera.
- Want animations? Add the running slide show window as Content. Details and limits: `docs/powerpoint.md`.

#### Phone remote
- **Simple remote** is the new default: Frame 4 of 18, Previous / Next Frame, Current Content with Previous / Next
  Content, Annotate (draw with your finger), Black Screen and Freeze, with very large buttons and the connection
  status always visible.
- **Advanced remote** adds search across Frames and Content, presenter notes and answers, PowerPoint slides and a
  Run-through that lets you step through Frames without changing the screen.

#### Excel Meeting Workbook (optional)
- **Meeting → Download the Excel template**: five sheets (Meeting Overview, Frames, Content, Questions, Scriptures)
  with drop-down lists and examples.
- **Import meeting from Excel…** shows every problem with its sheet and row, then Append or Replace, with Undo.
- **Export this meeting to Excel** at any time. After an import the app is the source of truth.

#### Removed
- **Team Space** (co-leader collaboration over WireGuard) was removed. FrameDecks has no accounts, shared
  workspaces or cloud. Local save, autosave, daily backups, export and version history are unchanged.
  The `kc-teamspace*.json` files from v6.4 are no longer used and can be deleted.

#### Known limits
- Audio and Web Page rows in the Meeting Workbook are skipped (with a note) because the app has no Audio or Web Page
  Content yet.
- Turning a .pptx into slides needs Windows with PowerPoint installed; otherwise save the deck as PDF and add that.
- Show objects only is a colour key, not true transparency: gradient or picture backgrounds stay visible.


## Version 6.4

### FrameDecks v6.4

This release adds **Team Space**, which connects co-leaders' PCs directly to each other. It also renames the camera to
**FrameDecks**, shows only the Book + Candle logo as the app's branding, and makes the window behave like a
proper desktop app.

Download **FrameDecks v6.4.exe** below and run it. It installs over earlier versions and keeps all your data.
Close Zoom, Teams and OBS first, because they keep the camera in use.

#### Team Space: co-leaders, directly between your PCs
> **Team Space is available only when authorized peers are online through a secure WireGuard network. No cloud
> relay or third-party server is required.**

- Press **Team** in the command bar to see:
  - your co-leaders, **Online** or **Offline**;
  - **shared notes**;
  - a shared **action list**;
  - **Ask to Go Live**.
- **Ask to Go Live:** pick an online co-leader and one of their scenes. Their PC asks them to **Approve & Go Live** or
  **Decline**. Nothing goes on air without their approval.
- How it works:
  - Each PC talks straight to the others over your team's WireGuard network, which encrypts everything end to end.
  - Every message is also signed with your team key, and only the WireGuard addresses you list are accepted.
  - Notes and actions sync only while co-leaders are connected. Nothing is queued, relayed or stored anywhere else.
- To set it up, install WireGuard, then fill in **Settings → Team Space**:
  - this PC's WireGuard address;
  - the team key;
  - your co-leaders' addresses.

  Step by step: `docs/configuration-guide.md`.

#### The camera is now called FrameDecks
- Zoom, Teams, Google Meet, OBS and other apps list the camera as **FrameDecks**. Restart them once after
  installing.
- It is the same camera with the same ID, so your apps keep their choice. If you had the camera before, it is renamed
  automatically, even if you don't tick the option this time.
- In OBS, a source that used the camera under its earlier name may need to be pointed at FrameDecks once.
- In the app it is **Settings → FrameDecks Camera**.

#### Logo only
- The command bar shows just the **Book + Candle** logo, with no name beside it. Hover over the logo to see your
  Meeting Name, which is also in the window title.
- The phone remote's sign-in screen and top bar show only the logo, and its home-screen icon is the logo without
  text.
- The About page is unchanged.

#### A real desktop window
- No address bar, tabs or browser controls. Windows' Minimize, Maximize/Restore and Close stay.
- The title bar follows the app's dark or light theme. On Windows 11 it takes the command bar's colour.
- Browser keys and menus that don't belong in an app are switched off:
  - reload, print, view source and zoom keys;
  - the browser right-click menu outside text boxes;
  - a dropped file replacing the page.
- On a PC without WebView2, the app opens as an Edge app window (still no address bar or tabs) instead of a browser
  tab.

#### New guides
- **User Guide**: `docs/user-guide.md`
- **Installation Guide**: `BUILD-AND-INSTALL.md`
- **Configuration Guide**: `docs/configuration-guide.md`
- **Feature Documentation**: `docs/features.md`

#### Unchanged
- The tabs (Studio · Members · Settings).
- The About page.
- Your data folder, phone remote, overlays, Excel import and branding.

#### Known limitations
- Team Space needs WireGuard set up between the PCs, and both PCs online at the same time. Without a WireGuard
  connection it is unavailable by design.
- The PCs' clocks must agree within 2 minutes.
- The camera is a Windows DirectShow camera. Apps that read only Media Foundation cameras may not list it.
- Tested in a development environment: Team Space between two simulated PCs, the camera rename in the build. Please
  confirm on your PCs with your WireGuard tunnel, Zoom, Teams, Meet and OBS.


## Version 6.3

### FrameDecks v6.3

A cleaner Studio with more room for the picture, and a phone remote anyone can use.

Download **FrameDecks v6.3.exe** below and run it. It installs over earlier versions and keeps all your data.

#### One command bar
- The top bar and the bottom live bar are now **one bar at the top**:
  - **Studio · Members · Settings** and search on the left;
  - **◀ · GO LIVE · ▶**, the transition, Auto and the question stepper in the middle;
  - the status and **HIDE ALL** on the right.
- On narrower screens, labels become icons and **Hide layer · Blackout · Emergency** move into **Program ▾**. The
  Program button turns red and says BLACKOUT or EMERGENCY while one of them is on. GO LIVE and HIDE ALL never fold
  away.
- The picture gets the height the bottom bar used to take, about 67 px on a 1366×768 laptop.

#### Panels you can size
- The layout follows your sketch: **Scenes** above **Layers** on the left, the **Preview** above the **Inspector**
  on the right.
- **Resize:** drag any border between panels, or use the arrow keys on a selected border. Double-click a border to
  reset it.
- **Fold:** the small buttons in a panel's header fold it down to that header; click the header to open it again.
  The **‹** next to "Scenes" hides the whole left column.
- **Layout menu** (in the preview toolbar) has:
  - **Auto-hide the Inspector**: it opens over the preview while you use it;
  - **Preview only**: the preview fills the window and the top bar stays;
  - **Presentation Mode**;
  - **Reset the layout**.
- When the Inspector is wide, its settings flow into columns.
- Your sizes are remembered on this PC.

#### Phone remote: Simple, Standard, Advanced
The phone layouts are renamed and Simple is redesigned. Your saved choice carries over.
- **Simple:** the live scene, its picture, and two very large buttons at the bottom of the screen, **Previous
  scene** and **Next scene**. The question stepper appears when the scene has one, and HIDE ALL stays at the top.
- **Standard:** Go Live, the scenes, transitions and the Question / Scripture switch.
- **Advanced:** everything, including layers, Blackout and Emergency.

#### Design review
The full UX review and the roadmap are in `docs/project/history/framedecks-redesign.html`. It covers the command bar
options, wireframes, the collaboration and security design, the remote modes and the scorecard. The team chat and
the device pairing described there are proposals for later releases. They are not in 6.3.

#### Known limitations
- Below 1081 px wide, the Studio uses the stacked layout, so its panels can't be resized.
- Tested in a development environment. Please confirm on your PC and phone.


## Version 6.2

### FrameDecks v6.2

This release adds three things: **your own branding**, **one Excel file for a whole meeting**, and a single
**Go Live** button.

Download **FrameDecks v6.2.exe** below and run it. It installs over earlier versions and keeps all your data.

#### Your branding: Settings → Meeting & Branding
- Enter your **Meeting Name** and **Leader / Organization Name**, upload your **logo** (PNG, JPG or SVG), and if you
  like choose an **accent colour**. The accent replaces the gold of the cards on Zoom, Teams and OBS.
- You choose where your branding appears:
  - Tick the scenes that show the **Branding badge** (your logo and Meeting Name), or use **Brand every scene**.
  - In the Studio, a scene's Inspector has a **Branding** switch, and **+ Layer → Branding** adds the badge to the
    selected scene.
- Your names in your own text:
  - type **{meeting}** or **{org}** in any Announcement, Prayer, Lower Third or Countdown, and it is replaced by your
    names on screen;
  - **Show my logo on this card** puts your logo on that card.
- There are two new branded templates in the Library and in Settings: **Meeting Title** and **Meeting Lower Third**.
- **Export this meeting (Excel)** saves your meeting in the template format, with your Meeting Name on it, to share
  with co-leaders.
- The window header shows your Meeting Name. If you had set a meeting title in General before, it is copied over.

#### One Excel file builds your whole meeting
- **Studio → + Scene → Download the Excel template.** It has a **Read Me** sheet, a **Meeting Content** sheet with
  example rows (questions, verses, Question + Verse, text, an image, PowerPoint, a branded lower third) and an
  **Allowed Values** sheet. A copy is also in `docs/templates/`.
- Fill in one row for each layer; rows with the same **Scene Name** become one scene. The columns are:
  - Scene Name, Scene Order, Layer Name, Layer Type;
  - Question Text, Verse Reference, Verse Text, Text / Caption, Notes;
  - Branding, Show Logo, Show Meeting Name;
  - Background Style or Template, Layer Order, Status.
- **Studio → + Scene → Import meeting from Excel…** shows a preview first:
  - how many scenes and layers will be made;
  - each problem with its **row number** (Import stays off until they are fixed);
  - notes, such as which pictures or slides to choose afterwards.
- If you already have scenes, choose **Append** (keep them), **Replace** (start over; your saved templates stay) or
  **Cancel**.
- Import creates everything in the right order: scenes, layers, questions and verses (also added to your lists),
  combined Question + Verse scenes and branding. Empty verse text is filled from the ESV if you have a key.
  **Undo this import** puts everything back.

#### Go Live
- The bottom bar has one clear action: **Go Live**. "Take live" and "Take again" are gone from the bar, the
  Inspector, the scene menu and the phone remote.
- When the selected scene is already on screen, the button still says Go Live and shows **● On air: <scene>** under
  it. After you press it, the canvas outline flashes green, the canvas and the scene show **LIVE**, and a message
  confirms what is on air.

#### Unchanged
The tabs (Studio · Members · Settings), the About section, and everything else from 6.1.

#### Known limitations
- Pictures, videos, slides and PowerPoint can't be inside an Excel file. Those layers are created empty, and you
  choose the file or window in the Studio; the preview tells you which ones.
- A scene shows one Question, one Verse and one Branding badge. In Excel, give the next question its own scene.
- The logo is stored on this PC (not in exported Excel files).
- Tested in a development environment. Please confirm on your PC with your own logo and file.


## Version 6.1

### FrameDecks v6.1

**The program gets its current name, FrameDecks**: *Christ-Centered Fellowship. Connecting Believers. Sharing Christ.
Growing Together.* This release brings the new name and logo, a new About page, one navy-and-gold design across the
app and the phone remote, and six features that make leading a gathering quicker.

Download **FrameDecks v6.1.exe** below and run it. It installs over earlier versions (including every version
published under the program's earlier name) and keeps all your data.

#### The new name: what changes, and what stays the same
- The window, Start menu and desktop shortcuts, the installer and the phone remote now say **FrameDecks**.
  Old shortcuts with the earlier name are replaced automatically.
- **The Zoom / Teams camera keeps its earlier name** for now, so there is nothing to re-select in Zoom or Teams.
- Your data folder, settings, members, recordings and the phone-remote firewall permission stay where they are.
- A phone remote already added to the home screen keeps its old name and icon until you add it again.

#### About page
Open it from **Settings → About** or by clicking the logo at the top left. It explains the mission and vision, why
FrameDecks exists, who it serves, its values and its ministry impact. A Scripture card rotates through
Hebrews 10:24–25, Colossians 3:16, 2 Timothy 2:2, Acts 2:42 and Matthew 28:19–20 (ESV). The page also has the
founder's story, our commitments, and **Start a Session** / **Contact Us** buttons. A faint world map with a
"fellowship network" moves slowly behind the title; it uses almost no computer power.

> **Please review:** the founder story and ministry journey are a **draft** written from three facts (Enterprise IT
> Consultant, Bible Study Leader, Follower of Jesus Christ). Replace them with your own words in
> `app/js/brand.js` (`creator.story` and `creator.journey`) before you share this version.

#### Six new ways to lead with fewer clicks
- **Quick Start:** the new **Quick Start** button (Scenes) makes a complete set of six scenes for a **Bible Study**,
  **Prayer Meeting**, **Youth Gathering** or **Fellowship Meeting** in one click. Each set goes in its own group,
  for example "Bible Study · Oct 13".
- **Presentation Mode:** the button at the top, or **P** (you can change it in Settings → Keyboard shortcuts). It
  shows only the scene list, the canvas, and Previous · Take live · Next. The Inspector, Layers, menus and other
  controls are hidden. **HIDE ALL stays visible on purpose.** The earlier "Presentation Mode" window for Zoom screen
  sharing is now called **Share Window**.
- **Content Library:** the Scenes list's **Library** filter (it replaces "Templates") has 16 ready-made scenes in
  five groups: Welcome, Prayer, Discussion Questions, Scripture Layouts (including a Benediction, Numbers 6:24–26)
  and Closing. Your own templates are listed there too. Select **+ Add** to add one after the selected scene.
- **Question · Scripture · Q + S** pill on every scene card that has both a question and a verse. One tap changes
  what the scene shows. On the live scene it changes the screen at once.
- **Duplicate → Edit question → Done:** **Ctrl+D**, or ⋯ → Duplicate & edit question, opens the copy with its
  question ready to edit. There is a one-click "Next in the list" choice. **Done** adds the question to the list
  after the original and pins it to the new scene. "Romans Day 5" becomes "Romans Day 6" as before.
- **Basic / Advanced Inspector:** Question, Scripture, Birthday and text layers open in **Basic** mode, which has
  three tabs: Content, Style (Label, Theme, Position) and Output. **Advanced** has everything else: text size,
  width, card opacity, animation and the other settings. Themes: Classic, Bold, Soft and Large print.

#### Design
- Navy and gold everywhere, in dark and light themes: a gold wordmark, calmer surfaces and editorial serif headings.
  Selection uses the brand colour; green still means live and red still means hide.
- Nothing heavier was added: no blur, video backgrounds or particle effects.
- On the About page, the only motion is three faint layers fading in and out. That work is done by the graphics
  hardware, not the main processor. Measured with the About page open: no layout work and about 0.4% main-thread
  time.

#### Not in this release
- Card themes are looks made from the existing settings (card opacity + text size). There are no new colour schemes
  for the cards yet.
- The Content Library is built in. It cannot be shared between computers or downloaded.
- Remote layouts (Presenter / Leader / Admin) are unchanged.
- Everything listed under "Not in this release" for 6.0 still applies: NDI, RTMP, separate cameras, GPU blur and
  translations other than ESV.

#### Known limitations
- Tested in a development environment with a simulated webcam, PowerPoint and ESV service. Please confirm on your PC.
- The logo was cut from the image you supplied. The Windows icon uses only the emblem, because the text is
  unreadable at 16–48 px.


## Version 6.0

### Version 6.0

**Scenes · Layers · Canvas.** The program now works around three ideas: a *scene* is something you put on screen, a
*layer* is one thing inside it (a question, a verse, a camera, a lower third …) and the *canvas* is what Zoom,
Teams and OBS receive. The Meeting, Content, Canvas and Recordings tabs and the run sheet are gone as separate
places - everything they did now lives in one Studio screen.

Download the **v6.0** installer below and run it. It installs over earlier versions and keeps all your data.

#### Your existing setup moves over automatically
The first time 6.0 opens, it builds scenes from what you already had: a **Bible Study** scene (your question list,
your verse and the current Studio picture), a **Birthday** scene, and one scene for each saved Studio scene (with its
camera, screen, image, slide and text layers). Members,
birthdays, imported question lists, settings, recordings, camera and blur settings are untouched.

#### Where things went
| Before | Now |
| --- | --- |
| Meeting tab, run sheet | Studio: the **Scenes** list (left) and the **Live bar** (bottom) |
| Content tab (questions, verses, import) | Select the Question or Scripture layer → Inspector → **Content** |
| Settings → Overlays (size, width, position) | Inspector → **Style** / **Layout** / **Animation** of that layer |
| Canvas tab | The **Studio Canvas** in the middle |
| Recordings tab | Settings → **Recording** |
| Birthday settings | The Birthday layer's Inspector (reminders stay in Settings → Birthdays) |

#### Studio
- **Scenes (left):** search, All · Favorites · Recent · Templates, groups, drag to reorder. Double-click (or **T**)
  takes a scene live. The ⋯ menu: take live, duplicate, smart duplicate, save as template, structure only, variant,
  move to group, one scene per question / verse, rename, export, delete.
- **Smart duplicate:** choose what to copy (layers, layout, branding, animations, transitions, outputs) and whether
  to keep the content, empty it or copy content only. Names count up: "Romans Day 5" → "Romans Day 6".
- **Templates:** Bible Study, Scripture, Question, Question + Scripture, Birthday, Announcement, Prayer, Slides,
  Media, Countdown, Zoom, Teams, Blank - plus your own.
- **Version history:** every scene keeps its creator, created / modified time, version and where it came from.
- **Layers:** show / hide (eye), lock, rename, duplicate, forward / backward, delete, drag. New light layers:
  **Announcement, Prayer point, Countdown, Lower third** (plus Logo / Watermark as image layers).
- **Run sheet → both ways:** a Question or Scripture layer still steps through its whole list (Live bar ◀ ▶), *and*
  "One scene per question / verse" explodes a list into separate scenes.
- **Inspector (right):** changes with what you select - Content · Style · Layout · Animation · Output for a layer;
  Scene · Transition · Output · History for a scene.
- **Live bar (bottom):** Previous scene · **Take live** · Next scene, transition override, Auto advance, the list
  stepper, slides, Hide selected layer, **Blackout**, **Emergency** (Shift+click to change the message) and HIDE ALL.

#### Transitions
Per scene (cut, fade, dissolve, dip to black / white, slide, push, reveal, zoom fade, soft scale, blur fade,
cinema, church) with a duration, plus global **profiles** in Settings → Transitions: Sunday Service, Bible Study,
Youth, Conference, Wedding, Funeral, Christmas, Livestream. The camera plays the real transition; the overlay pages
(OBS) fade, slide or dip their cards to match.

#### Scripture
- Type a reference in any form (`rom 2:29`, `Romans 2.29`, `1 cor 13:4-7`) and press Enter. The program fetches the
  **ESV** text, fills the Scripture layer, and keeps it in an offline cache (the last 400 passages) so it still
  works without internet.
- Refresh, show the whole chapter for context, read aloud, recent and favourite references.
- **Setup:** get a free API key at api.esv.org (churches and ministries qualify), then Settings → Scripture →
  paste it → Save & test. The key stays on this PC and is never sent to the phone remote.
- Other translations: choose "Typed / Excel" and type, paste or import the text as before.

#### Outputs
Each scene and each layer has an Output tab: **the camera** (Zoom · Teams) and/or **overlay pages** (OBS / browser).
The status bar shows whether the camera is in a meeting.

#### Mobile Director
- **Phone:** Live (the canvas, Previous · Take live · Next, transition, Question / Q + Scripture / Scripture,
  stepper, slides, Hide layer, Blackout, Emergency) · Scenes (tap to select, ● to take live, ⋯ to duplicate or make
  a variant) · Layers (eye to show or hide).
- **iPad / Android tablets:** three panes - Scenes | Canvas + controls (with a Next scene preview) | Layers.
- HIDE ALL stays at the top. Layouts (Presenter · Leader · Producer / Admin) from the ⋯ button.

#### Performance
Scene changes write one small state update; the vCam effects (text layers, transitions, blackout) add about
0.9 ms per 720p frame. Panels redraw only what changed; Recordings load only when you open that Settings page.

#### Not in this release
Asked for in the brief but not built, so nothing here pretends to have them: NDI output, RTMP streaming, separate
Zoom / Teams / OBS cameras (the built-in camera is the one camera both Zoom and Teams use), GPU blur, translations other than
the ESV (type them or import from Excel), translation compare, cross references and keyword highlighting, blend
modes, layer groups, stage display / confidence monitor, Face ID and per-role permissions (remote layouts are a
display preference; the PIN still controls access), iPhone haptics.

#### Known limitations
- On the camera, Announcement / Prayer / Countdown / Lower third layers are drawn in the question-card style.
- Overlay pages imitate slide and push transitions by moving the cards; the full-picture versions are on the camera.
- Tested in a development environment with a simulated webcam, PowerPoint and ESV service; please confirm on your
  PC and devices with your own ESV key.


## Version 5.1

### Version 5.1

The Command Center layout: one command bar on top, the production panel on the left, the run sheet and the live
picture in the middle with every output's health under it, an Inspector on the right and the command bar along the
bottom - plus **Mobile Director**, a redesigned phone and tablet remote.

Download the **v5.1** installer below and run it. It installs over earlier versions and keeps all your data.

#### Everything you could do before still works
Every feature, button action, shortcut, setting, output, virtual-camera and blur workflow and every remote
capability from 5.0 is kept. Nothing about your content, scenes, members or settings changes.

#### Desktop
- **Command bar:** your group name ("NLFM Command Center"), the meeting title, Studio · Members · Settings (same
  Alt+1–4), search (Ctrl+K), **LIVE**, and status chips for the camera (Zoom · Teams), overlay pages, the remote -
  plus Recording and Slides while they are running. Each chip opens its settings. On laptop screens the chips fold
  into one status button.
- **Search** now also finds birthdays, scenes, PDF slide decks and Settings pages (e.g. "blur" → the camera settings).
- **Production panel (left):** Scenes; **Broadcast layers** - the Verse, Question and Birthday cards at the top of
  the stack with Live / Ready state and a show/hide eye; your Studio layers with quick add (Text · Image · Camera ·
  Slides) beside the full Add layer menu; and a **Library** with every kind of content and its count.
- **Live outputs** under the picture: the camera (size, fps, latency, dropped frames), overlay pages, the
  Presentation window, Recording, Slides and the remote - always visible, never hidden in Settings.
- **Inspector (right):** choose the editing target (Question · Verse · Birthday). *Content* shows the mode
  (Question · Both · Verse), the question with its verse, nearby verses as one-click chips, "Show will display", the
  next item, Edit in Content and Clear. *Style & position* has text size, width, position, transition and card
  opacity - the same settings as Settings → Overlays.
- **Take live** in the command bar shows (or hides) whatever the Inspector is on. Shortcut **T** (change it in
  Settings → Keyboard shortcuts). All the old command-bar buttons and keys are where they were.
- Calmer, cooler dark theme with one blue accent for "selected" (light theme updated to match); green = live,
  red = hide.

#### Mobile Director (phone & tablet remote)
- **Phones:** tabs at your thumb - **Live** · Run sheet · Scenes · Preview · All. Live shows what is on screen
  now, one-tap Question / Verse / Birthday buttons, the slide and scene, and big Prev · Show · Next for the item you
  pick (Question · Verse · Birthday · Slides). The Question · Both · Verse selector stays directly above Show.
- **Run sheet:** the full list with Live / Ready / Next / done markers; tap to put an item on screen.
- **Tablets (iPad, Android tablets):** a control surface - the run sheet on the left; on the right, On screen now,
  the live preview and every control at once.
- **Layouts:** Presenter, Leader, Producer or Admin decide what this device shows (the ⋯ button).
- HIDE ALL stays at the top of every screen. Presses still confirm with a short vibration on Android.

#### Performance
- New panels only redraw what changed. Next / Show with a 1,000-item list: about 20 ms of work per step (5.0:
  about 11 ms; 4.8: about 700 ms). The slide number is asked every 5 s, and only while the Meeting view is on screen.
- The phone preview runs only on the Preview tab, to save battery.

#### Not in this release
Requested in the brief but not built, so nothing here pretends to have them: separate Zoom / Teams / OBS / NDI
camera sources (the built-in camera is the one camera both Zoom and Teams use), streaming status, announcements, prayer points,
countdowns, stage display / confidence monitor, a blackout screen (HIDE ALL is the emergency control), Face ID
sign-in and per-role permissions (layouts are a display preference; the PIN still controls access). Blur is unchanged
from 4.9 (Natural style, 0.001 precision).

#### Known limitations
- Tested in a development environment with a simulated webcam and PowerPoint; please confirm on your PC and devices.
- iPhone/iPad Safari does not allow web pages to vibrate, so haptic feedback works on Android only.
- An already-installed home-screen remote keeps its old name until you add it to the home screen again.


## Version 5.0

### Version 5.0

A calmer, simpler Command Center: one header line, one main picture, one details panel and one action bar -
plus **Question · Both · Verse**, a new way to show a discussion question together with its Bible verse.

Download the **v5.0** installer below and run it. It installs over earlier versions and keeps all your data.

#### Highlights
- **Presentation mode: Question · Both · Verse.** Choose what Show puts on screen: the question, the question with
  its verse, or the verse. One selector - in the Meeting details, the action bar, the Content editor and the
  phone/iPad remote (directly above Show). On screen, a change shows at once; otherwise "Show will display" previews it.
- **One way to do each thing.** Prev / Show / Next live in the action bar only; Hide all appears once; the Look,
  scene picker and collection filter are no longer repeated.
- **Header:** search (Ctrl+K) · one LIVE indicator · one status button.
- **Excel:** a single `PresentationMode` column (QUESTION / BOTH / VERSE) in import, the template and the new
  **Export to Excel**.

#### Question · Both · Verse
- **Both**: the question leads, the verse supports it - the question is a little larger, the verse a little smaller
  (overlay pages and the camera alike). Long verses still shrink and reflow to fit above the question.
- The verse used is the one imported on the same Excel row as the question; otherwise the verse already loaded.
- Each question remembers its mode (from Excel, or when you change it). Questions without a mode use the mode you
  chose last - and if you never touch the selector, everything works exactly as before (Question only).

#### Simpler screens
- **Meeting view:** run sheet · the picture participants see (largest) · a details panel with one tab each for
  Question, Verse and Birthday (it follows what you operate in the action bar).
- **Content:** each editor shows its text and Show; transition, speed and label settings are under
  "Style & transition"; list rows show Show and reveal move / remove / effect on hover or keyboard focus;
  "Remove all" and "Add several" are under "More".
- **Canvas:** the toolbar shows the active scene (scenes are chosen in the Scenes list beside it).
- **Status:** the four checks (Program, Overlays, the camera, Remote) are in one button; its colour shows the worst.
- About is in Settings → About.

#### Where things moved
| Before | Now |
|---|---|
| Meeting view Prev / Show / Next buttons | Action bar (keyboard hints shown there) |
| Header Hide all | Action bar Hide all (Esc unchanged) |
| On-air pills under the header | LIVE indicator in the header |
| Four status chips | Status button (click for details) |
| Header About | Settings → About |
| Look picker in Meeting / Canvas | The camera's Settings page (and Ctrl+Alt+1/2/3/0, tray) |
| Canvas scene / collection pickers | Scenes list beside the canvas |
| Content Hide / Clear / Previous / Next | Action bar, and Clear in the Meeting details |

#### Background blur
- 0.001 % precision and the Natural style from 4.9 are unchanged (the camera's Settings page).

#### Compatibility
- Every feature, shortcut and setting from 4.9 is kept; your content, scenes, members and settings carry over.
- The phone/iPad/Android remote keeps every control; it gains the Question · Both · Verse selector above Show.
- Overlay pages, the camera, Studio, PowerPoint control and the remote APIs are unchanged; questions get one optional
  field (`mode`) that older versions simply ignore.

#### Known limitations
- Tested in a development environment with a simulated webcam and PowerPoint; please confirm on your PC.
- Both mode needs a verse: a question with no linked verse uses the verse already loaded (or shows the question only).


## Version 4.9

### Version 4.9

One Studio for the whole meeting: scenes, layers, the run of the meeting and your content side by side, live
controls always one click away, a quieter and more natural background blur, and Dark or Light appearance.

Download the **v4.9** installer below and run it. It installs over earlier versions and keeps all your data.

#### Highlights
- **Three tabs: Studio · Members · Settings.** *Meetings & Content* now lives inside the Studio.
- **Studio workspace.** On the left: **Scenes** (on top) and the OBS-style **Layers** list, visible in every Studio
  view. On the right: **Meeting** · **Content** · **Canvas** · **Recordings**. "Scenes & Layers" folds the left
  side away when you want more room.
- **Control bar** along the bottom of every tab: Question ◀ Show ▶ · Verse ◀ Show ▶ · Birthday Show ·
  Slides ◀ ▶ · Hide all. It uses exactly the same actions as the Meeting view.
- **Natural background blur** with 0.001 % precision.
- **Appearance:** Dark (default), Light, or Match Windows (Settings → General).

#### Studio improvements
- Scenes and Layers stay on screen while you run the meeting or edit content; the Canvas view keeps the live
  canvas with the Inspector beside it.
- The Meeting view now fits the space beside the left side (three columns down to laptop widths, then
  controls-first as before on small screens).
- Focus mode hides the left side and the control bar for the largest canvas.

#### Navigation improvements
- **Shortcuts unchanged:** Alt+1 opens the Meeting view, Alt+2 the Canvas, Alt+3 Members, Alt+4 Settings - the
  same places as before.
- All "go to" links (e.g. *Edit content*), the startup view (Meeting) and your last-used views are kept; settings
  remembered by 4.8 are carried over.

#### UI/UX improvements
- New neutral design system: calm graphite surfaces (or a clean light theme), one warm accent, a 8/12/16/20 px
  corner scale, consistent type sizes, soft shadows, subtle press feedback. Video surfaces stay dark.
- Large, high-contrast, keyboard-reachable buttons in the control bar.

#### Blur improvements
- **Precision:** strength 0.001 % … 100 % in 0.001 steps. Type an exact value, nudge with − / + (0.001; hold
  Shift for 0.1), or use the slider, which gives half its travel to 0 – 25 % where subtle settings live.
  Values are stored exactly (no rounding drift), and the slider never jumps back while you adjust it.
- **Natural style (new default)** - like a lens focused on you, not a filter:
  - below 10 % the blur fades smoothly to nothing (before, even 0.1 % was a 16-pixel blur);
  - no halo: your colours no longer smear into the background (about 70 % less colour bleed in tests);
  - the background is softened right up to your outline, with a soft edge that grows with strength and a gentle
    depth gradation;
  - presets keep their amount: Light 30, Medium 55, Strong 80, Maximum 100.
- **Classic style** keeps the exact picture of earlier versions (the camera's Settings page → Blur style).

#### Performance improvements
- **Next / Show with a large list:** with a 1,000-item question/verse list, each step blocked the window for about
  0.7 s (and made a quick double-click land as two steps). It now takes about 25 ms. Hidden lists are no longer
  redrawn on every change, and the run sheet updates only the rows that changed.
- The Studio refreshes scenes and layers every 3 s while they are visible (every second with the Canvas open) and
  stops on Members / Settings or when minimised. No backdrop blur or endless animations anywhere in the new design.

#### Compatibility notes
- **Phone, iPhone, iPad and Android remote: unchanged.** The remote page, its scripts and styles, and every
  remote API are identical to 4.8.
- Your settings, scenes, layers, content, members and saved blur strength carry over. Saved blur values with one
  decimal stay exactly as they were.
- The camera picture, overlays and OBS/Camo links are unchanged; the appearance setting only changes this window.

#### Testing summary
- Navigation, Studio views, Meeting, Content (show, step, edit, reorder), control bar (same actions and
  double-click guard), keyboard shortcuts, theme persistence: automated browser tests, no console errors.
- Blur: exact Classic match with 4.8; 0.001 entry, nudging, slider, presets, save and reload; Natural timing within
  the same budget as Classic at 720p.
- Mobile remote on phone, small phone, phone landscape and tablet: all 4.8 tests pass unchanged; phone → overlay
  in about 0.14 s.
- PowerPoint control, camera pipeline and settings: all earlier tests pass.

#### Known limitations
- Tested in a development environment with a simulated webcam and PowerPoint; please confirm on your PC with a real
  webcam, PowerPoint, and Zoom or Teams.
- The Meeting view needs about 1,100 px of width beside the left side for three columns; on smaller windows it
  switches to the controls-first layout (or fold Scenes & Layers away).
- Light appearance applies to this window only; the phone/iPad remote keeps its own dark design.

