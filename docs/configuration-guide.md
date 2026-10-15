# Kingdom Connect: configuration guide (v6.4)

This guide covers what to set up after installing:
- the KingdomConnect camera;
- Team Space over WireGuard;
- the app window;
- where settings are stored.

For installing, see `BUILD-AND-INSTALL.md`. For what each feature does, see `docs/features.md`.

---

## 1. KingdomConnect camera

1. Install with **Install the KingdomConnect camera for Zoom and Teams** ticked, and allow the administrator prompt.
   - Already installed without it? Use **Settings → KingdomConnect Camera → Install KingdomConnect**.
2. Restart Zoom, Teams, OBS or the browser you use for Google Meet. They read the camera list when they start.
3. Choose **KingdomConnect** as the camera in each app:
   - **Zoom:** Settings → Video → Camera → KingdomConnect. Tick **HD**, and turn off Zoom's own background blur.
   - **Microsoft Teams:** Settings → Devices (or Video and effects) → Camera → KingdomConnect.
   - **Google Meet:** ⋮ → Settings → Video → Camera → KingdomConnect.
   - **OBS:** Sources → + → Video Capture Device → Device: KingdomConnect.
4. **Settings → KingdomConnect Camera** sets:
   - which webcam is behind it;
   - the resolution (720p or 1080p);
   - background blur;
   - the Camera Look;
   - whether your cards appear on the camera.

**Upgrading from a version before 6.4:** the camera was called *BCC vCam*. The installer renames it and keeps the
same device ID. In OBS, point any old "BCC vCam" source at KingdomConnect once.

---

## 2. Team Space over WireGuard

> **Team Space is available only when authorized peers are online through a secure WireGuard network. No cloud
> relay or third-party server is required.**

### 2.1 Set up the WireGuard network (once, for the whole team)
Team Space needs every co-leader's PC on one WireGuard network. One person (for example the meeting host) sets it up:

1. Install **WireGuard for Windows** from <https://www.wireguard.com/install/> on every PC.
2. Choose a private address range for the team, for example `10.8.0.0/24`. Give each PC its own address:

   | PC | WireGuard address |
   | --- | --- |
   | Meeting PC (Anna) | `10.8.0.2` |
   | Co-leader (Ben) | `10.8.0.3` |
   | Co-leader (Grace) | `10.8.0.4` |

3. On each PC, in WireGuard: **Add Tunnel → Add empty tunnel…**. WireGuard creates that PC's key pair. Give the
   **public key** to the person setting up the network.
4. Write each PC's tunnel. Here is an example for Anna's PC, which reaches Ben and Grace directly:
   ```ini
   [Interface]
   PrivateKey = <Anna's private key, created by WireGuard>
   Address = 10.8.0.2/24
   ListenPort = 51820

   [Peer]
   # Ben
   PublicKey = <Ben's public key>
   AllowedIPs = 10.8.0.3/32
   Endpoint = <Ben's public address or DNS name>:51820
   PersistentKeepalive = 25

   [Peer]
   # Grace
   PublicKey = <Grace's public key>
   AllowedIPs = 10.8.0.4/32
   Endpoint = <Grace's public address or DNS name>:51820
   PersistentKeepalive = 25
   ```
   - Each `AllowedIPs` lists only that peer's own `/32` address. This is what makes the tunnel address trustworthy.
   - At least one side of each pair needs a reachable `Endpoint`. Home routers usually need **UDP 51820 forwarded**
     to that PC. A PC behind a router it can't change can still connect out to a peer that has a reachable endpoint.
   - Team Space adds no relay. If two PCs can't reach each other through WireGuard, Team Space shows them as
     Offline.
5. Press **Activate** on each PC. In WireGuard, *Latest handshake* should show a few seconds ago for each peer.
6. Optional check: `ping 10.8.0.3` from Anna's PC.

### 2.2 Turn on Team Space in Kingdom Connect
Open **Settings → Team Space** on every PC.

1. Tick **Turn on Team Space on this PC**.
2. **Your name, as co-leaders see it**: for example *Anna (meeting PC)*.
3. **This PC's WireGuard address**: choose the tunnel address. The list shows connected WireGuard tunnels only.
4. **Team Space port**: leave it at **8790**, the same on every PC.
5. **Team key**:
   - On the first PC, press **Create the key**, then **Copy key**.
   - Give the key to each co-leader privately: in person, or over a private channel. Never post it in a group chat.
   - On every other PC, paste it into **Paste the team key from the first PC**.
   - The **Key fingerprint** must be identical on every PC.
6. **Co-leaders (authorized peers)**: **+ Add co-leader** for each other PC, with its name and WireGuard address.
   Leave *port* empty unless that PC uses a different port.
7. Press **Save Team Space**. The status line shows **On · listening on 10.8.0.2:8790 (WireGuard)**.
8. If Windows Firewall asks about network access for Kingdom Connect, allow it. To restrict it further, allow
   TCP 8790 only on the WireGuard adapter.

### 2.3 Use it
- **Team** in the command bar opens the Team drawer.
  - A green dot means at least one co-leader is Online.
  - A red number means someone is asking to go live.
- **Co-leaders**: Online or Offline, from the last few seconds of the direct connection.
- **Shared notes** and **Actions** sync while co-leaders are connected. Changes made alone stay on this PC until
  the next connection.
- **Ask to Go Live**: choose an online co-leader and one of their scenes, then press **Ask to Go Live**. Their PC
  shows **Approve & Go Live / Decline**. You see *approved*, *declined* or *lapsed*.

### 2.4 Troubleshooting
| What you see | Why, and what to do |
| --- | --- |
| *No connected WireGuard tunnel was found* | WireGuard isn't installed, or the tunnel isn't activated. Activate it and reopen Settings → Team Space |
| *On · waiting: WireGuard is not connected* | The tunnel went down. Team Space starts again within 15 seconds of it coming back |
| A co-leader stays **Offline** | Check the WireGuard handshake. Check that both PCs have Team Space on and the same port, that each lists the other's correct address, and that the key fingerprints match |
| *clock difference too large* (shown in the co-leader's tooltip) | Set both PCs' clocks automatically (Windows Settings → Time & language → Set time automatically) |
| *bad signature* | The team keys differ. Paste the same key on both PCs |
| Ask to Go Live says the co-leader is offline | Requests are only sent while both PCs are connected; nothing is queued |

---

## 3. App window

- The installed app opens in its own window, with Windows' **Minimize**, **Maximize/Restore** and **Close**. The
  title bar follows **Settings → General → Appearance** (dark, light or match Windows).
- **Close (X)** asks whether to keep running in the background (camera, overlays, phone remote and Team Space keep
  working) or quit. The icon near the clock opens it again.
- If **Microsoft Edge WebView2 Runtime** is missing, the app opens as an Edge app window instead (no address bar or
  tabs). Install WebView2 from microsoft.com for the full app window.
- **Settings → General → Light on graphics card** (on by default) draws the window without the GPU, which keeps Zoom
  and Windows smooth.

---

## 4. Where settings are stored

Everything is in the data folder, `%APPDATA%\BSF Command Center`. The folder keeps its original name so upgrades
keep your data.

| File | Contents |
| --- | --- |
| `bsf-saved-content.json` | Scenes, layers, questions, verses, branding, live state |
| `bsf-members-private.json` | Members and member settings (never sent to the remote, overlays or Team Space) |
| `bsf-app-settings.json` | App options: remote autostart, Light on graphics card, native Presentation window |
| `kc-teamspace.json` | Team Space: on/off, your name, WireGuard address, port, **team key**, co-leaders |
| `kc-teamspace-doc.json` | Team Space shared notes and actions |
| `bsf-remote-pin.txt`, `bsf-remote-sessions.json` | Phone remote PIN and signed-in phones |
| `bcc-brand-logo.png` | Your uploaded logo (internal file name kept for compatibility) |
| `webview\`, `appwindow\` | The app window's browser storage |
| `backups\` | Daily and manual backups |

Treat `kc-teamspace.json` like a password file: it holds the team key.

### Environment variables (developers and tests)
| Variable | Effect |
| --- | --- |
| `BSF_DATA_DIR` | Use another data folder |
| `KC_TEAMSPACE_ALLOW_ANY_ADDRESS=1` | **Tests only:** let Team Space listen on an address that is not a WireGuard tunnel (used by `tools/test_teamspace.py` on loopback addresses). Never set this on a real PC |
