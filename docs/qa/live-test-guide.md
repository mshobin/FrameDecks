# Live test guide (sync, phone control, editing, history)

For the owner: one pass through everything built on 25 October 2026 that has only been tested against stand-ins.
It takes about 30 minutes. You need the service PC, a phone, and the Supabase dashboard. If a step does not do what
it says, stop there and send what you see (see [What to send back](#what-to-send-back)).

The designs behind each part: [metadata-sync.md](../architecture/metadata-sync.md) (sync),
[remote-control.md](../architecture/remote-control.md) (phone control),
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
   **Artifacts**, download **FRAMEDECKS v6.10** and unzip it.
2. Run `FRAMEDECKS v6.10.exe` from the zip (the `.sha256` file next to it is its checksum) and install as you do
   for each new version. Windows may say it protects your PC: **More info** → **Run anyway**. Make a backup first
   (Settings → Data / Backup → Save a backup file) if you want to be safe.

## 3. Test A: sync

1. In FRAMEDECKS: **Settings → FRAMEDECKS account → Link to a workspace**. A code like `K7PM 2XQ9` appears.
2. On any device, open `https://framedecks.vercel.app`, sign in, go to **Computers**, type the code, **Link**.
3. **Expect:** within a few seconds the PC shows "Linked to BSF Study"; this is also the first time Windows
   Credential Manager stores the PC's key.
4. In the companion open **Services**. **Expect:** your Frames in order, with their questions, scripture and scripts;
   pictures and videos only by name.
5. On the PC change a Frame's name. **Expect:** after reloading Services (within about a minute) the new name.
6. Open **Members** in the companion. **Expect:** the member list from the PC (owners and admins only).

## 4. Test B: phone control

1. On the PC: **Settings → FRAMEDECKS account → Control from the companion → tick "Allow control from the
   companion"**.
2. On your phone, **on mobile data (Wi-Fi off)**: open the companion → **Live**.
3. **Expect:** the PC's name with **Online**, and the Frame that is on screen.
4. Press **Next**. **Expect:** the PC moves to the next Frame within about a second (the first press after a quiet
   spell can take up to 5 seconds) and shows "Next Frame · from ‹your name›"; the phone says "Next Frame: Done".
5. Try **Go Live** on a Frame in the list, **Black screen** (and again to turn it off), **Hide all**.
6. On the PC, Settings → FRAMEDECKS account now lists these as the last actions.
7. Untick the switch on the PC. **Expect:** within 45 seconds the phone shows **Not connected**; presses do nothing.
8. Optional: on the companion's Overview → your workspace → **Members**, tick **Can run services** for a member and
   ask them to open Live (without it they see "No PC to run here").

## 5. Test C: editing in the companion

1. In the companion → **Services** → **Edit** on a Frame that is **not** on screen. Change its Teleprompter script
   and add a question. **Save**. **Expect:** "Saved. The service PC picks it up within about a minute", and on the
   PC the new script and question within about a minute.
2. **Edit** the Frame that **is** on screen and change its script. **Expect:** the companion says it is on screen
   (when phone control is on); the PC keeps showing the old one until that Frame leaves the screen, then has the new
   script.
3. Move a Frame up with the arrow. **Expect:** the same order on the PC within about a minute.
4. Scripture: a reference saved without text shows as the reference; fetch the text on the PC as usual.

## 6. Test D: history

1. In **Services**, press the history (clock) button on the Frame you edited. **Expect:** "Now" and earlier versions,
   who made each (your name "(companion)" or the PC's name) and what changed.
2. **Restore** an earlier version. **Expect:** the PC returns to it within about a minute.
3. Delete a spare Frame on the PC, reload Services. **Expect:** it under **Deleted in the last 30 days**; **Restore**
   brings it back at the end of the list on the PC.

## 7. Test E: members from the cloud (M-D2, M-D6)

1. In the companion open **Members** → **Add a member**: a name, a birthday (`03-15` or `1985-03-15`), a country.
   **Save**. **Expect:** within about a minute the person is in the PC's Members screen.
2. **Edit** someone the PC added, change the phone, **Save**. **Expect:** the PC shows the new phone after its next sync.
3. **Manage groups** → add "Choir"; **Edit** a person → tick **Choir** → **Save**. **Expect:** the Groups column and
   the "Choir (1)" filter. The PC's Members screen does not change (groups are kept online only).
4. Rebuild test (optional, with a backup): quit FRAMEDECKS on the linked PC, rename
   `%APPDATA%\FRAMEDECKS\kc-members-private.json` to `.bak`, start FRAMEDECKS. **Expect:** within a minute the member
   list is back (from the workspace), and the companion still lists everyone. Then delete the `.bak` file or put it back.

## What to send back

For anything that does not match **Expect**: which test and step, a screenshot of the companion page, the message
shown under Settings → FRAMEDECKS account on the PC (it shows sync and phone-control errors), and the time.
If all five pass, say so: the live tests in the continuity files are then marked done.
