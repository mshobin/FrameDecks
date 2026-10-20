# Getting started

Your first fifteen minutes with Kingdom Connect: install it, find your way around, build a meeting and put it on screen.

**Who this is for:** anyone opening Kingdom Connect for the first time, such as a small-group leader, a worship
leader or a media volunteer.

**On this page**
- [What Kingdom Connect is](#what-kingdom-connect-is)
- [Before you start](#before-you-start)
- [First launch](#first-launch)
- [A tour of the window](#a-tour-of-the-window)
- [Build your first meeting](#build-your-first-meeting)
- [Go Live and step through](#go-live-and-step-through)
- [Add your phone (optional)](#add-your-phone-optional)
- [Your first Sunday checklist](#your-first-sunday-checklist)

---

## What Kingdom Connect is

Kingdom Connect is a presentation app for services, Bible studies, prayer meetings and small groups. It runs on one
Windows PC. It needs no accounts and no cloud, and it works without internet.

You build a **Meeting** (your service or meeting) out of **Frames**. A Frame is one screen or one step, such as
*Welcome*, *Scripture Reading*, *Discussion* or *Closing*. Each Frame holds **Content**: a question, a scripture, a
timer, an image, a video, a PowerPoint and more.

When the meeting starts, you press **Go Live** and step from Frame to Frame. What you show appears on:
- **KingdomConnect**, a camera you choose in Zoom, Microsoft Teams, Google Meet or OBS (your webcam with your
  Content on top);
- the **Presentation window**, which you can share in Zoom or show full screen on a projector or TV;
- **OBS / browser overlay pages** at `http://localhost:8750/...`, for setups that use OBS.

```mermaid
flowchart LR
  A["Meeting"] --> B["+ Frame"]
  B --> C["+ Content"]
  C --> D["Go Live"]
  D --> E["Step through: Frame ▶"]
  E --> F["Phone remote (optional)"]
```

## Before you start

You need:
- a Windows 10 or Windows 11 PC (64-bit);
- the Kingdom Connect installer. See [Installation](installation.md).

A webcam is optional. You need one only if people should see you on the KingdomConnect camera.

## First launch

1. Open **Kingdom Connect** from the desktop icon.
2. If you used the zip version of Kingdom Connect before, the app offers to **import your existing data**. Choose
   your old folder (it is usually found automatically) and select **Import**. Your old folder is not changed. (An
   installed earlier version needs nothing: the installer updates it and your data is kept.)
3. The app opens on the **Studio**, where you build and run meetings.

> **Note:** Everything you do is saved automatically on this PC. There is no Save button to remember.

## A tour of the window

![The Studio: Frames on the left, the Studio Canvas in the middle, Content Settings below](images/studio.png)

*The Studio, shown with the built-in test camera ("Demo webcam") instead of a real webcam.*

| Area | Where | What it does |
| --- | --- | --- |
| **Command bar** | Across the top | Studio · Members · Settings (Alt+1, Alt+3, Alt+4), the search box (the command palette, Ctrl+K), **◀ Frame · Go Live · Frame ▶**, transitions, the question and scripture steppers, the **Program** menu, **Hide all** and the LIVE status |
| **Frames** | Left, top | Every Frame in your meetings, in order. The live Frame is marked **LIVE**, the next one **NEXT** |
| **Content** | Left, bottom | The Content inside the selected Frame. The top of the list is in front |
| **Studio Canvas** | Middle | A preview of the selected Frame, or the live picture. The badge says **PREVIEW · not on air** or **LIVE** |
| **Content Settings** | Below the canvas | Every setting for what you selected, most used first: Label, Content, Display Settings, Visual Settings (a Frame has Frame, Timing and History) |

> **Tip:** The canvas badge is your safety check. **PREVIEW · not on air** means nobody sees what you are editing.

### The window buttons and the tray

Kingdom Connect has no Windows title bar. The command bar at the top is the window's ribbon:
- drag an empty part of it to move the window, and double-click it to maximize;
- Snap (dragging to a screen edge, or Windows key + arrows) and resizing from the edges work as usual;
- **Minimize**, **Maximize / Restore** and **Close** are at the top right of every Kingdom Connect window.

The first time you select **Minimize**, the app asks *Hide application to system tray?*
- **Hide To Tray** removes the taskbar button. The icon stays in the tray near the clock.
- **Stay In Taskbar** minimizes as usual.

Tick **Remember my choice** to stop the question. You can change it later in **Settings → General → Window and tray
→ Minimize button**. In the tray, everything keeps working: the camera, the overlays, the phone remote and the
shortcuts. Click the tray icon, or choose **Open App** in its menu, to bring the window back.

> **Tip:** Press **Alt+Space** anywhere in Windows to open **Spotlight**, a search box that finds and runs anything
> in Kingdom Connect, even from the tray. See [Spotlight](presentations.md#spotlight).

If you prefer the Windows title bar, turn off **Modern window** in **Settings → General → Window and tray** and
restart.

## Build your first meeting

There are two quick ways to start.

### Option A: Quick Start (fastest)

1. Select the **✨ Meeting** button next to **+ Frame**.
2. Choose **Quick Start…**.
3. Pick what you are leading, for example **Sunday Service** or **Bible Study**.
4. A complete set of Frames appears in its own group. Change any of them; nothing is on screen until you press
   **Go Live**.

### Option B: Build it yourself

1. Select **+ Frame**. A blank Frame appears after the selected one.
2. Double-click its name (or press **F2**), type a name such as *Discussion*, and press **Enter**.
3. With the Frame selected, select **+ Content** and choose **Question**.
4. Type your first question in the editor and select **Done**. Add more with **+ Question**, or paste many at once
   with **Add several**.
5. Repeat for the other parts of your meeting: a **Scripture**, a **Timer**, a **Text** welcome and so on.

> **Tip:** To change a question quickly, double-click the card on the Studio Canvas and type. **Enter** saves,
> **Esc** cancels. This works on any card, and on its label (the top line).

See [Service planning](service-planning.md), [Frames](frames.md) and [Content](content.md) for more.

## Go Live and step through

1. Select the first Frame.
2. Select **Go Live** (or press **T**). The badge turns to **LIVE**.
3. Move through the meeting:
   - **Frame ▶** (or **]**) goes to the next Frame; **◀ Frame** (or **[**) goes back;
   - **→ / ←** step through the Frame's questions;
   - **Shift + → / ←** step through its scriptures.
4. When you need a clean screen, press **Esc** (**Hide all**).

See [Presentations](presentations.md) for transitions, Blackout, Freeze, Annotate, the Teleprompter, the Teleprompter
overlay, the command palette and Spotlight.

## Add your phone (optional)

Your phone can run the whole meeting: next Frame, next question, Annotate, Freeze and Black Screen.

1. Open **Settings → Phone & iPad Remote** and turn it on.
2. The first time, Windows Firewall asks about network access. Tick **Private networks** only, then **Allow**.
3. Scan the QR code with your phone and enter the PIN shown.

See [Remote control](remote-control.md).

## Your first Sunday checklist

Do this once, a day or two before your first real meeting.

- [ ] The app opens and shows your meetings.
- [ ] In Zoom, Teams or Meet, the camera **KingdomConnect** is listed and selected (restart the meeting app after
      installing).
- [ ] You can **Go Live** on your first Frame and step to the last one.
- [ ] Your questions and scriptures read correctly on the canvas. Fix typos by double-clicking a card.
- [ ] **Hide all (Esc)** and **Blackout (K)** work.
- [ ] If you use a projector: **Share Window** opens the Presentation window and it fills the projector screen.
- [ ] If you use your phone: it connects, and **NEXT FRAME** works.
- [ ] You know where the **Teleprompter** is (Program → Teleprompter, or **R**) if you want your script in front of
      you. Only you see it. On Zoom or Teams, try the **Teleprompter overlay** (**Shift+R**) over the meeting.
- [ ] Do a 10-minute rehearsal with one other person on a test Zoom call.

> **Important:** Rehearse on the same PC, network and room you will use on the day. Most problems are found in the
> first rehearsal, not during the service.

## Related
- [Installation](installation.md)
- [Service planning](service-planning.md)
- [Presentations](presentations.md)
- [Frames](frames.md) and [Content](content.md)
- [Remote control](remote-control.md)
- [Troubleshooting](troubleshooting.md) and [FAQ](faq.md)
- [Ministry team guides](ministry/README.md)
