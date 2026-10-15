# Kingdom Connect: feature documentation (v6.4)

This document describes what each v6.4 feature does, how it is built and where its limits are:

- the KingdomConnect camera;
- Team Space, peer-to-peer over WireGuard;
- logo-only branding;
- native desktop behaviour.

For the earlier features, see `docs/meeting-import-and-branding.md` (v6.2), `ARCHITECTURE.md` and the release notes in
`docs/releases/`.

---

## 1. The KingdomConnect camera

Kingdom Connect has its own camera for Zoom, Microsoft Teams, Google Meet, OBS and other apps that read Windows
cameras. Windows lists it as **KingdomConnect**. It sends the finished picture: your webcam with optional background
blur and a Camera Look, plus the live scene (cards, text, pictures, slides, branding).

| | |
| --- | --- |
| Name in other apps | **KingdomConnect** |
| Registered by | The installer, with the option **Install the KingdomConnect camera for Zoom and Teams** (asks for administrator permission once) |
| Driver files | `kingdomconnect_vcam64.dll` and `kingdomconnect_vcam32.dll` in `_internal\vcam\bin`. They are built from softcam (MIT licence) by `packaging/build_vcam.py` |
| Camera ID (CLSID) | `{6F2B8C3E-4D7A-4B9E-9C11-B5CC0A1E7D21}`. This is the same ID as before, so apps that remembered the camera keep it |
| Settings | **Settings → KingdomConnect Camera** |
| Status | The status menu in the command bar: **KingdomConnect** · Off / Ready / In use |

### Upgrading from "BCC vCam"
Before 6.4 the same camera was called **BCC vCam**. Installing 6.4 does the following:
- It registers the camera again under its new name. This happens even if the option is not ticked, as long as the
  camera was already installed, because the driver file was renamed.
- Zoom, Teams, Meet and OBS show **KingdomConnect** after they are restarted. They read the camera list when they
  start.
- An OBS scene that used "BCC vCam" as a *Video Capture Device* may need that source pointed at KingdomConnect once.

The app also still recognises its old name, so it never captures its own picture during the upgrade.

### Limits
- Windows only (DirectShow). Apps that read only Media Foundation cameras without the Windows 11 DirectShow bridge
  may not list it. Zoom, Teams, Google Meet in Chrome or Edge, and OBS do list it.
- One app at a time can use the webcam behind it. Choose KingdomConnect in every meeting app, not the webcam itself.

---

## 2. Team Space: peer-to-peer over WireGuard

> **Team Space is available only when authorized peers are online through a secure WireGuard network. No cloud
> relay or third-party server is required.**

Team Space lets co-leaders on different PCs coordinate during a meeting:
- **Presence**: each co-leader shows **Online** or **Offline**.
- **Shared notes**: one notes area for the team.
- **Actions**: a shared checklist.
- **Ask to Go Live**: ask the meeting PC to put one of its scenes on air. The person at that PC approves it.

### Architecture
```
 Kingdom Connect PC (Anna)                       Kingdom Connect PC (Ben)
 ┌──────────────────────────┐   WireGuard tunnel  ┌──────────────────────────┐
 │ app server 127.0.0.1     │   (encrypted, UDP)  │ app server 127.0.0.1     │
 │ Team Space 10.8.0.2:8790 │◀───────────────────▶│ Team Space 10.8.0.3:8790 │
 └──────────────────────────┘   signed messages   └──────────────────────────┘
            No relay, no cloud service, no third-party server in between.
```
- **Transport:** each PC listens for Team Space on its own WireGuard address only, port 8790 by default. It never
  listens on Wi-Fi, the LAN or the internet. The dashboard and everything else stay on `127.0.0.1`.
- **Encryption:** WireGuard encrypts all traffic between the two PCs end to end (Curve25519, ChaCha20-Poly1305).
  WireGuard only accepts a packet from a peer's tunnel address if it was sent with that peer's key, so a source
  address on the tunnel can be trusted.
- **Authorization:** a message is accepted only when all of these hold:
  1. it arrives on the WireGuard address;
  2. it comes from an address in this PC's **co-leaders** list;
  3. it is signed with the shared **team key** (HMAC-SHA256);
  4. it names this PC as the recipient;
  5. it is less than 2 minutes old;
  6. its single-use nonce has not been seen before.

  Replies are signed and checked the same way. Anything else gets `403`.
- **Presence:** every 4 seconds each PC sends a signed `sync` to each co-leader over the tunnel. A co-leader that
  answered within the last 12 seconds is **Online**; otherwise they are **Offline**. Presence is never stored or
  reported anywhere else.
- **Sync:** the same exchange carries the shared notes and the action list. They are merged on both sides with last
  writer wins: for the notes as a whole, and for each action item separately. Edits made while nobody else is online
  stay on this PC and are exchanged the next time both PCs are connected. **Nothing is queued, forwarded or relayed.**
- **Ask to Go Live:**
  - It is sent only if the other PC is Online at that moment. Otherwise it is refused straight away.
  - The other PC shows a dialog: **Approve & Go Live** or **Decline**.
  - Approving puts the scene on air with the transition chosen in the command bar, and the asker sees *approved*.
  - A request lapses after 2 minutes, or as soon as either PC disconnects.
- **What travels:**
  - the display name;
  - the shared notes and actions;
  - the list of scene names and ids, so co-leaders can choose one to ask for;
  - which scene is live;
  - the app version.

  Member data, the phone-remote PIN, the team key and the ESV key never leave the PC.

### Files and endpoints
| Item | Where |
| --- | --- |
| Settings (enabled, your name, your WireGuard address, port, team key, co-leaders) | `kc-teamspace.json` in the data folder |
| Notes and actions | `kc-teamspace-doc.json` in the data folder |
| Peer protocol | `POST /team/v1` on `<WireGuard address>:8790`. Header `X-KC-Sig` = HMAC-SHA256 of the body |
| Dashboard API (this PC only) | `GET api/team`, `GET api/team/key`, `POST api/team/settings`, `POST api/team/notes`, `POST api/team/action`, `POST api/team/ask`, `POST api/team/answer` |
| Code | `teamspace.py` (protocol, presence, sync, WireGuard detection), `app/js/teamspace.js` (Team drawer, Settings → Team Space, approval dialog) |
| Test | `KC_TEAMSPACE_ALLOW_ANY_ADDRESS=1 python3 tools/test_teamspace.py`: two PCs on loopback addresses, 27 checks |

### WireGuard detection
Team Space starts only when the address you chose belongs to a connected WireGuard tunnel:
- **Windows:** a network adapter whose description contains "WireGuard" and whose status is Up.
- **Linux:** an interface of type `wireguard`.
- **macOS:** a `utun` interface.

It is checked every 15 seconds. Team Space starts listening when the tunnel comes up and stops when it goes down.

### Limits
- Both PCs must be online at the same time. There is no offline delivery, by design.
- The PCs' clocks must agree within 2 minutes (Windows sets its clock automatically by default).
- At most 16 co-leaders; notes up to 20,000 characters; up to 200 actions.
- Setting up WireGuard itself (keys, the tunnel, any port forwarding for the WireGuard UDP port) is done in the
  WireGuard app. See the Configuration Guide.

---

## 3. Logo-only branding

The app's own branding is the **Book + Candle** mark (`app/img/kc-emblem.webp`) and nothing else:
- **Command bar (dashboard header):** the mark alone, 30 px wide. There is no "Kingdom Connect" wordmark or text
  beside it. The name and the Meeting Name are kept for screen readers, in the mark's tooltip and in the window
  title.
- **Phone remote:** the sign-in screen shows the mark alone, and the remote's top bar shows the mark and the mode
  (Simple / Standard / Advanced).
- **Home-screen icons** (`app/icons/remote-*.png`): the mark on a navy tile, with no text. The Windows app icon
  (`packaging/bsf.ico`) was already the mark alone.
- **Dialogs and overlays** show no product branding. The leader's own logo and Meeting Name (Settings → Meeting &
  Branding) still appear only where the leader puts them.
- **About page:** unchanged. It keeps its own branding and content.

The wordmark styles are no longer used in the header. `.sr-only` keeps the text available to assistive technology.

---

## 4. Native desktop behaviour

The installed app is a desktop application, not a web page in a browser:
- **Its own window (WebView2):** no address bar, tabs, browser toolbar or browser buttons.
- **Title bar:** the Windows title bar keeps **Minimize**, **Maximize/Restore** and **Close** (with Snap Layouts),
  drawn by Windows. It follows the app's theme:
  - dark or light caption on Windows 10 and 11;
  - on Windows 11, the exact colour of the command bar, so the window reads as one surface like Teams or Slack.

  The page tells the app when the theme changes (`POST api/app/window`).
- **No browser behaviour inside the window:**
  - Reload (F5, Ctrl+R), Print (Ctrl+P), Save (Ctrl+S), View source (Ctrl+U), zoom (Ctrl + + / − / 0 / wheel),
    history (Alt+← / →) and developer tools keys do nothing;
  - the browser right-click menu appears only in text boxes;
  - a file dropped outside a drop zone does not replace the page.
- **Without WebView2:** the app opens as an Edge (or Chrome) **app window** (`--app` mode, separate profile in
  `appwindow` in the data folder). It also has no address bar, tabs or browser buttons, and the same guards apply.
  Only if neither browser exists does it fall back to a normal browser tab.
- **Close (X):** asks whether to keep running in the background (so the camera, overlays and Team Space keep
  working) or quit. This is unchanged.
- A browser tab opened by hand at `http://localhost:8750` behaves like a normal web page.

A fully custom-drawn title bar was not needed. Windows' own caption, coloured to match, keeps Snap Layouts,
accessibility and the expected window behaviour.
