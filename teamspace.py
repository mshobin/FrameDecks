"""
Kingdom Connect Team Space: direct peer-to-peer between Kingdom Connect PCs over a WireGuard network.

Team Space is available only when authorized peers are online through a secure WireGuard network.
No cloud relay or third-party server is required.

How it works (standard library only):
  * Each PC listens on its own WireGuard address only (never on the LAN or the internet), on the Team Space
    port (8790 by default). The main app server stays on 127.0.0.1.
  * A peer is authorized when its WireGuard address is in this PC's peer list AND every message is signed
    with the shared team key (HMAC-SHA256, with a timestamp and a single-use nonce). WireGuard itself encrypts
    the traffic end to end between the two PCs and guarantees the sender's tunnel address.
  * Every few seconds each PC sends a signed "sync" to each peer over the tunnel. A peer that answers is
    Online; one that does not is Offline. The same exchange carries the shared notes and action list,
    which are merged (last writer wins per note and per action item).
  * Nothing is queued or forwarded. A message is delivered only if the other PC answers right now.
    "Ask to Go Live" is refused unless the other PC is connected at that moment.
"""
import base64
import hashlib
import hmac
import http.client
import ipaddress
import json
import os
import re
import secrets
import socket
import subprocess
import sys
import threading
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

TEAM_TEXT = ("Team Space is available only when authorized peers are online through a secure WireGuard network. "
             "No cloud relay or third-party server is required.")
PROTOCOL = 1
DEFAULT_PORT = 8790
SYNC_EVERY = 4.0            # seconds between presence/sync exchanges with each peer
ONLINE_FOR = 12.0           # a peer is Online while it answered within this many seconds
MAX_SKEW = 120              # accepted clock difference between peers (seconds)
ASK_EXPIRES = 120           # an unanswered Ask to Go Live lapses after this many seconds
MAX_PEERS = 16
MAX_NOTES = 20000
MAX_ACTIONS = 200
MAX_BODY = 512 * 1024
PATH = "/team/v1"
ALLOW_ANY_ADDRESS = os.environ.get("KC_TEAMSPACE_ALLOW_ANY_ADDRESS") == "1"   # tests only: skip the WireGuard check

DEFAULTS = {"enabled": False, "name": "", "address": "", "port": DEFAULT_PORT, "key": "", "peers": []}


def _now_ms():
    return int(time.time() * 1000)


def _valid_ip(s):
    try:
        ip = ipaddress.IPv4Address(str(s).strip())
    except ValueError:
        return ""
    if ip.is_unspecified or ip.is_multicast:
        return ""
    return str(ip)


def new_key():
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")


def _key_bytes(key):
    raw = re.sub(r"[^A-Za-z0-9_\-]", "", key or "")
    if len(raw) < 32:
        return b""
    return hashlib.sha256(b"kingdom-connect-team-v1:" + raw.encode()).digest()


def key_fingerprint(key):
    k = _key_bytes(key)
    if not k:
        return ""
    h = hashlib.sha256(b"fp:" + k).hexdigest()[:12].upper()
    return "-".join(h[i:i + 4] for i in range(0, 12, 4))


# ---------- WireGuard interface detection ----------
_wg_cache = {"at": 0.0, "list": []}


def wireguard_addresses(max_age=20.0):
    """[{"iface", "address"}] for this PC's WireGuard tunnels (IPv4)."""
    if time.time() - _wg_cache["at"] < max_age:
        return list(_wg_cache["list"])
    out = []
    try:
        if sys.platform.startswith("win"):
            ps = ("Get-NetAdapter | Where-Object { $_.InterfaceDescription -like '*WireGuard*' -and $_.Status -eq 'Up' } | "
                  "ForEach-Object { $n = $_.Name; Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 "
                  "-ErrorAction SilentlyContinue | ForEach-Object { $n + '|' + $_.IPAddress } }")
            r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps], capture_output=True,
                               text=True, timeout=8, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            for line in r.stdout.splitlines():
                if "|" in line:
                    name, ip = line.strip().rsplit("|", 1)
                    if _valid_ip(ip):
                        out.append({"iface": name, "address": ip})
        elif sys.platform.startswith("linux"):
            base = Path("/sys/class/net")
            for dev in sorted(base.iterdir()) if base.exists() else []:
                try:
                    if "DEVTYPE=wireguard" not in (dev / "uevent").read_text():
                        continue
                except OSError:
                    continue
                r = subprocess.run(["ip", "-o", "-4", "addr", "show", "dev", dev.name], capture_output=True,
                                   text=True, timeout=5)
                for m in re.finditer(r"inet (\d+\.\d+\.\d+\.\d+)", r.stdout):
                    out.append({"iface": dev.name, "address": m.group(1)})
        elif sys.platform == "darwin":
            r = subprocess.run(["ifconfig"], capture_output=True, text=True, timeout=5)
            iface = ""
            for line in r.stdout.splitlines():
                m = re.match(r"^(\S+):", line)
                if m:
                    iface = m.group(1)
                m = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", line)
                if m and iface.startswith("utun"):
                    out.append({"iface": iface, "address": m.group(1)})
    except (OSError, subprocess.SubprocessError, ValueError):
        pass
    _wg_cache.update(at=time.time(), list=out)
    return list(out)


def is_wireguard_address(ip):
    return ALLOW_ANY_ADDRESS or any(a["address"] == ip for a in wireguard_addresses())


class TeamSpace:
    def __init__(self, data_dir, scenes_fn=None, version=""):
        self.dir = Path(data_dir)
        self.config_file = self.dir / "kc-teamspace.json"
        self.doc_file = self.dir / "kc-teamspace-doc.json"
        self.scenes_fn = scenes_fn or (lambda: ([], ""))
        self.version = version
        self.lock = threading.RLock()
        self.cfg = self._load_config()
        self.doc = self._load_doc()
        self.peers = {}          # address -> {"seen": t, "name", "scenes", "live", "error", "version"}
        self.nonces = {}         # nonce -> ts
        self.incoming = []       # Ask to Go Live requests received
        self.outgoing = []       # Ask to Go Live requests sent
        self.server = None
        self.listen_error = ""
        self.stop_evt = threading.Event()
        self.thread = None

    # ---------- configuration ----------
    def _load_config(self):
        cfg = dict(DEFAULTS)
        try:
            data = json.loads(self.config_file.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                cfg.update(self._clean(data, cfg))
        except (OSError, ValueError):
            pass
        return cfg

    def _clean(self, d, cur):
        out = dict(cur)
        if isinstance(d.get("enabled"), bool):
            out["enabled"] = d["enabled"]
        if "name" in d:
            out["name"] = re.sub(r"[\x00-\x1f]", "", str(d.get("name") or ""))[:40].strip()
        if "address" in d:
            out["address"] = _valid_ip(d.get("address")) if d.get("address") else ""
        if "port" in d:
            try:
                p = int(d.get("port"))
                out["port"] = p if 1024 <= p <= 65535 else DEFAULT_PORT
            except (TypeError, ValueError):
                out["port"] = DEFAULT_PORT
        if "key" in d:
            k = re.sub(r"[^A-Za-z0-9_\-]", "", str(d.get("key") or ""))[:100]
            out["key"] = k if len(k) >= 32 else ""
        if isinstance(d.get("peers"), list):
            peers, seen = [], set()
            for p in d["peers"][:MAX_PEERS]:
                if not isinstance(p, dict):
                    continue
                ip = _valid_ip(p.get("address"))
                if not ip or ip in seen:
                    continue
                seen.add(ip)
                try:
                    port = int(p.get("port") or 0)
                except (TypeError, ValueError):
                    port = 0
                peers.append({"name": re.sub(r"[\x00-\x1f]", "", str(p.get("name") or ""))[:40].strip() or ip,
                              "address": ip, "port": port if 1024 <= port <= 65535 else 0})
            out["peers"] = peers
        return out

    def _save_config(self):
        tmp = self.config_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.cfg, indent=1), encoding="utf-8")
        os.replace(tmp, self.config_file)

    def configure(self, changes):
        """Apply settings from the dashboard. Returns (ok, message)."""
        with self.lock:
            nxt = self._clean(changes if isinstance(changes, dict) else {}, self.cfg)
            if changes.get("newKey"):
                nxt["key"] = new_key()
            if nxt["address"] and any(p["address"] == nxt["address"] for p in nxt["peers"]):
                return False, "A peer can't have this PC's own WireGuard address."
            if nxt["enabled"]:
                if not nxt["address"]:
                    return False, "Choose this PC's WireGuard address first."
                if not is_wireguard_address(nxt["address"]):
                    return False, ("{} is not an address of a connected WireGuard tunnel on this PC. Connect WireGuard "
                                   "first, then choose its address.".format(nxt["address"]))
                if not nxt["key"]:
                    return False, "Create or paste the team key first."
            restart = (nxt["enabled"], nxt["address"], nxt["port"]) != (self.cfg["enabled"], self.cfg["address"], self.cfg["port"])
            self.cfg = nxt
            self._save_config()
            gone = set(self.peers) - {p["address"] for p in nxt["peers"]}
            for ip in gone:
                self.peers.pop(ip, None)
        if restart:
            self.restart()
        return True, ""

    # ---------- shared document (notes + actions) ----------
    def _load_doc(self):
        doc = {"notes": {"text": "", "at": 0, "by": ""}, "actions": {}}
        try:
            data = json.loads(self.doc_file.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                self._merge_into(doc, data)
        except (OSError, ValueError):
            pass
        return doc

    def _save_doc(self):
        tmp = self.doc_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.doc), encoding="utf-8")
        os.replace(tmp, self.doc_file)

    @staticmethod
    def _newer(a, b):
        """True when item a should replace item b (last writer wins; ties broken by author)."""
        return (int(a.get("at", 0)), str(a.get("by", ""))) > (int(b.get("at", 0)), str(b.get("by", "")))

    def _merge_into(self, doc, other):
        changed = False
        n = other.get("notes")
        if isinstance(n, dict) and isinstance(n.get("text"), str) and isinstance(n.get("at"), (int, float)):
            cand = {"text": n["text"][:MAX_NOTES], "at": int(n["at"]), "by": str(n.get("by", ""))[:40]}
            if self._newer(cand, doc["notes"]):
                doc["notes"] = cand
                changed = True
        acts = other.get("actions")
        if isinstance(acts, dict):
            for aid, a in list(acts.items())[:MAX_ACTIONS * 2]:
                if not (isinstance(a, dict) and re.fullmatch(r"[A-Za-z0-9_\-]{4,40}", str(aid))):
                    continue
                if not isinstance(a.get("at"), (int, float)):
                    continue
                cand = {"id": aid, "text": str(a.get("text", ""))[:300], "done": bool(a.get("done")),
                        "del": bool(a.get("del")), "at": int(a["at"]), "by": str(a.get("by", ""))[:40],
                        "created": int(a.get("created") or a["at"])}
                cur = doc["actions"].get(aid)
                if cur is None or self._newer(cand, cur):
                    doc["actions"][aid] = cand
                    changed = True
        # keep the list bounded: drop the oldest deleted items first
        if len(doc["actions"]) > MAX_ACTIONS:
            order = sorted(doc["actions"].values(), key=lambda a: (not a["del"], a["at"]))
            for a in order[:len(doc["actions"]) - MAX_ACTIONS]:
                doc["actions"].pop(a["id"], None)
        return changed

    def merge(self, other):
        with self.lock:
            if self._merge_into(self.doc, other):
                self._save_doc()

    def set_notes(self, text):
        with self.lock:
            self.doc["notes"] = {"text": str(text)[:MAX_NOTES], "at": max(_now_ms(), self.doc["notes"]["at"] + 1),
                                 "by": self.cfg["name"] or self.cfg["address"]}
            self._save_doc()

    def action(self, d):
        op = d.get("op")
        with self.lock:
            me = self.cfg["name"] or self.cfg["address"]
            if op == "add":
                text = str(d.get("text", "")).strip()[:300]
                if not text:
                    return False, "Type the action first."
                if sum(1 for a in self.doc["actions"].values() if not a["del"]) >= MAX_ACTIONS:
                    return False, "The action list is full."
                aid = secrets.token_urlsafe(9)
                self.doc["actions"][aid] = {"id": aid, "text": text, "done": False, "del": False, "at": _now_ms(), "by": me,
                                         "created": _now_ms()}
            else:
                a = self.doc["actions"].get(str(d.get("id", "")))
                if not a:
                    return False, "That action no longer exists."
                a = dict(a, at=max(_now_ms(), a["at"] + 1), by=me)
                if op == "toggle":
                    a["done"] = not a["done"]
                elif op == "edit":
                    a["text"] = str(d.get("text", "")).strip()[:300] or a["text"]
                elif op == "delete":
                    a["del"] = True
                else:
                    return False, "Unknown action."
                self.doc["actions"][a["id"]] = a
            self._save_doc()
        return True, ""

    # ---------- signed messages ----------
    def _envelope(self, to, kind, body):
        msg = {"v": PROTOCOL, "from": self.cfg["address"], "to": to, "name": self.cfg["name"], "ts": int(time.time()),
               "nonce": secrets.token_hex(16), "type": kind, "body": body}
        raw = json.dumps(msg, separators=(",", ":")).encode()
        sig = hmac.new(_key_bytes(self.cfg["key"]), raw, hashlib.sha256).hexdigest()
        return raw, sig

    def _verify(self, raw, sig, expect_from, expect_to):
        key = _key_bytes(self.cfg["key"])
        if not key or not sig:
            return None, "unsigned"
        good = hmac.new(key, raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(good, sig):
            return None, "bad signature"
        try:
            msg = json.loads(raw.decode())
        except (ValueError, UnicodeDecodeError):
            return None, "bad message"
        if not isinstance(msg, dict) or msg.get("v") != PROTOCOL:
            return None, "unsupported version"
        if msg.get("from") != expect_from or msg.get("to") != expect_to:
            return None, "wrong address"
        if abs(time.time() - int(msg.get("ts", 0))) > MAX_SKEW:
            return None, "clock difference too large"
        nonce = str(msg.get("nonce", ""))
        with self.lock:
            now = time.time()
            for n, t in list(self.nonces.items()):
                if now - t > MAX_SKEW * 2:
                    del self.nonces[n]
            if not re.fullmatch(r"[0-9a-f]{32}", nonce) or nonce in self.nonces:
                return None, "replayed"
            self.nonces[nonce] = now
        return msg, ""

    def _peer(self, ip):
        for p in self.cfg["peers"]:
            if p["address"] == ip:
                return p
        return None

    def _send(self, peer, kind, body, timeout=3.0):
        """Send one signed message straight to a peer over the tunnel. Returns its reply message or raises."""
        raw, sig = self._envelope(peer["address"], kind, body)
        conn = http.client.HTTPConnection(peer["address"], peer["port"] or self.cfg["port"], timeout=timeout,
                                          source_address=(self.cfg["address"], 0))
        try:
            conn.request("POST", PATH, body=raw, headers={"Content-Type": "application/json", "X-KC-Sig": sig})
            r = conn.getresponse()
            data = r.read(MAX_BODY + 1)
            if r.status != 200 or len(data) > MAX_BODY:
                raise OSError("refused ({})".format(r.status))
            msg, err = self._verify(data, r.getheader("X-KC-Sig", ""), peer["address"], self.cfg["address"])
            if not msg:
                raise OSError("reply rejected: " + err)
            return msg
        finally:
            conn.close()

    def _sync_body(self):
        scenes, live = self.scenes_fn()
        with self.lock:
            return {"doc": json.loads(json.dumps(self.doc)), "scenes": scenes[:400], "live": live, "app": self.version}

    def _seen(self, ip, msg):
        b = msg.get("body") if isinstance(msg.get("body"), dict) else {}
        with self.lock:
            st = self.peers.setdefault(ip, {})
            st.update(seen=time.time(), error="", name=str(msg.get("name", ""))[:40])
            if msg.get("type") == "sync":
                sc = b.get("scenes")
                st["scenes"] = [{"id": str(s.get("id", ""))[:40], "name": str(s.get("name", ""))[:80]}
                                for s in sc if isinstance(s, dict)][:400] if isinstance(sc, list) else []
                st["live"] = str(b.get("live", ""))[:40]
                st["version"] = str(b.get("app", ""))[:12]
        if msg.get("type") == "sync" and isinstance(b.get("doc"), dict):
            self.merge(b["doc"])

    def online(self, ip):
        st = self.peers.get(ip)
        return bool(st and time.time() - st.get("seen", 0) < ONLINE_FOR)

    # ---------- handling a message from a peer ----------
    def handle(self, client_ip, raw, sig):
        """Returns (status, reply_bytes, reply_sig)."""
        with self.lock:
            if not (self.cfg["enabled"] and self.cfg["key"]):
                return 403, b"", ""
            peer = self._peer(client_ip)
        if not peer:
            return 403, b"", ""               # not an authorized peer address
        msg, err = self._verify(raw, sig, client_ip, self.cfg["address"])
        if not msg:
            with self.lock:
                self.peers.setdefault(client_ip, {})["error"] = err
            return 403, b"", ""
        self._seen(client_ip, msg)
        kind, b = msg.get("type"), msg.get("body") if isinstance(msg.get("body"), dict) else {}
        if kind == "sync":
            out = self._sync_body()
        elif kind == "ask":
            out = self._receive_ask(client_ip, msg, b)
        elif kind == "answer":
            with self.lock:
                for r in self.outgoing:
                    if r["id"] == b.get("id") and r["peer"] == client_ip and r["status"] == "sent":
                        r["status"] = "approved" if b.get("approved") else "declined"
                        r["answeredAt"] = time.time()
            out = {"ok": True}
        else:
            out = {"ok": False, "error": "unknown"}
        raw_out, sig_out = self._envelope(client_ip, kind or "reply", out)
        return 200, raw_out, sig_out

    def _receive_ask(self, ip, msg, b):
        scenes, _ = self.scenes_fn()
        sid = str(b.get("scene", ""))[:40]
        sc = next((s for s in scenes if s["id"] == sid), None)
        if not sc:
            return {"ok": False, "error": "That scene is not on the meeting PC any more."}
        rid = str(b.get("id", ""))[:40]
        with self.lock:
            if any(r["id"] == rid for r in self.incoming):
                return {"ok": True}
            self.incoming.append({"id": rid, "from": ip, "fromName": str(msg.get("name", ""))[:40] or ip,
                                  "scene": sid, "sceneName": sc["name"], "at": time.time(), "status": "pending"})
            self.incoming[:] = self.incoming[-20:]
        return {"ok": True}

    # ---------- actions from this PC's dashboard ----------
    def ask(self, peer_ip, scene_id):
        with self.lock:
            peer = self._peer(peer_ip)
        if not peer:
            return False, "Choose a co-leader from your peer list."
        if not self.online(peer_ip):
            return False, "{} is offline. Ask to Go Live works only while both PCs are connected.".format(peer["name"])
        st = self.peers.get(peer_ip, {})
        name = next((s["name"] for s in st.get("scenes", []) if s["id"] == scene_id), "")
        if not name:
            return False, "Choose one of their scenes."
        rid = secrets.token_urlsafe(9)
        try:
            reply = self._send(peer, "ask", {"id": rid, "scene": scene_id})
        except (OSError, http.client.HTTPException) as e:
            with self.lock:
                self.peers.setdefault(peer_ip, {})["error"] = str(e)[:120]
            return False, "{} did not answer. The request was not sent.".format(peer["name"])
        rb = reply.get("body") if isinstance(reply.get("body"), dict) else {}
        if not rb.get("ok"):
            return False, str(rb.get("error") or "Refused.")[:200]
        with self.lock:
            self.outgoing.append({"id": rid, "peer": peer_ip, "peerName": peer["name"], "scene": scene_id,
                                  "sceneName": name, "at": time.time(), "status": "sent"})
            self.outgoing[:] = self.outgoing[-20:]
        return True, ""

    def answer(self, rid, approved):
        with self.lock:
            req = next((r for r in self.incoming if r["id"] == rid), None)
            if not req or req["status"] != "pending":
                return False, "That request is no longer waiting.", None
            if not self.online(req["from"]):
                req["status"] = "expired"
                return False, "{} is no longer connected, so the request has lapsed.".format(req["fromName"]), None
            req["status"] = "approved" if approved else "declined"
            peer = self._peer(req["from"])
        if peer:
            try:
                self._send(peer, "answer", {"id": rid, "approved": bool(approved)})
            except (OSError, http.client.HTTPException):
                pass                          # they went offline; nothing is queued
        return True, "", dict(req)

    def _expire(self):
        now = time.time()
        with self.lock:
            for r in self.incoming:
                if r["status"] == "pending" and (now - r["at"] > ASK_EXPIRES or not self.online(r["from"])):
                    r["status"] = "expired"
            for r in self.outgoing:
                if r["status"] == "sent" and (now - r["at"] > ASK_EXPIRES or not self.online(r["peer"])):
                    r["status"] = "expired"

    # ---------- status for the dashboard ----------
    def status(self):
        self._expire()
        with self.lock:
            cfg = self.cfg
            peers = []
            for p in cfg["peers"]:
                st = self.peers.get(p["address"], {})
                on = self.online(p["address"])
                peers.append({"name": p["name"], "address": p["address"], "port": p["port"] or cfg["port"],
                              "online": on, "lastSeen": st.get("seen", 0), "error": st.get("error", ""),
                              "scenes": st.get("scenes", []) if on else [], "live": st.get("live", "") if on else "",
                              "version": st.get("version", "")})
            actions = [dict(a) for a in self.doc["actions"].values() if not a["del"]]
            listening = self.server is not None
            return {
                "text": TEAM_TEXT,
                "enabled": cfg["enabled"], "name": cfg["name"], "address": cfg["address"], "port": cfg["port"],
                "hasKey": bool(cfg["key"]), "fingerprint": key_fingerprint(cfg["key"]),
                "listening": listening, "listenError": self.listen_error,
                "wireguard": wireguard_addresses(), "anyAddress": ALLOW_ANY_ADDRESS,
                "available": listening and any(p["online"] for p in peers),
                "peers": peers,
                "notes": dict(self.doc["notes"]),
                "actions": sorted(actions, key=lambda a: (a["done"], a.get("created", 0), a["id"])),
                "incoming": [dict(r) for r in self.incoming if r["status"] == "pending"],
                "outgoing": [dict(r) for r in self.outgoing if time.time() - r["at"] < 600],
            }

    def key(self):
        with self.lock:
            return self.cfg["key"]

    # ---------- listener + presence loop ----------
    def start(self):
        with self.lock:
            cfg = dict(self.cfg)
        if not cfg["enabled"] or not cfg["address"] or not cfg["key"]:
            return
        if not is_wireguard_address(cfg["address"]):
            self.listen_error = "WireGuard is not connected on {}.".format(cfg["address"])
            return
        team = self

        class TeamHandler(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _reply(self, code, body=b"", sig=""):
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                if sig:
                    self.send_header("X-KC-Sig", sig)
                self.end_headers()
                try:
                    self.wfile.write(body)
                except OSError:
                    pass

            def do_GET(self):
                self._reply(404)

            def do_POST(self):
                if self.path != PATH:
                    return self._reply(404)
                try:
                    n = int(self.headers.get("Content-Length", 0))
                except ValueError:
                    n = 0
                if n <= 0 or n > MAX_BODY:
                    return self._reply(400)
                raw = self.rfile.read(n)
                code, body, sig = team.handle(self.client_address[0], raw, self.headers.get("X-KC-Sig", ""))
                self._reply(code, body, sig)

        try:
            srv = ThreadingHTTPServer((cfg["address"], cfg["port"]), TeamHandler)
        except OSError as e:
            self.listen_error = "Can't listen on {}:{} ({}).".format(cfg["address"], cfg["port"], e.strerror or e)
            return
        srv.daemon_threads = True
        self.server, self.listen_error = srv, ""
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.stop_evt = threading.Event()
        self.thread = threading.Thread(target=self._loop, args=(self.stop_evt,), daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_evt.set()
        srv, self.server = self.server, None
        if srv:
            try:
                srv.shutdown()
                srv.server_close()
            except OSError:
                pass

    def restart(self):
        self.stop()
        with self.lock:
            self.peers.clear()
        self.start()

    def watch(self, every=15.0):
        """Follow the WireGuard tunnel: start listening when it comes up, stop when it goes down."""
        while True:
            time.sleep(every)
            with self.lock:
                enabled, addr = self.cfg["enabled"], self.cfg["address"]
            if not enabled:
                continue
            up = is_wireguard_address(addr)
            if up and self.server is None:
                self.start()
            elif not up and self.server is not None:
                self.stop()
                self.listen_error = "WireGuard is not connected on {}.".format(addr)
                with self.lock:
                    self.peers.clear()

    def _loop(self, stop):
        while not stop.is_set():
            with self.lock:
                peers = list(self.cfg["peers"])
            for p in peers:
                if stop.is_set():
                    break
                try:
                    msg = self._send(p, "sync", self._sync_body())
                    self._seen(p["address"], msg)
                except (OSError, http.client.HTTPException, socket.timeout) as e:
                    with self.lock:
                        st = self.peers.setdefault(p["address"], {})
                        st["error"] = str(e)[:120]
            self._expire()
            stop.wait(SYNC_EVERY)
