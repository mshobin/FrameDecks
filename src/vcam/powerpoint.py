"""Next / Previous slide in PowerPoint through its own automation (COM), for the PC hotkeys, the Studio and the
phone remote. Works with a full-screen slide show that FrameDecks vCam is not capturing (shared directly in Zoom/Teams),
a captured slide-show window, or the normal editing view. No OpenCV needed, so slides work even when the
camera engine is not running.
"""
from errlog import swallowed as _swallowed  # noqa: E402
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
            except Exception as _e:
                _swallowed("vcam.powerpoint._show", _e)
        for w in wins:                                # prefer a show that is actually running (not ended/paused)
            try:
                if int(w.View.State) in (1, 2):       # ppSlideShowRunning, ppSlideShowPaused
                    return w
            except Exception as _e:
                _swallowed("vcam.powerpoint._show", _e)
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
            except Exception as _e:
                _swallowed("vcam.powerpoint._move", _e)
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
        except Exception as _e:
            _swallowed("vcam.powerpoint.powerpoint_slide", _e)
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


def pptx_to_pdf(src, dst, timeout=180.0):
    """v6.5 PowerPoint Content from a .pptx: the PowerPoint installed on this PC saves it as a PDF (one picture per
    slide, exactly as PowerPoint draws it). Animations and transitions are not kept in a PDF; for those, show the
    PowerPoint slide show live with a Window Content (see docs/reference/powerpoint.md).
    Returns None when it worked, otherwise a plain-language reason."""
    if os.name != "nt":
        return "Turning PowerPoint files into slides needs Windows with PowerPoint installed. Save it as PDF in PowerPoint and add the PDF instead."
    box = {}

    def run():
        try:
            import comtypes
            import comtypes.client as cc
            comtypes.CoInitialize()
            try:
                app = cc.CreateObject("PowerPoint.Application", dynamic=True)
            except Exception:
                box["r"] = "PowerPoint is not installed on this PC. Save the file as PDF in PowerPoint and add the PDF instead."
                return
            # 9.3 (audit L6): an uploaded file may come from anyone, so its macros never run while it is turned into
            # slides (3 = msoAutomationSecurityForceDisable). PowerPoint runs one copy for the whole PC, so the
            # setting the presenter had is put back afterwards.
            before = None
            try:
                before = app.AutomationSecurity
                app.AutomationSecurity = 3
            except Exception as _e:
                _swallowed("vcam.powerpoint.automation_security", _e)
            try:
                pres = app.Presentations.Open(str(src), True, False, False)      # read-only, untitled, no window
                try:
                    pres.SaveAs(str(dst), 32)                                     # 32 = ppSaveAsPDF
                finally:
                    pres.Close()
            finally:
                if before is not None:
                    try:
                        app.AutomationSecurity = before
                    except Exception as _e:
                        _swallowed("vcam.powerpoint.automation_security", _e)
            box["r"] = None
        except Exception as e:
            box["r"] = f"PowerPoint could not open this file ({type(e).__name__})."

    t = threading.Thread(target=run, name="kc-pptx", daemon=True)
    t.start()
    t.join(timeout)
    if t.is_alive():
        return "PowerPoint took too long to open this file. Try again, or save it as PDF in PowerPoint."
    return box.get("r", "PowerPoint did not respond.")


# ---------- 26.11.46 animations: PowerPoint plays the deck, FrameDecks shows its picture ----------
SLIDE_PANE = "paneClassDC"               # the child window of a PowerPoint slide show that holds the slide itself
_SHOWS = __import__("weakref").WeakSet()  # the shows FrameDecks started: ended when FrameDecks closes


def _end_shows():
    """FrameDecks is closing: end every slide show it started, so no PowerPoint window is left behind."""
    for sh in list(_SHOWS):
        try:
            if not sh.closed and sh._win is not None:
                sh.closed = True
                _controller().call(sh._shut, (), 3.0)
        except Exception as _e:
            _swallowed("vcam.powerpoint.end_shows", _e)


__import__("atexit").register(_end_shows)


class LiveShow:
    """A .pptx played by PowerPoint itself, so every animation, transition and video plays exactly as in PowerPoint.

    FrameDecks opens the file read-only (macros off while it opens), runs its slide show in a window of its own
    (manual advance: rehearsed timings never move the slides), tucks that window behind every other window and gives
    the focus back. The camera shows the slide part of that window (vcam/layers.LiveShowSource). Next plays the next
    click of the slide (its next animation) and then goes to the next slide of this meeting's run order; Previous
    steps back. All PowerPoint calls run on the one PowerPoint helper thread (_PowerPointControl).

    page: the slide in the deck's own numbering (0-based, PowerPoint's hidden slides left out, the same as the PDF);
    idx[page] is that slide's number in the file, which the slide show goes to."""
    W, H = 1280, 720                     # the size PowerPoint draws the show at (px)

    def __init__(self, pptx, idx, page=0):
        self.path, self.idx = str(pptx), [int(i) for i in idx]
        self.page, self.click, self.clicks = max(0, int(page)), 0, 0
        self.hwnd, self.error, self.aspect, self.counted = None, "", 16 / 9, True
        self.ready = threading.Event()
        self.closed = False
        self._win = self._pres = None
        self._own_app = False
        self._crop = {"at": 0.0, "key": None, "rect": None}
        if os.name != "nt":
            self.error = "PowerPoint plays animations only on Windows."
            self.ready.set()
            return
        _SHOWS.add(self)
        self._post(self._open)

    # ----- the PowerPoint thread -----
    def _post(self, fn, *args):
        ctl = _controller()
        ctl.q.put((fn, args, {}, threading.Event()))

    def _call(self, fn, *args, timeout=4.0):
        ctl = _controller()
        if not ctl._claim(True):                           # one press at a time; a second press meanwhile is dropped
            return {"busy": True}
        return ctl.call(fn, args, timeout)

    def _open(self):
        import comtypes.client as cc
        ctl = _controller()
        try:
            app = ctl._application()
            if app is None:
                try:
                    app = cc.CreateObject("PowerPoint.Application", dynamic=True)
                    self._own_app = True
                except Exception:
                    self.error = "PowerPoint is not installed on this PC, so the slides are shown without animations."
                    return
            front = _foreground()
            before = None
            try:
                before = app.AutomationSecurity
                app.AutomationSecurity = 3                # the file's macros never run (as when it became slides)
            except Exception as _e:
                _swallowed("vcam.powerpoint.live security", _e)
            try:
                pres = app.Presentations.Open(self.path, True, False, False)   # read-only, untitled, no window
            finally:
                if before is not None:
                    try:
                        app.AutomationSecurity = before
                    except Exception as _e:
                        _swallowed("vcam.powerpoint.live security", _e)
            self._pres = pres
            try:
                self.aspect = float(pres.PageSetup.SlideWidth) / max(1.0, float(pres.PageSetup.SlideHeight))
            except Exception as _e:
                _swallowed("vcam.powerpoint.live aspect", _e)
            st = pres.SlideShowSettings
            for k, v in (("ShowType", 2), ("ShowWithAnimation", True), ("ShowWithNarration", True), ("LoopUntilStopped", False),
                         ("AdvanceMode", 1), ("RangeType", 1), ("ShowScrollbar", False)):
                try:                                       # 2 = in a window; 1 = manual advance; 1 = every slide
                    setattr(st, k, v)
                except Exception as _e:
                    _swallowed("vcam.powerpoint.live settings " + k, _e)
            win = st.Run()
            self._win = win
            try:
                win.Width, win.Height = self.W * 0.75, self.H * 0.75      # points
            except Exception as _e:
                _swallowed("vcam.powerpoint.live size", _e)
            self.hwnd = int(win.HWND)
            _tuck(self.hwnd)
            _give_back(front)
            if self.page and self.page < len(self.idx):
                win.View.GotoSlide(self.idx[self.page], True)
            self._read()
        except Exception as e:
            self.error = f"PowerPoint could not play this file ({type(e).__name__}), so the slides are shown without animations."
            self._shut()
        finally:
            self.ready.set()

    def _read(self):
        """Where the show is: page, click (animations played on this slide) and clicks (on this slide in all)."""
        v = self._win.View
        try:
            n = int(v.Slide.SlideIndex)
            if n in self.idx:
                self.page = self.idx.index(n)
        except Exception as _e:
            _swallowed("vcam.powerpoint.live read", _e)
        try:
            self.click, self.clicks = int(v.GetClickIndex()), int(v.GetClickCount())
            self.counted = True
        except Exception:                                  # PowerPoint before 2013: clicks are not reported
            self.click, self.clicks, self.counted = 0, 0, False
        return {"page": self.page, "click": self.click, "clicks": self.clicks}

    def _goto(self, page):
        if self._win is None or not 0 <= page < len(self.idx):
            return None
        v = self._win.View
        if int(v.State) == 2:                              # paused: carry on, like a clicker
            v.State = 1
        v.GotoSlide(self.idx[page], True)                  # True: the slide starts again, with its transition
        return self._read()

    def _step(self, by, seq):
        """Next: the slide's next animation, then the next slide of the run order (seq); Previous: back one step.
        Never past the last slide (PowerPoint's black "End of slide show" screen is never shown)."""
        if self._win is None:
            return None
        from slides import step as seq_step
        v = self._win.View
        if int(v.State) == 2:
            v.State = 1
        self._read()
        before = self.page
        if by > 0:
            target = seq_step(seq, before, 1)
            if not self.counted:                           # an older PowerPoint: let it play, then correct the slide
                if target == before and before == len(self.idx) - 1:
                    return self._read()
                v.Next()
                r = self._read()
                return r if r["page"] in (before, target) else self._goto(target)
            if self.click < self.clicks:
                v.Next()                                   # plays the next animation on this slide
                return self._read()
            return self._read() if target == before else self._goto(target)
        if self.click > 0:
            v.Previous()                                   # takes back the last animation
            return self._read()
        target = seq_step(seq, self.page, -1)
        return self._read() if target == self.page else self._goto(target)

    def _shut(self):
        win, pres, self._win, self._pres = self._win, self._pres, None, None
        try:
            if win is not None:
                win.View.Exit()
        except Exception as _e:
            _swallowed("vcam.powerpoint.live exit", _e)
        try:
            if pres is not None:
                app = pres.Application
                pres.Close()
                if self._own_app and int(app.Presentations.Count) == 0:
                    app.Quit()                             # only a PowerPoint FrameDecks started itself
        except Exception as _e:
            _swallowed("vcam.powerpoint.live close", _e)
        self.hwnd = None

    # ----- from FrameDecks -----
    def step(self, by, seq):
        """{page, click, clicks} after Next (+1) / Previous (-1), {"busy": True}, or None when the show is not playing."""
        if not self.ready.is_set() or self._win is None or self.closed:
            return None
        r = self._call(self._step, 1 if by > 0 else -1, list(seq))
        return r if isinstance(r, dict) and ("page" in r or r.get("busy")) else None

    def goto(self, page):
        """Go to a slide without waiting (the camera thread calls this)."""
        page = int(page)
        if page == self.page and self.ready.is_set():
            return
        self.page, self.click = page, 0
        if not self.closed and os.name == "nt":
            self._post(self._goto, page)

    def close(self):
        if self.closed:
            return
        self.closed = True
        if os.name == "nt":
            self._post(self._shut)

    def crop(self, shape):
        """The slide inside the captured window: (y0, y1, x0, x1) in the picture of shape (h, w, ...). Measured once a
        second from the slide-show window and its slide pane, then fitted to the slide's own shape."""
        h, w = int(shape[0]), int(shape[1])
        now = time.monotonic()
        c = self._crop
        if c["rect"] is not None and c["key"] == (h, w) and now - c["at"] < 1.0:
            return c["rect"]
        r = _pane_rect(self.hwnd, w, h) if self.hwnd else None
        x0, y0, x1, y1 = r or (0, 0, w, h)
        rect = fit_aspect(x0, y0, x1, y1, self.aspect)
        c.update(at=now, key=(h, w), rect=rect)
        return rect


def fit_aspect(x0, y0, x1, y1, aspect):
    """The largest box of this width/height ratio centred in (x0, y0, x1, y1): where PowerPoint draws the slide in its
    pane (it adds black bars on the long sides). Returns (y0, y1, x0, x1) for slicing a picture."""
    bw, bh = max(1, x1 - x0), max(1, y1 - y0)
    if bw / bh > aspect:
        w = int(round(bh * aspect))
        x0 += (bw - w) // 2
        x1 = x0 + w
    else:
        h = int(round(bw / aspect))
        y0 += (bh - h) // 2
        y1 = y0 + h
    return (int(y0), int(y1), int(x0), int(x1))


def _foreground():
    try:
        import ctypes
        return ctypes.windll.user32.GetForegroundWindow()
    except Exception:
        return None


def _give_back(hwnd):
    """The slide show took the focus when it started: give it back to the window you were using."""
    if not hwnd:
        return
    try:
        import ctypes
        ctypes.windll.user32.SetForegroundWindow(hwnd)
    except Exception as _e:
        _swallowed("vcam.powerpoint.give_back", _e)


def _tuck(hwnd):
    """Put the slide-show window behind every other window, without activating it. Windows Graphics Capture keeps
    capturing a covered window, so the camera picture is unaffected; it must not be minimised."""
    try:
        import ctypes
        u32 = ctypes.windll.user32
        HWND_BOTTOM, SWP_NOSIZE, SWP_NOMOVE, SWP_NOACTIVATE = 1, 0x0001, 0x0002, 0x0010
        u32.ShowWindow(hwnd, 4)                                                   # SW_SHOWNOACTIVATE (never minimised)
        u32.SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE)
    except Exception as _e:
        _swallowed("vcam.powerpoint.tuck", _e)


def _pane_rect(hwnd, w, h):
    """The slide pane's box inside the captured picture (w x h) of the slide-show window, or None."""
    try:
        import ctypes
        from ctypes import wintypes as W
        u32 = ctypes.windll.user32
        found = []
        PROC = ctypes.WINFUNCTYPE(ctypes.c_bool, W.HWND, W.LPARAM)

        def cb(child, lp):
            buf = ctypes.create_unicode_buffer(64)
            u32.GetClassNameW(child, buf, 64)
            if buf.value == SLIDE_PANE and u32.IsWindowVisible(child):
                found.append(child)
                return False
            return True
        u32.EnumChildWindows(W.HWND(int(hwnd)), PROC(cb), 0)
        if not found:
            return None
        outer = W.RECT()
        if ctypes.windll.dwmapi.DwmGetWindowAttribute(W.HWND(int(hwnd)), 9, ctypes.byref(outer), ctypes.sizeof(outer)) != 0:
            u32.GetWindowRect(W.HWND(int(hwnd)), ctypes.byref(outer))         # 9 = DWMWA_EXTENDED_FRAME_BOUNDS
        pane = W.RECT()
        u32.GetWindowRect(found[0], ctypes.byref(pane))
        ow, oh = max(1, outer.right - outer.left), max(1, outer.bottom - outer.top)
        sx, sy = w / ow, h / oh                                                   # the capture may be scaled (DPI)
        x0, y0 = int((pane.left - outer.left) * sx), int((pane.top - outer.top) * sy)
        x1, y1 = int((pane.right - outer.left) * sx), int((pane.bottom - outer.top) * sy)
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
        return (x0, y0, x1, y1) if x1 - x0 > 16 and y1 - y0 > 16 else None
    except Exception as _e:
        _swallowed("vcam.powerpoint.pane_rect", _e)
        return None
