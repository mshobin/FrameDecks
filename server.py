#!/usr/bin/env python3
"""
FrameDecks - local program.

Serves the dashboard and overlays at http://localhost:8750 on THIS computer only.
No internet, cloud account, or extra installs are needed beyond Python 3
(standard library only). Your content is saved in "kc-saved-content.json".

Windows: double-click "Start FrameDecks.bat"
         or "Start FrameDecks with iPad Remote.bat" (adds the phone remote)
Mac:     double-click "Start FrameDecks (Mac).command"
         (for the phone remote: python3 server.py --remote)
"""
import hashlib
import json
import os
import platform
import re
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

import legacy   # 6.9: moves data saved under the program's earlier name
import meeting_form   # 6.9: fills the Meeting Workbook's form for Export
import cloud_link     # SaaS Phase 2: this computer's FrameDecks account (optional; signed out = no network)
import relay_link     # SaaS Phase 3: the remote from anywhere, through the cloud relay (off unless switched on)

APP_VERSION = "6.9"
STARTED_AT = time.time()
FROZEN = getattr(sys, "frozen", False)          # True inside the installed Windows app
HERE = Path(sys.executable).resolve().parent if FROZEN else Path(__file__).resolve().parent
RES = Path(getattr(sys, "_MEIPASS", HERE))       # where the app's pages are bundled
APP = RES / "app"


def _data_dir():
    """Installed app: %APPDATA%\\FrameDecks. Script/zip version: next to server.py (as before).
    6.9: data saved under the program's earlier name is moved here first (legacy.py), so nothing is lost."""
    if os.environ.get("KC_DATA_DIR"):
        folder = Path(os.environ["KC_DATA_DIR"])
    elif FROZEN:
        folder = legacy.migrate_app_data(Path(os.environ.get("APPDATA") or Path.home()))
    else:
        folder = HERE
    if folder.is_dir():
        legacy.migrate_files(folder)
    return folder


DATA = _data_dir()
DATA.mkdir(parents=True, exist_ok=True)
SEPARATE_DATA = DATA.resolve() != HERE.resolve()
STATE_FILE = DATA / "kc-saved-content.json"
PRIVATE_FILE = DATA / "kc-members-private.json"  # member list + settings; never sent to overlays
APP_SETTINGS_FILE = DATA / "kc-app-settings.json"
BACKUP_DIR = DATA / "backups"
PREFERRED_PORT = 8750
PORTS = [PREFERRED_PORT] + list(range(8751, 8761))
MAX_BODY = 8 * 1024 * 1024

# ---------- phone remote (off unless started with --remote) ----------
REMOTE = "--remote" in sys.argv
PIN_FILE = DATA / "kc-remote-pin.txt"
SESSIONS_FILE = DATA / "kc-remote-sessions.json"
SESSION_DAYS = 30
COOKIE = "kc_remote"
# What a signed-in phone or iPad may open. Member data and the dashboard are never on this list.
REMOTE_PUBLIC = {"/remote.html", "/css/remote.css", "/js/remote.js", "/js/store.js", "/js/brand.js", "/api/remote-login",
                 "/js/cloud-config.js", "/js/cloud-remote.js",
                 "/js/teleprompter.js", "/css/teleprompter.css",
                 "/remote-manifest.json", "/icons/remote-180.png", "/icons/remote-192.png", "/icons/remote-512.png",
                 "/icons/remote-maskable-512.png", "/img/kc-emblem.webp"}
REMOTE_SIGNED_IN = {"/api/rev", "/api/state", "/api/remote-logout", "/js/overlay.js", "/api/remote/studio", "/api/brand/logo", "/api/remote/live.jpg",
                    "/css/overlay.css", "/stage.html", "/focus-verse.html", "/discussion-question.html", "/birthday.html"}
sessions_lock = threading.Lock()
failures = {}  # ip -> [count, locked_until]
seen_devices = set()
devices = {}  # ip -> {"first": t, "last": t, "signedIn": bool}  (IP addresses only, kept in memory)


def remote_pin():
    try:
        pin = PIN_FILE.read_text(encoding="utf-8").strip()
        if re.fullmatch(r"\d{6}", pin):
            return pin
    except OSError:
        pass
    pin = f"{secrets.randbelow(1000000):06d}"
    PIN_FILE.write_text(pin + "\n", encoding="utf-8")
    return pin


def load_sessions():
    try:
        data = json.loads(SESSIONS_FILE.read_text(encoding="utf-8"))
        now = time.time()
        return {k: v for k, v in data.items() if isinstance(v, (int, float)) and v > now}
    except (OSError, ValueError):
        return {}


def save_sessions():
    try:
        SESSIONS_FILE.write_text(json.dumps(sessions), encoding="utf-8")
    except OSError:
        pass


sessions = load_sessions()


_lan_cache = {"at": 0.0, "value": []}


def lan_addresses(max_age=10.0):
    """This PC's network addresses (cached 10 s: the host-name lookup can be slow on some networks)."""
    if time.monotonic() - _lan_cache["at"] < max_age:
        return list(_lan_cache["value"])
    out = _lan_addresses()
    _lan_cache.update(at=time.monotonic(), value=out)
    return list(out)


def _lan_addresses():
    ips = []
    try:  # finds the Wi-Fi/Ethernet address; nothing is actually sent
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        ips += socket.gethostbyname_ex(socket.gethostname())[2]
    except OSError:
        pass
    out = []
    for ip in ips:
        if not ip.startswith("127.") and not ip.startswith("169.254.") and ip not in out:
            out.append(ip)
    return out

cond = threading.Condition()
presence = {}  # id -> (page, last_seen)


def load_state():
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data["rev"] = int(data.get("rev", 1) or 1)
            return data
    except (OSError, ValueError):
        pass
    return {"rev": 0}  # the pages fill in defaults and sample content


state = load_state()
# Revision at which the question/verse library last changed. Screens that already have that library can leave it
# out of what they send and receive (a big imported library made every Show/Next tap from the phone slow).
LIBRARY = {"rev": int(state.get("rev", 0) or 0)}


def state_body(lib_rev=None):
    """The state as JSON; without the library when the asker already has this library (lib_rev matches)."""
    if lib_rev is not None and str(lib_rev) == str(LIBRARY["rev"]):
        out = {k: v for k, v in state.items() if k != "library"}
        out.update(libraryRev=LIBRARY["rev"], libraryOmitted=True)
        return json.dumps(out)
    return json.dumps(dict(state, libraryRev=LIBRARY["rev"]))


def save_state(new):
    global state
    with cond:
        new.pop("libraryRev", None)
        new.pop("libraryOmitted", None)
        new["rev"] = int(state.get("rev", 0)) + 1
        if new.get("library") != state.get("library"):
            LIBRARY["rev"] = new["rev"]
        state = new
        tmp = STATE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, STATE_FILE)
        cond.notify_all()
        eng = VCAM.get("engine") if "VCAM" in globals() else None
        if eng:
            eng.kick()                     # a card was shown/hidden: draw it now, even in the idle rhythm
        if "VCAM" in globals():
            apply_live_media(state)
        return state


# ---------- v6 Scenes: the live scene's media layers are the FrameCast picture ----------
MEDIA_KINDS = ("camera", "screen", "window", "image", "video", "pdf", "background", "text", "rect", "ellipse")


def scene_media(st):
    """The compositor layers (bottom first) of the live scene, or None when no scene is live."""
    live = st.get("live") if isinstance(st.get("live"), dict) else {}
    sid = live.get("scene")
    if not sid:
        return None
    sc = next((x for x in st.get("scenes") or [] if isinstance(x, dict) and x.get("id") == sid), None)
    if sc is None:
        return None
    deck = live_deck(sc, live)
    out = []
    for l in reversed([l for l in sc.get("layers") or [] if isinstance(l, dict)]):
        if l.get("kind") not in MEDIA_KINDS or layer_deck(sc, l) != deck:
            continue                                   # FrameDecks: only the Deck on screen
        c = dict(l.get("c") or {})
        c.pop("vcam", None)
        c.pop("obs", None)
        if l["kind"] in ("image", "video", "pdf") and not c.get("file"):
            continue                                   # not chosen yet: nothing to draw
        if l["kind"] == "window" and c.get("hwnd") is None:
            continue
        c.update(id=str(l.get("id") or ""), name=l.get("name") or l["kind"], type=l["kind"],
                 visible=l.get("visible", True) is not False, locked=bool(l.get("locked")), opacity=l.get("opacity", 1))
        out.append(c)
    return out


def deck_ids(sc):
    """FrameDecks: the ids of a Frame's Decks, in order (an older Frame has one, "d1"; same rule as store.js)."""
    ids = [str(d.get("id")) for d in sc.get("decks") or [] if isinstance(d, dict) and d.get("id")]
    return ids or ["d1"]


def layer_deck(sc, l):
    """The Deck a Content belongs to (no Deck, or an unknown one: the first)."""
    ids = deck_ids(sc)
    return l.get("deck") if l.get("deck") in ids else ids[0]


def live_deck(sc, live):
    """The Deck of the live Frame that is on screen (live.deck, else the first)."""
    ids = deck_ids(sc)
    return live.get("deck") if live.get("deck") in ids else ids[0]


def media_sig(layers):
    from vcam.layers import clean_layer
    return json.dumps([clean_layer(l) for l in layers if l.get("id")], sort_keys=True)


def apply_live_media(st):
    """Called after every save: when the live scene (or its media layers) changed, the camera picture follows.
    Studio edits on the PC write the same layers back, so nothing is applied twice."""
    comp = VCAM.get("compositor")
    if not comp:
        return
    media = scene_media(st)
    if media is None:
        return
    try:
        sig = media_sig(media)
    except Exception:
        return
    if sig == VCAM.get("mediaSig"):
        return
    VCAM["mediaSig"] = sig
    try:
        comp.layers.set_layers(media)
        studio_save()
    except Exception as e:                              # never let a scene stop the camera
        print("FrameCast: could not apply the scene:", e)


# ---------- SaaS Phase 2: the FrameDecks account (docs/architecture/cloud-api.md), this PC only ----------
CLOUD = {"link": None}


def cloud():
    if CLOUD["link"] is None:
        CLOUD["link"] = cloud_link.CloudLink(DATA, APP_VERSION)
    return CLOUD["link"]


# ---------- SaaS Phase 3: the remote from anywhere (docs/architecture/relay-protocol.md) ----------
RELAY = {"link": None, "server": None}


def relay_enabled():
    return bool(cloud().settings().get("relay"))


def relay_start():
    """The relay listener (this PC only; every request on it is a phone, never this PC) and the outgoing link."""
    if RELAY["link"] is not None:
        return RELAY["link"]
    server = ThreadingHTTPServer(("127.0.0.1", 0), RelayHandler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, name="relay-listener", daemon=True).start()
    RELAY["server"] = server
    RELAY["link"] = relay_link.RelayLink(cloud(), lambda: server.server_address[1], relay_enabled)
    return RELAY["link"]


def relay_status():
    return RELAY["link"].status() if RELAY["link"] else {"state": "off", "error": "", "since": 0}


def cloud_get(path, query):
    """GET api/cloud/<path> -> (status, body)."""
    c = cloud()
    if path == "status":
        return 200, dict(c.status(), relayLink=relay_status())
    if path == "providers":
        return 200, c.providers()
    if path == "me":
        return 200, c.me()
    if path == "sync":
        return 200, c.sync_get(int((query.get("since") or ["0"])[0] or 0), int((query.get("limit") or ["500"])[0] or 500))
    if path == "sync-state":
        return 200, c.sync_state()
    if path == "members-key":
        return 200, c.members_key()
    if path == "export":
        return 200, c.export()
    return 404, {"error": {"code": "not_found", "message": "Not found"}}


def cloud_post(path, data):
    """POST api/cloud/<path> -> (status, body)."""
    c, d = cloud(), (data if isinstance(data, dict) else {})
    if path == "settings":
        out = c.set_settings(d)
        if "relay" in d:
            relay_start().poke()
        return 200, out
    if path == "email-start":
        return 200, c.email_start(d.get("email"))
    if path == "email-verify":
        return 200, c.email_verify(d.get("email"), d.get("code"))
    if path == "browser-start":
        return 200, c.browser_start()
    if path == "browser-cancel":
        c.cancel_browser()
        return 200, c.status()
    if path == "logout":
        out = c.logout()
        if RELAY["link"]:
            RELAY["link"].poke()
        return 200, out
    if path == "sync":
        return 200, c.sync_post(d.get("changes") or [])
    if path == "members-key":
        return 200, c.set_members_key(d.get("key"))
    if path == "delete-account":
        return 200, c.delete_account()
    if path == "sync-state":
        return 200, c.save_sync_state(d)
    return 404, {"error": {"code": "not_found", "message": "Not found"}}


def update_state(change):
    """Change the live state from inside the program (e.g. the tray's Hide all). Every screen picks it up."""
    with cond:
        new = change(json.loads(json.dumps(state)))
    return save_state(new)


# ---------- Read-only checks used by Settings > Phone & iPad Remote and Diagnostics ----------
_net_cache = {"at": 0, "value": None}


_net_lock = threading.Lock()


def windows_network_check(max_age=900):
    """On Windows, report the network type (Private/Public) and whether the optional firewall
    rule exists. Read-only: nothing is changed. Runs in the background (PowerShell) and is cached: 15 minutes
    normally (the header light asks every 3 s during a meeting - starting PowerShell every minute was wasted
    work), 60 s while Settings > Phone & iPad Remote is open. Returns None on other systems or while first checking."""
    if os.name != "nt":
        return None
    if time.time() - _net_cache["at"] > max_age and _net_lock.acquire(blocking=False):
        def work():
            try:
                _refresh_network_check()
            finally:
                _net_lock.release()
        threading.Thread(target=work, daemon=True).start()
    return _net_cache["value"]


def _refresh_network_check():
    out = {"profiles": [], "ruleExists": None}
    flags = 0x08000000  # CREATE_NO_WINDOW
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-Command",
                            "Get-NetConnectionProfile | Select-Object Name,InterfaceAlias,NetworkCategory | ConvertTo-Json -Compress"],
                           capture_output=True, text=True, timeout=8, creationflags=flags)
        data = json.loads(r.stdout or "null")
        if isinstance(data, dict):
            data = [data]
        cats = {0: "Public", 1: "Private", 2: "DomainAuthenticated"}
        for p in data or []:
            cat = p.get("NetworkCategory")
            out["profiles"].append({"name": p.get("Name"), "adapter": p.get("InterfaceAlias"),
                                    "category": cats.get(cat, cat) if isinstance(cat, int) else cat})
    except Exception:
        pass
    try:
        r = subprocess.run(["netsh", "advfirewall", "firewall", "show", "rule", f"name={FIREWALL_RULE}"],
                           capture_output=True, text=True, timeout=8, creationflags=flags)
        out["ruleExists"] = r.returncode == 0
        if out["ruleExists"] and FROZEN:
            v = subprocess.run(["netsh", "advfirewall", "firewall", "show", "rule", f"name={FIREWALL_RULE}", "verbose"],
                               capture_output=True, text=True, timeout=8, creationflags=flags)
            # FrameDecks: a permission given to the program under its earlier file name no longer lets this one in
            out["ruleOutdated"] = sys.executable.lower() not in (v.stdout or "").lower()
    except Exception:
        pass
    _net_cache.update({"at": time.time(), "value": out})


# ---------- Resource monitor (Settings > Diagnostics) ----------
REQ = {"counts": {}, "since": time.time()}


def count_request(path):
    """Count requests by kind, so Diagnostics can show which screens are busy."""
    kind = path if path in ("/api/rev", "/api/state", "/api/presence", "/api/vcam/preview.jpg", "/api/vcam/stage.jpg",
                            "/api/vcam/status", "/api/vcam/studio", "/api/present.mjpg", "/api/remote/live.jpg") else ("page" if not path.startswith("/api/") else "other api")
    REQ["counts"][kind] = REQ["counts"].get(kind, 0) + 1


def process_memory_mb():
    try:
        if os.name == "nt":
            import ctypes
            from ctypes import wintypes

            class PMC(ctypes.Structure):
                _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD), ("PeakWorkingSetSize", ctypes.c_size_t),
                            ("WorkingSetSize", ctypes.c_size_t), ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                            ("QuotaPagedPoolUsage", ctypes.c_size_t), ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                            ("QuotaNonPagedPoolUsage", ctypes.c_size_t), ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t)]
            pmc = PMC(); pmc.cb = ctypes.sizeof(PMC)
            ctypes.windll.psapi.GetProcessMemoryInfo(ctypes.windll.kernel32.GetCurrentProcess(), ctypes.byref(pmc), pmc.cb)
            return round(pmc.WorkingSetSize / 1048576, 1)
        with open("/proc/self/statm") as f:
            return round(int(f.read().split()[1]) * os.sysconf("SC_PAGE_SIZE") / 1048576, 1)
    except Exception:
        return None


def resources():
    mins = max(1 / 60, (time.time() - REQ["since"]) / 60)
    rates = {k: round(v / mins, 1) for k, v in sorted(REQ["counts"].items(), key=lambda kv: -kv[1])}
    REQ.update(counts={}, since=time.time())                  # each look covers the time since the last one
    eng, comp = VCAM.get("engine"), VCAM.get("compositor")
    st = dict(eng.status) if eng else {}
    return {"memoryMB": process_memory_mb(), "threads": threading.active_count(), "requestsPerMinute": rates,
            "presentationWindows": comp.present["clients"] if comp else 0,
            "camera": {k: st.get(k) for k in ("state", "fps", "captureFps", "msPerFrame", "lookMs", "blurMs", "latencyMs", "dropped", "cpuPercent")} if eng else None,
            "composeMs": round(comp.ms, 2) if comp else None, "layers": len(comp.layers.layers) if comp else 0,
            "layerCacheEntries": len(comp.layers.cache) if comp else 0}


def diagnostics(address):
    files = {}
    for f in (STATE_FILE, PRIVATE_FILE, PIN_FILE, SESSIONS_FILE):
        try:
            files[f.name] = {"exists": f.exists(), "bytes": f.stat().st_size if f.exists() else 0}
        except OSError:
            files[f.name] = {"exists": False}
    with sessions_lock:
        n_sessions = len([1 for v in sessions.values() if v > time.time()])
    return {
        "resources": resources(),
        "version": APP_VERSION, "python": platform.python_version(), "os": platform.platform(),
        "folder": str(HERE), "dataFolder": str(DATA), "installedApp": FROZEN, "port": address[1], "listeningOn": address[0],
        "remoteMode": REMOTE, "addresses": lan_addresses(), "uptimeSeconds": int(time.time() - STARTED_AT),
        "stateRevision": state.get("rev", 0), "files": files, "remoteSessions": n_sessions,
        "devices": [{"ip": ip, "lastSeen": d["last"], "signedIn": d["signedIn"]} for ip, d in devices.items()],
        "network": windows_network_check() if REMOTE else None, "now": time.time(),
        "vcam": {"available": VCAM["engine"] is not None, "reason": VCAM["reason"], "detail": VCAM["detail"],
                 "cameras": VCAM["cameras"] or [], "blockers": _vcam_blockers(),
                 "status": dict(VCAM["engine"].status) if VCAM["engine"] else None}
    }


private_lock = threading.Lock()


def load_private():
    try:
        data = json.loads(PRIVATE_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except (OSError, ValueError):
        pass
    return {}


def save_private(data):
    with private_lock:
        tmp = PRIVATE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, PRIVATE_FILE)


# ---------- Phone remote on/off while running ----------
# The main server only ever listens on this PC (127.0.0.1). Turning the remote on adds a listener
# on each Wi-Fi/Ethernet address; turning it off removes them, so nothing on the network can connect.
MAIN = {"server": None, "port": PREFERRED_PORT}
remote_servers = {}  # ip -> server
remote_lock = threading.Lock()
remote_errors = []


def _stop(srv):
    def go():
        try:
            srv.shutdown()
            srv.server_close()
        except OSError:
            pass
    threading.Thread(target=go, daemon=True).start()


def set_remote(enabled):
    global REMOTE
    with remote_lock:
        if not enabled:
            REMOTE = False
            for srv in remote_servers.values():
                _stop(srv)
            remote_servers.clear()
            remote_errors.clear()
        else:
            REMOTE = True
            want = lan_addresses()
            for ip in [i for i in remote_servers if i not in want]:   # the network changed
                _stop(remote_servers.pop(ip))
            for ip in want:
                if ip in remote_servers:
                    continue
                try:
                    srv = ThreadingHTTPServer((ip, MAIN["port"]), Handler)
                    srv.daemon_threads = True
                    threading.Thread(target=srv.serve_forever, daemon=True).start()
                    remote_servers[ip] = srv
                    if ip in remote_errors:
                        remote_errors.remove(ip)
                except OSError:
                    if ip not in remote_errors:
                        remote_errors.append(ip)
        _net_cache["at"] = 0
        hook = DESKTOP.get("on_remote_change")
    if hook:
        try:
            hook(REMOTE)
        except Exception:
            pass
    return {"enabled": REMOTE, "listening": sorted(remote_servers), "failed": list(remote_errors)}


def _remote_watcher():
    while True:
        time.sleep(15)
        if REMOTE and set(lan_addresses()) != set(remote_servers):
            set_remote(True)


# ---------- Installed-app settings, backups and importing old data ----------
DESKTOP = {"active": False}  # filled in by desktop_app.py (show/hide/quit/choose_folder hooks)
APP_SETTINGS_DEFAULTS = {"remoteAutostart": False, "importDecided": False,
                         "lowGpu": True,     # draw the app window without the graphics card (keeps Windows smooth)
                         "nativePresent": True,   # Presentation window without a browser engine (off = WebView2 window)
                         # 6.8 window chrome, tray and the Teleprompter overlay
                         "customChrome": True,    # the app's ribbon instead of the Windows title bar (restart to change)
                         "minimizeTo": "ask",     # minimize button: ask / tray / taskbar
                         "spotlightKey": "Alt+Space",   # system-wide shortcut for Spotlight ('' = off)
                         "overlayMode": "meeting",      # Teleprompter overlay: solid/presenter/meeting/conference/ghost
                         "overlayFrost": True,    # Windows blur behind the overlay
                         "overlayOnTop": True,    # the overlay stays above Zoom, Teams, PowerPoint and browsers
                         "overlayFade": False}    # compatibility transparency (the whole window fades, text included)
APP_SETTING_CHOICES = {"minimizeTo": ("ask", "tray", "taskbar"),
                       "overlayMode": ("solid", "presenter", "meeting", "conference", "ghost")}


def _valid_setting(k, v):
    d = APP_SETTINGS_DEFAULTS[k]
    if isinstance(d, bool):
        return isinstance(v, bool)
    if k in APP_SETTING_CHOICES:
        return v in APP_SETTING_CHOICES[k]
    if k == "spotlightKey":
        from desktop_win import parse_hotkey
        return isinstance(v, str) and (v == "" or parse_hotkey(v) is not None)
    return False


def app_settings():
    out = dict(APP_SETTINGS_DEFAULTS)
    try:
        data = json.loads(APP_SETTINGS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            for k in out:
                if k in data and _valid_setting(k, data[k]):
                    out[k] = data[k]
    except (OSError, ValueError):
        pass
    return out


def save_app_settings(changes):
    cur = app_settings()
    for k, v in changes.items():
        if k in APP_SETTINGS_DEFAULTS and _valid_setting(k, v):
            cur[k] = v
    if "spotlightKey" in changes:
        from desktop_win import format_hotkey
        cur["spotlightKey"] = format_hotkey(cur["spotlightKey"]) if cur["spotlightKey"] else ""
    APP_SETTINGS_FILE.write_text(json.dumps(cur, indent=2), encoding="utf-8")
    hook = DESKTOP.get("settings_changed")
    if hook:
        try:
            hook(cur)
        except Exception as e:
            print("Applying settings:", e)
    return cur


KEEP_BACKUPS = 10
backup_lock = threading.Lock()


def list_backups():
    try:
        dirs = [d for d in BACKUP_DIR.iterdir() if d.is_dir()]
    except OSError:
        return []
    dirs.sort(key=lambda d: d.stat().st_mtime, reverse=True)
    return [{"name": d.name, "files": sorted(f.name for f in d.iterdir())} for d in dirs]


def backup_now(tag=""):
    """Copy the verses/questions file and the member file into backups/<date>. Keeps the newest 10."""
    with backup_lock:
        files = [f for f in (STATE_FILE, PRIVATE_FILE) if f.exists()]
        if not files:
            return None
        name = time.strftime("%Y-%m-%d") + (("-" + tag) if tag else "")
        folder = BACKUP_DIR / name
        n = 2
        while folder.exists() and tag:
            folder = BACKUP_DIR / f"{name}-{n}"
            n += 1
        folder.mkdir(parents=True, exist_ok=True)
        for f in files:
            shutil.copy2(f, folder / f.name)
        dirs = sorted((d for d in BACKUP_DIR.iterdir() if d.is_dir()), key=lambda d: d.stat().st_mtime, reverse=True)
        for old in dirs[KEEP_BACKUPS:]:
            shutil.rmtree(old, ignore_errors=True)
        return folder.name


def daily_backup():
    today = time.strftime("%Y-%m-%d")
    if not any(b["name"].startswith(today) for b in list_backups()):
        backup_now()


def _backup_loop():
    while True:
        try:
            daily_backup()
        except OSError:
            pass
        time.sleep(3600)


DATA_FILE_NAMES = ["kc-saved-content.json", "kc-members-private.json", "kc-remote-pin.txt", "kc-remote-sessions.json"]


def looks_like_data(folder):
    return bool(legacy.find(folder, DATA_FILE_NAMES[0]) or legacy.find(folder, DATA_FILE_NAMES[1]))


def _describe(folder):
    info = {"folder": str(folder), "modified": 0, "members": None, "questions": None}
    for name in DATA_FILE_NAMES[:2]:
        f = legacy.find(folder, name)
        if f:
            info["modified"] = max(info["modified"], f.stat().st_mtime)
    try:
        info["members"] = len(json.loads(legacy.find(folder, DATA_FILE_NAMES[1]).read_text(encoding="utf-8")).get("members") or [])
    except (OSError, ValueError, AttributeError):
        pass
    try:
        info["questions"] = len((json.loads(legacy.find(folder, DATA_FILE_NAMES[0]).read_text(encoding="utf-8")).get("library") or {}).get("questions") or [])
    except (OSError, ValueError, AttributeError):
        pass
    return info


def migration_candidates():
    """Look (two folders deep) in Desktop, Downloads, Documents and OneDrive for an earlier FrameDecks folder."""
    home = Path.home()
    roots = [home / "Desktop", home / "Downloads", home / "Documents", home / "OneDrive" / "Desktop", home / "OneDrive" / "Documents"]
    found, seen, budget = [], set(), [2500]

    def visit(d, depth):
        if budget[0] <= 0:
            return
        budget[0] -= 1
        try:
            key = d.resolve()
        except OSError:
            return
        if key in seen or key == DATA.resolve():
            return
        seen.add(key)
        if looks_like_data(d):
            found.append(_describe(d))
            return
        if depth == 0:
            return
        try:
            for sub in d.iterdir():
                if sub.is_dir() and not sub.name.startswith(".") and sub.name not in ("node_modules", "AppData"):
                    visit(sub, depth - 1)
        except OSError:
            pass
    for r in roots:
        if r.is_dir():
            visit(r, 2)
    found.sort(key=lambda x: -x["modified"])
    return found[:5]


def migration_status():
    s = app_settings()
    needed = SEPARATE_DATA and not s["importDecided"] and not STATE_FILE.exists() and not PRIVATE_FILE.exists()
    return {"needed": needed, "candidates": migration_candidates() if needed else []}


def import_from(folder):
    global sessions
    src = Path(folder)
    if not src.is_dir() or not looks_like_data(src):
        raise ValueError("That folder doesn’t contain FrameDecks data (its saved content or member list).")
    if src.resolve() == DATA.resolve():
        raise ValueError("That is already the folder FrameDecks uses.")
    backup_now("before-import")
    copied = []
    for name in DATA_FILE_NAMES:
        f = legacy.find(src, name)                          # also an older folder that uses the earlier file names
        if f:
            shutil.copy2(f, DATA / name)
            copied.append(name)
    with sessions_lock:
        sessions = load_sessions()
    new = load_state()
    save_state(new)  # new revision: every open screen reloads the imported content
    save_app_settings({"importDecided": True})
    return copied


def open_folder(path):
    if os.name == "nt":
        os.startfile(str(path))  # opens File Explorer
        return True
    return False


def open_external(url):
    if not re.match(r"^(https?:|mailto:|tel:)", url or "", re.I):
        return False
    if os.name == "nt" and not url.lower().startswith("http"):
        os.startfile(url)   # mailto: / tel: go to the default email or phone app
    else:
        webbrowser.open(url)
    return True


FIREWALL_RULE = "FrameDecks Phone Remote"
OLD_FIREWALL_RULES = legacy.OLD_FIREWALL_RULES            # removed whenever the rule is set or undone


def firewall(action):
    """Windows only. Asks for administrator permission (UAC). Allow = inbound, this program only, Private networks only."""
    if os.name != "nt":
        return False, "Only available on Windows."
    import base64
    prog = sys.executable.replace("'", "''")
    old = "".join(f"Remove-NetFirewallRule -DisplayName '{n}' -ErrorAction SilentlyContinue; " for n in OLD_FIREWALL_RULES)
    if action == "allow":
        inner = (old + f"Remove-NetFirewallRule -DisplayName '{FIREWALL_RULE}' -ErrorAction SilentlyContinue; "
                 f"New-NetFirewallRule -DisplayName '{FIREWALL_RULE}' -Direction Inbound -Action Allow "
                 f"-Program '{prog}' -Protocol TCP -Profile Private | Out-Null")
    else:
        inner = old + f"Remove-NetFirewallRule -DisplayName '{FIREWALL_RULE}' -ErrorAction SilentlyContinue"
    enc = base64.b64encode(inner.encode("utf-16-le")).decode()
    outer = ("try { Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden "
             f"-ArgumentList '-NoProfile','-EncodedCommand','{enc}'; exit 0 }} catch {{ exit 5 }}")
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-Command", outer], capture_output=True, text=True,
                           timeout=180, creationflags=0x08000000)
    except (OSError, subprocess.TimeoutExpired):
        return False, "Windows didn’t respond. Try again."
    _net_cache["at"] = 0
    if r.returncode == 5:
        return False, "Cancelled: administrator permission was not given."
    return r.returncode == 0, ("Done." if r.returncode == 0 else "Windows reported a problem.")


# ---------- FrameCast (built-in virtual camera, Windows) ----------
VCAM_SETTINGS_FILE = DATA / "kc-vcam-settings.json"
VCAM_DEFAULTS = {"enabled": True, "cameraName": "", "resolution": "720p", "mirror": False, "blur": "off", "blurStrength": 0, "cards": True, "look": "off", "presentFps": 15,
                 "blurStyle": "natural"}
LOOKS_FILE = DATA / "kc-looks.json"
VCAM = {"engine": None, "reason": "", "detail": "", "cameras": None, "camerasAt": 0}


def _picture():
    """vcam/picture.py (profiles, schema). Needs OpenCV; without it the version-1 settings still work."""
    try:
        from vcam import picture
        return picture
    except Exception:
        return None


def vcam_settings():
    """Saved FrameCast settings, migrated to the current schema and validated; defaults fill the gaps
    (a damaged or older file never stops the camera)."""
    out = dict(VCAM_DEFAULTS)
    pic = _picture()
    if pic:
        out.update(pic.defaults(), schemaVersion=pic.SCHEMA_VERSION)
    try:
        data = json.loads(VCAM_SETTINGS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            if pic:
                data, _ = pic.migrate(data)
            out.update(clean_vcam(data))
    except (OSError, ValueError):
        pass
    if pic:
        out["filterName"] = out["look"]                       # the filter is the Camera Look (alias)
        out["backgroundMode"] = pic.background_mode(out.get("blurStrength"))
    return out


def vcam_save(cur):
    """Write the settings file (only stored keys; derived ones like filterName are recomputed on read)."""
    data = {k: v for k, v in cur.items() if k not in ("filterName", "backgroundMode")}
    VCAM_SETTINGS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def clean_vcam(d):
    out = {}
    if isinstance(d.get("enabled"), bool):
        out["enabled"] = d["enabled"]
    if isinstance(d.get("mirror"), bool):
        out["mirror"] = d["mirror"]
    if isinstance(d.get("cards"), bool):
        out["cards"] = d["cards"]
    if isinstance(d.get("look"), str) and (d["look"] == "off" or (d["look"].isidentifier() and len(d["look"]) <= 40)):
        out["look"] = d["look"]
    if isinstance(d.get("cameraName"), str) and len(d["cameraName"]) <= 200:
        out["cameraName"] = d["cameraName"]
    if d.get("resolution") in ("720p", "1080p"):
        out["resolution"] = d["resolution"]
    if d.get("blur") in ("off", "light", "strong"):
        out["blur"] = d["blur"]
    if d.get("presentFps") in (15, 30):
        out["presentFps"] = d["presentFps"]
    if d.get("blurStyle") in ("natural", "classic"):
        out["blurStyle"] = d["blurStyle"]
    if isinstance(d.get("blurStrength"), (int, float, str)) and not isinstance(d.get("blurStrength"), bool):
        try:
            raw = float(d["blurStrength"])
        except ValueError:
            raw = float("nan")
        if raw == raw and abs(raw) != float("inf"):
            # Steps of 0.001 % (v4.9; 0.1 before). Rounded in decimal from the number's shortest text form, so
            # 12.345 stays 12.345 (binary floats would make some halves round down) - no drift on save/reload.
            from decimal import Decimal, ROUND_HALF_UP
            n = float(Decimal(repr(raw)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))
            n = 0 if raw <= 0 else max(0.001, min(100.0, n))       # 0 = off; any positive value is at least 0.001 %
            out["blurStrength"] = int(n) if n == int(n) else n
    elif "blur" in out:                                   # older settings: off / light / strong
        out["blurStrength"] = {"off": 0, "light": 30, "strong": 80}[out["blur"]]
    # Version 2 (picture settings): filterName is accepted as another name for look; backgroundMode none/blur
    fn = d.get("filterName")
    if "look" not in d and isinstance(fn, str) and (fn in ("off", "none") or (fn.isidentifier() and len(fn) <= 40)):
        out["look"] = "off" if fn == "none" else fn
    if d.get("backgroundMode") in ("none", "blur") and "blurStrength" not in d:
        n = 0 if d["backgroundMode"] == "none" else (vcam_settings_raw_blur() or 30)
        out["blurStrength"], out["blur"] = n, "off" if n == 0 else ("light" if n <= 45 else "strong")
    pic = _picture()
    if pic:
        out.update(pic.clean(d))
        if isinstance(d.get("schemaVersion"), int):
            out["schemaVersion"] = pic.SCHEMA_VERSION
    return out


def vcam_settings_raw_blur():
    """The saved blur strength (0 if none), without going through clean_vcam (avoids recursion)."""
    try:
        v = json.loads(VCAM_SETTINGS_FILE.read_text(encoding="utf-8")).get("blurStrength", 0)
        return v if isinstance(v, (int, float)) and not isinstance(v, bool) else 0
    except (OSError, ValueError, AttributeError):
        return 0


def vcam_apply_changes(data):
    """Validated changes for a settings POST: {"applyProfile": "meetings"} applies a profile; editing a
    setting the active profile controls switches the profile to "custom" (the values stay as they are)."""
    pic = _picture()
    if pic and isinstance(data.get("applyProfile"), str):
        prof = pic.profile_changes(data["applyProfile"])
        if prof is None:
            raise ValueError("Unknown profile")
        return clean_vcam(prof)
    changes = clean_vcam(data)
    if pic and "outputProfile" not in data:
        cur = vcam_settings()
        prof = pic.PROFILES.get(cur.get("outputProfile"), {}).get("settings", {})
        if any(k in prof and changes[k] != cur.get(k) for k in changes):
            changes["outputProfile"] = "custom"
    return changes


def vcam_list_cameras():
    """Webcams by name (FrameCast itself excluded). Refreshed at most every 10 s; never turns a webcam on."""
    if VCAM["cameras"] is not None and time.time() - VCAM["camerasAt"] < 10:
        return VCAM["cameras"]
    cams = []
    if os.environ.get("KC_VCAM_DEMO") == "1":
        cams = [{"name": "Demo webcam (test)", "backend": "demo", "index": 0, "ir": False},
                {"name": "Integrated IR Camera", "backend": "demo", "index": 1, "ir": True}]
    else:
        try:
            from vcam import devices
            cams = devices.list_cameras()
        except Exception:
            cams = []
    VCAM["cameras"], VCAM["camerasAt"] = cams, time.time()
    return cams


# ---------- Studio: layout, screen sharing, layers, scenes (saved in kc-studio.json) ----------
STUDIO_FILE = DATA / "kc-studio.json"
SCENES_DIR = DATA / "scenes"            # scene thumbnails
LAYERS_DIR = DATA / "layers"
STUDIO_VERSION = 1
QUICK_PRESETS = {
    "logo": {"name": "Logo overlay", "needs": "image", "layer": {"type": "image", "x": 0.88, "y": 0.13, "w": 0.16, "opacity": 0.9}},
    "lower_third": {"name": "Lower third", "needs": "image", "layer": {"type": "image", "x": 0.34, "y": 0.84, "w": 0.6}},
    "slide_camera": {"name": "Slide + camera", "needs": "pdf_or_window", "layout": {"mode": "pip", "corner": "br", "size": "small", "custom": False}},
    "intro": {"name": "Intro bumper", "needs": "video", "layer": {"type": "video", "x": 0.5, "y": 0.5, "w": 1.0, "loop": False}},
}


def studio_load():
    try:
        d = json.loads(STUDIO_FILE.read_text(encoding="utf-8"))
        if not isinstance(d, dict):
            raise ValueError
    except (OSError, ValueError):
        d = {}
    from vcam.layers import clean_layer
    from vcam.compositor import clean_layout
    scenes = []
    for sc in d.get("scenes", []) if isinstance(d.get("scenes"), list) else []:
        if isinstance(sc, dict) and str(sc.get("id", "")).isidentifier():
            scenes.append({"id": sc["id"][:40], "name": str(sc.get("name") or "Scene")[:40], "look": str(sc.get("look") or "off")[:40],
                           "layout": clean_layout(sc.get("layout")), "screen": sc.get("screen") if isinstance(sc.get("screen"), dict) else None,
                           "layers": [clean_layer(l) for l in sc.get("layers", []) if isinstance(l, dict)]})
    variables = {}
    for k, v in (d.get("variables") or {}).items() if isinstance(d.get("variables"), dict) else []:
        if isinstance(k, str) and re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,30}$", k):
            variables[k] = str(v)[:200]
    # (Text layers made earlier may contain {{name}} placeholders: values saved then are still used for them.)
    collections = [{"id": str(c["id"])[:40], "name": str(c.get("name") or "Collection")[:40]} for c in d.get("collections", [])
                   if isinstance(c, dict) and str(c.get("id", "")).isidentifier()] if isinstance(d.get("collections"), list) else []
    if not collections:
        collections = [{"id": "main", "name": "My Frames"}]
    ids = {c["id"] for c in collections}
    for sc in scenes:
        raw = next((x for x in d.get("scenes", []) if isinstance(x, dict) and x.get("id") == sc["id"]), {})
        sc["collection"] = raw.get("collection") if raw.get("collection") in ids else collections[0]["id"]
    return {"version": STUDIO_VERSION, "layout": clean_layout(d.get("layout")),
            "layers": [clean_layer(l) for l in d.get("layers", []) if isinstance(l, dict)],
            "scenes": scenes, "activeScene": str(d.get("activeScene") or "")[:40],
            "variables": variables, "collections": collections}


def studio_save():
    comp = VCAM.get("compositor")
    if not comp:
        return
    cur = studio_load()
    cur.update(layout=comp.layout, layers=comp.layers.layers)
    STUDIO_FILE.write_text(json.dumps(cur, indent=2), encoding="utf-8")


# ---------- v6.2 Branding: the leader's logo (always stored as PNG) ----------
BRAND_LOGO = DATA / "bcc-brand-logo.png"


def png_size(data):
    """(width, height) of a PNG, or None if the bytes are not a PNG."""
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    w, h = int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    return (w, h) if 0 < w <= 8192 and 0 < h <= 8192 else None


# ---------- v6 Scripture: ESV API (your own key) with an offline cache; typed / Excel text works as before ----------
SCRIPTURE_FILE = DATA / "bcc-scripture.json"
SCRIPTURE_CACHE = DATA / "bcc-scripture-cache.json"
ESV_URL = os.environ.get("KC_ESV_URL", "https://api.esv.org/v3/passage/text/")
SCRIPTURE_CACHE_MAX = 400                     # passages kept for offline use (oldest dropped first)
_scr_lock = threading.Lock()
SCRIPTURE_HEALTH = {"ok": None, "message": "", "at": 0}


def scripture_settings():
    try:
        d = json.loads(SCRIPTURE_FILE.read_text(encoding="utf-8"))
        d = d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        d = {}
    return {"provider": "esv", "key": str(d.get("key") or "")[:200], "translation": "ESV" if d.get("translation", "ESV") == "ESV" else "typed"}


def _scr_cache():
    try:
        d = json.loads(SCRIPTURE_CACHE.read_text(encoding="utf-8"))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def scripture_lookup(ref, translation="ESV", fresh=False):
    """{ref, text, version, cached, stale?} for a reference such as "Romans 2:28-29"; raises ValueError with a plain message."""
    ref = re.sub(r"\s+", " ", str(ref or "")).strip()[:120]
    if not ref:
        raise ValueError("Type a reference first, for example Romans 2:29.")
    if translation != "ESV":
        raise ValueError("Only the ESV can be fetched. For other translations type or paste the text (or plan them in the Meeting Workbook).")
    key = "ESV|" + ref.lower()
    with _scr_lock:
        cache = _scr_cache()
    hit = cache.get(key)
    if hit and not fresh:
        hit["at"] = time.time()
        return {"ref": hit["ref"], "text": hit["text"], "version": "ESV", "cached": True}
    api_key = scripture_settings()["key"]
    if not api_key:
        if hit:
            return {"ref": hit["ref"], "text": hit["text"], "version": "ESV", "cached": True, "stale": True}
        raise ValueError("Add your ESV API key in Settings → Scripture (free for churches at api.esv.org), or type the verse text.")
    from urllib.request import Request, urlopen
    from urllib.parse import urlencode
    q = urlencode({"q": ref, "include-passage-references": "false", "include-verse-numbers": "false", "include-first-verse-numbers": "false",
                   "include-footnotes": "false", "include-footnote-body": "false", "include-headings": "false", "include-short-copyright": "false",
                   "include-selahs": "true", "indent-paragraphs": "0", "indent-poetry": "false", "indent-declares": "0", "indent-psalm-doxology": "0"})
    try:
        with urlopen(Request(ESV_URL + "?" + q, headers={"Authorization": "Token " + api_key, "User-Agent": "FrameCast/" + APP_VERSION}), timeout=8) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        code = getattr(e, "code", None)
        SCRIPTURE_HEALTH.update(ok=False, at=time.time(), message="The ESV key was not accepted." if code in (401, 403) else "Can’t reach api.esv.org.")
        if hit:
            return {"ref": hit["ref"], "text": hit["text"], "version": "ESV", "cached": True, "stale": True}
        if code in (401, 403):
            raise ValueError("The ESV API key was not accepted. Check it in Settings → Scripture.")
        raise ValueError("No internet connection, and this passage isn’t saved on this PC yet. Type the text, or try again when online.")
    passages = [p for p in (data.get("passages") or []) if isinstance(p, str) and p.strip()]
    if not passages:
        raise ValueError("That reference wasn’t found. Try e.g. John 3:16, Psalm 23 or Matthew 5:1-12.")
    text = "\n".join(re.sub(r"[ \t]+", " ", p).strip() for p in passages)
    text = re.sub(r"\s*\(ESV\)\s*$", "", text).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    canon = str(data.get("canonical") or ref)[:120]
    SCRIPTURE_HEALTH.update(ok=True, at=time.time(), message="Connected to api.esv.org")
    with _scr_lock:
        cache = _scr_cache()
        cache[key] = {"ref": canon, "text": text, "at": time.time()}
        if len(cache) > SCRIPTURE_CACHE_MAX:
            for k in sorted(cache, key=lambda k: cache[k].get("at", 0))[:len(cache) - SCRIPTURE_CACHE_MAX]:
                cache.pop(k, None)
        tmp = SCRIPTURE_CACHE.with_suffix(".tmp")
        tmp.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, SCRIPTURE_CACHE)
    return {"ref": canon, "text": text, "version": "ESV", "cached": False}


def scripture_info():
    st = scripture_settings()
    return {"provider": "ESV API (api.esv.org)", "hasKey": bool(st["key"]), "keyHint": ("…" + st["key"][-4:]) if st["key"] else "",
            "translation": st["translation"], "cached": len(_scr_cache()), "cacheMax": SCRIPTURE_CACHE_MAX, "health": SCRIPTURE_HEALTH}


def powerpoint_show():
    """The PowerPoint slide show running on this PC (full screen or windowed), or None. Cached ~2 s."""
    try:
        from vcam.powerpoint import powerpoint_status
        s = powerpoint_status()
    except Exception:
        return None
    return {"name": s.get("name") or "PowerPoint", "page": s.get("page"), "pages": s.get("pages"), "kind": "powerpoint"} if s else None


def slide_move(step):
    """Next (+1) / Previous (-1) for whatever is being presented: the Studio's shared screen or presentation layer
    (PDF deck or captured window) first, else the PowerPoint slide show running on this PC - e.g. full screen and
    shared directly in Zoom/Teams, which FrameDecks is not capturing. Works without the camera engine."""
    try:
        step = 1 if int(step) > 0 else -1
    except (TypeError, ValueError):
        raise ValueError("Unknown slide step")
    comp = VCAM.get("compositor")
    res = None
    if comp:
        res = comp.slide(step)
        if res is None:                                        # no shared presentation: the top presentation layer
            pres = [l for l in comp.layers.layers[::-1] if l["type"] in ("pdf", "window") and l["visible"]]
            res = comp.layers.slide(pres[0]["id"], step) if pres else None
    if res is None:
        try:
            from vcam.powerpoint import powerpoint_slide
            res = powerpoint_slide(step)
        except Exception as e:
            res = {"error": f"Slides are not available ({type(e).__name__})"}
    if isinstance(res, dict) and res.get("page"):
        VCAM["lastSlide"] = res
    return res


def remote_studio_info():
    """What the phone/iPad remote may see of the Studio: scene names, the active scene, and the presentation
    (a Studio deck/window, or a PowerPoint slide show running on this PC)."""
    comp = VCAM.get("compositor")
    if not comp:
        ppt = powerpoint_show()
        return {"available": False, "scenes": [], "activeScene": "", "presentation": ppt}
    st = studio_load()
    pres = None
    src = comp.screen_src or {}
    if comp.screen is not None and src.get("kind") in ("pdf", "window"):
        ss = comp.screen_status()
        pres = {"name": src.get("name") or src.get("file") or "Presentation", "page": ss.get("page"), "pages": ss.get("pages")}
    else:
        layers = [l for l in comp.layers.layers[::-1] if l["type"] in ("pdf", "window") and l["visible"]]
        if layers:
            l = layers[0]
            if l["type"] == "pdf" and l["id"] not in comp.layers.sources:
                comp.layers._source(l)                         # load the deck so the slide number is known
            ls = comp.layers.status().get(l["id"], {})
            pres = {"name": l["name"], "page": ls.get("page"), "pages": ls.get("pages")}
    if pres is None:
        pres = powerpoint_show()
    if pres and not pres.get("page") and VCAM.get("lastSlide", {}).get("page"):
        pres.update(page=VCAM["lastSlide"]["page"], pages=VCAM["lastSlide"].get("pages"))
    eng = VCAM.get("engine")
    est = {}
    try:
        est = dict(eng.status) if eng else {}
    except Exception:
        est = {}
    rec = comp.recorder
    return {"available": True, "scenes": [{"id": x["id"], "name": x["name"]} for x in st["scenes"]],
            "activeScene": st["activeScene"], "presentation": pres,
            "vcam": {"state": est.get("state", ""), "inUse": bool(est.get("inUse")), "fps": est.get("fps", 0)},
            "recording": {"on": rec is not None, "seconds": round(time.time() - rec.started, 1) if rec else 0}}


def remote_studio_action(d):
    """Only two things are allowed from the remote: switch scene, and next/previous slide."""
    op = d.get("op")
    if op == "scene":
        studio_action({"op": "scene-apply", "id": str(d.get("id") or "")})
        return {}
    if op == "slide":
        return {"slide": slide_move(d.get("step", 1))}
    raise ValueError("Not allowed from the remote")


def recordings_dir():
    vids = Path.home() / "Videos"
    legacy.migrate_recordings(vids if vids.is_dir() else DATA)
    return (vids if vids.is_dir() else DATA) / "FrameDecks"


def studio_status():
    comp = VCAM.get("compositor")
    if not comp:
        return {"available": False, "reason": VCAM.get("reason", "")}
    from vcam.screen import list_sources
    st = studio_load()
    rec = comp.recorder
    lay_status = comp.layers.status()
    staged = comp.staged
    return {"available": True, "layout": comp.layout, "layers": [dict(l, status=lay_status.get(l["id"], {})) for l in comp.layers.layers],
            "staged": staged is not None, "stagedLayers": staged or [], "collections": st["collections"],
            "sceneMode": comp.scene_mode(staged if staged is not None else comp.layers.layers),
            "screen": comp.screen_status(), "sources": _cached_sources(list_sources),
            "scenes": [{"id": x["id"], "name": x["name"], "collection": x["collection"],
                        "thumb": int((SCENES_DIR / (x["id"] + ".jpg")).stat().st_mtime) if (SCENES_DIR / (x["id"] + ".jpg")).exists() else 0} for x in st["scenes"]],
            "activeScene": st["activeScene"], "presets": {k: {"name": v["name"], "needs": v["needs"]} for k, v in QUICK_PRESETS.items()},
            "recording": {"on": rec is not None, "seconds": round(time.time() - rec.started, 1) if rec else 0, "codec": rec.codec if rec else "",
                          "frames": rec.frames if rec else 0, "skipped": rec.skipped if rec else 0, "folder": str(recordings_dir())},
            "lastRecording": comp.last_recording, "latencyTest": comp.latency_test, "composeMs": round(comp.ms, 2),
            "presentation": {"open": bool(comp.present["clients"]) or bool(DESKTOP.get("present_open") and DESKTOP["present_open"]()),
                             "desktop": bool(DESKTOP.get("present")), "framesSent": comp.present["sent"]},
            "pdfs": sorted(p.name for p in LAYERS_DIR.glob("*.pdf")) if LAYERS_DIR.is_dir() else []}


_SOURCES = {"at": 0.0, "list": []}


def _cached_sources(list_sources):
    """Displays and windows for the Studio's screen-share menu, listed at most every 3 s (the Studio asks every
    second while it is open; enumerating every window that often is wasted work during a meeting)."""
    if time.monotonic() - _SOURCES["at"] > 3.0:
        _SOURCES.update(at=time.monotonic(), list=list_sources())
    return _SOURCES["list"]


def _layer_id():
    return "L" + secrets.token_hex(4)


def studio_action(d):
    """Everything the Studio panel, hotkeys, tray menu and scenes can change."""
    eng = VCAM.get("engine")
    if eng:
        eng.kick()                         # a Studio change: draw it now
    return _studio_action(d)


def _studio_action(d):
    comp, eng = VCAM.get("compositor"), VCAM.get("engine")
    op = d.get("op")
    if op == "slide":                                          # slides work even without the camera engine
        return {"slide": slide_move(d.get("step", 1))}
    if not comp:
        raise ValueError(VCAM.get("reason") or "FrameCast is not available.")
    if op == "layout":
        comp.set_layout(d.get("layout") or {})
    elif op == "screen":
        src = d.get("source")
        if src:
            from vcam.screen import list_sources
            if src.get("kind") == "pdf":
                name = Path(str(src.get("file", ""))).name
                if not (LAYERS_DIR / name).is_file():
                    raise ValueError("That PDF is not in the Content folder.")
                src = {"kind": "pdf", "file": name, "name": name}
            else:
                known = {x["id"]: x for x in list_sources()}
                match = known.get(src.get("id")) or next((x for x in known.values() if x["name"] == src.get("name")), None)
                if not match:
                    raise ValueError("That screen or window is no longer available.")
                src = match
        comp.set_screen(src, LAYERS_DIR)
    elif op == "layers":
        from vcam.layers import clean_layer
        layers = [l for l in (d.get("layers") or []) if isinstance(l, dict)][:40]
        for l in layers:
            if not l.get("id"):
                l["id"] = _layer_id()
        if d.get("target") == "preview" and comp.staged is not None:
            comp.staged = [clean_layer(l) for l in layers]       # Preview mode: not on the output yet
            return {}
        comp.layers.set_layers(layers)
        try:
            VCAM["mediaSig"] = media_sig(comp.layers.layers)     # the scene will be written back with these: no re-apply
        except Exception:
            pass
    elif op == "stage":
        comp.staged = [dict(l) for l in comp.layers.layers] if d.get("on") else None
        return {}
    elif op == "stage-commit":
        if comp.staged is not None:
            comp.layers.set_layers(comp.staged)
            comp.staged = None
    elif op in ("collection-add", "collection-delete"):
        st = studio_load()
        if op == "collection-add":
            name = str(d.get("name") or "Collection")[:40]
            cid = "c_" + secrets.token_hex(3)
            st["collections"].append({"id": cid, "name": name})
        else:
            cid = d.get("id")
            if len(st["collections"]) > 1:
                st["collections"] = [c for c in st["collections"] if c["id"] != cid]
                for sc in st["scenes"]:
                    if sc.get("collection") == cid:
                        sc["collection"] = st["collections"][0]["id"]
        STUDIO_FILE.write_text(json.dumps(st, indent=2), encoding="utf-8")
        return {"collection": cid}
    elif op == "layer-control":
        comp.layers.control(str(d.get("id")), str(d.get("cmd")))
    elif op == "toggle-layer":
        n = int(d.get("index", 0))
        layers = [dict(l) for l in comp.layers.layers]
        order = layers[::-1]                                   # the panel lists the top layer first
        if 0 <= n < len(order):
            order[n]["visible"] = not order[n]["visible"]
            comp.layers.set_layers(layers)
            return {"layer": order[n]["name"], "visible": order[n]["visible"]}
        return {"layer": None}
    elif op == "record":
        if d.get("on"):
            w, h = SIZES_FOR_REC.get(vcam_settings()["resolution"], (1280, 720))
            r = comp.start_recording(recordings_dir(), w, h)
            return {"recording": True, "codec": r.codec, "file": r.path}
        return {"recording": False, "result": comp.stop_recording()}
    elif op == "latency-test":
        comp.latency_test = bool(d.get("on"))
    elif op == "preset":
        p = QUICK_PRESETS.get(d.get("preset"))
        if not p:
            raise ValueError("Unknown preset")
        if "layer" in p:
            f = Path(str(d.get("file") or "")).name
            if not (LAYERS_DIR / f).is_file():
                raise ValueError("Choose a file for this preset first.")
            layers = [dict(l) for l in comp.layers.layers]
            layers.append({**p["layer"], "id": _layer_id(), "name": p["name"], "file": f, "visible": True})
            comp.layers.set_layers(layers)
        if "layout" in p:
            comp.set_layout(p["layout"])
    elif op in ("scene-save", "scene-apply", "scene-delete"):
        st = studio_load()
        if op == "scene-save":
            sid = str(d.get("id") or "") or re.sub(r"\W+", "_", str(d.get("name") or "scene").lower()).strip("_")[:30] or "scene"
            if not sid.isidentifier():
                sid = "s_" + sid
            src_layers = comp.staged if comp.staged is not None else comp.layers.layers
            ids = {c["id"] for c in st["collections"]}
            scene = {"id": sid, "name": str(d.get("name") or sid)[:40], "look": vcam_settings()["look"], "layout": comp.layout,
                     "screen": comp.screen_src, "layers": src_layers,
                     "collection": d.get("collection") if d.get("collection") in ids else st["collections"][0]["id"]}
            try:                                                           # thumbnail for the scene gallery
                SCENES_DIR.mkdir(parents=True, exist_ok=True)
                import cv2 as _cv2
                img = comp.render(src_layers, 320, 180)
                _cv2.imwrite(str(SCENES_DIR / (sid + ".jpg")), img, [_cv2.IMWRITE_JPEG_QUALITY, 80])
            except Exception as e:
                print("Scene thumbnail:", e)
            st["scenes"] = [x for x in st["scenes"] if x["id"] != sid] + [scene]
            st["activeScene"] = sid
        elif op == "scene-delete":
            st["scenes"] = [x for x in st["scenes"] if x["id"] != d.get("id")]
            try:
                (SCENES_DIR / (str(d.get("id")) + ".jpg")).unlink(missing_ok=True)
            except OSError:
                pass
        else:
            sc = next((x for x in st["scenes"] if x["id"] == d.get("id")), None)
            if not sc:
                raise ValueError("Frame not found")
            # switching reuses everything that is already running (camera, layer sources, cards)
            comp.set_layout(sc["layout"])
            if comp.staged is not None:
                comp.staged = [dict(l) for l in sc["layers"]]                 # Preview mode: load it into the preview
            else:
                comp.layers.set_layers(sc["layers"])
            want = sc.get("screen")
            if (want or {}).get("id") != (comp.screen_src or {}).get("id") or (want or {}).get("file") != (comp.screen_src or {}).get("file"):
                try:
                    studio_action({"op": "screen", "source": want})
                except ValueError:
                    comp.set_screen(None)
            cur = vcam_settings()
            if sc["look"] != cur["look"]:
                cur["look"] = sc["look"]
                vcam_save(cur)
                if eng:
                    eng.configure(grade=vcam_grade(sc["look"]))
            st["activeScene"] = sc["id"]
        st.update(layout=comp.layout, layers=comp.layers.layers)
        STUDIO_FILE.write_text(json.dumps(st, indent=2), encoding="utf-8")
        return {"activeScene": st["activeScene"]}
    else:
        raise ValueError("Unknown action")
    studio_save()
    return {}


SIZES_FOR_REC = {"720p": (1280, 720), "1080p": (1920, 1080)}


def vcam_looks():
    """All looks (built-in + kc-looks.json). Re-read each time, so looks added to the file appear."""
    try:
        from vcam import looks
        found, note = looks.load(LOOKS_FILE)
    except Exception as e:
        return {}, f"Looks unavailable ({type(e).__name__})"
    VCAM["looksNote"] = note
    return found, note


def vcam_grade(look_id, intensity=None):
    """The Grade to apply for a look id at the saved filter intensity (0-100), or None for Off / unknown
    looks / intensity 0 (the picture is then left exactly as it is)."""
    if look_id == "off":
        return None
    found, _ = vcam_looks()
    if look_id not in found:
        return None
    from vcam.looks import Grade, at_intensity
    look = at_intensity(found[look_id], vcam_settings().get("filterIntensity", 100) if intensity is None else intensity)
    return Grade(look) if look is not None else None


def _vcam_blockers():
    try:
        from vcam.devices import camera_blockers
        return camera_blockers()
    except Exception:
        return None


def vcam_effective(settings):
    """The settings the engine should use: an empty camera choice means the first usable webcam."""
    out = {k: v for k, v in settings.items() if k not in ("enabled", "cards", "look", "filterName", "backgroundMode", "schemaVersion")}
    if VCAM.get("blurSession") is not None:               # a blur strength being tried, not saved yet
        out["blurStrength"] = VCAM["blurSession"]
    if not out.get("cameraName"):
        cams = vcam_list_cameras()
        out["cameraName"] = next((c["name"] for c in cams if not c["ir"]), cams[0]["name"] if cams else "")
    return out


def vcam_start():
    """Create the engine (idle until Zoom/Teams uses FrameCast). Safe to call when unavailable."""
    if VCAM["engine"] is not None:
        return
    demo = os.environ.get("KC_VCAM_DEMO") == "1"
    start_files_msg = ("You’re using the start-file version (the black window). FrameCast is only in the installed app: "
                       "close the black window, then open FrameDecks from its desktop or Start-menu icon.")
    os.environ.setdefault("OPENCV_VIDEOIO_MSMF_ENABLE_HW_TRANSFORMS", "0")   # before OpenCV loads
    try:
        import cv2  # noqa: F401
        from vcam.engine import VCamEngine, DemoCamera
        from vcam.devices import Camera
        from vcam.blur import BackgroundBlur
        from vcam import sink as vsink
    except Exception as e:
        VCAM["detail"] = f"{type(e).__name__}: {e}"
        if FROZEN:
            import traceback
            print("FrameCast could not load:\n" + traceback.format_exc())
            VCAM["reason"] = ("FrameCast couldn’t start because part of it is missing. Please send Settings → Diagnostics "
                              "→ Copy diagnostics to the developer.")
        else:
            VCAM["reason"] = start_files_msg
        return
    model = RES / "vcam" / "models" / "selfie_segmentation_landscape.tflite"
    if not model.exists():
        model = HERE / "vcam" / "models" / "selfie_segmentation_landscape.tflite"
    if demo:
        make_sink, make_cam = (lambda w, h: vsink.FakeSink(w, h, connected=False)), DemoCamera
    else:
        if os.name != "nt":
            VCAM["reason"] = start_files_msg if not FROZEN else "FrameCast works on Windows."
            return
        dll = vsink.dll_path(RES) if vsink.dll_path(RES).exists() else vsink.dll_path(HERE)
        if not dll.exists():
            folder = dll.parent
            present = sorted(p.name for p in folder.iterdir()) if folder.is_dir() else []
            VCAM["detail"] = f"missing {dll.name} in {folder} (found: {', '.join(present) or 'nothing'})"
            if not FROZEN:
                VCAM["reason"] = start_files_msg
            elif (folder / "build-info.json").exists():
                VCAM["reason"] = ("The camera file framecast_vcam64.dll was installed but has since been removed, most likely by "
                                  "Windows Security or another antivirus. Open Windows Security → Virus & threat protection → "
                                  "Protection history, restore or allow framecast_vcam64.dll, then run the installer again.")
            else:
                VCAM["reason"] = ("This installer was built without the camera, because the GitHub build recipe is out of date. "
                                  "Copy the .github folder from the latest FrameDecks.zip into your repository, commit "
                                  "and push, then install the new installer.")
            print("FrameCast not available: " + VCAM["detail"])
            return
        make_sink, make_cam = (lambda w, h: vsink.SoftcamSink(dll, w, h)), (lambda name, w, h: Camera(name, w, h, vcam_list_cameras()))
    # The verse, question and birthday cards, drawn onto every frame from the same live state as the overlay pages
    from vcam.overlay import OverlayLayer
    layer = OverlayLayer(APP / "fonts", lambda: state)
    VCAM["cardsOn"] = vcam_settings()["cards"]

    def cards(frame):
        return layer(frame) if VCAM.get("cardsOn", True) else frame
    from vcam.compositor import Compositor
    LAYERS_DIR.mkdir(parents=True, exist_ok=True)
    comp = Compositor(LAYERS_DIR, cards=layer, cards_on=lambda: VCAM.get("cardsOn", True))
    from vcam.program import ProgramFX
    comp.program_fx = ProgramFX(APP / "fonts", lambda: state, lambda: VCAM.get("cardsOn", True), logo_path=BRAND_LOGO)
    VCAM["compositor"] = comp
    st = studio_load()
    comp.set_layout(st["layout"])
    comp.layers.set_layers(st["layers"])
    comp.variables = st["variables"]
    engine = VCamEngine(make_sink, make_cam, lambda: BackgroundBlur(model), compositor=comp)
    VCAM["layer"] = layer
    engine.configure(**vcam_effective(vcam_settings()), grade=vcam_grade(vcam_settings()["look"]))
    VCAM["engine"], VCAM["reason"] = engine, ""
    if vcam_settings()["enabled"]:
        engine.start()


def _looks_list():
    if VCAM.get("looksCache") is None or time.time() - VCAM.get("looksAt", 0) > 10:
        found, _ = vcam_looks()
        from vcam.looks import ORDER
        ids = [i for i in ORDER if i in found] + sorted(i for i in found if i not in ORDER)
        VCAM["looksCache"], VCAM["looksAt"] = [{"id": i, "name": found[i]["name"]} for i in ids], time.time()
    return VCAM["looksCache"]


def vcam_status(lite=False):
    """FrameCast status for the PC screens. lite: only what the top-bar light needs (no webcam or looks listing)."""
    eng = VCAM["engine"]
    try:
        from vcam import sink as vsink
        registered = vsink.is_registered() or os.environ.get("KC_VCAM_DEMO") == "1"
    except Exception:
        registered = False
    if lite:
        return {"available": eng is not None, "reason": VCAM["reason"], "registered": registered, "lite": True,
                "settings": vcam_settings(), "status": dict(eng.status) if eng else None}
    return {"available": eng is not None, "reason": VCAM["reason"], "registered": registered,
            "settings": vcam_settings(), "status": dict(eng.status) if eng else None,
            "cameras": [{"name": n, "ir": any(c["ir"] for c in vcam_list_cameras() if c["name"] == n)}
                        for n in dict.fromkeys(c["name"] for c in vcam_list_cameras())] if eng else [],
            "activeCamera": vcam_effective(vcam_settings())["cameraName"] if eng else "", "name": "FrameCast",
            "blurNow": VCAM["blurSession"] if VCAM.get("blurSession") is not None else vcam_settings()["blurStrength"],
            "looks": _looks_list(), "looksNote": VCAM.get("looksNote", ""),
            "profiles": [{"id": k, "name": v["name"]} for k, v in (_picture().PROFILES.items() if _picture() else [])]}


def vcam_install(action):
    """Register (or remove) FrameCast with Windows. Asks for administrator permission (UAC)."""
    if os.name != "nt":
        return False, "Only available on Windows."
    name = "unregister-framecast-camera.cmd" if action == "uninstall" else "register-framecast-camera.cmd"
    helper = next((p for p in (RES / "vcam" / "bin" / name, HERE / "vcam" / "bin" / name) if p.exists()), None)
    if helper is None or not (helper.parent / "framecast_vcam64.dll").exists():
        return False, "The FrameCast files are missing. Reinstall the app."
    path = str(helper).replace("'", "''")
    outer = ("try { Start-Process -FilePath '" + path + "' -Verb RunAs -Wait -WindowStyle Hidden; exit 0 } catch { exit 5 }")
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-Command", outer], capture_output=True, text=True,
                           timeout=180, creationflags=0x08000000)
    except (OSError, subprocess.TimeoutExpired):
        return False, "Windows didn’t respond. Try again."
    if r.returncode == 5:
        return False, "Cancelled: administrator permission was not given."
    return True, "Done."


TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".ttf": "font/ttf", ".woff2": "font/woff2", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, code, body, ctype, headers=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        for k, v in (headers or []):
            self.send_header(k, v)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def read_json(self):
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            raise ValueError("expected JSON")
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > MAX_BODY:
            raise ValueError("bad length")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def host_ok(self):
        # Only answer requests addressed to this computer by name or IP number
        # (blocks DNS-rebinding tricks from web pages)
        port = self.server.server_address[1]
        host = self.headers.get("Host", "")
        if host in (f"localhost:{port}", f"127.0.0.1:{port}"):
            return True
        return REMOTE and re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}:" + str(port), host) is not None

    def is_local(self):
        return self.client_address[0] in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def signed_in(self):
        m = re.search(COOKIE + r"=([A-Za-z0-9_\-]{20,100})", self.headers.get("Cookie", ""))
        if not m:
            return False
        with sessions_lock:
            exp = sessions.get(m.group(1))
            return bool(exp and exp > time.time())

    def announce(self):
        # Say in the black window when a new device reaches the PC (IP address only)
        ip = self.client_address[0]
        now = time.time()
        d = devices.setdefault(ip, {"first": now, "last": now, "signedIn": False})
        d["last"] = now
        if not d["signedIn"] and self.signed_in():
            d["signedIn"] = True
        if ip in seen_devices:
            return
        seen_devices.add(ip)
        who = "this PC, using its network address" if ip in lan_addresses() else "another device such as your phone or iPad"
        print(f"  >> {time.strftime('%H:%M')}  Connection from {ip} - {who}. It is getting through.", flush=True)

    def allowed(self, path):
        """The PC itself may use everything. Other devices only get the remote."""
        if self.is_local():
            return True
        if not REMOTE:
            return False
        self.announce()
        if path in REMOTE_PUBLIC or path.startswith("/fonts/"):
            return True
        return path in REMOTE_SIGNED_IN and self.signed_in()

    def remote_login(self, data):
        ip = self.client_address[0]
        now = time.time()
        count, until = failures.get(ip, [0, 0])
        if until > now:
            return self.reply(429, json.dumps({"error": "locked", "wait": int(until - now) + 1}), TYPES[".json"])
        pin = str(data.get("pin", "")) if isinstance(data, dict) else ""
        if not secrets.compare_digest(pin.encode(), remote_pin().encode()):
            count += 1
            failures[ip] = [count, now + 60 if count >= 5 else 0]
            if count >= 5:
                failures[ip] = [0, now + 60]
            return self.reply(401, json.dumps({"error": "wrong pin"}), TYPES[".json"])
        failures.pop(ip, None)
        token = secrets.token_urlsafe(32)
        with sessions_lock:
            sessions[token] = now + SESSION_DAYS * 86400
            save_sessions()
        cookie = f"{COOKIE}={token}; Path=/; Max-Age={SESSION_DAYS * 86400}; HttpOnly; SameSite=Strict"
        return self.reply(200, json.dumps({"ok": True}), TYPES[".json"], [("Set-Cookie", cookie)])

    def do_GET(self):
        count_request(urlparse(self.path).path)
        if not self.host_ok():
            return self.reply(403, "Forbidden", "text/plain; charset=utf-8")
        url = urlparse(self.path)
        path = unquote(url.path)
        if not self.is_local() and REMOTE and path in ("", "/", "/remote"):
            return self.reply(302, "", "text/plain", [("Location", "/remote.html")])
        if not self.allowed(path):
            return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
        if path == "/api/remote/studio":                # scenes + presentation for the remote (PIN-protected)
            return self.reply(200, json.dumps(remote_studio_info()), TYPES[".json"])
        if path == "/api/remote/live.jpg":              # v6.6 the FrameCast picture for the phone's drawing pad (PIN-protected)
            eng = VCAM.get("engine")
            if not eng:
                return self.reply(204, b"", "text/plain")
            eng.want_preview(3.0, sharp=True)           # 960 wide while the pad is open (640 otherwise)
            if not eng.preview_jpeg:                    # the camera is starting or off: the phone shows the stage instead
                return self.reply(204, b"", "text/plain")
            tag = '"p%d"' % eng.preview_ver
            if self.headers.get("If-None-Match") == tag:
                self.send_response(304)
                self.send_header("ETag", tag)
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
            return self.reply(200, eng.preview_jpeg, "image/jpeg", headers=[("ETag", tag)])
        if path.startswith("/api/scripture"):            # this PC only (the API key never leaves it)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            if path == "/api/scripture/settings":
                return self.reply(200, json.dumps(scripture_info()), TYPES[".json"])
            qs = parse_qs(url.query)
            try:
                res = scripture_lookup(qs.get("ref", [""])[0], qs.get("tr", ["ESV"])[0], fresh=qs.get("fresh", ["0"])[0] == "1")
                return self.reply(200, json.dumps(res), TYPES[".json"])
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
        if path == "/api/brand/logo":                    # v6.2 the leader's logo (PNG), for overlays, the camera and the remote
            if not BRAND_LOGO.exists():
                return self.reply(404, "No logo", "text/plain; charset=utf-8")
            return self.reply(200, BRAND_LOGO.read_bytes(), "image/png", [("Cache-Control", "private, max-age=31536000")])
        if path == "/api/present.mjpg":                 # Presentation window (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.present_stream()
        if path.startswith("/api/vcam/"):
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            if path == "/api/vcam/status":
                return self.reply(200, json.dumps(vcam_status(lite="lite=1" in url.query)), TYPES[".json"])
            if path == "/api/vcam/studio":
                return self.reply(200, json.dumps(studio_status()), TYPES[".json"])
            if path in ("/api/vcam/scene-thumb", "/api/vcam/stage.jpg"):
                comp = VCAM.get("compositor")
                if not comp:
                    return self.reply(404, "Not available", "text/plain; charset=utf-8")
                if path == "/api/vcam/scene-thumb":
                    f = SCENES_DIR / (Path(parse_qs(url.query).get("id", [""])[0]).name + ".jpg")
                    if not f.is_file():
                        return self.reply(404, "No thumbnail", "text/plain; charset=utf-8")
                    return self.reply(200, f.read_bytes(), "image/jpeg")
                import cv2 as _cv2
                eng = VCAM.get("engine")
                if eng:
                    eng.want_preview(3.0)                       # keep the camera running while editing
                layers = comp.staged if comp.staged is not None else comp.layers.layers
                ok, jpg = _cv2.imencode(".jpg", comp.render(layers, 640, 360), [_cv2.IMWRITE_JPEG_QUALITY, 75])
                return self.reply(200, jpg.tobytes(), "image/jpeg")
            if path == "/api/vcam/recordings":
                folder = recordings_dir()
                items = []
                if folder.is_dir():
                    for f in sorted(folder.glob("*.mp4"), key=lambda x: x.stat().st_mtime, reverse=True):
                        st_ = f.stat()
                        items.append({"name": f.name, "bytes": st_.st_size, "modified": st_.st_mtime})
                return self.reply(200, json.dumps({"folder": str(folder), "items": items}), TYPES[".json"])
            if path == "/api/vcam/preview.jpg":
                eng = VCAM["engine"]
                if not eng:
                    return self.reply(404, "Not available", "text/plain; charset=utf-8")
                eng.want_preview(3.0)                 # keeps the webcam on while the preview is open
                if not eng.preview_jpeg:
                    return self.reply(204, b"", "text/plain")
                tag = '"p%d"' % eng.preview_ver
                if self.headers.get("If-None-Match") == tag:          # the screen already has this picture
                    self.send_response(304)
                    self.send_header("ETag", tag)
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    return
                return self.reply(200, eng.preview_jpeg, "image/jpeg", headers=[("ETag", tag)])
            return self.reply(404, "Not found", "text/plain; charset=utf-8")
        if path.startswith("/api/cloud/"):
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                code, body = cloud_get(path[len("/api/cloud/"):], parse_qs(url.query))
            except cloud_link.CloudError as e:
                code, body = e.status or 502, e.as_dict()
            return self.reply(code, json.dumps(body), TYPES[".json"])
        if path == "/api/app/ping":
            return self.reply(200, json.dumps({"app": "FrameDecks", "version": APP_VERSION, "installedApp": FROZEN}), TYPES[".json"])
        if path == "/api/app/info":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            info = {"version": APP_VERSION, "installedApp": FROZEN, "desktop": DESKTOP["active"], "dataFolder": str(DATA),
                    "separateData": SEPARATE_DATA, "windows": os.name == "nt", "settings": app_settings(),
                    "lowGpuActive": bool(DESKTOP.get("low_gpu")), "shell": DESKTOP.get("shell", "browser"),
                    "chrome": bool(DESKTOP.get("chrome")), "hotkeys": dict(DESKTOP.get("hotkey_results") or {}),
                    "remote": {"enabled": REMOTE, "listening": sorted(remote_servers), "failed": list(remote_errors)},
                    "backups": list_backups()[:KEEP_BACKUPS], "migration": migration_status()}
            return self.reply(200, json.dumps(info), TYPES[".json"])
        if path == "/api/remote-info":
            port = self.server.server_address[1]
            info = {"enabled": REMOTE, "port": port, "now": time.time()}
            if REMOTE:
                ips = lan_addresses()
                info["pin"] = remote_pin()
                info["addresses"] = ips
                info["urls"] = [f"http://{ip}:{port}/remote.html" for ip in ips]
                # The PC opening its own network address is not an iPad (a test-only switch can count it)
                own = set() if os.environ.get("KC_TEST_COUNT_OWN_ADDRESS") == "1" else set(ips)
                info["devices"] = [{"ip": ip, "lastSeen": d["last"], "firstSeen": d["first"], "signedIn": d["signedIn"]}
                                   for ip, d in sorted(devices.items(), key=lambda kv: -kv[1]["last"]) if ip not in own]
                info["network"] = windows_network_check(60 if "fresh=1" in url.query else 900)
            return self.reply(200, json.dumps(info), TYPES[".json"])
        if path == "/api/remote-selftest":
            # Checks the PC is listening on its network address. It cannot see the phone or iPad's side,
            # so a pass here plus a failing iPad means the firewall or router is blocking it.
            port = self.server.server_address[1]
            results = []
            for ip in (lan_addresses() if REMOTE else []):
                try:
                    with socket.create_connection((ip, port), timeout=2):
                        results.append({"ip": ip, "ok": True})
                except OSError as e:
                    results.append({"ip": ip, "ok": False, "error": type(e).__name__})
            return self.reply(200, json.dumps({"enabled": REMOTE, "results": results}), TYPES[".json"])
        if path == "/api/diagnostics":
            return self.reply(200, json.dumps(diagnostics(self.server.server_address)), TYPES[".json"])
        if path == "/api/private":
            data = load_private()
            data["storedAt"] = str(PRIVATE_FILE)
            return self.reply(200, json.dumps(data), TYPES[".json"])
        if path == "/api/state":
            q = parse_qs(url.query)
            since = q.get("since", [None])[0]
            try:
                wait = min(25.0, max(1.0, float(q.get("wait", ["25"])[0])))
            except ValueError:
                wait = 25.0
            with cond:
                if since is not None:
                    # Long-poll: answer as soon as something changes (or after `wait` seconds, at most 25)
                    cond.wait_for(lambda: str(state.get("rev")) != since, timeout=wait)
                body = state_body(q.get("librev", [None])[0])
            return self.reply(200, body, TYPES[".json"])
        if path == "/api/rev":
            return self.reply(200, json.dumps({"rev": state.get("rev", 0)}), TYPES[".json"])
        if path == "/api/presence":
            now = time.time()
            counts = {}
            for key, (page, seen) in list(presence.items()):
                if now - seen > 12:
                    presence.pop(key, None)
                    continue
                counts[page] = counts.get(page, 0) + 1
            return self.reply(200, json.dumps(counts), TYPES[".json"])

        if path in ("", "/"):
            path = "/dashboard.html"
        target = (APP / path.lstrip("/")).resolve()
        if APP.resolve() in target.parents and target.is_file():
            return self.reply(200, target.read_bytes(), TYPES.get(target.suffix.lower(), "application/octet-stream"))
        self.reply(404, "Not found", "text/plain; charset=utf-8")

    def origin_ok(self):
        # Extra protection: requests made by other websites are refused
        origin = self.headers.get("Origin")
        if not origin:
            return True
        host = self.headers.get("Host", "")
        return origin in (f"http://{host}",)

    def present_stream(self):
        """The Presentation window's picture: a motion-JPEG stream of the final FrameCast frame.
        A frame is sent only when the picture changed (at most 30 per second), so a still slide costs
        almost nothing. Each frame is encoded here, not in the camera thread."""
        comp, eng = VCAM.get("compositor"), VCAM.get("engine")
        if not comp or not eng:
            return self.reply(404, "FrameCast is not available", "text/plain; charset=utf-8")
        import cv2 as _cv2
        from vcam.priority import lower_this_thread
        lower_this_thread()                          # picture encoding for the window: background priority
        fps = vcam_settings().get("presentFps", 15)
        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=kcframe")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        import select as _select, socket as _socket
        self.wfile.write(b"--kcframe\r\n")                # boundary first: each frame then ends with the next one,
        self.wfile.flush()                                   # so the browser shows it at once (even a still slide)
        pres = comp.present
        with comp.present_cond:
            pres["clients"] += 1
            pres["sig"] = None                    # send the current picture straight away
        last, t_last, repeat = -1, 0.0, None
        try:
            while True:
                eng.keep_awake(3.0)
                with comp.present_cond:
                    comp.present_cond.wait_for(lambda: pres["ver"] != last, timeout=0.12 if repeat else 1.0)
                    ver, frame = pres["ver"], pres["frame"]
                if (ver == last or frame is None) and repeat:
                    # Browsers show a stream frame once the next one begins: repeat the newest frame once,
                    # so a still picture (and the last frame of a transition) appears straight away.
                    self.wfile.write(repeat)
                    self.wfile.flush()
                    repeat = None
                    continue
                if ver == last or frame is None:
                    # nothing new: check the window is still there (a closed window must not keep the camera awake)
                    readable, _, _ = _select.select([self.connection], [], [], 0)
                    if readable and not self.connection.recv(1, _socket.MSG_PEEK):
                        break
                    continue
                gap = time.time() - t_last
                if gap < 1 / fps:                    # 15 per second by default: plenty for Zoom window sharing
                    time.sleep(1 / fps - gap)
                    with comp.present_cond:          # send the newest picture after the pause
                        ver, frame = pres["ver"], pres["frame"]
                ok, jpg = _cv2.imencode(".jpg", frame, [_cv2.IMWRITE_JPEG_QUALITY, 82])
                if not ok:
                    continue
                data = jpg.tobytes()
                part = b"Content-Type: image/jpeg\r\nContent-Length: " + str(len(data)).encode() + b"\r\n\r\n" + data + b"\r\n--kcframe\r\n"
                self.wfile.write(part)
                self.wfile.flush()
                repeat = part
                last, t_last = ver, time.time()
                pres["sent"] += 1
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            with comp.present_cond:
                pres["clients"] = max(0, pres["clients"] - 1)

    def upload_brand_logo(self):
        """v6.2 The leader's logo: a PNG made by the dashboard (PNG, JPG and SVG are converted there). ?remove=1 deletes it."""
        if not self.is_local():
            return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
        if parse_qs(urlparse(self.path).query).get("remove", ["0"])[0] == "1":
            BRAND_LOGO.unlink(missing_ok=True)
            return self.reply(200, json.dumps({"logo": "", "w": 0, "h": 0}), TYPES[".json"])
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > 8 * 1024 * 1024:
            return self.reply(400, json.dumps({"error": "The logo must be smaller than 8 MB."}), TYPES[".json"])
        data = self.rfile.read(length)
        info = png_size(data)
        if not info:
            return self.reply(400, json.dumps({"error": "That is not a picture FrameDecks can use. Choose a PNG, JPG or SVG file."}), TYPES[".json"])
        tmp = BRAND_LOGO.with_suffix(".part")
        tmp.write_bytes(data)
        os.replace(tmp, BRAND_LOGO)
        return self.reply(200, json.dumps({"logo": hashlib.sha1(data).hexdigest()[:12], "w": info[0], "h": info[1]}), TYPES[".json"])

    def upload_layer_file(self):
        """A picture, video or PDF for a layer, copied into the data folder's layers folder (this PC only)."""
        if not self.is_local():
            return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
        name = Path(parse_qs(urlparse(self.path).query).get("name", ["file"])[0]).name
        stem, ext = os.path.splitext(name)
        if ext.lower() not in (".png", ".jpg", ".jpeg", ".mp4", ".mov", ".webm", ".pdf", ".pptx", ".ppt"):
            return self.reply(400, json.dumps({"error": "Use PNG, JPG, MP4, MOV, WebM, PDF or PowerPoint (PPTX)."}), TYPES[".json"])
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > 1024 * 1024 * 1024:
            return self.reply(400, json.dumps({"error": "The file must be smaller than 1 GB."}), TYPES[".json"])
        LAYERS_DIR.mkdir(parents=True, exist_ok=True)
        safe = re.sub(r"[^\w\- ]+", "", stem)[:60].strip() or "file"
        target = LAYERS_DIR / (safe + ext.lower())
        n = 2
        while target.exists():
            target = LAYERS_DIR / f"{safe} ({n}){ext.lower()}"
            n += 1
        tmp = target.with_suffix(target.suffix + ".part")
        left = length
        with open(tmp, "wb") as f:
            while left > 0:
                chunk = self.rfile.read(min(1 << 20, left))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)
        if left:
            tmp.unlink(missing_ok=True)
            return self.reply(400, json.dumps({"error": "The upload was interrupted."}), TYPES[".json"])
        tmp.replace(target)
        if target.suffix in (".pptx", ".ppt"):         # v6.5 PowerPoint: slides made by the PowerPoint on this PC
            from vcam.powerpoint import pptx_to_pdf
            pdf, n = target.with_suffix(".pdf"), 2
            while pdf.exists():
                pdf = target.with_name(f"{target.stem} ({n}).pdf")
                n += 1
            err = pptx_to_pdf(target.resolve(), pdf.resolve())
            if err or not pdf.is_file():
                return self.reply(400, json.dumps({"error": err or "PowerPoint did not save the slides."}), TYPES[".json"])
            return self.reply(200, json.dumps({"file": pdf.name, "source": target.name}), TYPES[".json"])
        return self.reply(200, json.dumps({"file": target.name}), TYPES[".json"])

    def app_action(self, action, data):
        ok = lambda obj: self.reply(200, json.dumps(obj), TYPES[".json"])
        bad = lambda msg, code=400: self.reply(code, json.dumps({"error": msg}), TYPES[".json"])
        if action == "present":
            # A separate, frameless "FrameDecks Share Window" window (selectable in Zoom > Share > specific window).
            hook, fs = DESKTOP.get("present"), DESKTOP.get("present_fullscreen")
            if not hook:
                return ok({"desktop": False})    # browser: the page opens its own popup window
            if data.get("query"):
                state_fn = DESKTOP.get("present_fs_state")
                return ok({"desktop": True, "fullscreen": bool(state_fn()) if state_fn else False})
            if "fullscreen" in data:
                want = None if data["fullscreen"] == "toggle" else bool(data["fullscreen"])
                return ok({"desktop": True, "fullscreen": bool(fs(want)) if fs else False})
            hook(bool(data.get("on", True)))
            return ok({"desktop": True, "open": bool(data.get("on", True))})
        if action == "speaker":
            # v6.6 Speaker View: its own window in the desktop app (the browser opens a pop-up itself)
            hook = DESKTOP.get("speaker")
            if not hook:
                return ok({"desktop": False})
            hook()
            return ok({"desktop": True})
        if action == "window":
            # v6.4 native window: the page says whether it is dark or light; the title bar follows
            hook = DESKTOP.get("window_theme")
            return ok({"styled": bool(hook(data.get("theme") != "light")) if hook else False})
        if action == "remote":
            res = set_remote(bool(data.get("enabled")))
            return ok(res)
        if action == "settings":
            return ok(save_app_settings(data))
        if action == "backup-now":
            name = backup_now(time.strftime("%H%M%S"))
            return ok({"backup": name, "backups": list_backups()}) if name else bad("There is nothing to back up yet.")
        if action == "open-folder":
            target = {"backups": BACKUP_DIR, "recordings": recordings_dir(), "layers": LAYERS_DIR}.get(data.get("which"), DATA)
            target.mkdir(parents=True, exist_ok=True)
            return ok({"opened": open_folder(target), "folder": str(target)})
        if action == "import":
            try:
                return ok({"imported": import_from(str(data.get("folder") or ""))})
            except ValueError as e:
                return bad(str(e))
        if action == "skip-import":
            return ok(save_app_settings({"importDecided": True}))
        if action == "candidates":
            return ok({"candidates": migration_candidates()})
        if action == "choose-folder":
            fn = DESKTOP.get("choose_folder")
            if not fn:
                return bad("Folder picker not available here. Type the folder path instead.", 501)
            return ok({"folder": fn()})
        if action == "open-external":
            return ok({"opened": open_external(str(data.get("url") or ""))})
        if action == "firewall":
            done, msg = firewall("undo" if data.get("action") == "undo" else "allow")
            return ok({"ok": done, "message": msg})
        if action == "win":
            # 6.8 the page's own window buttons and ribbon: {win: main/teleprompter/overlay/spotlight, op: minimize,
            # toggle-max, close, drag, hide, on-top (value), look (mode, frost, fade)}
            hook = DESKTOP.get("win")
            if not hook:
                return ok({"desktop": False})
            return ok(dict(hook(str(data.get("win") or "main"), str(data.get("op") or ""), data) or {}, desktop=True))
        if action == "overlay":
            # 6.8 the Teleprompter overlay (Meeting Leader mode): a see-through window above Zoom and Teams
            hook = DESKTOP.get("overlay")
            if not hook:
                return ok({"desktop": False})
            return ok({"desktop": True, "open": bool(hook(data.get("on", "toggle")))})
        if action == "spotlight":
            hook = DESKTOP.get("spotlight")
            if not hook:
                return ok({"desktop": False})
            hook(data.get("on", True))
            return ok({"desktop": True})
        if action == "palette-index":
            # Spotlight asks the main window for everything it can find (the main window keeps running in the tray)
            hook = DESKTOP.get("palette_index")
            return ok({"items": hook() if hook else []})
        if action == "palette-run":
            hook = DESKTOP.get("palette_run")
            if not hook:
                return bad("Only available in the installed app.", 501)
            threading.Thread(target=hook, args=(str(data.get("key") or ""), bool(data.get("bg"))), daemon=True).start()
            return ok({"ok": True})
        if action in ("show", "hide", "quit"):
            fn = DESKTOP.get(action)
            if not fn:
                return bad("Only available in the installed app.", 501)
            threading.Thread(target=fn, daemon=True).start()
            return ok({"ok": True})
        return bad("Unknown action", 404)

    def do_POST(self):
        count_request(urlparse(self.path).path)
        if not self.host_ok() or not self.origin_ok():
            return self.reply(403, "Forbidden", "text/plain; charset=utf-8")
        if urlparse(self.path).path == "/api/vcam/upload":
            return self.upload_layer_file()
        if urlparse(self.path).path == "/api/brand/logo":
            return self.upload_brand_logo()
        path = urlparse(self.path).path
        if not self.allowed(path):
            return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
        try:
            data = self.read_json()
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, "Invalid data", "text/plain; charset=utf-8")
        if path == "/api/remote-login":
            return self.remote_login(data)
        if path == "/api/meeting/workbook":
            # 6.9 Export this meeting to Excel: the template's Dashboard and Meeting Form, with this meeting filled in
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                meeting, tables = meeting_form.from_sheets(data if isinstance(data, dict) else {})
                body = meeting_form.fill((APP / "templates" / "FrameDecks-Meeting-Workbook.xlsx").read_bytes(), meeting, tables)
            except (OSError, ValueError, KeyError, TypeError) as e:
                return self.reply(422, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, body, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        if path == "/api/scripture/settings":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            d = data if isinstance(data, dict) else {}
            cur = scripture_settings()
            if "key" in d:
                cur["key"] = re.sub(r"[^A-Za-z0-9]", "", str(d.get("key") or ""))[:200]
            if d.get("translation") in ("ESV", "typed"):
                cur["translation"] = d["translation"]
            SCRIPTURE_FILE.write_text(json.dumps(cur), encoding="utf-8")
            if d.get("clearCache"):
                with _scr_lock:
                    try:
                        SCRIPTURE_CACHE.unlink()
                    except OSError:
                        pass
            if d.get("test"):
                try:
                    scripture_lookup("John 3:16", "ESV", fresh=True)
                except ValueError as e:
                    return self.reply(200, json.dumps(dict(scripture_info(), test=str(e))), TYPES[".json"])
                return self.reply(200, json.dumps(dict(scripture_info(), test="ok")), TYPES[".json"])
            return self.reply(200, json.dumps(scripture_info()), TYPES[".json"])
        if path.startswith("/api/vcam/"):
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            if path == "/api/vcam/settings" and isinstance(data, dict) and (data.get("session") or data.get("saveBlurDefault")):
                # Blur: try a strength live (not saved), or save the current strength as the default
                cur = vcam_settings()
                if data.get("saveBlurDefault"):
                    n = VCAM.get("blurSession")
                    n = cur["blurStrength"] if n is None else n
                    cur["blurStrength"] = n
                    cur["blur"] = "off" if n == 0 else ("light" if n <= 45 else "strong")   # for older versions
                    vcam_save(cur)
                    VCAM["blurSession"] = None
                else:
                    c = clean_vcam({"blurStrength": data.get("blurStrength")})
                    if "blurStrength" in c:
                        VCAM["blurSession"] = c["blurStrength"]
                eng = VCAM["engine"]
                if eng:
                    eng.configure(**vcam_effective(cur))
                return self.reply(200, json.dumps(vcam_status()), TYPES[".json"])
            if path == "/api/vcam/settings" and isinstance(data, dict):
                try:
                    changes = vcam_apply_changes(data)
                except ValueError as e:
                    return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
                cur = vcam_settings()
                cur.update(changes)
                vcam_save(cur)
                eng = VCAM["engine"]
                VCAM["cardsOn"] = cur["cards"]
                regrade = "look" in changes or "filterIntensity" in changes
                if eng:
                    eng.configure(**vcam_effective(cur), **({"grade": vcam_grade(cur["look"], cur.get("filterIntensity", 100))} if regrade else {}))
                    if "enabled" in changes:
                        (eng.start if changes["enabled"] else eng.stop)()
                return self.reply(200, json.dumps(vcam_status()), TYPES[".json"])
            if path == "/api/vcam/studio":
                try:
                    return self.reply(200, json.dumps({"ok": True, **(studio_action(data) or {}), "studio": studio_status()}), TYPES[".json"])
                except (ValueError, RuntimeError, OSError) as e:
                    return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            if path == "/api/vcam/recordings":
                folder = recordings_dir()
                op = data.get("op")
                if op == "folder":
                    folder.mkdir(parents=True, exist_ok=True)
                    return self.reply(200, json.dumps({"opened": open_folder(folder)}), TYPES[".json"])
                f = folder / Path(str(data.get("name") or "")).name          # only files inside the recordings folder
                if f.suffix.lower() != ".mp4" or not f.is_file():
                    return self.reply(404, json.dumps({"error": "Recording not found"}), TYPES[".json"])
                if op == "open":
                    return self.reply(200, json.dumps({"opened": open_folder(f)}), TYPES[".json"])
                if op == "delete":
                    f.unlink()
                    return self.reply(200, json.dumps({"deleted": f.name}), TYPES[".json"])
                return self.reply(400, json.dumps({"error": "Unknown action"}), TYPES[".json"])
            if path == "/api/vcam/install":
                done, msg = vcam_install("uninstall" if data.get("action") == "uninstall" else "install")
                return self.reply(200, json.dumps({"ok": done, "message": msg, **vcam_status()}), TYPES[".json"])
            return self.reply(404, "Not found", "text/plain; charset=utf-8")
        if path == "/api/remote/studio":                 # switch scene / next-previous slide from the remote
            try:
                res = remote_studio_action(data if isinstance(data, dict) else {})
                return self.reply(200, json.dumps({"ok": True, **res, "studio": remote_studio_info()}), TYPES[".json"])
            except (ValueError, RuntimeError) as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
        if path.startswith("/api/cloud/"):
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                code, body = cloud_post(path[len("/api/cloud/"):], data)
            except cloud_link.CloudError as e:
                code, body = e.status or 502, e.as_dict()
            return self.reply(code, json.dumps(body), TYPES[".json"])
        if path.startswith("/api/app/"):
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.app_action(path[len("/api/app/"):], data if isinstance(data, dict) else {})
        if path == "/api/remote-reset":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            with sessions_lock:
                sessions.clear()
                save_sessions()
            try:
                PIN_FILE.unlink()
            except OSError:
                pass
            return self.reply(200, json.dumps({"pin": remote_pin() if REMOTE else None}), TYPES[".json"])
        if path == "/api/remote-logout":
            token = re.search(COOKIE + r"=([A-Za-z0-9_\-]{20,100})", self.headers.get("Cookie", ""))
            if token:
                with sessions_lock:
                    sessions.pop(token.group(1), None)
                    save_sessions()
            return self.reply(200, json.dumps({"ok": True}), TYPES[".json"], [("Set-Cookie", f"{COOKIE}=; Path=/; Max-Age=0")])
        if path == "/api/state":
            if not isinstance(data, dict):
                return self.reply(400, "Invalid data", "text/plain; charset=utf-8")
            data.pop("rev", None)
            base = data.pop("baseRev", None)
            keep = data.pop("keepLibrary", False) is True
            with cond:
                # Two devices changed things at the same moment: send back the latest so it can redo its change
                if base is not None and str(base) != str(state.get("rev", 0)):
                    return self.reply(409, state_body(), TYPES[".json"])
                if keep:                                   # "library unchanged": only valid on top of the latest state
                    if base is None:
                        return self.reply(409, state_body(), TYPES[".json"])
                    data["library"] = state.get("library")
                save_state(data)
                return self.reply(200, state_body(LIBRARY["rev"] if keep else None), TYPES[".json"])
        if path == "/api/private":
            if not isinstance(data, dict) or not isinstance(data.get("members", []), list):
                return self.reply(400, "Invalid data", "text/plain; charset=utf-8")
            data.pop("storedAt", None)
            save_private(data)
            return self.reply(204, b"", "text/plain")
        if path == "/api/presence":
            if isinstance(data, dict) and isinstance(data.get("id"), str):
                presence[data["id"][:40]] = (str(data.get("page", ""))[:20], time.time())
            return self.reply(204, b"", "text/plain")
        self.reply(404, "Not found", "text/plain; charset=utf-8")


class RelayHandler(Handler):
    """Requests carried by the cloud relay (relay_link.py). Always a phone on the Wi-Fi, never this PC: the remote's
    allow-list, the PIN and its lock-out (per relay connection) apply exactly as on the Wi-Fi."""

    def parse_request(self):
        ok = super().parse_request()
        if ok:                                          # one relay connection = one "device address" for the PIN lock-out
            self.client_address = ("relay:" + re.sub(r"[^A-Za-z0-9_-]", "", self.headers.get("X-FD-Relay-From", ""))[:64], 0)
        return ok

    def is_local(self):
        return False

    def host_ok(self):
        return True

    def allowed(self, path):
        if not relay_enabled():
            return False
        if path in REMOTE_PUBLIC or path.startswith("/fonts/"):
            return True
        return path in REMOTE_SIGNED_IN and self.signed_in()


def start_main_server():
    """Start listening on this PC only. Returns the server (or None if every port is taken)."""
    for port in PORTS:
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    else:
        return None
    server.daemon_threads = True
    MAIN["server"], MAIN["port"] = server, server.server_address[1]
    threading.Thread(target=vcam_start, daemon=True).start()   # idle until Zoom/Teams uses FrameCast
    threading.Thread(target=_backup_loop, daemon=True).start()
    threading.Thread(target=_remote_watcher, daemon=True).start()
    if relay_enabled():
        threading.Thread(target=relay_start, daemon=True).start()
    return server


def main():
    server = start_main_server()
    if server is None:
        print("Ports 8750-8760 are all in use. Close the other program using them and try again.")
        sys.exit(1)
    port = server.server_address[1]
    if REMOTE or app_settings()["remoteAutostart"]:
        set_remote(True)
    base = f"http://localhost:{port}"
    print()
    print("  FrameDecks is running.")
    print()
    print(f"  Dashboard (opens automatically):  {base}/")
    print(f"  Focus Verse overlay:          {base}/focus-verse.html")
    print(f"  Discussion Question overlay: {base}/discussion-question.html")
    print(f"  Birthday Celebration overlay:     {base}/birthday.html")
    print(f"  All overlays in one page:         {base}/stage.html")
    if port != PREFERRED_PORT:
        print()
        print(f"  NOTE: port {PREFERRED_PORT} was busy, so {port} is being used today.")
        print("  Update the overlay links in OBS/Camo, or close the other program and restart.")
    if REMOTE:
        print()
        print("  PHONE REMOTE is ON. On your phone or iPad (same Wi-Fi), open:")
        for ip in lan_addresses() or ["<this PC's IP address>"]:
            print(f"      http://{ip}:{port}/remote.html")
        print(f"  PIN: {remote_pin()}")
        print("  If Windows asks about network access, allow it on PRIVATE networks only.")
        print("  When the phone or iPad connects, a line saying \"Connection from ...\" appears below.")
        print("  If nothing appears when the phone or iPad tries, the connection is being blocked")
        print("  before it reaches this PC: run \"Allow iPad Remote - run once.bat\".")
    else:
        print()
        print("  Phone remote: off. Turn it on any time in Settings > Phone & iPad Remote.")
    print()
    print("  Keep this window open during your meeting. Close it to stop.")
    print()
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(base + "/")).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        set_remote(False)
        server.server_close()


if __name__ == "__main__":
    main()
