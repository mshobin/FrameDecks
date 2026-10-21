"""FrameDecks - the link to the FrameDecks cloud (SaaS Phase 2: accounts and sync).

The program's side of docs/architecture/cloud-api.md. It holds this computer's sign-in and talks to the cloud; the
Studio (app/js/cloud-sync.js) decides what to sync, because it has the document's own rules (normalize, entities).

- The refresh token is kept in Windows Credential Manager (on a Mac or Linux, in a file only this user can read).
  Access tokens live in memory only.
- Everything here is optional: signed out, or with no cloud address set, FrameDecks works exactly as before, and no
  request ever leaves the computer.
- server.py exposes it to this PC only, as api/cloud/* (never on the phone remote's list).
"""
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

CREDENTIAL_TARGET = "FrameDecks/cloud"
TIMEOUT = 15


class CloudError(Exception):
    """An answer from the cloud (or no answer), in words for people."""

    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message

    def as_dict(self):
        return {"error": {"code": self.code, "message": self.message}}


# ---------------------------------------------------------------- where the sign-in is kept

class FileSecret:
    """A secret in a file only this user can read (Mac, Linux, tests)."""

    def __init__(self, path):
        self.path = Path(path)

    def read(self):
        try:
            return self.path.read_text(encoding="utf-8").strip() or None
        except OSError:
            return None

    def write(self, value):
        tmp = self.path.with_suffix(".tmp")
        fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(value)
        os.replace(tmp, self.path)

    def delete(self):
        try:
            self.path.unlink()
        except OSError:
            pass


class WindowsSecret:
    """A secret in Windows Credential Manager (DPAPI-protected, per Windows user)."""

    def __init__(self, target=CREDENTIAL_TARGET):
        import ctypes
        from ctypes import wintypes
        self.ctypes, self.target = ctypes, target

        class CREDENTIAL(ctypes.Structure):
            _fields_ = [("Flags", wintypes.DWORD), ("Type", wintypes.DWORD), ("TargetName", wintypes.LPWSTR),
                        ("Comment", wintypes.LPWSTR), ("LastWritten", wintypes.FILETIME),
                        ("CredentialBlobSize", wintypes.DWORD), ("CredentialBlob", ctypes.POINTER(ctypes.c_char)),
                        ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD), ("Attributes", ctypes.c_void_p),
                        ("TargetAlias", wintypes.LPWSTR), ("UserName", wintypes.LPWSTR)]
        self.CREDENTIAL = CREDENTIAL
        adv = ctypes.windll.advapi32
        self.CredReadW, self.CredWriteW, self.CredDeleteW, self.CredFree = adv.CredReadW, adv.CredWriteW, adv.CredDeleteW, adv.CredFree
        self.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(ctypes.POINTER(CREDENTIAL))]
        self.CredWriteW.argtypes = [ctypes.POINTER(CREDENTIAL), wintypes.DWORD]
        self.CredDeleteW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD]

    def read(self):
        p = self.ctypes.POINTER(self.CREDENTIAL)()
        if not self.CredReadW(self.target, 1, 0, self.ctypes.byref(p)):        # 1 = CRED_TYPE_GENERIC
            return None
        try:
            c = p.contents
            return self.ctypes.string_at(c.CredentialBlob, c.CredentialBlobSize).decode("utf-8") or None
        finally:
            self.CredFree(p)

    def write(self, value):
        blob = value.encode("utf-8")
        buf = self.ctypes.create_string_buffer(blob, len(blob))
        c = self.CREDENTIAL(Type=1, TargetName=self.target, CredentialBlobSize=len(blob),
                            CredentialBlob=self.ctypes.cast(buf, self.ctypes.POINTER(self.ctypes.c_char)),
                            Persist=2, UserName="FrameDecks")                # 2 = CRED_PERSIST_LOCAL_MACHINE (this user)
        if not self.CredWriteW(self.ctypes.byref(c), 0):
            raise OSError("Windows did not keep the sign-in (Credential Manager)")

    def delete(self):
        self.CredDeleteW(self.target, 1, 0)


def default_secret(data_dir):
    if os.name == "nt":
        try:
            return WindowsSecret()
        except Exception:                      # Credential Manager unavailable: fall back to a private file
            pass
    return FileSecret(Path(data_dir) / "kc-cloud-token")


# ---------------------------------------------------------------- the link

class CloudLink:
    """This computer's account link. Thread-safe; every method answers quickly or raises CloudError."""

    def __init__(self, data_dir, app_version, platform=None, secret=None, opener=None, api=None):
        self.data = Path(data_dir)
        self.prefs_file = self.data / "kc-cloud.json"
        self.state_file = self.data / "kc-cloud-sync.json"
        self.app_version = app_version
        self.platform = platform or ("windows" if os.name == "nt" else "macos" if sys.platform == "darwin" else "linux")
        self.secret = secret or default_secret(self.data)
        self.open_url = opener or webbrowser.open
        self.lock = threading.RLock()
        self.access, self.access_exp = None, 0
        self.prefs = self._load(self.prefs_file, {})
        if api is not None:
            self.prefs["api"] = api
        self.session_poll = None                # {"token", "until"} while a browser sign-in is open
        self.last_error = ""

    # ---- small files
    @staticmethod
    def _load(path, default):
        try:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else default
        except (OSError, ValueError):
            return default

    def _save_prefs(self):
        tmp = self.prefs_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.prefs, indent=2), encoding="utf-8")
        os.replace(tmp, self.prefs_file)

    # ---- settings people can change
    def api(self):
        return (os.environ.get("FRAMEDECKS_API") or self.prefs.get("api") or "").rstrip("/")

    def settings(self):
        return {"api": self.api(), "syncMeeting": bool(self.prefs.get("syncMeeting", False)),          # D6: off by default
                "pauseLive": bool(self.prefs.get("pauseLive", False)), "computerName": self.computer_name()}

    def set_settings(self, changes):
        with self.lock:
            if "api" in changes and not os.environ.get("FRAMEDECKS_API"):
                api = str(changes["api"] or "").strip().rstrip("/")
                if api and not api.startswith("https://") and not api.startswith("http://127.0.0.1") and not api.startswith("http://localhost"):
                    raise CloudError(400, "api_not_https", "The cloud address must start with https://")
                self.prefs["api"] = api
            for k in ("syncMeeting", "pauseLive"):
                if k in changes:
                    self.prefs[k] = bool(changes[k])
            if "computerName" in changes:
                self.prefs["computerName"] = str(changes["computerName"] or "").strip()[:60]
            self._save_prefs()
        return self.settings()

    def computer_name(self):
        return self.prefs.get("computerName") or os.environ.get("COMPUTERNAME") or os.environ.get("HOSTNAME") or "This computer"

    def status(self):
        acct = self.prefs.get("account") or {}
        return {"configured": bool(self.api()), "signedIn": bool(acct) and bool(self.secret.read()),
                "user": acct.get("user"), "workspace": acct.get("workspace"), "runtime": acct.get("runtime"),
                "browserSignIn": bool(self.session_poll), "lastError": self.last_error, **self.settings()}

    # ---- HTTP
    def _http(self, method, path, body=None, token=None):
        if not self.api():
            raise CloudError(503, "not_configured", "The FrameDecks cloud address is not set yet.")
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(self.api() + "/v1" + path, data=data, method=method,
                                     headers={"Content-Type": "application/json", "Accept": "application/json",
                                              "User-Agent": f"FrameDecks/{self.app_version} ({self.platform})"})
        if token:
            req.add_header("Authorization", "Bearer " + token)
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            try:
                err = json.loads(e.read() or b"{}").get("error") or {}
            except ValueError:
                err = {}
            raise CloudError(e.code, err.get("code") or "http_" + str(e.code),
                             err.get("message") or f"The FrameDecks cloud answered {e.code}.") from None
        except (urllib.error.URLError, OSError, ValueError) as e:
            raise CloudError(0, "offline", "The FrameDecks cloud cannot be reached. Presenting is not affected.") from e

    def _client(self):
        acct = self.prefs.get("account") or {}
        c = {"type": "runtime", "name": self.computer_name(), "platform": self.platform, "appVersion": self.app_version}
        if (acct.get("runtime") or {}).get("id"):
            c["runtimeId"] = acct["runtime"]["id"]
        return c

    def _signed_in(self, session):
        """Keep a session from any sign-in: the refresh token in the credential store, the rest in kc-cloud.json."""
        with self.lock:
            self.secret.write(session["refresh"])
            self.access, self.access_exp = session["access"], session.get("accessExpiresAt", 0) / 1000.0
            self.prefs["account"] = {k: session.get(k) for k in ("user", "workspace", "runtime")}
            self._save_prefs()
            self.last_error = ""
        return self.status()

    def _token(self, force=False):
        with self.lock:
            if self.access and not force and time.time() < self.access_exp - 30:
                return self.access
            refresh = self.secret.read()
            if not refresh:
                raise CloudError(401, "signed_out", "Sign in to your FrameDecks account first.")
            try:
                _, s = self._http("POST", "/auth/refresh", {"refresh": refresh})
            except CloudError as e:
                if e.status == 401:                    # revoked, reused or expired: this computer is signed out
                    self._forget()
                raise
            self.secret.write(s["refresh"])
            self.access, self.access_exp = s["access"], s.get("accessExpiresAt", 0) / 1000.0
            return self.access

    def _forget(self):
        self.secret.delete()
        self.access, self.access_exp = None, 0
        self.prefs.pop("account", None)
        self._save_prefs()

    def call(self, method, path, body=None):
        """An authorised call: refreshes the access token once if it has expired."""
        try:
            return self._http(method, path, body, self._token())[1]
        except CloudError as e:
            if e.status != 401 or e.code in ("signed_out", "token_reused"):
                self.last_error = e.message
                raise
        return self._http(method, path, body, self._token(force=True))[1]

    # ---- signing in
    def providers(self):
        return self._http("GET", "/auth/providers")[1]

    def email_start(self, email):
        email = str(email or "").strip()
        if "@" not in email or len(email) > 254:
            raise CloudError(400, "email_invalid", "Enter your email address.")
        return self._http("POST", "/auth/email/start", {"email": email})[1]

    def email_verify(self, email, code):
        _, s = self._http("POST", "/auth/email/verify", {"email": str(email).strip(), "code": str(code).strip(), "client": self._client()})
        return self._signed_in(s)

    def browser_start(self):
        """Google / Microsoft / Apple: open the cloud's sign-in page in the browser, then wait for it (poll)."""
        _, s = self._http("POST", "/auth/session", {"client": self._client()})
        with self.lock:
            self.session_poll = {"token": s["pollToken"], "until": time.time() + 600}
        threading.Thread(target=self._poll, name="cloud-sign-in", daemon=True).start()
        self.open_url(s["url"])
        return {"url": s["url"]}

    def _poll(self):
        while True:
            with self.lock:
                p = self.session_poll
            if not p or time.time() > p["until"]:
                with self.lock:
                    self.session_poll = None
                return
            try:
                status, s = self._http("POST", "/auth/session/poll", {"pollToken": p["token"]})
                if status == 200 and s.get("refresh"):
                    with self.lock:
                        self.session_poll = None
                    self._signed_in(s)
                    return
            except CloudError as e:
                if e.status in (400, 404, 410):
                    with self.lock:
                        self.session_poll = None
                    self.last_error = e.message
                    return
            time.sleep(2)

    def cancel_browser(self):
        with self.lock:
            self.session_poll = None

    def logout(self):
        refresh = self.secret.read()
        if refresh and self.api():
            try:
                self._http("POST", "/auth/logout", {"refresh": refresh})
            except CloudError:
                pass                                  # signed out here anyway
        with self.lock:
            self._forget()
            try:
                self.state_file.unlink()              # the next account starts from this computer's Frames
            except OSError:
                pass
        return self.status()

    # ---- sync (the Studio decides what; this carries it)
    def sync_get(self, since, limit=500):
        return self.call("GET", f"/sync?since={int(since)}&limit={int(limit)}")

    def sync_post(self, changes):
        return self.call("POST", "/sync", {"changes": changes})

    def me(self):
        return self.call("GET", "/me")

    def sync_state(self):
        return self._load(self.state_file, {"seq": 0, "revs": {}, "snapshot": []})

    def save_sync_state(self, state):
        if not isinstance(state, dict):
            raise CloudError(400, "invalid", "Invalid sync state.")
        tmp = self.state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.state_file)
        return {"ok": True}
