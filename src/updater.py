"""FrameDecks - updates from FrameDecks servers (7.0; docs/deployment/release-pipeline.md).

Once a day the program asks https://api.framedecks.com/releases/latest for the release manifest (written by
tools/make_release_manifest.py when a version is published to Cloudflare R2). Settings > About then shows the new
version and its notes. **Update now**:

1. download the installer, from https://downloads.framedecks.com/ only, into <data>/updates/;
2. check its size and SHA-256 against the manifest (and its Authenticode signature when the manifest says the release
   is signed); anything that does not match is deleted and nothing is installed;
3. start the installer itself, silently (/VERYSILENT, without the camera task, which needs no change on an update,
   and /UPDATE=1), and close FrameDecks. The installer (packaging/installer.iss) gives FrameDecks a few seconds to
   close, ends a copy that is still running, installs, and starts the new version (only for /UPDATE=1). If it cannot
   finish it undoes its own changes, so the version that was running stays;
4. at the next start the program compares its own version with the one it was updating to and says what happened.

7.1.1: no PowerShell anywhere (Microsoft Defender quarantined 7.1 for an unsigned program starting hidden PowerShell
scripts): the installer is started directly and signatures are checked with WinVerifyTrust (winapi.py).

"Reinstall the previous version" goes through the same steps with the manifest's `previous` build. Updates never
start while something is on screen (the page asks first; the server checks again). Standard library only.

9.2 (production audit H3): a manifest counts only when it is signed by a key in TRUSTED_KEYS (manifest_sig.py), once
that list has a key; so the download bucket alone can no longer choose the installer, its checksum or whether the
Authenticode check runs. The installed app ignores FRAMEDECKS_UPDATE_API, downloads never follow a redirect to another
server, "latest" never installs an older version, and the signer must be exactly one of PUBLISHERS.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlparse
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener

import manifest_sig

API_DEFAULT = "https://api.framedecks.com/releases/latest"
API = os.environ.get("FRAMEDECKS_UPDATE_API", API_DEFAULT)     # for testing a release; the installed app ignores it
DOWNLOAD_PREFIX = "https://downloads.framedecks.com/"
VERSION_RE = re.compile(r"^\d+(\.\d+){1,3}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")
MAX_INSTALLER = 600 * 1024 * 1024          # a FrameDecks installer is about 150 MB; anything this big is wrong
KEEP_INSTALLED = 2                          # installers kept for putting a version back
PUBLISHER = "Shobin Mathews"                # the code-signing certificate's name (packaging/installer.iss AppPublisher)
# 26.11.64 (release review B7): the names an installer's Authenticode signer may have. SignPath Foundation's free
# certificates for open-source projects are issued to "SignPath Foundation", not to the author, so that name is
# accepted too; check it against the first certificate SignPath issues and keep this list exact (no "contains").
# Which file is installed is still decided by the Ed25519-signed manifest (its SHA-256 is checked first), so the
# Authenticode check is a second lock, not the only one.
PUBLISHERS = (PUBLISHER, "SignPath Foundation")
# 9.2 Public keys whose signature a release manifest must carry ({key id: 32-byte public key in hex}), made with
# tools/manifest_key.py; the private key is the MANIFEST_SIGNING_KEY secret of the release workflow. Empty: manifests
# are read as before 9.2 (the workflow refuses to publish an unsigned manifest once a key is here).
# 26.11.59: the owner's key, made on the owner's PC on 16 November 2026 (it replaces the 26.11.58 key, whose private half
# was not kept); the private key is only in the MANIFEST_SIGNING_KEY secret and the owner's offline backup.
TRUSTED_KEYS = {
    "51d7b2656dd549ce": "25b1def99e6360fcf6c0f521522e293bb87510fdf11fc38b069d2bbb1a5cb746",
}
ALLOWED_HOSTS = ("https://downloads.framedecks.com/", "https://api.framedecks.com/")


class _NoOffsiteRedirect(HTTPRedirectHandler):
    """9.2 Follows a redirect only to FrameDecks' own servers, over https."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not str(newurl).startswith(ALLOWED_HOSTS):
            raise HTTPError(newurl, code, "Redirect away from FrameDecks refused", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_safe_opener = build_opener(_NoOffsiteRedirect)


def safe_open(req, timeout=None):
    return _safe_opener.open(req, timeout=timeout)


def version_tuple(v):
    """26.11 versions are YY.MM (26.11, then 26.11.1 for another release that month): numbers, padded to four parts so
    26.11 equals 26.11.0, 26.01 is January, and every YY.MM is newer than the 9.x versions before it."""
    t = [int(x) for x in re.findall(r"\d+", str(v or ""))[:4]]
    return tuple(t + [0] * (4 - len(t)))


def _build(d):
    """One platform build from the manifest, or None if it is not trustworthy."""
    if not isinstance(d, dict):
        return None
    url, sha = str(d.get("url") or ""), str(d.get("sha256") or "").lower()
    try:
        size = int(d.get("size") or 0)
    except (TypeError, ValueError):
        return None
    if not url.startswith(DOWNLOAD_PREFIX) or urlparse(url).scheme != "https" or not HEX64.match(sha):
        return None
    if not 0 < size <= MAX_INSTALLER:
        return None
    return {"url": url, "sha256": sha, "size": size, "file": os.path.basename(urlparse(url).path)}


def parse_manifest(data, trusted=None):
    """The release manifest, checked: a version, a Windows build from downloads.framedecks.com with its SHA-256 and
    size, the notes, and (if any) the previous build. With trusted keys ({id: public key hex}), only a manifest one
    of them signed. Returns None for anything else."""
    if not isinstance(data, dict):
        return None
    if trusted and not manifest_sig.verify(data, trusted):
        return None
    version = str(data.get("version") or "")
    if not VERSION_RE.match(version):
        return None
    plat = data.get("platforms") if isinstance(data.get("platforms"), dict) else {}
    win = _build(plat.get("windows")) or _build({"url": data.get("downloadUrl"), "sha256": data.get("sha256"), "size": data.get("size")})
    if not win:
        return None
    prev = data.get("previous") if isinstance(data.get("previous"), dict) else None
    previous = None
    if prev and VERSION_RE.match(str(prev.get("version") or "")):
        build = _build(prev)
        if build:
            previous = dict(build, version=str(prev["version"]))
    return {"version": version, "released": str(data.get("released") or "")[:10], "notes": str(data.get("releaseNotes") or "")[:20000],
            "windows": win, "signed": data.get("signed") is True, "previous": previous}


class Updater:
    """The update state for Settings > About, and the steps above. One per program."""

    def __init__(self, data_dir, current_version, frozen=False, opener=safe_open, platform=None, popen=subprocess.Popen,
                 trusted=None):
        self.dir = Path(data_dir) / "updates"
        self.current = current_version
        self.frozen = frozen
        self.trusted = TRUSTED_KEYS if trusted is None else trusted
        self.open = opener
        self.popen = popen
        self.windows = (platform or sys.platform) == "win32"
        self.lock = threading.Lock()
        self.state = {"current": current_version, "latest": None, "newer": False, "notes": "", "released": "",
                      "phase": "idle", "progress": 0, "error": None, "checkedAt": 0, "installOnExit": False,
                      "previous": None, "result": None}
        self.manifest = None
        self.ready = None                       # path of a checked installer for self.manifest
        self.state["result"] = self.read_result()

    @property
    def api(self):
        """9.2 The installed app always asks FrameDecks; FRAMEDECKS_UPDATE_API (API) is for testing from source."""
        return API_DEFAULT if self.frozen else API

    # ---------- asking ----------
    def check(self, timeout=10):
        """Ask the update service once. Never raises; a failure leaves the last answer in place."""
        try:
            req = Request(self.api, headers={"Accept": "application/json",
                                        "User-Agent": f"FrameDecks/{self.current} ({'Windows' if self.windows else sys.platform})"})
            with self.open(req, timeout=timeout) as r:
                raw = json.loads(r.read(256 * 1024).decode("utf-8"))
            found = parse_manifest(raw, self.trusted)
            if found is None and self.trusted and parse_manifest(raw) is not None:
                self.state["checkError"] = "BadSignature"        # a manifest FrameDecks did not sign: ignored
            if found:
                with self.lock:
                    self.manifest = found
                    self.state.update(latest=found["version"], notes=found["notes"], released=found["released"],
                                      newer=version_tuple(found["version"]) > version_tuple(self.current),
                                      previous=(found["previous"] or {}).get("version"))
        except Exception as e:                  # offline, the service not set up yet: say nothing
            self.state["checkError"] = type(e).__name__
        self.state["checkedAt"] = time.time()
        return self.info()

    def info(self):
        with self.lock:
            out = dict(self.state)
        out["canInstall"] = self.frozen and self.windows
        return out

    # ---------- downloading and checking ----------
    def _fetch(self, build, dest):
        """Download one build to dest, checking size and SHA-256 as it arrives. Raises ValueError on a mismatch."""
        if not build["url"].startswith(DOWNLOAD_PREFIX):
            raise ValueError("That download does not come from FrameDecks.")
        self.dir.mkdir(parents=True, exist_ok=True)
        part = dest.with_suffix(dest.suffix + ".part")
        digest, got = hashlib.sha256(), 0
        req = Request(build["url"], headers={"User-Agent": f"FrameDecks/{self.current}"})
        try:
            with self.open(req, timeout=60) as r, open(part, "wb") as f:
                while True:
                    chunk = r.read(256 * 1024)
                    if not chunk:
                        break
                    got += len(chunk)
                    if got > build["size"]:
                        raise ValueError("The download is larger than it should be; nothing was installed.")
                    digest.update(chunk)
                    f.write(chunk)
                    self.state["progress"] = int(got * 100 / build["size"])
            if got != build["size"] or digest.hexdigest() != build["sha256"]:
                raise ValueError("The download did not match FrameDecks' fingerprint; nothing was installed.")
            os.replace(part, dest)
        finally:
            if part.exists():
                part.unlink()
        return dest

    def signature_ok(self, path):
        """Windows Authenticode: valid, and signed by FrameDecks' publisher. Only asked when the manifest says signed."""
        if not self.windows:
            return False
        try:
            import winapi
            valid, signer = winapi.authenticode(path)
        except Exception:
            return False
        return valid and str(signer).strip() in PUBLISHERS         # 9.2 exactly a publisher name, not a name containing it

    def download(self, which="latest"):
        """Fetch and check the newest version (or the previous one). Returns the path of the checked installer."""
        with self.lock:
            m = self.manifest
        if not m:
            raise ValueError("Check for updates first.")
        build = m["windows"] if which == "latest" else m["previous"]
        version = m["version"] if which == "latest" else (m["previous"] or {}).get("version")
        if not build:
            raise ValueError("There is no earlier version to go back to.")
        if which == "latest" and version_tuple(version) <= version_tuple(self.current):
            raise ValueError(f"FrameDecks {self.current} is already this version or newer; nothing was installed.")
        self.state.update(phase="downloading", progress=0, error=None)
        dest = self.dir / f"FrameDecks-{version}-Setup.exe"
        try:
            if not (dest.exists() and _sha256(dest) == build["sha256"]):
                self._fetch(build, dest)
            if m["signed"] and not self.signature_ok(dest):
                dest.unlink(missing_ok=True)
                raise ValueError("The download is not signed by FrameDecks; nothing was installed.")
        except ValueError as e:
            self.state.update(phase="failed", error=str(e))
            raise
        except Exception:
            self.state.update(phase="failed", error="The download was interrupted. Check the internet connection and try again.")
            raise
        self.state.update(phase="ready", progress=100)
        if which == "latest":
            self.ready = dest
        return dest, version

    # ---------- installing ----------
    def install_command(self, installer):
        """The installer and its switches: silent, the other choices as they were, and /UPDATE=1 (start FrameDecks
        again when done; packaging/installer.iss)."""
        return [str(installer), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/NOCANCEL", "/MERGETASKS=!vcam", "/UPDATE=1"]

    def install(self, which="latest", quit_app=None):
        """Download if needed, start the installer and close FrameDecks. Windows, installed app only."""
        if not (self.frozen and self.windows):
            raise ValueError("Updates install by themselves only in the installed Windows app. Download the new version from framedecks.com/download.")
        installer, version = self.download(which)
        self.dir.mkdir(parents=True, exist_ok=True)
        (self.dir / "pending.json").write_text(json.dumps({"from": self.current, "to": version, "installer": str(installer),
                                                            "at": time.time()}), encoding="utf-8")
        flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        self.popen(self.install_command(installer), creationflags=flags, close_fds=True)
        self.state.update(phase="installing")
        if quit_app:
            threading.Timer(1.0, quit_app).start()
        return {"installing": version}

    # ---------- after a restart ----------
    def read_result(self):
        """What the last update did, read once at start: this version is the one it was updating to, or not. Keeps the
        installer of a version that installed, for putting it back later."""
        pending = self.dir / "pending.json"
        if not pending.exists():
            return None
        try:
            p = json.loads(pending.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            p = {}
        to = str(p.get("to") or "")
        if to and version_tuple(to) == version_tuple(self.current):
            out = {"ok": True, "version": to, "message": f"FrameDecks was updated to {to}."}
            self._keep(Path(p.get("installer") or ""), to)
        else:
            out = {"ok": False, "version": self.current,
                   "message": f"The update to {to} did not finish, so FrameDecks {self.current} stayed. Try again from Settings > About."}
        for f in (pending, self.dir / "result.json", self.dir / "install-update.ps1"):    # 7.0's script and its result
            try:
                f.unlink()
            except OSError:
                pass
        return out

    def _keep(self, installer, version):
        if not installer.exists():
            return
        keep = self.dir / "installed"
        keep.mkdir(parents=True, exist_ok=True)
        try:
            os.replace(installer, keep / f"FrameDecks-{version}-Setup.exe")
        except OSError:
            return
        old = sorted(keep.glob("FrameDecks-*-Setup.exe"), key=lambda f: version_tuple(f.name))
        for f in old[:-KEEP_INSTALLED]:
            f.unlink(missing_ok=True)


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()
