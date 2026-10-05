"""Screen sharing sources for BCC vCam, behind one small interface (so a macOS backend could be added later).

    Displays : DXGI Desktop Duplication. Frames arrive only when the screen changed (frame-level dirty
               tracking), so an unchanged screen costs nothing. DXGI leaves the cursor out, so it is drawn here.
    Windows  : Windows Graphics Capture (e.g. a PowerPoint slide show), with its own cursor capture and
               dirty-region reporting.
Both come from the MIT-licensed "windows-capture" package. A moving demo source is used for tests.
"""
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
        if title and not ex & 0x80 and title not in ("Program Manager", "BSF Command Center"):   # 0x80 = tool window
            out.append({"id": f"window:{int(hwnd)}", "kind": "window", "hwnd": int(hwnd), "name": title[:80]})
        return True
    user32.EnumWindows(PROC(cb), 0)
    return out


def list_sources():
    if os.environ.get("BSF_VCAM_DEMO") == "1":
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
        kind = self.source.get("kind")
        try:
            if kind == "demo":
                self._demo()
            elif kind == "display":
                self._dxgi()
            elif kind == "window":
                self._wgc_window()
            else:
                self.error = "Unknown source"
        except Exception as e:
            self.error = f"Screen sharing stopped: {e}"
            print("BCC vCam screen capture:", repr(e))

    def _demo(self):
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

    def _dxgi(self):
        """Display capture with DXGI Desktop Duplication. acquire_frame() returns None when nothing changed."""
        from windows_capture import DxgiDuplicationSession
        idx = self.source.get("index")
        primary = self.source.get("primary")
        session = None
        for attempt in ([None] if primary else []) + [idx, idx - 1 if idx else None]:
            try:
                session = DxgiDuplicationSession(attempt)
                self.backend = f"DXGI Desktop Duplication (monitor {attempt if attempt is not None else 'main'})"
                break
            except Exception as e:
                self.error = str(e)
        if session is None:
            raise RuntimeError(self.error or "DXGI unavailable")
        self.error = ""
        last = None
        left, top, w, h = self.source.get("rect", (0, 0, 0, 0))
        while self.alive:
            try:
                f = session.acquire_frame(timeout_ms=33)
            except Exception:
                time.sleep(0.2)                       # e.g. display mode changed or secure desktop: start again
                session.recreate()
                continue
            if f is not None:
                last = f.to_bgr()                     # only when the screen changed
            if last is not None:
                img = last
                cur = _cursor_pos()
                if cur and w:
                    img = last.copy()
                    _draw_cursor(img, cur[0] - left, cur[1] - top, img.shape[1] / max(1, w))
                self._store(img)

    def _wgc_window(self):
        """Window capture with Windows Graphics Capture (cursor included by Windows)."""
        from windows_capture import WindowsCapture
        cap = WindowsCapture(cursor_capture=True, draw_border=False, dirty_region=True,
                             minimum_update_interval=30, window_hwnd=int(self.source["hwnd"]))
        self.backend = "Windows Graphics Capture (window)"

        @cap.event
        def on_frame_arrived(frame, control):
            if not self.alive:
                control.stop()
                return
            self._store(np.ascontiguousarray(frame.frame_buffer[:, :, :3]))

        @cap.event
        def on_closed():
            self.error = "The shared window was closed."
        ctl = cap.start_free_threaded()
        while self.alive and not ctl.is_finished():
            time.sleep(0.2)
        ctl.stop()


def _cursor_pos():
    try:
        from ctypes import wintypes
        p = wintypes.POINT()
        if ctypes.windll.user32.GetCursorPos(ctypes.byref(p)):
            return p.x, p.y
    except Exception:
        pass
    return None


ARROW = np.array([[0, 0], [0, 17], [4, 13], [7, 20], [10, 19], [7, 12], [12, 12]], np.float32)


def _draw_cursor(img, x, y, scale):
    pts = (ARROW * max(1.0, scale * 1.2) + [x, y]).astype(np.int32)
    cv2.fillPoly(img, [pts], (255, 255, 255), lineType=cv2.LINE_AA)
    cv2.polylines(img, [pts], True, (0, 0, 0), 1, lineType=cv2.LINE_AA)
