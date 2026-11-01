# Phone and tablet remote

Run the service from a phone or iPad: step through Frames, questions, scriptures and slides, draw on the picture, freeze or black out the screen.

**Who this is for:** service operators, remote operators and leaders who want to move freely while presenting.

**On this page**
- [How it works](#how-it-works)
- [Set up the remote](#set-up-the-remote)
- [Security](#security)
- [The remote](#the-remote)
- [Teleprompter on the phone](#teleprompter-on-the-phone)
- [Drawing from the phone](#drawing-from-the-phone)
- [iPad and tablet layout](#ipad-and-tablet-layout)
- [Add it to your home screen](#add-it-to-your-home-screen)
- [Tips for remote operators](#tips-for-remote-operators)
- [If the phone can't connect](#if-the-phone-cant-connect)

---

## How it works

The remote is a web page served by FrameDecks on your PC. Your phone opens it over your church's (or home's) Wi-Fi. Nothing goes through the internet or any outside service.

```mermaid
flowchart LR
  Phone["Phone or iPad<br/>(browser)"] -- "Wi-Fi, PIN-protected" --> PC["FrameDecks<br/>on the PC (port 8750)"]
  PC --> Out["FrameRelay camera<br/>Presentation window<br/>overlay pages"]
```

Every button on the phone changes the same live state as the PC, so the PC, the phone and everyone watching always agree.

## Set up the remote

1. On the PC, open **Settings → Phone & iPad Remote** and turn the remote **on**.
2. The first time, Windows Firewall asks about network access. Tick **Private networks** only, then select **Allow**.
3. On the phone, join the **same Wi-Fi network** as the PC.
4. Scan the **QR code** shown in Settings with the phone's camera, or type the address shown there (it looks like `http://192.168.1.20:8750`).
5. Enter the **6-digit PIN** shown in Settings.

The phone stays signed in for 30 days. After that, or after a new PIN, enter the PIN again.

> **Tip:** In the same Settings section, tick the option to turn the remote on whenever FrameDecks starts, so it is ready every Sunday.

## Security

| Protection | What it means |
| --- | --- |
| **6-digit PIN** | Only people who know the PIN can control the service |
| **Same network only** | The remote works on your local network; it isn't reachable from the internet |
| **Lockout** | After 5 wrong PINs, that device must wait 60 seconds before trying again |
| **New PIN** | **Settings → Phone & iPad Remote → New PIN** signs out every phone and iPad at once |
| **PC-only settings** | Phones can't open Settings, member lists, the Scripture API key or the FrameRelay camera settings |
| **Live picture** | The picture on the phone's drawing pad is PIN-protected, like the rest of the remote |

> **Important:** Treat the PIN like a key to the sound desk. Share it only with the people running the service, and choose **New PIN** if it has been shared too widely.

## The remote

The remote is **one screen** with large buttons, so a volunteer can use it without training. Scroll down for the rest.

![The remote on a phone](images/remote-simple.png)

| Part | What it does |
| --- | --- |
| **Top bar** | The meeting name and the **Connected** status, always visible |
| **Hide all** | Hides everything on screen at once. It turns solid red while something is on screen |
| **On screen now** | The live picture, with a badge: **Off air**, **On screen**, **Black screen**, **Frozen** or **Emergency**. Below it: *Frame 4 of 18*, the Frame's name and what it is showing, plus **FrameRelay** and **Recording** chips when they are on |
| **Previous / Next** | Move through the Frames, in order. **Next** is gold, and says **Start** before anything is live |
| **Questions, scriptures or slides** | A card for the Frame's questions, scriptures or PowerPoint slides (*Question 2 of 5*, *Slide 3 of 12*). The round **◀ ▶** arrows step through them. When a Frame has more than one kind, chips choose which one the arrows move through. A Frame with a question **and** a scripture also gets a **Question / Both / Scripture** switch |
| **Teleprompter** | Opens the Frame's Teleprompter script full screen, on this phone only |
| **Draw** | Opens the drawing pad |
| **Freeze** | Holds the picture while you get the next thing ready |
| **Black screen** | Makes the picture black. Select it again (**Show picture**) to bring it back |
| **All Frames** | Every Frame as a card. Tap one to put it on screen. **Live** and **Next** tags show where you are |
| **Disconnect this device** | At the bottom: signs this phone out. Enter the PIN to connect again |

The **Emergency** screen is on the PC only. If it is on, the badge says **Emergency**; turn it off on the PC.

## Teleprompter on the phone

The phone can show the Frame's **Teleprompter script**, the same one you see on the PC. Only the phone shows it;
nobody watching sees it.

Select **Teleprompter**. The script opens full screen; select **Done** to close it.

Scroll with your finger, or use the play button to scroll by itself. See
[Presentations](presentations.md#teleprompter) for how to write the script.

## Drawing from the phone

1. Select **Draw**. The drawing pad opens with the **live picture**, exactly what Zoom, Teams or the projector shows.
2. Choose a tool (**Pen**, **Highlight**, **Arrow**, **Box**, **Circle**) and a colour.
3. Draw with your finger. The drawing appears on screen when you lift your finger.
4. **Undo** removes the last drawing; **Clear** removes them all.
5. Select **Done** to close the pad and hide the drawings.

> **Tip:** Turn the phone **sideways**. The picture then fills the screen and the tools move to a narrow column at the side, so you can draw more accurately. On Android the browser bars hide too; iPhone Safari keeps them.

![Drawing from a phone held sideways](images/remote-annotate.png)

While the pad is open, the phone gets a sharper picture (960 pixels wide). If the FrameRelay camera is off, the pad shows the Frame's cards instead, so you are never drawing on a black box.

## iPad and tablet layout

On an iPad or a large tablet, the **All Frames** list sits beside the controls, so you can see the whole meeting at once. On a phone it is below them.

## Add it to your home screen

- **iPhone / iPad (Safari):** Share → **Add to Home Screen**. It opens full screen, like an app, named **FrameDecks**.
- **Android (Chrome):** ⋮ → **Add to Home screen** (or **Install app**).

The icon opens the remote directly. You still need to be on the same Wi-Fi as the PC.

## Tips for remote operators

- Charge the phone fully, and turn on **Do Not Disturb** so notifications don't cover the buttons.
- Set the phone to stay awake (screen timeout off, or as long as possible) during the service.
- Check the **Connected** status before the service starts and after any Wi-Fi change.
- Use **Freeze** before switching windows or files on the PC, then unfreeze when ready.
- If something unexpected appears, select **Hide all** first, then work out what happened.

## If the phone can't connect

| Cause | Fix |
| --- | --- |
| The remote is off | **Settings → Phone & iPad Remote** → turn it on |
| The phone is on a different network (mobile data, guest Wi-Fi) | Join the same Wi-Fi as the PC. Guest networks often block devices from seeing each other |
| Windows Firewall blocks it | On the PC, run `tools/launchers/Allow iPad Remote - run once.bat` once, or allow the app for **Private networks** |
| The network is set to **Public** in Windows | Settings → Network & internet → your Wi-Fi → **Private network** |
| Wrong PIN too many times | Wait 60 seconds, then try again |
| The PC's address changed | Scan the QR code in Settings again |

More answers: [Troubleshooting](troubleshooting.md#phone-remote).

## Related
- [Presentations](presentations.md)
- [Remote operator guide](roles/remote-operators.md)
- [Troubleshooting](troubleshooting.md)
- [FAQ](faq.md#phone-remote)
- [Getting started](getting-started.md)
