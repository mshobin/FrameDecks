"""FrameDecks - live push, the "doorbell" (design: docs/architecture/live-push.md).

Instead of asking the workspace every few seconds, a linked PC listens on its workspace's bell: a public Supabase
Realtime channel whose name is a long random secret that only linked PCs learn (computer_hello). A ring carries no
data, only what changed ("cmd", "sync", "watch") and which PC it is for; the PC then calls the same functions as
always, with its key. The PC connects only while it is needed (a Live page watches it, a phone used it, it is
presenting, or someone used FrameDecks in the last 10 minutes) and otherwise rests: it checks in once a minute.

Whenever the bell cannot be used (the database does not have 0016 yet, push is switched off, a firewall or proxy
blocks the connection, a quota is reached), everything runs exactly as before 9.11: the same checks at the same pace.

    WebSocket   a small client for ws:// and wss:// (standard library only, through the system proxy if there is one)
    Bell        one Realtime channel: join, heartbeat, rings, reconnect
    Doorbell    decides when to listen, checks in, and tells sync and the remote what to do and how often
"""
import base64
import hashlib
import json
import os
import socket
import ssl
import threading
import time
import urllib.parse
import urllib.request

import cloud_sync

USER_AGENT = cloud_sync.USER_AGENT
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_MESSAGE = 1 << 20

HEARTBEAT_EVERY = 25.0       # Realtime closes a socket that has not said anything for about a minute
HELLO_ASLEEP = 60.0          # resting: check in once a minute (a Live page opened, the plan changed?)
HELLO_AWAKE = 300.0          # listening: the bell says it all; check in now and then in case a ring was missed
HELLO_MISSING = 1800.0       # the database has no live push (0016 not run): ask again in half an hour
AWAKE_FOR = 600.0            # stay connected this long after the last reason to
WATCH_FOR = 120.0            # a Live page renews this every minute while it is open
PRESENTING_CHECK = 30.0
SYNC_PUSHING = 600.0         # sync's safety pull while listening (every ring makes it pull at once)
SYNC_RESTING = 1800.0        # while resting, the check-in's counter makes it pull when something changed
REMOTE_WATCHED = 30.0        # remote: the status heartbeat while a Live page watches (it shows Online under 45 s)
REMOTE_LISTENING = 300.0     # remote: safety take while listening and nobody watches
REMOTE_RESTING = 60.0


class Closed(Exception):
    pass


# ---------- WebSocket ----------

def _proxy_for(host, secure):
    """The system's proxy for this host (Windows: the Internet Options setting), or None."""
    try:
        if urllib.request.proxy_bypass(host):
            return None
        proxy = urllib.request.getproxies().get("https" if secure else "http")
    except Exception:
        return None
    if not proxy:
        return None
    p = urllib.parse.urlsplit(proxy if "://" in proxy else "http://" + proxy)
    return (p.hostname, p.port or 8080) if p.hostname and p.scheme in ("http", "") else None


def _open(host, port, timeout, secure):
    proxy = _proxy_for(host, secure)
    if not proxy:
        return socket.create_connection((host, port), timeout=timeout)
    sock = socket.create_connection(proxy, timeout=timeout)
    sock.sendall(f"CONNECT {host}:{port} HTTP/1.1\r\nHost: {host}:{port}\r\nUser-Agent: {USER_AGENT}\r\n\r\n".encode())
    head = b""
    while b"\r\n\r\n" not in head:
        chunk = sock.recv(4096)
        if not chunk or len(head) > 16384:
            sock.close()
            raise Closed("the proxy did not answer")
        head += chunk
    if head.split(b" ", 2)[1:2] != [b"200"]:
        sock.close()
        raise Closed("the proxy refused the connection")
    return sock


class WebSocket:
    """A text-only WebSocket client (RFC 6455): enough for Realtime's JSON messages."""

    def __init__(self, url, timeout=15.0):
        u = urllib.parse.urlsplit(url)
        if u.scheme not in ("ws", "wss") or not u.hostname:
            raise ValueError("not a ws:// or wss:// address")
        secure = u.scheme == "wss"
        host, port = u.hostname, u.port or (443 if secure else 80)
        sock = _open(host, port, timeout, secure)
        if secure:
            sock = ssl.create_default_context().wrap_socket(sock, server_hostname=host)
        sock.settimeout(timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        path = (u.path or "/") + ("?" + u.query if u.query else "")
        sock.sendall((f"GET {path} HTTP/1.1\r\nHost: {u.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                      f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\nUser-Agent: {USER_AGENT}\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = sock.recv(4096)
            if not chunk or len(buf) > 16384:
                sock.close()
                raise Closed("no WebSocket answer")
            buf += chunk
        head, self.buf = buf.split(b"\r\n\r\n", 1)
        lines = head.decode("latin-1").split("\r\n")
        headers = {k.strip().lower(): v.strip() for k, _, v in (line.partition(":") for line in lines[1:])}
        expect = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        if lines[0].split(" ")[1:2] != ["101"] or headers.get("sec-websocket-accept") != expect:
            sock.close()
            raise Closed("the server did not accept the WebSocket: " + lines[0][:80])
        self.sock = sock
        self.parts = []
        self.lock = threading.Lock()

    def _send(self, opcode, data):
        mask = os.urandom(4)
        n = len(data)
        head = bytes([0x80 | opcode])
        if n < 126:
            head += bytes([0x80 | n])
        elif n < 65536:
            head += bytes([0x80 | 126]) + n.to_bytes(2, "big")
        else:
            head += bytes([0x80 | 127]) + n.to_bytes(8, "big")
        body = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        with self.lock:
            self.sock.sendall(head + mask + body)

    def send_text(self, text):
        self._send(0x1, text.encode("utf-8"))

    def _frame(self):
        """One whole frame from the buffer, or None if it has not all arrived yet."""
        b = self.buf
        if len(b) < 2:
            return None
        fin, op, masked, n, at = b[0] & 0x80, b[0] & 0x0F, b[1] & 0x80, b[1] & 0x7F, 2
        if n == 126:
            if len(b) < 4:
                return None
            n, at = int.from_bytes(b[2:4], "big"), 4
        elif n == 127:
            if len(b) < 10:
                return None
            n, at = int.from_bytes(b[2:10], "big"), 10
        if n > MAX_MESSAGE:
            raise Closed("message too large")
        mask = b""
        if masked:
            if len(b) < at + 4:
                return None
            mask, at = b[at:at + 4], at + 4
        if len(b) < at + n:
            return None
        data = b[at:at + n]
        if mask:
            data = bytes(x ^ mask[i % 4] for i, x in enumerate(data))
        self.buf = b[at + n:]
        return bool(fin), op, data

    def recv(self, timeout):
        """The next text message, or None when nothing arrived within `timeout` seconds. Raises Closed."""
        deadline = time.monotonic() + timeout
        while True:
            frame = self._frame()
            if frame:
                fin, op, data = frame
                if op == 0x9:                                  # ping: pong with the same data
                    self._send(0xA, data)
                elif op == 0x8:
                    raise Closed("the server closed the connection")
                elif op in (0x0, 0x1, 0x2):
                    self.parts.append(data)
                    if sum(len(p) for p in self.parts) > MAX_MESSAGE:
                        raise Closed("message too large")
                    if fin:
                        text, self.parts = b"".join(self.parts), []
                        return text.decode("utf-8", "replace")
                continue
            left = deadline - time.monotonic()
            if left <= 0:
                return None
            self.sock.settimeout(left)
            try:
                chunk = self.sock.recv(65536)
            except (socket.timeout, TimeoutError):
                return None
            except OSError as e:
                raise Closed(str(e))
            if not chunk:
                raise Closed("the connection ended")
            self.buf += chunk

    def close(self):
        try:
            self._send(0x8, b"")
        except OSError:
            pass
        try:
            self.sock.close()
        except OSError:
            pass


# ---------- One Realtime channel ----------

def realtime_url(cloud_url, anon_key):
    base = cloud_url.rstrip("/")
    base = "wss://" + base[len("https://"):] if base.startswith("https://") else "ws://" + base[len("http://"):]
    return f"{base}/realtime/v1/websocket?apikey={urllib.parse.quote(anon_key, safe='')}&vsn=1.0.0"


class Bell:
    """Listens on one public Realtime channel and calls on_ring(event, payload) for each ring. Reconnects by itself
    (5 seconds, doubling to 5 minutes); `connected` is True only while the channel is joined."""

    def __init__(self, url, topic, on_ring, connect=WebSocket, heartbeat=HEARTBEAT_EVERY):
        self.url, self.topic, self.on_ring, self.connect, self.heartbeat = url, topic, on_ring, connect, heartbeat
        self.connected = False
        self.failures = 0
        self.error = None
        self.stopping = threading.Event()
        self.thread = None
        self.ws = None

    def start(self):
        self.thread = threading.Thread(target=self._run, name="FrameDecks live push", daemon=True)
        self.thread.start()
        return self

    def stop(self):
        self.stopping.set()
        ws = self.ws
        if ws:
            ws.close()

    def _run(self):
        backoff = 5.0
        while not self.stopping.is_set():
            try:
                self._session()
            except Exception as e:                    # never let this stop the program
                self.error = str(e)[:200]
            was = self.connected
            self.connected = False
            if self.stopping.is_set():
                break
            self.failures = 0 if was else self.failures + 1
            backoff = 5.0 if was else min(300.0, backoff * 2 if self.failures > 1 else backoff)
            self.stopping.wait(backoff)

    def _session(self):
        ws = self.ws = self.connect(self.url)
        try:
            channel = "realtime:" + self.topic
            ref = 1
            ws.send_text(json.dumps({"topic": channel, "event": "phx_join", "ref": "1", "join_ref": "1", "payload": {
                "config": {"broadcast": {"ack": False, "self": False}, "presence": {"key": ""}, "private": False}}}))
            beat = time.monotonic() + self.heartbeat
            while not self.stopping.is_set():
                text = ws.recv(timeout=max(0.1, min(1.0, beat - time.monotonic())))
                if time.monotonic() >= beat:
                    ref += 1
                    ws.send_text(json.dumps({"topic": "phoenix", "event": "heartbeat", "payload": {}, "ref": str(ref)}))
                    beat = time.monotonic() + self.heartbeat
                if text is None:
                    continue
                try:
                    msg = json.loads(text)
                except ValueError:
                    continue
                if not isinstance(msg, dict) or msg.get("topic") != channel:
                    continue
                event, payload = msg.get("event"), msg.get("payload") if isinstance(msg.get("payload"), dict) else {}
                if event == "phx_reply" and msg.get("ref") == "1":
                    if payload.get("status") != "ok":
                        raise Closed("the channel refused to join: " + json.dumps(payload.get("response"))[:120])
                    self.connected, self.error = True, None
                    self.on_ring("joined", {})
                elif event in ("phx_error", "phx_close"):
                    raise Closed("the channel closed")
                elif event == "broadcast":
                    data = payload.get("payload") if isinstance(payload.get("payload"), dict) else {}
                    self.on_ring(str(payload.get("event") or ""), data)
        finally:
            ws.close()
            self.ws = None


# ---------- When to listen ----------

class Doorbell:
    """credentials() -> (cloud config, organization id, computer key) or None, as for cloud_remote. computer_id() and
    cursor() come from the sync state; control() is the "Allow control from the companion" switch. on_sync, on_cmd
    and on_watch are called (from other threads) when the workspace changed, a command waits, or a Live page opened."""

    def __init__(self, credentials, computer_id, cursor, control, read_plan, on_sync, on_cmd, on_watch,
                 make_api=None, make_bell=None, clock=time.monotonic, on_screen=None):
        self.credentials, self.computer_id, self.cursor, self.control = credentials, computer_id, cursor, control
        self.read_plan, self.on_sync, self.on_cmd, self.on_watch = read_plan, on_sync, on_cmd, on_watch
        self.make_api = make_api or (lambda cfg, org, key: cloud_sync.CloudApi(cfg["url"], cfg["anonKey"], org, key))
        self.make_bell = make_bell or (lambda url, topic, on_ring: Bell(url, topic, on_ring).start())
        self.clock = clock
        self.on_screen = on_screen or cloud_sync.on_screen
        self.push = None             # None: not asked yet; False: no live push (yet); True: the workspace has a bell
        self.missing = False         # the database has no computer_hello (0016 not run)
        self.bell_name = None
        self.bell = None
        self.bell_key = None
        self.next_hello = 0.0
        self.awake_until = clock() + AWAKE_FOR       # FrameDecks was just opened: someone is probably using it
        self.watched_until = 0.0
        self.next_screen_check = 0.0
        self.lock = threading.Lock()
        self.wake = threading.Event()
        self.stopping = False
        self.thread = None

    # -- what the services ask --
    def connected(self):
        bell = self.bell
        return bool(bell and bell.connected)

    def mode(self):
        """"push": listening; "asleep": resting on purpose (check-ins only); "poll": as before 9.11."""
        if self.connected():
            return "push"
        if self.push and not self._wanted():
            return "asleep"
        return "poll"

    def watched(self):
        return self.clock() < self.watched_until

    def sync_every(self):
        m = self.mode()
        return SYNC_PUSHING if m == "push" else SYNC_RESTING if m == "asleep" else cloud_sync.PULL_EVERY

    def remote_plan(self, phone_active):
        """For cloud_remote: take commands this round?, the pause after it, publish the status?, its heartbeat.
        None means "as before 9.11"."""
        m = self.mode()
        if m == "poll":
            return None
        if m == "asleep":
            return {"take": False, "pause": REMOTE_RESTING, "publish": False, "heartbeat": REMOTE_WATCHED}
        seen = self.watched() or phone_active
        return {"take": True, "pause": REMOTE_WATCHED if seen else REMOTE_LISTENING, "publish": seen,
                "heartbeat": REMOTE_WATCHED}

    def info(self):
        m = self.mode() if self.credentials() else "off"
        words = {"push": "Live connection on", "asleep": "Resting (checks in every minute)",
                 "poll": "Regular checks" if self.push is not True else "Connecting… (regular checks meanwhile)",
                 "off": ""}
        return {"mode": m, "text": words[m], "error": self.bell.error if self.bell and not self.connected() else None}

    # -- what the program tells it --
    def activity(self):
        """Something happened on this PC (a save, a press, going live): stay connected for a while."""
        self.awake_until = self.clock() + AWAKE_FOR
        if self.push and not self.bell:
            self.wake.set()

    def ring(self, event, payload):
        """From the bell's thread."""
        me = self.computer_id()
        if event == "joined":
            self.on_sync()                            # catch up on anything rung while not listening
            self.on_cmd()
        elif event == "sync":
            self.on_sync()
        elif event == "cmd" and payload.get("pc") == me:
            self.awake_until = self.clock() + AWAKE_FOR
            self.on_cmd()
        elif event == "watch" and payload.get("pc") == me:
            self.watched_until = self.clock() + WATCH_FOR
            self.awake_until = self.clock() + AWAKE_FOR
            self.on_watch()

    def recheck(self):
        """A setting changed (Allow control from the companion): check in now."""
        self.next_hello = 0.0
        self.awake_until = max(self.awake_until, self.clock() + AWAKE_FOR)
        self.wake.set()

    # -- the loop --
    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self.stopping = False
        self.thread = threading.Thread(target=self._loop, name="FrameDecks doorbell", daemon=True)
        self.thread.start()

    def stop(self):
        self.stopping = True
        self.wake.set()
        self._stop_bell()

    def _loop(self):
        while not self.stopping:
            try:
                self.tick()
            except Exception:                         # never let this stop the program
                pass
            self.wake.wait(timeout=1.0)
            self.wake.clear()

    def _wanted(self):
        now = self.clock()
        return bool(self.push) and (now < self.watched_until or now < self.awake_until)

    def tick(self):
        creds = self.credentials()
        if not creds:
            self._stop_bell()
            self.push, self.next_hello = None, 0.0
            return
        now = self.clock()
        if now >= self.next_screen_check:
            self.next_screen_check = now + PRESENTING_CHECK
            try:
                if self.on_screen(self.read_plan()):
                    self.awake_until = max(self.awake_until, now + AWAKE_FOR)
            except Exception:
                pass
        if now >= self.next_hello:
            self.hello(creds)
        if self._wanted():
            url = cloud_sync_url(creds)
            key = (url, self.bell_name)
            if self.bell is None or self.bell_key != key:
                self._stop_bell()
                self.bell_key = key
                self.bell = self.make_bell(realtime_url(*url), "bell:" + self.bell_name, self.ring)
        else:
            self._stop_bell()

    def hello(self, creds):
        was_asleep = self.mode() == "asleep"
        now = self.clock()
        try:
            got = self.make_api(*creds)._rpc("computer_hello", {"control": bool(self.control())}) or {}
        except cloud_sync.Refused as e:
            if e.code in ("PGRST202", "42883"):
                self.missing, self.push, self.bell_name = True, False, None
                self.next_hello = now + HELLO_MISSING
            else:                                     # unlinked or refused: the sync and remote loops say so
                self.push, self.next_hello = False, now + HELLO_MISSING
            return
        except cloud_sync.Offline:
            self.next_hello = now + HELLO_ASLEEP
            return
        self.missing = False
        bell = got.get("bell") if isinstance(got.get("bell"), str) else None
        self.push = bool(got.get("push")) and bool(bell) and len(bell) == 64
        self.bell_name = bell if self.push else None
        if got.get("watched"):
            self.watched_until = max(self.watched_until, now + WATCH_FOR)
            self.awake_until = max(self.awake_until, now + AWAKE_FOR)
            if was_asleep:
                self.on_watch()
        try:
            if int(got.get("seq") or 0) > int(self.cursor() or 0):
                self.on_sync()                        # the workspace changed while this PC was not listening
        except (TypeError, ValueError):
            pass
        if not self.push:                             # switched off: as before 9.11, plus a check-in now and then
            self.next_hello = now + HELLO_MISSING
        else:
            self.next_hello = now + (HELLO_AWAKE if self._wanted() else HELLO_ASLEEP)

    def _stop_bell(self):
        bell, self.bell, self.bell_key = self.bell, None, None
        if bell:
            bell.stop()


def cloud_sync_url(creds):
    """(cloud address, publishable key) from the credentials the services use."""
    cfg = creds[0]
    return cfg["url"], cfg["anonKey"]
