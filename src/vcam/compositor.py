"""The one place where the final FRAMEDECKS picture is built:

    base layout (camera / screen / picture-in-picture / side-by-side)
      -> layers (images, videos, presentations; bottom to top)
      -> verse, question and birthday cards (always on top)
      -> [latency-test clock]
    = FINAL FRAME  ->  FRAMEDECKS, the preview, and the test recording

Everything is reused between frames: the shared screen is only resized when it changes, layers cache their
transformed pictures, cards are drawn once. Nothing here runs on the user-interface thread.
"""
from errlog import swallowed as _swallowed  # noqa: E402
import os
import queue
import threading
import time
from pathlib import Path

import cv2
import numpy as np

from .layers import LayerManager, PdfSource
from .screen import ScreenCapture

LAYOUTS = ("camera", "screen", "pip", "side")
PIP_SIZES = {"small": 0.22, "medium": 0.30, "large": 0.40}
CORNERS = ("tl", "tr", "bl", "br")
BACKDROP = (34, 18, 11)          # #0b1222 in BGR, behind a shared screen


def clean_layout(d):
    d = d or {}
    out = {"mode": d.get("mode") if d.get("mode") in LAYOUTS else "camera",
           "corner": d.get("corner") if d.get("corner") in CORNERS else "br",
           "size": d.get("size") if d.get("size") in PIP_SIZES else "medium", "custom": bool(d.get("custom"))}
    for k, lo, hi, dv in (("x", 0.0, 1.0, 0.82), ("y", 0.0, 1.0, 0.78), ("scale", 0.1, 0.6, 0.3)):
        try:
            v = float(d.get(k, dv))
        except (TypeError, ValueError):
            v = dv
        out[k] = min(hi, max(lo, v)) if v == v else dv
    return out


def fit(img, w, h):
    """Scale to fit inside w x h (letterbox). Returns the image and its offset."""
    ih, iw = img.shape[:2]
    k = min(w / iw, h / ih)
    nw, nh = max(1, int(iw * k)), max(1, int(ih * k))
    return cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_LINEAR), (w - nw) // 2, (h - nh) // 2


def fill(img, w, h):
    """Scale to cover w x h, cropping the middle (camera picture: the fast scaler looks the same here)."""
    ih, iw = img.shape[:2]
    k = max(w / iw, h / ih)
    r = cv2.resize(img, (max(w, int(iw * k)), max(h, int(ih * k))), interpolation=cv2.INTER_LINEAR)
    y0, x0 = (r.shape[0] - h) // 2, (r.shape[1] - w) // 2
    return r[y0:y0 + h, x0:x0 + w]


class Recorder:
    """Test recording of the exact FRAMEDECKS output. Encodes on its own thread; if it can't keep up it skips
    recording frames (counted) instead of slowing the camera."""
    def __init__(self, path, w, h, fps=30):
        self.path, self.frames, self.skipped = str(path), 0, 0
        self.q = queue.Queue(maxsize=8)
        self.writer, self.codec = None, ""
        if os.name == "nt" and hasattr(cv2, "CAP_MSMF"):
            w_ = cv2.VideoWriter(self.path, cv2.CAP_MSMF, cv2.VideoWriter_fourcc(*"H264"), fps, (w, h))
            if w_.isOpened():
                self.writer, self.codec = w_, "H.264 (Windows Media Foundation, hardware when available)"
        if self.writer is None:
            w_ = cv2.VideoWriter(self.path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
            if not w_.isOpened():
                raise RuntimeError("Recording could not start (no video encoder available).")
            self.writer, self.codec = w_, "MPEG-4 (software)"
        self.size = (w, h)
        self.started = time.time()
        self.alive = True
        self.t = threading.Thread(target=self._run, name="bcc-recorder", daemon=True)
        self.t.start()

    def push(self, frame):
        if frame.shape[1::-1] != self.size:
            return
        try:
            self.q.put_nowait(frame.copy())
        except queue.Full:
            self.skipped += 1

    def _run(self):
        from .priority import lower_this_thread
        lower_this_thread()                          # recording: background priority
        while self.alive or not self.q.empty():
            try:
                f = self.q.get(timeout=0.2)
            except queue.Empty:
                continue
            self.writer.write(f)
            self.frames += 1

    def stop(self):
        self.alive = False
        self.t.join(timeout=10)
        self.writer.release()
        return {"file": self.path, "frames": self.frames, "skipped": self.skipped, "seconds": round(time.time() - self.started, 1)}


class Compositor:
    def __init__(self, layer_folder, cards=None, cards_on=lambda: True):
        self.layout = clean_layout({})
        self.layers = LayerManager(layer_folder)
        self.cards, self.cards_on = cards, cards_on
        self.program_fx = None         # v6: text layers, scene transitions, Blackout / Emergency screen (vcam/program.py)
        self.screen_src, self.screen = None, None
        self._screen_fit = (None, None)        # (key, image) - resized only when the screen changes
        self.recorder, self.last_recording = None, None
        self.latency_test = False
        self.ms = 0.0
        self.lock = threading.Lock()
        self._backdrop = None
        # Presentation window: newest final frame, published only when the picture actually changed
        self.present = {"clients": 0, "frame": None, "ver": 0, "sig": None, "sent": 0}
        self.last_change = time.time()             # when the final picture last changed (drives the idle rhythm)
        self._sig = None
        self.present_cond = threading.Condition()
        self.variables = {}            # values saved by older versions for {{name}} placeholders in existing text layers
        self.staged = None             # Preview mode: a layer list being edited before it goes to the output
        self.last_cam = None
        self.frame_no = 0
        self._builtins = (0, {})

    def _canvas(self, w, h):
        if self._backdrop is None or self._backdrop.shape[:2] != (h, w):
            self._backdrop = np.full((h, w, 3), BACKDROP, np.uint8)
        return self._backdrop.copy()

    # ----- controls -----
    def set_layout(self, d):
        self.layout = clean_layout({**self.layout, **(d or {})})

    def set_screen(self, src, layer_folder=None):
        """src = None (stop), {kind: display|window|demo, ...} or {kind: 'pdf', file}."""
        with self.lock:
            old, self.screen, self.screen_src = self.screen, None, None
            self._screen_fit = (None, None)
        if old is not None:
            (old.stop if hasattr(old, "stop") else old.close)()
        if not src:
            return None
        if src.get("kind") == "pdf":
            new = PdfSource(Path(layer_folder or self.layers.folder) / src["file"])
        else:
            new = ScreenCapture(src)
        with self.lock:
            self.screen, self.screen_src = new, dict(src)
        return new

    def screen_status(self):
        s = self.screen
        if s is None:
            return {"active": False}
        if isinstance(s, PdfSource):
            return {"active": True, "source": self.screen_src, "backend": "PDF slides", "page": s.page + 1, "pages": s.pages, "fps": 0}
        return {"active": True, "source": self.screen_src, "backend": s.backend, "fps": s.fps, "error": s.error,
                "hasFrame": s.frame is not None, "attempts": list(getattr(s, "attempts", []))[-6:]}

    def slide(self, step):
        """Next/Previous for the shared presentation (PDF deck or PowerPoint window)."""
        s = self.screen
        if isinstance(s, PdfSource):
            s.go(s.page + step)
            return {"page": s.page + 1, "pages": s.pages}
        if s is not None and self.screen_src and self.screen_src.get("kind") == "window":
            from .layers import powerpoint_slide
            return powerpoint_slide(step, self.screen_src.get("hwnd"))
        return None

    @staticmethod
    def scene_mode(layers):
        """A scene built from layers (camera / screen / background are layers) instead of a fixed layout."""
        return any(l.get("visible", True) and l.get("type") in ("camera", "screen", "background") for l in layers)

    def needs_camera(self):
        layers = self.layers.layers
        if self.scene_mode(layers):
            return any(l.get("visible", True) and l["type"] == "camera" for l in layers)
        return not (self.layout["mode"] == "screen" and self._screen_frame()[0] is not None)

    def all_variables(self):
        """Personal variables plus live ones; refreshed at most once a second."""
        now = time.time()
        if now - self._builtins[0] >= 1.0:
            b = {"date": time.strftime("%d %B %Y").lstrip("0"), "time": time.strftime("%H:%M")}
            try:
                st = self.cards.get_state() if self.cards is not None else {}
                q, v = st.get("question", {}) or {}, st.get("verse", {}) or {}
                b.update(question=q.get("text", "") if q.get("visible") else "", verse=v.get("text", "") if v.get("visible") else "",
                         verseRef=v.get("ref", "") if v.get("visible") else "")
            except Exception as _e:
                _swallowed("vcam.compositor.all_variables", _e)
            self._builtins = (now, b)
        return {**self._builtins[1], **self.variables}

    def render(self, layers, w, h, cam=None):
        """Draw any layer list (Preview mode, scene thumbnails) with the latest camera and screen pictures."""
        cam = self.last_cam if cam is None else cam
        if cam is not None and cam.shape[:2] != (h, w):
            cam = cv2.resize(cam, (w, h), interpolation=cv2.INTER_AREA)
        scr, sid = self._screen_frame()
        if self.scene_mode(layers):
            frame = np.full((h, w, 3), BACKDROP, np.uint8)
        else:
            frame = cam.copy() if cam is not None else np.full((h, w, 3), BACKDROP, np.uint8)
        return self.layers.compose(frame, cam, scr, self.all_variables(), cam_ver=-1, screen_ver=-1,
                                   stack=[dict(l) for l in layers])

    def start_recording(self, folder, w, h):
        if self.recorder:
            return self.recorder
        Path(folder).mkdir(parents=True, exist_ok=True)
        name = time.strftime("FRAMEDECKS test %Y-%m-%d %H-%M-%S.mp4")
        self.recorder = Recorder(Path(folder) / name, w, h)
        return self.recorder

    def stop_recording(self):
        r, self.recorder = self.recorder, None
        if r:
            self.last_recording = r.stop()
        return self.last_recording

    # ----- per frame -----
    def _screen_frame(self):
        s = self.screen
        if s is None:
            return None, None
        if isinstance(s, PdfSource):
            return s.frame()
        return s.latest()

    def _fitted(self, w, h, area):
        """The shared screen, fitted into an area; recomputed only when the screen picture changed."""
        img, ver = self._screen_frame()
        if img is None:
            return None
        key = (ver, w, h, area)
        if self._screen_fit[0] != key:
            self._screen_fit = (key, fit(img, area[2], area[3]))
        return self._screen_fit[1]

    def compose(self, cam, w, h):
        t = time.perf_counter()
        self.frame_no += 1
        self.last_cam = cam
        if self.scene_mode(self.layers.layers):                       # Camo-style scene: everything is a layer
            scr, sid = self._screen_frame()
            frame = self.layers.compose(self._canvas(w, h), cam, scr, self.all_variables(), cam_ver=self.frame_no, screen_ver=sid)
            return self._finish(frame, w, h, t)
        L = self.layout
        mode = L["mode"]
        has_screen = self._screen_frame()[0] is not None
        if mode == "camera" or not has_screen:
            frame = cam if cam is not None else self._canvas(w, h)
            if cam is None and mode != "camera":
                cv2.putText(frame, "Screen sharing is starting...", (int(w * 0.05), int(h * 0.5)), cv2.FONT_HERSHEY_SIMPLEX, h / 720, (200, 200, 200), 2)
        else:
            area = (0, 0, int(w * 0.66), h) if mode == "side" else (0, 0, w, h)
            sc = self._fitted(w, h, area)
            full = sc is not None and sc[0].shape[1] == w and sc[0].shape[0] == h
            frame = sc[0].copy() if full else self._canvas(w, h)     # a 16:9 screen fills the picture: just copy it
            if sc is not None and not full:
                img, ox, oy = sc
                frame[area[1] + oy:area[1] + oy + img.shape[0], area[0] + ox:area[0] + ox + img.shape[1]] = img
            if cam is not None and mode == "side":
                cw = w - area[2]
                frame[:, area[2]:] = fill(cam, cw, h)
            elif cam is not None and mode == "pip":
                pw = int(w * (L["scale"] if L["custom"] else PIP_SIZES[L["size"]]))
                ph = int(pw * 9 / 16)
                small = fill(cam, pw, ph)
                m = int(w * 0.025)
                if L["custom"]:
                    x0, y0 = int(L["x"] * w - pw / 2), int(L["y"] * h - ph / 2)
                else:
                    x0 = m if L["corner"] in ("tl", "bl") else w - pw - m
                    y0 = m if L["corner"] in ("tl", "tr") else h - ph - m
                x0, y0 = max(0, min(w - pw, x0)), max(0, min(h - ph, y0))
                frame[y0:y0 + ph, x0:x0 + pw] = small
                cv2.rectangle(frame, (x0, y0), (x0 + pw - 1, y0 + ph - 1), (220, 225, 235), max(1, w // 640))
        frame = self.layers.compose(frame, None, None, self.all_variables())
        return self._finish(frame, w, h, t)

    def _finish(self, frame, w, h, t):
        if self.cards is not None and self.cards_on():
            frame = self.cards(frame)
        if self.program_fx is not None:
            try:
                frame = self.program_fx(frame)
            except Exception as e:                    # never let an effect stop the camera
                print("FRAMEDECKS: program effect:", e)
                self.program_fx = None
        if self.latency_test:
            stamp = time.time()
            txt = time.strftime("%H:%M:%S", time.localtime(stamp)) + ".%03d" % int(stamp % 1 * 1000)
            cv2.rectangle(frame, (0, h - int(h * 0.12)), (int(w * 0.42), h), (0, 0, 0), -1)
            cv2.putText(frame, txt, (int(w * 0.015), h - int(h * 0.03)), cv2.FONT_HERSHEY_SIMPLEX, h / 360, (255, 255, 255), max(2, h // 240))
        self.ms = (time.perf_counter() - t) * 1000
        return frame

    def after_send(self, frame):
        if self.recorder:
            self.recorder.push(frame)
        small = cv2.resize(frame, (64, 36), interpolation=cv2.INTER_AREA).astype(np.int16)
        if self._sig is None or int(np.abs(small - self._sig).max()) > 1:
            self.last_change = time.time()
        self._sig = small
        fx = self.program_fx
        if fx is not None:
            fx.need_clean = self.present["clients"] > 0          # 8.8 the Share Window leaves out the Audience Card
            clean = getattr(fx, "present_frame", None)
            if clean is not None and clean.shape == frame.shape:
                frame = clean
                small = cv2.resize(frame, (64, 36), interpolation=cv2.INTER_AREA).astype(np.int16)
        if self.present["clients"] > 0:
            sig = self.present["sig"]
            if sig is None or int(np.abs(small - sig).max()) > 1:        # changed (a still slide stays silent)
                with self.present_cond:
                    self.present.update(frame=frame, sig=small, ver=self.present["ver"] + 1)
                    self.present_cond.notify_all()
