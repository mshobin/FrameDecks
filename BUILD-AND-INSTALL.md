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
   **BSF-Command-Center-Setup-3.0** to download it (a .zip containing the Setup .exe).
4. Unzip it. You now have **BSF-Command-Center-Setup-3.0.exe**.

If you see a red cross instead, click the run to read the error, and send it to me.

## Part 3 · Install

1. Double-click **BSF-Command-Center-Setup-3.0.exe**.
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

## Updating to a new version

1. Replace the files in your folder with the new ones I give you (keep the `.git` and `.github` folders).
2. In GitHub Desktop, type a short summary (for example "Update to 3.1") → **Commit to main** → **Push origin**.
3. Download the new installer from **Actions** as in Part 2, and run it. It installs over the old version.
   Your data is untouched. If the app is open, the installer closes it first.

## Keeping permanent copies of each version (recommended)

Artifacts on the Actions tab are deleted after 90 days. To keep an installer permanently:
on github.com open **Releases → Draft a new release → Choose a tag**, type **v3.0** (the version number
with a "v"), and click **Publish release**. GitHub builds the installer again and attaches it to that release.
If a future update ever misbehaves, download the previous version from **Releases** and install it.

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
- Anything else: Settings → Diagnostics → **Copy diagnostics** (it contains no PIN or member details),
  plus `bsf-app-log.txt` from the data folder.
