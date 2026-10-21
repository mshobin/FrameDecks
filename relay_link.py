"""FrameDecks - the remote from anywhere: this PC's side of the cloud relay (SaaS Phase 3).

docs/architecture/relay-protocol.md and pairing-protocol.md. While signed in and "Control from anywhere" is on, one
outgoing WebSocket to the cloud's RuntimeRelay carries the phone's requests here. Since Phase 4 only paired devices are
served: each request arrives sealed with that device's key (the cloud cannot read it), is opened here, checked against
replay, and replayed on a listener on this PC that treats it as that device with the role this PC gave it
(server.py RelayHandler); the answer goes back sealed. Nothing here can block presenting: it runs on its own threads
and reconnects quietly.
"""
import base64
import hashlib
import json
import os
import socket
import ssl
import struct
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_MESSAGE = 1024 * 1024
TEXT_TYPES = ("application/json", "text/", "application/javascript", "image/svg+xml")


class WebSocketClosed(Exception):
    pass


class WebSocket:
    """A small RFC 6455 client: text frames out (masked), text and control frames in. Enough for the relay."""

    def __init__(self, url, timeout=20):
        u = urlparse(url)
        port = u.port or (443 if u.scheme == "wss" else 80)
        raw = socket.create_connection((u.hostname, port), timeout=timeout)
        self.sock = ssl.create_default_context().wrap_socket(raw, server_hostname=u.hostname) if u.scheme == "wss" else raw
        self.send_lock = threading.Lock()
        key = base64.b64encode(os.urandom(16)).decode()
        path = (u.path or "/") + ("?" + u.query if u.query else "")
        host = u.hostname + ("" if u.port is None else f":{u.port}")
        self.sock.sendall((f"GET {path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                           f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\nUser-Agent: FrameDecks\r\n\r\n").encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise WebSocketClosed("The relay closed the connection.")
            head += chunk
            if len(head) > 65536:
                raise WebSocketClosed("The relay's answer was too long.")
        head, self.buf = head.split(b"\r\n\r\n", 1)
        lines = head.decode("latin-1").split("\r\n")
        status = lines[0].split(" ")
        if len(status) < 2 or status[1] != "101":
            raise WebSocketClosed(f"The relay answered {' '.join(status[1:3])}.")
        headers = {k.strip().lower(): v.strip() for k, v in (ln.split(":", 1) for ln in lines[1:] if ":" in ln)}
        want = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        if headers.get("sec-websocket-accept") != want:
            raise WebSocketClosed("The relay's handshake did not match.")
        self.sock.settimeout(None)

    def _frame(self, opcode, payload):
        n = len(payload)
        head = bytes([0x80 | opcode])
        if n < 126:
            head += bytes([0x80 | n])
        elif n < 65536:
            head += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            head += bytes([0x80 | 127]) + struct.pack(">Q", n)
        mask = os.urandom(4)
        body = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        with self.send_lock:
            self.sock.sendall(head + mask + body)

    def send(self, text):
        self._frame(0x1, text.encode("utf-8"))

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise WebSocketClosed("The relay closed the connection.")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv(self):
        """The next text message. Answers pings; raises WebSocketClosed when the relay closes."""
        parts, total = [], 0
        while True:
            b0, b1 = self._read(2)
            fin, opcode, n = b0 & 0x80, b0 & 0x0F, b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            mask = self._read(4) if b1 & 0x80 else None
            payload = self._read(n)
            if mask:
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
            if opcode == 0x8:
                raise WebSocketClosed("The relay closed the connection.")
            if opcode == 0x9:
                self._frame(0xA, payload)
                continue
            if opcode == 0xA:
                continue
            total += n
            if total > MAX_MESSAGE:
                raise WebSocketClosed("A message from the relay was too large.")
            parts.append(payload)
            if fin:
                return b"".join(parts).decode("utf-8")

    def close(self):
        try:
            self._frame(0x8, struct.pack(">H", 1000))
        except OSError:
            pass
        try:
            self.sock.close()
        except OSError:
            pass


class RelayLink:
    """Keeps this PC reachable through the relay while signed in and switched on. Thread-safe status for Settings."""

    def __init__(self, cloud, local_port, enabled):
        self.cloud, self.local_port, self.enabled = cloud, local_port, enabled   # local_port(), enabled(): callables
        self.state, self.error, self.since = "off", "", 0
        self.ws = None
        self.wake = threading.Event()
        self.seen = {}                                  # (device, connection) -> the last request number accepted
        self.seen_lock = threading.Lock()
        threading.Thread(target=self._run, name="relay", daemon=True).start()

    def status(self):
        return {"state": self.state, "error": self.error, "since": self.since}

    def poke(self):
        """Settings changed (switched on or off, signed in or out): act now."""
        ws = self.ws
        if ws and not self._wanted():
            ws.close()
        self.wake.set()

    def _wanted(self):
        try:
            return bool(self.enabled() and self.cloud.status().get("signedIn"))
        except Exception:
            return False

    def _run(self):
        backoff = 1
        while True:
            if not self._wanted():
                self.state, self.error = "off", ""
                self.wake.wait(30)
                self.wake.clear()
                continue
            self.state = "connecting"
            try:
                self._session()
                backoff = 1
            except Exception as e:                      # offline, revoked, relay restarted: try again, never raise
                self.error = getattr(e, "message", None) or str(e) or type(e).__name__
            self.ws = None
            if self._wanted():
                self.state = "waiting"
                self.wake.wait(backoff)
                self.wake.clear()
                backoff = min(60, backoff * 2)

    def _session(self):
        acct = self.cloud.status()
        rid = (acct.get("runtime") or {}).get("id")
        if not rid:
            raise RuntimeError("This computer is not registered with the account yet.")
        ticket = self.cloud.call("POST", f"/relay/{rid}/ticket", {})["ticket"]
        url = self.cloud.api().replace("https://", "wss://", 1).replace("http://", "ws://", 1) + f"/v1/relay/{rid}?ticket={ticket}"
        ws = self.ws = WebSocket(url)
        self.state, self.error, self.since = "online", "", time.time()
        pinger = threading.Thread(target=self._ping, args=(ws,), daemon=True)
        pinger.start()
        try:
            while True:
                try:
                    msg = json.loads(ws.recv())
                except ValueError:
                    continue
                if msg.get("t") == "req":
                    self._dispatch(ws, msg)
        finally:
            ws.close()

    def _ping(self, ws):
        while self.ws is ws:
            time.sleep(25)
            try:
                ws.send('{"t":"ping"}')
            except OSError:
                return

    def _send(self, ws, obj):
        out = json.dumps(obj)
        if len(out) > MAX_MESSAGE:
            out = json.dumps({"t": "res", "id": obj.get("id"), "to": obj.get("to"), "status": 413,
                              "headers": {"Content-Type": "application/json"}, "body": '{"error":"too large"}'})
        try:
            ws.send(out)
        except OSError:
            pass

    def _refuse(self, ws, msg, status, error):
        self._send(ws, {"t": "res", "id": msg.get("id"), "to": msg.get("from"), "status": status,
                        "headers": {"Content-Type": "application/json"}, "body": json.dumps({"error": error})})

    def _dispatch(self, ws, msg):
        """Open a sealed request from a paired device (in order, on the reading thread), then serve it on its own thread."""
        dev = msg.get("dev")
        if not msg.get("seal"):
            return self._refuse(ws, msg, 403, "pair_first")         # since Phase 4: pair the phone first
        record = self.cloud.device(dev) if dev else None
        if not record:
            return self._refuse(ws, msg, 403, "not_paired")         # revoked here, or never paired with this PC
        import pairing_crypto
        key = pairing_crypto.unb64u(record["key"])
        try:
            inner = pairing_crypto.open_sealed(key, "req", dev, msg["seal"])
            n = int(inner.get("n"))
        except (ValueError, TypeError, KeyError):
            return self._refuse(ws, msg, 400, "bad_seal")
        slot = (dev, msg.get("from"))
        with self.seen_lock:
            if n <= self.seen.get(slot, 0):
                return self._refuse(ws, msg, 409, "replay")         # a repeated or reordered message
            self.seen[slot] = n
        inner.update(id=msg.get("id"), **{"from": msg.get("from")})
        threading.Thread(target=self._serve, args=(ws, inner, (dev, record, key, n)), daemon=True).start()

    def _serve(self, ws, msg, device):
        """Replay one request on the relay listener, as the device with this PC's role for it, and seal the answer."""
        dev, record, key, n = device
        res = {"t": "res", "id": msg.get("id"), "to": msg.get("from")}
        try:
            path = str(msg.get("path") or "")
            if path.startswith("/") or "://" in path or ".." in path:
                raise ValueError("bad path")
            body = msg.get("body")
            if body is not None:
                body = base64.b64decode(body) if msg.get("enc") == "b64" else str(body).encode("utf-8")
            req = urllib.request.Request(f"http://127.0.0.1:{self.local_port()}/{path}", data=body,
                                         method=str(msg.get("method") or "GET").upper())
            for k, v in (msg.get("headers") or {}).items():
                if k.lower() in ("content-type", "cookie", "accept"):
                    req.add_header(k, str(v))
            req.add_header("X-FD-Relay-From", str(dev)[:64])
            req.add_header("X-FD-Device-Role", record.get("role") or "operator")
            try:
                with urllib.request.urlopen(req, timeout=40) as r:
                    status, headers, data = r.status, r.headers, r.read()
            except urllib.error.HTTPError as e:
                status, headers, data = e.code, e.headers, e.read()
            res["status"] = status
            res["headers"] = {k: v for k, v in (("Content-Type", headers.get("Content-Type")), ("Set-Cookie", headers.get("Set-Cookie"))) if v}
            ctype = headers.get("Content-Type") or ""
            if any(ctype.startswith(t) for t in TEXT_TYPES):
                res["body"] = data.decode("utf-8", "replace")
            else:
                res["body"], res["enc"] = base64.b64encode(data).decode(), "b64"
        except Exception:
            res.update(status=502, headers={"Content-Type": "application/json"}, body='{"error":"relay"}')
        import pairing_crypto
        inner = {k: res[k] for k in ("status", "headers", "body", "enc") if k in res}
        inner["n"] = n
        self._send(ws, {"t": "res", "id": res["id"], "to": res["to"], "seal": pairing_crypto.seal(key, "res", dev, inner)})
