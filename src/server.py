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
import gzip
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
from urllib.parse import urlparse, parse_qs, unquote, urlencode

import sync_entities   # what is live and what is plan (the same split as sync)
import cloud_remote   # Phase 5: running a service from the companion (only when linked and switched on)
import live_push      # 9.11: the doorbell (told when something changed instead of asking every few seconds)
import cloud_sync   # Phase 4: syncing service plans with a workspace (only when this PC is linked)
import legacy   # 6.9: moves data saved under the program's earlier name
import winapi   # 7.1.1: Windows jobs through Windows' own interfaces (no PowerShell, netsh or taskkill)
import meeting_form   # 6.9: fills the Meeting Workbook's form for Export
import updater   # 7.0: updates from FrameDecks servers (checked, silent, with rollback)
from media_names import safe_name   # 9.1.2 media file names are never paths
import meeting_notes  # 9.12 the leader's private notes (Command Center > Notes)
import songbook       # 26.11.57 the Song Library (one per church, on this PC)
import meeting_log  # 26.11.23 what was shown, for the meeting summary
import features as FEAT   # 26.11.31 features you switch on or off (Settings > Start here > Features)
import prayer_wall  # 26.11.23 prayer requests from phones in the meeting
import member_room  # 26.11.24 members' phones: follow along and the sermon notes
import join_qr  # 26.11.44 the members' phones link as a QR code (the code's card, the Branding badge)
import slides  # 26.11.45 PowerPoint slides: what each slide holds, thumbnails, the run order
import leader_alerts  # 26.11.25 the leader's corner card while the Studio is behind the meeting
import voice_follow   # 26.11 the Teleprompter's Follow my voice (listens only while it is on)
import scripture_listen   # 26.11.14 Listen for scripture (only while it is on and a Frame is live)
import voice_commands   # 26.11.20 Voice commands, hold to talk (only while on, live and held)
import memory    # 9.0: Memory Cards in the FrameDecks vCam chat overlay (docs/architecture/memory-cards.md)
import dpapi_file   # 26.11.58 (release sign-off L3): the member file encrypted for this Windows account

APP_VERSION = "26.11.58"
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
SESSION_DAYS = 7                # 26.11.58 (release sign-off M1): a phone stays signed in at most a week (was 30 days)
SESSION_IDLE = 12 * 3600        # 26.11.58 (release sign-off M1): and a sign-in unused for 12 hours ends
SESSION_SAVE_EVERY = 600        # last-used times are written to the sessions file at most every 10 minutes
COOKIE = "kc_remote"
# What a signed-in phone or iPad may open. Member data and the dashboard are never on this list.
REMOTE_PUBLIC = {"/remote.html", "/css/remote.css", "/js/remote.js", "/js/store.js", "/js/brand.js", "/api/remote-login",
                 "/js/chips.js", "/js/icons.js", "/js/notes-pad.js", "/css/notes-pad.css",   # 9.13 the chips and the Notes pad
                 "/js/features.js",       # 26.11.31 which features are on (the phone hides what is off)
                 "/js/timing.js",         # 26.11.33 the timing plan, for the leader
                 "/js/teleprompter.js", "/css/teleprompter.css", "/js/remote-memory.js", "/js/remote-listen.js",
                 "/js/remote-voice.js",
                 "/js/slide-sorter.js", "/css/slides.css",   # 26.11.45 every slide at once
                 "/remote-manifest.json", "/icons/remote-180.png", "/icons/remote-192.png", "/icons/remote-512.png",
                 "/icons/favicon-16.png", "/icons/favicon-32.png",
                 "/icons/remote-maskable-512.png", "/img/framedecks-emblem.webp"}
REMOTE_SIGNED_IN = {"/api/rev", "/api/state", "/api/remote-logout", "/js/overlay.js", "/api/remote/studio", "/api/brand/logo", "/api/join-qr.svg", "/api/remote/live.jpg",
                    "/api/slides", "/api/slides/thumb",
                    "/api/remote/memory", "/api/pointer", "/api/remote/notes", "/api/remote/verse-listen",
                    "/api/remote/meeting-key", "/api/remote/voice-commands",
                    "/css/overlay.css", "/stage.html", "/focus-verse.html", "/discussion-question.html", "/birthday.html",
                    # 26.11.57 the stage screen for musicians and speakers, on a tablet signed in to the phone remote
                    "/stage-display.html", "/js/stage-display.js", "/css/stage-display.css", "/css/dashboard.css", "/css/theme.css"}
sessions_lock = threading.Lock()
failures = {}  # ip -> [count, locked_until]  (9.1.2: count keeps growing until a right PIN; the wait doubles)
login_lock = threading.Lock()   # 9.1.2 one PIN check at a time: parallel guesses cannot slip past the lockout
login_recent = []               # 9.1.2 times of wrong PINs from any device (the limit for all devices together)
MAX_LOGIN_FAILS = 100           # wrong PINs from all devices in 10 minutes before everyone waits (slows a many-address attack)
known_devices = set()           # 26.11.58 (audit L1) addresses that have signed in with the right PIN: not held up by the
                                # limit for all devices, so another device's guessing cannot lock out the church's own phones
MAX_PUBLIC_BODY = 4096          # 9.1.2 a request from a device that has not signed in (the PIN form) is small
MAX_CONN_PER_IP = 24            # 9.1.2 open connections one other device may hold (the remote uses about 4)
conn_lock = threading.Lock()
conn_count = {}                 # ip -> open connections (other devices only)


def write_atomic(path, text):
    """9.1.2 Write a settings file so a power cut or a full disk never leaves it empty or half written: a temporary
    file next to it, flushed to disk, then swapped in."""
    path = Path(path)
    tmp = path.with_name(path.name + ".tmp")
    with (open(tmp, "wb") if isinstance(text, bytes) else open(tmp, "w", encoding="utf-8")) as f:   # 26.11.58 bytes too
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


def _session_entry(value, now):
    """26.11.58 (release sign-off M1): one sign-in as {"exp": ends at, "used": last used}. Files written before this
    version hold only the end time (a number): it is cut to SESSION_DAYS from now and counts as used now."""
    longest = now + SESSION_DAYS * 86400
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return {"exp": min(float(value), longest), "used": now}
    if isinstance(value, dict) and isinstance(value.get("exp"), (int, float)) and isinstance(value.get("used"), (int, float)):
        return {"exp": min(float(value["exp"]), longest), "used": min(float(value["used"]), now)}
    return None


def session_alive(entry, now=None):
    """Not past its end and used within SESSION_IDLE."""
    now = time.time() if now is None else now
    return bool(entry) and entry["exp"] > now and now - entry["used"] < SESSION_IDLE


def load_sessions():
    try:
        data = json.loads(SESSIONS_FILE.read_text(encoding="utf-8"))
        now = time.time()
        out = {}
        for k, v in (data.items() if isinstance(data, dict) else []):
            e = _session_entry(v, now)
            if session_alive(e, now):
                out[k] = e
        return out
    except (OSError, ValueError):
        return {}


_sessions_saved = {"at": 0.0}


def save_sessions():
    _sessions_saved["at"] = time.time()
    try:
        write_atomic(SESSIONS_FILE, json.dumps(sessions))
    except OSError:
        pass


sessions = load_sessions()


# ---------- 26.11.58 (release sign-off L2): the program's own key for requests from this PC ----------
# Any program on this PC (another Windows account on the same computer too) could reach 127.0.0.1 and use the whole
# API, member data included. Now a random key made once per installation, kept in the data folder (which only this
# Windows account can read), must come with every change and every request for personal data or settings. The
# program's own windows open their first page with ?t=KEY; the server answers with an HttpOnly cookie and the same
# address without the key. Overlay, stage and Share Window pages and the read-only requests they make (OBS, a second
# screen) never need it, so existing OBS setups keep working. The phone remote keeps its own PIN and cookie.
# The key is never sent in an answer, never in the support bundle and never copied by Import from another folder.
# KC_LOCAL_TOKEN=off switches the check off (development only).
LOCAL_TOKEN_FILE = DATA / "kc-local-token.txt"
LOCAL_COOKIE = "fd_local"
LOCAL_HEADER = "X-FrameDecks-Key"          # for programs on this PC that read the key file (the second start, checks)
LOCAL_COOKIE_DAYS = 400
# Read-only requests the overlay, stage and Share Window pages make (store.js, overlay.js, present.html)
LOCAL_OPEN_GET = {"/api/rev", "/api/state", "/api/pointer", "/api/join-qr.svg", "/api/brand/logo", "/api/presence",
                  "/api/app/ping", "/api/present.mjpg", "/api/vcam/status", "/api/vcam/preview.jpg"}
LOCAL_OPEN_POST = {"/api/presence"}        # overlays say they are open (Store.presence)
LOCAL_KEY_PAGES = {"/", "", "/dashboard.html"}   # the Studio itself: without the key a short page says how to open it
LOCAL_KEY_ERROR = ("This needs FrameDecks' own window. Open FrameDecks from its icon, or use the address with the key "
                   "that FrameDecks printed when it started.")
LOCAL_KEY_PAGE = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>FrameDecks</title>'
                  '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;min-height:100vh;'
                  'display:flex;align-items:center;justify-content:center;background:#070c18;color:#e8edf7;'
                  'font:16px/1.5 "Segoe UI",system-ui,sans-serif}main{max-width:34em;padding:24px}h1{font-size:22px}</style>'
                  '</head><body><main><h1>Open FrameDecks from its own window</h1><p>For your privacy, the Studio opens only '
                  'from FrameDecks itself. Open FrameDecks from its icon. If you started it from a command window, use the '
                  'Dashboard address it printed (it ends with a key).</p><p>Overlay links in OBS keep working as before.</p>'
                  '</main></body></html>')


def _local_token():
    try:
        tok = LOCAL_TOKEN_FILE.read_text(encoding="utf-8").strip()
        if re.fullmatch(r"[A-Za-z0-9_\-]{40,100}", tok):
            return tok
    except OSError:
        pass
    tok = secrets.token_urlsafe(32)
    try:
        write_atomic(LOCAL_TOKEN_FILE, tok + "\n")
    except OSError as e:
        _swallowed("server.local_token", e)
    return tok


LOCAL_TOKEN = _local_token()


def local_key_needed():
    """False only while KC_LOCAL_TOKEN=off (development and some tests)."""
    return os.environ.get("KC_LOCAL_TOKEN", "").strip().lower() not in ("off", "0", "no", "false")


def local_url(base, page=""):
    """The address of one of the program's pages with the key, for the program's own windows to open once."""
    url = base.rstrip("/") + "/" + page.lstrip("/")
    if not local_key_needed():
        return url
    return url + ("&" if "?" in url else "?") + "t=" + LOCAL_TOKEN


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
        if "deck_live" in globals():                   # 26.11.45 live.deck: the slide on screen, kept by the server
            deck_live(new)
        if "join_live" in globals():                   # 26.11.44 live.join is the server's: the open room, the setting
            j = join_live() if "ROOM" in globals() and ROOM.is_open() else None
            if j:
                new.setdefault("live", {})["join"] = j
            elif isinstance(new.get("live"), dict):
                new["live"].pop("join", None)
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
        if "MEETING_LOG" in globals() and feature_on("summary"):
            MEETING_LOG.observe(state)     # 26.11.23 the meeting summary: what went on screen, and when
        if "ROOM" in globals():
            ROOM.poke()                    # 26.11.24 members' phones follow the screen
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
        if "DOORBELL" in globals():
            DOORBELL.activity()            # in use: keep listening for a while
        return state


atexit.register(flush_state)
DISK["plan"] = plan_fingerprint(state)                    # the plan as loaded: a first live press is not a plan change


# ---------- 26.11.58 (release sign-off M2): what a signed-in phone may change in the saved state ----------
# The phone remote sends the whole state it holds (KCStore.update), but it only runs the meeting: what is live, the
# cards on screen, a Frame's Content shown or hidden, the next item, a song's verse, a deck's slide order and the
# meeting shown. Everything else (the library, the Frames and their Content, the brand, the meeting details) is taken
# from the PC's own saved state, so a phone cannot replace the plan. The PC's own windows keep sending everything.
REMOTE_TAKE_WHOLE = ("question", "verse", "birthday", "layout")   # the cards on screen and where they sit (a Frame's look)
REMOTE_LAYER_C = {                                                 # a layer's own fields the phone's helpers change
    "question": ("itemId",), "scripture": ("itemId",), "song": ("at", "title", "text"),
    "pdf": ("order", "skip", "nophone"), "window": ("order", "skip", "nophone"),
}
QUESTION_MODES = ("", "question", "both", "verse")


def _int_list(v):
    return [int(x) for x in v if isinstance(x, (int, float)) and not isinstance(x, bool)][:2000] if isinstance(v, list) else None


def _remote_layer(cur, ph):
    """Copy only a layer's run-time fields from the phone's copy (ph) into the PC's (cur)."""
    if not isinstance(ph, dict):
        return
    if isinstance(ph.get("visible"), bool):
        cur["visible"] = ph["visible"]
    c, pc = cur.get("c"), ph.get("c")
    if not isinstance(c, dict) or not isinstance(pc, dict):
        return
    for key in REMOTE_LAYER_C.get(cur.get("kind"), ()):
        if key not in pc:
            continue
        v = pc[key]
        if key in ("order", "skip", "nophone"):
            v = _int_list(v)
            if v is not None:
                c[key] = v
        elif key == "at":
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                c[key] = int(v)
        elif isinstance(v, str):
            c[key] = v[:40] if key == "itemId" else v[:4000]
    if cur.get("kind") == "question" and isinstance(c.get("items"), list) and isinstance(pc.get("items"), list):
        modes = {it.get("id"): it.get("mode") for it in pc["items"] if isinstance(it, dict)}
        for it in c["items"]:                                   # Question · Both · Scripture remembered per question
            if isinstance(it, dict) and it.get("id") in modes and modes[it.get("id")] in QUESTION_MODES:
                it["mode"] = modes[it.get("id")]


def _remote_scenes(cur_scenes, ph_scenes):
    """The PC's Frames stay as they are (which Frames, their Content, names, order); only run-time fields follow."""
    if not isinstance(cur_scenes, list) or not isinstance(ph_scenes, list):
        return
    ph_by_id = {sc.get("id"): sc for sc in ph_scenes if isinstance(sc, dict)}
    for sc in cur_scenes:
        ph = ph_by_id.get(sc.get("id")) if isinstance(sc, dict) else None
        if not isinstance(ph, dict):
            continue
        for key in ("modified", "version"):                     # Scenes.stamp after Question · Both · Scripture
            if isinstance(ph.get(key), (int, float)) and not isinstance(ph.get(key), bool):
                sc[key] = ph[key]
        ph_layers = {l.get("id"): l for l in ph.get("layers") or [] if isinstance(l, dict)}
        for layer in sc.get("layers") or []:
            if isinstance(layer, dict) and layer.get("id") in ph_layers:
                _remote_layer(layer, ph_layers[layer["id"]])


def _meetings_of(st):
    """The same list as meetingsOf in app/js/store.js: meeting.meetings, else one meeting made from the details."""
    m = st.get("meeting") if isinstance(st.get("meeting"), dict) else {}
    out = [dict(e) for e in m.get("meetings") or [] if isinstance(e, dict) and str(e.get("id") or "").strip()
           and str(e.get("name") or "").strip()]
    if not out:
        out = [{"id": "main", "name": str(m.get("title") or "").strip()[:60] or "Meeting",
                "date": str(m.get("date") or ""), "notes": str(m.get("notes") or "")}]
    return out


def _current_meeting(st, items):
    live = st.get("live") if isinstance(st.get("live"), dict) else {}
    meeting = st.get("meeting") if isinstance(st.get("meeting"), dict) else {}
    title = str(meeting.get("title") or "").strip().lower()
    for m in items:
        if m["id"] == live.get("meeting"):
            return m
    for m in items:
        if str(m["name"]).lower() == title:
            return m
    return items[0]


def _switch_meeting(st, target):
    """Scenes.switchMeeting on the PC's own state: show another meeting (the phone only names which)."""
    items = _meetings_of(st)
    cur = _current_meeting(st, items)
    to = next((m for m in items if m["id"] == target), None)
    if to is None:
        return False
    if not isinstance(st.get("meeting"), dict):
        st["meeting"] = {}
    meeting = st["meeting"]
    for m in items:
        if m["id"] == cur["id"]:
            m["date"], m["notes"] = meeting.get("date", ""), meeting.get("notes", "")
    meeting["meetings"] = items
    meeting["title"], meeting["date"], meeting["notes"] = to["name"], to.get("date", ""), to.get("notes", "")
    st["live"]["meeting"] = to["id"]
    return True


def remote_state_merge(cur, phone):
    """The state to save when a signed-in phone sends its copy: the PC's state with the phone's run-time changes."""
    new = json.loads(json.dumps(cur))
    new.pop("rev", None)
    cur_live = cur.get("live") if isinstance(cur.get("live"), dict) else {}
    want = None
    if isinstance(phone.get("live"), dict):
        live = json.loads(json.dumps(phone["live"]))
        want = live.get("meeting")
        live["meeting"] = cur_live.get("meeting", "")           # changed only through _switch_meeting below
        new["live"] = live
    elif not isinstance(new.get("live"), dict):
        new["live"] = {}
    for key in REMOTE_TAKE_WHOLE:
        if isinstance(phone.get(key), dict):
            new[key] = phone[key]
    _remote_scenes(new.get("scenes"), phone.get("scenes"))
    if isinstance(want, str) and want and want != cur_live.get("meeting"):
        _switch_meeting(new, want)
    return new


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
        deck = live.get("deck") if isinstance(live.get("deck"), dict) else {}
        if l["kind"] == "pdf":
            pptx = deck_live_pptx(l, c["file"])
            if pptx:
                c["live"] = pptx                       # 26.11.46 PowerPoint plays it: animations, transitions, videos
        if l["kind"] == "pdf" and deck.get("layer") == c["id"] and isinstance(deck.get("page"), int):
            c["page"] = deck["page"]                   # 26.11.45 the slide on screen is the live state's (live.deck)
            z = deck.get("zoom")
            if isinstance(z, dict) and z.get("s", 1) > 1:
                c["zoom"] = z                          # 26.11.45 zoom into part of the slide
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
NOTES = meeting_notes.Notes(str(DATA / "notes"))   # 9.12 one file per meeting, this PC only
SONGS = songbook.Songbook(str(DATA / "kc-songs.json"))   # 26.11.57 the Song Library
MEETING_LOG = meeting_log.MeetingLog(str(DATA / "meetings-log"))   # 26.11.23 one file per meeting run, this PC only
atexit.register(MEETING_LOG.flush)


def meeting_summary(rid="latest"):
    """26.11.23 the one-page summary of a meeting run (the last one by default), with each Frame's planned minutes."""
    plan = {}
    for sc in state.get("scenes") or []:
        if isinstance(sc, dict) and sc.get("name") and isinstance(sc.get("plan"), (int, float)) and sc.get("plan") > 0:
            plan.setdefault(sc["name"], sc["plan"])
    return meeting_log.summary(MEETING_LOG.get(rid), plan)
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
    on = bool(on) and feature_on("memory")          # 26.11.31 never while Memory Cards is switched off
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
# (many elements are placed that way). 26.11.30 (release audit M1): enforced. It ran report-only from 9.3 with no
# page breaking a rule; tests/visual/csp.mjs still opens every page and fails on any rule a page breaks.
# H1: frame-ancestors is only honoured when enforced, so another website could show the Studio inside a hidden frame
# and steer clicks; X-Frame-Options says the same to older engines.
CSP_HEADER = "Content-Security-Policy"
PAGE_FRAME_HEADER = ("X-Frame-Options", "SAMEORIGIN")
CSP_BASE = ("default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
            "media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; "
            "frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'")
_INLINE_SCRIPT = re.compile(rb"<script>(.*?)</script>", re.S)


def page_csp(html):
    """The policy for one page: CSP_BASE with script-src naming the page's inline scripts by SHA-256."""
    hashes = "".join(" 'sha256-" + base64.b64encode(hashlib.sha256(m.group(1)).digest()).decode("ascii") + "'"
                     for m in _INLINE_SCRIPT.finditer(html))
    return f"{CSP_BASE}; script-src 'self'{hashes}"


REMOTE_MEETING_ACTS = ("mute", "camera")   # 26.11.15 the phone may mute and switch the camera, never Leave or Share
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
    drawings; {op: 'spot', x, y, snap?} a quick circle (snap: on the word there, 9.12.1). Returns the mode and the index of an added stroke."""
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
        # 9.12.1 a double-click (or Ctrl twice) on the Share Window: the main window finds the word at that point of the
        # picture and lights it with this PC's Spotlight look; without it (or with no words there) the point is lit
        hook = DESKTOP.get("spot_word")
        if d.get("snap") and hook:
            try:
                if hook(_num(d.get("x"), 0, 1, 0.5), _num(d.get("y"), 0, 1, 0.5)):
                    return {"ok": True}
            except Exception as e:
                print("Spotlight word:", e)
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
    """What the phone remote sees of Capture Chats: the cards and which are on screen (no PC settings)."""
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


def remote_notes_body(meeting, show):
    """9.13 what the phone remote sees of the leader's notes: whether it may add and read, how many there are, and the
    notes themselves only when reading is allowed on this PC and the phone asked to show them."""
    cfg = app_settings()
    data = NOTES.get(meeting)
    out = {"canAdd": bool(cfg["remoteNotesAdd"]), "canRead": bool(cfg["remoteNotesRead"]), "count": len(data["notes"]),
           "meeting": data["meeting"]}
    if out["canRead"] and show:
        out.update(name=data["name"], notes=data["notes"])
    return out


def remote_notes_action(data):
    """POST /api/remote/notes {action: 'add', meeting, text, name?, frame?}: the phone adds a note (when allowed). It
    never edits or deletes; the reply carries the count, not the notes."""
    if not isinstance(data, dict) or data.get("action") != "add":
        raise ValueError("Not available from the remote.")
    if not app_settings()["remoteNotesAdd"]:
        raise ValueError("Notes from the phone are off on the PC.")
    NOTES.add(data.get("meeting"), data.get("text"), name=str(data.get("name") or ""), frame=str(data.get("frame") or ""))
    return remote_notes_body(data.get("meeting"), False)


# 26.11 Follow my voice: listens only while the Teleprompter has it on (src/voice_follow.py)
VOICE = voice_follow.VoiceFollow(DATA, frozen=FROZEN, settings=lambda: app_settings(),
                                 available=os.name == "nt" or os.environ.get("FRAMEDECKS_VOICE") == "1")
atexit.register(VOICE.shutdown)


# 26.11.14 Listen for scripture: the microphone only while the setting is on and a Frame is live (src/scripture_listen.py)
def _frame_is_live():
    live = state.get("live") if isinstance(state, dict) else None
    return bool(isinstance(live, dict) and live.get("scene"))


_REF = re.compile(r"^\s*((?:[123]\s+)?[A-Za-z][A-Za-z ]*?)\s+(\d+)\s*:\s*(\d+)(?:\s*[-\u2013\u2014]\s*(\d+))?\s*$")


def _plan_passage(ref):
    """26.11.15 the meeting's own Scripture Deck item holding a spoken reference, the live Frame's first: said
    "Romans 8:38" while the plan has "Romans 8:38-39" offers the planned passage, which the Studio then shows from
    the plan itself (no lookup: instant, and it works offline). None when the plan does not have it."""
    st = state if isinstance(state, dict) else {}
    want_book = str(ref.get("book") or "").lower().rstrip("s")
    live_id = (st.get("live") or {}).get("scene") if isinstance(st.get("live"), dict) else ""
    scenes = [x for x in st.get("scenes") or [] if isinstance(x, dict)]
    scenes.sort(key=lambda x: x.get("id") != live_id)
    for sc in scenes:
        for layer in sc.get("layers") or []:
            if not isinstance(layer, dict) or layer.get("kind") != "scripture":
                continue
            for it in ((layer.get("c") or {}).get("items") or []):
                m = _REF.match(str((it or {}).get("ref") or ""))
                if not m or m.group(1).strip().lower().rstrip("s") != want_book or int(m.group(2)) != ref.get("chapter"):
                    continue
                lo, hi = int(m.group(3)), int(m.group(4) or m.group(3))
                end = ref.get("to") or ref.get("verse")
                if lo <= int(ref.get("verse") or 0) and end <= hi:
                    r = "%s %d:%d" % (m.group(1).strip(), int(m.group(2)), lo) + ("-%d" % hi if hi != lo else "")
                    return {"ref": r, "label": r.replace("-", "\u2013")}
    return None


VERSE_LISTEN = scripture_listen.ScriptureListen(VOICE, settings=lambda: app_settings(), is_live=_frame_is_live,
                                                planned=_plan_passage)
VERSE_MODES = {"off": (False, False), "ask": (True, False), "auto": (True, True)}


# ---------- 26.11.22 crash-proof live: after a crash the live Frame is put back and the Studio says so ----------
RUNNING_FLAG = DATA / "kc-running.flag"
SETTINGS_NEVER_RESET = ("guide", "onboarding")     # progress, not preferences
RECOVERED = None


def mark_running():
    """At start: a flag left behind means the last run did not close normally. If a Frame was live then, it is live
    again now (the state is saved), and RECOVERED tells the Studio to say so once."""
    global RECOVERED
    try:
        crashed = RUNNING_FLAG.exists()
        RUNNING_FLAG.write_text(str(int(time.time())), encoding="utf-8")
    except OSError:
        return
    sid = (state.get("live") or {}).get("scene")
    if crashed and sid:
        sc = next((x for x in state.get("scenes") or [] if x.get("id") == sid), None)
        RECOVERED = {"frame": (sc or {}).get("name") or "The live Frame", "at": int(time.time() * 1000)}


def clear_running():
    try:
        RUNNING_FLAG.unlink()
    except OSError:
        pass


atexit.register(clear_running)


# ---------- 26.11.20 Voice commands, hold to talk (src/voice_commands.py) ----------
def _key_down():
    try:
        import desktop_win
        return desktop_win.key_down if desktop_win.IS_WIN else None
    except Exception:
        return None


CC_GROUPS = ("prepare", "engage", "control", "notes", "more")
CC_TOOLS = ("draw", "spot")


def spotlight_then(value):
    """26.11.42 a request to open the Command Center on a chip, and optionally start Draw or Spotlight there:
    {"open": "engage", "tool": "draw"} -> the same, checked; anything else -> None."""
    if not isinstance(value, dict):
        return None
    group = value.get("open")
    if group not in CC_GROUPS:
        return None
    out = {"open": group}
    if value.get("tool") in CC_TOOLS and group == "engage":
        out["tool"] = value["tool"]
    return out


def _voice_names():
    """26.11.27 what a voice command may name: every Frame (not the templates), and the live Frame's Scripture and
    Question Decks by their own names. 26.11.41 with each Frame's Also called, and the live Frame's id."""
    st = state if isinstance(state, dict) else {}
    scenes = [x for x in st.get("scenes") or [] if isinstance(x, dict) and not x.get("tpl")]
    live_id = (st.get("live") or {}).get("scene") if isinstance(st.get("live"), dict) else ""
    live = next((x for x in scenes if x.get("id") == live_id), None) or {}
    # 26.11.41 each Frame's "Also called" names, and which one is live ("the next day")
    return {"live": live_id, "frames": [{"id": x.get("id"), "name": x.get("name"), "aka": str(x.get("aka") or "")[:200]} for x in scenes[:300]],
            "decks": [{"kind": l.get("kind"), "name": l.get("name")} for l in live.get("layers") or []
                      if isinstance(l, dict) and l.get("kind") in ("scripture", "question")],
            "slides": _deck_words(st)}


def _deck_words(st):
    """26.11.45 the words of the slides on screen (titles first), so "the slide about grace" can be heard."""
    d = (st.get("live") or {}).get("deck") if isinstance(st.get("live"), dict) else None
    if not isinstance(d, dict) or not d.get("file"):
        return []
    try:
        return slides.words(slides.info(LAYERS_DIR, d["file"])["slides"])
    except Exception as e:
        _swallowed("deck_words", e)
        return []


VOICE_CMD = voice_commands.VoiceCommands(VOICE, settings=lambda: app_settings(), is_live=_frame_is_live,
                                         show_verse=lambda text: (VERSE_LISTEN.ask(text) or {}).get("label"),
                                         confirm=VERSE_LISTEN.confirm, names=_voice_names, key_down=_key_down())


def voice_commands_action(d, remote=False):
    """POST /api/voice-commands (this PC) and /api/remote/voice-commands (a signed-in phone or tablet):
    {op: "hold", on: bool} (the hold buttons) · {op: "search", on, words} (26.11.28 the Command Center's search box) ·
    {op: "enable", value: bool} · {op: "done", n, ok, msg} (the Studio ran
    it) · {op: "say", text} (as if it had been said: tests, this PC only). The phone may only hold."""
    d = d if isinstance(d, dict) else {}
    op = str(d.get("op") or "")
    if op == "hold":
        return VOICE_CMD.hold(bool(d.get("on")), "phone" if remote else "button")
    if remote:
        raise ValueError("Not available from the remote.")
    if op == "search":                                  # 26.11.28 the Command Center's search box has focus (or not)
        words = d.get("words") if isinstance(d.get("words"), list) else []
        return VOICE_CMD.search(bool(d.get("on")), [str(w)[:200] for w in words[:600]])
    if op == "enable":
        if d.get("value") and not feature_on("voice"):
            raise ValueError("Voice commands are switched off (Settings → Start here → Features).")
        save_app_settings({"voiceCommands": bool(d.get("value"))})
        VOICE_CMD.tick()
        return VOICE_CMD.body()
    if op == "done":
        try:
            n = int(d.get("n"))
        except (TypeError, ValueError):
            raise ValueError("Which command?")
        return VOICE_CMD.done(n, bool(d.get("ok", True)), d.get("msg"))
    if op == "say":
        VOICE_CMD.heard(str(d.get("text") or "")[:300], True)
        return VOICE_CMD.body()
    raise ValueError("Unknown action.")
# ---------- end 26.11.20 Voice commands ----------


# ---------- 26.11.20 riders: small change counters that travel with a window's one waiting request for the state ----
RIDERS = {"vl": lambda: VERSE_LISTEN.seq, "vc": lambda: VOICE_CMD.seq, "mem": lambda: MEMORY.rev,
          "ft": lambda: FEATURE_STATE["rev"],        # 26.11.31 the features switched on or off
          "pr": lambda: "%s.%s" % (PRAYER.rev, ROOM.rev)}   # 26.11.23 the prayer wall; 26.11.24 members' phones
RIDER_SLICE = 0.12        # how often a waiting request looks at the riders (they change on other threads)


def riders_asked(text):
    """"vl:5,vc:-1,mem:7" -> {"vl": "5", ...}: what the page last saw of each (only known names; this PC only)."""
    out = {}
    for part in str(text or "").split(",")[:8]:
        name, _, seen = part.partition(":")
        if name in RIDERS:
            out[name] = seen[:20]
    return out


def riders_now(asked):
    return {name: RIDERS[name]() for name in asked}


def riders_moved(asked):
    return any(str(RIDERS[name]()) != seen for name, seen in asked.items())


def verse_listen_action(d, remote=False):
    """POST /api/verse-listen (this PC) and /api/remote/verse-listen (a signed-in phone or tablet). 26.11.14 the same
    switch on every surface: {op: "mode", value: "off" | "ask" | "auto"} (Ask: a reference is offered first; Auto: it
    goes on screen at once), and Show / Dismiss for the waiting suggestion. The phone cannot type words in ("hear") or
    report a passage shown ("shown"): only the Studio shows it."""
    d = d if isinstance(d, dict) else {}
    op = str(d.get("op") or "")
    if op == "mode":
        mode = VERSE_MODES.get(str(d.get("value") or ""))
        if not mode:
            raise ValueError("Choose off, ask or auto.")
        if mode[0] and not feature_on("listen"):
            raise ValueError("Listen for scripture is switched off (Settings → Start here → Features).")
        save_app_settings({"scriptureListen": mode[0], "scriptureAuto": mode[1]})
        VERSE_LISTEN.tick()                                    # start or stop listening now, not at the next check
        return VERSE_LISTEN.body()
    if remote and op not in ("show", "dismiss", "replay"):   # never "hear", "shown" or "failed": only this PC
        raise ValueError("Not available from the remote.")
    return VERSE_LISTEN.act(op, d.get("id"), d.get("text"))
# ---------- end 26.11.14 Listen for scripture ----------


def voice_action(data):
    """{op: start, words} | {op: words, words} | {op: stop} | {op: remove} (the downloaded voice files)"""
    op = data.get("op")
    words = data.get("words")
    if op in ("start", "words") and not isinstance(words, list):
        raise ValueError("words must be a list")
    if op == "start":
        if not feature_on("follow"):
            raise ValueError("Follow my voice is switched off (Settings → Start here → Features).")
        return VOICE.start(words)
    if op == "words":
        return VOICE.words(words)
    if op == "stop":
        return VOICE.stop()
    if op == "remove":
        VOICE.remove_files()
        return {"state": "off", "removed": True}
    raise ValueError("Unknown voice action.")


def notes_action(data):
    """POST /api/notes {action: add|edit|delete|clear, meeting, name?, text?, frame?, id?} (this PC only). The leader's
    private notes: kept in <data>/notes, never synced, never sent to the phone, never in the diagnostics file."""
    act, meeting = str(data.get("action") or ""), data.get("meeting")
    if act == "add":
        note, res = NOTES.add(meeting, data.get("text"), name=str(data.get("name") or ""), frame=str(data.get("frame") or ""))
        return dict(res, added=note)
    if act == "edit":
        return NOTES.edit(meeting, str(data.get("id") or ""), data.get("text"))
    if act == "delete":
        return NOTES.delete(meeting, str(data.get("id") or ""))
    if act == "clear":
        return NOTES.clear(meeting)
    raise ValueError("Unknown action.")


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
        MEETING_LOG.count("memory")
    elif act == "showmany":                            # 9.1 Show on several selected cards
        ids = data.get("ids") if isinstance(data.get("ids"), list) else []
        shown = MEMORY.show_many(ids[:memory.MAX_ITEMS])
        if not shown:
            raise ValueError("Those cards are no longer there.")
        res = {"shown": len(shown)}
        MEETING_LOG.count("memory", len(shown))
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


# ---------- 26.11.23 the prayer requests wall (src/prayer_wall.py; 0019_prayer_wall.sql) ----------
PRAYER = prayer_wall.PrayerWall(lambda: SYNC._team(), on_received=lambda n: MEETING_LOG.count("prayer.received", n))


def _prayer_card(title, text, stay=False, qr=""):
    """Something from the members' side on screen (a prayer request, the "We're praying for" list, a poll's results, the
    members' phones code), as a Memory Card with this title and text. 26.11.43: on every screen, the Share Window too
    (the leader chose to show it), found again by its text even just after it was removed, and with stay it stays until
    it is taken off instead of for the overlay's seconds. 26.11.44 qr: the link the card shows as a QR code to scan."""
    item = MEMORY.put(title, text, "phone", stay, qr)
    if not item:
        raise ValueError("That could not be shown.")
    memory_sync()
    return item["id"]


_INVITE = {"id": ""}          # 26.11.43 the members' phones code card while it is on screen


def invite_on_screen():
    """Whether the members' phones code is on screen now."""
    return bool(_INVITE["id"]) and any(c["id"] == _INVITE["id"] for c in MEMORY.overlay(app_settings()["memDur"])[0])


def invite_off():
    if _INVITE["id"]:
        MEMORY.hide(_INVITE["id"])
        _INVITE["id"] = ""
        memory_sync()


def join_live():
    """26.11.44 live.join: the members' phones link and where the Branding badge shows it as a QR code (beside or below
    the logo), while members' phones is open and Settings -> Meeting & Branding asks for it; None otherwise. The camera
    (vcam/program.py) and the overlay pages (overlay.js, /api/join-qr.svg) draw it on the badge."""
    if "ROOM" not in globals() or not ROOM.is_open() or not feature_on("team"):
        return None
    pos = app_settings().get("joinQr", "off")
    b = ROOM.body()
    if pos not in ("beside", "below") or not join_qr.valid(b["url"]):
        return None
    return {"url": b["url"], "code": b["code"], "pos": pos}


def join_refresh():
    """Put live.join in step at once (members' phones opened or closed, the setting changed): save_state sets it."""
    if (state.get("live") or {}).get("join") != join_live():
        update_state(lambda st: st)


ROOM = member_room.MemberRoom(lambda: SYNC._team(), lambda: state,
                              prayer_code=lambda: PRAYER.code if PRAYER.is_open() else "")


def _linked(call):
    """A workspace call from the leader's dialog: "not connected" says where to connect."""
    try:
        return call()
    except cloud_sync.Refused as e:
        if getattr(e, "code", "") == "42501" or "not connected" in str(e):
            raise ValueError("Members' phones need this PC connected to your FrameDecks workspace: "
                             "Settings \u2192 Sync \u2192 Add a device.")
        raise ValueError(str(e))


MEMBERS_FOCUS = {"n": 0}       # 26.11.25 the corner card's "All requests": the Studio opens Members' phones


def members_body():
    return {"room": ROOM.body(), "prayer": PRAYER.body(), "focus": MEMBERS_FOCUS["n"], "codeOnScreen": invite_on_screen()}


# ---------- 26.11.33 quick responses and polls from members' phones (src/room_responses.py; 0022_room_polls.sql) ----------
import room_responses  # noqa: E402

RESPONSES = room_responses.RoomResponses(lambda: SYNC._team(), room_open=lambda: ROOM.is_open())


def room_response_http(handler, data=None):
    """GET /api/room/response (the question and its counts, polled by the dialog) and POST {op: open|close|show}
    (this PC only). Show puts the results on screen as a Memory Card."""
    if not handler.is_local():
        return handler.reply(403, "Not available from this device", "text/plain; charset=utf-8")
    try:
        if data is None:
            RESPONSES.refresh()
            res = RESPONSES.body()
        else:
            if isinstance(data, dict) and data.get("op") == "open" and not feature_on("responses"):
                return handler.reply(409, json.dumps({"error": "Polls are switched off in Settings > Features."}), TYPES[".json"])
            res = _linked(lambda: RESPONSES.action(data if isinstance(data, dict) else {}, _prayer_card, MEETING_LOG.count))
    except cloud_sync.Offline as e:
        return handler.reply(503, json.dumps({"error": str(e), "offline": True}), TYPES[".json"])
    except (ValueError, OSError) as e:
        return handler.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
    return handler.reply(200, json.dumps(res), TYPES[".json"], headers=[("Cache-Control", "no-store")])
# ---------- end of 26.11.33 quick responses and polls ----------

# ---------- 26.11.57 typed answers from members' phones (src/room_answers.py; 0026_room_answers.sql) ----------
import room_answers  # noqa: E402

ANSWERS = room_answers.RoomAnswers(lambda: SYNC._team(), room_open=lambda: ROOM.is_open())


def room_answers_http(handler, data=None):
    """GET /api/room/answers (the prompt and its answers, polled by the dialog) and POST {op: open|close|show}
    (this PC only). Show puts one answer on screen as a Memory Card, without a name."""
    if not handler.is_local():
        return handler.reply(403, "Not available from this device", "text/plain; charset=utf-8")
    try:
        if data is None:
            ANSWERS.refresh()
            res = ANSWERS.body()
        else:
            if isinstance(data, dict) and data.get("op") == "open" and not feature_on("responses"):
                return handler.reply(409, json.dumps({"error": "Polls and responses are switched off in Settings > Features."}), TYPES[".json"])
            res = _linked(lambda: ANSWERS.action(data if isinstance(data, dict) else {}, _prayer_card, MEETING_LOG.count))
    except cloud_sync.Offline as e:
        return handler.reply(503, json.dumps({"error": str(e), "offline": True}), TYPES[".json"])
    except (ValueError, OSError) as e:
        return handler.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
    return handler.reply(200, json.dumps(res), TYPES[".json"], headers=[("Cache-Control", "no-store")])
# ---------- end of 26.11.57 typed answers ----------


def _alert_show(on):
    hook = DESKTOP.get("alert_card")
    if hook:
        hook(bool(on))


def _alert_windows():
    hook = DESKTOP.get("windows")
    return hook() if hook else {}


ALERTS = leader_alerts.LeaderAlerts(lambda: VERSE_LISTEN.body(), lambda: PRAYER.body(), _alert_windows, _alert_show,
                                    lambda: app_settings())


def alerts_action(data):
    """POST /api/alerts {op: later|open|size, h?} (this PC only): the corner card's own buttons. Show and Dismiss of a
    verse go to /api/verse-listen, a prayer request's Show and Done to /api/prayer, as everywhere else."""
    op = str(data.get("op") or "")
    if op == "later":
        return ALERTS.later_prayer()
    if op == "open":                                    # All requests: the Studio in front, with Members' phones open
        MEMBERS_FOCUS["n"] += 1
        ROOM.rev += 1
        hook = DESKTOP.get("show")
        if hook:
            hook()
        ALERTS.step()
        return ALERTS.body()
    if op == "size":
        hook = DESKTOP.get("alert_op")
        if hook:
            hook("size", data)
        return ALERTS.body()
    raise ValueError("Unknown action.")


def moment_notes(m):
    """26.11.28 the summary's Moment -> sermon notes members' phones already show: one section, "This week", with the
    verse, the question to carry into the week and when the meeting is next."""
    m = m if isinstance(m, dict) else {}
    v = m.get("verse") if isinstance(m.get("verse"), dict) else None
    verse = {"ref": str(v.get("ref") or "")[:80], "text": str(v.get("text") or "")[:2000]} if v and v.get("ref") else None
    q, nxt = str(m.get("question") or "").strip()[:500], str(m.get("next") or "").strip()[:120]
    if not verse and not q:
        raise ValueError("A moment needs a scripture or a question that was shown in this meeting.")
    return {"v": 1, "title": str(m.get("title") or "This week").strip()[:120] or "This week", "date": int(time.time() * 1000),
            "presenter": "", "sections": [{"frame": "This week", "script": nxt, "verses": [verse] if verse else [],
                                           "questions": [q] if q else []}]}


def members_action(data):
    """POST /api/members {op: open|close|prayer|share-notes|share-moment|unshare-notes, on?, run?, script?, moment?} (this PC only).
    26.11.24 one code for members' phones: follow along, prayer requests and the sermon notes."""
    op = str(data.get("op") or "")
    if op == "open":
        _linked(lambda: ROOM.open(data.get("hours") or 6))
        if data.get("prayer") and not PRAYER.is_open():
            _linked(lambda: PRAYER.open(6))
    elif op == "close":
        if PRAYER.is_open():
            PRAYER.close()
        ROOM.close()
        invite_off()                                   # the code means nothing once the room is closed
    elif op == "prayer":
        if data.get("on"):
            if not PRAYER.is_open():
                _linked(lambda: PRAYER.open(6))
        elif PRAYER.is_open():
            PRAYER.close()
    elif op == "share-notes":
        notes = meeting_log.sermon_notes(meeting_summary(str(data.get("run") or "latest")), state, data.get("script", True) is not False)
        if not notes or not notes["sections"]:
            raise ValueError("There is nothing to share yet: notes are made from a meeting that was live.")
        if data.get("slides", True) is not False:          # 26.11.48 phones add the slides shown (0025) as a handout
            notes = dict(notes, slides=True)
        shared = ANSWERS.notes_section()                  # 26.11.57 the typed answers shown on screen
        if shared:
            notes = dict(notes, sections=list(notes["sections"]) + [shared])
        ROOM.share_notes(notes)
    elif op == "share-moment":                         # 26.11.28 the summary's Moment, as a one-section set of notes
        ROOM.share_notes(moment_notes(data.get("moment")))
    elif op == "share-slides":                         # 26.11.45 the slides' text, to read on members' phones
        ROOM.share_notes(slides_notes(str(data.get("file") or ((state.get("live") or {}).get("deck") or {}).get("file") or "")))
    elif op == "unshare-notes":
        ROOM.unshare_notes()
    elif op == "invite":                               # the code on screen, for people on Zoom or Teams
        b = ROOM.body()
        if not b["open"]:
            raise ValueError("Open members' phones first.")
        _INVITE["id"] = _prayer_card("Follow along on your phone", "Go to %s and type the code %s" % (
            b["url"].split("#")[0].replace("https://", "").replace("http://", ""), b["code"]), stay=True, qr=b["url"])
    elif op == "uninvite":                             # 26.11.43 the code off screen again
        invite_off()
    else:
        raise ValueError("Unknown action.")
    ROOM.poke()
    join_refresh()                                     # 26.11.44 the Branding badge's QR follows the room
    return members_body()


def prayer_action(data):
    """POST /api/prayer {op: open|close|show|done|again|list, id?, name?} (this PC only). Nothing is shown unless the
    leader chooses it; a name only when the leader chooses to show it and the person gave one."""
    op, item_id = str(data.get("op") or ""), str(data.get("id") or "")
    if op == "open":
        res = _linked(lambda: PRAYER.open(data.get("hours") or 4))
        ROOM.poke()
        return res
    if op == "close":
        res = PRAYER.close()
        ROOM.poke()
        return res
    if op == "show":
        title, text = PRAYER.card(item_id, bool(data.get("name")))
        _prayer_card(title, text)
        PRAYER.mark(item_id, "shown")
        MEETING_LOG.count("prayer.shown")
    elif op in ("done", "again"):
        PRAYER.mark(item_id, "done" if op == "done" else "new")
    elif op == "list":
        _prayer_card(*PRAYER.praying_for())
    else:
        raise ValueError("Unknown action.")
    return PRAYER.body()


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
                            "/api/vcam/status", "/api/vcam/studio", "/api/present.mjpg", "/api/remote/live.jpg", "/api/app/status") else (
        "page " + path.rsplit("/", 1)[-1] if path.endswith(".html") or path == "/" else "other api" if path.startswith("/api/") else "file")   # 26.11.8 which page
    REQ["counts"][kind] = REQ["counts"].get(kind, 0) + 1


def process_memory_mb():
    """26.11.8 the program's own memory (was 0 on Windows: the handle lost its upper half); meeting_guard reads it with
    its Windows functions declared."""
    try:
        import meeting_guard
        mb = meeting_guard.process_memory()
        if mb:
            return mb
    except Exception:
        pass
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
                   "page, where a crash happened (kc-crash.txt) and the settings files listed here.\nNot included: your plan, members, the phone-remote PIN and "
                   "sessions, and any keys.\n")
        z.writestr("diagnostics.json", json.dumps(diagnostics(address), indent=1, ensure_ascii=False, default=str))
        z.writestr("sync.json", json.dumps(SYNC.info(), indent=1, ensure_ascii=False, default=str))
        listing = sorted(({"name": f.name, "bytes": f.stat().st_size} for f in DATA.iterdir() if f.is_file()),
                         key=lambda d: d["name"]) if DATA.exists() else []
        z.writestr("data-folder.json", json.dumps(listing, indent=1))   # names and sizes only
        for name in (SUPPORT_LOG + ".old", SUPPORT_LOG, CRASH_LOG):     # 26.11.52 kc-crash.txt: where a crash happened
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
        n_sessions = len([1 for v in sessions.values() if session_alive(v)])
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
                 "status": dict(VCAM["engine"].status) if VCAM["engine"] else None},
        "guard": _guard().report(),
    }


private_lock = threading.Lock()
# 26.11.58 (release sign-off L3): kc-members-private.json is encrypted for this Windows account (src/dpapi_file.py;
# plain JSON on other systems). A file from an earlier version is read as it is and written encrypted at start-up and
# on the next save. A file that can't be decrypted (another Windows account, another PC) is kept untouched: the
# Members page says it couldn't load, and nothing replaces it (save_private refuses) until it is readable again.
PRIVATE_STATUS = {"error": ""}


def load_private_strict():
    """The member file as a dict ({} when there is none). Raises dpapi_file.Unreadable when it can't be decrypted."""
    try:
        raw = PRIVATE_FILE.read_bytes()
    except FileNotFoundError:
        PRIVATE_STATUS["error"] = ""
        return {}
    try:
        data = json.loads(dpapi_file.decode(raw))
    except dpapi_file.Unreadable as e:
        if PRIVATE_STATUS["error"] != str(e):
            _swallowed("server.load_private " + PRIVATE_FILE.name, e)
        PRIVATE_STATUS["error"] = str(e)
        raise
    except ValueError:
        data = None
    PRIVATE_STATUS["error"] = ""
    return data if isinstance(data, dict) else {}


def load_private():
    try:
        return load_private_strict()
    except OSError:
        return {}


def save_private(data):
    with private_lock:
        if PRIVATE_FILE.exists():
            load_private_strict()                    # an unreadable file is never replaced (raises Unreadable)
        write_atomic(PRIVATE_FILE, dpapi_file.encode(json.dumps(data, indent=2, ensure_ascii=False)))   # (audit L4) flushed
    if "SYNC" in globals():
        SYNC.poke()


def protect_private_files():
    """At start-up on Windows: the member file and its copies in backups/ written by earlier versions (plain JSON)
    become encrypted. A file that can't be read is left as it is."""
    if not dpapi_file.available():
        return
    try:
        if PRIVATE_FILE.exists() and not dpapi_file.is_protected(PRIVATE_FILE.read_bytes()):
            save_private(load_private_strict())
    except (OSError, ValueError) as e:
        _swallowed("server.protect_private_files", e)
    try:
        copies = list(BACKUP_DIR.glob("*/" + PRIVATE_FILE.name)) if BACKUP_DIR.is_dir() else []
    except OSError:
        copies = []
    for f in copies:
        try:
            dpapi_file.protect_file(f)
        except (OSError, ValueError) as e:
            _swallowed("server.protect_private_files backup", e)


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
        private = load_private_strict()          # 26.11.58 (release sign-off L3): unreadable member file: change nothing
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

# 9.11 live push (src/live_push.py; docs/architecture/live-push.md): listens on the workspace's bell while needed and
# rests otherwise; whenever the bell cannot be used, sync and the remote run exactly as before.
DOORBELL = live_push.Doorbell(
    _remote_credentials,
    computer_id=lambda: (SYNC.state.get("link") or {}).get("computerId"),
    cursor=lambda: SYNC.state.get("cursor", 0),
    control=lambda: bool(app_settings()["cloudRemote"]),
    read_plan=_remote_plan,
    on_sync=lambda: SYNC.poke(0.5),
    on_cmd=CLOUD_REMOTE.command_waiting,
    on_watch=CLOUD_REMOTE.poke)
SYNC.next_pull = DOORBELL.sync_every
CLOUD_REMOTE.plan_for = DOORBELL.remote_plan


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
                         "ccSize": "regular",     # 9.12 the Command Center: regular, or compact (slim chips, narrower)
                         "ccPlace": "top",        # 9.12 where it opens: top, centre or bottom (chips above the bar)
                         "remoteNotesAdd": True,  # 9.13 the phone remote may add notes (they are saved on this PC)
                         "remoteNotesRead": False,  # 9.13 the phone remote may read them (off: whoever has the PIN could)
                         "prompterLook": "solid",       # 8.1 Teleprompter transparency: solid/presenter/meeting/conference/ghost
                         "prompterOnTop": True,         # 8.1 the Teleprompter stays above Zoom, Teams and PowerPoint (pin)
                         "voiceMic": -1,          # 26.11 Follow my voice: the microphone (-1 = the Windows default)
                         "voiceSensitivity": 3,   # 26.11 1 = only a loud, close voice ... 5 = a soft voice in a quiet room
                         "cloudRemote": False,    # Phase 5: run a service from the companion (Settings > FrameDecks account)
                         "memberAuthority": "cloud",   # M-D2: the workspace is the member list's source (no switch on screen)
                         "memDur": 12,            # 9.0 Memory Cards: seconds an unpinned card stays in the chat overlay (3..120)
                         "memShare": False,       # 9.0 the chat overlay also on the Share Window and the overlay pages
                         "joinQr": "off",         # 26.11.44 the members' phones QR on the Branding badge: off / beside / below
                         "slideScripture": True,  # 26.11.45 a slide naming a passage offers it as the scripture card
                         "memLayout": "beside",   # 9.0 on FrameDecks vCam: beside the video, below it, or over it
                         "memSide": "right",      # 9.0 the chat overlay's side (beside / over)
                         "memAuto": True,         # 9.0 a copied card goes into the chat overlay at once
                         "guide": {},             # 6.14 Setup guide progress on this PC (app/js/guide.js, _valid_guide)
                         "onboarding": {},        # 9.5 the Welcome flow: {done, skipped, at} (app/js/onboarding.js)
                         # 26.11.12 How people see it: "camera" (FrameDecks vCam in Zoom/Teams), "window" (share the Share
                         # Window; the camera is not even loaded, which saves memory on older PCs) or "both" (as before)
                         "peopleSee": "both",
                         # 26.11.12 the Studio shows the essentials ("simple", the default) or every control ("advanced")
                         "studioMode": "simple",
                         # 26.11.14 Listen for scripture (src/scripture_listen.py): hear a spoken Bible reference while
                         # a Frame is live and offer it ("Auto": put it on screen without asking)
                         "scriptureListen": False,
                         "scriptureAuto": False,
                         # 26.11.20 Voice commands: hold Right Ctrl (voiceKey; 26.11.21 also Left Ctrl, F8 or your own
                         # key) or a hold button, say "next frame"
                         "voiceCommands": False,
                         # 26.11.22 Smart Next: Next shows the live Frame's questions, then its scriptures, then the next
                         # Frame (off: Next always goes to the next Frame); and soft sounds on Go Live and Next (off).
                         # 26.11.57 Smart is the default order of a Frame without Set order (one order per Frame)
                         "smartNext": True,
                         "uiSounds": False,
                         # 26.11.57 the church's CCLI licence number (shown with each song's credit; the usage report),
                         # the room screen chosen by name (Settings > How people see it) and whether Go Live opens
                         # the Share Window full screen on it; the stage screen for musicians (stage-display.html)
                         "ccliLicence": "",
                         "audienceDisplay": "",
                         "audienceAuto": False,
                         # 26.11.57 one background per kind of Content (song, scripture, announcement): a picture or
                         # video from the media folder and how much it is dimmed, put behind every such Frame
                         "themes": {},
                         # 26.11.24 Listen for scripture also hears the meeting's own sound (members on Zoom or Teams);
                         # what they say is always offered first, never shown by Auto
                         "scriptureMeeting": False,
                         # 26.11.25 the corner card: a verse heard or a prayer request waiting, while the Studio is behind
                         # Zoom or Teams (on top of the meeting, never in screen sharing)
                         "leaderCard": True,
                         "voiceKey": "rctrl",
                         # 26.11.31 features switched off ({id: false}; src/features.py). Never chosen = everything on
                         "features": {}}
APP_SETTING_CHOICES = {"memLayout": ("beside", "below", "over"), "memSide": ("right", "left"), "minimizeTo": ("ask", "tray", "taskbar"), "memberAuthority": ("cloud", "pc"),
                       "prompterLook": ("solid", "presenter", "meeting", "conference", "ghost"),
                       "ccSize": ("regular", "compact"), "ccPlace": ("top", "centre", "bottom"),
                       "peopleSee": ("camera", "window", "both"), "studioMode": ("simple", "advanced"),
                       "joinQr": ("off", "beside", "below")}


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
    if k == "features":
        return FEAT.valid(v)
    if isinstance(d, bool):
        return isinstance(v, bool)
    if k in APP_SETTING_CHOICES:
        return v in APP_SETTING_CHOICES[k]
    if k == "spotlightKey":
        from desktop_win import parse_hotkey
        return isinstance(v, str) and (v == "" or parse_hotkey(v) is not None)
    if k == "memDur":
        return isinstance(v, int) and not isinstance(v, bool) and 3 <= v <= 120
    if k == "voiceMic":
        return isinstance(v, int) and not isinstance(v, bool) and -1 <= v <= 31
    if k == "voiceKey":                  # 26.11.21 rctrl, lctrl, f8, off, or your own key(s) "k:<vk>+<vk>"
        return isinstance(v, str) and len(v) <= 24 and voice_commands.valid_key(v)
    if k == "voiceSensitivity":
        return isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 5
    if k == "themes":                    # 26.11.57 {song|scripture|announcement: {file, kind: image|video, dim 0-0.8}}
        return isinstance(v, dict) and len(v) <= 3 and all(
            t in ("song", "scripture", "announcement") and isinstance(x, dict) and isinstance(x.get("file"), str) and len(x["file"]) <= 200
            and x.get("kind") in ("image", "video") and isinstance(x.get("dim", 0), (int, float)) and 0 <= x.get("dim", 0) <= 0.8
            for t, x in v.items())
    if k == "ccliLicence":               # 26.11.57 digits (and a dash or space) only
        return isinstance(v, str) and len(v) <= 20 and re.fullmatch(r"[0-9 -]*", v) is not None
    if k == "audienceDisplay":           # 26.11.57 a display's name as Windows gives it
        return isinstance(v, str) and len(v) <= 120 and "\x00" not in v
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
    out.update(FEAT.held(FEAT.effective(out["features"], out["peopleSee"])))   # 26.11.31 a feature that is off stays off
    return out


# 26.11.31 the features' state, kept in memory so the hot paths (every state change, the meeting guard) never read the
# file; refreshed by every save. "rev" moves on each change: the pages ride it ("ft") and redraw.
FEATURE_STATE = {"eff": None, "rev": 0}


def features_now():
    if FEATURE_STATE["eff"] is None:
        cfg = app_settings()
        FEATURE_STATE["eff"] = FEAT.effective(cfg["features"], cfg["peopleSee"])
    return dict(FEATURE_STATE["eff"])


def feature_on(fid):
    return bool(features_now().get(fid, True))


def features_body():
    eff = features_now()
    live = bool((state.get("live") or {}).get("scene"))
    return {"features": eff, "preset": FEAT.preset_of(eff), "locked": live, "rev": FEATURE_STATE["rev"]}


def features_action(body):
    """POST /api/app/features: {preset: simple|study|full} or {set: {id: bool}}. Only while nothing is on air (a card or
    a chip vanishing mid-meeting would be a surprise). Switching off also stops the feature's background work."""
    if (state.get("live") or {}).get("scene"):
        raise PermissionError("Off air to change features.")
    cfg = app_settings()
    before = features_now()
    new, see = FEAT.change(cfg["features"], cfg["peopleSee"], body)
    eff = FEAT.effective(new, see)
    save_app_settings(dict(FEAT.held(eff), features=new, peopleSee=see))
    for fid, on in eff.items():
        if before.get(fid) == on or on:
            continue
        try:
            if fid == "remote":
                set_remote(False)
            elif fid == "memory":
                memory_capture(False)
            elif fid == "follow":
                VOICE.stop()
            elif fid == "listen":
                VERSE_LISTEN.tick()
            elif fid == "voice":
                VOICE_CMD.tick()
        except Exception as e:                       # the switch is saved; a stop that fails is said in the log
            print(f"Feature {fid}: could not stop: {type(e).__name__}: {e}")
    return features_body()


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
    if "joinQr" in changes and "join_refresh" in globals():     # 26.11.44 the badge's QR shows or goes at once
        threading.Thread(target=join_refresh, daemon=True).start()
    eff = FEAT.effective(cur["features"], cur["peopleSee"])
    if eff != FEATURE_STATE["eff"]:
        FEATURE_STATE["eff"] = eff
        FEATURE_STATE["rev"] += 1
    if "peopleSee" in changes and changes["peopleSee"] == cur["peopleSee"]:
        apply_people_see(cur["peopleSee"])
    if "cloudRemote" in changes and "CLOUD_REMOTE" in globals():
        CLOUD_REMOTE.poke()                # the switch takes effect at once (off: no more asking)
        if "DOORBELL" in globals():
            DOORBELL.recheck()             # tell the workspace at once whether this PC takes commands
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
            if f == PRIVATE_FILE:                 # 26.11.58 (release sign-off L3): the copy is encrypted too (Windows)
                try:
                    dpapi_file.protect_file(folder / f.name)
                except (OSError, ValueError) as e:
                    _swallowed("server.backup_now protect", e)
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


# 26.11.58 (audit L5) the phone sign-ins of the other installation stay behind: phones sign in again with the PIN
DATA_FILE_NAMES = ["kc-saved-content.json", "kc-members-private.json", "kc-remote-pin.txt"]


def looks_like_data(folder):
    return bool(legacy.find(folder, DATA_FILE_NAMES[0]) or legacy.find(folder, DATA_FILE_NAMES[1]))


def _describe(folder):
    info = {"folder": str(folder), "modified": 0, "members": None, "questions": None}
    for name in DATA_FILE_NAMES[:2]:
        f = legacy.find(folder, name)
        if f:
            info["modified"] = max(info["modified"], f.stat().st_mtime)
    try:
        info["members"] = len(json.loads(dpapi_file.read_text(legacy.find(folder, DATA_FILE_NAMES[1]))).get("members") or [])
    except (OSError, ValueError, AttributeError, TypeError):
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


# 26.11.4 the Windows settings pages the connection check opens (Wi-Fi, network type), nothing else
# 26.11.7 and battery saver, from the meeting guard
SETTINGS_PAGES = ("ms-settings:network-wifi", "ms-settings:network-status", "ms-settings:batterysaver")



# 26.11.7 the meeting guard (src/meeting_guard.py): measures only while a meeting app uses FrameDecks vCam, makes the
# camera work lighter while the PC is very busy, and lists what is in the way (Windows Camera app, battery saver)
def _guard_in_use():
    if not feature_on("guard"):                      # 26.11.31 Lighter during meetings switched off: never measures
        return False
    eng = VCAM.get("engine") if "VCAM" in globals() else None
    return bool(eng and eng.status.get("inUse"))


def _guard_lighten(busy):
    """While the PC is very busy the background blur's person outline is found 5 times a second instead of 10."""
    eng = VCAM.get("engine") if "VCAM" in globals() else None
    if eng is not None:
        eng.guard_busy = bool(busy)                  # 26.11.9 the camera loop applies it with its own pace
    blur = getattr(eng, "blur", None) if eng else None
    if blur is not None and hasattr(blur, "period"):
        blur.period = 0.2 if busy else 0.1


def _guard():
    if MEETING_GUARD.get("g") is None:
        import meeting_guard
        MEETING_GUARD["g"] = meeting_guard.Guard(_guard_in_use, _guard_lighten,
                                                 context=lambda: DESKTOP["windows"]() if DESKTOP.get("windows") else {})
    return MEETING_GUARD["g"]


MEETING_GUARD = {"g": None}


def open_external(url):
    if (url or "").lower() in SETTINGS_PAGES:
        if os.name == "nt":
            os.startfile(url)    # Windows' own Settings app, like opening a link; no command line, nothing hidden
            return True
        return False
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
        out["blurStyle"] = "natural"      # 26.11.9 one style: natural (classic left a halo around you); old saves read as natural
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


def ready_report():
    """26.11.28 the ready check (src/ready_check.py): what is read now, on this PC. Asking keeps the webcam on for a
    few seconds and has it look at the light and framing (src/vcam/hints.py)."""
    import meeting_guard
    import meeting_keys
    import ready_check
    eng = VCAM.get("engine")
    if eng is not None:
        eng.want_hints(8.0)
    try:
        from voice_worker import microphones
        mics = microphones() if os.name == "nt" else None
    except Exception:
        mics = None
    try:
        meeting = meeting_keys.status()
    except Exception:
        meeting = None
    try:
        guard = _guard().checks()
    except Exception:
        guard = {}
    st = state if isinstance(state, dict) else {}
    return ready_check.build(vcam=vcam_status(lite=True), hints=eng.hints.get() if eng is not None else None, mics=mics,
                             meeting=meeting, scenes=ready_check.meeting_scenes(st), missing=media_check(st), guard=guard,
                             memory=meeting_guard.system_memory(), mic=app_settings().get("voiceMic", -1))


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


def scripture_info():
    st = scripture_settings()
    return {"provider": "ESV API (api.esv.org)", "hasKey": bool(st["key"]), "keyHint": ("…" + st["key"][-4:]) if st["key"] else "",
            "translation": st["translation"], "cached": len(_scr_cache()), "cacheMax": SCRIPTURE_CACHE_MAX, "health": SCRIPTURE_HEALTH}


# ---------- 26.11.45 PowerPoint slides: the deck on screen (live.deck), its run order, the overview ----------
_DECK = {"want": None, "pages": {}}


def deck_pages(name):
    """How many slides a PDF deck in the Content folder has (0 when it cannot be read); kept per file version."""
    p = LAYERS_DIR / name
    try:
        key = (name, p.stat().st_mtime)
    except OSError:
        return 0
    if key not in _DECK["pages"]:
        try:
            _DECK["pages"][key] = slides.page_count(p)
        except Exception as e:
            _swallowed("deck_pages", e)
            _DECK["pages"][key] = 0
    return _DECK["pages"][key]


def deck_layer(st):
    """The slide deck of the live Frame (its top visible PowerPoint Content with a file), or None."""
    live = st.get("live") if isinstance(st.get("live"), dict) else {}
    sid = live.get("scene")
    sc = next((x for x in st.get("scenes") or [] if isinstance(x, dict) and x.get("id") == sid), None) if sid else None
    for l in (sc or {}).get("layers") or []:
        if isinstance(l, dict) and l.get("kind") == "pdf" and l.get("visible", True) is not False:
            c = l.get("c") if isinstance(l.get("c"), dict) else {}
            if safe_name(c.get("file")) and str(c.get("file")).lower().endswith(".pdf"):
                return l
    return None


def deck_seq(l, pages):
    c = l.get("c") or {}
    return slides.sequence(pages, c.get("order"), c.get("skip"))


_DECK_INFO = {}


def _deck_info(name):
    """slides.info for a deck, kept in memory per file version (read on every save while a deck is live)."""
    try:
        st = (LAYERS_DIR / name).stat()
        key = (st.st_size, st.st_mtime)
        hit = _DECK_INFO.get(name)
        if hit and hit[0] == key:
            return hit[1]
        d = slides.info(LAYERS_DIR, name)
        if len(_DECK_INFO) > 32:
            _DECK_INFO.clear()
        _DECK_INFO[name] = (key, d)
        return d
    except (ValueError, OSError) as e:
        _swallowed("deck info", e)
        return None


def deck_clicks(name, page):
    """26.11.46 how many animations play by clicks on this slide (0 when none, or not known)."""
    d = _deck_info(name)
    try:
        return int(d["slides"][page].get("clicks") or 0) if d else 0
    except (IndexError, KeyError, TypeError, ValueError):
        return 0


def deck_live_pptx(l, name):
    """26.11.46 the .pptx PowerPoint plays for this deck layer (so animations, transitions and videos play), or "".
    On when the deck has animations or transitions, it came from a .pptx that is still in the Content folder, this is
    Windows, and the Content's "Play animations" is not switched off (c.anim false)."""
    c = (l or {}).get("c") if isinstance((l or {}).get("c"), dict) else {}
    if c.get("anim") is False or (os.name != "nt" and not os.environ.get("KC_LIVE_SHOW_ANYWHERE")):
        return ""
    d = _deck_info(name)
    src = safe_name((d or {}).get("source") or "")
    if not d or not src or not d.get("animated") or not (LAYERS_DIR / src).is_file():
        return ""
    return src


_PPT_INSTALLED = {}


def powerpoint_installed():
    """26.11.49 whether PowerPoint is on this PC (its automation class is registered), asked once."""
    if "v" not in _PPT_INSTALLED:
        ok = False
        if os.name == "nt":
            try:
                import winreg
                winreg.CloseKey(winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r"PowerPoint.Application\CLSID"))
                ok = True
            except OSError:
                ok = False
        _PPT_INSTALLED["v"] = ok or bool(os.environ.get("KC_LIVE_SHOW_ANYWHERE"))
    return _PPT_INSTALLED["v"]


def deck_status(name, c=None):
    """26.11.49 a deck in plain words: how many slides, how many have animations, and how it plays (PowerPoint plays
    it, or still slides) with the reason: none (no animations), off (Play animations is off), pdf (no .pptx beside
    it), noppt (PowerPoint is not on this PC)."""
    c = c if isinstance(c, dict) else {}
    d = _deck_info(name) or {}
    sl = d.get("slides") or []
    pages = d.get("pages") or deck_pages(name)
    anim = sum(1 for x in sl[:pages] if x.get("clicks") or x.get("auto") or x.get("transition"))
    src = safe_name(d.get("source") or "")
    why = ""
    if not d.get("animated"):
        why = "none"
    elif c.get("anim") is False:
        why = "off"
    elif not src or not (LAYERS_DIR / src).is_file():
        why = "pdf"
    elif not powerpoint_installed():
        why = "noppt"
    return {"file": name, "pages": pages, "animated": anim, "plays": "still" if why else "powerpoint", "why": why}


def deck_ready(name, c=None):
    """26.11.49 when a deck is added: read it, make its small pictures in the background (so the grid and the phones
    are quick when it goes live) and say how it will play."""
    st = deck_status(name, c)
    if not st["pages"]:
        raise ValueError("FrameDecks could not read that deck. Add it again, or save it as a PDF.")

    def thumbs():
        for n in range(1, min(st["pages"], 300) + 1):
            try:
                slides.thumb(LAYERS_DIR, name, n, 320)
            except (ValueError, OSError) as e:
                _swallowed("deck_ready thumb", e)
                return
            time.sleep(0.05)                               # 26.11.51 one slide at a time, never holding up the live picture
    threading.Thread(target=thumbs, name="deck-ready", daemon=True).start()
    return st


def deck_show(layer_id):
    """26.11.46 the camera's live PowerPoint show for this deck layer, once it plays, or None."""
    comp = VCAM.get("compositor")
    s = comp.layers.sources.get(layer_id) if comp else None
    sh = getattr(s, "show", None)
    return sh if sh is not None and sh.hwnd else None


def deck_live(new):
    """Keep live.deck in step with the live Frame (called from save_state, under the state lock): the slide on screen
    is the server's, so a save from a window that has not caught up never moves it back. A new deck starts at its
    "Start at slide" (or the first slide of its run order); _DECK["want"] (deck_go) moves it."""
    live = new.get("live") if isinstance(new.get("live"), dict) else None
    if live is None:
        return
    want, _DECK["want"] = _DECK["want"], None
    l = deck_layer(new)
    f = safe_name(((l or {}).get("c") or {}).get("file")) if l else ""
    pages = deck_pages(f) if f else 0
    if not pages:
        live.pop("deck", None)
        return
    seq = deck_seq(l, pages)
    old = (state.get("live") or {}).get("deck") if isinstance((state.get("live") or {}).get("deck"), dict) else {}
    now = int(time.time() * 1000)
    if old.get("layer") == l.get("id") and old.get("file") == f and isinstance(old.get("page"), int) and 0 <= old["page"] < pages:
        page, at, zoom = old["page"], old.get("at") or now, old.get("zoom")
    else:
        start = (l.get("c") or {}).get("page")
        page = start if isinstance(start, int) and start in seq else seq[0]
        at, zoom = now, None
    click = old.get("click", 0) if old.get("layer") == l.get("id") and old.get("page") == page else 0
    if want:
        if "page" in want and want["page"] != page:
            page, at, zoom, click = want["page"], now, None, 0   # a new slide starts unzoomed, its timer from now
        if "zoom" in want:
            zoom = want["zoom"]
        if isinstance(want.get("click"), int):
            click = want["click"]                       # 26.11.46 the animations PowerPoint has played on this slide
    d = {"layer": str(l.get("id") or ""), "file": f, "page": page, "pages": pages,
         "pos": seq.index(page) + 1 if page in seq else 0, "count": len(seq), "at": at}
    nx = slides.step(seq, page, 1)
    d["nxt"] = nx if nx != page else None               # 26.11.49 the slide Next goes to (None: the last one)
    if isinstance(zoom, dict):
        d["zoom"] = zoom
    clicks = deck_clicks(f, page)
    if clicks:
        d.update(click=max(0, min(int(click or 0), clicks)), clicks=clicks)
    if deck_live_pptx(l, f):
        d["animated"] = True                            # 26.11.46 PowerPoint plays this deck (animations)
    live["deck"] = d


def deck_go(page=None, step=None, zoom=False):
    """Move the slides on screen: to page (0-based), or step slides along the run order; zoom: {x, y, s} into part of
    the slide (s 1-4), None to show the whole slide. Returns {page, pages, pos, count} (page 1-based)."""
    with cond:
        d = (state.get("live") or {}).get("deck")
        l = deck_layer(state)
        if not d or not l:
            raise ValueError("No slides are on screen. Go live with a Frame that has PowerPoint Content.")
        seq = deck_seq(l, d["pages"])
    click = None
    show = deck_show(d["layer"]) if step is not None and zoom is False else None
    if show is not None:                               # 26.11.46 PowerPoint plays it: Next plays the next animation
        r = show.step(int(step), seq)
        if isinstance(r, dict) and r.get("busy"):
            return {"page": d["page"] + 1, "pages": d["pages"], "pos": d["pos"], "count": d["count"], "busy": True}
        if isinstance(r, dict) and isinstance(r.get("page"), int):
            page, step, click = r["page"], None, int(r.get("click") or 0)
    with cond:
        d = (state.get("live") or {}).get("deck")
        l = deck_layer(state)
        if not d or not l:
            raise ValueError("No slides are on screen. Go live with a Frame that has PowerPoint Content.")
        seq = deck_seq(l, d["pages"])
        if step is not None:
            target = slides.step(seq, d["page"], 1 if int(step) > 0 else -1)
        elif page is not None:
            target = int(page)
            if not 0 <= target < d["pages"]:
                raise ValueError("There is no slide %d." % (target + 1))
        else:
            target = d["page"]
        want = {"page": target}
        if click is not None:
            want["click"] = click
        if zoom is not False:
            if zoom is None:
                want["zoom"] = None
            else:
                s = max(1.0, min(4.0, float(zoom.get("s", 2))))
                want["zoom"] = {"x": max(0.0, min(1.0, float(zoom.get("x", 0.5)))), "y": max(0.0, min(1.0, float(zoom.get("y", 0.5)))),
                                "s": round(s, 2)} if s > 1.01 else None
        _DECK["want"] = want
        was = d["page"]
        update_state(lambda st: st)
        d = state["live"]["deck"]
        moved = d["page"] != was
    VCAM["lastSlide"] = {"page": d["page"] + 1, "pages": d["pages"]}
    if moved and app_settings().get("slideScripture", True):
        threading.Thread(target=_offer_slide_scripture, args=(d["file"], d["page"]), daemon=True).start()
    if "MEETING_LOG" in globals():
        try:
            MEETING_LOG.count("slide")
        except Exception as e:
            _swallowed("deck_go log", e)
    out = {"page": d["page"] + 1, "pages": d["pages"], "pos": d["pos"], "count": d["count"]}
    if d.get("clicks"):
        out.update(click=d.get("click", 0), clicks=d["clicks"])
    return out


def _offer_slide_scripture(name, page):
    """A slide that names a passage (John 10:11) offers it as the scripture card, the same "Show" as Listen for
    scripture (never shown by itself). Settings: slideScripture."""
    try:
        refs = slides.info(LAYERS_DIR, name)["slides"][page].get("refs") or []
        if refs:
            VERSE_LISTEN.ask(refs[0], source="slide")
    except (ValueError, OSError, IndexError, KeyError) as e:
        _swallowed("slide scripture", e)


_PHONE_SLIDE = {"key": None, "out": None, "full": None, "base": None, "chg": 0.0}
PHONE_FULL_MAX = 380000          # characters of the sharp picture (0025 keeps at most 400,000)


def deck_on_phones(st, d=None):
    """26.11.48 whether the slide on screen may go to members' phones: the deck's "On members' phones" (c.phones, on
    unless switched off) and the slides kept off them in Run order (c.nophone, 0-based pages)."""
    d = d or (st.get("live") or {}).get("deck")
    l = deck_layer(st)
    c = (l or {}).get("c") if isinstance((l or {}).get("c"), dict) else {}
    if not isinstance(d, dict) or c.get("phones") is False:
        return False
    off = c.get("nophone") if isinstance(c.get("nophone"), list) else []
    return d.get("page") not in off


def _slide_picture(d):
    """The slide as people see it now (a PIL picture): with an animated deck that PowerPoint plays, the live picture with
    the animations played so far; otherwise the slide itself (sharp, 960 px wide)."""
    from PIL import Image
    import io
    sh = deck_show(d["layer"]) if d.get("animated") else None
    if sh is not None:
        comp = VCAM.get("compositor")
        src = comp.layers.sources.get(d["layer"]) if comp else None
        try:
            img, _ = src.frame()
            if img is not None and getattr(img, "size", 0):
                return Image.fromarray(img[:, :, ::-1].copy())          # BGR -> RGB
        except Exception as e:
            _swallowed("phone slide live picture", e)
    return Image.open(io.BytesIO(slides.thumb(LAYERS_DIR, d["file"], d["page"] + 1, 960)))


def _jpeg_url(img, width, quality):
    import base64
    import io
    im = img.convert("RGB")
    if im.width > width:
        im = im.resize((width, max(1, round(im.height * width / im.width))))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def fit_jpeg(img, budget):
    """The sharpest small JPEG of img (a data URL) whose text fits in budget characters, or "" when none does."""
    for width in (480, 400, 320, 260, 200):
        for quality in (72, 58, 45):
            url = _jpeg_url(img, width, quality)
            if len(url) <= budget:
                return url
    return ""


def phone_slide(st, budget=12000):
    """26.11.45 the slide on screen for members' phones: its number, title, words and a small picture. 26.11.48: the
    picture fits in budget characters (the room keeps at most 16,000 bytes, 0020: before, a large picture could stop the
    phones updating); it follows the animations of a deck PowerPoint plays; a deck or slide kept off the phones says so
    without its content. Made once per slide (and per animation step)."""
    d = (st.get("live") or {}).get("deck")
    if not isinstance(d, dict):
        return None
    ok = deck_on_phones(st, d)
    base, now = (d.get("file"), d.get("page"), d.get("click", 0)), time.time()
    if _PHONE_SLIDE.get("base") != base:
        _PHONE_SLIDE.update(base=base, chg=now)
    settled = not d.get("animated") or now - _PHONE_SLIDE["chg"] >= 1.4     # an animation has finished moving
    key = base + (ok, max(0, int(budget)) // 2000, settled)
    if _PHONE_SLIDE["key"] != key:
        out = {"n": d["page"] + 1, "of": d["pages"], "page": d["page"]}
        full = None
        if not ok:
            out["off"] = True                                  # kept off the phones: no picture, no words
        else:
            try:
                info = slides.info(LAYERS_DIR, d["file"])["slides"][d["page"]]
                out.update(title=info.get("title", "")[:120], text=info.get("text", "")[:600])
            except (ValueError, OSError, IndexError) as e:
                _swallowed("phone_slide info", e)
            try:
                pic = _slide_picture(d)
                room = budget - len(json.dumps(out)) - 30
                url = fit_jpeg(pic, room) if room > 1500 else ""
                if url:
                    out["img"] = url
                sharp = _jpeg_url(pic, 1280, 82)
                if len(sharp) > PHONE_FULL_MAX:
                    sharp = _jpeg_url(pic, 960, 70)
                full = {"key": key[:3], "page": d["page"], "title": out.get("title", ""), "text": out.get("text", ""),
                        "img": sharp if len(sharp) <= PHONE_FULL_MAX else None}
            except (ValueError, OSError) as e:
                _swallowed("phone_slide picture", e)
        if not settled and ok:
            # an animation is still moving in the first moment: look again once it has finished
            threading.Timer(1.6, lambda: ROOM.poke() if "ROOM" in globals() else None).start()
        _PHONE_SLIDE.update(key=key, out=out, full=full if (settled or full is None) else dict(full, key=key[:3] + ("moving",)))
    return _PHONE_SLIDE["out"]


def phone_slide_full():
    """26.11.48 the sharp picture of the slide on screen for phones (member_room.SLIDE_FULL), or None."""
    return _PHONE_SLIDE["full"]


member_room.SLIDE = phone_slide
member_room.SLIDE_FULL = phone_slide_full


def video_seconds(path):
    """26.11.57 how long a video plays, in seconds (0 when it cannot be read)."""
    try:
        import cv2
        cap = cv2.VideoCapture(str(path))
        try:
            frames, fps = cap.get(cv2.CAP_PROP_FRAME_COUNT), cap.get(cv2.CAP_PROP_FPS)
        finally:
            cap.release()
        return round(frames / fps, 1) if fps and frames and fps > 0 else 0
    except Exception as e:
        _swallowed("server.video_seconds", e)
        return 0


def displays_now():
    """26.11.57 the screens connected now (Windows), for choosing the room screen by name; [] elsewhere."""
    try:
        from vcam.screen import displays
        return displays()
    except Exception as e:
        _swallowed("server.displays_now", e)
        return []


def present_on_screen(key=None):
    """26.11.57 open the Share Window full screen on the room screen: the one chosen in Settings (or `key`). The
    window itself does the work (desktop_app.present_on); here only which screen and a plain answer."""
    key = str(key or app_settings().get("audienceDisplay") or "")
    if not key:
        return False, "Choose the room screen first (Settings > How people see it > Projector, TV and OBS)."
    found = next((d for d in displays_now() if d["key"] == key), None)
    if not found:
        return False, "That screen is not connected now. Check its cable, then try again."
    fn = DESKTOP.get("present_on")
    if not fn:
        return False, "The Share Window opens from the FrameDecks program on Windows."
    threading.Thread(target=fn, args=(found["rect"],), daemon=True, name="present-on").start()
    return True, "The Share Window is opening full screen on " + found["name"] + "."


def slides_notes(name):
    """26.11.45 a deck's slides as notes members keep on their phones: one section per slide (its title and text)."""
    info = slides.info(LAYERS_DIR, name)
    secs = []
    for s in info["slides"]:
        if not (s.get("title") or s.get("text")):
            continue
        secs.append({"frame": (s.get("title") or "Slide %d" % s["n"])[:120], "script": s.get("text", "")[:1200], "verses": [],
                     "questions": []})
    if not secs:
        raise ValueError("These slides have no text to share.")
    return {"v": 1, "title": info["file"][:-4][:120] or "Slides", "date": int(time.time() * 1000), "presenter": "", "sections": secs[:120]}


def slides_body(name):
    """GET /api/slides: a deck's slides (title, text, notes, references) and, for the deck on screen, which slide is
    showing and the run order."""
    out = slides.info(LAYERS_DIR, name)
    d = (state.get("live") or {}).get("deck")
    if isinstance(d, dict) and d.get("file") == out["file"]:
        l = deck_layer(state)
        c = (l or {}).get("c") or {}
        off = [p for p in (c.get("nophone") if isinstance(c.get("nophone"), list) else []) if isinstance(p, int)]
        out = dict(out, live=d, order=deck_seq(l, d["pages"]) if l else list(range(out["pages"])),
                   phones=c.get("phones") is not False, nophone=off)      # 26.11.48: what members' phones get
        out["status"] = deck_status(out["file"], c)                       # 26.11.49 how it plays, in plain words
    return out


def slides_action(data):
    """POST /api/slides {op: go (n, 1-based) | step (by) | zoom (x, y, s) | unzoom | search (q, file)}."""
    op = str(data.get("op") or "")
    if op == "go":
        return deck_go(page=int(data.get("n", 0)) - 1)
    if op == "step":
        return deck_go(step=data.get("by", 1))
    if op == "zoom":
        return deck_go(zoom={"x": data.get("x", 0.5), "y": data.get("y", 0.5), "s": data.get("s", 2)})
    if op == "unzoom":
        return deck_go(zoom=None)
    if op == "ready":                                  # 26.11.49 a deck just added: read it, make its pictures
        return deck_ready(safe_name(str(data.get("file") or "")), {"anim": False} if data.get("anim") is False else {})
    if op == "scripture":                              # a Bible reference on a slide: offered (show: on screen at once)
        ref = VERSE_LISTEN.ask(str(data.get("ref") or "")[:80], source="slide")
        if not ref:
            raise ValueError("That is not a Bible reference FrameDecks knows.")
        if data.get("show"):
            VERSE_LISTEN.act("show")
        return {"ref": ref.get("label") or ref.get("ref")}
    if op == "search":
        f = str(data.get("file") or ((state.get("live") or {}).get("deck") or {}).get("file") or "")
        return {"slides": slides.search(slides.info(LAYERS_DIR, f)["slides"], data.get("q", ""))}
    if op == "about":                                  # 26.11.45 voice: "the slide about grace" goes to the best match
        d = (state.get("live") or {}).get("deck") or {}
        if not d.get("file"):
            raise ValueError("No slides are on screen. Go live with a Frame that has PowerPoint Content.")
        hit = slides.best(slides.info(LAYERS_DIR, d["file"])["slides"], data.get("q", ""))
        if not hit:
            raise ValueError("No slide is about that.")
        return deck_go(page=hit["n"] - 1)
    raise ValueError("Unknown slides action.")


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
    if (state.get("live") or {}).get("deck"):          # 26.11.45 a deck in the live Frame: its run order for this meeting
        return deck_go(step=step)
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
    d = (state.get("live") or {}).get("deck")
    deck = None
    if isinstance(d, dict) and d.get("file"):          # 26.11.45 the deck on screen, in this meeting's run order
        deck = {"name": d["file"][:-4], "page": d["page"] + 1, "pages": d["pages"], "pos": d.get("pos"), "count": d.get("count"),
                "file": d["file"], "deck": True}
    if not comp:
        return {"available": False, "scenes": [], "activeScene": "", "presentation": deck or powerpoint_show()}
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
    if deck:
        pres = deck
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
    g = _guard()
    return {"guard": {"active": bool(g.status.get("active")), "busy": bool(g.status.get("busy")), "front": g.status.get("front"),
                      "known": g.status.get("open") is not None},
            "available": True, "layout": comp.layout, "layers": [dict(l, status=lay_status.get(l["id"], {})) for l in comp.layers.layers],
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


def apply_people_see(choice):
    """26.11.12 How people see it. "window": FrameDecks vCam is switched off (and, from the next start, not even
    loaded); "camera" or "both": it is on, started now if this run never loaded it."""
    on = choice != "window"
    cur = vcam_settings()
    if cur.get("enabled") != on:
        cur["enabled"] = on
        vcam_save(cur)
    eng = VCAM.get("engine")
    if eng:
        (eng.start if on else eng.stop)()
    elif on and not VCAM.get("starting"):
        VCAM["reason"] = ""
        threading.Thread(target=vcam_start, daemon=True).start()


def vcam_start():
    """Create the engine (idle until Zoom/Teams uses FrameDecks). Safe to call when unavailable."""
    if VCAM["engine"] is not None or VCAM.get("starting"):
        return
    VCAM["starting"] = True
    try:
        _vcam_start()
    finally:
        VCAM["starting"] = False


def _vcam_start():
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
    see = app_settings()["peopleSee"]
    reason = VCAM["reason"] or ("Off: How people see it is set to Share a window." if eng is None and see == "window" else "")
    if lite:
        return {"available": eng is not None, "reason": reason, "registered": registered, "lite": True, "peopleSee": see,
                "settings": vcam_settings(), "status": dict(eng.status) if eng else None}
    return {"available": eng is not None, "reason": reason, "registered": registered, "peopleSee": see,
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


class StaticCache:
    """26.11.57 The program's own files with their ETag and a gzip copy for text, kept until the file changes."""
    PACK = (".js", ".css", ".json", ".svg", ".txt")

    def __init__(self, most=400):
        self.lock = threading.Lock()
        self.items = {}
        self.most = most

    def get(self, target):
        st = target.stat()
        key = str(target)
        stamp = (st.st_mtime_ns, st.st_size)
        with self.lock:
            hit = self.items.get(key)
            if hit and hit[0] == stamp:
                return hit[1]
        body = target.read_bytes()
        etag = '"%x-%x"' % (st.st_mtime_ns, st.st_size)
        packed = gzip.compress(body, 6, mtime=0) if target.suffix.lower() in self.PACK and len(body) > 1024 else None
        entry = (body, etag, packed)
        with self.lock:
            if len(self.items) >= self.most:
                self.items.clear()
            self.items[key] = (stamp, entry)
        return entry


static_cache = StaticCache()


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
        if not any(k == "Cache-Control" for k, _v in (headers or [])):
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

    def local_key_ok(self):
        """26.11.58 (release sign-off L2): the request carries the program's key (its cookie, or the header)."""
        if not local_key_needed():
            return True
        key = self.headers.get(LOCAL_HEADER, "")
        if key and secrets.compare_digest(key.encode(), LOCAL_TOKEN.encode()):
            return True
        m = re.search(r"(?:^|;\s*)" + LOCAL_COOKIE + r"=([A-Za-z0-9_\-]{20,100})", self.headers.get("Cookie", ""))
        return bool(m) and secrets.compare_digest(m.group(1).encode(), LOCAL_TOKEN.encode())

    def local_key_refused(self, path, method):
        """A request from this PC that needs the key and has none: answer it here (True). Overlay pages, their files
        and the read-only requests they make are open; every change and everything else under /api/ needs the key."""
        if not self.is_local() or self.local_key_ok():
            return False
        if method == "POST":
            if path in LOCAL_OPEN_POST:
                return False
        elif not path.startswith("/api/"):
            if path not in LOCAL_KEY_PAGES:
                return False
            self.reply(403, LOCAL_KEY_PAGE, TYPES[".html"], [(CSP_HEADER, "default-src 'none'; style-src 'unsafe-inline'"),
                                                              PAGE_FRAME_HEADER])
            return True
        elif path in LOCAL_OPEN_GET:
            return False
        self.reply(403, json.dumps({"error": LOCAL_KEY_ERROR, "code": "local-key"}), TYPES[".json"])
        return True

    def local_key_cookie(self, url):
        """GET page?t=KEY from this PC: set the key's cookie and send the browser to the same address without it."""
        if not self.is_local() or url.path.startswith("/api/") or "t=" not in url.query:
            return False
        q = parse_qs(url.query, keep_blank_values=True)
        tok = (q.pop("t", [""]) or [""])[0]
        if not secrets.compare_digest(tok.encode(), LOCAL_TOKEN.encode()):
            return False
        rest = urlencode(q, doseq=True)
        where = (url.path or "/") + ("?" + rest if rest else "")
        cookie = f"{LOCAL_COOKIE}={LOCAL_TOKEN}; Path=/; Max-Age={LOCAL_COOKIE_DAYS * 86400}; HttpOnly; SameSite=Strict"
        self.reply(302, "", "text/plain", [("Location", where), ("Set-Cookie", cookie)])
        return True

    def cross_site_api(self, path):
        """A web page from another site calling the program's API (e.g. an <img> pointing at /api/...). Browsers say so
        in Sec-Fetch-Site; the program's own pages, the phone remote and OBS are same-origin or direct, and programs
        and scripts on this PC send no such header. Pages themselves stay reachable (links, bookmarks)."""
        return path.startswith("/api/") and self.headers.get("Sec-Fetch-Site", "").lower() == "cross-site"

    def signed_in(self):
        m = re.search(COOKIE + r"=([A-Za-z0-9_\-]{20,100})", self.headers.get("Cookie", ""))
        if not m:
            return False
        now = time.time()
        with sessions_lock:
            entry = sessions.get(m.group(1))
            if not session_alive(entry, now):
                if entry is not None:                    # 26.11.58 (release sign-off M1): ended (a week, or 12 h unused)
                    sessions.pop(m.group(1), None)
                    save_sessions()
                return False
            entry["used"] = now
            if now - _sessions_saved["at"] > SESSION_SAVE_EVERY:   # the last-used time survives a restart
                save_sessions()
            return True

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
            if len(login_recent) >= MAX_LOGIN_FAILS and ip not in known_devices:   # too many wrong PINs from all devices
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
            known_devices.add(ip)
            if len(known_devices) > 256:
                known_devices.pop()
        token = secrets.token_urlsafe(32)
        with sessions_lock:
            sessions[token] = {"exp": now + SESSION_DAYS * 86400, "used": now}
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
        if self.local_key_cookie(url) or self.local_key_refused(path, "GET"):   # 26.11.58 (release sign-off L2)
            return None
        if not self.is_local() and REMOTE and path in ("", "/", "/remote"):
            return self.reply(302, "", "text/plain", [("Location", "/remote.html")])
        if not self.allowed(path):
            return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
        if path == "/api/remote/studio":                # scenes + presentation for the remote (PIN-protected)
            return self.reply(200, json.dumps(remote_studio_body()), TYPES[".json"])
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
        if path in ("/api/slides", "/api/slides/thumb"):   # 26.11.45 a deck's slides (the phone remote too, signed in)
            try:
                qs = parse_qs(url.query)
                f = qs.get("file", [""])[0] or ((state.get("live") or {}).get("deck") or {}).get("file", "")
                if path == "/api/slides/thumb":
                    body = slides.thumb(LAYERS_DIR, f, int(qs.get("n", ["1"])[0]), int(qs.get("w", ["320"])[0]))
                    return self.reply(200, body, "image/jpeg", [("Cache-Control", "private, max-age=86400")])
                return self.reply(200, json.dumps(slides_body(f)), TYPES[".json"], headers=[("Cache-Control", "no-store")])
            except (ValueError, OSError) as e:
                return self.reply(404, json.dumps({"error": str(e)}), TYPES[".json"])
        if path == "/api/join-qr.svg":                  # 26.11.44 the open members' phones link as a QR code (it is on screen)
            room = ROOM.body()
            if not room["open"] or not join_qr.valid(room["url"]):
                return self.reply(404, "Members' phones is closed", "text/plain; charset=utf-8")
            return self.reply(200, join_qr.svg(room["url"]).encode("utf-8"), "image/svg+xml", [("Cache-Control", "no-store")])
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
        if path == "/api/app/ready":                     # 26.11.28 the ready check, before you go live (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.reply(200, json.dumps(ready_report()), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path == "/api/app/features":                  # 26.11.31 which features are on (and whether they can change now)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.reply(200, json.dumps(features_body()), TYPES[".json"])
        if path == "/api/app/guard":                     # 26.11.7 the meeting guard: what is in the way, how busy
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            if "brief=1" in url.query:                   # 26.11.8 meeting mode for every window: cheap, every 5 s
                return self.reply(200, json.dumps(guard_brief()), TYPES[".json"])
            return self.reply(200, json.dumps(_guard().report()), TYPES[".json"])
        if path == "/api/app/info":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            info = {"version": APP_VERSION, "installedApp": FROZEN, "desktop": DESKTOP["active"], "dataFolder": str(DATA),
                    "separateData": SEPARATE_DATA, "windows": os.name == "nt", "settings": app_settings(),
                    "recovered": RECOVERED, "planRecovery": dict(PLAN_RECOVERY) or None, "features": features_body(),
                    "lowGpuActive": bool(DESKTOP.get("low_gpu")), "shell": DESKTOP.get("shell", "browser"),
                    "chrome": bool(DESKTOP.get("chrome")), "hotkeys": dict(DESKTOP.get("hotkey_results") or {}),
                    "remote": {"enabled": REMOTE, "listening": sorted(remote_servers), "failed": list(remote_errors)},
                    "backups": list_backups()[:KEEP_BACKUPS], "migration": migration_status()}
            return self.reply(200, json.dumps(info), TYPES[".json"])
        if path == "/api/remote-info":
            return self.reply(200, json.dumps(remote_info_body(self.server.server_address[1], "fresh=1" in url.query)),
                              TYPES[".json"])
        if path == "/api/app/status":                    # 26.11.30 (release audit L2): the Studio's status in one request
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            q = parse_qs(url.query)
            return self.reply(200, json.dumps(status_bundle(q.get("want", [""])[0], self.server.server_address[1],
                                                            q.get("fresh", [""])[0] == "1")), TYPES[".json"])
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
        if path == "/api/media/file":                    # 8.2 a Content's file, for Export Frame File (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            f = LAYERS_DIR / Path(parse_qs(url.query).get("name", [""])[0]).name
            if not f.name or not f.is_file():
                return self.reply(404, "Not found", "text/plain; charset=utf-8")
            return self.reply(200, f.read_bytes(), "application/octet-stream", [("Cache-Control", "no-store")])
        if path == "/api/media/duration":                # 26.11.57 a video's length, for "Play once, then Next" (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            f = LAYERS_DIR / Path(parse_qs(url.query).get("name", [""])[0]).name
            if not f.name or not f.is_file():
                return self.reply(404, json.dumps({"error": "That file is not on this PC."}), TYPES[".json"])
            return self.reply(200, json.dumps({"seconds": video_seconds(f)}), TYPES[".json"])
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
        if path == "/api/sync":                                   # Settings > Sync (this PC only); "update": 26.11.12
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.reply(200, json.dumps(sync_body()), TYPES[".json"])
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
            try:
                data = load_private_strict()
            except OSError as e:                         # 26.11.58 (release sign-off L3): kept, said, never emptied
                return self.reply(503, json.dumps({"error": "The member list couldn't be read: " + str(e),
                                                   "code": "private-unreadable"}), TYPES[".json"])
            data["storedAt"] = str(PRIVATE_FILE)
            return self.reply(200, json.dumps(data), TYPES[".json"])
        if path == "/api/state":
            q = parse_qs(url.query)
            since = q.get("since", [None])[0]
            try:
                wait = min(25.0, max(1.0, float(q.get("wait", ["25"])[0])))
            except ValueError:
                wait = 25.0
            riders = riders_asked(q.get("also", [""])[0]) if self.is_local() else {}
            with cond:
                if since is not None:
                    # Long-poll: answer as soon as something changes (or after `wait` seconds, at most 25).
                    # 26.11.20 also when a rider moved (Listen for scripture, Voice commands, Memory Cards): one
                    # waiting request per window instead of one each, which had filled the browser's 6 connections
                    # and made every press wait for one to come back (up to 10 s)
                    if riders:
                        end = time.monotonic() + wait
                        while str(state.get("rev")) == since and not riders_moved(riders):
                            left = end - time.monotonic()
                            if left <= 0:
                                break
                            cond.wait(min(RIDER_SLICE, left))
                    else:
                        cond.wait_for(lambda: str(state.get("rev")) != since, timeout=wait)
                snap = (state, LIBRARY["rev"])
            if riders:
                now = riders_now(riders)
                if since is not None and str(snap[0].get("rev")) == since:      # only a rider moved: no state sent
                    return self.reply(200, json.dumps({"unchanged": True, "rev": snap[0].get("rev"), "riders": now}), TYPES[".json"])
                body = state_body(q.get("librev", [None])[0], snap)
                return self.reply(200, '{"riders":' + json.dumps(now) + "," + body.lstrip()[1:], TYPES[".json"])
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
        if path == "/api/remote/memory":                # 9.1 Capture Chats on the phone remote (signed in; long-poll)
            q = parse_qs(url.query)
            since = q.get("since", [None])[0]
            if since is not None:
                try:
                    wait = min(25.0, max(1.0, float(q.get("wait", ["25"])[0])))
                except ValueError:
                    wait = 25.0
                MEMORY.wait(since, wait)
            return self.reply(200, json.dumps(remote_memory_body()), TYPES[".json"])
        if path == "/api/remote/notes":                 # 9.13 the phone remote's Notes (signed in; never cached)
            q = parse_qs(url.query)
            body = remote_notes_body(q.get("meeting", [""])[0], q.get("peek", [""])[0] != "1")
            return self.reply(200, json.dumps(body), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path == "/api/remote/meeting-key":           # 26.11.15 the phone: is a meeting app there to Mute / Camera?
            import meeting_keys
            st = meeting_keys.status()
            acts = st.get("acts") or {}
            body = {"available": bool(st.get("available")), "name": st.get("name") or "",
                    "acts": {a: bool(acts.get(a)) for a in REMOTE_MEETING_ACTS}}
            return self.reply(200, json.dumps(body), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path in ("/api/verse-listen", "/api/remote/verse-listen"):   # 26.11.14 Listen for scripture: the suggestion
            if path == "/api/verse-listen" and not self.is_local():   # (the phone: /api/remote/verse-listen, signed in)
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            q = parse_qs(url.query)
            try:
                after, wait = int(q.get("after", ["-1"])[0]), float(q.get("wait", ["0"])[0])
            except ValueError:
                after, wait = -1, 0.0
            body = VERSE_LISTEN.body(after if after >= 0 else None, wait)
            return self.reply(200, json.dumps(body), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path in ("/api/voice-commands", "/api/remote/voice-commands"):   # 26.11.20 Voice commands: what is heard
            if path == "/api/voice-commands" and not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            q = parse_qs(url.query)
            try:
                after, wait = int(q.get("after", ["-1"])[0]), float(q.get("wait", ["0"])[0])
            except ValueError:
                after, wait = -1, 0.0
            body = VOICE_CMD.body(after if after >= 0 else None, wait)
            return self.reply(200, json.dumps(body), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path == "/api/voice":                        # 26.11 Follow my voice: what was heard (this PC only; never cached)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            q = parse_qs(url.query)
            if q.get("info", [""])[0] == "1":
                return self.reply(200, json.dumps(VOICE.info()), TYPES[".json"], headers=[("Cache-Control", "no-store")])
            try:
                after, wait = int(q.get("after", ["0"])[0]), float(q.get("wait", ["0"])[0])
            except ValueError:
                after, wait = 0, 0.0
            return self.reply(200, json.dumps(VOICE.heard(after, wait)), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path == "/api/prayer":                       # 26.11.23 the prayer wall (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.reply(200, json.dumps(PRAYER.body()), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path == "/api/members":                      # 26.11.24 members' phones (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            return self.reply(200, json.dumps(members_body()), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path == "/api/room/response":                # 26.11.33 quick responses and polls (this PC only)
            return room_response_http(self)
        if path == "/api/room/answers":                 # 26.11.57 typed answers from phones (this PC only)
            return room_answers_http(self)
        if path == "/api/alerts":                       # 26.11.25 the corner card (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            ALERTS.step()
            return self.reply(200, json.dumps(dict(ALERTS.body(), sound=bool(app_settings().get("uiSounds")))), TYPES[".json"],
                              headers=[("Cache-Control", "no-store")])
        if path == "/api/summary/notes":                # 26.11.24 the sermon notes (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            q = parse_qs(url.query)
            n = meeting_log.sermon_notes(meeting_summary(q.get("run", ["latest"])[0]), state, q.get("script", ["1"])[0] != "0")
            if q.get("format", [""])[0] == "text":
                return self.reply(200, meeting_log.notes_text(n), "text/plain; charset=utf-8")
            return self.reply(200, json.dumps({"notes": n, "shared": ROOM.body()}), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path in ("/api/summary", "/api/summary/list"):   # 26.11.23 the meeting summary (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            q = parse_qs(url.query)
            if path == "/api/summary/list":
                return self.reply(200, json.dumps({"runs": MEETING_LOG.runs()}), TYPES[".json"], headers=[("Cache-Control", "no-store")])
            s = meeting_summary(q.get("run", ["latest"])[0])
            if q.get("format", [""])[0] == "text":
                return self.reply(200, meeting_log.as_text(s), "text/plain; charset=utf-8")
            return self.reply(200, json.dumps({"summary": s}), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path == "/api/displays":                     # 26.11.57 the screens connected now (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            cfg = app_settings()
            return self.reply(200, json.dumps({"displays": displays_now(), "chosen": cfg.get("audienceDisplay", ""),
                                               "auto": bool(cfg.get("audienceAuto"))}), TYPES[".json"])
        if path in ("/api/songs", "/api/songs/report"):   # 26.11.57 the Song Library (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            q = parse_qs(url.query)
            if path == "/api/songs/report":
                return self.reply(200, json.dumps(SONGS.report(q.get("month", [""])[0])), TYPES[".json"])
            one = q.get("id", [""])[0]
            if one:
                song = SONGS.get(one)
                return self.reply(200 if song else 404, json.dumps(song or {"error": "That song is not in the library."}), TYPES[".json"])
            return self.reply(200, json.dumps({"songs": SONGS.list(q.get("q", [""])[0]), "licence": app_settings().get("ccliLicence", "")}), TYPES[".json"])
        if path == "/api/notes":                        # 9.12 the leader's notes (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            q = parse_qs(url.query)
            data = NOTES.get(q.get("meeting", [""])[0])
            if q.get("format", [""])[0] == "md":
                return self.reply(200, meeting_notes.as_text(data), "text/markdown; charset=utf-8")
            return self.reply(200, json.dumps(data), TYPES[".json"])
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
            riders = riders_asked(parse_qs(url.query).get("also", [""])[0]) if self.is_local() else {}
            out = {"rev": state.get("rev", 0)}
            if riders:
                out["riders"] = riders_now(riders)                # 26.11.20 the riders, for pages that poll
            return self.reply(200, json.dumps(out), TYPES[".json"])
        if path == "/api/presence":
            return self.reply(200, json.dumps(presence_counts()), TYPES[".json"])

        if path in ("", "/"):
            path = "/dashboard.html"
        target = (APP / path.lstrip("/")).resolve()
        if APP.resolve() in target.parents and target.is_file():
            if target.suffix.lower() == ".html":
                data = target.read_bytes()
                extra = [(CSP_HEADER, page_csp(data)), PAGE_FRAME_HEADER]
                return self.reply(200, data, TYPES[".html"], extra)
            return self.static_file(target)
        self.reply(404, "Not found", "text/plain; charset=utf-8")

    def static_file(self, target):
        """26.11.57 Scripts, styles, fonts and pictures: the browser keeps a copy and asks "still the same?" (ETag), so
        a page and its preview frames do not download the same file again; text files travel gzip-compressed."""
        body, etag, packed = static_cache.get(target)
        cache = "public, max-age=604800" if target.suffix.lower() in (".woff2", ".ttf") else "no-cache"
        headers = [("ETag", etag), ("Cache-Control", cache), ("Vary", "Accept-Encoding")]
        if self.headers.get("If-None-Match", "") == etag:
            self.send_response(304)
            for k, v in headers:
                self.send_header(k, v)
            self.end_headers()
            return None
        if packed is not None and "gzip" in self.headers.get("Accept-Encoding", ""):
            body = packed
            headers.append(("Content-Encoding", "gzip"))
        return self.reply(200, body, TYPES.get(target.suffix.lower(), "application/octet-stream"), headers)

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

    def read_lesson(self):
        """26.11.54 Import a lesson: the file's text read on this PC into days, questions and Bible references
        (lesson_import.read). Nothing is kept: the dashboard shows the plan and makes the Frames itself."""
        if not self.is_local():
            return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
        name = Path(parse_qs(urlparse(self.path).query).get("name", ["lesson"])[0]).name
        if os.path.splitext(name)[1].lower() not in (".pdf", ".docx", ".txt"):
            return self.reply(400, json.dumps({"error": "Choose the lesson as a PDF, a Word file (.docx) or a text file."}), TYPES[".json"])
        length = int(self.headers.get("Content-Length", 0))
        import lesson_import
        if length <= 0 or length > lesson_import.MAX_BYTES:
            return self.reply(400, json.dumps({"error": "The file must be smaller than 40 MB."}), TYPES[".json"])
        data = self.rfile.read(length)
        try:
            plan = lesson_import.read(data, name)
        except ImportError:
            return self.reply(501, json.dumps({"error": "Reading PDF files needs the pypdfium2 package (it comes with the installer)."}), TYPES[".json"])
        except ValueError as e:
            return self.reply(422, json.dumps({"error": str(e)}), TYPES[".json"])
        return self.reply(200, json.dumps(plan), TYPES[".json"])

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
            try:                                       # 26.11.45 the notes and titles come from the .pptx itself
                slides.record_source(LAYERS_DIR, pdf.name, target.name)
                threading.Thread(target=lambda: slides.info(LAYERS_DIR, pdf.name), daemon=True).start()
            except OSError as e:
                _swallowed("slides.record_source", e)
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
            if data.get("enabled") and not feature_on("remote"):
                return bad("The phone remote is switched off (Settings → Start here → Features).", 409)
            res = set_remote(bool(data.get("enabled")))
            return ok(res)
        if action == "grant":
            # 26.11.26 the website's framedecks://connect link (desktop_app.py hands it over): look at the one-time grant;
            # the main window then asks Connect or Not now. Nothing is connected without that click.
            try:
                return ok(SYNC.grant_offer(data.get("code")) or {"status": "ignored"})
            except (cloud_sync.Offline, cloud_sync.Refused, OSError) as e:
                return bad(str(e), 503)
        if action == "settings":
            return ok(save_app_settings({k: v for k, v in data.items() if k != "features"}))   # features: api/app/features
        if action == "features":                    # 26.11.31 switch a feature on or off, or choose a ready-made set
            try:
                return ok(features_action(data))
            except PermissionError as e:
                return bad(str(e), 409)
            except ValueError as e:
                return bad(str(e))
        if action == "settings-reset":              # 26.11.22 Settings → "Reset this section": these keys back to default
            keys = [k for k in (data.get("keys") or []) if isinstance(k, str) and k in APP_SETTINGS_DEFAULTS and k not in SETTINGS_NEVER_RESET]
            if not keys:
                return bad("Nothing to reset here.")
            return ok(save_app_settings({k: APP_SETTINGS_DEFAULTS[k] for k in keys}))
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
        if action == "guard":                            # 26.11.7 Close it (the Windows Camera app) / battery settings
            what = str(data.get("do") or "")
            if what == "close-camera":
                import meeting_guard
                return ok({"asked": meeting_guard.close_camera_app()})
            if what == "power":
                return ok({"opened": open_external("ms-settings:batterysaver")})
            return bad("Unknown request", 400)
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
            then = spotlight_then(data.get("then"))           # 26.11.42 what the Command Center does once it shows
            if then:
                hook(True, then)
            else:
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
        if self.local_key_refused(urlparse(self.path).path, "POST"):     # 26.11.58 (release sign-off L2)
            return None
        if urlparse(self.path).path == "/api/vcam/upload":
            return self.upload_layer_file()
        if urlparse(self.path).path == "/api/brand/logo":
            return self.upload_brand_logo()
        if urlparse(self.path).path == "/api/lesson/read":
            return self.read_lesson()
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
        if path == "/api/remote/notes":                 # 9.13 the phone adds a note (when the PC allows it)
            try:
                res = remote_notes_action(data)
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(res), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path == "/api/remote/meeting-key":           # 26.11.15 the phone: Mute and Camera only (never Leave or Share)
            d = data if isinstance(data, dict) else {}
            act = str(d.get("act") or "")
            if act not in REMOTE_MEETING_ACTS:
                return self.reply(400, json.dumps({"error": "Not available from the remote."}), TYPES[".json"])
            import meeting_keys
            try:
                return self.reply(200, json.dumps(meeting_keys.send(act)), TYPES[".json"])
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
        if path in ("/api/verse-listen", "/api/remote/verse-listen"):   # 26.11.14 mode / dismiss / show (/ shown / hear)
            if path == "/api/verse-listen" and not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                res = verse_listen_action(data, remote=path != "/api/verse-listen")
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(res), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path in ("/api/voice-commands", "/api/remote/voice-commands"):   # 26.11.20 hold / enable / done (/ say)
            if path == "/api/voice-commands" and not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                res = voice_commands_action(data, remote=path != "/api/voice-commands")
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(res), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path == "/api/voice":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                res = voice_action(data if isinstance(data, dict) else {})
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(res), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path == "/api/room/response":                # 26.11.33 quick responses and polls (this PC only)
            return room_response_http(self, data if isinstance(data, dict) else {})
        if path == "/api/room/answers":                 # 26.11.57 typed answers from phones (this PC only)
            return room_answers_http(self, data if isinstance(data, dict) else {})
        if path == "/api/slides":                       # 26.11.45 go to a slide, step, search (the phone remote too)
            try:
                res = slides_action(data if isinstance(data, dict) else {})
            except (ValueError, OSError) as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(res), TYPES[".json"], headers=[("Cache-Control", "no-store")])
        if path in ("/api/prayer", "/api/members", "/api/alerts"):   # 26.11.23 prayer; 26.11.24 members; 26.11.25 card
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                act = {"/api/prayer": prayer_action, "/api/members": members_action, "/api/alerts": alerts_action}[path]
                res = act(data if isinstance(data, dict) else {})
            except cloud_sync.Offline as e:
                return self.reply(503, json.dumps({"error": str(e), "offline": True}), TYPES[".json"])
            except (ValueError, OSError) as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(res), TYPES[".json"])
        if path == "/api/present/screen":               # 26.11.57 the Share Window full screen on the room screen
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            ok, msg = present_on_screen((data or {}).get("key") if isinstance(data, dict) else None)
            return self.reply(200 if ok else 400, json.dumps({"ok": ok, "message": msg} if ok else {"error": msg}), TYPES[".json"])
        if path == "/api/songs":                        # 26.11.57 the Song Library (this PC only)
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                res = songbook.action(SONGS, data if isinstance(data, dict) else {})
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(res), TYPES[".json"])
        if path == "/api/notes":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            try:
                res = notes_action(data if isinstance(data, dict) else {})
            except ValueError as e:
                return self.reply(400, json.dumps({"error": str(e)}), TYPES[".json"])
            return self.reply(200, json.dumps(res), TYPES[".json"])
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
                if not self.is_local():                    # 26.11.58 (release sign-off M2): a phone runs the meeting,
                    data = remote_state_merge(state, data)  # it never replaces the plan
                save_state(data)
                return self.reply(200, state_body(LIBRARY["rev"] if keep else None), TYPES[".json"])
        if path == "/api/sync":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            action = data.get("action") if isinstance(data, dict) else None
            role = data.get("role") if isinstance(data, dict) else None
            code = data.get("code") if isinstance(data, dict) else None
            try:
                if action in ("link", "start"):                    # 26.11.12 "start": the QR code for a phone to scan
                    return self.reply(200, json.dumps(SYNC.link_start()), TYPES[".json"])
                if action == "cancel":
                    return self.reply(200, json.dumps(SYNC.link_cancel()), TYPES[".json"])
                if action == "unlink":
                    return self.reply(200, json.dumps(SYNC.unlink()), TYPES[".json"])
                if action == "now":
                    SYNC.poke(0)
                    return self.reply(200, json.dumps(SYNC.info()), TYPES[".json"])
                if action == "preview":                            # 26.11.41 the Frames panel's Sync: what would change
                    return self.reply(200, json.dumps(SYNC.frames_preview()), TYPES[".json"])
                if action in ("resync", "sync-now"):               # Sync now (8.4 Resync): a round now, with its outcome
                    return self.reply(200, json.dumps(SYNC.resync()), TYPES[".json"])
                # 26.11.12 Scan to join (0018_scan_to_join.sql), with this PC's own key
                if action == "invite":                             # Add a device / Invite someone: a 2-minute QR code
                    return self.reply(200, json.dumps(SYNC.invite(role or "admin")), TYPES[".json"])
                # 26.11.26 (0021): Add a device signs the phone in as you; Connect this PC from the website, asked here
                if action == "add-device":
                    return self.reply(200, json.dumps(SYNC.add_device()), TYPES[".json"])
                if action == "grant-accept":
                    return self.reply(200, json.dumps(SYNC.grant_accept()), TYPES[".json"])
                if action == "grant-decline":
                    return self.reply(200, json.dumps(SYNC.grant_decline()), TYPES[".json"])
                if action == "allow-peek":                         # Allow a device: who asked with this code
                    return self.reply(200, json.dumps(SYNC.allow_peek(code)), TYPES[".json"])
                if action == "allow":
                    return self.reply(200, json.dumps(SYNC.allow(code, role or "member")), TYPES[".json"])
                # 26.11.36 the first sync: the leader's choice after the preview, look again, Undo this connection
                if action == "first-choose":
                    return self.reply(200, json.dumps(SYNC.first_choose(data.get("mode"))), TYPES[".json"])
                if action == "first-refresh":
                    return self.reply(200, json.dumps(SYNC.first_refresh()), TYPES[".json"])
                if action == "undo-connection":
                    return self.reply(200, json.dumps(SYNC.undo_connection()), TYPES[".json"])
                if action == "devices":
                    return self.reply(200, json.dumps(SYNC.devices()), TYPES[".json"])
                if action == "remove":
                    person = data.get("person") if isinstance(data, dict) else None
                    return self.reply(200, json.dumps(SYNC.remove_device(person)), TYPES[".json"])
            except cloud_sync.Offline as e:
                return self.reply(503, json.dumps({"error": str(e), "offline": True}), TYPES[".json"])
            except (cloud_sync.Refused, OSError) as e:
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
            try:
                save_private(data)
            except dpapi_file.Unreadable as e:           # 26.11.58 (release sign-off L3): the unreadable file stays
                return self.reply(409, json.dumps({"error": "The member list couldn't be read, so it was not replaced: "
                                                   + str(e), "code": "private-unreadable"}), TYPES[".json"])
            return self.reply(204, b"", "text/plain")
        if path == "/api/presence":
            if isinstance(data, dict) and isinstance(data.get("id"), str):
                presence[data["id"][:40]] = (str(data.get("page", ""))[:20], time.time())
            return self.reply(204, b"", "text/plain")
        self.reply(404, "Not found", "text/plain; charset=utf-8")


def remote_info_body(port, fresh=False):
    """GET /api/remote-info: the phone remote's address, PIN and the devices seen (this PC only)."""
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
        info["network"] = windows_network_check(60 if fresh else None)
    return info


def presence_counts():
    """GET /api/presence: how many of each overlay page are open (seen in the last 12 s)."""
    now = time.time()
    counts = {}
    for key, (page, seen) in list(presence.items()):
        if now - seen > 12:
            presence.pop(key, None)
            continue
        counts[page] = counts.get(page, 0) + 1
    return counts


def guard_brief():
    g = _guard()
    return {"active": bool(g.status.get("active")), "busy": bool(g.status.get("busy")),
            "front": g.status.get("front"), "known": g.status.get("open") is not None}


def remote_studio_body():
    return dict(remote_studio_info(), smartNext=bool(app_settings().get("smartNext")), features=features_now())


def sync_body():
    return dict(SYNC.info(), remote=CLOUD_REMOTE.info(), live=DOORBELL.info())


# 26.11.30 (release audit L2): the Studio asked for seven status answers on their own timers, about two requests a
# second while it was in front. GET /api/app/status?want=remote,presence,... answers the ones it wants together, every
# 3 s (slower while minimised, through Store.pace). Each part is exactly what its own address answers; a part that
# fails is left out (the page keeps its last answer) and never spoils the others.
STATUS_PARTS = {
    "remote": lambda port, fresh: remote_info_body(port, fresh),
    "presence": lambda port, fresh: presence_counts(),
    "sync": lambda port, fresh: sync_body(),
    "slides": lambda port, fresh: remote_studio_body(),
    "guard": lambda port, fresh: guard_brief(),
    "studio": lambda port, fresh: studio_status(),
    "vcam": lambda port, fresh: vcam_status(lite=True),
    "mic": lambda port, fresh: VOICE.mic_body(),          # 26.11.34 the chosen microphone stopped: the Windows default
}


def status_bundle(want, port, fresh=False):
    out = {}
    for name in str(want or "").split(",")[:len(STATUS_PARTS)]:
        part = STATUS_PARTS.get(name)
        if part is None or name in out:
            continue
        try:
            out[name] = part(port, fresh)
        except Exception as e:                       # one part failing never takes the others down
            print(f"Status part {name} failed: {type(e).__name__}: {e}")
    return out


class MainServer(ThreadingHTTPServer):
    """The program's own server (127.0.0.1). 6.10: on Windows it asks for its port for itself alone. Windows lets
    SO_REUSEADDR bind a port that another program is still listening on, and then hands connections to either of
    them: a copy that had not finished closing got the window's requests, and the page said "refused to connect"."""
    allow_reuse_address = os.name != "nt"
    request_queue_size = 64      # 26.11.30 (release audit L1): the default 5 made a burst of screens wait about a second

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
    if app_settings()["peopleSee"] != "window":                  # 26.11.12 Share Window only: no camera loaded at all
        threading.Thread(target=vcam_start, daemon=True).start()   # idle until Zoom/Teams uses FrameDecks
    _guard().start()                                             # 26.11.7 measures only while a meeting uses FrameDecks vCam
    protect_private_files()                                      # 26.11.58 (release sign-off L3) Windows only
    threading.Thread(target=_backup_loop, daemon=True).start()
    threading.Thread(target=_remote_watcher, daemon=True).start()
    threading.Thread(target=_update_loop, daemon=True).start()   # once a day: is a newer version published?
    SYNC.start()                                                # does nothing unless this PC is linked
    CLOUD_REMOTE.start()                                        # idle unless linked and switched on in Settings
    DOORBELL.start()                                            # checks in only while linked; listens only while needed
    VERSE_LISTEN.start()                                        # 26.11.14 the microphone only while switched on and live
    VOICE_CMD.start()                                           # 26.11.20 voice commands: the same, plus the hold key
    mark_running()                                              # 26.11.22 a crash last time: the live Frame comes back
    ALERTS.start()                                              # 26.11.25 the corner card (only shows in the app)
    try:
        memory_sync()                  # 9.0 pinned Memory Cards from the last session go back into the chat overlay
    except Exception as e:
        print("Memory Cards:", e)
    return server


CRASH_LOG = "kc-crash.txt"
_CRASH_FILE = []


def crash_reporter():
    """26.11.52 a crash inside PowerPoint, the PDF reader or the camera ends the program without a Python error, so
    nothing reached the log (the owner's "the app crashed" when presenting slides left no trace). Python's own crash
    reporter writes every thread's place to kc-crash.txt when that happens; the support bundle includes it."""
    import faulthandler
    try:
        DATA.mkdir(parents=True, exist_ok=True)
        f = DATA / CRASH_LOG
        if f.is_file() and f.stat().st_size > 512_000:                  # keep it small: the last few crashes
            f.write_bytes(f.read_bytes()[-256_000:])
        fh = open(f, "a", encoding="utf-8")
        fh.write(f"\n--- FrameDecks {APP_VERSION} started {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
        fh.flush()
        faulthandler.enable(file=fh, all_threads=True)
        _CRASH_FILE.append(fh)                                       # kept open for as long as the program runs
    except OSError as e:
        _swallowed("crash reporter", e)


def main():
    crash_reporter()
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
    studio = local_url(base)                    # 26.11.58 (release sign-off L2): the Studio's address carries the key
    print(f"  Dashboard (opens automatically):  {studio}")
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
        threading.Timer(0.8, lambda: webbrowser.open(studio)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        set_remote(False)
        server.server_close()


if __name__ == "__main__":
    main()
