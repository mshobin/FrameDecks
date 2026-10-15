# Kingdom Connect: user guide (v6.4)

Kingdom Connect runs your online Bible study, prayer meeting or fellowship group on Zoom, Microsoft Teams or Google
Meet:
- scenes with questions, Scripture, prayer and announcements;
- your own camera, **KingdomConnect**;
- a phone remote;
- **Team Space** for co-leaders.

Everything runs on your PC.

- Installing: `BUILD-AND-INSTALL.md` (Installation Guide)
- Setting up the camera, Team Space and WireGuard: `docs/configuration-guide.md`
- How each feature works: `docs/features.md`, `docs/meeting-import-and-branding.md`

---

## 1. The window
Kingdom Connect opens as a desktop app, like Teams or Slack. It has no address bar or browser buttons. Minimize,
Maximize/Restore and Close are at the top right as in any Windows app, and the title bar matches the app's dark or
light theme.

The **command bar** across the top holds everything you need live:

| Part | What it does |
| --- | --- |
| Book + Candle logo | Kingdom Connect. Hover over it to see your Meeting Name |
| Studio · Members · Settings | The three sections (Alt+1, Alt+3, Alt+4) |
| Search (Ctrl+K) | Scenes, layers, Bible references, questions, members, settings |
| ◀ Scene · **Go Live** · Scene ▶ | Put the selected scene on screen (T), or step to the previous or next scene |
| Transition · Auto · Program ▾ · Hide all | How the next scene appears; auto-advance; Hide layer / Blackout / Emergency; hide everything (Esc) |
| ● Off air / On air | What is live now |
| **Team** | Team Space: co-leaders, shared notes, actions, Ask to Go Live |
| Status | KingdomConnect camera, overlays, phone remote, recording, slides, program |
| Presentation Mode | Only the scenes and Go Live (P) |

**Close (X)** asks whether to keep running in the background (the camera, overlays and Team Space keep working) or
quit.

## 2. Studio: scenes and layers
- A **scene** is what you put on screen. It is a stack of **layers**: a question, a verse, text, pictures, video,
  slides, your camera, your branding.
- Select a scene, check the preview, then press **Go Live**.
- **+ Scene** offers:
  - Quick Start sets;
  - the Content Library;
  - your templates;
  - **Import meeting from Excel…**, which builds the whole meeting from one file.
- Drag the dividers to resize the panels. The Layout menu folds them away.

## 3. The KingdomConnect camera
Choose **KingdomConnect** as the camera in Zoom, Teams, Google Meet or OBS. Participants see your webcam with your
live scene on top: cards, verses, lower thirds and branding. Background blur and Camera Looks are in **Settings →
KingdomConnect Camera**.

If an app doesn't list KingdomConnect, restart that app. Apps look for cameras when they start.

## 4. Team Space (co-leaders)
> **Team Space is available only when authorized peers are online through a secure WireGuard network. No cloud
> relay or third-party server is required.**

Once your team has set up WireGuard and Team Space (Configuration Guide, section 2), press **Team** in the command bar:
- **Co-leaders**: each one shows **Online** or **Offline**.
- **Shared notes**: type notes for the team. They sync while co-leaders are connected.
- **Actions**: add an item and tick it off. The list syncs while connected.
- **Ask to Go Live**: choose an online co-leader and one of their scenes, then press **Ask to Go Live**. Their PC
  asks them to **Approve & Go Live** or **Decline**. Nothing goes on air without their approval.

When a co-leader asks you, a dialog appears on your PC. **Approve & Go Live** puts their chosen scene on air at once.

Team Space works only while both PCs are online and connected through WireGuard. Nothing is stored on, or passed
through, any other server.

## 5. Your branding
**Settings → Meeting & Branding**: your Meeting Name, organisation, logo and accent colour. They appear only where you
put them:
- Branding layers;
- text cards that use `{meeting}` / `{org}`;
- **Show my logo on this card**.

Kingdom Connect's own branding is just the Book + Candle logo in the command bar.

## 6. Phone remote
**Settings → Phone & iPad Remote** → turn it on, then scan the QR code and enter the PIN. The remote has three modes:
- **Simple**: the live scene and two large Previous / Next buttons.
- **Standard**: Go Live, the scenes and transitions.
- **Advanced**: everything.

## 7. Help
- **Settings → Diagnostics → Copy diagnostics** collects the information needed for support. It contains no PIN,
  team key or member details.
- **Settings → About** has the story, contact and version.
