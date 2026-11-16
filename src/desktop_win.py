"""FrameDecks 6.8 - Windows window features, in one place (ctypes only; no new packages).

  * mouse_move_or_size()   move the window, or resize it from an edge, following the mouse (on the UI thread)
  * Chrome(hwnd)            the app's own ribbon instead of the Windows title bar, keeping everything Windows does for a
                            normal window: resizing from the edges, Snap, the maximize animation, the shadow, Alt+Tab.
                            (WM_NCCALCSIZE gives the caption back to the page; the sizing frame stays.)
  * glass(hwnd, frost)      see-through window: the page's transparent pixels show the windows behind it (Zoom, Teams,
                            PowerPoint...). frost=True adds the Windows blur (Acrylic on Windows 11, blur on Windows 10).
  * fade(hwnd, alpha)       compatibility transparency: the whole window, text included, at one opacity.
  * hide_from_capture(hwnd) screen sharing and recording never show the window (Windows 10 2004 and later); older
                            Windows shows it black in captures instead.
  * center_on_cursor(hwnd)  centre a window on the monitor the mouse is on.
  * bring_to_front(hwnd)    show and focus a window, also when another program is in front.
  * Hotkeys(callback)       system-wide shortcuts (RegisterHotKey) that work while FrameDecks is in the tray.

Every function does nothing on other systems and never raises: if Windows refuses something, the window simply keeps
the standard look and behaviour.
"""
from errlog import swallowed as _swallowed  # noqa: E402
import ctypes
import sys
import threading

IS_WIN = sys.platform == "win32"

# ---------- shortcut text <-> RegisterHotKey values (pure, tested on every system) ----------
MODS = {"ctrl": 0x0002, "alt": 0x0001, "shift": 0x0004, "win": 0x0008}
MOD_NOREPEAT = 0x4000
NAMED_KEYS = {"space": 0x20, "enter": 0x0D, "tab": 0x09, "pageup": 0x21, "pagedown": 0x22, "home": 0x24, "end": 0x23,
              "insert": 0x2D, "delete": 0x2E, "backquote": 0xC0, "`": 0xC0}
NAMED_KEYS.update({"f%d" % i: 0x6F + i for i in range(1, 13)})


def key_down(vk):
    """26.11.20 is this key held right now (Voice commands' hold to talk: Right Ctrl or F8), whatever window is in
    front. Read only while voice commands are on and a Frame is live."""
    if not IS_WIN:
        return False
    try:
        return bool(user32.GetAsyncKeyState(int(vk)) & 0x8000)
    except Exception:
        return False


def parse_hotkey(text):
    """'Ctrl+Alt+Space' -> (modifiers, virtual key) or None. Needs at least one of Ctrl, Alt or Win (a plain key or
    Shift+key would take that key away from every other program)."""
    parts = [p.strip().lower() for p in str(text or "").split("+") if p.strip()]
    if len(parts) < 2:
        return None
    mods = 0
    for p in parts[:-1]:
        if p not in MODS:
            return None
        mods |= MODS[p]
    key = parts[-1]
    if not mods & (MODS["ctrl"] | MODS["alt"] | MODS["win"]):
        return None
    if key in NAMED_KEYS:
        vk = NAMED_KEYS[key]
    elif len(key) == 1 and key.isalnum():
        vk = ord(key.upper())
    else:
        return None
    return mods, vk


def format_hotkey(text):
    """Normalised spelling, e.g. 'alt+space' -> 'Alt+Space'."""
    parsed = parse_hotkey(text)
    if not parsed:
        return ""
    mods, vk = parsed
    names = [n for n, m in (("Ctrl", 2), ("Alt", 1), ("Shift", 4), ("Win", 8)) if mods & m]
    key = next((k for k, v in NAMED_KEYS.items() if v == vk and k != "`"), None)
    key = key.capitalize() if key and not key.startswith("f") else (key.upper() if key else chr(vk))
    return "+".join(names + [key])


if IS_WIN:
    from ctypes import wintypes

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    dwmapi = ctypes.WinDLL("dwmapi")
    gdi32 = ctypes.WinDLL("gdi32")
    kernel32 = ctypes.WinDLL("kernel32")

    LRESULT = ctypes.c_ssize_t
    WNDPROC = ctypes.WINFUNCTYPE(LRESULT, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)
    _get_long = getattr(user32, "GetWindowLongPtrW", user32.GetWindowLongW)
    _set_long = getattr(user32, "SetWindowLongPtrW", user32.SetWindowLongW)
    _get_long.restype = ctypes.c_ssize_t
    _get_long.argtypes = [wintypes.HWND, ctypes.c_int]
    _set_long.restype = ctypes.c_ssize_t
    _set_long.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_ssize_t]
    user32.CallWindowProcW.restype = LRESULT
    user32.CallWindowProcW.argtypes = [ctypes.c_ssize_t, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]
    user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.SendMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.SendMessageW.restype = LRESULT
    user32.IsZoomed.argtypes = [wintypes.HWND]
    user32.ShowWindowAsync.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.GetAsyncKeyState.restype = ctypes.c_short
    user32.GetAsyncKeyState.argtypes = [ctypes.c_int]
    user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
    user32.MonitorFromPoint.restype = wintypes.HMONITOR
    user32.MonitorFromPoint.argtypes = [wintypes.POINT, wintypes.DWORD]
    dwmapi.DwmSetWindowAttribute.argtypes = [wintypes.HWND, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD]
    gdi32.CreateRoundRectRgn.restype = wintypes.HRGN                      # 26.11.5 the Command Center's shape (clip)
    gdi32.CreateRoundRectRgn.argtypes = [ctypes.c_int] * 6
    gdi32.CombineRgn.argtypes = [wintypes.HRGN, wintypes.HRGN, wintypes.HRGN, ctypes.c_int]
    user32.SetWindowRgn.argtypes = [wintypes.HWND, wintypes.HRGN, wintypes.BOOL]
    # 26.11.19 a region handle can have its top bit set (Windows reuses handle slots, and each reuse counts up): passed
    # undeclared it raised "int too long to convert", clip() gave up before SetWindowRgn, and the Command Center kept
    # an old shape or none at all (the black box). Every GDI call that takes a handle is declared.
    gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
    gdi32.DeleteObject.restype = wintypes.BOOL
    gdi32.CreateRectRgn.argtypes = [ctypes.c_int] * 4
    gdi32.CreateRectRgn.restype = wintypes.HRGN

    class NCCALCSIZE_PARAMS(ctypes.Structure):
        _fields_ = [("rgrc", wintypes.RECT * 3), ("lppos", ctypes.c_void_p)]

    class MARGINS(ctypes.Structure):
        _fields_ = [("left", ctypes.c_int), ("right", ctypes.c_int), ("top", ctypes.c_int), ("bottom", ctypes.c_int)]

    class DWM_BLURBEHIND(ctypes.Structure):
        _fields_ = [("dwFlags", wintypes.DWORD), ("fEnable", wintypes.BOOL), ("hRgnBlur", wintypes.HRGN),
                    ("fTransitionOnMaximized", wintypes.BOOL)]

    class ACCENT_POLICY(ctypes.Structure):
        _fields_ = [("AccentState", ctypes.c_int), ("AccentFlags", ctypes.c_int), ("GradientColor", ctypes.c_uint),
                    ("AnimationId", ctypes.c_int)]

    class WINCOMPATTRDATA(ctypes.Structure):
        _fields_ = [("Attribute", ctypes.c_int), ("Data", ctypes.c_void_p), ("SizeOfData", ctypes.c_size_t)]

    class MONITORINFO(ctypes.Structure):
        _fields_ = [("cbSize", wintypes.DWORD), ("rcMonitor", wintypes.RECT), ("rcWork", wintypes.RECT), ("dwFlags", wintypes.DWORD)]

WM_NCCALCSIZE, WM_SYSCOMMAND, WM_HOTKEY, WM_APP = 0x0083, 0x0112, 0x0312, 0x8000
GWL_STYLE, GWL_EXSTYLE, GWLP_WNDPROC = -16, -20, -4
WS_CAPTION, WS_THICKFRAME, WS_SYSMENU, WS_MINIMIZEBOX, WS_MAXIMIZEBOX = 0x00C00000, 0x00040000, 0x00080000, 0x00020000, 0x00010000
WS_EX_LAYERED = 0x00080000
SWP_FRAMECHANGED, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SWP_NOACTIVATE = 0x0020, 0x0002, 0x0001, 0x0004, 0x0010
SC_DRAGMOVE = 0xF012


def windows_build():
    if not IS_WIN:
        return 0
    try:
        return sys.getwindowsversion().build
    except Exception:
        return 0


def _frame_changed(hwnd):
    user32.SetWindowPos(hwnd, None, 0, 0, 0, 0, SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE)


class Chrome:
    """Removes the Windows title bar from a window but keeps its sizing frame, so the window still resizes from its
    edges, snaps, maximizes with the usual animation and keeps its shadow. The page draws the ribbon (drag area and
    window buttons, see app/js/window-chrome.js) and moves the window with drag()."""

    def __init__(self, hwnd):
        self.hwnd, self.ok, self._old = hwnd, False, None
        if not (IS_WIN and hwnd):
            return
        try:
            style = _get_long(hwnd, GWL_STYLE)
            _set_long(hwnd, GWL_STYLE, style | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_CAPTION)
            self._proc = WNDPROC(self._wndproc)        # kept on self: the callback must outlive the window
            self._old = _set_long(hwnd, GWLP_WNDPROC, ctypes.cast(self._proc, ctypes.c_void_p).value)
            self.ok = bool(self._old)
            _frame_changed(hwnd)
        except Exception as e:
            print("Window chrome: kept the Windows title bar:", e)
            self.ok = False

    def _frame_y(self):
        try:
            dpi = user32.GetDpiForWindow(self.hwnd)
            return user32.GetSystemMetricsForDpi(33, dpi) + user32.GetSystemMetricsForDpi(92, dpi)  # SM_CYFRAME + padding
        except Exception:
            return user32.GetSystemMetrics(33) + user32.GetSystemMetrics(92)

    def _wndproc(self, hwnd, msg, wparam, lparam):
        if msg == WM_NCCALCSIZE and wparam:
            # Let Windows size the frame, then give the caption strip back to the page. Maximized windows overhang the
            # screen by the frame thickness, so the top then keeps that much.
            p = NCCALCSIZE_PARAMS.from_address(lparam)
            top = p.rgrc[0].top
            res = user32.CallWindowProcW(self._old, hwnd, msg, wparam, lparam)
            p.rgrc[0].top = top + (self._frame_y() if user32.IsZoomed(hwnd) else 0)
            return res
        return user32.CallWindowProcW(self._old, hwnd, msg, wparam, lparam)

    def drag(self, form=None):
        """Start moving the window with the mouse (the page asks when the ribbon is pressed and moved). Windows runs the
        move, so Snap and dragging to the top to maximize work as usual."""
        return mouse_move_or_size(form, self.hwnd, "caption")


HIT = {"caption": 2, "left": 10, "right": 11, "top": 12, "topleft": 13, "topright": 14, "bottom": 15,
       "bottomleft": 16, "bottomright": 17}
WM_NCLBUTTONDOWN = 0x00A1


def mouse_move_or_size(form, hwnd, edge="caption"):
    """Let Windows move the window (edge 'caption') or resize it from an edge or corner, following the mouse, exactly
    as if the title bar or the border had been pressed. This must happen on the window's own UI thread (that is where
    the mouse is captured), so it is handed to WinForms with BeginInvoke; posting from another thread is the fallback.
    Works for every window: frameless, see-through or faded."""
    if not (IS_WIN and hwnd) or edge not in HIT:
        return False
    code = HIT[edge]

    def run():
        try:
            pt = wintypes.POINT()
            user32.GetCursorPos(ctypes.byref(pt))
            user32.ReleaseCapture()
            user32.SendMessageW(hwnd, WM_NCLBUTTONDOWN, code, (pt.y & 0xFFFF) << 16 | (pt.x & 0xFFFF))
        except Exception as e:
            print("Window move / resize:", e)
    if form is not None:
        try:
            from System import Action                         # pythonnet (pywebview's WinForms window)
            form.BeginInvoke(Action(run))
            return True
        except Exception as _e:
            _swallowed("desktop_win.mouse_move_or_size", _e)
    try:
        pt = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        user32.ReleaseCapture()
        user32.PostMessageW(hwnd, WM_NCLBUTTONDOWN, code, (pt.y & 0xFFFF) << 16 | (pt.x & 0xFFFF))
        return True
    except Exception:
        return False


def drag(hwnd, form=None):
    """Move any window with the mouse (also windows without Chrome)."""
    return mouse_move_or_size(form, hwnd, "caption")


def glass(hwnd, frost=False):
    """See-through window. The page paints its own translucent background (rgba), so the text stays fully opaque while
    Zoom or Teams shows behind it. frost adds the Windows blur behind the window."""
    if not (IS_WIN and hwnd):
        return False
    try:
        rgn = gdi32.CreateRectRgn(0, 0, -1, -1)              # an empty region: per-pixel transparency, no blur
        bb = DWM_BLURBEHIND(0x1 | 0x2, True, rgn, False)       # DWM_BB_ENABLE | DWM_BB_BLURREGION
        dwmapi.DwmEnableBlurBehindWindow(hwnd, ctypes.byref(bb))
        _free(rgn)
        build = windows_build()
        if build >= 22621:                                     # Windows 11 22H2: the system backdrop
            m = MARGINS(-1, -1, -1, -1)
            dwmapi.DwmExtendFrameIntoClientArea(hwnd, ctypes.byref(m))
            kind = ctypes.c_int(3 if frost else 1)             # DWMSBT_TRANSIENTWINDOW (Acrylic) / DWMSBT_NONE
            dwmapi.DwmSetWindowAttribute(hwnd, 38, ctypes.byref(kind), ctypes.sizeof(kind))
        else:                                                  # Windows 10 / early 11: blur behind (no tint, no lag)
            accent = ACCENT_POLICY(3 if frost else 0, 0, 0, 0)  # ACCENT_ENABLE_BLURBEHIND / ACCENT_DISABLED
            data = WINCOMPATTRDATA(19, ctypes.cast(ctypes.pointer(accent), ctypes.c_void_p), ctypes.sizeof(accent))
            fn = getattr(user32, "SetWindowCompositionAttribute", None)
            if fn:
                fn(hwnd, ctypes.byref(data))
        return True
    except Exception as e:
        print("Glass window:", e)
        return False


def fade(hwnd, alpha):
    """Compatibility transparency: the whole window at one opacity (0.15-1)."""
    if not (IS_WIN and hwnd):
        return False
    try:
        a = max(38, min(255, int(round(float(alpha) * 255))))
        ex = _get_long(hwnd, GWL_EXSTYLE)
        if a >= 255:
            if ex & WS_EX_LAYERED:
                _set_long(hwnd, GWL_EXSTYLE, ex & ~WS_EX_LAYERED)
            return True
        if not ex & WS_EX_LAYERED:
            _set_long(hwnd, GWL_EXSTYLE, ex | WS_EX_LAYERED)
        return bool(user32.SetLayeredWindowAttributes(hwnd, 0, a, 0x2))   # LWA_ALPHA
    except Exception:
        return False


def hide_from_capture(hwnd, on=True):
    """Screen sharing (Zoom, Teams, Meet, OBS) and recordings leave the window out."""
    if not (IS_WIN and hwnd):
        return False
    try:
        if not on:
            return bool(user32.SetWindowDisplayAffinity(hwnd, 0))
        return bool(user32.SetWindowDisplayAffinity(hwnd, 0x11) or user32.SetWindowDisplayAffinity(hwnd, 0x1))
    except Exception:
        return False


def center_on_cursor(hwnd, top_third=True, where=None):
    """Centre the window on the monitor the mouse is on (Spotlight opens where you are looking).
    9.12 where: "top" (a third of the way down), "centre", or "bottom" (its bottom edge on the taskbar's edge: the
    Command Center draws itself at the bottom of its see-through window then)."""
    if not (IS_WIN and hwnd):
        return
    try:
        pt = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        mon = user32.MonitorFromPoint(pt, 2)                   # MONITOR_DEFAULTTONEAREST
        mi = MONITORINFO()
        mi.cbSize = ctypes.sizeof(MONITORINFO)
        user32.GetMonitorInfoW(mon, ctypes.byref(mi))
        r = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(r))
        w, h = r.right - r.left, r.bottom - r.top
        wa = mi.rcWork
        x = wa.left + (wa.right - wa.left - w) // 2
        y = spot_y(wa.top, wa.bottom, h, where or ("top" if top_third else "centre"))
        user32.SetWindowPos(hwnd, None, x, max(wa.top, y), 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE)
    except Exception as _e:
        _swallowed("desktop_win.center_on_cursor", _e)


def spot_y(top, bottom, h, where):
    """The window's top edge for a place on a work area from top to bottom (screen pixels), never above the top and
    (26.11.42) never so low that its bottom goes past the work area's bottom, where its panel would be cut off."""
    tall = bottom - top
    if where == "bottom":
        y = bottom - h
    elif where == "centre":
        y = top + tall * 2 // 5 - h // 8          # the bar a little above the middle, its panel opening below
    else:
        y = top + tall // 4 - h // 6
    return max(top, min(y, bottom - h))       # 26.11.42 and never below the taskbar: its panel stays on the screen


def round_corners(hwnd):
    """Windows 11: rounded corners for a borderless window (Windows 10 keeps square corners)."""
    if not (IS_WIN and hwnd):
        return
    try:
        pref = ctypes.c_int(2)                                 # DWMWCP_ROUND
        dwmapi.DwmSetWindowAttribute(hwnd, 33, ctypes.byref(pref), ctypes.sizeof(pref))
    except Exception as _e:
        _swallowed("desktop_win.round_corners", _e)


def clear_back(form, wait=False):
    """9.10.1 pywebview makes the page of a transparent window see-through but leaves the WinForms form behind it in
    its default light grey (SystemColors.Control), which showed as a grey box around the Command Center. Black is
    what Windows treats as see-through on a window whose frame is extended into it (desktop_win.glass), so the form
    is painted black, on its own thread. 9.10.2: wait=True finishes before returning, so it is done before the window
    is first shown."""
    if not (IS_WIN and form is not None):
        return False
    try:
        from System import Action                             # pythonnet (pywebview's WinForms window)
        from System.Drawing import Color

        def run():
            try:                                              # 26.11.3 not a layered window (see unlayer)
                form.AllowTransparency = False
            except Exception as _e:
                _swallowed("desktop_win.clear_back", _e)
            form.BackColor = Color.Black
            form.Invalidate()
        if not form.InvokeRequired:
            run()
        elif wait:
            form.Invoke(Action(run))
        else:
            form.BeginInvoke(Action(run))
        return True
    except Exception as _e:
        _swallowed("desktop_win.clear_back", _e)
        return False


def unlayer(hwnd):
    """26.11.3 the Command Center showed a black box behind its glass over the desktop (it hid against the dark
    Studio). pywebview makes a hidden window by setting its opacity to 0, showing it, hiding it and setting the
    opacity back to 1; that leaves it a layered window (WS_EX_LAYERED), and Windows draws a layered window with one
    opacity for the whole box, so the black form behind the page (clear_back) stayed black instead of see-through.
    Taking the style off hands the window back to the desktop's per-pixel see-through (glass)."""
    if not (IS_WIN and hwnd):
        return False
    try:
        ex = _get_long(hwnd, GWL_EXSTYLE)
        if ex & WS_EX_LAYERED:
            _set_long(hwnd, GWL_EXSTYLE, ex & ~WS_EX_LAYERED)
            user32.SetWindowPos(hwnd, None, 0, 0, 0, 0,
                                SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE)
        return True
    except Exception as _e:
        _swallowed("desktop_win.unlayer", _e)
        return False


MAX_SHAPES = 96                     # 26.11.16 room for the waterfall curves, traced at 1 px


def shape_boxes(rects, scale=1.0):
    """26.11.5 the page's painted boxes (CSS pixels: x, y, w, h, corner radius) as whole device pixels, rounded outward
    so no edge pixel is cut. Anything malformed is left out."""
    out = []
    try:
        scale = min(4.0, max(0.5, float(scale or 1.0)))
    except (TypeError, ValueError):
        scale = 1.0
    for r in (rects or [])[:MAX_SHAPES]:
        try:
            x, y, w, h = (float(v) for v in r[:4])
            rad = float(r[4]) if len(r) > 4 else 0.0
        except (TypeError, ValueError, IndexError):
            continue
        if w <= 0 or h <= 0 or w > 10000 or h > 10000:
            continue
        x1, y1 = int(x * scale), int(y * scale)
        x2, y2 = int((x + w) * scale + 0.999), int((y + h) * scale + 0.999)
        d = int(max(0.0, min(rad, w / 2, h / 2)) * 2 * scale)
        out.append((x1, y1, x2, y2, d))
    return out


def clip(hwnd, rects, scale=1.0):
    """26.11.5 the Command Center's window takes exactly the shape of what the page draws (the bar, the chips, an open
    panel, Keep open) with Windows' window region. Outside it there is no window at all, so nothing can paint a grey or
    black box there whatever the PC's graphics do with see-through windows, and clicks there go to the window behind.
    An empty list puts the whole window back."""
    if not (IS_WIN and hwnd):
        return False
    try:
        boxes = shape_boxes(rects, scale)
        if not boxes:
            return bool(user32.SetWindowRgn(hwnd, None, True))
        rgn = None
        for x1, y1, x2, y2, d in boxes:
            part = gdi32.CreateRoundRectRgn(x1, y1, x2 + 1, y2 + 1, d, d)
            if not part:
                continue
            if rgn is None:
                rgn = part
            else:
                gdi32.CombineRgn(rgn, rgn, part, 2)             # RGN_OR
                _free(part)
        if rgn is None:
            return False
        if not user32.SetWindowRgn(hwnd, rgn, True):            # the window owns the region from here on
            _free(rgn)
            _swallowed("desktop_win.clip", OSError("SetWindowRgn refused the shape"))
            return False
        return True
    except Exception as _e:
        _swallowed("desktop_win.clip", _e)
        return False


def _free(obj):
    """26.11.19 letting go of a GDI object can never cost the shape (see the declarations at the top)."""
    try:
        gdi32.DeleteObject(obj)
    except Exception as _e:
        _swallowed("desktop_win.free", _e)


def clear_frame(hwnd):
    """9.10 a window with no frame at all (the Command Center): Windows 11 draws neither rounded corners nor its thin
    border line around it, so only the page's own shapes show (Windows 10 has neither anyway)."""
    if not (IS_WIN and hwnd):
        return
    try:
        pref = ctypes.c_int(1)                                 # DWMWCP_DONOTROUND
        dwmapi.DwmSetWindowAttribute(hwnd, 33, ctypes.byref(pref), ctypes.sizeof(pref))
        none = ctypes.c_uint(0xFFFFFFFE)                       # DWMWA_BORDER_COLOR = DWMWA_COLOR_NONE
        dwmapi.DwmSetWindowAttribute(hwnd, 34, ctypes.byref(none), ctypes.sizeof(none))
    except Exception as _e:
        _swallowed("desktop_win.clear_frame", _e)


SWP_ASYNCWINDOWPOS = 0x4000
HWND_TOPMOST, HWND_NOTOPMOST = -1, -2


def set_topmost(hwnd, on):
    """Keep a window above others, or let it go back among them. SWP_ASYNCWINDOWPOS posts the change to the window's own
    thread instead of waiting for it: the caller (a web request) never blocks on the window, so the program cannot hang
    (6.11: pywebview's on_top setter waited on the window's thread and froze the program on "unpin")."""
    if not (IS_WIN and hwnd):
        return False
    try:
        return bool(user32.SetWindowPos(hwnd, wintypes.HWND(HWND_TOPMOST if on else HWND_NOTOPMOST), 0, 0, 0, 0,
                                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS))
    except Exception:
        return False


SW_HIDE, SW_MAXIMIZE, SW_MINIMIZE, SW_RESTORE = 0, 3, 6, 9


def show_async(hwnd, command):
    """Minimise, maximise or restore a window without waiting for its thread (ShowWindowAsync posts the request), so
    a web request asking for it never blocks on the window (production audit M9, like set_topmost)."""
    if not (IS_WIN and hwnd):
        return False
    try:
        user32.ShowWindowAsync(hwnd, command)                # returns the old visibility, not success
        return True
    except Exception as _e:
        _swallowed("desktop_win.show_async", _e)
        return False


def bring_to_front(hwnd):
    if not (IS_WIN and hwnd):
        return
    try:
        user32.AllowSetForegroundWindow(-1)                    # ASFW_ANY
        user32.ShowWindow(hwnd, 5)                             # SW_SHOW
        user32.SetForegroundWindow(hwnd)
        user32.SetActiveWindow(hwnd)
    except Exception as _e:
        _swallowed("desktop_win.bring_to_front", _e)


# ---------- 9.0 the Chat Bubble popup (8.8.1: placed in screen pixels, never taking the keyboard) ----------
def place(hwnd, x, y, w=None, h=None):
    """Move (and size) a window without activating it and without waiting for its thread."""
    if not (IS_WIN and hwnd):
        return False
    try:
        flags = SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS | (SWP_NOSIZE if w is None else 0)
        return bool(user32.SetWindowPos(hwnd, None, int(x), int(y), int(w or 0), int(h or 0), flags))
    except Exception:
        return False


def display_scale(hwnd=None):
    """The display scale (1.0 = 100 %, 1.5 = 150 %) of a window, or of the main screen."""
    if not IS_WIN:
        return 1.0
    try:
        dpi = user32.GetDpiForWindow(hwnd) if hwnd else user32.GetDpiForSystem()
        return dpi / 96.0 if dpi else 1.0
    except Exception:
        return 1.0


def show_no_activate(hwnd):
    """Show a window (also one that was hidden or off-screen) without taking the keyboard from the program in front."""
    return show_async(hwnd, 4)                                 # SW_SHOWNOACTIVATE


def work_area():
    """[x, y, w, h] of the main screen without the taskbar."""
    if not IS_WIN:
        return None
    try:
        r = wintypes.RECT()
        user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(r), 0)      # SPI_GETWORKAREA
        return [r.left, r.top, r.right - r.left, r.bottom - r.top]
    except Exception:
        return None


class Hotkeys:
    """System-wide shortcuts. RegisterHotKey needs one thread with a message loop; set() re-registers from any thread.
    callback(name) runs on that thread. results holds, per name, the shortcut in use or why it could not be used."""

    def __init__(self, callback):
        self.callback, self.wanted, self.results = callback, {}, {}
        self._ids, self._tid, self._ready, self._lock, self._next = {}, 0, threading.Event(), threading.Lock(), 0xB001
        if IS_WIN:
            threading.Thread(target=self._loop, name="kc-hotkeys", daemon=True).start()
            self._ready.wait(2)

    def set(self, name, shortcut):
        """Use shortcut (e.g. 'Alt+Space') for name; '' turns it off. Returns the result text."""
        self.wanted[name] = shortcut or ""
        if not IS_WIN:
            self.results[name] = "Only on Windows"
            return self.results[name]
        with self._lock:                                       # one change at a time
            done = threading.Event()
            self._pending = (name, done)
            user32.PostThreadMessageW(self._tid, WM_APP + 1, 0, 0)
            done.wait(2)
        return self.results.get(name, "")

    def _register(self, name):
        old = self._ids.pop(name, None)
        if old:
            user32.UnregisterHotKey(None, old)
        text = self.wanted.get(name, "")
        if not text:
            self.results[name] = "off"
            return
        parsed = parse_hotkey(text)
        if not parsed:
            self.results[name] = "not a valid shortcut"
            return
        hid, self._next = self._next, self._next + 1
        if user32.RegisterHotKey(None, hid, parsed[0] | MOD_NOREPEAT, parsed[1]):
            self._ids[name] = hid
            self.results[name] = "ok"
        else:
            self.results[name] = "in use by another program"

    def _loop(self):
        self._tid = kernel32.GetCurrentThreadId()
        msg = wintypes.MSG()
        user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 0)    # create this thread's message queue
        self._ready.set()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            if msg.message == WM_APP + 1:
                name, done = getattr(self, "_pending", (None, None))
                if name:
                    self._register(name)
                if done:
                    done.set()
            elif msg.message == WM_HOTKEY:
                name = next((n for n, i in self._ids.items() if i == msg.wParam), None)
                if name:
                    try:
                        self.callback(name)
                    except Exception as e:
                        print("Shortcut", name, "failed:", e)
