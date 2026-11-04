# Live test guide (sync, phone control, editing, history)

For the owner: one pass through everything built on 25 October 2026 that has only been tested against stand-ins.
It takes about 30 minutes. You need the service PC, a phone, and the Supabase dashboard. If a step does not do what
it says, stop there and send what you see (see [What to send back](#what-to-send-back)).

The designs behind each part: [metadata-sync.md](../architecture/metadata-sync.md) (sync),
[remote-control.md](../architecture/remote-control-design.md) (phone control),
[companion-editing.md](../architecture/companion-editing.md) (editing and history).

## 1. The database (once)

In the Supabase dashboard (project `slrsykiknlqlivlnpvrb`) → **SQL Editor** → **New query**, run these seven files from
`hosted/supabase/migrations/`, **in this order, one at a time**:

| Order | File | Adds |
|---|---|---|
| 1 | `0002_invitations.sql` | members and invitations |
| 2 | `0003_sync.sql` | syncing plans, linked computers, the 30-day history |
| 3 | `0004_remote.sql` | phone control, "Can run services" |
| 4 | `0005_remote_live.sql` | the Live page's list of PCs |
| 5 | `0006_audit_log.sql` | a log of who added or removed people, changed roles, invited, linked or unlinked a PC (nothing shows it yet) |
| 6 | `0007_data_api_grants.sql` | lets the companion reach the tables (Supabase stops doing this by itself on 30 October 2026); safe to run again |
| 7 | `0008_member_groups.sql` | member groups on the companion's Members page |

For each: open the file on GitHub, press **Raw**, select all, copy, paste into the SQL editor (not the file's path),
press **Run**. Expect "Success. No rows returned". An error that something "already exists" means that file was run
before: go on to the next one. Any other error: stop and send it.

## 2. The program on the service PC

1. Open the latest **Build Windows installer** run on `main` (GitHub → Actions → Build Windows installer), scroll to
   **Artifacts**, download **FrameDecks v8.0.0** and unzip it.
2. Run `FrameDecks v8.0.0.exe` from the zip (the `.sha256` file next to it is its checksum) and install as you do
   for each new version. Windows may say it protects your PC: **More info** → **Run anyway**. Make a backup first
   (Settings → Data / Backup → Save a backup file) if you want to be safe.

## 3. Test A: sync

Before the first 6.13 test, the owner runs `hosted/supabase/migrations/0010_link_by_url.sql` once in the Supabase
SQL editor.

1. In FrameDecks: **Settings → FrameDecks account → Connect to FrameDecks**. Your browser opens
   `framedecks.com/connect`, and the PC shows a two-digit check number.
2. Sign in if asked. **Expect:** "Allow ‹PC name› to use your workspace?" with the same check number as the PC.
   Choose the workspace, press **Allow**.
3. **Expect:** the page says the PC is connected, and within a few seconds the PC shows "Linked to Evening Study"
   without typing anything; this is also the first time Windows Credential Manager stores the PC's key.
4. Fallback: Unlink, choose **Connect to FrameDecks** again, close the browser tab, and on another device open
   **Service PCs**, type the code shown on the PC and press **Link**. **Expect:** the same result.
5. In the companion open **Plan** → **History and restore** (it was the Running order). **Expect:** your Frames in order, with their questions, scripture and scripts;
   pictures and videos only by name.
6. On the PC change a Frame's name. **Expect:** after reloading Plan (within about a minute) the new name.
7. Open **Members** in the companion. **Expect:** the member list from the PC (owners and admins only).

## 3a. Test J: the Setup guide (6.14; a step-by-step wizard since 8.0)

1. On a PC that never had FrameDecks (or after renaming the data folder), install and open it; choose **Start fresh**.
   **Expect:** the Setup guide at the right, showing one step: "Step 1 of 6", a progress bar, **Back** and **Next**.
2. Choose a kind of gathering. **Expect:** its Frames appear, the status line says the step is done and **Next**
   becomes available. Before that, **Next** is not available; **Do this later** moves on anyway.
3. **How people will see it**: follow "Show me how". **Expect:** the window dims around the right control; once
   FrameDecks vCam (or the Share Window) is chosen, **Next** becomes available. Open **Something not working?**:
   **Expect:** a short list of things to try.
4. **Your phone as a remote** and **Connect to FrameDecks**. **Expect:** both are marked optional and have **Skip
   this step**; connecting a phone completes the first by itself.
5. **Make your first Frame**: change a Frame's name. **Expect:** the step is done.
6. **Ready**. **Expect:** the ready checks (the running order, how people see it, the phone remote); anything not
   working has a button to fix it. Then the finish screen with **Open the Studio**, which closes the guide and opens
   the Studio. There is no Rehearse or Practice step.
7. On framedecks.com Home **Expect:** the same six steps; the PC's steps say "On the PC".

## 4. Test B: phone control

1. On the PC: **Settings → FrameDecks account → Control from the companion → tick "Allow control from the
   companion"**.
2. On your phone, **on mobile data (Wi-Fi off)**: open the companion → **Live**.
3. **Expect:** the PC's name with **Online**, and the Frame that is on screen.
4. Press **Next**. **Expect:** the PC moves to the next Frame within about a second (the first press after a quiet
   spell can take up to 15 seconds) and shows "Next Frame · from ‹your name›"; the phone says "Next Frame: Done".
5. Try **Go Live** on a Frame in the list, **Black screen** (and again to turn it off), **Hide all**.
6. On the PC, Settings → FrameDecks account now lists these as the last actions.
7. Untick the switch on the PC. **Expect:** within 45 seconds the phone shows **Not connected**; presses do nothing.
8. Optional: on the companion's **People**, tick **Can run services** for a member and
   ask them to open Live (without it they see "No PC to run here").

## 5. Test C: editing in the companion

1. In the companion → **Plan** → **Edit the meeting** → **Edit** on a Frame that is **not** on screen. Change its Teleprompter script
   and add a question. **Save**. **Expect:** "Saved. The service PC picks it up within about a minute", and on the
   PC the new script and question within about a minute.
2. **Edit** the Frame that **is** on screen and change its script. **Expect:** the companion says it is on screen
   (when phone control is on); the PC keeps showing the old one until that Frame leaves the screen, then has the new
   script.
3. Move a Frame up with the arrow. **Expect:** the same order on the PC within about a minute.
4. Scripture: a reference saved without text shows as the reference; fetch the text on the PC as usual.

## 6. Test D: history

1. In **Plan** → **History and restore**, press the history (clock) button on the Frame you edited. **Expect:** "Now" and earlier versions,
   who made each (your name "(companion)" or the PC's name) and what changed.
2. **Restore** an earlier version. **Expect:** the PC returns to it within about a minute.
3. Delete a spare Frame on the PC, reload Plan → History and restore. **Expect:** it under **Deleted in the last 30 days**; **Restore**
   brings it back at the end of the list on the PC.

## 7. Test E: members from the cloud (M-D2, M-D6)

1. In the companion open **Members** → **Add a member**: a name, a birthday (`03-15` or `1985-03-15`), a country.
   **Save**. **Expect:** within about a minute the person is in the PC's Members screen.
2. **Edit** someone the PC added, change the phone, **Save**. **Expect:** the PC shows the new phone after its next sync.
3. **Manage groups** → add "Choir"; **Edit** a person → tick **Choir** → **Save**. **Expect:** the Groups column and
   the "Choir (1)" filter. The PC's Members screen does not change (groups are kept online only).
4. Rebuild test (optional, with a backup): quit FrameDecks on the linked PC, rename
   `%APPDATA%\FRAMEDECKS\kc-members-private.json` to `.bak`, start FrameDecks. **Expect:** within a minute the member
   list is back (from the workspace), and the companion still lists everyone. Then delete the `.bak` file or put it back.

## 8. Test F: new on the PC (PowerPoint export, Audio, Suggest)

1. **Meeting → Export this meeting to PowerPoint**. **Expect:** a `.pptx` in Downloads. It opens in PowerPoint with
   one slide per Frame, and each Frame's script is in the speaker notes.
2. On a Frame: **+ Content → Audio…**, choose an MP3. **Go Live**. **Expect:** it plays through the speakers;
   **Hide all** (Esc) stops it. In a Zoom test call with **Share sound** on, the other side hears it.
3. Optional, with Ollama (see [ai.md](../guide/ai.md)): on a Frame with a Bible passage, **Question → Content → Suggest**.
   **Expect:** draft questions in the Add several box.

## 9. Test G: plan the meeting on the website (6.11)

Needs FrameDecks 6.11 on the linked PC.
1. On the PC's browser, open the companion's **Home**. **Expect:** a "This computer" card; press **Check this
   PC** and allow camera access. **Expect:** "FrameDecks is installed on this PC" (the camera is named FrameDecks).
   Press **Open FrameDecks on this PC**. **Expect:** the browser asks to open FrameDecks; the program comes forward.
2. Companion → **Plan** → **Meeting details**: change the speaker, **Save details**. **Expect:** the PC's
   Meeting tab shows the new speaker within about a minute.
3. **Add a Frame**: a name, a Question Content with two questions, a Scripture Content with a reference (no text),
   a Timer of 5 minutes, background Navy. **Add Frame**. **Expect:** within about a minute the PC lists the Frame
   at the end, with the same Content, laid out as an Excel import would. Fetch the verse text on the PC as usual.
4. **Edit** that Frame: change a question, add an Image Content with a file name that is in the PC's media folder.
   **Expect:** the change on the PC; the picture appears (or Diagnostics lists the name if it is not there).
5. Move it up, then **Delete** it. **Expect:** the PC follows; Plan → History and restore lists it under Deleted in the last 30 days.
6. On the PC: **Settings → Data / Backup → Meeting from Excel → Import a meeting from Excel…** still works (W2),
   and the ✨ Meeting menu no longer lists Excel.

## 10. Test H: run a meeting in the Studio (27 October; one Studio since 8.0)

On the service PC, no real call needed.
1. Open the Studio. **Expect:** no Prepare / Run switch; **◀ Previous**, **Next ▶**, **Go Live**, **Hide all** and
   **Live tools** are in the top bar.
2. Turn on **Live tools → Black screen**. **Expect:** in Zoom (FrameDecks vCam) the picture is black, while the program's
   own preview still shows your Frame.
3. Press **Go Live**, **Next ▶** and **Esc**. **Expect:** **Hide all** is red while something is on screen and calm
   after Esc; the Frames list marks **LIVE** and **NEXT**.
4. Open **Live tools**, press **Esc**. **Expect:** only the menu closes. Turn **Black screen** off. **Expect:** Zoom
   shows the picture again.
5. **Settings → How people see it** → **Set up FrameDecks vCam**. **Expect:** the FrameDecks vCam page with **← How people see it**.
6. Press **R**. **Expect:** the Teleprompter window opens on top of Zoom with only the script; move the pointer to its
   top edge (or press the small ▾ button) and the top bar shows Time, the Frame (name · n of m) and a Timer. Share
   your whole screen in a test call: **Expect:** the Teleprompter is not in the share. Press **R** again to close it.
7. Check the window at your PC's real width: the top bar on one row (two rows when narrow).

## 11. Test I: the website's new places (27 October)

1. Sign out and open `https://framedecks.com`. **Expect:** "Prepare with Purpose. Present with Excellence.",
   **Download for Windows · free** first, a demo where **Next** changes the room screen, Day 1–4, **Ready to Serve?**,
   and Help, Privacy, Licence, Contact in the footer. Sections rise in gently as you scroll; with "reduce motion" on,
   nothing moves. Switch to Light and open (i) About: everything readable.
2. **Sign in** → **New here?** with an address that has no team. **Expect:** Home shows three steps: name your
   team (type a name, **Add**), install FrameDecks, link the service PC.
3. With your real team: **Home** shows the next service with the plan and the PC's state. The menu reads Home, Plan,
   Live, People; Settings: Branding, Service PCs, Help. The avatar opens **Your account**.
4. Open `/meeting` and `/services`. **Expect:** both open **Plan**.
5. On a phone and on a tablet, open **Live**. **Expect:** large Previous and Next; on the tablet two even columns.

## 12. Test K: a workspace look (7.1)

You need a linked PC and the website signed in as an owner or admin.
1. On the PC, show a question (anything on screen). On the website, open **Branding → Look** and choose **Deep
   Ocean**. **Expect:** "Deep Ocean is your workspace look…"; the preview turns sea blue with teal edges.
2. Wait two minutes. **Expect:** the question on the PC (room screen, overlay and FrameDecks vCam) has **not**
   changed.
3. Press **Hide all** (Esc) on the PC and wait about a minute, then show a scripture. **Expect:** sea-blue cards
   with teal edges, and the scripture in the sans font, in all three outputs.
4. On the PC: Settings → Meeting & Branding → Look → **Same as my workspace**. **Expect:** the window stays dark. On the
   website choose **Morning Light**, clear the screen, wait a minute. **Expect:** the window turns light and the
   cards turn dawn blue with amber edges.
5. Choose **Gold & Navy** to go back to the standard look.

## What to send back

For anything that does not match **Expect**: which test and step, a screenshot of the companion page, the message
shown under Settings → FrameDecks account on the PC (it shows sync and phone-control errors), and the time.
If all of them pass, say so: the live tests in the continuity files are then marked done.
