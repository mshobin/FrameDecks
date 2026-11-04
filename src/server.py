#!/usr/bin/env python3
"""
FrameDecks - local program.

Serves the dashboard and overlays at http://localhost:8750 on THIS computer only.
No internet, cloud account, or extra installs are needed beyond Python 3
(standard library only). Your content is saved in "kc-saved-content.json".

Windows: double-click "tools/launchers/Start FrameDecks.bat"
         or "tools/launchers/Start FrameDecks with Phone Remote.bat" (adds the phone remote)
Mac:     double-click "tools/launchers/Start FrameDecks (Mac).command"
         (for the phone remote: python3 src/server.py --remote)
"""
from errlog import swallowed as _swallowed  # noqa: E402
import atexit
import base64
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

import sync_entities   # what is live and what is plan (the same split as sync)
import cloud_remote   # Phase 5: running a service from the companion (only when linked and switched on)
import cloud_sync   # Phase 4: syncing service plans with a workspace (only when this PC is linked)
import ai           # M-D3: optional AI, free by default (Ollama on this PC); hidden when none answers
import legacy   # 6.9: moves data saved under the program's earlier name
import winapi   # 7.1.1: Windows jobs through Windows' own interfaces (no PowerShell, netsh or taskkill)
import meeting_form   # 6.9: fills the Meeting Workbook's form for Export
import updater   # 7.0: updates from FrameDecks servers (checked, silent, with rollback)
from media_names import safe_name   # 9.1.2 media file names are never paths
import memory    # 9.0: Memory Cards in the FrameDecks vCam chat overlay (docs/architecture/memory-cards.md)

APP_VERSION = "9.10.1"
STARTED_AT = time.time()
FROZEN = getattr(sys, "frozen", False)          # True inside the installed Windows app
HERE = Path(sys.executable).resolve().parent if FROZEN else Path(__file__).resolve().parent.parent   # the repository root (this file is in src/)
RES = Path(getattr(sys, "_MEIPASS", HERE))       # where the app's pages are bundled
APP = RES / "app"
SRC = HERE / "src"                               # the Python modules and the vcam/ package (development only)
if not FROZEN and str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


def _data_dir():
    """Installed app: %APPDATA%\\FRAMEDECKS. Script/zip version: in the repository folder (as before).
    6.9: data saved under the program's earlier name is moved here first (src/legacy.py), so nothing is lost."""
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
                 "/js/teleprompter.js", "/css/teleprompter.css", "/js/remote-memory.js",
                 "/remote-manifest.json", "/icons/remote-180.png", "/icons/remote-192.png", "/icons/remote-512.png",
                 "/icons/favicon-16.png", "/icons/favicon-32.png",
                 "/icons/remote-maskable-512.png", "/img/framedecks-emblem.webp"}
REMOTE_SIGNED_IN = {"/api/rev", "/api/state", "/api/remote-logout", "/js/overlay.js", "/api/remote/studio", "/api/brand/logo", "/api/remote/live.jpg",
                    "/api/remote/memory", "/api/pointer",
                    "/css/overlay.css", "/stage.html", "/focus-verse.html", "/discussion-question.html", "/birthday.html"}
sessions_lock = threading.Lock()
failures = {}  # ip -> [count, locked_until]  (9.1.2: count keeps growing until a right PIN; the wait doubles)
login_lock = threading.Lock()   # 9.1.2 one PIN check at a time: parallel guesses cannot slip past the lockout
login_recent = []               # 9.1.2 times of wrong PINs from any device (the limit for all devices together)
MAX_LOGIN_FAILS = 100           # wrong PINs from all devices in 10 minutes before everyone waits (slows a many-address attack)
MAX_PUBLIC_BODY = 4096          # 9.1.2 a request from a device that has not signed in (the PIN form) is small
MAX_CONN_PER_IP = 24            # 9.1.2 open connections one other device may hold (the remote uses about 4)
conn_lock = threading.Lock()
conn_count = {}                 # ip -> open connections (other devices only)


def write_atomic(path, text):
    """9.1.2 Write a settings file so a power cut or a full disk never leaves it empty or half written: a temporary
    file next to it, flushed to disk, then swapped in."""
    path = Path(path)
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)
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
    write_atomic(PIN_FILE, pin + "\n")
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
        write_atomic(SESSIONS_FILE, json.dumps(sessions))
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


# What happened at start-up if the saved plan could not be read (production audit H1): shown in Diagnostics, and a
# linked PC then restores the plan from its workspace instead of sending deletions for every Frame.
PLAN_RECOVERY = {}


def _read_plan(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("not a saved plan")
    data["rev"] = int(data.get("rev", 1) or 1)
    return data


def load_state():
    if not STATE_FILE.exists():
        return {"rev": 0}  # a first start: the pages fill in defaults and sample content
    problem = None
    for attempt in range(5):                            # a file held for a moment (antivirus, backup) is not damaged
        try:
            return _read_plan(STATE_FILE)
        except OSError as e:
            problem = e
            time.sleep(0.2)
        except (ValueError, TypeError) as e:
            problem = e
            break
    # Damaged or unreadable: keep it aside (never overwrite it), then take the newest daily backup that reads
    stamp = time.strftime("%Y%m%d-%H%M%S")
    aside = STATE_FILE.with_name(f"{STATE_FILE.name}.damaged-{stamp}")
    try:
        os.replace(STATE_FILE, aside)
    except OSError:
        aside = None
    PLAN_RECOVERY.update(at=stamp, problem=f"{type(problem).__name__}: {problem}", keptAs=aside.name if aside else None,
                         restoredFrom=None)
    try:
        folders = sorted((d for d in BACKUP_DIR.iterdir() if d.is_dir()), key=lambda d: d.stat().st_mtime, reverse=True)
    except OSError:
        folders = []
    for folder in folders:
        try:
            data = _read_plan(folder / STATE_FILE.name)
        except (OSError, ValueError, TypeError):
            continue
        PLAN_RECOVERY["restoredFrom"] = folder.name
        try:                                            # a readable plan file again at once
            tmp = STATE_FILE.with_suffix(".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, STATE_FILE)
        except OSError:
            pass
        print(f"  The saved plan could not be read ({PLAN_RECOVERY['problem']}). It was kept as "
              f"{PLAN_RECOVERY['keptAs']} and the plan was restored from the backup {folder.name}.", flush=True)
        return data
    print(f"  The saved plan could not be read ({PLAN_RECOVERY['problem']}) and no backup could be read. It was kept "
          f"as {PLAN_RECOVERY['keptAs']}; FrameDecks starts with a new plan.", flush=True)
    return {"rev": 0}


state = load_state()
# Revision at which the question/verse library last changed. Screens that already have that library can leave it
# out of what they send and receive (a big imported library made every Show/Next tap from the phone slow).
LIBRARY = {"rev": int(state.get("rev", 0) or 0)}


# 9.3 (production audit M10): every device waiting on /api/state used to turn the whole state into JSON again when it
# changed, inside the lock. save_state replaces the state object (never changes it in place), so the JSON is made once
# per state and kept for the next asker; the two forms (with and without the library) are kept separately.
_STATE_JSON = {}
_STATE_JSON_LOCK = threading.Lock()


def state_body(lib_rev=None, snap=None):
    """The state as JSON; without the library when the asker already has this library (lib_rev matches).
    snap: (state, library rev) taken under cond, so the JSON can be made after the lock is let go."""
    st, lrev = snap if snap is not None else (state, LIBRARY["rev"])
    omit = lib_rev is not None and str(lib_rev) == str(lrev)
    with _STATE_JSON_LOCK:
        hit = _STATE_JSON.get(omit)
        if hit is not None and hit[0] is st and hit[1] == lrev:
            return hit[2]
    if omit:
        out = {k: v for k, v in st.items() if k != "library"}
        out.update(libraryRev=lrev, libraryOmitted=True)
    else:
        out = dict(st, libraryRev=lrev)
    body = json.dumps(out)
    with _STATE_JSON_LOCK:
        _STATE_JSON[omit] = (st, lrev, body)
    return body


# Saving (architecture audit P1, P2): a change to the plan is written at once. A change to what is live only (Next,
# Show/Hide, blackout) is written at most once a second: during a service that is most presses, and each one used
# to rewrite the whole plan with its library. Live state never syncs, so it no longer starts a sync round either.
LIVE_WRITE_DELAY = 1.0
DISK = {"plan": None, "dirty": False, "timer": None}


def plan_fingerprint(st):
    """The saved state without what is live (as sync_entities.split leaves out) and without the library, which
    save_state compares on its own: equal text = same plan. Not key-sorted (cheaper): a different key order only
    makes a change count as a plan change, which is written at once - never the other way round."""
    out = {}
    for k, v in st.items():
        if k in ("rev", "live", "library", "libraryRev", "libraryOmitted"):
            continue
        if k in sync_entities.CARD_LIVE and isinstance(v, dict):
            v = {kk: vv for kk, vv in v.items() if kk not in sync_entities.CARD_LIVE[k]}
        out[k] = v
    return json.dumps(out, ensure_ascii=False)


def _write_state_file():
    """Write the current state now (call with cond held). Compact JSON: the C encoder, several times faster."""
    t = DISK.get("timer")
    if t:
        t.cancel()
    DISK.update(dirty=False, timer=None)
    tmp = STATE_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:   # on disk before it replaces the old file (power cut, audit L2)
        f.write(json.dumps(state, ensure_ascii=False))
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, STATE_FILE)


def flush_state():
    """Write a pending live-only change now (before quitting, a backup or an import)."""
    with cond:
        if DISK["dirty"]:
            _write_state_file()


def _write_later():
    with cond:
        if DISK["dirty"]:
            _write_state_file()


def save_state(new):
    global state
    with cond:
        new.pop("libraryRev", None)
        new.pop("libraryOmitted", None)
        new["rev"] = int(state.get("rev", 0)) + 1
        mem_before = (state.get("live") or {}).get("memory")
        mem_after = (new.get("live") or {}).get("memory")
        library_changed = new.get("library") != state.get("library")
        if library_changed:
            LIBRARY["rev"] = new["rev"]
        state = new
        plan = plan_fingerprint(state)
        plan_changed = library_changed or plan != DISK["plan"]
        DISK["plan"] = plan
        if plan_changed:
            _write_state_file()
        else:
            DISK["dirty"] = True
            if DISK["timer"] is None:
                DISK["timer"] = threading.Timer(LIVE_WRITE_DELAY, _write_later)
                DISK["timer"].daemon = True
                DISK["timer"].start()
        cond.notify_all()
        if mem_before != mem_after and "MEMORY" in globals():
            if mem_before and not mem_after and not _MEM.get("syncing"):
                MEMORY.hide_all()          # Hide all / Esc in the Studio emptied the chat overlay
            else:
                MEMORY.touch()
        eng = VCAM.get("engine") if "VCAM" in globals() else None
        if eng:
            eng.kick()                     # a card was shown/hidden: draw it now, even in the idle rhythm
        if "VCAM" in globals():
            apply_live_media(state)
        if plan_changed and "SYNC" in globals():
            SYNC.poke()                    # linked to a workspace: send this change after a few quiet seconds
        if "CLOUD_REMOTE" in globals():
            CLOUD_REMOTE.changed()         # the companion's Live page shows the new screen soon
        return state


atexit.register(flush_state)
DISK["plan"] = plan_fingerprint(state)                    # the plan as loaded: a first live press is not a plan change


# ---------- v6 Scenes: the live scene's media layers are the FrameDecks picture ----------
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
    out = []
    for l in reversed([l for l in sc.get("layers") or [] if isinstance(l, dict)]):
        if l.get("kind") not in MEDIA_KINDS:
            continue
        c = dict(l.get("c") or {})
        c.pop("vcam", None)
        c.pop("obs", None)
        if l["kind"] in ("image", "video", "pdf", "audio") and "file" in c:
            c["file"] = safe_name(c.get("file"))         # 9.1.2: a file name, never a path
        if l["kind"] in ("image", "video", "pdf") and not c.get("file"):
            continue                                   # not chosen yet (or not a plain name): nothing to draw
        if l["kind"] == "window" and c.get("hwnd") is None:
            continue
        c.update(id=str(l.get("id") or ""), name=l.get("name") or l["kind"], type=l["kind"],
                 visible=l.get("visible", True) is not False, locked=bool(l.get("locked")), opacity=l.get("opacity", 1))
        out.append(c)
    return out


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
        print("FrameDecks: could not apply the scene:", e)


def update_state(change):
    """Change the live state from inside the program (e.g. the tray's Hide all). Every screen picks it up."""
    with cond:                     # 9.3 (audit L2): read, change and save in one hold of the lock, so a phone's Next
        new = change(json.loads(json.dumps(state)))     # in between is never written over (cond's lock is re-entrant)
        return save_state(new)


# ---------- 9.0 Memory Cards in the FrameDecks vCam chat overlay (docs/architecture/memory-cards.md) ----------
MEMORY = memory.Memory(DATA / "kc-memory.json")
_MEM = {"watcher": None, "timer": None, "lock": threading.Lock(), "syncing": False}


def _on_copy(text, exe, url):
    status, item = MEMORY.add(text, exe=exe, url=url, show=app_settings()["memAuto"])
    if status == "added":
        memory_sync()
        hook = DESKTOP.get("memory_popup")               # the small card in the screen corner (installed app)
        if hook:
            try:
                hook(True)
            except Exception as _e:
                _swallowed("server._on_copy", _e)


def memory_capture(on):
    """Capture on/off: the clipboard listener runs only while it is on. Returns whether copies are being watched."""
    with _MEM["lock"]:
        w = _MEM["watcher"]
        if on:
            if w is None:
                import capture
                w = _MEM["watcher"] = capture.ClipboardWatcher(_on_copy)
            watching = w.start()
        else:
            if w is not None:
                w.stop()
            watching = False
    MEMORY.set_capture(on)
    return watching


def memory_view():
    """What live.memory holds: the cards in the chat overlay and how it is laid out (None = the overlay is empty)."""
    cfg = app_settings()
    cards, nxt = MEMORY.overlay(cfg["memDur"])
    view = {"cards": cards, "layout": cfg["memLayout"], "side": cfg["memSide"], "share": cfg["memShare"]} if cards else None
    return view, nxt


def memory_sync():
    """Put the overlay's cards into the state (every screen and FrameDecks vCam follow) and set the timer for the next
    unpinned card to leave."""
    view, nxt = memory_view()
    if (state.get("live") or {}).get("memory") != view:
        def change(st):
            live = st.setdefault("live", {})
            if view:
                live["memory"] = view
            else:
                live.pop("memory", None)
            return st
        _MEM["syncing"] = True
        try:
            update_state(change)
        finally:
            _MEM["syncing"] = False
    with _MEM["lock"]:
        if _MEM["timer"]:
            _MEM["timer"].cancel()
        _MEM["timer"] = None
        if nxt is not None:
            t = _MEM["timer"] = threading.Timer(max(0.05, nxt + 0.05), memory_sync)
            t.daemon = True
            t.start()


# 9.3 (production audit M7): a Content-Security-Policy for the program's pages. Scripts only from this PC, plus each
# page's own inline script by its hash (worked out from the page as it is sent, so editing a page needs no list); no
# plug-ins, no other site may frame a page, nothing is fetched from elsewhere. Styles stay open to inline style=""
# (many elements are placed that way). Report-only for now: a page that breaks a rule still works and the browser
# console names the rule; tests/visual/csp.mjs checks every page reports nothing. Switch CSP_HEADER to
# "Content-Security-Policy" to enforce it.
CSP_HEADER = "Content-Security-Policy-Report-Only"
CSP_BASE = ("default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
            "media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; "
            "frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'")
_INLINE_SCRIPT = re.compile(rb"<script>(.*?)</script>", re.S)


def page_csp(html):
    """The policy for one page: CSP_BASE with script-src naming the page's inline scripts by SHA-256."""
    hashes = "".join(" 'sha256-" + base64.b64encode(hashlib.sha256(m.group(1)).digest()).decode("ascii") + "'"
                     for m in _INLINE_SCRIPT.finditer(html))
    return f"{CSP_BASE}; script-src 'self'{hashes}"


REMOTE_MEMORY_ACTIONS = ("add", "show", "showmany", "pin", "hide", "hideall", "delete")   # 9.1 from the phone remote


# ---------- 9.4 the follow Spotlight: a lens that follows the pointer (or a finger on the phone) in real time ----------
# Moves are many a second, so they never go through the saved state (which every screen would re-read): they live
# here, the camera reads them every frame, and the overlay pages wait for them (GET /api/pointer, a long-poll) only
# while live.follow is on. A lens nobody has moved for POINTER_IDLE seconds fades by itself (a phone put away).
POINTER = {"seq": 0, "on": False, "x": 0.5, "y": 0.5, "at": 0.0, "c": "#ffffff", "size": 1.4, "k": 60}
pointer_cond = threading.Condition()
POINTER_IDLE = 6.0


def pointer_now():
    with pointer_cond:
        p = dict(POINTER)
    if p["on"] and time.time() - p["at"] > POINTER_IDLE:
        p["on"] = False
    return p


def _num(v, lo, hi, default):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    return default if f != f else max(lo, min(hi, f))


def pointer_set(d):
    """POST /api/pointer {on, x, y, c?, size?, k?}: move (or lift) the follow Spotlight."""
    if not isinstance(d, dict):
        raise ValueError("Invalid data")
    on = d.get("on") is True
    with pointer_cond:
        was = POINTER["on"] and time.time() - POINTER["at"] <= POINTER_IDLE
        if on:
            POINTER["x"] = _num(d.get("x"), 0.0, 1.0, POINTER["x"])
            POINTER["y"] = _num(d.get("y"), 0.0, 1.0, POINTER["y"])
            c = str(d.get("c") or "")
            if re.fullmatch(r"#[0-9a-fA-F]{6}", c):
                POINTER["c"] = c.lower()
            POINTER["size"] = _num(d.get("size"), 0.5, 3.0, POINTER["size"])
            POINTER["k"] = _num(d.get("k"), 10, 100, POINTER["k"])
        POINTER["on"] = on
        POINTER["seq"] += 1
        POINTER["at"] = time.time()
        pointer_cond.notify_all()
    eng = VCAM.get("engine") if "VCAM" in globals() else None
    if eng:
        try:
            eng.kick()
        except Exception as _e:
            _swallowed("server.pointer_set", _e)
    if on != was:                       # the overlay pages start (or stop) following: one state change per gesture
        def follow(st):
            if isinstance(st.get("live"), dict):
                st["live"]["follow"] = on
            return st
        update_state(follow)
    return pointer_now()


# ---------- 9.7 Draw and Spotlight on the Share Window, from Spotlight (docs/guide/presentations.md) ----------
# The presenter chooses Draw or Spotlight in Spotlight (Alt+Space); the Share Window (the window shared in Zoom or
# Teams) opens in that mode and takes the mouse: drawings go into live.ink and the spotlight follows the pointer
# (POST /api/pointer), exactly as from the Studio's Annotate or the phone. The native window (vcam/present_window.py)
# and present.html both call annotate_op, so the rules live in one place (the same as js/store.js KCScenes.ink).
INK_TOOLS = ("pen", "highlighter", "arrow", "line", "rect", "ellipse")
ANNOTATE = {"mode": "", "tool": "pen", "c": "#e8b931"}
_HEX = re.compile(r"#[0-9a-fA-F]{6}")


def _clean_ink_item(it):
    if not isinstance(it, dict) or it.get("t") not in INK_TOOLS or not isinstance(it.get("p"), list) or not it["p"]:
        return None
    pts = []
    for q in it["p"][:1500]:
        if isinstance(q, (list, tuple)) and len(q) >= 2:
            pts.append([round(_num(q[0], -0.5, 1.5, 0.0), 4), round(_num(q[1], -0.5, 1.5, 0.0), 4)])
    if not pts:
        return None
    c = str(it.get("c") or "")
    return {"t": it["t"], "c": c if _HEX.fullmatch(c) else "#e8b931", "w": _num(it.get("w"), 0.001, 0.05, 0.006), "p": pts}


def annotate_op(d):
    """POST /api/app/annotate (this PC only). {op: 'mode', mode: 'draw'|'spot'|'', tool?, c?, hide?} switches the Share
    Window's tool; {op: 'add', item} / {op: 'set', i, item} (a stroke as it is drawn) / 'undo' / 'clear' change the
    drawings; {op: 'spot', x, y} a quick circle. Returns the mode and the index of an added stroke."""
    if not isinstance(d, dict):
        raise ValueError("Invalid data")
    op, out = str(d.get("op") or ""), {}
    if op == "get":
        return dict(ANNOTATE)
    if op == "mode":
        mode = str(d.get("mode") or "")
        if mode not in ("", "draw", "spot"):
            raise ValueError("Unknown tool")
        if d.get("tool") in INK_TOOLS:
            ANNOTATE["tool"] = d["tool"]
        if _HEX.fullmatch(str(d.get("c") or "")):
            ANNOTATE["c"] = str(d["c"]).lower()
        was, ANNOTATE["mode"] = ANNOTATE["mode"], mode
        if was == "spot" and mode != "spot":
            pointer_set({"on": False})
        ink_on = True if mode == "draw" else (False if was == "draw" and d.get("hide") else None)
        if ink_on is not None:
            def ink(st):
                k = st.setdefault("live", {}).setdefault("ink", {"on": False, "items": [], "undone": []})
                k["on"] = ink_on
                return st
            update_state(ink)
        hook = DESKTOP.get("share_annotate")
        if hook:
            hook(mode)
        return dict(ANNOTATE)
    if op == "spot":
        spot = {"id": "s%x" % int(time.time() * 1000), "x": _num(d.get("x"), 0, 1, 0.5), "y": _num(d.get("y"), 0, 1, 0.5),
                "w": 0, "h": 0, "c": ANNOTATE["c"], "size": 1, "dur": 3, "k": 60, "style": "disc"}

        def put(st):
            st.setdefault("live", {})["spot"] = spot
            return st
        update_state(put)
        return {"ok": True}
    if op not in ("add", "set", "undo", "clear", "off", "on"):
        raise ValueError("Unknown action")
    item = _clean_ink_item(d.get("item")) if op in ("add", "set") else None
    if op in ("add", "set") and not item:
        raise ValueError("Invalid stroke")

    def change(st):
        k = st.setdefault("live", {}).setdefault("ink", {"on": False, "items": [], "undone": []})
        items, undone = k.setdefault("items", []), k.setdefault("undone", [])
        if op == "add":
            items.append(item)
            del items[:-300]
            k["undone"], k["on"] = [], True
            out["i"] = len(items) - 1
        elif op == "set":
            i = d.get("i")
            if isinstance(i, int) and 0 <= i < len(items):
                items[i] = item
        elif op == "undo" and items:
            undone.append(items.pop())
        elif op == "clear" and items:
            k["undone"], k["items"] = list(reversed(items)), []
        elif op in ("on", "off"):
            k["on"] = op == "on"
        return st
    update_state(change)
    return dict(ANNOTATE, **out)


def remote_memory_body():
    """What the phone remote sees of Capture Memory: the cards and which are on screen (no PC settings)."""
    snap = MEMORY.snapshot()
    on = {c["id"]: c for c in (((state.get("live") or {}).get("memory") or {}).get("cards") or [])}
    items = [{k: i[k] for k in ("id", "title", "text", "src", "private", "at", "pinned")} for i in snap["items"][:60]]
    for i in items:
        i["on"] = i["id"] in on
        if i["private"] and not i["on"]:       # 9.3 (audit L5): a private message is read on this PC, not on a phone
            i["text"] = ""
    return {"rev": snap["rev"], "capture": snap["capture"], "items": items, "notice": snap["notice"]}


def memory_body():
    snap = MEMORY.snapshot()
    cfg = app_settings()
    hook = DESKTOP.get("popup_state")
    snap.update(overlay=(state.get("live") or {}).get("memory"), dur=cfg["memDur"], share=cfg["memShare"],
                layout=cfg["memLayout"], side=cfg["memSide"], auto=cfg["memAuto"], canCapture=os.name == "nt",
                popup=hook() if hook else {"desktop": False})
    return snap


def memory_action(data):
    """POST /api/memory {action: capture|add|edit|show|showmany|pin|hide|hideall|delete|clear|settings, ...} (this PC
    only; the phone remote uses /api/remote/memory, which allows REMOTE_MEMORY_ACTIONS)."""
    act, item_id = str(data.get("action") or ""), str(data.get("id") or "")

    def need(item):
        if not item:
            raise ValueError("That card is no longer there.")
        return item
    if act == "capture":
        return {"watching": memory_capture(bool(data.get("on")))}
    if act == "add":                                   # a note typed in the Studio, or pasted on the phone
        src = "phone" if data.get("source") == "phone" else "clipboard"
        status, item = MEMORY.add(str(data.get("text") or ""), source=src, show=bool(data.get("show", True)))
        res = {"status": status, "item": item, "added": MEMORY.added}
    elif act == "edit":
        res = {"item": need(MEMORY.edit(item_id, data.get("title"), data.get("text")))}
    elif act == "show":
        res = {"item": need(MEMORY.show(item_id, data.get("full")))}
    elif act == "showmany":                            # 9.1 Show on several selected cards
        ids = data.get("ids") if isinstance(data.get("ids"), list) else []
        shown = MEMORY.show_many(ids[:memory.MAX_ITEMS])
        if not shown:
            raise ValueError("Those cards are no longer there.")
        res = {"shown": len(shown)}
    elif act == "pin":
        res = {"item": need(MEMORY.pin(item_id, data.get("on")))}
    elif act == "hide":
        res = {"item": need(MEMORY.hide(item_id))}
    elif act == "hideall":
        MEMORY.hide_all()
        res = {"ok": True}
    elif act == "delete":
        res = {"deleted": MEMORY.delete(item_id)}
    elif act == "clear":
        MEMORY.clear(pinned_too=bool(data.get("pinned")))
        res = {"ok": True}
    elif act == "settings":
        ch = {}
        if "dur" in data:
            try:
                ch["memDur"] = max(3, min(120, int(data["dur"])))
            except (TypeError, ValueError):
                raise ValueError("Seconds must be a number.")
        for key, name in (("share", "memShare"), ("auto", "memAuto")):
            if key in data:
                ch[name] = bool(data[key])
        for key, name, allowed in (("layout", "memLayout", memory.LAYOUTS), ("side", "memSide", ("right", "left"))):
            if key in data:
                if data[key] not in allowed:
                    raise ValueError("Choose one of: " + ", ".join(allowed))
                ch[name] = data[key]
        save_app_settings(ch)
        MEMORY.touch()
        res = {"ok": True}
    else:
        raise ValueError("Unknown action")
    memory_sync()
    return res


if isinstance(state.get("live"), dict):
    state["live"].pop("audience", None)               # 8.8's single Audience Card is not shown again
    state["live"].pop("memory", None)                 # the overlay is rebuilt from the cards (pinned ones come back)


# ---------- Read-only checks used by Settings > Phone & iPad Remote and Diagnostics ----------
_net_cache = {"at": 0, "value": None}


_net_lock = threading.Lock()


def windows_network_check(max_age=None):
    """On Windows, report the network type (Private/Public) and whether the optional firewall rule exists. Read-only:
    nothing is changed. 7.1.1: read through Windows' own interfaces (winapi.py), never PowerShell or netsh, and only
    refreshed while Settings > Phone & iPad Remote asks for it (max_age); everything else gets the last answer, so
    nothing runs in the background. Returns None on other systems or before the first check."""
    if os.name != "nt":
        return None
    if max_age is not None and time.time() - _net_cache["at"] > max_age and _net_lock.acquire(blocking=False):
        def work():
            try:
                _refresh_network_check()
            finally:
                _net_lock.release()
        threading.Thread(target=work, daemon=True).start()
    return _net_cache["value"]


def _refresh_network_check():
    out = {"profiles": [], "ruleExists": None}
    try:
        out["profiles"] = winapi.network_profiles()
    except Exception as _e:
        _swallowed("server._refresh_network_check", _e)
    try:
        out["ruleExists"] = winapi.firewall_rule_exists(FIREWALL_RULE)
    except Exception as _e:
        _swallowed("server._refresh_network_check", _e)
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


SUPPORT_LOG = "kc-app-log.txt"
SUPPORT_SETTINGS = ("kc-app-settings.json", "kc-vcam-settings.json", "kc-looks.json")


def support_bundle(address):
    """Settings > Diagnostics > Save support bundle: one zip to send when asking for help. It holds the program's log,
    the diagnostics and its settings files. It never holds the plan, members, the phone-remote PIN or sessions, or any
    key (those stay in their files or in Windows Credential Manager)."""
    import io
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("README.txt", "FrameDecks support bundle\n\nIncluded: the program's log (the last 2 MB), the Diagnostics "
                   "page and the settings files listed here.\nNot included: your plan, members, the phone-remote PIN and "
                   "sessions, and any keys.\n")
        z.writestr("diagnostics.json", json.dumps(diagnostics(address), indent=1, ensure_ascii=False, default=str))
        z.writestr("sync.json", json.dumps(SYNC.info(), indent=1, ensure_ascii=False, default=str))
        listing = sorted(({"name": f.name, "bytes": f.stat().st_size} for f in DATA.iterdir() if f.is_file()),
                         key=lambda d: d["name"]) if DATA.exists() else []
        z.writestr("data-folder.json", json.dumps(listing, indent=1))   # names and sizes only
        for name in (SUPPORT_LOG + ".old", SUPPORT_LOG):
            f = DATA / name
            if f.is_file():
                data = f.read_bytes()
                z.writestr(name, data[-2_000_000:])
        for name in SUPPORT_SETTINGS:
            f = DATA / name
            if f.is_file():
                z.writestr(name, f.read_bytes())
    return buf.getvalue()


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
        "planRecovery": dict(PLAN_RECOVERY) or None,
        "missingMedia": media_check(state)[:50],
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
    if "SYNC" in globals():
        SYNC.poke()


# ---------- Phase 4: syncing service plans (src/cloud_sync.py; docs/architecture/metadata-sync.md) ----------
# Off until this PC is linked in Settings > FrameDecks account. Only text records leave the PC (no media, nothing
# live); it runs on its own thread and never stands between a page, the phone remote or the camera and the plan.

def _sync_read():
    with cond:
        plan = json.loads(json.dumps(state))
    people = load_private().get("members")
    return plan, (list(people) if isinstance(people, list) else None)   # None: the member file is missing or unreadable


def _sync_write(change):
    """Apply changes from the workspace to the latest plan and member list, through the normal save path."""
    with cond:
        private = load_private()
        current = json.loads(json.dumps(state))
        plan, members = change(json.loads(json.dumps(current)), list(private.get("members") or []))
        plan.pop("rev", None)
        current.pop("rev", None)
        if json.dumps(plan, sort_keys=True) != json.dumps(current, sort_keys=True):
            save_state(plan)
            _report_missing_media()
        if members != (private.get("members") or []):
            private["members"] = members
            save_private(private)


_MEDIA_REPORTED = {"files": set()}


def _report_missing_media():
    """After the workspace changed the plan: say in the log (kc-app-log.txt) which media files it names that this PC
    lacks, once per new set, so a support check finds them before the service."""
    found = media_check(state)
    files = {f for m in found for f in m["files"]}
    if files and files != _MEDIA_REPORTED["files"]:
        print(f"Media check: {len(found)} Frame(s) name files not in this PC's media folder: "
              + "; ".join(f'{m["name"] or m["frame"]}: {", ".join(m["files"][:5])}' for m in found[:10]))
    _MEDIA_REPORTED["files"] = files


SYNC = cloud_sync.Service(DATA / "kc-sync.json", cloud_sync.SecretStore(DATA / ".kc-sync-key"), _sync_read, _sync_write,
                          socket.gethostname() or "FrameDecks PC", member_authority=lambda: app_settings()["memberAuthority"])
if PLAN_RECOVERY:                       # the plan here was replaced at start-up: the workspace's plan is the true one
    SYNC.adopt_workspace()


# ---------- Phase 5: running a service from the companion (src/cloud_remote.py; docs/architecture/remote-control-design.md) ----------
# Only while this PC is linked and Settings > FrameDecks account > "Allow control from the companion" is on. Commands
# are fetched from the workspace and run by the program's own window (app/js/cloud-remote.js) with the keys' code.
# Separate from the Wi-Fi phone remote (REMOTE above), which it does not touch.

def _remote_credentials():
    link, cloud, key = SYNC.state.get("link"), SYNC.state.get("cloud"), SYNC.secrets.get()
    return (cloud, link["organizationId"], key) if link and cloud and key else None


def _remote_plan():
    with cond:
        return json.loads(json.dumps(state))


CLOUD_BRIDGE = cloud_remote.Bridge()

CLOUD_REMOTE = cloud_remote.RemoteService(_remote_credentials, lambda: app_settings()["cloudRemote"], _remote_plan,
                                          CLOUD_BRIDGE)


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
        except Exception as _e:
            _swallowed("server.set_remote", _e)
    return {"enabled": REMOTE, "listening": sorted(remote_servers), "failed": list(remote_errors)}


def _remote_watcher():
    while True:
        time.sleep(15)
        if REMOTE and set(lan_addresses()) != set(remote_servers):
            set_remote(True)


# ---------- Installed-app settings, backups and importing old data ----------
DESKTOP = {"active": False}  # filled in by src/desktop_app.py (show/hide/quit/choose_folder hooks)
APP_SETTINGS_DEFAULTS = {"remoteAutostart": False, "importDecided": False,
                         "lowGpu": True,     # draw the app window without the graphics card (keeps Windows smooth)
                         "nativePresent": True,   # Presentation window without a browser engine (off = WebView2 window)
                         # 6.8 window chrome and tray
                         "customChrome": True,    # the app's ribbon instead of the Windows title bar (restart to change)
                         "minimizeTo": "ask",     # minimize button: ask / tray / taskbar
                         "spotlightKey": "Alt+Space",   # system-wide shortcut for Spotlight ('' = off)
                         "prompterLook": "solid",       # 8.1 Teleprompter transparency: solid/presenter/meeting/conference/ghost
                         "prompterOnTop": True,         # 8.1 the Teleprompter stays above Zoom, Teams and PowerPoint (pin)
                         "cloudRemote": False,    # Phase 5: run a service from the companion (Settings > FrameDecks account)
                         "memberAuthority": "cloud",   # M-D2: the workspace is the member list's source (no switch on screen)
                         "ai": "auto",            # M-D3: "auto" = use Ollama on this PC when it answers; "off" = never
                         "memDur": 12,            # 9.0 Memory Cards: seconds an unpinned card stays in the chat overlay (3..120)
                         "memShare": False,       # 9.0 the chat overlay also on the Share Window and the overlay pages
                         "memLayout": "beside",   # 9.0 on FrameDecks vCam: beside the video, below it, or over it
                         "memSide": "right",      # 9.0 the chat overlay's side (beside / over)
                         "memAuto": True,         # 9.0 a copied card goes into the chat overlay at once
                         "guide": {},             # 6.14 Setup guide progress on this PC (app/js/guide.js, _valid_guide)
                         "onboarding": {}}        # 9.5 the Welcome flow: {done, skipped, at} (app/js/onboarding.js)
APP_SETTING_CHOICES = {"memLayout": ("beside", "below", "over"), "memSide": ("right", "left"), "minimizeTo": ("ask", "tray", "taskbar"), "memberAuthority": ("cloud", "pc"), "ai": ("auto", "off"),
                       "prompterLook": ("solid", "presenter", "meeting", "conference", "ghost")}


GUIDE_STEPS = ("welcome", "output", "phone", "connect", "frame", "ready")    # app/js/guide-steps.js (8.0: no "rehearse")
GUIDE_RETIRED = ("rehearse",)     # steps of older versions: dropped from saved progress, never refused
GUIDE_KINDS = ("bible-study", "prayer", "youth", "fellowship", "other")


def _valid_guide(v):
    """The Setup guide's progress: {seen, closed, finished: bool, kind: one of GUIDE_KINDS, done: [step ids]}."""
    if not isinstance(v, dict) or not set(v) <= {"seen", "closed", "finished", "kind", "done"}:
        return False
    if any(k in v and not isinstance(v[k], bool) for k in ("seen", "closed", "finished")):
        return False
    if "kind" in v and v["kind"] not in GUIDE_KINDS:
        return False
    done = v.get("done", [])
    return isinstance(done, list) and len(done) <= len(GUIDE_STEPS) and all(d in GUIDE_STEPS for d in done)


def _valid_onboarding(v):
    """9.5 the Welcome flow: {done: bool, skipped: bool, at: seconds}. Kept in kc-app-settings.json, which an update
    or a reinstall keeps, so it shows once per PC."""
    if not isinstance(v, dict) or not set(v) <= {"done", "skipped", "at"}:
        return False
    if any(k in v and not isinstance(v[k], bool) for k in ("done", "skipped")):
        return False
    return "at" not in v or (isinstance(v["at"], (int, float)) and not isinstance(v["at"], bool) and 0 <= v["at"] < 1e11)


def _valid_setting(k, v):
    d = APP_SETTINGS_DEFAULTS[k]
    if k == "guide":
        return _valid_guide(v)
    if k == "onboarding":
        return _valid_onboarding(v)
    if isinstance(d, bool):
        return isinstance(v, bool)
    if k in APP_SETTING_CHOICES:
        return v in APP_SETTING_CHOICES[k]
    if k == "spotlightKey":
        from desktop_win import parse_hotkey
        return isinstance(v, str) and (v == "" or parse_hotkey(v) is not None)
    if k == "memDur":
        return isinstance(v, int) and not isinstance(v, bool) and 3 <= v <= 120
    return False


def app_settings():
    out = dict(APP_SETTINGS_DEFAULTS)
    try:
        data = json.loads(APP_SETTINGS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            g = data.get("guide")
            if isinstance(g, dict) and isinstance(g.get("done"), list):     # 8.0: progress saved by 7.x keeps its ticks
                data["guide"] = dict(g, done=[d for d in g["done"] if d not in GUIDE_RETIRED])
            for k in out:
                if k in data and _valid_setting(k, data[k]):
                    out[k] = data[k]
    except (OSError, ValueError):
        pass
    return out


_settings_lock = threading.RLock()      # 9.1.2 two saves at once never lose one of them


def save_app_settings(changes):
    with _settings_lock:
        return _save_app_settings(changes)


def _save_app_settings(changes):
    cur = app_settings()
    for k, v in changes.items():
        if k in APP_SETTINGS_DEFAULTS and _valid_setting(k, v):
            cur[k] = v
    if "spotlightKey" in changes:
        from desktop_win import format_hotkey
        cur["spotlightKey"] = format_hotkey(cur["spotlightKey"]) if cur["spotlightKey"] else ""
    write_atomic(APP_SETTINGS_FILE, json.dumps(cur, indent=2))
    if "cloudRemote" in changes and "CLOUD_REMOTE" in globals():
        CLOUD_REMOTE.poke()                # the switch takes effect at once (off: no more asking)
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
    flush_state()                                         # the file must hold the latest live state too
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
    backup_now("before-import")                           # also writes any pending change, so none lands later
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


FIREWALL_RULE = "FRAMEDECKS Phone Remote"


def firewall(action):
    """Windows only. Asks for administrator permission (UAC). Allow = inbound, this program only, Private networks only.
    7.1.1: FRAMEDECKS.exe itself does it (`--firewall allow|undo`, winapi.firewall_main), started with the standard
    "run as administrator" prompt; no PowerShell."""
    if os.name != "nt":
        return False, "Only available on Windows."
    program = sys.executable
    if FROZEN:
        file, params = program, ""
    else:                                       # from source: python runs winapi.py directly
        file, params = program, subprocess.list2cmdline([str(SRC / "winapi.py")])
    params = (params + " " if params else "") + subprocess.list2cmdline(["--firewall", "allow" if action == "allow" else "undo",
                                                                          "--program", program])
    outcome, code = winapi.run_elevated(file, params)
    _net_cache["at"] = 0
    if outcome == "cancelled":
        return False, "Cancelled: administrator permission was not given."
    if outcome != "done":
        return False, "Windows didn’t respond. Try again."
    return code == 0, ("Done." if code == 0 else "Windows reported a problem.")


# ---------- FrameDecks (built-in virtual camera, Windows) ----------
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
    """Saved FrameDecks settings, migrated to the current schema and validated; defaults fill the gaps
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
    write_atomic(VCAM_SETTINGS_FILE, json.dumps(data, indent=2))


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
    """Webcams by name (FrameDecks itself excluded). Refreshed at most every 10 s; never turns a webcam on."""
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
FILE_KINDS = ("image", "video", "pdf", "audio")
AUDIO_TYPES = {".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg"}   # M-D4 Audio Content
AUDIO_TYPES_EXT = tuple(AUDIO_TYPES)


def media_check(st):
    """Frames whose pictures, videos or PDFs are not in this PC's media folder (migration step 3, audit C8): a Frame
    synced from another PC, or a file renamed or deleted, is found before the service rather than as an empty layer.
    Reads file names only. [{"frame", "name", "files": [...]}], in plan order."""
    seen, out = {}, []
    for sc in st.get("scenes") or []:
        if not isinstance(sc, dict) or sc.get("tpl"):
            continue
        missing = []
        for l in sc.get("layers") or []:
            f = str(((l.get("c") or {}).get("file") or "") if isinstance(l, dict) and l.get("kind") in FILE_KINDS else "")
            if f and f not in missing:
                if f not in seen:
                    try:                                       # 9.1.2: a name that is a path is never opened
                        seen[f] = bool(safe_name(f)) and (LAYERS_DIR / f).is_file()
                    except (OSError, ValueError):
                        seen[f] = False
                if not seen[f]:
                    missing.append(f)
        if missing:
            out.append({"frame": str(sc.get("id") or ""), "name": str(sc.get("name") or ""), "files": missing})
    return out
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
    write_atomic(STUDIO_FILE, json.dumps(cur, indent=2))


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


# The key itself is kept in Windows Credential Manager (migration step 2, docs/project/history/migration-plan.md), not in the JSON file;
# a key an older version saved in the file is moved there the first time it is read.
ESV_KEY = cloud_sync.SecretStore(DATA / ".kc-esv-key", target="FRAMEDECKS/esv-key")


def _esv_key_get():
    try:
        return re.sub(r"[^A-Za-z0-9]", "", ESV_KEY.get() or "")[:200]
    except (OSError, AttributeError, ValueError):
        return ""


def _esv_key_set(key):
    """Store (or with "" remove) the key; True when the store holds exactly that afterwards."""
    try:
        ESV_KEY.set(key) if key else ESV_KEY.delete()
    except (OSError, AttributeError):
        return False
    return _esv_key_get() == key


def scripture_settings():
    try:
        d = json.loads(SCRIPTURE_FILE.read_text(encoding="utf-8"))
        d = d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        d = {}
    key = re.sub(r"[^A-Za-z0-9]", "", str(d.get("key") or ""))[:200]
    if key and _esv_key_set(key):                    # moved out of the file only once the store reads it back
        _write_scripture_file({k: v for k, v in d.items() if k != "key"})
    key = key or _esv_key_get()
    return {"provider": "esv", "key": key, "translation": "ESV" if d.get("translation", "ESV") == "ESV" else "typed"}


def _write_scripture_file(d):
    try:
        write_atomic(SCRIPTURE_FILE, json.dumps(d))
    except OSError:
        pass


def save_scripture_settings(cur):
    """cur: scripture_settings() with changes. The key goes to the store; the file keeps it only if the store fails."""
    out = {"provider": "esv", "translation": cur.get("translation", "ESV")}
    if not _esv_key_set(cur.get("key") or ""):
        out["key"] = cur.get("key") or ""
    _write_scripture_file(out)


def _scr_cache():
    try:
        d = json.loads(SCRIPTURE_CACHE.read_text(encoding="utf-8"))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


OPEN_BIBLES = {"KJV": "kjv", "WEB": "web"}    # 9.5 public-domain translations, no key needed (bible-api.com)
OPEN_BIBLE_URL = "https://bible-api.com/"


def _scr_save(key, canon, text):
    with _scr_lock:
        cache = _scr_cache()
        cache[key] = {"ref": canon, "text": text, "at": time.time()}
        if len(cache) > SCRIPTURE_CACHE_MAX:
            for k in sorted(cache, key=lambda k: cache[k].get("at", 0))[:len(cache) - SCRIPTURE_CACHE_MAX]:
                cache.pop(k, None)
        tmp = SCRIPTURE_CACHE.with_suffix(".tmp")
        tmp.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, SCRIPTURE_CACHE)


def _open_bible_lookup(ref, translation, fresh=False):
    """9.5 the KJV or the World English Bible (both public domain) from bible-api.com; saved for offline use like the ESV."""
    key = translation + "|" + ref.lower()
    with _scr_lock:
        cache = _scr_cache()
    hit = cache.get(key)
    if hit and not fresh:
        hit["at"] = time.time()
        return {"ref": hit["ref"], "text": hit["text"], "version": translation, "cached": True}
    from urllib.request import Request, urlopen
    from urllib.parse import quote
    url = OPEN_BIBLE_URL + quote(ref) + "?translation=" + OPEN_BIBLES[translation]
    try:
        with urlopen(Request(url, headers={"User-Agent": "FRAMEDECKS/" + APP_VERSION}), timeout=8) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        if hit:
            return {"ref": hit["ref"], "text": hit["text"], "version": translation, "cached": True, "stale": True}
        if getattr(e, "code", None) == 404:
            raise ValueError("That reference wasn’t found. Try e.g. John 3:16, Psalm 23 or Matthew 5:1-12.")
        if getattr(e, "code", None) == 429:
            raise ValueError("Too many passages fetched in a short time. Wait half a minute and try again.")
        raise ValueError("No internet connection, and this passage isn’t saved on this PC yet. Type the text, or try again when online.")
    verses = data.get("verses") if isinstance(data, dict) else None
    if isinstance(verses, list) and verses:
        text = " ".join(re.sub(r"\s+", " ", str(v.get("text") or "")).strip() for v in verses if isinstance(v, dict))
    else:
        text = re.sub(r"\s+", " ", str((data or {}).get("text") or "")).strip()
    text = text.strip()[:20000]
    if not text:
        raise ValueError("That reference wasn’t found. Try e.g. John 3:16, Psalm 23 or Matthew 5:1-12.")
    canon = str(data.get("reference") or ref)[:120]
    _scr_save(key, canon, text)
    return {"ref": canon, "text": text, "version": translation, "cached": False}


def scripture_lookup(ref, translation="ESV", fresh=False):
    """{ref, text, version, cached, stale?} for a reference such as "Romans 2:28-29"; raises ValueError with a plain message."""
    ref = re.sub(r"\s+", " ", str(ref or "")).strip()[:120]
    if not ref:
        raise ValueError("Type a reference first, for example Romans 2:29.")
    translation = str(translation or "ESV").upper()
    if translation in OPEN_BIBLES:
        return _open_bible_lookup(ref, translation, fresh)
    if translation != "ESV":
        raise ValueError("FrameDecks fetches the ESV, KJV and WEB. For other translations type or paste the text (or plan them in the Meeting Workbook).")
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
        with urlopen(Request(ESV_URL + "?" + q, headers={"Authorization": "Token " + api_key, "User-Agent": "FRAMEDECKS/" + APP_VERSION}), timeout=8) as r:
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


AI = ai.Service(DATA / "kc-ai-cache.json", enabled=lambda: app_settings()["ai"] != "off")


def _passages_with_text(passages):
    """A Frame's scripture as [{"ref", "text"}]; a reference without text is looked up (the offline cache first, then
    the ESV with the church's own key); one that cannot be found keeps its reference only."""
    out = []
    for p in (passages if isinstance(passages, list) else [])[:6]:
        if not isinstance(p, dict):
            continue
        ref, text = str(p.get("ref") or "")[:120], str(p.get("text") or "")[:6000]
        if ref and not text.strip():
            try:
                text = scripture_lookup(ref).get("text", "")
            except (ValueError, OSError):
                text = ""
        out.append({"ref": ref, "text": text})
    return out


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
    shared directly in Zoom/Teams, which FrameDecks vCam is not capturing. Works without the camera engine."""
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
    lay = comp.layers.status()
    media = [{"id": x["id"], "name": x.get("name") or "Video", "state": lay.get(x["id"], {}).get("state", ""),
              "ended": bool(lay.get(x["id"], {}).get("ended"))}
             for x in comp.layers.layers[::-1] if x["type"] == "video" and x.get("visible", True)]
    return {"available": True, "scenes": [{"id": x["id"], "name": x["name"]} for x in st["scenes"]],
            "activeScene": st["activeScene"], "presentation": pres, "media": media[:6],
            "vcam": {"state": est.get("state", ""), "inUse": bool(est.get("inUse")), "fps": est.get("fps", 0)},
            "recording": {"on": rec is not None, "seconds": round(time.time() - rec.started, 1) if rec else 0}}


def remote_studio_action(d):
    """What the remote may do in the Studio: switch scene, next/previous slide, and (9.4) play, pause or restart a
    video Deck of the picture."""
    op = d.get("op")
    if op == "media":
        comp = VCAM.get("compositor")
        cmd, lid = str(d.get("cmd") or ""), str(d.get("id") or "")
        if not comp or cmd not in ("play", "pause", "stop", "restart"):
            raise ValueError("Not allowed from the remote")
        if not any(x["id"] == lid and x["type"] == "video" for x in comp.layers.layers) or not comp.layers.control(lid, cmd):
            raise ValueError("That video isn’t playing on the PC")
        return {}
    if op == "scene":
        studio_action({"op": "scene-apply", "id": str(d.get("id") or "")})
        return {}
    if op == "slide":
        return {"slide": slide_move(d.get("step", 1))}
    raise ValueError("Not allowed from the remote")


def recordings_dir():
    vids = Path.home() / "Videos"
    legacy.migrate_recordings(vids if vids.is_dir() else DATA)
    return (vids if vids.is_dir() else DATA) / "FRAMEDECKS"


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
        raise ValueError(VCAM.get("reason") or "FrameDecks vCam is not available.")
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
        except Exception as _e:
            _swallowed("server._studio_action", _e)
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
        write_atomic(STUDIO_FILE, json.dumps(st, indent=2))
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
                sid = "s_" + re.sub(r"\W+", "_", sid)[:40]  # 9.1.2 always a plain name (it names a file)
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
            try:                                       # 9.1.2 only a scene id names its thumbnail, never a path
                if str(d.get("id") or "").isidentifier():
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
        write_atomic(STUDIO_FILE, json.dumps(st, indent=2))
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
    """Create the engine (idle until Zoom/Teams uses FrameDecks). Safe to call when unavailable."""
    if VCAM["engine"] is not None:
        return
    demo = os.environ.get("KC_VCAM_DEMO") == "1"
    start_files_msg = ("The FrameDecks vCam works only in the installed FrameDecks. Close the window you started it from, then open "
                       "FrameDecks from its desktop or Start-menu icon.")
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
            print("FrameDecks could not load:\n" + traceback.format_exc())
            VCAM["reason"] = ("FrameDecks vCam couldn’t start because part of it is missing. Please send Settings → Diagnostics "
                              "→ Copy diagnostics to the developer.")
        else:
            VCAM["reason"] = start_files_msg
        return
    model = RES / "vcam" / "models" / "selfie_segmentation_landscape.tflite"
    if not model.exists():
        model = SRC / "vcam" / "models" / "selfie_segmentation_landscape.tflite"
    if demo:
        make_sink, make_cam = (lambda w, h: vsink.FakeSink(w, h, connected=False)), DemoCamera
    else:
        if os.name != "nt":
            VCAM["reason"] = start_files_msg if not FROZEN else "FrameDecks vCam works on Windows."
            return
        dll = vsink.dll_path(RES) if vsink.dll_path(RES).exists() else vsink.dll_path(SRC)
        if not dll.exists():
            folder = dll.parent
            present = sorted(p.name for p in folder.iterdir()) if folder.is_dir() else []
            VCAM["detail"] = f"missing {dll.name} in {folder} (found: {', '.join(present) or 'nothing'})"
            if not FROZEN:
                VCAM["reason"] = start_files_msg
            elif (folder / "build-info.json").exists():
                VCAM["reason"] = ("The camera file framedecks_vcam64.dll was installed but has since been removed, most likely by "
                                  "Windows Security or another antivirus. Open Windows Security → Virus & threat protection → "
                                  "Protection history, restore or allow framedecks_vcam64.dll, then run the installer again.")
            else:
                VCAM["reason"] = ("This installer was built without the camera, because the GitHub build recipe is out of date. "
                                  "Copy the .github folder from the latest FRAMEDECKS.zip into your repository, commit "
                                  "and push, then install the new installer.")
            print("FrameDecks not available: " + VCAM["detail"])
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
    comp.program_fx.others = layer.visible          # 9.1 the Memory Card bubbles keep clear of the cards on screen
    comp.program_fx.get_pointer = pointer_now       # 9.4 the follow Spotlight
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
    """FrameDecks status for the PC screens. lite: only what the top-bar light needs (no webcam or looks listing)."""
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
            "activeCamera": vcam_effective(vcam_settings())["cameraName"] if eng else "", "name": "FrameDecks",
            "blurNow": VCAM["blurSession"] if VCAM.get("blurSession") is not None else vcam_settings()["blurStrength"],
            "looks": _looks_list(), "looksNote": VCAM.get("looksNote", ""),
            "profiles": [{"id": k, "name": v["name"]} for k, v in (_picture().PROFILES.items() if _picture() else [])]}


def vcam_install(action):
    """Register (or remove) FrameDecks with Windows. Asks for administrator permission (UAC)."""
    if os.name != "nt":
        return False, "Only available on Windows."
    name = "unregister-framedecks-camera.cmd" if action == "uninstall" else "register-framedecks-camera.cmd"
    helper = next((p for p in (RES / "vcam" / "bin" / name, SRC / "vcam" / "bin" / name) if p.exists()), None)
    if helper is None or not (helper.parent / "framedecks_vcam64.dll").exists():
        return False, "The FrameDecks files are missing. Reinstall the app."
    outcome, _code = winapi.run_elevated(helper)          # 7.1.1: Windows' own prompt, no PowerShell
    if outcome == "cancelled":
        return False, "Cancelled: administrator permission was not given."
    if outcome != "done":
        return False, "Windows didn’t respond. Try again."
    return True, "Done."


TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".ttf": "font/ttf", ".woff2": "font/woff2", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    timeout = 90             # 9.1.2 an idle or trickling connection is closed (long-polls answer within 25 s)

    def log_message(self, *args):
        pass

    def handle(self):
        """9.1.2 Another device may hold only MAX_CONN_PER_IP connections at once, so one misbehaving device on the
        Wi-Fi cannot use up the program's threads (the PC itself is never limited)."""
        ip = self.client_address[0]
        if ip in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
            return super().handle()
        with conn_lock:
            if conn_count.get(ip, 0) >= MAX_CONN_PER_IP:
                self.close_connection = True
                return
            conn_count[ip] = conn_count.get(ip, 0) + 1
        try:
            super().handle()
        finally:
            with conn_lock:
                conn_count[ip] -= 1
                if conn_count[ip] <= 0:
                    conn_count.pop(ip, None)

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
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            raise ValueError("bad length")
        cap = MAX_BODY if self.is_local() or self.signed_in() else MAX_PUBLIC_BODY   # 9.1.2 the PIN form is small
        if length <= 0 or length > cap:
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

    def cross_site_api(self, path):
        """A web page from another site calling the program's API (e.g. an <img> pointing at /api/...). Browsers say so
        in Sec-Fetch-Site; the program's own pages, the phone remote and OBS are same-origin or direct, and programs
        and scripts on this PC send no such header. Pages themselves stay reachable (links, bookmarks)."""
        return path.startswith("/api/") and self.headers.get("Sec-Fetch-Site", "").lower() == "cross-site"

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
        if ".." in path or "\\" in path:            # 9.1.2 "/fonts/../page.html" is not a font
            return False
        if path in REMOTE_PUBLIC or path.startswith("/fonts/"):
            return True
        return path in REMOTE_SIGNED_IN and self.signed_in()

    def remote_login(self, data):
        ip = self.client_address[0]
        pin = str(data.get("pin", "")) if isinstance(data, dict) else ""
        with login_lock:                     # 9.1.2 check, compare and count as one step (no parallel guesses)
            now = time.time()
            login_recent[:] = [t for t in login_recent if now - t < 600]
            count, until = failures.get(ip, [0, 0])
            if until > now:
                return self.reply(429, json.dumps({"error": "locked", "wait": int(until - now) + 1}), TYPES[".json"])
            if len(login_recent) >= MAX_LOGIN_FAILS:          # too many wrong PINs from all devices together
                wait = int(600 - (now - login_recent[0])) + 1
                return self.reply(429, json.dumps({"error": "locked", "wait": wait}), TYPES[".json"])
            if not secrets.compare_digest(pin.encode(), remote_pin().encode()):
                count += 1
                login_recent.append(now)
                # 5 wrong PINs: wait 1 minute; each further 5 doubles it (up to an hour). Only a right PIN resets it.
                wait = min(3600, 60 * 2 ** (count // 5 - 1)) if count >= 5 and count % 5 == 0 else 0
                failures[ip] = [count, now + wait if wait else 0]
                if len(failures) > 1000:
                    failures.pop(next(iter(failures)))
                return self.reply(401, json.dumps({"error": "wrong pin"}), TYPES[".json"])
        with login_lock:
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
        if self.cross_site_api(path):
            return self.reply(403, "Forbidden", "text/plain; charset=utf-8")
        if not self.is_local() and REMOTE and path in ("", "/", "/remote"):
            return self.reply(302, "", "text/plain", [("Location", "/remote.html")])
        if not self.allowed(path):
            return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
        if path == "/api/remote/studio":                # scenes + presentation for the remote (PIN-protected)
            return self.reply(200, json.dumps(remote_studio_info()), TYPES[".json"])
        if path == "/api/remote/live.jpg":              # v6.6 the FrameDecks picture for the phone's drawing pad (PIN-protected)
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
        if path == "/api/app/ping":
            return self.reply(200, json.dumps({"app": "FRAMEDECKS", "version": APP_VERSION, "installedApp": FROZEN}), TYPES[".json"])
        if path == "/api/app/update":                    # About: a newer published version, if any (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.reply(200, json.dumps(update_info()), TYPES[".json"])
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
                info["network"] = windows_network_check(60 if "fresh=1" in url.query else None)
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
        if path == "/api/ai/status":                     # M-D3: is a free local AI there? (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.reply(200, json.dumps(AI.status(fresh=parse_qs(url.query).get("fresh", ["0"])[0] == "1")), TYPES[".json"])
        if path == "/api/media/file":                    # 8.2 a Content's file, for Export Frame File (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            f = LAYERS_DIR / Path(parse_qs(url.query).get("name", [""])[0]).name
            if not f.name or not f.is_file():
                return self.reply(404, "Not found", "text/plain; charset=utf-8")
            return self.reply(200, f.read_bytes(), "application/octet-stream", [("Cache-Control", "no-store")])
        if path == "/api/media/audio":                   # M-D4: an Audio Content's file, for the program window (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            f = LAYERS_DIR / Path(parse_qs(url.query).get("name", [""])[0]).name
            if f.suffix.lower() not in AUDIO_TYPES or not f.is_file():
                return self.reply(404, "Not found", "text/plain; charset=utf-8")
            return self.reply(200, f.read_bytes(), AUDIO_TYPES[f.suffix.lower()], [("Cache-Control", "no-store")])
        if path == "/api/support-bundle":                # Settings > Diagnostics > Save support bundle (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.reply(200, support_bundle(self.server.server_address), "application/zip",
                              [("Cache-Control", "no-store")])
        if path == "/api/media/check":                   # migration step 3: Frames whose media files are not on this PC
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.reply(200, json.dumps({"missing": media_check(state)}), TYPES[".json"])
        if path == "/api/sync":                                   # Settings > FrameDecks account (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.reply(200, json.dumps(dict(SYNC.info(), remote=CLOUD_REMOTE.info())), TYPES[".json"])
        if path == "/api/remote-cloud/next":                       # the program's own window asks for commands
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                wait = min(25.0, max(0.0, float(parse_qs(url.query).get("wait", ["20"])[0])))
            except ValueError:
                wait = 20.0
            # Waits also while switched off: commands only come once it is on, and then the window is already asking
            commands = CLOUD_BRIDGE.for_window(wait)
            return self.reply(200, json.dumps({"on": CLOUD_REMOTE.info()["active"], "commands": commands}),
                              TYPES[".json"])
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
                snap = (state, LIBRARY["rev"])
            body = state_body(q.get("librev", [None])[0], snap)    # made outside the lock (M10)
            return self.reply(200, body, TYPES[".json"])
        if path == "/api/pointer":                      # 9.4 the follow Spotlight (long-poll on seq)
            q = parse_qs(url.query)
            since = q.get("since", [None])[0]
            try:
                wait = min(10.0, max(0.5, float(q.get("wait", ["10"])[0])))
            except ValueError:
                wait = 10.0
            if since is not None:
                with pointer_cond:
                    pointer_cond.wait_for(lambda: str(POINTER["seq"]) != since, timeout=wait)
            return self.reply(200, json.dumps(pointer_now()), TYPES[".json"])
        if path == "/api/remote/memory":                # 9.1 Capture Memory on the phone remote (signed in; long-poll)
            q = parse_qs(url.query)
            since = q.get("since", [None])[0]
            if since is not None:
                try:
                    wait = min(25.0, max(1.0, float(q.get("wait", ["25"])[0])))
                except ValueError:
                    wait = 25.0
                MEMORY.wait(since, wait)
            return self.reply(200, json.dumps(remote_memory_body()), TYPES[".json"])
        if path == "/api/memory":                       # 9.0 Memory Cards (this PC only; long-poll)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            q = parse_qs(url.query)
            since = q.get("since", [None])[0]
            if since is not None:
                try:
                    wait = min(25.0, max(1.0, float(q.get("wait", ["25"])[0])))
                except ValueError:
                    wait = 25.0
                MEMORY.wait(since, wait)
            return self.reply(200, json.dumps(memory_body()), TYPES[".json"])
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
            data = target.read_bytes()
            extra = [(CSP_HEADER, page_csp(data))] if target.suffix.lower() == ".html" else None
            return self.reply(200, data, TYPES.get(target.suffix.lower(), "application/octet-stream"), extra)
        self.reply(404, "Not found", "text/plain; charset=utf-8")

    def origin_ok(self):
        # Extra protection: requests made by other websites are refused
        origin = self.headers.get("Origin")
        if not origin:
            return True
        host = self.headers.get("Host", "")
        return origin in (f"http://{host}",)

    def present_stream(self):
        """The Presentation window's picture: a motion-JPEG stream of the final FrameDecks frame.
        A frame is sent only when the picture changed (at most 30 per second), so a still slide costs
        almost nothing. Each frame is encoded here, not in the camera thread."""
        comp, eng = VCAM.get("compositor"), VCAM.get("engine")
        if not comp or not eng:
            return self.reply(404, "FrameDecks vCam is not available", "text/plain; charset=utf-8")
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
        if ext.lower() not in (".png", ".jpg", ".jpeg", ".mp4", ".mov", ".webm", ".pdf", ".pptx", ".ppt") + AUDIO_TYPES_EXT:
            return self.reply(400, json.dumps({"error": "Use PNG, JPG, MP4, MOV, WebM, PDF, PowerPoint (PPTX) or MP3, M4A, WAV, OGG."}), TYPES[".json"])
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
        if action == "teleprompter":
            # 8.0 the Teleprompter: one window above Zoom and Teams, out of screen sharing (a browser opens a pop-up)
            hook = DESKTOP.get("teleprompter")
            if not hook:
                return ok({"desktop": False})
            return ok({"desktop": True, "open": bool(hook(data.get("on", "toggle")))})
        if action == "popup":
            # 9.0 the Memory Card popup in the screen corner (installed app): hide it, or keep it while the pointer is on it
            hook = DESKTOP.get("popup_op")
            if not hook:
                return ok({"desktop": False})
            return ok(dict(hook(str(data.get("op") or ""), data) or {}, desktop=True))
        if action == "window":
            # v6.4 native window: the page says whether it is dark or light; the title bar follows
            hook = DESKTOP.get("window_theme")
            return ok({"styled": bool(hook(data.get("theme") != "light")) if hook else False})
        if action == "remote":
            res = set_remote(bool(data.get("enabled")))
            return ok(res)
        if action == "settings":
            return ok(save_app_settings(data))
        if action == "update":
            try:
                return ok(update_action(data))
            except ValueError as e:
                return bad(str(e))
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
        if action == "meeting-app":                         # 9.6 Spotlight: the meeting app it can control
            import meeting_keys
            return ok(meeting_keys.status())
        if action == "meeting-key":                         # 9.6 Spotlight: mute, camera, share, leave, PC volume
            import meeting_keys
            try:
                return ok(meeting_keys.send(str(data.get("act") or "")))
            except ValueError as e:
                return bad(str(e))
        if action == "annotate":                            # 9.7 Draw / Spotlight on the Share Window (this PC)
            try:
                return ok(annotate_op(data))
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
            # 6.8 the page's own window buttons and ribbon: {win: main/teleprompter/spotlight, op: minimize,
            # toggle-max, close, drag, hide, on-top (value)}
            hook = DESKTOP.get("win")
            if not hook:
                return ok({"desktop": False})
            return ok(dict(hook(str(data.get("win") or "main"), str(data.get("op") or ""), data) or {}, desktop=True))
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
        # 9.3 (audit L17): a body of the wrong shape (a list where an object belongs, a text where a number does) is
        # answered 400 instead of dropping the connection with a traceback in the log
        try:
            return self._do_post()
        except (TypeError, AttributeError, KeyError, ValueError) as e:
            _swallowed("server.do_POST " + urlparse(self.path).path, e)
            try:
                return self.reply(400, "Invalid data", "text/plain; charset=utf-8")
            except OSError:
                return None

    def _do_post(self):
        count_request(urlparse(self.path).path)
        if not self.host_ok() or not self.origin_ok() or self.cross_site_api(urlparse(self.path).path):
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
        if path == "/api/export/pptx":                   # M-D4: the service as a PowerPoint file, made on this PC
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                import pptx_export
                with cond:
                    plan = json.loads(json.dumps(state))
                body, _ = pptx_export.build(plan, LAYERS_DIR)
            except ImportError:
                return self.reply(501, json.dumps({"error": "PowerPoint export needs the python-pptx package (it comes with the installer)."}), TYPES[".json"])
            except (OSError, ValueError, KeyError, TypeError) as e:
                return self.reply(422, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, body, "application/vnd.openxmlformats-officedocument.presentationml.presentation")
        if path == "/api/meeting/workbook":
            # 6.9 Export this meeting to Excel: the template's Dashboard and Meeting Form, with this meeting filled in
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                meeting, tables = meeting_form.from_sheets(data if isinstance(data, dict) else {})
                body = meeting_form.fill((APP / "templates" / "FRAMEDECKS-Meeting-Workbook.xlsx").read_bytes(), meeting, tables)
            except (OSError, ValueError, KeyError, TypeError) as e:
                return self.reply(422, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, body, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        if path == "/api/ai/questions":                  # M-D3: discussion questions drafted from a Frame's scripture
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            d = data if isinstance(data, dict) else {}
            try:
                res = AI.discussion_questions(_passages_with_text(d.get("passages")), d.get("count") or 5)
            except ai.AiError as e:
                return self.reply(422, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(res), TYPES[".json"])
        if path == "/api/scripture/settings":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            d = data if isinstance(data, dict) else {}
            cur = scripture_settings()
            if "key" in d:
                cur["key"] = re.sub(r"[^A-Za-z0-9]", "", str(d.get("key") or ""))[:200]
            if d.get("translation") in ("ESV", "typed"):
                cur["translation"] = d["translation"]
            save_scripture_settings(cur)
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
        if path == "/api/pointer":
            return self.reply(200, json.dumps(pointer_set(data)), TYPES[".json"])
        if path == "/api/remote/memory":                # 9.1 the phone remote: paste, Show, Hide, Remove
            d = data if isinstance(data, dict) else {}
            if d.get("action") not in REMOTE_MEMORY_ACTIONS:
                return self.reply(400, json.dumps({"error": "Not available from the remote."}), TYPES[".json"])
            if d.get("action") == "add":
                d = dict(d, source="phone")
            try:
                res = memory_action(d)
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(dict(res, **remote_memory_body())), TYPES[".json"])
        if path == "/api/memory":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                res = memory_action(data if isinstance(data, dict) else {})
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(dict(res, **memory_body())), TYPES[".json"])
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
        if path == "/api/sync":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            action = data.get("action") if isinstance(data, dict) else None
            try:
                if action == "link":
                    return self.reply(200, json.dumps(SYNC.link_start()), TYPES[".json"])
                if action == "cancel":
                    return self.reply(200, json.dumps(SYNC.link_cancel()), TYPES[".json"])
                if action == "unlink":
                    return self.reply(200, json.dumps(SYNC.unlink()), TYPES[".json"])
                if action == "now":
                    SYNC.poke(0)
                    return self.reply(200, json.dumps(SYNC.info()), TYPES[".json"])
                if action == "resync":                             # 8.4 Resync Linked PCs: a round now, with its outcome
                    return self.reply(200, json.dumps(SYNC.resync()), TYPES[".json"])
            except (cloud_sync.Offline, cloud_sync.Refused, OSError) as e:
                return self.reply(503, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(400, json.dumps({"error": "Unknown action"}), TYPES[".json"])
        if path == "/api/remote-cloud/done":                       # the window's answers to those commands
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            CLOUD_BRIDGE.done(data.get("results") if isinstance(data, dict) else None)
            return self.reply(204, b"", "text/plain")
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


class MainServer(ThreadingHTTPServer):
    """The program's own server (127.0.0.1). 6.10: on Windows it asks for its port for itself alone. Windows lets
    SO_REUSEADDR bind a port that another program is still listening on, and then hands connections to either of
    them: a copy that had not finished closing got the window's requests, and the page said "refused to connect"."""
    allow_reuse_address = os.name != "nt"

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


# ---------- Is there a newer version? (audit roadmap step 2: tells, never downloads) ----------
# 7.0: updates come from FrameDecks servers (src/updater.py; docs/deployment/release-pipeline.md). Once a day the
# program asks https://api.framedecks.com/releases/latest; Settings > About shows a newer version with its notes and
# installs it on request (checked, silent, with the previous version put back if the install fails). Set
# FRAMEDECKS_NO_UPDATE_CHECK=1 to never ask; FRAMEDECKS_UPDATE_API points the check elsewhere (tests).
UPDATER = updater.Updater(DATA, APP_VERSION, frozen=FROZEN)


def version_tuple(v):
    return updater.version_tuple(v)


def check_for_update(timeout=10):
    """Ask the update service once; never raises."""
    return UPDATER.check(timeout)


def update_info():
    return UPDATER.info()


def on_screen(st=None):
    """Something the audience can see: a card, or Content of the live Frame. Updates wait until it is clear."""
    return cloud_sync.on_screen(state if st is None else st)


def update_action(data):
    """POST api/app/update: check · install (now, or when FrameDecks closes) · previous (put the earlier version back)."""
    what = str(data.get("action") or "")
    if what == "check":
        return check_for_update()
    if what in ("install", "previous"):
        if on_screen() and not data.get("force"):
            raise ValueError("Something is on screen. Hide all first, then update.")
        if data.get("whenClosed"):
            UPDATER.state["installOnExit"] = what
            return update_info()
        UPDATER.install("latest" if what == "install" else "previous", quit_app=DESKTOP.get("quit"))
        return update_info()
    if what == "cancel":
        UPDATER.state["installOnExit"] = False
        return update_info()
    raise ValueError("Unknown update action")


def install_on_exit():
    """Called as FrameDecks quits: "Update when I close FrameDecks" starts the install now (never raises)."""
    which = UPDATER.state.get("installOnExit")
    if not which:
        return
    UPDATER.state["installOnExit"] = False
    try:
        UPDATER.install("latest" if which == "install" else "previous")
    except Exception as _e:
        _swallowed("server.install_on_exit", _e)


def _update_loop():
    if os.environ.get("FRAMEDECKS_NO_UPDATE_CHECK"):
        return
    time.sleep(60)                                # not during start-up
    while True:
        check_for_update()
        time.sleep(24 * 3600)


def start_main_server():
    """Start listening on this PC only. Returns the server (or None if every port is taken)."""
    for port in PORTS:
        try:
            server = MainServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    else:
        return None
    server.daemon_threads = True
    MAIN["server"], MAIN["port"] = server, server.server_address[1]
    threading.Thread(target=vcam_start, daemon=True).start()   # idle until Zoom/Teams uses FrameDecks
    threading.Thread(target=_backup_loop, daemon=True).start()
    threading.Thread(target=_remote_watcher, daemon=True).start()
    threading.Thread(target=_update_loop, daemon=True).start()   # once a day: is a newer version published?
    SYNC.start()                                                # does nothing unless this PC is linked
    CLOUD_REMOTE.start()                                        # idle unless linked and switched on in Settings
    try:
        memory_sync()                  # 9.0 pinned Memory Cards from the last session go back into the chat overlay
    except Exception as e:
        print("Memory Cards:", e)
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
    print(f"  Scripture overlay:            {base}/focus-verse.html")
    print(f"  Question overlay:             {base}/discussion-question.html")
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
        print("  before it reaches this PC: run \"tools\\launchers\\Allow iPad Remote - run once.bat\".")
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
