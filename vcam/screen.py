"""Screen sharing sources for FRAMEDECKS, behind one small interface (so a macOS backend could be added later).

    Displays : DXGI Desktop Duplication. Frames arrive only when the screen changed (frame-level dirty
               tracking), so an unchanged screen costs nothing. DXGI leaves the cursor out, so it is drawn here.
    Windows  : Windows Graphics Capture (e.g. a PowerPoint slide show), with its own cursor capture and
               dirty-region reporting.
Both come from the MIT-licensed "windows-capture" package. A moving demo source is used for tests.
"""
from errlog import swallowed as _swallowed  # noqa: E402
import ctypes
import os
import threading
import time

import cv2
import numpy as np


# ---------- What can be shared (read-only Windows queries) ----------
def list_monitors():
    if os.name != "nt":
        return []
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    found = []

    class MONITORINFOEXW(ctypes.Structure):
        _fields_ = [("cbSize", wintypes.DWORD), ("rcMonitor", wintypes.RECT), ("rcWork", wintypes.RECT),
                    ("dwFlags", wintypes.DWORD), ("szDevice", wintypes.WCHAR * 32)]
    PROC = ctypes.WINFUNCTYPE(ctypes.c_int, wintypes.HMONITOR, wintypes.HDC, ctypes.POINTER(wintypes.RECT), wintypes.LPARAM)

    def cb(hmon, hdc, rect, lp):
        mi = MONITORINFOEXW()
        mi.cbSize = ctypes.sizeof(MONITORINFOEXW)
        user32.GetMonitorInfoW(hmon, ctypes.byref(mi))
        r = mi.rcMonitor
        found.append({"primary": bool(mi.dwFlags & 1), "w": r.right - r.left, "h": r.bottom - r.top,
                      "left": r.left, "top": r.top})
        return 1
    user32.EnumDisplayMonitors(None, None, PROC(cb), 0)
    out = []
    for i, m in enumerate(found):
        out.append({"id": f"display:{i + 1}", "kind": "display", "index": i + 1, "primary": m["primary"],
                    "name": f"Display {i + 1}{' (main)' if m['primary'] else ''} — {m['w']}×{m['h']}",
                    "rect": (m["left"], m["top"], m["w"], m["h"])})
    return out


def list_windows():
    """Visible top-level application windows with a title (the Command Center itself excluded)."""
    if os.name != "nt":
        return []
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    out = []
    PROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

    def cb(hwnd, lp):
        if not user32.IsWindowVisible(hwnd) or user32.GetWindow(hwnd, 4) or user32.IsIconic(hwnd):  # 4 = GW_OWNER
            return True
        n = user32.GetWindowTextLengthW(hwnd)
        if n <= 0:
            return True
        buf = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, buf, n + 1)
        title = buf.value.strip()
        ex = user32.GetWindowLongW(hwnd, -20)                                # GWL_EXSTYLE
        if title and not ex & 0x80 and title.casefold() not in ("program manager", "framedecks"):   # 0x80 = tool window
            out.append({"id": f"window:{int(hwnd)}", "kind": "window", "hwnd": int(hwnd), "name": title[:80]})
        return True
    user32.EnumWindows(PROC(cb), 0)
    return out


def list_sources():
    if os.environ.get("KC_VCAM_DEMO") == "1":
        return [{"id": "demo:1", "kind": "demo", "name": "Demo screen (test)"}]
    try:
        return list_monitors() + list_windows()
    except Exception:
        return []


# ---------- Capturing ----------
class ScreenCapture:
    """Keeps the newest picture of the chosen source (BGR). Capture runs on its own thread."""
    def __init__(self, source):
        self.source = source
        self.frame = None
        self.frame_id = 0
        self.error = ""
        self.backend = ""
        self.fps = 0.0
        self._count, self._t = 0, time.time()
        self.alive = True
        self.lock = threading.Lock()
        self.attempts = []
        threading.Thread(target=self._run, name="bcc-screen", daemon=True).start()

    def _store(self, bgr):
        with self.lock:
            self.frame = bgr
            self.frame_id += 1
        self._count += 1
        now = time.time()
        if now - self._t >= 1.0:
            self.fps, self._count, self._t = round(self._count / (now - self._t), 1), 0, now

    def latest(self):
        with self.lock:
            return self.frame, self.frame_id

    def stop(self):
        self.alive = False

    def _run(self):
        from .priority import lower_this_thread
        lower_this_thread()                          # screen capture: background priority
        kind = self.source.get("kind")
        self.attempts = []
        try:
            if kind == "demo":
                self._demo()
                return
            if kind == "display":
                # 1. Windows Graphics Capture: works on laptops with two graphics chips and includes the cursor.
                # 2. DXGI Desktop Duplication: fallback (can be refused on two-chip laptops).
                idx, primary = self.source.get("index"), self.source.get("primary")
                targets = ([{"monitor_index": None}] if primary else []) + [{"monitor_index": idx}] + ([{"monitor_index": idx - 1}] if idx and idx > 1 else [])
                for t in targets:
                    if self._wgc(t, "display") or not self.alive:
                        return
                if self._dxgi():
                    return
            elif kind == "window":
                if self._wgc({"window_hwnd": int(self.source["hwnd"])}, "window"):
                    return
            else:
                self.attempts.append("unknown source")
            if self.alive:
                self.error = ("Screen sharing could not start. " + " | ".join(self.attempts[-4:]) +
                              ". Tips: update Windows; on laptops with two graphics chips set Python/FRAMEDECKS to the "
                              "graphics chip that drives your screen (Windows Settings > System > Display > Graphics).")
                print("FRAMEDECKS screen capture failed:", self.attempts)
        except Exception as e:
            self.error = f"Screen sharing stopped: {e}"
            print("FRAMEDECKS screen capture:", repr(e))

    def _demo(self):
        """A moving test 'screen' (for testing without Windows)."""
        self.backend = "demo"
        t = 0
        while self.alive:
            img = np.full((900, 1600, 3), (245, 240, 235), np.uint8)
            cv2.rectangle(img, (0, 0), (1600, 70), (120, 70, 30), -1)
            cv2.putText(img, "Demo screen  -  slide %d" % (1 + (t // 90) % 5), (40, 48), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (255, 255, 255), 3)
            for i in range(6):
                cv2.rectangle(img, (80, 140 + i * 110), (80 + 200 + i * 180, 200 + i * 110), (200, 150, 80), -1)
            x = 800 + int(500 * np.sin(t / 40))
            cv2.circle(img, (x, 600), 14, (40, 40, 40), -1)                  # a moving "cursor"
            self._store(img)
            t += 1
            time.sleep(1 / 30)

    # Options newer Windows versions support; each step asks for less, ending with the library defaults
    WGC_OPTIONS = ({"cursor_capture": True, "draw_border": False}, {"cursor_capture": True}, {})

    def _wgc(self, target, what):
        """Windows Graphics Capture. Returns True once it ran (frames arrived), False if it never started."""
        try:
            from windows_capture import WindowsCapture
        except Exception as e:
            self.attempts.append(f"Windows Graphics Capture unavailable ({e})")
            return False
        for opts in self.WGC_OPTIONS:
            got = {"n": 0}
            try:
                cap = WindowsCapture(**opts, **target)
            except Exception as e:
                self.attempts.append(f"WGC {what} {opts or 'defaults'}: {e}")
                continue

            @cap.event
            def on_frame_arrived(frame, control):
                if not self.alive:
                    control.stop()
                    return
                got["n"] += 1
                self._store(np.ascontiguousarray(frame.frame_buffer[:, :, :3]))   # copy: the buffer is only valid here

            @cap.event
            def on_closed():
                if got["n"]:
                    self.error = "The shared window was closed." if what == "window" else "Screen sharing ended."
            try:
                ctl = cap.start_free_threaded()
            except Exception as e:
                self.attempts.append(f"WGC {what} {opts or 'defaults'}: {e}")
                continue
            t0 = time.time()
            while self.alive and not got["n"] and not ctl.is_finished() and time.time() - t0 < 3.0:
                time.sleep(0.05)
            if got["n"]:
                self.backend = "Windows Graphics Capture (" + what + (", cursor" if opts.get("cursor_capture") else "") + ")"
                self.error = ""
                while self.alive and not ctl.is_finished():
                    time.sleep(0.2)
                try:
                    ctl.stop()
                except Exception as _e:
                    _swallowed("vcam.screen._wgc", _e)
                return True
            reason = "no picture within 3 seconds"
            try:
                ctl.stop()
                ctl.wait()                                    # errors from the capture thread surface here
            except Exception as e:
                reason = str(e) or type(e).__name__
            self.attempts.append(f"WGC {what} {opts or 'defaults'} {target}: {reason}")
            if not self.alive:
                return False
        return False

    def _dxgi(self):
        """Display capture with DXGI Desktop Duplication. acquire_frame() returns None when nothing changed."""
        try:
            from windows_capture import DxgiDuplicationSession
        except Exception as e:
            self.attempts.append(f"DXGI unavailable ({e})")
            return False
        idx, primary = self.source.get("index"), self.source.get("primary")
        session = None
        for attempt in ([None] if primary else []) + [idx] + ([idx - 1] if idx and idx > 1 else []):
            try:
                session = DxgiDuplicationSession(attempt)
                f = session.acquire_frame(timeout_ms=500)          # must deliver a first picture
                if f is None:
                    f = session.acquire_frame(timeout_ms=1000)
                if f is None:
                    raise RuntimeError("no picture")
                last = f.to_bgr()
                self.backend = f"DXGI Desktop Duplication (monitor {attempt if attempt is not None else 'main'})"
                break
            except Exception as e:
                self.attempts.append(f"DXGI monitor {attempt}: {e}")
                session = None
        if session is None:
            return False
        self.error = ""
        left, top, w, h = self.source.get("rect", (0, 0, 0, 0))
        self._store(last)
        shown_cur = None
        while self.alive:
            try:
                f = session.acquire_frame(timeout_ms=33)
            except Exception:
                time.sleep(0.2)                       # e.g. display mode changed or secure desktop: start again
                try:
                    session.recreate()
                except Exception as e:
                    self.error = f"Screen sharing stopped: {e}"
                    return True
                continue
            if f is not None:
                last = f.to_bgr()                     # only when the screen changed
            cur = _cursor_pos()
            if f is None and cur == shown_cur:
                continue                              # nothing changed: no copy, and the compositor keeps its resize
            shown_cur = cur
            img = last
            if cur and w:
                img = last.copy()
                _draw_cursor(img, cur[0] - left, cur[1] - top, img.shape[1] / max(1, w))
            self._store(img)
        return True


def _cursor_pos():
    try:
        from ctypes import wintypes
        p = wintypes.POINT()
        if ctypes.windll.user32.GetCursorPos(ctypes.byref(p)):
            return p.x, p.y
    except Exception as _e:
        _swallowed("vcam.screen._cursor_pos", _e)
    return None


ARROW = np.array([[0, 0], [0, 17], [4, 13], [7, 20], [10, 19], [7, 12], [12, 12]], np.float32)


def _draw_cursor(img, x, y, scale):
    pts = (ARROW * max(1.0, scale * 1.2) + [x, y]).astype(np.int32)
    cv2.fillPoly(img, [pts], (255, 255, 255), lineType=cv2.LINE_AA)
    cv2.polylines(img, [pts], True, (0, 0, 0), 1, lineType=cv2.LINE_AA)
