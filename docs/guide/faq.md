# Frequently asked questions

Straight answers to the questions churches ask most about FrameDecks.

**Who this is for:** pastors, worship leaders, small-group leaders, media teams and anyone deciding whether FrameDecks fits their ministry.

**On this page**
- [General](#general)
- [Services and planning](#services-and-planning)
- [Worship and lyrics](#worship-and-lyrics)
- [Bible](#bible)
- [Media and PowerPoint](#media-and-powerpoint)
- [Online and hybrid services](#online-and-hybrid-services)
- [Phone remote](#phone-remote)
- [Volunteers and training](#volunteers-and-training)
- [Data, privacy and offline use](#data-privacy-and-offline-use)
- [Cost and licensing](#cost-and-licensing)
- [Technical](#technical)

---

## General

**What is FrameDecks?**
A presentation app for churches and faith communities. You plan a meeting as a list of **Frames** (Welcome, Worship, Scripture Reading, Discussion, Closing), fill each Frame with **Content** (questions, scriptures, text, pictures, videos, PowerPoint, a timer), and present it to Zoom, Teams, Google Meet, OBS or a projector, from the PC or a phone.

**Who is it for?**
Bible studies, small groups, prayer meetings, trainings and services, especially ones with people joining online. It was first built for Bible study groups meeting on Zoom.

**Does it replace ProPresenter or EasyWorship?**
Not completely. FrameDecks focuses on Bible study, discussion and teaching, online or hybrid, with a built-in camera for meeting apps and a very simple phone remote. It has no song library, multi-screen stage display layouts or lighting control. Many churches use it for midweek groups and online gatherings alongside their Sunday software.

**Is it difficult to learn?**
No. A volunteer can run a meeting from the **Simple** phone remote with six buttons. Building a meeting takes most leaders one session to learn. See [Getting started](getting-started.md).

**What does a Frame mean?**
One screen, or one step, of your meeting. A Frame holds its own Content and never shares it with another Frame. See [Frames](frames.md).

## Services and planning

**How do I plan a service?**
Create a Frame for each part of the service in order, add Content to each, and check them on the Studio Canvas. See [Service planning](service-planning.md).

**Can I reuse last week's service?**
Yes. **Duplicate** a Frame (⋯ on the Frame) to make a fully independent copy, or **Save as template** to start new Frames from it. You can also export a whole meeting to Excel and import it later.

**Can I plan in Excel?**
Yes, optionally. The **Meeting Workbook** (Settings → Data / Backup → Download the Excel template; since 6.11 the website's Meeting Form does the same online) has two tabs: the **Meeting Form**, one guided page where you type the meeting details, Frames, Content, questions and scriptures, and the **Dashboard**, which sums it up for you. Import shows every problem with where it is (for example *Meeting Form · Content · row 26*) before anything changes, and can be undone. Workbooks from earlier versions still import. See [Meeting Workbook and branding](../reference/meeting-workbook-and-branding.md).

**Can two people edit the same service at once?**
No. FrameDecks runs on one PC with no accounts or shared workspaces. To share a plan, export it (Excel Meeting Workbook or a Frame file) and import it on the other PC.

**Can it advance automatically?**
Yes. Each Frame can **Auto advance** after a number of seconds (Content Settings → Timing), while **Auto** is on in the command bar.

**Is there a countdown timer?**
Yes. **+ Content → Timer** counts down a number of minutes, or until a time of day, and shows your message at zero.

**Can we run a poll?**
A simple one. **+ Content → Poll (show of hands)** shows a question with choices A, B and C. People answer by raising a hand or typing in the chat. FrameDecks does not collect or count votes. There are also **Discussion topic** and **Icebreaker** cards for small groups.

## Worship and lyrics

**Does FrameDecks have a song library?**
Not yet. There is no song database, verse/chorus arrangement or CCLI reporting today. A song library is on the [Roadmap](../ROADMAP.md).

**So how do we show song words?**
Two good ways:
1. **Text Content**: one Frame per verse or chorus, with the words in the Text field. Step through with **NEXT FRAME**.
2. **PowerPoint or PDF**: use your existing lyric slides, added as PowerPoint Content. Step through with **NEXT CONTENT** or **Page Down**.

**Do we still need a CCLI licence?**
FrameDecks doesn't change your copyright responsibilities. If you show or stream song lyrics, you need the licences your church normally holds (for example, CCLI Copyright and Streaming licences). FrameDecks doesn't report usage for you.

## Bible

**Which Bible translations are available?**
The **ESV** can be fetched automatically (free API key for churches at api.esv.org, entered in Settings → Scripture). For any other translation, choose **Fetch from → Type it myself** and type or paste the text with its translation name.

**Does scripture work without the internet?**
Typed scriptures always work offline. ESV verses you have fetched before are kept on the PC and still work offline. New ESV verses need the internet.

**Can I show a question and its scripture together?**
Yes. In a Question Content, choose **Show: Both** to show the question with its linked scripture, or set it per question.

## Media and PowerPoint

**Can I use my PowerPoint slides?**
Yes, two ways. Add the .pptx as **PowerPoint Content** (it becomes still slides using the PowerPoint installed on your PC), or show the running slide show as **Window Content** to keep animations. See [Media](media.md#powerpoint-and-pdf).

**Can slide text sit on top of the camera without the slide background?**
Yes, with **Show objects only**, if the slides have one plain background colour. It is a colour key, not true transparency, so gradients and picture backgrounds stay. Details: [PowerPoint in detail](../reference/powerpoint.md).

**Which video formats work?**
MP4 (H.264) is the safest. Keep videos on the PC rather than a USB stick.

**Can I play a video with sound to people online?**
Not through FrameDecks: Video Content plays muted. For a video with sound, play it in a media player and share it in the meeting app (for example, Zoom's **Share Screen** with **Share Sound**), or play it through your sound desk.

**Can I draw on the screen while teaching?**
Yes. **Annotate** (**D**) gives a pen, highlighter, arrow, line, rectangle, ellipse and text, in six colours. Everyone sees the drawings, in the room and online. You can also draw from your phone.

## Online and hybrid services

**How do people on Zoom see our slides and questions?**
Choose the **FrameDecks** camera in Zoom (or Teams, Google Meet, OBS). Participants see your webcam with the live Frame on top. No screen sharing needed.

**Can we use a projector in the room at the same time?**
Yes. Open the **Presentation window** (**Share Window** on the Studio Canvas) on the projector and make it full screen. It shows the same picture as the camera.

**Does it work with OBS for livestreaming?**
Yes. Add **FrameDecks** as a Video Capture Device, or use the overlay pages (`http://localhost:8750/...`) as Browser Sources on top of your own OBS scenes. See [Media](media.md#obs-and-browser-overlay-pages).

**Will Zoom participants see my teleprompter?**
No. The **Teleprompter overlay** is left out of screen sharing and recordings, even when you share your whole screen
(Windows 10 version 2004 or later). The Teleprompter window is left out too. Neither is ever on the FrameDecks
camera. See [Teleprompter overlay](presentations.md#teleprompter-overlay-meeting-leader-mode).

**Does it work on a Mac?**
No. FrameDecks is a Windows 10/11 app. The phone remote works on iPhone, iPad and Android.

## Phone remote

**How do I control it from my phone?**
**Settings → Phone & iPad Remote** → turn it on → scan the QR code → enter the PIN. See [Remote control](remote-control.md).

**Do I need an app from the App Store?**
No. The remote opens in the phone's browser. You can add it to the home screen so it opens like an app.

**Does the phone need internet?**
No, only the same Wi-Fi network as the PC.

**Can I see my script on the phone?**
Yes. In the Simple remote, select **TELEPROMPTER** to see the Frame's script full screen. The Advanced remote has a Teleprompter panel on its **Live** tab.

**Can someone outside the church take control?**
The remote works only on your local network, and only with the 6-digit PIN. After 5 wrong tries a device must wait 60 seconds. **New PIN** signs everyone out.

**Can more than one phone control it?**
Yes. Any phone signed in with the PIN can control the meeting, and every screen stays in step.

## Volunteers and training

**How do we train a new volunteer?**
Use the three-week onboarding plan in [Church operations](../ministry/README.md): shadow, then assisted, then solo.

**What is the minimum a volunteer needs to know?**
Five things: **Go Live**, **NEXT FRAME**, **NEXT CONTENT**, **HIDE ALL**, and **BLACK SCREEN**. See the [volunteer guide](../ministry/volunteers.md).

**What if a volunteer presses the wrong thing on air?**
Press **HIDE ALL** (or **Esc** on the PC), then put the right Frame back with **Go Live**. Nothing is ever deleted by these buttons.

**Can the leader see notes that the congregation can't?**
Yes. Write them in each Frame's **Teleprompter script** (Frame settings). Open it with **Live tools → Teleprompter → In this window** (**R**), in the **Teleprompter window** on a second screen, or with **TELEPROMPTER** on the phone remote. See [Presentations](presentations.md#teleprompter).

**Can the audience see the teleprompter?**
No. The Teleprompter is only for the presenter. It is never on the FRAMECAST camera, the Presentation window, the OBS pages or the phone's drawing pad.

**Where did the answers and notes on my questions go?**
Since 6.7, questions and scriptures have no Answer or Notes fields, and no screen shows them. Nothing was deleted from your data. When you import an older Meeting Workbook, its answers and notes go into the Frame's Teleprompter script.

**Is there a quick way to find something?**
Yes. Press **Ctrl+K** or **Ctrl+Space** to open the command palette. (There is no search box in the top bar since 6.9.) Type a few letters to find a Frame, a question, a scripture, a setting or a member, or to run a command such as **Go Live**. See [Presentations](presentations.md#command-palette). From anywhere in Windows, even with the app in the tray, press **Alt+Space** to open the same search as **Spotlight**. See [Spotlight](presentations.md#spotlight).

## Data, privacy and offline use

**Where is our data stored?**
Only on your PC, in `%APPDATA%\FRAMEDECKS`. Nothing is uploaded. There are no accounts and no cloud.

**Does FrameDecks work without the internet?**
Yes. Everything works offline except fetching new ESV verses, and whatever your meeting app needs (Zoom itself needs the internet).

**Are backups made?**
Yes, automatically once a day (the newest 10 are kept), plus **Back up now** in Settings → Data / Backup.

**What about member information?**
The Members section stays on the PC. Member details are never sent to the phone remote or the overlay pages, and **Copy diagnostics** never includes them.

**How do we move to a new PC?**
Install FrameDecks on the new PC. On first run it offers to import data from an earlier installation, or copy your data folder across while the app is closed.

## Cost and licensing

**Is there a subscription?**
No. FrameDecks has no subscription, billing, accounts or per-seat fees.

**What licence is it under?**
The licence terms aren't published in the repository yet. Please ask the maintainer before redistributing or modifying it. The FRAMECAST camera driver is built from softcam (MIT licence); the background-blur model is from MediaPipe (Apache 2.0).

## Technical

**Can I keep the app running without a taskbar button?**
Yes. Select **Minimize** and choose **Hide To Tray**. FrameDecks keeps running from its icon near the clock: the camera, the overlays, the phone remote and the shortcuts keep working. Click the icon, or choose **Open App** in its menu, to bring the window back. To make it the default, tick **Remember my choice**, or set **Settings → General → Window and tray → Minimize button**.

**What computer do we need?**
A Windows 10 or 11 (64-bit) PC, plus a webcam if you want the camera picture. On older or busy PCs use 720p and light background blur; **Settings → Diagnostics** shows whether the PC keeps up (dropped frames should stay at 0).

**Why does Windows warn me when installing?**
The installer isn't code-signed yet, so Windows SmartScreen shows "Windows protected your PC". Select **More info → Run anyway**. You can check the download against its `.sha256` file.

**Which ports and network access does it use?**
A local web server on port 8750 (falling back to 8751–8760 if needed) for the app window, overlay pages and phone remote. The firewall rule is for **Private networks** only.

**Where do I report a problem or request a feature?**
See [Support](../../.github/SUPPORT.md). Include **Settings → Diagnostics → Copy diagnostics** with problem reports.

## Related
- [Getting started](getting-started.md)
- [Troubleshooting](troubleshooting.md)
- [Remote control](remote-control.md)
- [Media](media.md)
- [Church operations](../ministry/README.md)
- [Roadmap](../ROADMAP.md)
