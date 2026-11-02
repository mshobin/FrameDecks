"""FrameDecks 8.8 - Capture: notices when the presenter copies text (Ctrl+C) while Capture is on.

Windows' own clipboard listener (AddClipboardFormatListener) on a message-only window, on its own thread. It is passive:
no keyboard or mouse hook and no simulated keys, so it looks like any clipboard manager to Windows and to antivirus.
Only started while the Audience Dock's Capture switch is on; stop() removes the listener and ends the thread.

A copy is skipped when:
  * the program that made it asked clipboard tools to leave it alone (password managers mark secrets with
    "ExcludeClipboardContentFromMonitorProcessing", "CanIncludeInClipboardHistory" = 0 or "Clipboard Viewer Ignore");
  * FrameDecks itself made it;
  * it has no text.
Otherwise on_copy(text, exe, url) gets the text, the program in front (e.g. C:\\...\\Zoom.exe) and, for a browser, the
web page it came from (the SourceURL of the copied HTML). audience.py decides what becomes a card.

On other systems start() returns False and nothing runs (the dock still accepts typed questions).
"""
from errlog import swallowed as _swallowed  # noqa: E402
import ctypes
import os
import sys
import threading
import time

IS_WIN = sys.platform == "win32"
WM_CLIPBOARDUPDATE, WM_CLOSE, WM_DESTROY = 0x031D, 0x0010, 0x0002
CF_UNICODETEXT = 13
SKIP_FORMATS = ("ExcludeClipboardContentFromMonitorProcessing", "Clipboard Viewer Ignore")

if IS_WIN:
    from ctypes import wintypes

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    LRESULT = ctypes.c_ssize_t
    WNDPROC = ctypes.WINFUNCTYPE(LRESULT, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)

    class WNDCLASSW(ctypes.Structure):
        _fields_ = [("style", wintypes.UINT), ("lpfnWndProc", WNDPROC), ("cbClsExtra", ctypes.c_int), ("cbWndExtra", ctypes.c_int),
                    ("hInstance", wintypes.HINSTANCE), ("hIcon", wintypes.HICON), ("hCursor", wintypes.HANDLE),
                    ("hbrBackground", wintypes.HBRUSH), ("lpszMenuName", wintypes.LPCWSTR), ("lpszClassName", wintypes.LPCWSTR)]

    user32.DefWindowProcW.restype = LRESULT
    user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.RegisterClassW.argtypes = [ctypes.POINTER(WNDCLASSW)]
    user32.CreateWindowExW.restype = wintypes.HWND
    user32.CreateWindowExW.argtypes = [wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD, ctypes.c_int, ctypes.c_int,
                                       ctypes.c_int, ctypes.c_int, wintypes.HWND, wintypes.HMENU, wintypes.HINSTANCE, wintypes.LPVOID]
    user32.AddClipboardFormatListener.argtypes = [wintypes.HWND]
    user32.RemoveClipboardFormatListener.argtypes = [wintypes.HWND]
    user32.OpenClipboard.argtypes = [wintypes.HWND]
    user32.GetClipboardData.restype = wintypes.HANDLE
    user32.GetClipboardData.argtypes = [wintypes.UINT]
    user32.IsClipboardFormatAvailable.argtypes = [wintypes.UINT]
    user32.RegisterClipboardFormatW.restype = wintypes.UINT
    user32.RegisterClipboardFormatW.argtypes = [wintypes.LPCWSTR]
    user32.GetClipboardOwner.restype = wintypes.HWND
    user32.GetForegroundWindow.restype = wintypes.HWND
    user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.DestroyWindow.argtypes = [wintypes.HWND]
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalSize.restype = ctypes.c_size_t
    kernel32.GlobalSize.argtypes = [wintypes.HGLOBAL]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.GetModuleHandleW.restype = wintypes.HMODULE
    kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]


def source_url(html):
    """The SourceURL line of Windows' "HTML Format" clipboard text (browsers write the page the text came from)."""
    for line in str(html or "").splitlines()[:20]:
        if line.lower().startswith("sourceurl:"):
            return line.split(":", 1)[1].strip()
    return ""


def _pid_of(hwnd):
    pid = wintypes.DWORD(0)
    if hwnd:
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return pid.value


def _exe_of(pid):
    if not pid:
        return ""
    h = kernel32.OpenProcess(0x1000, False, pid)              # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return ""
    try:
        buf, size = ctypes.create_unicode_buffer(520), wintypes.DWORD(520)
        return buf.value if kernel32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size)) else ""
    finally:
        kernel32.CloseHandle(h)


def _data(fmt):
    h = user32.GetClipboardData(fmt)
    if not h:
        return None
    p = kernel32.GlobalLock(h)
    if not p:
        return None
    try:
        return ctypes.string_at(p, kernel32.GlobalSize(h))
    finally:
        kernel32.GlobalUnlock(h)


class ClipboardWatcher:
    def __init__(self, on_copy):
        self.on_copy = on_copy
        self.hwnd, self._thread, self._proc = None, None, None
        self.running = False

    def start(self):
        if not IS_WIN:
            return False
        if self.running:
            return True
        ready = threading.Event()
        self._thread = threading.Thread(target=self._loop, args=(ready,), name="kc-capture", daemon=True)
        self._thread.start()
        ready.wait(2)
        return self.running

    def stop(self):
        if IS_WIN and self.hwnd:
            user32.PostMessageW(self.hwnd, WM_CLOSE, 0, 0)       # the window's own thread removes the listener
        self.running = False

    # ---------- the message-only window ----------
    def _loop(self, ready):
        try:
            self._proc = WNDPROC(self._wndproc)                  # kept on self: the callback must outlive the window
            cls = WNDCLASSW()
            cls.lpfnWndProc = self._proc
            cls.hInstance = kernel32.GetModuleHandleW(None)
            cls.lpszClassName = "FrameDecksCapture"
            user32.RegisterClassW(ctypes.byref(cls))             # a second start reuses the registered class
            self.hwnd = user32.CreateWindowExW(0, "FrameDecksCapture", "FrameDecks Capture", 0, 0, 0, 0, 0,
                                               wintypes.HWND(-3), None, cls.hInstance, None)   # HWND_MESSAGE
            if not self.hwnd or not user32.AddClipboardFormatListener(self.hwnd):
                print("Capture: the clipboard listener could not start (", ctypes.get_last_error(), ")")
                ready.set()
                return
            self.running = True
            ready.set()
            msg = wintypes.MSG()
            while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
        except Exception as e:
            print("Capture:", e)
        finally:
            self.running, self.hwnd = False, None
            ready.set()

    def _wndproc(self, hwnd, msg, wparam, lparam):
        if msg == WM_CLIPBOARDUPDATE:
            try:
                self._read(hwnd)
            except Exception as _e:
                _swallowed("capture.read", _e)
            return 0
        if msg == WM_CLOSE:
            user32.RemoveClipboardFormatListener(hwnd)
            user32.DestroyWindow(hwnd)
            return 0
        if msg == WM_DESTROY:
            user32.PostQuitMessage(0)
            return 0
        return user32.DefWindowProcW(hwnd, msg, wparam, lparam)

    def _read(self, hwnd):
        me = os.getpid()
        if _pid_of(user32.GetClipboardOwner()) == me:           # FrameDecks' own copy (a card, a setting)
            return
        exe = _exe_of(_pid_of(user32.GetForegroundWindow()))
        for _ in range(10):                                      # another program may hold the clipboard for a moment
            if user32.OpenClipboard(hwnd):
                break
            time.sleep(0.02)
        else:
            return
        try:
            for name in SKIP_FORMATS:
                if user32.IsClipboardFormatAvailable(user32.RegisterClipboardFormatW(name)):
                    return
            hist = user32.RegisterClipboardFormatW("CanIncludeInClipboardHistory")
            if user32.IsClipboardFormatAvailable(hist):
                raw = _data(hist)
                if raw and len(raw) >= 4 and int.from_bytes(raw[:4], "little") == 0:
                    return
            if not user32.IsClipboardFormatAvailable(CF_UNICODETEXT):
                return
            raw = _data(CF_UNICODETEXT) or b""
            text = raw.decode("utf-16-le", "ignore").split("\x00", 1)[0]
            html_fmt = user32.RegisterClipboardFormatW("HTML Format")
            html = (_data(html_fmt) or b"")[:4000].decode("utf-8", "ignore") if user32.IsClipboardFormatAvailable(html_fmt) else ""
        finally:
            user32.CloseClipboard()
        if text.strip():
            self.on_copy(text, exe, source_url(html))
