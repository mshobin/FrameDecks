"""Next / Previous slide in PowerPoint through its own automation (COM), for the PC hotkeys, the Studio and the
phone remote. Works with a full-screen slide show that BCC is not capturing (shared directly in Zoom/Teams),
a captured slide-show window, or the normal editing view. No OpenCV needed, so slides work even when the
camera engine is not running.
"""
import os
import threading
import time


class _PowerPointControl:
    """All PowerPoint commands run on ONE helper thread with COM initialised (COM requires it, and the web
    request threads never had it - that is why Next slide silently did nothing before).

    Reliability rules (a live meeting): one command at a time - a press that arrives while the previous one is
    still running is dropped, never queued (no late or double jumps); a slow command is never "repeated" with
    keys (that used to move two slides); the PowerPoint connection is kept between commands (fast)."""
    MIN_GAP = 0.12                                    # seconds between moves: key-repeat can't skip slides

    def __init__(self):
        import queue as _q
        self.q = _q.Queue()
        self.busy = threading.Event()
        self.gate = threading.Lock()
        self.last_move = 0.0
        self.app = None
        threading.Thread(target=self._run, name="bcc-powerpoint", daemon=True).start()

    def _run(self):
        try:
            import comtypes
            comtypes.CoInitialize()
        except Exception as e:
            self.init_error = str(e)
        while True:
            fn, args, box, done = self.q.get()
            try:
                box["r"] = fn(*args)
            except Exception as e:
                self.app = None                       # PowerPoint was closed or restarted: reconnect next time
                box["r"] = {"error": f"PowerPoint did not respond ({type(e).__name__})"}
            finally:
                self.busy.clear()
                done.set()

    def _application(self):
        import comtypes.client as cc
        if self.app is not None:
            try:
                self.app.SlideShowWindows.Count       # still alive?
                return self.app
            except Exception:
                self.app = None
        try:
            self.app = cc.GetActiveObject("PowerPoint.Application", dynamic=True)   # dynamic: no code generation
        except Exception:
            self.app = None                           # PowerPoint isn't running
        return self.app

    def _show(self, app, hwnd):
        """The slide show to control: the captured window's show if it is one, else the active (full-screen) one."""
        shows = app.SlideShowWindows
        n = shows.Count
        if n < 1:
            return None
        wins = [shows.Item(i) for i in range(1, n + 1)]
        for w in wins:
            try:
                if hwnd and int(w.HWND) == int(hwnd):
                    return w
            except Exception:
                pass
        for w in wins:                                # prefer a show that is actually running (not ended/paused)
            try:
                if int(w.View.State) in (1, 2):       # ppSlideShowRunning, ppSlideShowPaused
                    return w
            except Exception:
                pass
        return wins[0]

    @staticmethod
    def _position(win):
        view = win.View
        try:
            return {"page": int(view.CurrentShowPosition), "pages": int(win.Presentation.Slides.Count),
                    "name": str(win.Presentation.Name), "via": "slide show"}
        except Exception:
            return {"result": "ok", "via": "slide show"}

    def _move(self, step, hwnd):
        app = self._application()
        if app is None:
            return None
        win = self._show(app, hwnd)
        if win is not None:                           # a slide show is running (full screen or in a window)
            view = win.View
            try:
                if int(view.State) == 2:              # paused / black or white screen: resume first, like a clicker
                    view.State = 1
            except Exception:
                pass
            (view.Next if step > 0 else view.Previous)()
            return self._position(win)
        if app.Windows.Count >= 1:                    # normal (editing) view
            w = app.ActiveWindow
            total = int(w.Presentation.Slides.Count)
            cur = int(w.View.Slide.SlideIndex)
            new = max(1, min(total, cur + step))
            w.View.GotoSlide(new)
            return {"page": new, "pages": total, "name": str(w.Presentation.Name), "via": "editing view"}
        return None

    def _status(self):
        app = self._application()
        if app is None:
            return None
        win = self._show(app, None)
        if win is not None:
            return self._position(win)
        return None                                   # open but not presenting: nothing for the remote to show

    def call(self, fn, args, timeout):
        box, done = {}, threading.Event()
        self.q.put((fn, args, box, done))
        return box.get("r") if done.wait(timeout) else {"error": "PowerPoint is busy - try again", "busy": True}

    def _claim(self, moving):
        """Atomically take the helper thread, or say it is busy (two remotes pressing at once can't both win)."""
        with self.gate:
            now = time.monotonic()
            if self.busy.is_set() or (moving and now - self.last_move < self.MIN_GAP):
                return False
            self.busy.set()
            if moving:
                self.last_move = now
            return True

    def move(self, step, hwnd, timeout=3.0):
        if not self._claim(True):
            return {"busy": True, "result": "ignored (previous slide command still running)"}
        return self.call(self._move, (step, hwnd), timeout)

    def status(self, timeout=1.0):
        if not self._claim(False):
            return {"busy": True}
        return self.call(self._status, (), timeout)


_ppt = None
_ppt_status = {"at": 0.0, "value": None}


def _controller():
    global _ppt
    if _ppt is None:
        _ppt = _PowerPointControl()
    return _ppt


def _post_keys(hwnd, step):
    """Last resort for a captured window that is not PowerPoint: Page Down / Up to the window AND its inner windows
    (some apps read keys in an inner window, so keys sent only to the main window were ignored)."""
    import ctypes
    from ctypes import wintypes as W
    u32 = ctypes.windll.user32
    vk = 0x22 if step > 0 else 0x21                                              # VK_NEXT / VK_PRIOR
    targets = [int(hwnd)]
    PROC = ctypes.WINFUNCTYPE(ctypes.c_bool, W.HWND, W.LPARAM)
    u32.EnumChildWindows(W.HWND(int(hwnd)), PROC(lambda h, lp: targets.append(int(h)) or True), 0)
    for t in targets:
        u32.PostMessageW(W.HWND(t), 0x0100, vk, 0)
        u32.PostMessageW(W.HWND(t), 0x0101, vk, 0)


def powerpoint_slide(step, hwnd=None):
    """Next (+1) / Previous (-1) slide in PowerPoint (slide show - full screen or windowed - or editing view).
    Returns a status dict, e.g. {"page": 4, "pages": 12}, {"busy": True} or {"error": "..."}."""
    if os.name != "nt":
        return {"error": "Only on Windows"}
    res = _controller().move(step, hwnd)
    _ppt_status["at"] = 0.0                                                      # next status read is fresh
    if res is None and hwnd:                       # PowerPoint isn't running: the captured window is another app
        try:
            _post_keys(hwnd, step)
            return {"result": "sent Page Down" if step > 0 else "sent Page Up", "via": "keys"}
        except Exception:
            pass
    if res and not res.get("error"):
        _ppt_status.update(at=time.monotonic(), value=res if res.get("page") else _ppt_status["value"])
    return res or {"error": "PowerPoint isn't open. Open your presentation (or start the slide show) and try again."}


def powerpoint_status(max_age=2.0):
    """The running PowerPoint slide show {"page", "pages", "name"} or None. Cached for max_age seconds, so the
    remote's status checks cost at most one quick PowerPoint query every 2 s."""
    if os.name != "nt":
        return None
    now = time.monotonic()
    if now - _ppt_status["at"] < max_age:
        return _ppt_status["value"]
    try:
        r = _controller().status()
    except Exception:
        r = None
    if isinstance(r, dict) and r.get("busy"):
        return _ppt_status["value"]
    value = r if isinstance(r, dict) and r.get("page") else None
    _ppt_status.update(at=now, value=value)
    return value
