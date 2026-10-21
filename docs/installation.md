# Installation

How to install, update and remove FrameDecks on a church or ministry PC.

**Who this is for:** whoever sets up the presentation PC, such as a media team lead, a volunteer or a church
administrator.

**On this page**
- [System requirements](#system-requirements)
- [Get the installer](#get-the-installer)
- [Check the download (optional)](#check-the-download-optional)
- [Install](#install)
- [First run](#first-run)
- [Allow the phone remote through the firewall](#allow-the-phone-remote-through-the-firewall)
- [Update to a new version](#update-to-a-new-version)
- [Where your data lives](#where-your-data-lives)
- [Uninstall](#uninstall)
- [If the app window looks like a browser](#if-the-app-window-looks-like-a-browser)

---

## System requirements

| | Requirement |
| --- | --- |
| **Operating system** | Windows 10 or Windows 11, 64-bit. There is no Mac or Linux version |
| **Processor and memory** | A typical laptop or desktop from the last few years. Background blur and 1080p use more processor time; Settings → Diagnostics shows the app's own load |
| **Webcam** | Optional. Needed only if people should see you on the FrameCast camera |
| **Microsoft PowerPoint** | Optional. Needed only to turn a **.pptx** file into slides. Without it, save your deck as PDF and add the PDF |
| **Microsoft Edge WebView2 Runtime** | Included with Windows 11 and most up-to-date Windows 10 PCs. Without it, the app still runs in an Edge app window |
| **Internet** | Not needed to run a meeting. Needed only to fetch ESV scripture text, to install WebView2, and for your video-call app itself |
| **Network** | Only for the phone remote: the PC and phone on the same Wi-Fi |

> **Note:** FrameDecks runs entirely on one PC. It has no accounts, no subscription and no cloud service.

## Get the installer

The installer is a single file named **FrameDecks v6.8.exe** (the number is the version).

- **From a release:** on the repository's **Releases** page, download the `.exe` (and, if you like, the matching
  `.sha256` file).
- **From a build:** in the repository's **Actions** tab, open the latest green **Build Windows installer** run and
  download the **FrameDecks v6.8** artifact. It is a `.zip`; unzip it to get the `.exe` and the `.sha256` file.

If you build the installer yourself, see [Building the installer](development/building-the-installer.md).

## Check the download (optional)

Each installer comes with a `.sha256` file containing its fingerprint. To check that your copy is complete and
unchanged:

1. Open **PowerShell** in the folder with the files.
2. Run:
   ```powershell
   Get-FileHash ".\FrameDecks v6.8.exe" -Algorithm SHA256
   ```
3. Compare the **Hash** with the text in `FrameDecks v6.8.exe.sha256`. Upper or lower case does not matter. They
   must match exactly.

## Install

1. Close **Zoom, Teams and OBS**. They keep the camera in use and can block the camera installation.
2. Double-click **FrameDecks v6.8.exe**.
3. Windows may show **"Windows protected your PC"**. The installer is not code-signed, so Windows does not recognise
   it yet. Select **More info → Run anyway**.
4. Follow the wizard. The options are:

   | Option | Recommended | What it does |
   | --- | --- | --- |
   | **Create a desktop icon** | On | A FrameDecks icon on the desktop |
   | **Install the FrameCast camera for Zoom and Teams** | On | Adds the **FrameCast** camera to Windows. Windows asks for administrator permission once, only for this |
   | **Start automatically when I sign in** | Your choice | Opens FrameDecks when you sign in to Windows |

5. Finish the wizard. FrameDecks opens.

> **Tip:** If you skipped the camera, you can add it later in **Settings → FrameCast Camera → Install
> FrameCast**.

## First run

1. If you used the zip version of FrameDecks on this PC, the app offers to **import your existing data**. Choose
   the old folder and select **Import**. Members, saved questions and scriptures, settings and the phone PIN are
   copied. The old folder is not changed.
2. Restart Zoom, Teams, OBS or your browser for Google Meet. They read the list of cameras only when they start.
3. In each app, choose **FrameCast** as the camera:
   - **Zoom:** Settings → Video → Camera → FrameCast. Tick **HD** and turn off Zoom's own background blur.
   - **Microsoft Teams:** Settings → Devices (or Video and effects) → Camera → FrameCast.
   - **Google Meet:** ⋮ → Settings → Video → Camera → FrameCast.
   - **OBS:** Sources → + → Video Capture Device → Device: FrameCast.
4. In FrameDecks, open **Settings → FrameCast Camera** and choose the webcam behind it, the resolution
   (720p or 1080p), background blur and Camera Look.

## Allow the phone remote through the firewall

The first time you turn on **Settings → Phone & iPad Remote**, Windows Firewall asks whether FrameDecks may use
the network.

1. Tick **Private networks** only.
2. Select **Allow**.

> **Important:** Do not allow **Public networks**. The remote is meant for your church's own Wi-Fi.

If the phone still cannot connect, see [Troubleshooting](troubleshooting.md).

## Update to a new version

1. Close Zoom, Teams and OBS.
2. Run the new installer. It installs over the old version.
3. Your meetings, settings, members, backups and phone PIN are kept.

> **Note:** FrameDecks was first published under an earlier name. Version 6.9 installs over every earlier
> version, removes the old program folder and shortcuts, and on first start moves your data (including backups and
> recordings) to the FrameDecks folders below. Nothing newer is overwritten.

Read the release notes in [CHANGELOG.md](../CHANGELOG.md) before a big update, and avoid updating on the morning of a
service.

## Where your data lives

| What | Where |
| --- | --- |
| The program | `%LOCALAPPDATA%\Programs\FrameDecks` |
| Your data (meetings, settings, members, PIN) | `%APPDATA%\FrameDecks` |
| Backups | `%APPDATA%\FrameDecks\backups` (daily, plus any you make) |

**Settings → Data / Backup** shows the data folder, lets you make a backup now and restore one. See
[reference/configuration-guide.md](reference/configuration-guide.md) for the files inside.

## Uninstall

1. Open Windows **Settings → Apps → Installed apps**.
2. Find **FrameDecks** and choose **Uninstall**.

Your data folder is left in place, so reinstalling brings everything back. Delete
`%APPDATA%\FrameDecks` yourself only if you want to remove your data for good, and make a backup first.

## If the app window looks like a browser

FrameDecks normally opens in its own window, without an address bar or tabs. If **Microsoft Edge WebView2
Runtime** is missing, it opens as an Edge app window instead. That works the same way. Install WebView2 from
microsoft.com for the full app window.

## Related
- [Getting started](getting-started.md)
- [Remote control](remote-control.md)
- [Troubleshooting](troubleshooting.md)
- [Building the installer](development/building-the-installer.md)
- [Configuration reference](reference/configuration-guide.md)
