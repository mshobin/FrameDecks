"""FrameDecks - updates from FrameDecks servers (7.0; docs/deployment/release-pipeline.md).

Once a day the program asks https://api.framedecks.com/releases/latest for the release manifest (written by
tools/make_release_manifest.py when a version is published to Cloudflare R2). Settings > About then shows the new
version and its notes. **Update now**:

1. download the installer, from https://downloads.framedecks.com/ only, into <data>/updates/;
2. check its size and SHA-256 against the manifest (and its Authenticode signature when the manifest says the release
   is signed); anything that does not match is deleted and nothing is installed;
3. write a small PowerShell script that waits for FrameDecks to close, runs the installer silently
   (/VERYSILENT, without the camera task, which needs no change on an update), and starts FrameDecks again. If the
   installer fails, the script runs the installer of the version that was running before (kept from the last update,
   or downloaded and checked like any other), so the PC is never left without a working FrameDecks;
4. at the next start the program reads the script's result and says what happened.

"Reinstall the previous version" goes through the same steps with the manifest's `previous` build. Updates never
start while something is on screen (the page asks first; the server checks again). Standard library only.
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
from urllib.request import Request, urlopen

API = os.environ.get("FRAMEDECKS_UPDATE_API", "https://api.framedecks.com/releases/latest")
DOWNLOAD_PREFIX = "https://downloads.framedecks.com/"
VERSION_RE = re.compile(r"^\d+(\.\d+){1,3}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")
MAX_INSTALLER = 600 * 1024 * 1024          # a FrameDecks installer is about 150 MB; anything this big is wrong
KEEP_INSTALLED = 2                          # installers kept for putting a version back


def version_tuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", str(v or ""))[:4])


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


def parse_manifest(data):
    """The release manifest, checked: a version, a Windows build from downloads.framedecks.com with its SHA-256 and
    size, the notes, and (if any) the previous build. Returns None for anything else."""
    if not isinstance(data, dict):
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

    def __init__(self, data_dir, current_version, frozen=False, opener=urlopen, platform=None):
        self.dir = Path(data_dir) / "updates"
        self.current = current_version
        self.frozen = frozen
        self.open = opener
        self.windows = (platform or sys.platform) == "win32"
        self.lock = threading.Lock()
        self.state = {"current": current_version, "latest": None, "newer": False, "notes": "", "released": "",
                      "phase": "idle", "progress": 0, "error": None, "checkedAt": 0, "installOnExit": False,
                      "previous": None, "result": None}
        self.manifest = None
        self.ready = None                       # path of a checked installer for self.manifest
        self.state["result"] = self.read_result()

    # ---------- asking ----------
    def check(self, timeout=10):
        """Ask the update service once. Never raises; a failure leaves the last answer in place."""
        try:
            req = Request(API, headers={"Accept": "application/json",
                                        "User-Agent": f"FrameDecks/{self.current} ({'Windows' if self.windows else sys.platform})"})
            with self.open(req, timeout=timeout) as r:
                found = parse_manifest(json.loads(r.read(256 * 1024).decode("utf-8")))
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
        cmd = ["powershell", "-NoProfile", "-NonInteractive", "-Command",
               f"$s = Get-AuthenticodeSignature -LiteralPath '{path}'; \"$($s.Status)|$($s.SignerCertificate.Subject)\""]
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=60,
                                 creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout.strip()
        except Exception:
            return False
        status, _, subject = out.partition("|")
        return status == "Valid" and "Shobin Mathews" in subject

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
    def rollback_installer(self):
        """The installer of the version running now, kept from the update that installed it (if any)."""
        p = self.dir / "installed" / f"FrameDecks-{self.current}-Setup.exe"
        return p if p.exists() else None

    def script(self, installer, version, fallback, app_exe, pid):
        """The PowerShell script that does the install once FrameDecks has closed (see the module docstring)."""
        q = lambda p: "'" + str(p).replace("'", "''") + "'"   # noqa: E731
        result = self.dir / "result.json"
        args = "'/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/NOCANCEL','/MERGETASKS=!vcam'"   # other choices stay as they were
        return f"""$ErrorActionPreference = 'Continue'
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Process -Id {int(pid)} -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {{ Start-Sleep -Milliseconds 500 }}
Get-Process -Name FRAMEDECKS -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$p = Start-Process -FilePath {q(installer)} -ArgumentList {args} -PassThru -Wait
$code = $p.ExitCode
$state = 'installed'
if ($code -ne 0) {{
  $state = 'failed'
  $back = {q(fallback) if fallback else "''"}
  if ($back -and (Test-Path -LiteralPath $back)) {{
    $b = Start-Process -FilePath $back -ArgumentList {args} -PassThru -Wait
    if ($b.ExitCode -eq 0) {{ $state = 'rolled-back' }}
  }}
}}
@{{ state = $state; to = {q(version)}; from = {q(self.current)}; code = $code; installer = {q(installer)}; at = (Get-Date).ToString('o') }} |
  ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath {q(result)}
Start-Process -FilePath {q(app_exe)}
"""

    def install(self, which="latest", quit_app=None):
        """Download if needed, then hand over to the install script and close FrameDecks. Windows, installed app only."""
        if not (self.frozen and self.windows):
            raise ValueError("Updates install by themselves only in the installed Windows app. Download the new version from framedecks.com/download.")
        installer, version = self.download(which)
        fallback = self.rollback_installer()
        if fallback is None and which == "latest" and self.manifest and self.manifest["previous"] and \
                self.manifest["previous"]["version"] == self.current:
            try:                                 # the running version's own installer, checked like any other
                fallback, _ = self.download("previous")
            except Exception:
                fallback = None
        self.dir.mkdir(parents=True, exist_ok=True)
        script = self.dir / "install-update.ps1"
        script.write_text(self.script(installer, version, fallback, sys.executable, os.getpid()), encoding="utf-8-sig")
        (self.dir / "pending.json").write_text(json.dumps({"from": self.current, "to": version, "installer": str(installer),
                                                            "at": time.time()}), encoding="utf-8")
        flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) | \
            getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.Popen(["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden",
                          "-File", str(script)], creationflags=flags, close_fds=True)
        self.state.update(phase="installing")
        if quit_app:
            threading.Timer(1.0, quit_app).start()
        return {"installing": version}

    # ---------- after a restart ----------
    def read_result(self):
        """What the last update did, read once at start: installed, rolled back, or failed. Keeps the installer of a
        version that installed, for putting it back later."""
        pending, result = self.dir / "pending.json", self.dir / "result.json"
        if not pending.exists():
            return None
        try:
            p = json.loads(pending.read_text(encoding="utf-8"))
            r = json.loads(result.read_text(encoding="utf-8-sig")) if result.exists() else {}
        except (OSError, ValueError):
            p, r = {}, {}
        to = str(p.get("to") or "")
        if to and version_tuple(to) == version_tuple(self.current):
            out = {"ok": True, "version": to, "message": f"FrameDecks was updated to {to}."}
            self._keep(Path(p.get("installer") or ""), to)
        elif r.get("state") == "rolled-back":
            out = {"ok": False, "version": self.current,
                   "message": f"The update to {to} could not be installed, so FrameDecks {self.current} was put back."}
        else:
            out = {"ok": False, "version": self.current,
                   "message": f"The update to {to} did not finish. You are still on {self.current}; try again from Settings > About."}
        for f in (pending, result):
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
