"""FrameDecks 26.11.7 - the meeting guard: FrameDecks keeps itself light while a meeting app uses FrameDecks vCam,
and says plainly when something else on the PC is in the way.

Measures (only while Zoom, Teams or another app is using FrameDecks vCam, every 3 s):
    the whole PC's processor and memory, FrameDecks' own share (the program and its WebView2 pages), the graphics
    card where Windows reports it (the same "GPU Engine" counters Task Manager reads), and, when the PC is very busy,
    which other program is using the most processor.
Checks (whenever someone looks: the Command Center's Control chip, the Studio, the support report):
    other apps using a camera (Windows' own camera privacy record, read-only) and battery saver.

Everything is read through Windows' documented interfaces with ctypes and winreg: nothing starts a shell and nothing
ends another program (see winapi.py for why). The one action, Close it, asks the Windows Camera app to close the way
its own X does (WM_CLOSE), and only when the person chooses it. Every function is harmless off Windows, and the
processor and memory parts also work on Linux so they can be tested."""
import ctypes
import os
import sys
import threading
import time
from collections import deque

IS_WIN = os.name == "nt"
PERIOD = 3.0                       # seconds between looks while a meeting uses FrameDecks vCam
IDLE_PERIOD = 5.0                  # otherwise: only "is a meeting using FrameDecks vCam?" (no measuring at all)
BUSY_CPU, BUSY_GPU, CALM = 90.0, 95.0, 80.0
BUSY_LOOKS, CALM_LOOKS = 3, 2      # busy after about 9 s over the line, calm again after about 6 s under it
TOP_FROM = 85.0                    # name the busiest other program only when the PC is this busy
HISTORY = 40                       # about 2 minutes of looks for the support report
CAMERA_APP = "Microsoft.WindowsCamera_8wekyb3d8bbwe"
MEETING_APPS = ("zoom", "teams", "ms-teams", "webex", "ciscocollabhost", "chrome", "msedge", "firefox", "brave",
                "opera", "slack", "discord", "skype", "gotomeeting", "bluejeans", "obs64", "obs32")
FRIENDLY = {"microsoft.windowscamera": "the Windows Camera app", "obs64": "OBS", "obs32": "OBS", "zoom": "Zoom",
            "ms-teams": "Teams", "teams": "Teams", "msedge": "Microsoft Edge", "chrome": "Chrome", "firefox": "Firefox",
            "msedgewebview2": "FrameDecks pages (WebView2)", "python": "FrameDecks", "pythonw": "FrameDecks",
            "framedecks": "FrameDecks"}


def friendly(name):
    """'C:#Program Files#Zoom#bin#Zoom.exe', 'Zoom.exe' or a package name → 'Zoom'"""
    base = str(name or "").replace("#", "\\").split("\\")[-1]
    stem = base[:-4] if base.lower().endswith(".exe") else base
    key = stem.split("_")[0].lower()
    return FRIENDLY.get(key, stem.split("_")[0].split(".")[-1] or "an app")


# ---------- Windows functions with their types declared (64-bit handles stay whole) ----------
_API = {}


def _api():
    if not _API and IS_WIN:
        from ctypes import wintypes
        k, ps = ctypes.WinDLL("kernel32", use_last_error=True), ctypes.WinDLL("psapi")
        FT = ctypes.POINTER(wintypes.FILETIME)
        k.GetCurrentProcess.restype = wintypes.HANDLE
        k.OpenProcess.argtypes, k.OpenProcess.restype = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD], wintypes.HANDLE
        k.CloseHandle.argtypes = [wintypes.HANDLE]
        k.GetProcessTimes.argtypes = [wintypes.HANDLE, FT, FT, FT, FT]
        k.GetSystemTimes.argtypes = [FT, FT, FT]
        ps.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD]
        _API.update(k=k, ps=ps)
    return _API


# ---------- the processor ----------
def _ft(f):
    return (f.dwHighDateTime << 32) | f.dwLowDateTime


def system_times():
    """(idle, total) in 100 ns ticks since start, for the whole PC."""
    if IS_WIN:
        from ctypes import wintypes
        i, k, u = wintypes.FILETIME(), wintypes.FILETIME(), wintypes.FILETIME()
        if _api()["k"].GetSystemTimes(ctypes.byref(i), ctypes.byref(k), ctypes.byref(u)):
            return _ft(i), _ft(k) + _ft(u)                    # kernel time includes idle time
        return None
    try:
        with open("/proc/stat") as f:
            v = [int(x) for x in f.readline().split()[1:]]
        return (v[3] + (v[4] if len(v) > 4 else 0)) * 100000, sum(v) * 100000
    except (OSError, ValueError, IndexError):
        return None


def process_times(pid=None):
    """Processor time a process has used (100 ns ticks); None when it cannot be read. pid None: this program."""
    if IS_WIN:
        from ctypes import wintypes
        k = _api()["k"]
        own = pid is None or pid == os.getpid()
        h = k.GetCurrentProcess() if own else k.OpenProcess(0x1000, False, pid)    # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return None
        try:
            c, e, kt, ut = wintypes.FILETIME(), wintypes.FILETIME(), wintypes.FILETIME(), wintypes.FILETIME()
            if not k.GetProcessTimes(h, ctypes.byref(c), ctypes.byref(e), ctypes.byref(kt), ctypes.byref(ut)):
                return None
            return _ft(kt) + _ft(ut)
        finally:
            if not own:
                k.CloseHandle(h)
    if pid is None or pid == os.getpid():
        t = os.times()
        return int((t.user + t.system) * 1e7)
    return None


def cpu_percent(prev, now):
    """Share of the whole PC (0-100) between two system_times() readings."""
    if not prev or not now or now[1] <= prev[1]:
        return None
    busy = (now[1] - prev[1]) - (now[0] - prev[0])
    return round(max(0.0, min(100.0, 100.0 * busy / (now[1] - prev[1]))), 1)


# ---------- memory ----------
def system_memory():
    """{'totalMB', 'freeMB', 'loadPct'} for the whole PC."""
    if IS_WIN:
        class MS(ctypes.Structure):
            _fields_ = [("dwLength", ctypes.c_uint32), ("dwMemoryLoad", ctypes.c_uint32), ("ullTotalPhys", ctypes.c_uint64),
                        ("ullAvailPhys", ctypes.c_uint64), ("ullTotalPageFile", ctypes.c_uint64), ("ullAvailPageFile", ctypes.c_uint64),
                        ("ullTotalVirtual", ctypes.c_uint64), ("ullAvailVirtual", ctypes.c_uint64), ("ullAvailExtendedVirtual", ctypes.c_uint64)]
        m = MS(); m.dwLength = ctypes.sizeof(MS)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):
            return {"totalMB": m.ullTotalPhys // 1048576, "freeMB": m.ullAvailPhys // 1048576, "loadPct": m.dwMemoryLoad}
        return None
    try:
        info = {}
        with open("/proc/meminfo") as f:
            for line in f:
                k, v = line.split(":", 1)
                info[k] = int(v.split()[0]) // 1024
        total, free = info["MemTotal"], info.get("MemAvailable", info.get("MemFree", 0))
        return {"totalMB": total, "freeMB": free, "loadPct": round(100 * (total - free) / max(total, 1))}
    except (OSError, ValueError, KeyError):
        return None


def process_memory(pid=None):
    """Working set in MB; None when it cannot be read."""
    if IS_WIN:
        from ctypes import wintypes

        class PMC(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD), ("PeakWorkingSetSize", ctypes.c_size_t),
                        ("WorkingSetSize", ctypes.c_size_t), ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPagedPoolUsage", ctypes.c_size_t), ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaNonPagedPoolUsage", ctypes.c_size_t), ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t)]
        k = _api()["k"]
        own = pid is None or pid == os.getpid()
        h = k.GetCurrentProcess() if own else k.OpenProcess(0x1000 | 0x0010, False, pid)   # + PROCESS_VM_READ
        if not h:
            return None
        try:
            pmc = PMC(); pmc.cb = ctypes.sizeof(PMC)
            if not _api()["ps"].GetProcessMemoryInfo(h, ctypes.byref(pmc), pmc.cb):
                return None
            return round(pmc.WorkingSetSize / 1048576, 1)
        finally:
            if not own:
                k.CloseHandle(h)
    if pid is None or pid == os.getpid():
        try:
            with open("/proc/self/statm") as f:
                return round(int(f.read().split()[1]) * os.sysconf("SC_PAGE_SIZE") / 1048576, 1)
        except (OSError, ValueError):
            return None
    return None


def family(procs, root):
    """root and every process it started, and theirs (FrameDecks' WebView2 pages are its grandchildren)."""
    kids = {}
    for pid, ppid, _name in procs:
        kids.setdefault(ppid, []).append(pid)
    out, todo = set(), [root]
    while todo:
        p = todo.pop()
        if p in out:
            continue
        out.add(p)
        todo.extend(kids.get(p, []))
    return out


def processes():
    """[(pid, parent pid, exe name)]: Windows' process list (Toolhelp), empty elsewhere."""
    if not IS_WIN:
        return []
    try:
        import winapi
        return winapi.processes()
    except Exception:
        return []


# ---------- the graphics card (Windows performance counters, as Task Manager) ----------
class Gpu:
    """'\\GPU Engine(*)\\Utilization Percentage': one value per process and engine. The PC's figure is its busiest
    engine (as Task Manager shows it); a process's figure is its busiest engine too."""
    def __init__(self):
        self.q = self.c = None
        self.ok = False
        if not IS_WIN:
            return
        try:
            from ctypes import wintypes
            self.pdh = ctypes.WinDLL("pdh")
            self.q, self.c = wintypes.HANDLE(), wintypes.HANDLE()
            if self.pdh.PdhOpenQueryW(None, None, ctypes.byref(self.q)):
                return
            if self.pdh.PdhAddEnglishCounterW(self.q, "\\GPU Engine(*)\\Utilization Percentage", None, ctypes.byref(self.c)):
                return
            self.pdh.PdhCollectQueryData(self.q)
            self.ok = True
        except Exception:
            self.ok = False

    def read(self, ours=(), names=None):
        """{'total': %, 'app': %, 'pages': %, 'program': %, 'kinds': {'3D': %, 'VideoDecode': %, ...}} or None.
        26.11.8: FrameDecks' share split by process (the program itself, its WebView2 pages) and by kind of work."""
        if not self.ok:
            return None
        try:
            from ctypes import wintypes

            class VALUE(ctypes.Structure):
                _fields_ = [("CStatus", wintypes.DWORD), ("doubleValue", ctypes.c_double)]

            class ITEM(ctypes.Structure):
                _fields_ = [("szName", ctypes.c_wchar_p), ("FmtValue", VALUE)]
            if self.pdh.PdhCollectQueryData(self.q):
                return None
            size, count = wintypes.DWORD(0), wintypes.DWORD(0)
            self.pdh.PdhGetFormattedCounterArrayW(self.c, 0x200, ctypes.byref(size), ctypes.byref(count), None)  # PDH_FMT_DOUBLE
            if not size.value:
                return None
            buf = (ctypes.c_byte * size.value)()
            if self.pdh.PdhGetFormattedCounterArrayW(self.c, 0x200, ctypes.byref(size), ctypes.byref(count), buf):
                return None
            items = ctypes.cast(buf, ctypes.POINTER(ITEM))
            return split_gpu([(items[i].szName or "", items[i].FmtValue.doubleValue) for i in range(count.value)], ours, names or {})
        except Exception:
            return None


def split_gpu(values, ours, names):
    """values: [('pid_1234_luid_..._engtype_3D', %)]. The PC's figure is its busiest engine (as Task Manager shows it);
    FrameDecks' figures are its busiest engine too: all of it, its pages (WebView2), the program, and per kind of work."""
    engines, mine, pages, program, kinds = {}, {}, {}, {}, {}
    for name, v in values:
        parts = name.split("_", 2)                            # pid_1234_luid_..._engtype_3D
        if len(parts) < 3 or parts[0] != "pid":
            continue
        try:
            pid = int(parts[1])
        except ValueError:
            continue
        engine = parts[2]
        engines[engine] = engines.get(engine, 0.0) + v
        if pid in ours:
            mine[engine] = mine.get(engine, 0.0) + v
            side = pages if str(names.get(pid, "")).lower().startswith("msedgewebview2") else program
            side[engine] = side.get(engine, 0.0) + v
            kind = engine.rsplit("engtype_", 1)[-1] if "engtype_" in engine else "other"
            kinds[kind] = max(kinds.get(kind, 0.0), mine[engine])
    top = lambda d: round(min(100.0, max(d.values() or [0.0])), 1)
    return {"total": top(engines), "app": top(mine), "pages": top(pages), "program": top(program),
            "kinds": {k: round(min(100.0, v), 1) for k, v in sorted(kinds.items(), key=lambda kv: -kv[1]) if v >= 1}}


# ---------- what else is using a camera, and the battery ----------
WEBCAM_KEY = r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam"


def camera_users(own_exe=None):
    """Apps using a camera right now, from Windows' camera privacy record (read-only):
    [{'id', 'name', 'meeting': bool, 'closable': bool}]. FrameDecks itself is left out."""
    if not IS_WIN:
        return []
    try:
        import winreg
    except ImportError:
        return []
    own = (own_exe or sys.executable or "").replace("\\", "#").lower()
    out = []

    def using(k):
        try:
            stop, _ = winreg.QueryValueEx(k, "LastUsedTimeStop")
            start, _ = winreg.QueryValueEx(k, "LastUsedTimeStart")
            return int(start) > 0 and int(stop) == 0
        except OSError:
            return False

    def walk(path, packaged):
        try:
            root = winreg.OpenKey(winreg.HKEY_CURRENT_USER, path)
        except OSError:
            return
        with root:
            i = 0
            while True:
                try:
                    sub = winreg.EnumKey(root, i)
                except OSError:
                    break
                i += 1
                if sub == "NonPackaged":
                    continue
                try:
                    with winreg.OpenKey(root, sub) as k:
                        if not using(k):
                            continue
                except OSError:
                    continue
                if not packaged and sub.lower() == own:
                    continue
                stem = friendly(sub).lower()
                base = sub.replace("#", "\\").split("\\")[-1].lower().replace(".exe", "")
                out.append({"id": sub, "name": friendly(sub), "closable": packaged and sub == CAMERA_APP,
                            "meeting": any(base.startswith(m) for m in MEETING_APPS) or stem in ("zoom", "teams")})
    walk(WEBCAM_KEY, True)
    walk(WEBCAM_KEY + r"\NonPackaged", False)
    return out


def power():
    """{'saver': battery saver on, 'onBattery': not plugged in} or None."""
    if not IS_WIN:
        return None
    try:
        class SPS(ctypes.Structure):
            _fields_ = [("ACLineStatus", ctypes.c_ubyte), ("BatteryFlag", ctypes.c_ubyte), ("BatteryLifePercent", ctypes.c_ubyte),
                        ("SystemStatusFlag", ctypes.c_ubyte), ("BatteryLifeTime", ctypes.c_uint32), ("BatteryFullLifeTime", ctypes.c_uint32)]
        s = SPS()
        if not ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(s)):
            return None
        return {"saver": s.SystemStatusFlag == 1, "onBattery": s.ACLineStatus == 0}
    except Exception:
        return None


def close_camera_app():
    """Ask the Windows Camera app to close, as its own X does (WM_CLOSE to its window). Returns how many windows were
    asked. Only ever called when the person chooses Close it."""
    if not IS_WIN:
        return 0
    from ctypes import wintypes
    u = ctypes.windll.user32
    names = {pid: name.lower() for pid, _pp, name in processes()}
    targets = []

    def pid_of(hwnd):
        p = wintypes.DWORD()
        u.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
        return p.value

    child_hit = []
    CHILD = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def on_child(hwnd, _l):
        if names.get(pid_of(hwnd)) == "windowscamera.exe":
            child_hit.append(hwnd)
            return False
        return True
    child_cb = CHILD(on_child)

    def on_top(hwnd, _l):
        if not u.IsWindowVisible(hwnd):
            return True
        n = names.get(pid_of(hwnd), "")
        if n == "windowscamera.exe":
            targets.append(hwnd)
        elif n == "applicationframehost.exe":                 # a Store app's frame: is the Camera app inside?
            del child_hit[:]
            u.EnumChildWindows(hwnd, child_cb, 0)
            if child_hit:
                targets.append(hwnd)
        return True
    u.EnumWindows(CHILD(on_top), 0)
    for hwnd in targets:
        u.PostMessageW(hwnd, 0x0010, 0, 0)                    # WM_CLOSE
    return len(targets)


# ---------- the guard ----------
class Guard:
    """in_use(): is a meeting app using FrameDecks vCam? lighten(busy): FrameDecks makes its own camera work lighter
    while the PC is very busy, and back when it is calm."""
    def __init__(self, in_use, lighten=None, clock=time.time, context=None):
        self.in_use, self.lighten, self.clock = in_use, lighten, clock
        self.context = context                 # 26.11.8 () -> {'open': [FrameDecks windows on screen], 'front': the one in front}
        self.lock = threading.Lock()
        self.history = deque(maxlen=HISTORY)
        self.peak = {}
        self.status = {"active": False, "busy": False, "since": None}
        self._sys = self._app = None
        self._others = {}
        self._over = self._under = 0
        self._gpu = None
        self._pre = (0.0, None)
        self.alive = True

    def start(self):
        threading.Thread(target=self._loop, name="bcc-meeting-guard", daemon=True).start()
        return self

    def _loop(self):
        try:
            from vcam.priority import lower_this_thread
            lower_this_thread()
        except Exception:
            pass
        while self.alive:
            active = False
            try:
                active = bool(self.in_use())
                if active:
                    self.look()
                elif self.status.get("active"):
                    self.stop()
            except Exception as _e:
                try:
                    from errlog import swallowed
                    swallowed("meeting_guard.loop", _e)
                except Exception:
                    pass
            time.sleep(PERIOD if active else IDLE_PERIOD)

    def stop(self):
        with self.lock:
            was_busy = self.status.get("busy")
            self.status = {"active": False, "busy": False, "since": None}
            self._sys = self._app = None
            self._over = self._under = 0
        if was_busy and self.lighten:
            self.lighten(False)

    def look(self, sample=None):
        """One look. sample (tests): {'cpu', 'gpu', 'appCpu', 'appMB', 'top'} instead of reading the PC."""
        s = sample if sample is not None else self._read()
        with self.lock:
            if not self.status.get("active"):
                self.status = {"active": True, "busy": False, "since": self.clock()}
            cpu, gpu = s.get("cpu"), s.get("gpu")
            over = (cpu is not None and cpu >= BUSY_CPU) or (gpu is not None and gpu >= BUSY_GPU)
            under = (cpu is None or cpu < CALM) and (gpu is None or gpu < BUSY_GPU - 10)
            self._over = self._over + 1 if over else 0
            self._under = self._under + 1 if under else 0
            was = self.status["busy"]
            busy = True if self._over >= BUSY_LOOKS else False if self._under >= CALM_LOOKS else was
            self.status.update(s, busy=busy, at=self.clock())
            self.history.append({k: s.get(k) for k in ("cpu", "gpu", "appCpu", "appGpu", "pagesGpu", "programGpu", "gpuKinds", "appMB",
                                                        "memLoad", "front", "open")} | {"t": round(self.clock())})
            for k in ("cpu", "gpu", "appCpu", "appGpu", "pagesGpu", "programGpu", "appMB", "memLoad"):
                if s.get(k) is not None:
                    self.peak[k] = max(self.peak.get(k, 0), s[k])
        if busy != was and self.lighten:
            self.lighten(busy)
        return self.status

    def _read(self):
        now = system_times()
        cpu = cpu_percent(self._sys, now)
        self._sys = now
        procs = processes()
        ours = family(procs, os.getpid()) if procs else {os.getpid()}
        app_t = sum(t for t in (process_times(p) for p in ours) if t)
        app_cpu = None
        if self._app and now and self._sys and now[1] > self._app[1]:
            app_cpu = round(max(0.0, min(100.0, 100.0 * (app_t - self._app[0]) / (now[1] - self._app[1]))), 1)
        self._app = (app_t, now[1]) if now else None
        mem = system_memory() or {}
        app_mb = round(sum(m for m in (process_memory(p) for p in ours) if m), 1)
        if self._gpu is None:
            self._gpu = Gpu()
        g = self._gpu.read(ours, {pid: name for pid, _pp, name in procs})
        top = self._busiest(procs, ours, now) if cpu is not None and cpu >= TOP_FROM else None
        ctx = {}
        if self.context:
            try:
                ctx = self.context() or {}
            except Exception:
                ctx = {}
        return {"cpu": cpu, "gpu": g and g["total"], "appCpu": app_cpu, "appGpu": g and g["app"], "appMB": app_mb,
                "pagesGpu": g and g["pages"], "programGpu": g and g["program"], "gpuKinds": g and g["kinds"],
                "memLoad": mem.get("loadPct"), "memTotalMB": mem.get("totalMB"), "top": top,
                "open": ctx.get("open"), "front": ctx.get("front")}

    def _busiest(self, procs, ours, now):
        """The other program using the most processor since the last look: {'name', 'cpu'} (or None)."""
        seen, best = {}, None
        for pid, _pp, name in procs:
            if pid in ours or pid in (0, 4):
                continue
            t = process_times(pid)
            if t is None:
                continue
            seen[pid] = (t, now[1])
            old = self._others.get(pid)
            if old and now[1] > old[1]:
                share = 100.0 * (t - old[0]) / (now[1] - old[1])
                if not best or share > best["cpu"]:
                    best = {"name": friendly(name), "cpu": round(share, 1)}
        self._others = seen
        return best

    def checks(self, max_age=2.0):
        """Before you go live: other camera users and battery saver (read when asked, kept 2 s)."""
        t, c = self._pre
        if c is not None and self.clock() - t < max_age:
            return c
        c = {"cameras": camera_users(), "power": power()}
        self._pre = (self.clock(), c)
        return c

    def report(self):
        """What the pages and the support report show."""
        c = self.checks()
        with self.lock:
            st = dict(self.status)
            hist, peak = list(self.history)[-10:], dict(self.peak)
        warn = []
        for cam in c["cameras"]:
            if cam["closable"]:
                warn.append({"id": "camera-app", "text": "The Windows Camera app is open and using your webcam. Close it so "
                             "your meeting and FrameDecks have the camera to themselves.", "action": "close-camera"})
            elif not cam["meeting"]:
                warn.append({"id": "camera-other", "text": cam["name"] + " is also using a camera."})
        p = c["power"] or {}
        if p.get("saver"):
            warn.append({"id": "saver", "text": "Battery saver is on, which slows the PC and its graphics. Plug in, or turn it off.",
                         "action": "power"})
        if st.get("busy"):
            top = st.get("top")
            ours = (st.get("appCpu") or 0) >= 40 or (st.get("appGpu") or 0) >= 40
            what = "processor " + str(round(st["cpu"])) + "%" if st.get("cpu") is not None else ""
            if st.get("gpu") is not None and st["gpu"] >= BUSY_GPU:
                what = (what + ", " if what else "") + "graphics " + str(round(st["gpu"])) + "%"
            text = "Your PC is very busy (" + what + ")."
            if top and not ours:
                text += " Most of it: " + top["name"] + "."
            if ours:
                text += " FrameDecks has made its camera work lighter until it calms down."
            warn.append({"id": "busy", "text": text})
        return {"active": st.get("active", False), "busy": st.get("busy", False), "now": st, "warnings": warn,
                "recent": hist, "peak": peak, "power": c["power"], "cameras": c["cameras"]}
