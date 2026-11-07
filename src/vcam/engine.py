"""FRAMEDECKS engine.

webcam -> crop + zoom + resize (one resample) -> mirror -> colour-range fix -> background blur
       -> filter (Camera Look x intensity) -> adjustments -> layers + cards -> "FRAMEDECKS" (RGB24)

The laptop webcam is opened only while an app (Zoom, Teams...) is showing FRAMEDECKS or the preview
in Settings is open. Otherwise the webcam is released (its light goes off) and the engine just
checks twice a second whether it is needed, which costs almost nothing.
"""
from errlog import swallowed as _swallowed  # noqa: E402
import os
import threading
import time

# Must be set before OpenCV loads: makes opening laptop webcams faster and more reliable on some PCs
os.environ.setdefault("OPENCV_VIDEOIO_MSMF_ENABLE_HW_TRANSFORMS", "0")
import cv2
import numpy as np

from . import picture

SIZES = {"720p": (1280, 720), "1080p": (1920, 1080)}


def fit_cover(img, w, h, zoom=1.0):
    """Scale a camera picture to w x h keeping its shape (crop the edges if the shape differs), optionally
    zoomed in on the centre. Crop first, then ONE resample: area averaging when shrinking (clean, no shimmer),
    bicubic when enlarging; no artificial sharpening. zoom=1.0 gives exactly the previous result."""
    ih, iw = img.shape[:2]
    if zoom > 1.0001:
        cw = min(iw, iw / zoom if iw * h <= ih * w else ih / zoom * w / h)    # visible part, output shape
        ch = cw * h / w
        x0, y0 = int(round((iw - cw) / 2)), int(round((ih - ch) / 2))
        crop = img[y0:y0 + int(round(ch)), x0:x0 + int(round(cw))]
        k = w / crop.shape[1]
        return cv2.resize(crop, (w, h), interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_CUBIC)
    k = max(w / iw, h / ih)
    nw, nh = max(w, int(round(iw * k))), max(h, int(round(ih * k)))
    out = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_CUBIC)
    y0, x0 = (nh - h) // 2, (nw - w) // 2
    return out[y0:y0 + h, x0:x0 + w]



class Pace:
    """26.11.9 the camera keeps up with the frame rate the meeting app asks for. Measured once a second: when frames
    come out too slowly (under 80 % of the rate, each taking longer than its slot) for 2 seconds in a row, the blur
    steps down one level; when there is plenty of room (under 60 % of the slot) for 10 seconds, it steps back up.
        0  as set
        1  the person outline is found 5 times a second instead of 10
        2  and the same natural blur worked out on a picture half as big (never the classic style, which leaves
           a halo around you)
    """
    MAX = 2

    def __init__(self):
        self.level, self.over, self.under = 0, 0, 0

    def update(self, fps, ms, target, blurring=True):
        if not blurring:
            self.level = self.over = self.under = 0
            return self.level
        budget = 1000.0 / max(1, target)
        if fps < 0.8 * target and ms > budget:
            self.over, self.under = self.over + 1, 0
        elif ms < 0.6 * budget:
            self.under, self.over = self.under + 1, 0
        else:
            self.over = self.under = 0
        if self.over >= 2 and self.level < self.MAX:
            self.level, self.over = self.level + 1, 0
        elif self.under >= 10 and self.level > 0:
            self.level, self.under = self.level - 1, 0
        return self.level

class Camera:
    """The real webcam, read through Windows Media Foundation (FRAMEDECKS itself never appears there,
    so the engine can't capture its own output)."""
    def __init__(self, index, width, height, **_options):
        self.cap = cv2.VideoCapture(index, cv2.CAP_MSMF if os.name == "nt" else cv2.CAP_ANY)
        if not self.cap.isOpened():
            raise RuntimeError("The webcam could not be opened. Another app may be using it, or Windows privacy settings may block it.")
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS, 30)

    def read(self):
        ok, frame = self.cap.read()
        return frame if ok else None

    def close(self):
        self.cap.release()


class DemoCamera:
    """A moving test picture, used only for testing without a webcam (KC_VCAM_DEMO=1)."""
    def __init__(self, index, width, height, **_options):
        self.w, self.h, self.t = width, height, 0

    def read(self):
        time.sleep(1 / 30)
        self.t += 1
        img = np.full((self.h, self.w, 3), (70, 50, 30), np.uint8)
        cv2.circle(img, (self.w // 2 + int(self.w * 0.05 * np.sin(self.t / 15)), self.h // 2), self.h // 4, (170, 190, 215), -1)
        cv2.putText(img, "Demo webcam", (40, 80), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
        return img

    def close(self):
        pass


class Grabber:
    """Reads the webcam on its own thread, so waiting for the next picture overlaps with processing."""
    def __init__(self, camera):
        self.camera = camera
        self.cond = threading.Condition()
        self.frame, self.seq, self.error, self.alive = None, 0, None, True
        self.t_capture, self.fps, self._n, self._t = 0.0, 0.0, 0, time.time()
        threading.Thread(target=self._run, name="bcc-vcam-grab", daemon=True).start()

    def _run(self):
        misses = 0
        while self.alive:
            try:
                f = self.camera.read()
            except Exception as e:
                f, self.error = None, e
            with self.cond:
                if f is None:
                    misses += 1
                    if misses >= 30:
                        self.error = self.error or RuntimeError("The webcam stopped sending pictures. Check it is connected.")
                        self.cond.notify_all()
                        return
                    continue
                misses = 0
                self.frame, self.seq, self.t_capture = f, self.seq + 1, time.perf_counter()
                self._n += 1
                now = time.time()
                if now - self._t >= 1.0:
                    self.fps, self._n, self._t = round(self._n / (now - self._t), 1), 0, now
                self.cond.notify_all()

    def next(self, last_seq, timeout=2.0):
        with self.cond:
            if not self.cond.wait_for(lambda: (self.seq != last_seq and self.frame is not None) or self.error or not self.alive, timeout):
                raise RuntimeError("The webcam stopped sending pictures. Check it is connected.")
            if self.error:
                raise self.error if isinstance(self.error, RuntimeError) else RuntimeError(str(self.error))
            return self.frame, self.seq, self.t_capture

    def close(self):
        self.alive = False
        try:
            self.camera.close()
        except Exception as _e:
            _swallowed("vcam.engine.close", _e)


class VCamEngine:
    def __init__(self, sink_factory, camera_factory=Camera, blur_factory=None, overlay=None, compositor=None):
        self.sink_factory = sink_factory          # (width, height) -> sink
        self.camera_factory = camera_factory      # (index, width, height) -> camera
        self.blur_factory = blur_factory          # () -> BackgroundBlur (loaded on first use)
        self.overlay = overlay                    # (frame) -> frame with cards drawn (used when there is no compositor)
        self.compositor = compositor              # layout + layers + cards, the one final picture
        self.dropped = 0
        self.settings = {"cameraName": "", "resolution": "720p", "mirror": False, "blur": "off", "blurStrength": 0, "presentFps": 15,
                         **picture.defaults()}
        self._adjust, self._adjust_key = None, None
        self.late = 0                             # output frames that took longer than one frame interval
        self.lock = threading.Lock()
        self.thread = None
        self.running = False
        self.sink = None
        self.cam = None
        self.blur = None
        self.pace = Pace()          # 26.11.9 steps the blur down when the camera cannot keep up
        self.guard_busy = False     # set by the meeting guard while the PC is very busy
        self.preview_until = 0.0
        self.sharp_until = 0.0                    # the phone's drawing pad is open: previews 960 wide instead of 640
        self._preview_w = 0
        self.awake_until = 0.0                    # e.g. the Presentation window is open (no preview pictures needed)
        self.preview_ver, self.preview_t = 0, 0.0  # numbered previews: screens skip pictures they already have
        self.kick_evt = threading.Event()         # set when something changes (a card shown, a Studio edit)
        self._last_proc = 0.0
        self.preview_jpeg = None
        self.status = {"state": "off", "message": "", "fps": 0.0, "msPerFrame": 0.0, "blurMs": 0.0,
                       "inUse": False, "cameraOn": False}

    # ---------- control ----------
    def start(self):
        with self.lock:
            if self.running:
                return
            self.running = True
            self.thread = threading.Thread(target=self._loop, name="bcc-vcam", daemon=True)
            self.thread.start()

    def stop(self):
        with self.lock:
            self.running = False
            t = self.thread
        if t:
            t.join(timeout=5)
        self._close_camera()
        if self.blur:
            self.blur.close()
            self.blur = None
        if self.sink:
            self.sink.close()
            self.sink = None
        self._set(state="off", message="", inUse=False, cameraOn=False, fps=0.0)

    def configure(self, **changes):
        """Apply new settings. A different size or camera takes effect immediately."""
        differs = lambda k: k in changes and changes[k] != self.settings.get(k)
        restart_sink = differs("resolution") or any(differs(k) for k in picture.NEEDS_RESINK)
        reopen = differs("resolution") or differs("cameraName") or any(differs(k) for k in picture.NEEDS_REOPEN)
        controls = any(differs(k) for k in picture.CAMERA_CONTROLS)
        with self.lock:
            self.settings.update(changes)
            self._reopen = getattr(self, "_reopen", False) or reopen
            self._resink = getattr(self, "_resink", False) or restart_sink
            self._recontrol = getattr(self, "_recontrol", False) or controls

    def kick(self):
        """Something changed: draw the next frame now (wakes the idle rhythm)."""
        self.kick_evt.set()

    def keep_awake(self, seconds=3.0):
        self.awake_until = time.time() + seconds

    def want_preview(self, seconds=3.0, sharp=False):
        self.preview_until = time.time() + seconds
        if sharp:
            self.sharp_until = self.preview_until

    # ---------- internals ----------
    def _set(self, **kw):
        self.status.update(kw)

    def _adjustments(self, s):
        """The user adjustments for these settings (rebuilt only when one of them changes)."""
        key = tuple(s.get(k) for k in picture.ADJUSTMENTS)
        if key != self._adjust_key:
            self._adjust, self._adjust_key = picture.Adjust.of(s), key
        return self._adjust

    def _open_sink(self, w, h, s):
        if s.get("outputPacing") == "fixed":     # FRAMEDECKS sends at a steady rate (repeats a frame if needed)
            try:
                return self.sink_factory(w, h, float(s.get("frameRate") or 30))
            except TypeError:                     # an older sink factory without a frame-rate option
                pass
        return self.sink_factory(w, h)

    @staticmethod
    def _capture_size(s, w, h):
        return SIZES.get(s.get("captureResolution"), (w, h)) if s.get("captureResolution") != "auto" else (w, h)

    def _close_camera(self):
        if self.cam:
            self.cam.close()
            self.cam = None
        self.preview_jpeg = None          # never show an out-of-date picture when the preview reopens
        self._set(cameraOn=False)

    def _loop(self):
        cv2.setNumThreads(2)                     # leave the rest of the CPU for Zoom/Teams
        frames, t_window, busy, seq = 0, time.time(), 0.0, 0
        lat_sum, cpu_t0, cpu_w0 = 0.0, time.process_time(), time.time()
        tick = time.perf_counter()
        while self.running:
            try:
                with self.lock:
                    s = dict(self.settings)
                    reopen, resink = getattr(self, "_reopen", False), getattr(self, "_resink", False)
                    recontrol = getattr(self, "_recontrol", False)
                    self._reopen = self._resink = self._recontrol = False
                w, h = SIZES.get(s["resolution"], SIZES["720p"])
                if resink and self.sink:
                    self.sink.close()
                    self.sink = None
                if self.sink is None:
                    self.sink = self._open_sink(w, h, s)
                if reopen:
                    self._close_camera()
                in_use = self.sink.connected()
                previewing = time.time() < self.preview_until
                awake = time.time() < self.awake_until
                self._set(inUse=in_use)
                if not in_use and not previewing and not awake:
                    if self.cam:
                        self._close_camera()            # webcam light goes off
                    self._set(state="ready", message="Ready. Choose “FrameDecks vCam” as the camera in Zoom or Teams.", fps=0.0)
                    time.sleep(0.5)
                    continue
                need_cam = self.compositor.needs_camera() if self.compositor else True
                if not need_cam:                         # screen-only layout: the webcam is switched off
                    if self.cam:
                        self._close_camera()
                    # Idle rhythm: with no camera and nothing changing, and Zoom not using FRAMEDECKS, check 5x a second
                    # instead of 30. Any change (kick) wakes it at once; changes keep it at 30 fps for 1.5 s.
                    idle = not in_use and self.compositor is not None and time.time() - self.compositor.last_change > 1.5
                    rate = s.get("presentFps", 15) if (not in_use and not previewing) else 30
                    tick += 0.2 if idle else 1 / rate
                    wait = tick - time.perf_counter()
                    if wait > 0:
                        if self.kick_evt.wait(wait):
                            tick = time.perf_counter()
                    self.kick_evt.clear()
                    if time.perf_counter() - tick > 0.2:
                        tick = time.perf_counter()
                    frame, t_cap = None, time.perf_counter()
                else:
                    if self.cam is None:
                        self._set(state="starting", message="Starting the webcam…")
                        cw, ch = self._capture_size(s, w, h)
                        opts = {k: v for k, v in (("fps", s.get("frameRate", 30)), ("pixel_format", s.get("pixelFormat", "auto")))
                                if v not in (30, "auto")}         # only non-default options (older factories still work)
                        cam_obj = self.camera_factory(s["cameraName"], cw, ch, **opts)
                        self.cam = Grabber(cam_obj)
                        self._set(captureInfo=getattr(cam_obj, "info", "") or f"{cw}×{ch}")
                        recontrol = True
                    if recontrol and hasattr(self.cam.camera, "apply_controls"):
                        self._set(controls=self.cam.camera.apply_controls(s))
                        seq = 0                          # a fresh webcam session starts counting again
                        self._set(cameraOn=True)
                    prev = seq
                    frame, seq, t_cap = self.cam.next(seq)
                    if prev and seq - prev > 1:
                        self.dropped += seq - prev - 1   # webcam frames that arrived while we were still busy
                    only_present = not in_use and not previewing and awake
                    if only_present and time.perf_counter() - self._last_proc < 1 / max(1, s.get("presentFps", 15)):
                        continue                         # only the Presentation window needs pictures: its rate is enough
                    self._last_proc = time.perf_counter()
                t0 = time.perf_counter()
                zoom = float(s.get("zoom") or 1.0)
                if frame is not None:
                    self._set(inputSize=f"{frame.shape[1]}×{frame.shape[0]}")
                if frame is not None and (frame.shape[1] != w or frame.shape[0] != h or zoom > 1.0001):
                    frame = fit_cover(frame, w, h, zoom)  # crop + zoom + resize in one resample; no stretching
                if frame is not None and s["mirror"]:
                    frame = cv2.flip(frame, 1)
                if frame is not None:
                    frame = picture.fix_range(frame, s.get("colorRange"))
                strength = s.get("blurStrength", 0) or 0
                if frame is not None and strength > 0:     # background first: the person mask sees the true colours
                    if self.blur is None and self.blur_factory:
                        self.blur = self.blur_factory()
                    if self.blur:
                        # 26.11.9 always the natural blur (no halo); keeping up only makes it cheaper, never changes the look
                        self.blur.period = 0.2 if (self.pace.level >= 1 or self.guard_busy) else 0.1
                        self.blur.coarse = self.pace.level >= 2
                        frame = self.blur.apply(frame, strength, "natural")
                grade = s.get("grade")
                if frame is not None and grade is not None:   # filter (Camera Look x intensity): the webcam picture only
                    frame = grade.apply(frame)
                adjust = self._adjustments(s)
                if frame is not None and adjust is not None:  # user adjustments, sharpness last
                    frame = adjust.apply(frame)
                if self.compositor:
                    frame = self.compositor.compose(frame, w, h)    # layout + layers + cards = the final picture
                elif self.overlay:
                    frame = self.overlay(frame)
                frame = np.ascontiguousarray(frame)
                if in_use:
                    self.sink.send(frame)
                lat_sum += time.perf_counter() - t_cap
                if time.perf_counter() - t0 > 1 / max(1, s.get("frameRate") or 30):
                    self.late += 1                           # this frame missed its slot (the next webcam frame waits)
                if self.compositor:
                    self.compositor.after_send(frame)         # test recording
                busy += time.perf_counter() - t0
                frames += 1
                pw = min(960 if time.time() < self.sharp_until else 640, w)   # previews: clear but light (only while a preview is open)
                unchanged = (self.compositor is not None and self.preview_jpeg is not None and self._preview_w == pw
                             and self.compositor.last_change < self.preview_t)          # nothing new to show
                if previewing and not unchanged and (self.preview_jpeg is None or frames % 3 == 0):
                    small = frame if pw == w else cv2.resize(frame, (pw, int(pw * h / w)), interpolation=cv2.INTER_AREA)
                    ok, jpg = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    if ok:
                        self.preview_jpeg = jpg.tobytes()
                        self._preview_w = pw
                        self.preview_ver += 1
                        self.preview_t = time.time()
                now = time.time()
                if now - t_window >= 1.0:
                    self._set(lookMs=round(s["grade"].ms, 1) if s.get("grade") is not None else 0.0,
                              adjustMs=round(adjust.ms, 1) if adjust is not None else 0.0, lateFrames=self.late,
                              outputSize=f"{w}×{h}", outputFormat="RGB24 (FRAMEDECKS)",
                              outputPacing="steady " + str(s.get("frameRate") or 30) + " fps" if s.get("outputPacing") == "fixed" else "follows the webcam")
                    if frame is not None:
                        lo, hi = picture.levels(frame)
                        self._set(blackLevel=lo, whiteLevel=hi)
                    cpu = (time.process_time() - cpu_t0) / max(0.001, now - cpu_w0) / max(1, os.cpu_count() or 1) * 100
                    cpu_t0, cpu_w0 = time.process_time(), now
                    self._set(captureFps=self.cam.fps if self.cam else 0.0, dropped=self.dropped,
                              latencyMs=round(lat_sum / max(frames, 1) * 1000, 1), cpuPercent=round(cpu, 1))
                    lat_sum = 0.0
                    fps_now, ms_now = round(frames / (now - t_window), 1), round(busy / max(frames, 1) * 1000, 1)
                    lvl = self.pace.update(fps_now, ms_now, s.get("frameRate") or 30, bool(in_use and (s.get("blurStrength") or 0) > 0))
                    self._set(fps=fps_now, msPerFrame=ms_now, lighterBlur=lvl,
                              blurMs=round(self.blur.model_ms, 1) if self.blur and (s.get("blurStrength") or 0) > 0 else 0.0)
                    frames, busy, t_window = 0, 0.0, now
                self._set(state="live" if in_use else "preview",
                          message="In use by Zoom or Teams" if in_use else "Preview")
            except Exception as e:
                self._close_camera()
                self._set(state="error", message=str(e) or type(e).__name__, fps=0.0)
                time.sleep(5.0)                          # try again shortly (e.g. the other app lets go of the webcam)
        self._close_camera()
