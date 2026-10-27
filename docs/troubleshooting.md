# Troubleshooting

Find the symptom, read the likely cause, apply the fix. Most problems take under a minute to solve.

**Who this is for:** anyone running FrameDecks, especially on a Sunday morning with little time.

**On this page**
- [First: stay calm on air](#first-stay-calm-on-air)
- [The app](#the-app)
- [Window, tray and Spotlight](#window-tray-and-spotlight)
- [The FRAMECAST camera](#the-framecast-camera)
- [Phone remote](#phone-remote)
- [PowerPoint and media](#powerpoint-and-media)
- [Scripture](#scripture)
- [Performance](#performance)
- [Audio](#audio)
- [Data and backups](#data-and-backups)
- [Collecting diagnostics](#collecting-diagnostics)
- [Getting help](#getting-help)

---

## First: stay calm on air

If something wrong appears on screen during a service, fix the picture first and investigate later.

| You need to… | Do this |
| --- | --- |
| Remove everything from the screen | **Hide all** (**Esc**), or **HIDE ALL** on the phone |
| Hide the picture completely | **Live tools → Black screen** (**K**), or **BLACK SCREEN** on the phone |
| Keep the current picture while you fix something | **Live tools → Freeze the picture** (**F**), or **FREEZE** on the phone |
| Show a holding message | **Live tools → Emergency screen** |

Then put the right Frame back on screen with **Go Live** (**T**).

## The app

### The app doesn't open

| Cause | Fix |
| --- | --- |
| It is already running in the background | Look for its icon near the clock (it may be under the **^** arrow). Click it to open the window |
| Antivirus quarantined it | See [Antivirus warnings](#antivirus-or-smartscreen-warnings) |
| Ports 8750–8760 are all in use | FrameDecks says so when it starts. Restart the PC, or close the program using those ports |

### The app opens in a browser-like window

| Cause | Fix |
| --- | --- |
| **Microsoft Edge WebView2 Runtime** is missing | FrameDecks then opens as an Edge app window, which works normally. For the full app window, install WebView2 from microsoft.com and open the app again |

### "Port 8750 is in use"

Overlay pages and the phone remote expect port 8750. Another program is using it.

| Cause | Fix |
| --- | --- |
| A second copy of FrameDecks (for example, the start-file version) | Close it, then open the installed app |
| Another program uses the port | Restart the PC. If it keeps happening, find the program with `netstat -ano | findstr 8750` in Command Prompt |

### Antivirus or SmartScreen warnings

| Symptom | Cause | Fix |
| --- | --- | --- |
| **"Windows protected your PC"** when installing | The installer isn't code-signed | Select **More info → Run anyway** |
| Antivirus blocks or quarantines the app | A known false alarm with unsigned apps made with Python | Restore it and add an exception for `%LOCALAPPDATA%\Programs\FRAMEDECKS` |

> **Note:** Check the download first: the installer comes with a `.sha256` file you can compare with `certutil -hashfile "FrameDecks v6.8.exe" SHA256`.

## Window, tray and Spotlight

### Where did the app go when I minimized?

You chose **Hide To Tray**, so the taskbar button went away. FrameDecks is still running: the camera, the
overlays, the phone remote and the shortcuts keep working.

| Cause | Fix |
| --- | --- |
| The app is hidden in the tray | Click its icon near the clock (it may be under the **^** arrow), or right-click it and choose **Open App** |
| You want a taskbar button again | **Settings → General → Window and tray → Minimize button** → **Stay in taskbar** (or **Ask each time**) |

### I want the Windows title bar back

Turn off **Modern window** in **Settings → General → Window and tray**, then restart FrameDecks. The Windows
title bar comes back. Do the same if the ribbon at the top ever misbehaves on your PC (it does not move, maximize or
snap as it should).

### Alt+Space doesn't open Spotlight

| Cause | Fix |
| --- | --- |
| Another program already uses Alt+Space (for example PowerToys Run) | FrameDecks then uses **Ctrl+Alt+Space**. **Settings → General → Window and tray** shows which shortcut works |
| The chosen shortcut is taken too, or set to **Off** | Pick another shortcut in **Settings → General → Window and tray → Spotlight**: Ctrl+Space, Ctrl+Alt+Space, Ctrl+Shift+Space or Win+Shift+K. The line under it says whether it works |
| You need Alt+Space for the window menu of other programs | Choose another Spotlight shortcut |

Inside FrameDecks, **Ctrl+K** always opens the command palette, which finds the same things.

### I can't see my meeting through the overlay

| Cause | Fix |
| --- | --- |
| **Light on graphics card** is on (the default) | The overlay then fades as a whole, text included. Choose a more see-through mode (**3** to **5**). For solid text over a see-through background, turn off **Settings → General → Performance → Light on graphics card** and restart |
| The see-through background does not work on this PC | Turn on **Compatibility transparency** in **Settings → General → Window and tray**, then close and reopen the overlay. The whole window fades instead |
| The mode is **Solid** | Press **3** (**Meeting**) or higher |
| The overlay hides behind Zoom or Teams | Turn on **Stay on top** (📌, or press **P**) |
| You are using FrameDecks in a web browser | The overlay can be see-through and stay on top only in the installed app |

> **Note:** Frosted glass is Acrylic on Windows 11 (22H2 and later) and a plain blur on Windows 10. Leaving the
> overlay out of screen sharing needs Windows 10 version 2004 or later.

## The FRAMECAST camera

### Zoom, Teams or OBS doesn't list FrameDecks

| Cause | Fix |
| --- | --- |
| The app was open before installing | Restart Zoom, Teams, OBS or the browser. They read the camera list when they start |
| The camera wasn't installed | **Settings → How people see it → FRAMECAST Camera → Install FRAMECAST** (asks for administrator permission once) |
| Still shows the camera's earlier name (older versions) | Restart the app. If it is still missing, run the installer again with the camera option ticked |
| The app reads only Media Foundation cameras | Zoom, Teams, Google Meet in Chrome or Edge, and OBS do list it. Some other apps may not |

### FrameDecks is black or frozen

| Cause | Fix |
| --- | --- |
| **Black screen** or **Freeze** is on | Check the **Live tools** button: it reads **Black screen on ▾** or **Frozen ▾**. Turn it off |
| FrameDecks is off | **Settings → How people see it → FRAMECAST Camera** → turn it on |
| Another app has the webcam | Choose **FrameDecks** (not the webcam) in every meeting app. Only one app can open a webcam |
| The wrong webcam is selected | **Settings → How people see it → FRAMECAST Camera** → choose the webcam |
| The webcam is unplugged or asleep | Reconnect it; FrameDecks picks it up again |

### My text looks reversed

Zoom mirrors **your own** preview only. Participants see the text the right way round. To check, turn off **Mirror my video** in Zoom's video settings.

## Phone remote

### The phone can't connect

| Cause | Fix |
| --- | --- |
| The remote is off | **Settings → Phone & iPad Remote** → turn it on |
| Phone and PC on different networks | Put both on the same Wi-Fi. Guest networks and mobile data won't work |
| Windows Firewall blocks it | Run **Allow iPad Remote - run once.bat** (in the FrameDecks folder) once, or allow the app for **Private networks** |
| Windows treats the Wi-Fi as **Public** | Windows Settings → Network & internet → your network → **Private** |
| The PC's address changed (new Wi-Fi, restarted router) | Scan the QR code in Settings again |

### "Locked" after entering the PIN

After 5 wrong PINs, that device must wait **60 seconds**. Check the PIN in **Settings → Phone & iPad Remote** and try again.

### The drawing pad shows only the cards, not the camera

| Cause | Fix |
| --- | --- |
| The FRAMECAST camera is off or starting | The pad shows the Frame's cards until the camera picture is ready. Turn FrameDecks on in Settings, or wait a few seconds |

### All phones were signed out

Someone selected **New PIN**, which signs out every device. Enter the new PIN on each phone. Phones also need the PIN again after 30 days.

## PowerPoint and media

### A .pptx won't turn into slides

| Cause | Fix |
| --- | --- |
| PowerPoint isn't installed on this PC | Save the deck as **PDF** (in PowerPoint, Keynote or Google Slides) and add the PDF |
| PowerPoint shows a sign-in, licence or update prompt | Open PowerPoint once by hand, deal with the prompt, close it, then try again |
| The file came from the internet (**Protected View**) | Open it in PowerPoint, select **Enable Editing**, save, then add it again |
| A very large deck took longer than 3 minutes | Save as PDF and add the PDF |

### Show objects only leaves a background

The setting removes **one plain background colour**. Gradients and picture backgrounds stay. Give the slides a solid colour the content doesn't use (pure green works well). See [Media](media.md#show-objects-only).

### A captured window stopped updating

Keep the window open and not minimised. A second display is the most reliable place for a live slide show.

## Scripture

### "Add your ESV API key…"

ESV fetching needs a free API key from api.esv.org, entered in **Settings → Scripture**. Or choose **Fetch from → Type it myself** and type or paste the verse.

### Fetching fails with no internet

Verses you fetched before are kept on the PC and still work offline. New verses need the internet, or type them in with **Type it myself**.

### "Only the ESV can be fetched"

Other translations aren't fetched. Choose **Type it myself** and type or paste the text, with its translation name.

## Performance

### The picture stutters or the PC is slow

| Cause | Fix |
| --- | --- |
| The graphics card is busy | Keep **Settings → General → Light on graphics card** on |
| Too much running at once | Close extra browser tabs, video apps and unused overlay pages |
| 1080p on an older PC | Use **720p** in **Settings → How people see it → FRAMECAST Camera** |
| Background blur on a slow PC | Lower the blur, or turn it off |

**Settings → Diagnostics** shows the frame rate, dropped frames, processor use and which screens are busy.

## Audio

FrameDecks doesn't capture or send sound, and Video Content plays muted. Your microphone goes to Zoom or Teams through their own audio settings. When a video's sound matters, play the video in a media player with sound and share it in your meeting app (for example, Zoom's **Share Screen** with **Share Sound**), or play it through your sound desk.

## Data and backups

### Restoring a backup

FrameDecks makes a backup automatically once a day and keeps the newest 10. They are in `%APPDATA%\FRAMEDECKS\backups\`.

1. **Settings → Data / Backup → Open backups folder**, and find the backup you want (each is a folder named by date).
2. Restore it in one of these ways:
   - use **Load a backup file** in the same Settings section;
   - for member lists, use **Members → Import Excel**;
   - or close FrameDecks completely (icon near the clock → Quit), copy the backup's files into the data folder, then open FrameDecks again.

> **Tip:** Before a big change (a new series, importing a Meeting Workbook), select **Back up now**.

### Frames disappeared after an Excel import

Open the **Meeting** menu (✨ next to **+ Frame**) and choose **Undo the last Excel import**.

## Collecting diagnostics

**Settings → Diagnostics → Copy diagnostics** copies the information needed for support to the clipboard. It contains no PIN and no member details. Paste it into your message.

## Getting help

1. Check this page and the [FAQ](faq.md).
2. Copy diagnostics (above).
3. Contact the person who installed FrameDecks for your church, or see [Support](../SUPPORT.md).

## Related
- [FAQ](faq.md)
- [Remote control](remote-control.md)
- [Media](media.md)
- [Installation](installation.md)
- [Configuration guide](reference/configuration-guide.md)
- [Service-day checklist](ministry/service-day-checklist.md)
