"""FrameDecks 26.11 - Follow my voice: the app's side of it (the Teleprompter asks; src/voice_worker.py listens).

Light by design, for older PCs with 4 GB of memory:
  * nothing runs until the Teleprompter's "Follow my voice" is turned on, and everything stops when it is turned off,
    the Teleprompter is unpinned or closed, or the window stops asking (15 s);
  * the listening runs in its own process at below-normal priority, so it can never slow the app or the meeting;
  * it does not start when the PC has too little free memory (MIN_FREE_MB);
  * the speech engine and the small English model (about 53 MB to download, 120 MB on disk) are fetched only the first
    time, from downloads.framedecks.com/voice/ (or where they are published), and used only when their size and
    SHA-256 match src/voice_files.json.
Nothing heard is recorded, kept or sent anywhere: the worker reports words, and the Teleprompter only uses them to
find its place.

    VoiceFollow(data_dir, frozen, settings) → .start(words), .words(words), .stop(), .heard(after, wait), .state_body()"""
import collections
import hashlib
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = json.loads((HERE / "voice_files.json").read_text(encoding="utf-8"))
MIN_FREE_MB = 350            # the model needs about 150-250 MB while listening; leave the rest of the PC room
IDLE_STOP = 15.0             # seconds without the Teleprompter asking: it has gone, so stop listening
_NO_WINDOW = 0x08000000 | 0x00004000      # CREATE_NO_WINDOW | BELOW_NORMAL_PRIORITY_CLASS (Windows)


def free_memory_mb():
    """Free physical memory in MB, or None when it cannot be told."""
    if os.name == "nt":
        try:
            import ctypes

            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_uint32), ("dwMemoryLoad", ctypes.c_uint32), ("ullTotalPhys", ctypes.c_uint64),
                            ("ullAvailPhys", ctypes.c_uint64), ("ullTotalPageFile", ctypes.c_uint64), ("ullAvailPageFile", ctypes.c_uint64),
                            ("ullTotalVirtual", ctypes.c_uint64), ("ullAvailVirtual", ctypes.c_uint64), ("ullAvailExtendedVirtual", ctypes.c_uint64)]
            m = MEMORYSTATUSEX()
            m.dwLength = ctypes.sizeof(m)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):
                return m.ullAvailPhys // (1024 * 1024)
        except (OSError, AttributeError):
            return None
        return None
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) // 1024
    except (OSError, ValueError, IndexError):
        pass
    return None


def _safe_extract(zf, dest, keep=None):
    """Extract a zip into dest, dropping its top folder; never outside dest. keep: only these file names."""
    dest = Path(dest)
    for info in zf.infolist():
        if info.is_dir():
            continue
        parts = [p for p in info.filename.replace("\\", "/").split("/") if p]
        if len(parts) > 1:
            parts = parts[1:]
        if not parts or any(p in ("..", ".") or ":" in p for p in parts):
            continue
        if keep is not None and parts[-1] not in keep:
            continue
        out = dest.joinpath(*parts)
        out.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(info) as src, open(out, "wb") as dst:
            shutil.copyfileobj(src, dst, 1 << 16)


class VoiceFollow:
    def __init__(self, data_dir, frozen=False, settings=None, available=None):
        self.dir = Path(data_dir) / "voice"
        self.frozen = frozen
        self.settings = settings or (lambda: {})
        self.available = (os.name == "nt") if available is None else available
        self.lock = threading.Condition()
        self.state, self.message, self.progress, self.level = "off", "", 0, 0.0
        self.events, self.seq = collections.deque(maxlen=200), 0
        self.proc, self.want, self.words_now, self.asked = None, False, [], 0.0
        self.downloading = False

    # ---------- files ----------
    @property
    def runtime_dir(self):
        return self.dir / FILES["runtime"]["name"].rsplit(".", 1)[0]

    @property
    def model_dir(self):
        return self.dir / FILES["model"]["name"].rsplit(".", 1)[0]

    def files_ready(self):
        lib = "libvosk.dll" if os.name == "nt" else "libvosk.so"
        return (self.runtime_dir / lib).is_file() and (self.model_dir / "conf").is_dir()

    def _fetch(self, item, done, total):
        """Download one file (mirror first), check its size and SHA-256, and extract it."""
        tmp = self.dir / (item["name"] + ".part")
        urls = [FILES["mirror"] + item["name"], item["upstream"]]
        last = "The voice files could not be downloaded. Check the internet connection and try again."
        for url in urls:
            try:
                h, got = hashlib.sha256(), 0
                with urllib.request.urlopen(url, timeout=30) as r, open(tmp, "wb") as f:     # noqa: S310 (fixed https addresses)
                    while True:
                        chunk = r.read(1 << 16)
                        if not chunk:
                            break
                        f.write(chunk)
                        h.update(chunk)
                        got += len(chunk)
                        if got > item["size"]:
                            break
                        with self.lock:
                            self.progress = int(100 * (done + got) / total)
                            self.lock.notify_all()
                if got != item["size"] or h.hexdigest() != item["sha256"]:
                    last = "A voice file did not match what FrameDecks expects, so it was not used."
                    continue
                dest = self.dir / (item["name"].rsplit(".", 1)[0] + ".new")
                shutil.rmtree(dest, ignore_errors=True)
                with zipfile.ZipFile(tmp) as zf:
                    _safe_extract(zf, dest, set(item["keep"]) if item.get("keep") else None)
                final = self.dir / item["name"].rsplit(".", 1)[0]
                shutil.rmtree(final, ignore_errors=True)
                dest.rename(final)
                return None
            except (OSError, ValueError, zipfile.BadZipFile) as e:
                last = "The voice files could not be downloaded (%s)." % (getattr(e, "reason", None) or e.__class__.__name__)
            finally:
                try:
                    tmp.unlink()
                except OSError:
                    pass
        return last

    def _download_then_launch(self):
        self.dir.mkdir(parents=True, exist_ok=True)
        total = FILES["runtime"]["size"] + FILES["model"]["size"]
        done, err = 0, None
        for key in ("runtime", "model"):
            item = FILES[key]
            target = self.runtime_dir if key == "runtime" else self.model_dir
            if not (target.is_dir() and any(target.iterdir())):
                err = self._fetch(item, done, total)
                if err:
                    break
            done += item["size"]
        with self.lock:
            self.downloading = False
            if err:
                self._set("error", err)
                self.want = False
                return
            if not self.want:
                self._set("off")
                return
        self._launch()

    def remove_files(self):
        self.stop()
        shutil.rmtree(self.dir, ignore_errors=True)

    def disk_mb(self):
        total = 0
        for p in self.dir.rglob("*") if self.dir.is_dir() else []:
            try:
                total += p.stat().st_size if p.is_file() else 0
            except OSError:
                pass
        return round(total / (1024 * 1024))

    # ---------- the worker ----------
    def _command(self):
        cfg = self.settings() or {}
        args = ["--lib", str(self.runtime_dir), "--model", str(self.model_dir),
                "--device", str(int(cfg.get("voiceMic", -1))), "--sensitivity", str(int(cfg.get("voiceSensitivity", 3)))]
        test = os.environ.get("FRAMEDECKS_VOICE_CMD")          # tests: a stand-in worker
        if test:
            return json.loads(test) + args
        if self.frozen:
            return [sys.executable, "--voice-worker"] + args
        return [sys.executable, str(HERE / "voice_worker.py")] + args

    def _launch(self):
        with self.lock:
            if self.proc or not self.want:
                return
            self._set("starting")
            try:
                self.proc = subprocess.Popen(self._command(), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                             text=True, encoding="utf-8", bufsize=1, close_fds=True,
                                             env=dict(os.environ, FRAMEDECKS_VOICE_CHILD="1"),
                                             creationflags=_NO_WINDOW if os.name == "nt" else 0)
            except OSError as e:
                self.proc = None
                self._set("error", "Listening could not start (%s)." % e.__class__.__name__)
                return
            proc, words = self.proc, list(self.words_now)
        threading.Thread(target=self._read, args=(proc,), name="voice-read", daemon=True).start()
        threading.Thread(target=self._watch, args=(proc,), name="voice-watch", daemon=True).start()
        self._send(proc, {"words": words})

    def _send(self, proc, msg):
        try:
            proc.stdin.write(json.dumps(msg) + "\n")
            proc.stdin.flush()
        except (OSError, ValueError, AttributeError):
            pass

    def _read(self, proc):
        for line in proc.stdout:
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            with self.lock:
                if proc is not self.proc:
                    break
                t = ev.get("t")
                if t == "ready":
                    self._set("listening")
                elif t in ("partial", "final"):
                    self.seq += 1
                    self.events.append({"seq": self.seq, "t": t, "text": str(ev.get("text", ""))[:500]})
                    self.lock.notify_all()
                elif t == "level":
                    self.level = float(ev.get("v", 0) or 0)
                elif t == "error":
                    self._set("error", str(ev.get("msg", ""))[:200] or "Listening stopped.")
        code = proc.wait()
        for f in (proc.stdin, proc.stdout):
            try:
                f.close()
            except (OSError, ValueError, AttributeError):
                pass
        with self.lock:
            if proc is self.proc:
                self.proc = None
                if self.state not in ("error", "off"):
                    self._set("error", "Listening stopped unexpectedly (%s)." % code)
                self.want = False

    def _watch(self, proc):
        """Stop when the Teleprompter has stopped asking (closed, crashed, or the PC went to sleep)."""
        while True:
            time.sleep(3)
            with self.lock:
                if proc is not self.proc:
                    return
                idle = time.monotonic() - self.asked > IDLE_STOP
            if idle:
                self.stop()
                return

    def _set(self, state, message=""):
        self.state, self.message = state, message
        self.lock.notify_all()

    # ---------- what the Teleprompter calls ----------
    def start(self, words):
        with self.lock:
            self.asked = time.monotonic()
            self.words_now = [str(w)[:40] for w in (words or [])[:20000] if isinstance(w, str)]
            if not self.available:
                return {"state": "unavailable"}
            if self.proc:
                self._send(self.proc, {"words": self.words_now})
                return self.state_body()
            if self.downloading:
                self.want = True
                return self.state_body()
            free = free_memory_mb()
            if free is not None and free < MIN_FREE_MB:
                return {"state": "memory", "free": free}
            self.want = True
            if not self.files_ready():
                self.downloading = True
                self.progress = 0
                self._set("downloading")
                threading.Thread(target=self._download_then_launch, name="voice-download", daemon=True).start()
                return self.state_body()
        self._launch()
        return self.state_body()

    def words(self, words):
        with self.lock:
            self.asked = time.monotonic()
            self.words_now = [str(w)[:40] for w in (words or [])[:20000] if isinstance(w, str)]
            if self.proc:
                self._send(self.proc, {"words": self.words_now})
        return self.state_body()

    def stop(self):
        with self.lock:
            self.want = False
            proc, self.proc = self.proc, None
            self.events.clear()
            self.level = 0.0
            if self.state != "downloading" or not self.downloading:
                self._set("off")
        if proc:
            self._send(proc, {"quit": True})
            try:
                proc.wait(timeout=1.5)
            except subprocess.TimeoutExpired:
                proc.kill()
        return {"state": "off"}

    def state_body(self):
        return {"state": self.state, "message": self.message, "progress": self.progress, "level": round(self.level, 2), "seq": self.seq}

    def heard(self, after=0, wait=0.0):
        """What was heard after event `after` (waits up to `wait` seconds for something new)."""
        end = time.monotonic() + max(0.0, min(2.0, wait))
        with self.lock:
            self.asked = time.monotonic()
            state = self.state
            while self.seq <= after and self.state == state and self.state in ("listening", "starting", "downloading"):
                left = end - time.monotonic()
                if left <= 0:
                    break
                self.lock.wait(left)
            body = self.state_body()
            body["events"] = [e for e in self.events if e["seq"] > after]
            return body

    def info(self):
        from voice_worker import microphones
        return {"available": self.available, "ready": self.files_ready(), "diskMb": self.disk_mb(),
                "downloadMb": round((FILES["runtime"]["size"] + FILES["model"]["size"]) / (1024 * 1024)),
                "mics": microphones() if self.available else []}
