"""The Presentation window, drawn natively (Win32 + GDI): no browser engine, no JPEG, no browser GPU process.

Frames come straight from the compositor (the same final picture FrameCast sends) and are drawn only when the
picture changed, at the chosen rate (15 per second by default). The window is frameless: drag anywhere to move
it, drag an edge to resize it, double-click / F / the button for full screen, Esc leaves full screen and then
closes it. Moving the mouse shows the Full screen and Exit buttons for two seconds. The window is called
"FrameDecks Share Window" (never displayed) so Zoom lists it under Share Screen > specific window.

The pure functions at the top (layout, buttons, hit test, drawing) have no Windows dependencies.
"""
import os
import threading
import time
from pathlib import Path

import cv2
import numpy as np

TITLE = "FrameDecks Share Window"
BORDER = 8                       # px from an edge that resizes the window
UI_SECONDS = 2.0


# ---------------------------------------------------------------- pure helpers (testable anywhere)
def letterbox(cw, ch, fw, fh):
    """Where the picture goes inside the window, keeping its shape."""
    k = min(cw / max(1, fw), ch / max(1, fh))
    w, h = max(1, int(round(fw * k))), max(1, int(round(fh * k)))
    return (cw - w) // 2, (ch - h) // 2, w, h


def button_rects(cw, scale=1.0):
    """Top-right buttons (like the web version): Full screen, then Exit."""
    h, gap, m = int(36 * scale), int(8 * scale), int(14 * scale)
    exit_w, fs_w = int(92 * scale), int(150 * scale)
    x1 = cw - m
    exit_r = (x1 - exit_w, m, x1, m + h)
    fs_r = (exit_r[0] - gap - fs_w, m, exit_r[0] - gap, m + h)
    return {"fullscreen": fs_r, "exit": exit_r}


HT = {"client": 1, "caption": 2, "left": 10, "right": 11, "top": 12, "topleft": 13, "topright": 14,
      "bottom": 15, "bottomleft": 16, "bottomright": 17}


def hit_test(x, y, cw, ch, ui_visible, fullscreen, scale=1.0):
    """What the mouse is over: a button (client), an edge (resize) or the picture (drag to move)."""
    if ui_visible:
        for r in button_rects(cw, scale).values():
            if r[0] <= x < r[2] and r[1] <= y < r[3]:
                return HT["client"]
    if fullscreen:
        return HT["client"]
    b = int(BORDER * scale)
    left, right, top, bottom = x < b, x >= cw - b, y < b, y >= ch - b
    if top and left: return HT["topleft"]
    if top and right: return HT["topright"]
    if bottom and left: return HT["bottomleft"]
    if bottom and right: return HT["bottomright"]
    if left: return HT["left"]
    if right: return HT["right"]
    if top: return HT["top"]
    if bottom: return HT["bottom"]
    return HT["caption"]


def which_button(x, y, cw, scale=1.0):
    for name, r in button_rects(cw, scale).items():
        if r[0] <= x < r[2] and r[1] <= y < r[3]:
            return name
    return None


_btn_cache = {}


def _button_img(label, w, h, kind, scale, fonts_dir):
    """A rounded button like the web version's (BGRA), drawn once and cached."""
    key = (label, w, h, kind)
    if key in _btn_cache:
        return _btn_cache[key]
    from PIL import Image, ImageDraw, ImageFont
    k = 2
    img = Image.new("RGBA", (w * k, h * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bg = (160, 30, 30, 230) if kind == "exit" else (10, 18, 34, 220)
    d.rounded_rectangle([0, 0, w * k - 1, h * k - 1], radius=10 * k * scale, fill=bg, outline=(255, 255, 255, 70), width=max(1, int(k * scale)))
    try:
        font = ImageFont.truetype(str(Path(fonts_dir) / "SourceSans3.ttf"), int(14 * k * scale))
        try:
            font.set_variation_by_axes([600])
        except Exception:
            pass
    except Exception:
        font = ImageFont.load_default()
    icon = int(12 * k * scale)
    ix, iy = int(14 * k * scale), (h * k - icon) // 2
    if kind == "exit":                                  # ✕
        d.line([ix, iy, ix + icon, iy + icon], fill="white", width=int(2 * k * scale))
        d.line([ix, iy + icon, ix + icon, iy], fill="white", width=int(2 * k * scale))
    else:                                               # expand corners
        t, q = int(2 * k * scale), icon // 3
        for (cx, cy, dx, dy) in ((ix, iy, 1, 1), (ix + icon, iy, -1, 1), (ix, iy + icon, 1, -1), (ix + icon, iy + icon, -1, -1)):
            d.line([cx, cy, cx + dx * q, cy], fill="white", width=t)
            d.line([cx, cy, cx, cy + dy * q], fill="white", width=t)
    tx = ix + icon + int(8 * k * scale)
    ty = (h * k - int(14 * k * scale)) // 2 - int(2 * k * scale)
    d.text((tx, ty), label, font=font, fill="white")
    small = img.resize((w, h), Image.LANCZOS)
    arr = np.array(small)[..., [2, 1, 0, 3]].copy()     # RGBA -> BGRA
    _btn_cache[key] = arr
    return arr


def _over(canvas, img, x, y):
    h, w = img.shape[:2]
    if x < 0 or y < 0 or x + w > canvas.shape[1] or y + h > canvas.shape[0]:
        return
    a = img[..., 3:4].astype(np.uint16)
    roi = canvas[y:y + h, x:x + w, :3].astype(np.uint16)
    canvas[y:y + h, x:x + w, :3] = ((img[..., :3].astype(np.uint16) * a + roi * (255 - a)) // 255).astype(np.uint8)


def button_patches(frame, pic_rect, cw, ui_fullscreen, scale=1.0, fonts_dir=None):
    """The two buttons as small BGRA patches over the picture behind them: [(x, y, patch)].
    Only these patches are composed in Python; Windows scales and draws the picture itself."""
    out = []
    px, py, pw, ph = pic_rect
    fh, fw = frame.shape[:2] if frame is not None else (1, 1)
    for name, (x0, y0, x1, y1) in button_rects(cw, scale).items():
        w, h = x1 - x0, y1 - y0
        under = np.zeros((h, w, 4), np.uint8)
        under[..., 3] = 255
        if frame is not None:                               # the part of the picture behind the button
            sx0 = int((x0 - px) * fw / max(1, pw)); sy0 = int((y0 - py) * fh / max(1, ph))
            sx1 = int((x1 - px) * fw / max(1, pw)); sy1 = int((y1 - py) * fh / max(1, ph))
            cx0, cy0, cx1, cy1 = max(0, sx0), max(0, sy0), min(fw, sx1), min(fh, sy1)
            if cx1 > cx0 and cy1 > cy0:
                crop = cv2.resize(frame[cy0:cy1, cx0:cx1, :3], (w, h), interpolation=cv2.INTER_LINEAR)
                under[..., :3] = crop
        label = ("Exit full screen" if ui_fullscreen else "Full screen") if name == "fullscreen" else "Exit"
        if fonts_dir:
            _over(under, _button_img(label, w, h, name, scale, fonts_dir), 0, 0)
        out.append((x0, y0, np.ascontiguousarray(under)))
    return out


def to_bgra(frame):
    """The picture in the 32-bit layout GDI draws directly."""
    return np.ascontiguousarray(cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)) if frame is not None else None


# ---------------------------------------------------------------- the Windows window
# Windows keeps ONE handler per window class for the life of the process. So the class is registered once with a
# permanent handler that forwards each message to the Presentation window it belongs to (looked up by its handle).
# (Registering a per-window handler made the second window use the first window's freed handler -> crash.)
_CLASS = {"registered": False, "proc": None, "wndproc_type": None, "windows": {}, "creating": None, "lock": threading.Lock()}
CLASS_NAME = "KCPresentationWindow"


def _route(hwnd, msg, wp, lp):
    """The permanent window procedure: hand the message to the right Presentation window."""
    inst = _CLASS["windows"].get(hwnd)
    if inst is None and _CLASS["creating"] is not None:      # messages sent during CreateWindowEx, before we know hwnd
        inst = _CLASS["creating"]
        _CLASS["windows"][hwnd] = inst
    if msg == 0x0082:                                         # WM_NCDESTROY: the window is gone for good
        _CLASS["windows"].pop(hwnd, None)
    if inst is not None and inst._handler is not None:
        return inst._handler(hwnd, msg, wp, lp)
    import ctypes
    return ctypes.windll.user32.DefWindowProcW(hwnd, msg, wp, lp)


class NativePresentation:
    """Opens the window on its own thread. close(), set_fullscreen() and is_open() are safe from any thread."""

    def __init__(self, compositor, keep_awake, get_fps, fonts_dir, on_closed=None):
        if os.name != "nt":
            raise RuntimeError("The native Presentation window is only available on Windows.")
        self.comp, self.keep_awake, self.get_fps = compositor, keep_awake, get_fps
        self.fonts_dir, self.on_closed = str(fonts_dir), on_closed
        self.hwnd = None
        self.frame = None
        self.fullscreen = False
        self.saved_rect = None
        self.ui_until = 0.0
        self.alive = True
        self.error = None
        self.ready = threading.Event()
        self._handler = None
        threading.Thread(target=self._window_thread, name="bcc-present-window", daemon=True).start()
        if not self.ready.wait(6) or self.error:
            self.alive = False
            raise RuntimeError(self.error or "The Presentation window did not open.")
        threading.Thread(target=self._feed_thread, name="bcc-present-feed", daemon=True).start()

    # ---- called from other threads
    def is_open(self):
        return self.alive and self.hwnd is not None

    def close(self):
        if self.hwnd:
            self._u32.PostMessageW(self.hwnd, 0x0010, 0, 0)          # WM_CLOSE

    def set_fullscreen(self, want=None):
        target = (not self.fullscreen) if want is None else bool(want)
        if self.hwnd and target != self.fullscreen:
            self._u32.PostMessageW(self.hwnd, self.WM_APP_FS, 1 if target else 0, 0)
            for _ in range(40):                                      # wait for the window thread to apply it
                if self.fullscreen == target:
                    break
                time.sleep(0.01)
        return self.fullscreen

    # ---- frames: wait for a changed picture, keep the engine awake, ask the window to repaint
    def _feed_thread(self):
        from .priority import lower_this_thread
        lower_this_thread()
        pres, cond = self.comp.present, self.comp.present_cond
        with cond:
            pres["clients"] += 1
            pres["sig"] = None
        last, t_last = -1, 0.0
        try:
            while self.alive:
                self.keep_awake(3.0)
                with cond:
                    cond.wait_for(lambda: pres["ver"] != last or not self.alive, timeout=1.0)
                    ver, frame = pres["ver"], pres["frame"]
                if ver == last or frame is None:
                    continue
                gap = time.time() - t_last
                fps = max(1, self.get_fps() or 15)
                if gap < 1 / fps:
                    time.sleep(1 / fps - gap)
                    with cond:
                        ver, frame = pres["ver"], pres["frame"]
                self.frame, last, t_last = frame, ver, time.time()
                pres["sent"] += 1
                if self.hwnd:
                    self._u32.PostMessageW(self.hwnd, self.WM_APP_FRAME, 0, 0)
        finally:
            with cond:
                pres["clients"] = max(0, pres["clients"] - 1)

    # ---- the window itself
    def _window_thread(self):
        try:
            self._create_and_run()
        except Exception as e:
            self.error = f"{type(e).__name__}: {e}"
            self.ready.set()
        finally:
            self.alive = False
            self.hwnd = None
            if self.on_closed:
                try:
                    self.on_closed()
                except Exception:
                    pass

    WM_APP_FRAME = 0x8000 + 1
    WM_APP_FS = 0x8000 + 2

    def _create_and_run(self):
        import ctypes
        from ctypes import wintypes as W
        u32, g32, k32 = ctypes.windll.user32, ctypes.windll.gdi32, ctypes.windll.kernel32
        self._u32 = u32
        LRESULT = ctypes.c_ssize_t
        with _CLASS["lock"]:
            if _CLASS["wndproc_type"] is None:
                _CLASS["wndproc_type"] = ctypes.WINFUNCTYPE(LRESULT, W.HWND, W.UINT, W.WPARAM, W.LPARAM)
        WNDPROC = _CLASS["wndproc_type"]

        class WNDCLASSEXW(ctypes.Structure):
            _fields_ = [("cbSize", W.UINT), ("style", W.UINT), ("lpfnWndProc", WNDPROC), ("cbClsExtra", ctypes.c_int),
                        ("cbWndExtra", ctypes.c_int), ("hInstance", W.HINSTANCE), ("hIcon", W.HICON), ("hCursor", W.HANDLE),
                        ("hbrBackground", W.HBRUSH), ("lpszMenuName", W.LPCWSTR), ("lpszClassName", W.LPCWSTR), ("hIconSm", W.HICON)]

        class PAINTSTRUCT(ctypes.Structure):
            _fields_ = [("hdc", W.HDC), ("fErase", W.BOOL), ("rcPaint", W.RECT), ("fRestore", W.BOOL),
                        ("fIncUpdate", W.BOOL), ("rgbReserved", ctypes.c_byte * 32)]

        class BITMAPINFOHEADER(ctypes.Structure):
            _fields_ = [("biSize", W.DWORD), ("biWidth", ctypes.c_long), ("biHeight", ctypes.c_long), ("biPlanes", W.WORD),
                        ("biBitCount", W.WORD), ("biCompression", W.DWORD), ("biSizeImage", W.DWORD),
                        ("biXPelsPerMeter", ctypes.c_long), ("biYPelsPerMeter", ctypes.c_long), ("biClrUsed", W.DWORD),
                        ("biClrImportant", W.DWORD)]

        class MONITORINFO(ctypes.Structure):
            _fields_ = [("cbSize", W.DWORD), ("rcMonitor", W.RECT), ("rcWork", W.RECT), ("dwFlags", W.DWORD)]

        class MINMAXINFO(ctypes.Structure):
            _fields_ = [("ptReserved", W.POINT), ("ptMaxSize", W.POINT), ("ptMaxPosition", W.POINT),
                        ("ptMinTrackSize", W.POINT), ("ptMaxTrackSize", W.POINT)]

        # 64-bit safe signatures
        u32.DefWindowProcW.argtypes = [W.HWND, W.UINT, W.WPARAM, W.LPARAM]
        u32.DefWindowProcW.restype = LRESULT
        u32.CreateWindowExW.argtypes = [W.DWORD, W.LPCWSTR, W.LPCWSTR, W.DWORD, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                                        ctypes.c_int, W.HWND, W.HMENU, W.HINSTANCE, W.LPVOID]
        u32.CreateWindowExW.restype = W.HWND
        u32.RegisterClassExW.argtypes = [ctypes.POINTER(WNDCLASSEXW)]
        u32.RegisterClassExW.restype = W.ATOM
        u32.PostMessageW.argtypes = [W.HWND, W.UINT, W.WPARAM, W.LPARAM]
        u32.BeginPaint.argtypes = [W.HWND, ctypes.POINTER(PAINTSTRUCT)]
        u32.BeginPaint.restype = W.HDC
        u32.EndPaint.argtypes = [W.HWND, ctypes.POINTER(PAINTSTRUCT)]
        u32.GetClientRect.argtypes = [W.HWND, ctypes.POINTER(W.RECT)]
        u32.GetWindowRect.argtypes = [W.HWND, ctypes.POINTER(W.RECT)]
        u32.InvalidateRect.argtypes = [W.HWND, ctypes.c_void_p, W.BOOL]
        u32.ScreenToClient.argtypes = [W.HWND, ctypes.POINTER(W.POINT)]
        u32.SetWindowPos.argtypes = [W.HWND, W.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, W.UINT]
        u32.MonitorFromWindow.argtypes = [W.HWND, W.DWORD]
        u32.MonitorFromWindow.restype = W.HMONITOR
        u32.GetMonitorInfoW.argtypes = [W.HMONITOR, ctypes.POINTER(MONITORINFO)]
        u32.SetTimer.argtypes = [W.HWND, ctypes.c_size_t, W.UINT, ctypes.c_void_p]
        u32.KillTimer.argtypes = [W.HWND, ctypes.c_size_t]
        u32.DestroyWindow.argtypes = [W.HWND]
        u32.SetForegroundWindow.argtypes = [W.HWND]
        u32.LoadCursorW.argtypes = [W.HINSTANCE, ctypes.c_void_p]
        u32.LoadCursorW.restype = W.HANDLE
        u32.GetMessageW.argtypes = [ctypes.POINTER(W.MSG), W.HWND, W.UINT, W.UINT]
        u32.TranslateMessage.argtypes = [ctypes.POINTER(W.MSG)]
        u32.DispatchMessageW.argtypes = [ctypes.POINTER(W.MSG)]
        g32.SetDIBitsToDevice.argtypes = [W.HDC, ctypes.c_int, ctypes.c_int, W.DWORD, W.DWORD, ctypes.c_int, ctypes.c_int,
                                          W.UINT, W.UINT, ctypes.c_void_p, ctypes.c_void_p, W.UINT]
        g32.StretchDIBits.argtypes = [W.HDC, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                                      ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p, W.UINT, W.DWORD]
        g32.SetStretchBltMode.argtypes = [W.HDC, ctypes.c_int]
        g32.SetBrushOrgEx.argtypes = [W.HDC, ctypes.c_int, ctypes.c_int, ctypes.c_void_p]
        g32.PatBlt.argtypes = [W.HDC, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, W.DWORD]
        g32.GetStockObject.restype = W.HGDIOBJ
        k32.GetModuleHandleW.restype = W.HMODULE

        def dpi_scale():
            try:
                u32.GetDpiForWindow.argtypes = [W.HWND]
                return max(1.0, u32.GetDpiForWindow(self.hwnd) / 96.0) if self.hwnd else max(1.0, u32.GetDpiForSystem() / 96.0)
            except Exception:
                return 1.0

        def client_size():
            r = W.RECT()
            u32.GetClientRect(self.hwnd, ctypes.byref(r))
            return max(1, r.right - r.left), max(1, r.bottom - r.top)

        def show_ui():
            self.ui_until = time.time() + UI_SECONDS
            u32.SetTimer(self.hwnd, 1, int(UI_SECONDS * 1000) + 100, None)
            u32.InvalidateRect(self.hwnd, None, False)

        def apply_fullscreen(want):
            if want == self.fullscreen:
                return
            if want:
                r = W.RECT()
                u32.GetWindowRect(self.hwnd, ctypes.byref(r))
                self.saved_rect = (r.left, r.top, r.right - r.left, r.bottom - r.top)
                mi = MONITORINFO(); mi.cbSize = ctypes.sizeof(MONITORINFO)
                u32.GetMonitorInfoW(u32.MonitorFromWindow(self.hwnd, 2), ctypes.byref(mi))
                m = mi.rcMonitor
                u32.SetWindowPos(self.hwnd, None, m.left, m.top, m.right - m.left, m.bottom - m.top, 0x0020 | 0x0040)
            elif self.saved_rect:
                x, y, w, h = self.saved_rect
                u32.SetWindowPos(self.hwnd, None, x, y, w, h, 0x0020 | 0x0040)   # SWP_FRAMECHANGED | SWP_SHOWWINDOW
            self.fullscreen = want
            u32.InvalidateRect(self.hwnd, None, False)

        def leave():
            if self.fullscreen:
                apply_fullscreen(False)
            else:
                u32.DestroyWindow(self.hwnd)

        bmi = BITMAPINFOHEADER()
        bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmi.biPlanes, bmi.biBitCount, bmi.biCompression = 1, 32, 0                 # 32-bit BGRA, BI_RGB

        cache = {"frame": None, "bgra": None}

        def paint(hwnd):
            ps = PAINTSTRUCT()
            hdc = u32.BeginPaint(hwnd, ctypes.byref(ps))
            try:
                cw, ch = client_size()
                frame = self.frame
                if frame is None:
                    g32.PatBlt(hdc, 0, 0, cw, ch, 0x00000042)                         # BLACKNESS
                    return
                if cache["frame"] is not frame:                                        # convert each new picture once
                    cache["frame"], cache["bgra"] = frame, to_bgra(frame)
                bgra = cache["bgra"]
                fh, fw = bgra.shape[:2]
                x, y, w, h = letterbox(cw, ch, fw, fh)
                # black bars (if the window isn't 16:9)
                if y > 0:
                    g32.PatBlt(hdc, 0, 0, cw, y, 0x00000042); g32.PatBlt(hdc, 0, y + h, cw, ch - y - h, 0x00000042)
                if x > 0:
                    g32.PatBlt(hdc, 0, 0, x, ch, 0x00000042); g32.PatBlt(hdc, x + w, 0, cw - x - w, ch, 0x00000042)
                bmi.biWidth, bmi.biHeight = fw, -fh                                   # negative = top-down rows
                if (w, h) == (fw, fh):
                    g32.SetDIBitsToDevice(hdc, x, y, fw, fh, 0, 0, 0, fh, bgra.ctypes.data, ctypes.byref(bmi), 0)
                else:                                                                  # Windows scales it (native, high quality)
                    g32.SetStretchBltMode(hdc, 4)                                      # HALFTONE
                    g32.SetBrushOrgEx(hdc, 0, 0, None)
                    g32.StretchDIBits(hdc, x, y, w, h, 0, 0, fw, fh, bgra.ctypes.data, ctypes.byref(bmi), 0, 0x00CC0020)   # SRCCOPY
                if time.time() < self.ui_until:                                        # buttons: two small patches
                    for bx, by, patch in button_patches(frame, (x, y, w, h), cw, self.fullscreen, dpi_scale(), self.fonts_dir):
                        ph_, pw_ = patch.shape[:2]
                        bmi.biWidth, bmi.biHeight = pw_, -ph_
                        g32.SetDIBitsToDevice(hdc, bx, by, pw_, ph_, 0, 0, 0, ph_, patch.ctypes.data, ctypes.byref(bmi), 0)
            finally:
                u32.EndPaint(hwnd, ctypes.byref(ps))

        def lparam_xy(lp):
            x, y = lp & 0xFFFF, (lp >> 16) & 0xFFFF
            return (x - 0x10000 if x & 0x8000 else x), (y - 0x10000 if y & 0x8000 else y)

        def wndproc(hwnd, msg, wp, lp):
            try:
                if msg == 0x0083 and wp:                    # WM_NCCALCSIZE: no frame at all (keeps resize/snap)
                    return 0
                if msg == 0x0084:                           # WM_NCHITTEST: buttons, edges (resize) or drag to move
                    x, y = lparam_xy(lp)
                    pt = W.POINT(x, y)
                    u32.ScreenToClient(hwnd, ctypes.byref(pt))
                    cw, ch = client_size()
                    return hit_test(pt.x, pt.y, cw, ch, time.time() < self.ui_until, self.fullscreen, dpi_scale())
                if msg in (0x0200, 0x00A0):                 # WM_MOUSEMOVE, WM_NCMOUSEMOVE: show the buttons
                    if time.time() >= self.ui_until - UI_SECONDS + 0.25:
                        show_ui()
                    return u32.DefWindowProcW(hwnd, msg, wp, lp)
                if msg == 0x0202:                           # WM_LBUTTONUP on a button
                    x, y = lparam_xy(lp)
                    cw, _ = client_size()
                    b = which_button(x, y, cw, dpi_scale()) if time.time() < self.ui_until else None
                    if b == "exit":
                        leave()
                    elif b == "fullscreen":
                        apply_fullscreen(not self.fullscreen)
                    return 0
                if msg in (0x00A3, 0x0203):                 # double-click (frame area or client): full screen
                    apply_fullscreen(not self.fullscreen)
                    return 0
                if msg == 0x0100:                           # WM_KEYDOWN
                    if wp == 0x1B:                          # Esc: leave full screen first, then close
                        leave()
                    elif wp in (0x46, 0x7A):                # F, F11
                        apply_fullscreen(not self.fullscreen)
                    return 0
                if msg == 0x0113:                           # WM_TIMER: hide the buttons again
                    if time.time() >= self.ui_until:
                        u32.KillTimer(hwnd, 1)
                        u32.InvalidateRect(hwnd, None, False)
                    return 0
                if msg == self.WM_APP_FRAME:                # a new picture
                    u32.InvalidateRect(hwnd, None, False)
                    return 0
                if msg == self.WM_APP_FS:
                    apply_fullscreen(bool(wp))
                    return 0
                if msg == 0x0024:                           # WM_GETMINMAXINFO: smallest size
                    mmi = ctypes.cast(lp, ctypes.POINTER(MINMAXINFO)).contents
                    mmi.ptMinTrackSize.x, mmi.ptMinTrackSize.y = 480, 270
                    return 0
                if msg == 0x0014:                           # WM_ERASEBKGND: we paint everything (no flicker)
                    return 1
                if msg == 0x000F:                           # WM_PAINT
                    paint(hwnd)
                    return 0
                if msg == 0x0005:                           # WM_SIZE
                    u32.InvalidateRect(hwnd, None, False)
                    return 0
                if msg == 0x0010:                           # WM_CLOSE
                    u32.DestroyWindow(hwnd)
                    return 0
                if msg == 0x0002:                           # WM_DESTROY
                    self.alive = False
                    u32.PostQuitMessage(0)
                    return 0
            except Exception as e:                          # never let a drawing problem crash the app
                print("Presentation window:", repr(e))
            return u32.DefWindowProcW(hwnd, msg, wp, lp)

        self._handler = wndproc                             # this window's handler (reached through _route)
        hinst = k32.GetModuleHandleW(None)
        with _CLASS["lock"]:
            if not _CLASS["registered"]:                    # once per app run; the handler is kept forever
                _CLASS["proc"] = WNDPROC(_route)
                wc = WNDCLASSEXW()
                wc.cbSize = ctypes.sizeof(WNDCLASSEXW)
                wc.style = 0x0008 | 0x0001 | 0x0002         # CS_DBLCLKS | CS_VREDRAW | CS_HREDRAW
                wc.lpfnWndProc = _CLASS["proc"]
                wc.hInstance = hinst
                wc.hCursor = u32.LoadCursorW(None, ctypes.c_void_p(32512))   # IDC_ARROW
                wc.hbrBackground = g32.GetStockObject(4)    # BLACK_BRUSH
                wc.lpszClassName = CLASS_NAME
                if not u32.RegisterClassExW(ctypes.byref(wc)):
                    raise OSError(f"RegisterClassEx failed ({k32.GetLastError()})")
                _CLASS["registered"] = True
        try:
            u32.GetDpiForSystem.restype = W.UINT
            s = max(1.0, u32.GetDpiForSystem() / 96.0)
        except Exception:
            s = 1.0
        w = min(int(1280 * s), int(u32.GetSystemMetrics(0) * 0.8))
        h = int(w * 9 / 16)
        x, y = (u32.GetSystemMetrics(0) - w) // 2, (u32.GetSystemMetrics(1) - h) // 2
        WS_POPUP, WS_THICKFRAME, WS_MINIMIZEBOX, WS_VISIBLE = 0x80000000, 0x00040000, 0x00020000, 0x10000000
        with _CLASS["lock"]:                                # only one window is created at a time
            _CLASS["creating"] = self
            try:
                self.hwnd = u32.CreateWindowExW(0x00040000, CLASS_NAME, TITLE,          # WS_EX_APPWINDOW: on the taskbar
                                                WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_VISIBLE,
                                                x, y, w, h, None, None, hinst, None)
            finally:
                _CLASS["creating"] = None
        if self.hwnd:
            _CLASS["windows"][self.hwnd] = self
        if not self.hwnd:
            raise OSError(f"CreateWindowEx failed ({k32.GetLastError()})")
        u32.SetWindowPos(self.hwnd, None, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0004 | 0x0020)   # apply the frameless style
        u32.SetForegroundWindow(self.hwnd)
        self.ready.set()
        msg = W.MSG()
        while u32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            u32.TranslateMessage(ctypes.byref(msg))
            u32.DispatchMessageW(ctypes.byref(msg))
        for k, v in list(_CLASS["windows"].items()):
            if v is self:
                _CLASS["windows"].pop(k, None)
        self._handler = None
