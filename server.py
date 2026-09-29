#!/usr/bin/env python3
"""
BSF Command Center - local program.

Serves the dashboard and overlays at http://localhost:8750 on THIS computer only.
No internet, cloud account, or extra installs are needed beyond Python 3
(standard library only). Your content is saved in "bsf-saved-content.json".

Windows: double-click "Start BSF Command Center.bat"
         or "Start BSF Command Center with iPad Remote.bat" (adds the phone remote)
Mac:     double-click "Start BSF Command Center (Mac).command"
         (for the phone remote: python3 server.py --remote)
"""
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

APP_VERSION = "3.0"
STARTED_AT = time.time()
FROZEN = getattr(sys, "frozen", False)          # True inside the installed Windows app
HERE = Path(sys.executable).resolve().parent if FROZEN else Path(__file__).resolve().parent
RES = Path(getattr(sys, "_MEIPASS", HERE))       # where the app's pages are bundled
APP = RES / "app"


def _data_dir():
    """Installed app: %APPDATA%\\BSF Command Center. Script/zip version: next to server.py (as before)."""
    if os.environ.get("BSF_DATA_DIR"):
        return Path(os.environ["BSF_DATA_DIR"])
    if FROZEN:
        return Path(os.environ.get("APPDATA") or Path.home()) / "BSF Command Center"
    return HERE


DATA = _data_dir()
DATA.mkdir(parents=True, exist_ok=True)
SEPARATE_DATA = DATA.resolve() != HERE.resolve()
STATE_FILE = DATA / "bsf-saved-content.json"
PRIVATE_FILE = DATA / "bsf-members-private.json"  # member list + settings; never sent to overlays
APP_SETTINGS_FILE = DATA / "bsf-app-settings.json"
BACKUP_DIR = DATA / "backups"
PREFERRED_PORT = 8750
PORTS = [PREFERRED_PORT] + list(range(8751, 8761))
MAX_BODY = 8 * 1024 * 1024

# ---------- phone remote (off unless started with --remote) ----------
REMOTE = "--remote" in sys.argv
PIN_FILE = DATA / "bsf-remote-pin.txt"
SESSIONS_FILE = DATA / "bsf-remote-sessions.json"
SESSION_DAYS = 30
COOKIE = "bsf_remote"
# What a signed-in phone or iPad may open. Member data and the dashboard are never on this list.
REMOTE_PUBLIC = {"/remote.html", "/css/remote.css", "/js/remote.js", "/js/store.js", "/api/remote-login",
                 "/remote-manifest.json", "/icons/remote-180.png", "/icons/remote-192.png", "/icons/remote-512.png",
                 "/icons/remote-maskable-512.png"}
REMOTE_SIGNED_IN = {"/api/rev", "/api/state", "/api/remote-logout", "/js/overlay.js",
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


def lan_addresses():
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


def save_state(new):
    global state
    with cond:
        new["rev"] = int(state.get("rev", 0)) + 1
        state = new
        tmp = STATE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, STATE_FILE)
        cond.notify_all()
        return state


# ---------- Read-only checks used by Settings > Phone & iPad Remote and Diagnostics ----------
_net_cache = {"at": 0, "value": None}


_net_lock = threading.Lock()


def windows_network_check():
    """On Windows, report the network type (Private/Public) and whether the optional firewall
    rule exists. Read-only: nothing is changed. Runs in the background and is cached for 60 s,
    so it never slows the dashboard. Returns None on other systems or while first checking."""
    if os.name != "nt":
        return None
    if time.time() - _net_cache["at"] > 60 and _net_lock.acquire(blocking=False):
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
        r = subprocess.run(["netsh", "advfirewall", "firewall", "show", "rule", "name=BSF Command Center iPad Remote"],
                           capture_output=True, text=True, timeout=8, creationflags=flags)
        out["ruleExists"] = r.returncode == 0
    except Exception:
        pass
    _net_cache.update({"at": time.time(), "value": out})


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
        "version": APP_VERSION, "python": platform.python_version(), "os": platform.platform(),
        "folder": str(HERE), "dataFolder": str(DATA), "installedApp": FROZEN, "port": address[1], "listeningOn": address[0],
        "remoteMode": REMOTE, "addresses": lan_addresses(), "uptimeSeconds": int(time.time() - STARTED_AT),
        "stateRevision": state.get("rev", 0), "files": files, "remoteSessions": n_sessions,
        "devices": [{"ip": ip, "lastSeen": d["last"], "signedIn": d["signedIn"]} for ip, d in devices.items()],
        "network": windows_network_check() if REMOTE else None, "now": time.time()
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
APP_SETTINGS_DEFAULTS = {"remoteAutostart": False, "importDecided": False}


def app_settings():
    out = dict(APP_SETTINGS_DEFAULTS)
    try:
        data = json.loads(APP_SETTINGS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            for k in out:
                if isinstance(data.get(k), bool):
                    out[k] = data[k]
    except (OSError, ValueError):
        pass
    return out


def save_app_settings(changes):
    cur = app_settings()
    for k, v in changes.items():
        if k in APP_SETTINGS_DEFAULTS and isinstance(v, bool):
            cur[k] = v
    APP_SETTINGS_FILE.write_text(json.dumps(cur, indent=2), encoding="utf-8")
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


DATA_FILE_NAMES = ["bsf-saved-content.json", "bsf-members-private.json", "bsf-remote-pin.txt", "bsf-remote-sessions.json"]


def looks_like_data(folder):
    return (folder / DATA_FILE_NAMES[0]).is_file() or (folder / DATA_FILE_NAMES[1]).is_file()


def _describe(folder):
    info = {"folder": str(folder), "modified": 0, "members": None, "questions": None}
    for name in DATA_FILE_NAMES[:2]:
        f = folder / name
        if f.is_file():
            info["modified"] = max(info["modified"], f.stat().st_mtime)
    try:
        info["members"] = len(json.loads((folder / DATA_FILE_NAMES[1]).read_text(encoding="utf-8")).get("members") or [])
    except (OSError, ValueError, AttributeError):
        pass
    try:
        info["questions"] = len((json.loads((folder / DATA_FILE_NAMES[0]).read_text(encoding="utf-8")).get("library") or {}).get("questions") or [])
    except (OSError, ValueError, AttributeError):
        pass
    return info


def migration_candidates():
    """Look (two folders deep) in Desktop, Downloads, Documents and OneDrive for an earlier BSF Command Center folder."""
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
        raise ValueError("That folder doesn’t contain BSF Command Center data (bsf-saved-content.json or bsf-members-private.json).")
    if src.resolve() == DATA.resolve():
        raise ValueError("That is already the folder the Command Center uses.")
    backup_now("before-import")
    copied = []
    for name in DATA_FILE_NAMES:
        if (src / name).is_file():
            shutil.copy2(src / name, DATA / name)
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


FIREWALL_RULE = "BSF Command Center iPad Remote"   # same name the earlier helper used


def firewall(action):
    """Windows only. Asks for administrator permission (UAC). Allow = inbound, this program only, Private networks only."""
    if os.name != "nt":
        return False, "Only available on Windows."
    import base64
    prog = sys.executable.replace("'", "''")
    if action == "allow":
        inner = (f"Remove-NetFirewallRule -DisplayName '{FIREWALL_RULE}' -ErrorAction SilentlyContinue; "
                 f"New-NetFirewallRule -DisplayName '{FIREWALL_RULE}' -Direction Inbound -Action Allow "
                 f"-Program '{prog}' -Protocol TCP -Profile Private | Out-Null")
    else:
        inner = f"Remove-NetFirewallRule -DisplayName '{FIREWALL_RULE}' -ErrorAction SilentlyContinue"
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


TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".ttf": "font/ttf", ".woff2": "font/woff2", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".txt": "text/plain; charset=utf-8",
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
        if not self.host_ok():
            return self.reply(403, "Forbidden", "text/plain; charset=utf-8")
        url = urlparse(self.path)
        path = unquote(url.path)
        if not self.is_local() and REMOTE and path in ("", "/", "/remote"):
            return self.reply(302, "", "text/plain", [("Location", "/remote.html")])
        if not self.allowed(path):
            return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
        if path == "/api/app/ping":
            return self.reply(200, json.dumps({"app": "BSF Command Center", "version": APP_VERSION}), TYPES[".json"])
        if path == "/api/app/info":
            if not self.is_local():
                return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
            info = {"version": APP_VERSION, "installedApp": FROZEN, "desktop": DESKTOP["active"], "dataFolder": str(DATA),
                    "separateData": SEPARATE_DATA, "windows": os.name == "nt", "settings": app_settings(),
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
                own = set() if os.environ.get("BSF_TEST_COUNT_OWN_ADDRESS") == "1" else set(ips)
                info["devices"] = [{"ip": ip, "lastSeen": d["last"], "firstSeen": d["first"], "signedIn": d["signedIn"]}
                                   for ip, d in sorted(devices.items(), key=lambda kv: -kv[1]["last"]) if ip not in own]
                info["network"] = windows_network_check()
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
            since = parse_qs(url.query).get("since", [None])[0]
            with cond:
                if since is not None:
                    # Long-poll: answer as soon as something changes (or after 25 s)
                    cond.wait_for(lambda: str(state.get("rev")) != since, timeout=25)
                body = json.dumps(state)
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

    def app_action(self, action, data):
        ok = lambda obj: self.reply(200, json.dumps(obj), TYPES[".json"])
        bad = lambda msg, code=400: self.reply(code, json.dumps({"error": msg}), TYPES[".json"])
        if action == "remote":
            res = set_remote(bool(data.get("enabled")))
            return ok(res)
        if action == "settings":
            return ok(save_app_settings(data))
        if action == "backup-now":
            name = backup_now(time.strftime("%H%M%S"))
            return ok({"backup": name, "backups": list_backups()}) if name else bad("There is nothing to back up yet.")
        if action == "open-folder":
            target = BACKUP_DIR if data.get("which") == "backups" else DATA
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
        if action in ("show", "hide", "quit"):
            fn = DESKTOP.get(action)
            if not fn:
                return bad("Only available in the installed app.", 501)
            threading.Thread(target=fn, daemon=True).start()
            return ok({"ok": True})
        return bad("Unknown action", 404)

    def do_POST(self):
        if not self.host_ok() or not self.origin_ok():
            return self.reply(403, "Forbidden", "text/plain; charset=utf-8")
        path = urlparse(self.path).path
        if not self.allowed(path):
            return self.reply(403, "Not available from this device", "text/plain; charset=utf-8")
        try:
            data = self.read_json()
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, "Invalid data", "text/plain; charset=utf-8")
        if path == "/api/remote-login":
            return self.remote_login(data)
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
            with cond:
                # Two devices changed things at the same moment: send back the latest so it can redo its change
                if base is not None and str(base) != str(state.get("rev", 0)):
                    return self.reply(409, json.dumps(state), TYPES[".json"])
                return self.reply(200, json.dumps(save_state(data)), TYPES[".json"])
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
    threading.Thread(target=_backup_loop, daemon=True).start()
    threading.Thread(target=_remote_watcher, daemon=True).start()
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
    print("  BSF Command Center is running.")
    print()
    print(f"  Dashboard (opens automatically):  {base}/")
    print(f"  BSF Focus Verse overlay:          {base}/focus-verse.html")
    print(f"  BSF Discussion Question1 overlay: {base}/discussion-question.html")
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
