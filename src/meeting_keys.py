"""FrameDecks 9.6 - the meeting app from Spotlight: mute, camera, share screen and leave in Zoom, Microsoft Teams or
Google Meet, and the PC's volume.

There is no common API for these apps, so FrameDecks presses each app's own published keyboard shortcut in its
meeting window and then gives the focus back to the window you were in. The PC's volume uses Windows' own volume
keys. Windows only; elsewhere available() is False and nothing is sent.

Shortcuts (from each app's keyboard-shortcut help):
    Zoom:   mute Alt+A · camera Alt+V · share Alt+S · leave Alt+Q (Zoom asks to confirm)
    Teams:  mute Ctrl+Shift+M · camera Ctrl+Shift+O · share Ctrl+Shift+E · leave Ctrl+Shift+H
    Meet:   mute Ctrl+D · camera Ctrl+E (no shortcut for sharing or leaving)
"""
import os
import re
import time

APPS = (
    ("zoom", "Zoom", {"mute": "Alt+A", "camera": "Alt+V", "share": "Alt+S", "leave": "Alt+Q"}),
    ("teams", "Microsoft Teams", {"mute": "Ctrl+Shift+M", "camera": "Ctrl+Shift+O", "share": "Ctrl+Shift+E", "leave": "Ctrl+Shift+H"}),
    ("meet", "Google Meet", {"mute": "Ctrl+D", "camera": "Ctrl+E"}),
)
ACTS = ("mute", "camera", "share", "leave")
VOLUME = {"vol-up": 0xAF, "vol-down": 0xAE, "vol-mute": 0xAD}      # VK_VOLUME_UP / DOWN / MUTE
BROWSERS = ("chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe", "vivaldi.exe", "arc.exe")
MODS = {"ctrl": 0x11, "shift": 0x10, "alt": 0x12}


def classify(title, exe, cls=""):
    """Which meeting app a window belongs to (or None), from its title, program file and class.
    A meeting window first; the app's other windows only when no meeting window is open (see find)."""
    t, e = (title or "").strip(), re.split(r"[\\/]", exe or "")[-1].lower()
    if e == "zoom.exe":
        meeting = cls in ("ZPContentViewWndClass", "ConfMultiTabContentWndClass") or t.startswith("Zoom Meeting") or t.startswith("Zoom Webinar")
        return ("zoom", meeting)
    if e in ("ms-teams.exe", "teams.exe"):
        low = t.lower()
        meeting = "meeting" in low or "call" in low or low.startswith("meet ")
        return ("teams", meeting)
    if e in BROWSERS and (t.startswith("Meet - ") or t.startswith("Meet – ") or t.startswith("Google Meet")):
        return ("meet", True)
    return None


def pick(windows):
    """windows: [(hwnd, title, exe, cls)] in z-order -> (app id, hwnd) of the meeting to control, or (None, None).
    A real meeting window wins over the app's main window; Zoom before Teams before Meet when several are open."""
    best = {}
    for hwnd, title, exe, cls in windows:
        c = classify(title, exe, cls)
        if not c:
            continue
        app, meeting = c
        if app not in best or (meeting and not best[app][1]):
            best[app] = (hwnd, meeting)
    for app, _name, _keys in APPS:
        if app in best and best[app][1]:
            return app, best[app][0]
    for app, _name, _keys in APPS:
        if app in best:
            return app, best[app][0]
    return None, None


def keys_for(app):
    for a, name, keys in APPS:
        if a == app:
            return name, keys
    return "", {}


def chord(text):
    """'Ctrl+Shift+M' -> ([modifier vks], key vk)."""
    parts = [p.strip().lower() for p in text.split("+") if p.strip()]
    mods = [MODS[p] for p in parts[:-1]]
    k = parts[-1]
    vk = ord(k.upper()) if len(k) == 1 else {"space": 0x20, "enter": 0x0D}[k]
    return mods, vk


def available():
    return os.name == "nt"


# ---------- Windows ----------
def _windows():
    import ctypes
    from ctypes import wintypes
    user32, kernel32 = ctypes.windll.user32, ctypes.windll.kernel32
    out = []
    proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def each(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        n = user32.GetWindowTextLengthW(hwnd)
        title = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, title, n + 1)
        cls = ctypes.create_unicode_buffer(128)
        user32.GetClassNameW(hwnd, cls, 128)
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        exe = ""
        h = kernel32.OpenProcess(0x1000, False, pid.value)           # PROCESS_QUERY_LIMITED_INFORMATION
        if h:
            buf = ctypes.create_unicode_buffer(520)
            size = wintypes.DWORD(520)
            if kernel32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size)):
                exe = buf.value
            kernel32.CloseHandle(h)
        out.append((hwnd, title.value, exe, cls.value))
        return True
    user32.EnumWindows(proc(each), 0)
    return out


def _press(vks):
    """Press the keys in order and let go in reverse (a chord), through keybd_event."""
    import ctypes
    user32 = ctypes.windll.user32
    for vk in vks:
        user32.keybd_event(vk, 0, 0, 0)
    for vk in reversed(vks):
        user32.keybd_event(vk, 0, 2, 0)                              # KEYEVENTF_KEYUP


def _focus(hwnd):
    import ctypes
    user32 = ctypes.windll.user32
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, 9)                                    # SW_RESTORE
    user32.AllowSetForegroundWindow(-1)
    _press([0x12])                                                    # a lone Alt lets Windows hand over the focus
    user32.SetForegroundWindow(hwnd)


def status():
    """{available, app, name, acts: {mute: bool, ...}} for Spotlight."""
    if not available():
        return {"available": False, "app": None, "name": "", "acts": {a: False for a in ACTS}}
    try:
        app, _hwnd = pick(_windows())
    except Exception:
        app = None
    name, keys = keys_for(app)
    return {"available": True, "app": app, "name": name, "acts": {a: a in keys for a in ACTS}}


def send(act):
    """Do one action. Returns {ok, app, name} or raises ValueError with a plain message."""
    if act in VOLUME:
        if not available():
            raise ValueError("The PC's volume can be changed from Spotlight on Windows only.")
        _press([VOLUME[act]])
        return {"ok": True, "app": None, "name": ""}
    if act not in ACTS:
        raise ValueError("Unknown action")
    if not available():
        raise ValueError("Meeting controls work on Windows only.")
    import ctypes
    app, hwnd = pick(_windows())
    if not app:
        raise ValueError("No Zoom, Teams or Google Meet meeting is open.")
    name, keys = keys_for(app)
    if act not in keys:
        raise ValueError(name + " has no keyboard shortcut for that. Use its own button.")
    mods, vk = chord(keys[act])
    back = ctypes.windll.user32.GetForegroundWindow()
    _focus(hwnd)
    time.sleep(0.08)
    _press(mods + [vk])
    if act != "leave" and back and back != hwnd:                     # leaving: stay, Zoom may ask to confirm
        time.sleep(0.12)
        _focus(back)
    return {"ok": True, "app": app, "name": name}
