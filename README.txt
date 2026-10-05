================================================================
  BSF COMMAND CENTER  ·  version 3.2.2
  Clean Bible study overlays for BSF leaders on Zoom.
================================================================

Created by Shobin Mathews, an enterprise IT consultant and active
BSF member who builds practical tools for BSF online groups.
Questions or feedback: mshobin@gmail.com
(In the app: select "ⓘ About" at the top, next to the name.)

BSF Command Center is an independent tool created by Shobin
Mathews. It is not officially affiliated with, endorsed by, or
produced by Bible Study Fellowship International.

Everything runs on your own computer. No internet connection,
cloud account, paid service or API key is needed.


----------------------------------------------------------------
THE INSTALLED WINDOWS APP (recommended)
----------------------------------------------------------------

  This folder can be turned into a normal Windows program with its
  own window, a desktop icon and an icon near the clock. See
  BUILD-AND-INSTALL.md for step-by-step instructions (GitHub builds
  the installer for you). Everything in this README applies to both
  the app and the start files below. The differences:
    - The app keeps your data in %APPDATA%\BSF Command Center
      (Settings > Data / Backup shows it) and backs it up daily.
    - Closing the app window lets it keep running in the background,
      so overlays keep working. Quit from the icon near the clock.


----------------------------------------------------------------
BCC vCam: THE BUILT-IN CAMERA (installed Windows app)
----------------------------------------------------------------

  The Command Center has its own camera for Zoom and Teams, called
  "BCC vCam". No OBS or Camo is needed for it.
    - In Zoom: Settings > Video > Camera > BCC vCam.
      In Teams: Settings > Devices > Camera > BCC vCam.
    - Background blur (Off / Light / Strong) and the webcam choice
      are in Settings > BCC vCam. Use this blur instead of Zoom's
      or Teams' own blur (theirs would also blur your overlay cards
      once they appear on BCC vCam).
    - Your laptop webcam only switches on while Zoom, Teams or the
      preview is using BCC vCam.
    - The verse, question and birthday cards are being added to
      BCC vCam next. Until then, keep using the OBS or Camo links
      for the cards.


----------------------------------------------------------------
BEFORE MY ZOOM MEETING (checklist)
----------------------------------------------------------------

  [ ] Open BSF Command Center. If you will use your phone or iPad,
      turn on Settings > Phone & iPad Remote (or use the
      "...with iPad Remote" start file).
  [ ] Top bar: "PC  Connected" is green.
  [ ] Camera: in Zoom or Teams, BCC vCam is selected and the top bar
      shows "vCam  In use" (or, for the cards: OBS/Camo is open and
      the top bar shows "OBS  1 open").
  [ ] Content tab: today's questions and verses are in the lists,
      in the order you will use them.
  [ ] Meeting tab: the run sheet shows them; nothing is LIVE yet.
  [ ] Phone or iPad: open BSF Remote. Top bar shows
      "Remote  Connected".
  [ ] Transitions: check the effect shown next to "Next" in the
      Meeting tab is the one you want (for example "· Burst").
  [ ] Birthdays: the Birthday tile says who is ready, if anyone.
  [ ] Zoom: choose "OBS Virtual Camera" as your camera.
  [ ] Remember: Esc (or the red Hide all) clears the screen at once.


----------------------------------------------------------------
WHAT'S NEW IN VERSION 3 (the meeting control console)
----------------------------------------------------------------

  - Meeting tab: one screen to run the whole meeting (see section 6).
  - Clear LIVE / READY / EMPTY labels everywhere, plus a big
    "On screen now" view of exactly what Zoom participants see.
  - Connection lights in the top bar for the PC program, the overlay
    pages in OBS or Camo, and the phone remote.
  - Settings is now organised into sections: General, Overlays,
    Zoom / Display, Phone & iPad Remote, Keyboard shortcuts,
    Security, Data / Backup and Diagnostics.
  - A redesigned, touch-first remote that works on iPhone, Android
    phones and iPad.
  - New "Burst" transition, a Random option, and a transition of
    your choice for each saved verse or question (section 6).
  - Keyboard shortcuts can be changed in Settings.
  - Protection against accidental double presses on every screen.
  - The same colours on the PC and the phone remote:
        Blue    = Question          Purple = Verse
        Gold    = Birthday          Green  = Show / on screen (LIVE)
        Grey    = Hidden            Red    = Hide all / Clear
    Every state is also written in words, so colour is never the
    only clue.
  - Your existing files (verses, questions, members, PIN) keep
    working unchanged. Nothing needs to be set up again.
  - Stream Deck support has been removed.

  Small changes you may notice
  - Tabs: Meeting is Alt+1, Content (formerly "Meeting Overlays") is
    Alt+2, then Members Alt+3, Birthdays Alt+4, Email Alt+5,
    Settings Alt+6.
  - Esc now hides everything, including the birthday card.
  - B is a new shortcut: show or hide the birthday card.
  - Show/Hide (the Q and V keys and the phone remote) all
    behave the same way: if something is loaded, it is shown or
    hidden again; if nothing is loaded yet, the editor's text is shown.


----------------------------------------------------------------
1. WHAT'S IN THIS FOLDER
----------------------------------------------------------------

  Start BSF Command Center.bat           Double-click to start (Windows)
  Start BSF Command Center with iPad Remote.bat
                                         Same, plus the phone/iPad remote
  Allow iPad Remote - run once.bat       Fixes Windows Firewall for the remote
  Undo iPad Remote permission.bat        Removes that firewall permission
  tools/                                 Scripts used by the two files above
  Start BSF Command Center (Mac).command Double-click to start (Mac)
  server.py                              The small local program
  README.txt                             This guide
  app/dashboard.html                     The command-center dashboard
  app/focus-verse.html                   "BSF Focus Verse" overlay
  app/discussion-question.html           "BSF Discussion Question1" overlay
  app/birthday.html                      "BSF Birthday Celebration" overlay
  app/stage.html                         All overlays in one page
  app/remote.html                        The phone/iPad remote
  desktop_app.py, packaging/, build.bat, .github/
                                         Used to build the installable
                                         Windows app (BUILD-AND-INSTALL.md)
  app/css, app/js, app/fonts, app/vendor Styles, code, fonts and the
                                         bundled Excel library
  samples/BSF-Members-Template.xlsx      Empty template to fill in
  samples/BSF-Members-Sample.xlsx        12 fictional members for testing
  bsf-saved-content.json                 Created automatically: verses,
                                         questions and overlay settings
  bsf-remote-pin.txt                     Created automatically: remote PIN
  bsf-remote-sessions.json               Created automatically: signed-in
                                         phones and iPads (30 days)
  bsf-members-private.json               Created automatically: your
                                         member list and email settings
                                         (PERSONAL DATA - see section 13)


----------------------------------------------------------------
2. ONE-TIME SETUP (WINDOWS)
----------------------------------------------------------------

The overlays live inside OBS (or Camo), which runs its own built-in
web browser. To let the dashboard talk to that browser, a tiny local
program runs on your computer. It needs Python 3, which is free:

  1. Go to https://www.python.org/downloads/ and install Python 3.
  2. On the first installer screen, TICK "Add python.exe to PATH".
  3. Finish the installation. You only do this once.

(Mac: Python 3 is normally already installed.)


----------------------------------------------------------------
3. STARTING IT FOR A MEETING
----------------------------------------------------------------

  1. Double-click "Start BSF Command Center.bat".
     A black window opens and the dashboard opens in your browser at
         http://localhost:8750/
  2. Leave the black window open for the whole meeting.
     Closing it stops the overlays from updating.

If Windows shows "Windows protected your PC", select "More info",
then "Run anyway". This appears because the file was downloaded.


----------------------------------------------------------------
4. ADDING THE OVERLAYS TO OBS (do this once)
----------------------------------------------------------------

With the dashboard running:

  1. In OBS, select your scene, then under Sources select "+" and
     choose "Browser".
  2. Name it "BSF Focus Verse" and select OK.
  3. Set:
        URL:     http://localhost:8750/focus-verse.html
        Width:   1920
        Height:  1080
     Leave "Local file" unticked. Leave the Custom CSS as it is.
     Select OK.
  4. Make sure the browser source sits ABOVE your camera in the
     Sources list, and stretch it to fill the whole canvas.
  5. Repeat for the question overlay:
        Name:    BSF Discussion Question1
        URL:     http://localhost:8750/discussion-question.html
        Width:   1920   Height: 1080
  6. And for the birthday overlay:
        Name:    BSF Birthday Celebration
        URL:     http://localhost:8750/birthday.html
        Width:   1920   Height: 1080

The background of both overlays is transparent automatically, so
only the cards appear over your camera.

Prefer a single source? Use http://localhost:8750/stage.html
instead of the three above. It shows all the cards in one page.

The "Overlay links" panel (Settings > Zoom / Display) has Copy
buttons for every
link and shows "Connected" when a source has an overlay open.

Tip: if your OBS canvas is 1280 x 720, use Width 1280 and Height 720.
The overlays scale to any size.


----------------------------------------------------------------
5. GETTING IT INTO ZOOM
----------------------------------------------------------------

Recommended (camera with overlays):
  1. In OBS, select "Start Virtual Camera".
  2. In Zoom, open Settings > Video and choose "OBS Virtual Camera".
     Your camera now appears in Zoom with the overlays on top.
  3. Zoom mirrors your own preview. The others see the text the
     right way round. To check, turn off "Mirror my video" in
     Zoom's video settings.

Alternative (screen share):
  In OBS, right-click the preview and choose "Windowed Projector
  (Preview)". Then in Zoom select Share Screen and pick that
  projector window.

Camo Studio:
  Add a Web layer and paste the same links (for example
  http://localhost:8750/focus-verse.html).

Other apps: any tool that accepts a "browser source" or "web page"
layer can use these links.


----------------------------------------------------------------
6. USING THE DASHBOARD DURING THE MEETING
----------------------------------------------------------------

THE MEETING TAB (Alt+1) - use this while you lead
  Left:   Run sheet. Your questions and verses in order. Items you
          have already used are dimmed; the current one says LIVE
          (on screen) or READY (loaded but hidden); the next one says
          NEXT. Click any item to put it on screen immediately.
  Centre: "On screen now": exactly what Zoom participants see, with a
          green "LIVE ON ZOOM" frame whenever anything is showing.
          Below it, one tile each for Question, Verse and Birthday.
  Right:  Controls for Question (blue) and Verse (purple):
            Prev · Show/Hide · Next
          The Show/Hide button is green when it will SHOW, and grey
          when it will HIDE. Under the buttons, "Next" tells you what
          Next will show. Birthday (gold) has one Show/Hide button.
  Clear   needs two clicks: the first click changes it to
          "Confirm clear" for 2.5 seconds.
  Clicking a button twice by accident counts once.

Status labels
  LIVE    Zoom participants can see it now.
  READY   Loaded but hidden (Show brings it back).
  EMPTY   Nothing loaded.

Top bar (on every tab)
  PC       Connected = the local program is running.
  OBS      How many overlay pages are open in OBS/Camo. It turns amber
           if something is LIVE but no overlay page is open.
  Remote   Off · Waiting · Connected · Disconnected · Check firewall
           (your phone or iPad remote)
  Hide all (red) clears the screen at once. Same as Esc.
  Click any light to open its page in Settings.

THE CONTENT TAB (Alt+2) - use this to prepare
For each card (Focus Verse and Discussion Question)
  Show    Puts the editor's text on screen with the chosen transition.
  Hide    Fades the card out. The content is kept, so Show brings it back.
  Clear   Removes it from the screen instantly and empties it.
  Ctrl+Enter inside the text box does the same as Show.

  "Update on screen as I type" makes corrections appear on screen
  while you type, with no transition replay. Leave it off if you
  prefer to prepare the next item privately and then select Show.

Transitions (chosen separately for the verse and the question)
  Fade          Soft, calm cross-fade. A good default for questions.
  Gentle rise   Fades in while moving up slightly. Recommended for
                verses.
  Word by word  Words appear one after another. Works well for
                reading a verse aloud together.
  Typewriter    Letters type in with a cursor.
  Burst         The card grows out of a point of golden light, with a
                ring and a few sparks, then the text settles in.
                "Burst strength": Gentle (calm, good for scripture)
                or Bold (brighter, more celebratory).
  Cut           Appears immediately, with no animation.
  For Word by word and Typewriter, choose Slow, Medium or Fast.
  If Windows is set to reduce animations, Burst plays as a fade.

Random transitions
  Tick "Random" (separately for the verse and the question) to use a
  different transition each time. Tick the transitions it may choose
  from under "Choose from". It never uses the same one twice in a row.
  The Meeting tab shows which one comes next, for example
  "Next: Isaiah 40:8 · Burst (random)".

A transition for each saved verse or question
  Each item in the saved lists has a small menu:
    Default effect   use the transition set above (or Random, if on)
    Random           a random transition for this item only
    Fade, Burst...   always use this transition for this item
  An item's own choice always wins. Items with their own transition
  show a ✦ in the Meeting tab's run sheet. It works the same whether
  you show the item from the PC, the keyboard or the phone remote.

Saved lists
  Save verses and questions ahead of time. Select an item to load
  it into the editor, or its Show button to put it on screen now.
  Use the arrows to reorder and the X to remove.
  "Add several questions" lets you paste a whole list at once,
  with one question per line.
  Tick "Add the question number from the list" to label cards
  "Discussion Question 1", "Discussion Question 2" and so on.

Keyboard shortcuts (Meeting and Content tabs, when you're not typing)
  Right arrow  (→)     Next question
  Left arrow   (←)     Previous question
  Shift + →  /  ←      Next / previous saved verse
  Q                    Show or hide the question
  V                    Show or hide the verse
  B                    Show or hide the birthday card
  Esc                  Hide all (question, verse and birthday)
  Alt + 1 to 6         Switch tabs: Meeting, Content, Members,
                       Birthdays, Email, Settings
  Holding a key down counts as one press.
  To change a key: Settings > Keyboard shortcuts > Change, then press
  the new key. "Restore default keys" puts the keys above back.
  (Changed keys are remembered in this browser.)

Live preview
  Shows exactly what your overlays show, at 1920 x 1080. The grey
  shape stands in for your camera.

Saving
  Everything is saved automatically in "bsf-saved-content.json".
  Settings > Data / Backup: "Save a backup file" downloads a copy,
  and "Load a backup file" restores one (for example on another
  computer).
  "Reset to blank" clears both cards and editors but keeps your lists.


----------------------------------------------------------------
7. PLACEMENT CHOICES (and how to change them)
----------------------------------------------------------------

Focus Verse: centred, at 40% of the screen height, up to 70% wide.
  The verse is the main visual element, so it sits in the centre
  of attention. Setting it slightly above the middle (40% rather
  than 50%) leaves room for the question card below and keeps it
  away from Zoom's bottom controls. For long passages, the card
  keeps its gold frame and the text shrinks gently to fit.
  The verse never overlaps the question card. When a long question
  is showing, the verse moves up into the free space above it.
  If the verse covers your face, set "Position" to Left or Right
  in Settings > Overlays > "Placement & style". This keeps your face clear while the
  verse stays large.

Discussion Question: lower third, 10% above the bottom, 84% wide.
  10% keeps it clear of Zoom's control bar and of screen edges
  that some TVs and projectors cut off. 84% width keeps lines at
  a comfortable reading length. The question uses a bold sans-
  serif font with strong contrast, so people can read it quickly
  when you change it often.

Change any of these under Settings > Overlays > "Placement & style". Changes appear
live on screen. "Recommended layout" restores the values above.
Card opacity sets how see-through the navy cards are.


----------------------------------------------------------------
8. NO-INSTALL MODE (without Python)
----------------------------------------------------------------

You can double-click app/dashboard.html to open the dashboard
without the local program. In this mode the overlays update only
when they're open in the SAME web browser as the dashboard (other
tabs or windows of it). This is useful for rehearsing, or for
screen-sharing a browser window in Zoom. OBS and Camo use their
own browsers, so for them use the local program (section 3).
In this mode, member data is kept in that browser's own storage.
If you later switch to the local program, export your members to
Excel first, then import them there.


----------------------------------------------------------------
9. TROUBLESHOOTING
----------------------------------------------------------------

Member data doesn't load, or changes aren't saved
  The dashboard shows a red message. Check that the black window is
  open, then reload the dashboard (F5).

An imported phone number lost its + or leading zero
  Excel converted it to a number. Format the Phone Number column as
  Text in Excel, retype the numbers, and import again. Or select
  the member and use "Add code".

The overlay doesn't appear in OBS
  - Is the black "BSF Command Center" window still open?
  - Check the dashboard: the top bar should say
    "Local program - connected".
  - Check the browser source is above the camera and the URL is
    exactly as in Settings > Zoom / Display > "Overlay links".
  - Right-click the source > Properties > "Refresh cache of
    current page".

The black window says a different port (not 8750)
  Another program was using port 8750. Either close that program
  and restart, or update the OBS links to the new number shown.

"Python 3 was not found"
  Install Python 3 as in section 2, making sure to tick
  "Add python.exe to PATH".

The text looks small or large
  Use the "Text size" sliders under Settings > Overlays.


----------------------------------------------------------------
10. BSF MEMBERS
----------------------------------------------------------------

Open the "Members" tab (or press Alt+3).

Importing from Excel
  1. Select "Download template" (or use samples/BSF-Members-
     Template.xlsx) and fill it in. The first row must contain
     exactly these column names:
         Name | Country | Phone Number | Email | Birth Date
  2. Phone Number: include the country code with +, for example
     +965 5000 1234. In Excel, format this column as Text so the
     + and any leading zeros are kept.
  3. Birth Date: use YYYY-MM-DD, for example 1985-03-15. Excel
     date cells also work. If you don't know the year, write
     --MM-DD (for example --07-21); the age is then not shown.
     Dates like 03/04/1990 are read as day/month/year by default
     (change this under Settings > "Dates like 03/04/1990").
  4. Select "Import Excel" and choose the file (.xlsx, .xls or .csv).
  5. A preview shows every row as Ready, Check (imported, with a
     note) or Will be skipped (an error such as a missing name, an
     impossible date or an invalid email). Choose "Add to my current
     list" or "Replace my whole member list", then confirm.
     Nothing is saved until you confirm.

Managing members
  - "Add member" adds one person. Select a member to see their
    card, then use Edit or Delete (deleting asks you to confirm).
  - Search by name, country, phone number or email. Press / to
    jump to the search box.
  - Filter by country and sort by name, next birthday or birth date.
  - Up/Down arrow keys move through the list; Space ticks a member.
  - "Export Excel" and "Export CSV" save the whole list to your
    Downloads folder.

WhatsApp, phone and email links
  - WhatsApp opens WhatsApp (the app, or WhatsApp Web) with that
    member. WhatsApp needs an internet connection; the rest of the
    Command Center does not.
  - The Command Center never guesses a country code. If a number
    has none, the card shows a warning with the likely code for the
    member's country. Nothing changes until you choose "Add code"
    and confirm. A leading 0 is removed when the code is added
    (except for Italy, where it belongs).
  - "Call" uses your computer's phone app (for example Phone Link
    or Skype), if you have one.
  - Clicking an email address, or "Email", opens a new message in
    Outlook or your default email app.


----------------------------------------------------------------
11. BIRTHDAYS
----------------------------------------------------------------

  - The top bar shows how many members there are, birthdays today,
    and birthdays in the next 14 days. The Birthdays tab shows a
    number badge when someone has a birthday today.
  - When the dashboard opens, a gold reminder bar lists today's and
    upcoming birthdays. "Dismiss for this session" hides it until you
    next open the dashboard. In the Birthdays tab you can also mark
    single reminders as "Acknowledge".
  - Choose the reminder period (7, 14, 30 or 60 days) in the
    Birthdays tab or in Settings.
  - Birthdays are worked out from the day and month only, so they
    work correctly across the new year. The year is used only for
    the age. 29 February birthdays are shown on 28 February in other
    years (or 1 March; see Settings).

Showing the birthday celebration
  The bar at the bottom of every tab controls the overlay:
    1. Choose who to celebrate. The list shows today's and upcoming
       birthdays, with today's first.
    2. Select "Show Birthday Celebration". Hide fades it out, and
       Clear removes it instantly.
  Changing the member while the overlay is showing switches it
  right away. To celebrate someone outside the reminder period, use
  "Celebrate on screen" on their member card.
  The overlay shows only the greeting, the name and a short message.
  The member's country appears only if you tick "Country". Phone
  numbers, email addresses and birth dates are never sent to it.
  Change the greeting, message, first-name-only option, position
  (top, middle or bottom) and size in Settings.
  The card sits at the top by default, to keep your face clear.


----------------------------------------------------------------
12. EMAIL PREPARATION
----------------------------------------------------------------

  1. Select a member (or tick several, for a group email).
  2. Choose "Prepare Email", "Prepare Summary Email" or "Prepare
     New Joinee Email". The subject and message are filled in with
     the member's details.
  3. Edit anything you like. The Preview shows exactly what will
     open. Replace "[Add summary here]" with the day's summary.
  4. Select "Open in Outlook / email app". A draft opens in Outlook
     or your default email app. NOTHING IS SENT AUTOMATICALLY: you
     review the draft and press Send yourself.

  Group emails put everyone in BCC by default, so members don't
  see each other's addresses. Your own email, if set in Settings,
  goes in "To". Members without a valid email are listed and left
  out.
  Very long messages: some email apps shorten very long drafts
  opened this way. The Command Center warns you and offers to copy
  the message first. You can also use "Copy message" and paste it.
  If addresses aren't separated correctly in your email app, switch
  Settings > "Address separator" between Outlook ( ; ) and Other
  apps ( , ).

  Settings lets you change your name, group name, greetings,
  signature, and the default subject and message used by
  "Prepare Email". You can use these placeholders:
    [Member Name] [First Name] [Country] [Birth Date]
    [Today's Date] [Group Name] [Your Name] [Greeting] [Signature]


----------------------------------------------------------------
13. PRIVACY, STORAGE AND BACKUPS
----------------------------------------------------------------

  - Member information never leaves your computer. There is no
    cloud service, online database or email service. The local
    program only accepts connections from this computer.
  - Where it's stored:
      Local program: bsf-members-private.json, in this folder
      (Settings > Data / Backup shows the full path).
      No-install mode: inside that web browser's own storage.
  - The overlays (the pages OBS or Zoom show) never receive member
    data, apart from the birthday greeting you choose to show.
  - Phone numbers, emails and birth dates are not written to any
    log.
  - Imported spreadsheet values are treated as plain text. Formulas
    are not run, and exported CSV files are protected against
    formula injection.
  - Back up: Settings > Data / Backup > "Back up members (Excel)",
    or Export Excel.
    Keep backups somewhere private; they contain personal data.
  - Restore: Members > Import Excel, then choose the backup.
  - Remove everything: Settings > Data / Backup > "Clear all member data" (type
    DELETE to confirm). To remove all traces, you can also delete
    bsf-members-private.json while the program is closed.
  - If you share this folder with someone, delete
    bsf-members-private.json first, unless you intend to share the
    member list.


----------------------------------------------------------------
14. PHONE & iPAD REMOTE (iPhone, Android or iPad)
----------------------------------------------------------------

Control the overlays from your phone or iPad while you sit on camera.
It works in Safari on iPhone/iPad and in Chrome on Android.

Setting up (once)
  1. Make sure the PC and the phone are on the SAME Wi-Fi network.
  2. Turn on the switch in Settings > Phone & iPad Remote. (Or start
     with "Start BSF Command Center with iPad Remote.bat", which turns
     it on for you. Tick "Turn on automatically" under the switch if
     you use your phone at every meeting.)
  3. The first time, Windows Defender Firewall asks whether Python
     may communicate on networks. Tick "Private networks" ONLY and
     select Allow. (Your home Wi-Fi should be set to "Private" in
     Windows Settings > Network & internet > Wi-Fi > your network.)
  4. On the PC, open Settings > Phone & iPad Remote. It shows a QR
     code, the PC address, the port, an address such as
     http://192.168.1.20:8750/remote.html (with a Copy URL button),
     and the 6-digit PIN.
  5. On the phone, point the Camera at the QR code and tap the link,
     or type the address into Safari or Chrome. Enter the PIN.
  6. Optional, for a one-tap BSF Remote icon:
       iPhone/iPad: Safari > Share > "Add to Home Screen".
       Android: Chrome > ⋮ menu > "Add to Home screen".
  The phone stays signed in for 30 days (and after restarts).

Using it on a phone
  One large panel at a time. Tap the tabs at the top to switch:
    Question (blue) · Verse (purple) · Birthday & more (gold)
  A green dot on a tab means that item is on screen (LIVE).
  Each panel shows the current text, what Next will show, and:
        ◀ PREV     SHOW / HIDE     NEXT ▶
  "Hold to clear" must be held for almost a second.
  HIDE ALL (red, top right) and Lists are always visible.
  "Birthday & more" has the birthday Show/Hide, a small preview of
  what Zoom sees, and "Disconnect this device".
  Turn the phone sideways for a shorter layout; everything still
  fits on one screen. Android phones give a short vibration when a
  press is registered.

Using it on an iPad
  Question, Verse and Birthday are side by side in landscape, with
  the same buttons.

On every device
  SHOW is green; once it is on screen the button turns grey and says
  HIDE. Tapping a button twice quickly counts once. If the Wi-Fi
  drops for more than a few seconds, a red "Not connected" bar
  appears and the buttons pause until the connection returns; the PC
  dashboard also shows "Remote Disconnected". Type new verses and
  questions on the PC; they appear on the phone automatically. The
  PC and the phone can be used at the same time, and several phones
  can be connected at once.

Remote status (Settings > Phone & iPad Remote, and the top bar)
  Remote off         The switch is off.
  Ready, waiting     Remote is on; no phone has signed in yet.
  Connected          A phone or iPad is signed in and responding.
  Remote disconnected  It was connected but stopped responding.
  Firewall problem   Windows says your network is "Public", which
                     blocks other devices. See below.
  Network problem    This PC is not connected to a network.
  "Connection test" checks that the PC is reachable on its network
  address. It can't see the phone's side, so if the test passes but
  the phone still can't connect, something in between (firewall,
  security software or the router) is blocking it.
  The Command Center only LOOKS at these Windows settings. It never
  changes firewall or network settings by itself.

Security
  - The remote works only while its switch is on. When it is off,
    nothing on the network can connect to this PC at all.
  - A PIN is required. After 5 wrong tries, that device must wait
    60 seconds.
  - "Generate new PIN" (Settings > Phone & iPad Remote) disconnects
    every phone and iPad at once.
  - The remote can only control the overlays. Member details
    (phones, emails, birth dates, the member list) and the dashboard
    can never be opened from another device.
  - Use it only on a network you trust, such as your home Wi-Fi. The
    connection isn't encrypted, so avoid public or hotel Wi-Fi.

If the phone or iPad can't connect ("This site can't be reached")
  First, open the same address on the PC itself. If it works there but
  not on the phone or iPad, Windows (or other security software) is blocking it:
  - In Settings > Phone & iPad Remote > "Fix the connection", select
    "Allow through Windows Firewall" (it asks for administrator
    permission, only affects private networks, and has an Undo button).
    Or:
  - Double-click "Allow iPad Remote - run once.bat" and select Yes when
    Windows asks for permission. It:
      1. offers to set your Wi-Fi to Private (Windows blocks other
         devices on Public networks),
      2. switches off hidden rules that block Python on private
         networks (created if a firewall question was ever cancelled),
      3. allows the Command Center's ports (8750-8760) on private
         networks only,
      4. checks that the program is running in remote mode,
      5. warns you if Norton, McAfee or similar has its own firewall,
      6. lists the addresses to open on the phone or iPad.
    To reverse step 3, run "Undo iPad Remote permission.bat".
  - Watch the black window while the phone tries to connect. A line
    "Connection from 192.168.x.x (another device)" means the phone got
    through. If no line appears, the connection is still blocked before
    it reaches the PC.
  Other checks:
  - Check that both are on the same Wi-Fi (not a guest network).
    On a phone, turn off mobile data briefly to be sure it is using
    the Wi-Fi.
  - Use the address shown in Settings > Phone & iPad Remote. If it lists
    several addresses, try each one.
  - Check that the black window says "PHONE REMOTE is ON".
  - Windows Firewall: allow Python on private networks. If you
    selected Cancel before, search Windows for "Allow an app through
    Windows Firewall" and tick Private for Python.
  - Some routers block devices from talking to each other ("AP
    isolation" or "client isolation"). Turn that off, or use a
    different Wi-Fi.


----------------------------------------------------------------
15. ABOUT AND CREDITS
----------------------------------------------------------------

BSF Command Center: created by Shobin Mathews (mshobin@gmail.com).
Mission: help BSF leaders run smoother, more focused Zoom Bible
studies with clear, easy-to-use overlays that keep attention on
God's Word and the group discussion.
The About text is kept in app/js/brand.js (see BUILD-AND-INSTALL.md
to change it). BSF Command Center is an independent tool; it is not
officially affiliated with, endorsed by, or produced by Bible Study
Fellowship International.

Fonts: EB Garamond and Source Sans 3, both under the SIL Open Font
License (see app/fonts/OFL-*.txt). They are included, so no
internet connection is needed.
QR codes: qrcode-generator by Kazuhiko Arase, MIT License (license
in the header of app/vendor/qrcode.js).
Excel import/export: SheetJS Community Edition 0.20.3, Apache 2.0
License (see app/vendor/LICENSE-SheetJS.txt). It's included, so no
internet connection is needed.
Sample verses are from the King James Version (public domain).
Sample members are fictional, with example.com email addresses.
The sample discussion questions are generic placeholders.
Replace them with your own.
