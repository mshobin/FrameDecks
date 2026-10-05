# BSF Command Center: build and install the Windows app

This guide turns the BSF Command Center folder into a normal Windows program:
a **Setup** file that installs it, a **desktop icon**, and its **own window**.

GitHub builds the installer for you on a clean Windows computer, so you don't need to install
any programming tools. You only need a free GitHub account.

> **Your private data is never uploaded.** The folder includes a `.gitignore` file that blocks
> your member list, saved verses and questions, PIN, backups and any spreadsheets from being sent
> to GitHub. Only the program itself is uploaded, into a **private** repository only you can see.

---

## Part 1 · One-time setup (about 15 minutes)

1. **Create a GitHub account** at <https://github.com> (free). Use a strong password and turn on
   two-factor sign-in when it offers.
2. **Install GitHub Desktop** from <https://desktop.github.com> and sign in with your account.
3. Unzip **BSF-Command-Center.zip** somewhere permanent, for example `Documents\BSF-Command-Center`.
   (Keep using your current folder for meetings until the app is installed; nothing here changes it.)
4. In GitHub Desktop: **File → Add local repository…** → choose the unzipped folder.
   It will say the folder is not a repository yet: click **create a repository**, then **Create repository**.
5. Click **Publish repository**. **Keep "Keep this code private" ticked**, then click **Publish repository**.

GitHub now starts building your installer automatically.

## Part 2 · Download your installer

1. Open your repository on github.com (GitHub Desktop: **Repository → View on GitHub**).
2. Click the **Actions** tab. You'll see **Build Windows installer** running (yellow dot).
   It takes about 5–10 minutes. A green tick means it worked.
3. Click the finished run. At the bottom, under **Artifacts**, click
   **BSF-Command-Center-Setup-3.2.3** (the version number) to download it (a .zip containing the Setup .exe).
4. Unzip it. You now have **BSF-Command-Center-Setup-3.2.3.exe**.

If you see a red cross instead, click the run to read the error, and send it to me.

## Part 3 · Install

1. Double-click **BSF-Command-Center-Setup-3.2.3.exe**.
2. Windows may show **"Windows protected your PC"**. This appears because the installer isn't
   code-signed (signing costs money every year). Click **More info → Run anyway**.
3. Follow the wizard. No administrator password is needed. Leave **Create a desktop icon** ticked.
   Tick **Start automatically when I sign in** if you'd like it ready every time.
4. When it opens for the first time, it offers to **import your existing data**.
   Choose your current BSF Command Center folder (it's usually found automatically) and click **Import**.
   Your members, saved verses and questions, settings and phone PIN are copied across.
   Your old folder isn't changed.

## Part 4 · First-run checklist (before a real meeting)

- [ ] The app opens in its own window with the Meeting tab.
- [ ] Your members and saved lists are there (after importing).
- [ ] **OBS / Camo:** your existing overlay links still work (same address: `http://localhost:8750/...`).
      Check the top bar shows **OBS · 1 open**.
- [ ] **Phone remote:** Settings → Phone & iPad Remote → turn on the switch.
      The first time, Windows Firewall asks about network access: tick **Private networks** only → **Allow**.
      Your phone may need to scan the QR code again, and use the PIN shown.
- [ ] **Close button (X):** choose **Keep running in the background**. The overlays keep working, and a
      BSF icon appears near the clock (it may be under the **^** arrow). Click it to open the window again.
- [ ] **Quit** from that icon's menu (right-click → Quit BSF Command Center), then open the app again
      from the desktop icon: everything is still there.
- [ ] **Email draft and WhatsApp buttons** open your normal email app and browser.
- [ ] **Excel export and backups** save to your Downloads folder.
- [ ] Settings → Data / Backup shows your data folder and at least one backup.

### First test of BCC vCam (the built-in camera)

- [ ] During installation, **Install the BCC vCam camera** was ticked and you allowed the administrator prompt.
      (If not: Settings → BCC vCam → **Install BCC vCam**.)
- [ ] Settings → BCC vCam → **Show preview**: you see yourself. Try **Background blur: Light** and **Strong**.
- [ ] Close and reopen Zoom. Settings → Video → Camera → **BCC vCam**: Zoom shows you, and the top bar says **vCam · In use**.
- [ ] Turn off Zoom's own background blur/virtual background while using BCC vCam's blur.
- [ ] Stop your Zoom video: within a second the laptop webcam light goes off.
- [ ] Settings → BCC vCam shows the frames per second (aim: about 30) and the work per frame. If the picture is jerky,
      choose **720p**, or blur **Light**, and send me the numbers from Settings → Diagnostics.
- [ ] Repeat in Microsoft Teams (Settings → Devices → Camera → BCC vCam).

If Zoom or Teams doesn't list BCC vCam, restart the meeting app (they look for cameras when they start).
Close Zoom and Teams before installing a new version, because they keep the camera in use.

Once all of these work, stop using the old folder and its .bat files, so you don't have two copies of
your data. (The old files stay where they are as an extra backup.)

## Where things are

| What | Where |
|---|---|
| The program | `%LOCALAPPDATA%\Programs\BSF Command Center` |
| Your data (verses, questions, members, PIN, settings) | `%APPDATA%\BSF Command Center` |
| Daily backups (newest 10 kept) | `%APPDATA%\BSF Command Center\backups` |
| Problem log (for troubleshooting) | `%APPDATA%\BSF Command Center\bsf-app-log.txt` |

Settings → Data / Backup has buttons to open the data and backups folders.

## Making changes and releasing a new version

Every new version follows the same four steps: **change → version number → commit & push → install**.

### 1. Make the change

Edit files inside your repository folder (the one GitHub Desktop is tracking). For example:

| To change… | Edit this file |
|---|---|
| The About text (tagline, mission, contact email…) | `app/js/brand.js` |
| The version number | `server.py`, the line `APP_VERSION = "3.1"` |
| Overlay card styles | `app/css/overlay.css` |

Use a plain text editor such as Notepad or VS Code (free). Keep the quote marks, commas and brackets as they are.

**Quick test before building:** double-click `Start BSF Command Center.bat` in the same folder. It runs your changed version in the browser straight away. It uses its own separate data, so it never touches the installed app's data.

### 2. Raise the version number

Open `server.py` and change `APP_VERSION = "3.1"` to the next number, for example `"3.2"`.
Use 3.2, 3.3… for small changes and 4.0 for big ones. The About screen, the installer's name and
Windows all use this number, so the installer knows it is an upgrade.

### 3. Commit and push with GitHub Desktop

1. Open GitHub Desktop. The left side lists every file you changed; click one to see exactly what changed
   (red = removed, green = added). Your private data files never appear here.
2. Bottom left, in **Summary**, describe the change, for example `Update tagline, version 3.2`.
3. Click **Commit to main**, then **Push origin** at the top.

GitHub starts building straight away (Actions tab, about 5–10 minutes).

### 4. Install the new version

Download the installer from the **Actions** tab (see Part 2) and run it. It installs over the old version and
closes the app first if it's open. **Your data is untouched.** Check the version in the top bar's **ⓘ About**.

### Keep a permanent copy (recommended for each version you actually use)

Artifacts on the Actions tab are deleted after 90 days. On github.com: **Releases → Draft a new release →
Choose a tag**, type the version with a "v" (for example **v3.2**) → **Create new tag** → **Publish release**.
GitHub builds the installer again and attaches it to that release permanently.

### When I send you an updated zip

1. Unzip it somewhere else (for example your Downloads folder).
2. Open the new `BSF-Command-Center` folder, select everything inside it (Ctrl+A), copy it, and paste it
   into your repository folder. Choose **Replace the files in the destination**.
   The hidden `.git` folder in your repository folder is not in my zip, so your history is kept.
   **Make sure the `.github` folder is copied too.** It holds the build recipe; if it isn't updated, GitHub
   builds the app the old way (for example without the BCC vCam camera). After pasting, GitHub Desktop should
   list `.github/workflows/build-windows.yml` among the changed files whenever I've changed the recipe.
3. If you had changed `app/js/brand.js` yourself, GitHub Desktop will show my version replacing yours:
   click the file, check the differences, and put your wording back before committing.
4. The version number is already raised in my updates. Continue with step 3 above (commit and push).

### Undoing a change

- **Before you commit:** in GitHub Desktop, right-click the file → **Discard changes**.
- **After you commit:** **History** tab → right-click the commit → **Revert changes in commit** → **Push origin**.
- **Fastest during a busy week:** install the previous version from the **Releases** page. Your data is kept.

## Uninstalling

Windows **Settings → Apps → Installed apps → BSF Command Center → Uninstall**.
It asks whether to delete your data as well. The default is **No**, which keeps your data for a later reinstall.

## Building on your own PC instead (optional)

If you'd rather not use GitHub: install **Python 3.12** (python.org, tick "Add Python to PATH") and
**Inno Setup 6** (jrsoftware.org/isdl.php), then double-click **build.bat** in the folder.
The installer appears in the `dist` folder.

## If something goes wrong

- **The app opens in my browser instead of its own window:** Windows is missing the free
  "Microsoft Edge WebView2 Runtime". Install it from microsoft.com, then open the app again.
  Everything works in the browser meanwhile.
- **Antivirus blocks or quarantines the app:** this is a known false alarm with unsigned apps made
  with Python. Restore it and add an exception for `%LOCALAPPDATA%\Programs\BSF Command Center`.
- **"Port 8750 is in use" message:** another program is using the address the overlays need.
  Close that program and restart BSF Command Center.
- **"This installer was built without the camera"** (Settings → BCC vCam): the build recipe in your repository
  is out of date. Copy the `.github` folder from my latest zip into your repository, commit, push, and install
  the new installer.
- **"The camera file was installed but has since been removed"**: Windows Security (or another antivirus)
  removed `bcc_vcam64.dll`. Open Windows Security → Virus & threat protection → Protection history, choose
  **Restore** (or **Allow**) for it, then run the installer again.
- **"The webcam could not be opened" / "Your webcam is being used by …"** (Settings → BCC vCam): only one app can
  use a laptop webcam at a time. In Zoom and Teams choose **BCC vCam** as the camera (not your webcam), and close
  Camo, OBS or the Camera app. If it mentions privacy: Windows Settings → Privacy & security → Camera → turn on
  **Camera access** and **Let desktop apps access your camera**. Also check Settings → BCC vCam → **Webcam** shows
  your real webcam (infrared "face sign-in" cameras can't be used).
- Anything else: Settings → Diagnostics → **Copy diagnostics** (it contains no PIN or member details),
  plus `bsf-app-log.txt` from the data folder.
