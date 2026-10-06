"""BCC vCam engine.

webcam  ->  (mirror)  ->  (background blur)  ->  (overlay cards: stage 2)  ->  "BCC vCam"

The laptop webcam is opened only while an app (Zoom, Teams...) is showing BCC vCam or the preview
in Settings is open. Otherwise the webcam is released (its light goes off) and the engine just
checks twice a second whether it is needed, which costs almost nothing.
"""
import os
import threading
import time

# Must be set before OpenCV loads: makes opening laptop webcams faster and more reliable on some PCs
os.environ.setdefault("OPENCV_VIDEOIO_MSMF_ENABLE_HW_TRANSFORMS", "0")
import cv2
import numpy as np

SIZES = {"720p": (1280, 720), "1080p": (1920, 1080)}


class Camera:
    """The real webcam, read through Windows Media Foundation (BCC vCam itself never appears there,
    so the engine can't capture its own output)."""
    def __init__(self, index, width, height):
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
    """A moving test picture, used only for testing without a webcam (BSF_VCAM_DEMO=1)."""
    def __init__(self, index, width, height):
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
        except Exception:
            pass


class VCamEngine:
    def __init__(self, sink_factory, camera_factory=Camera, blur_factory=None, overlay=None, compositor=None):
        self.sink_factory = sink_factory          # (width, height) -> sink
        self.camera_factory = camera_factory      # (index, width, height) -> camera
        self.blur_factory = blur_factory          # () -> BackgroundBlur (loaded on first use)
        self.overlay = overlay                    # (frame) -> frame with cards drawn (used when there is no compositor)
        self.compositor = compositor              # layout + layers + cards, the one final picture
        self.dropped = 0
        self.settings = {"cameraName": "", "resolution": "720p", "mirror": False, "blur": "off", "blurStrength": 0}
        self.lock = threading.Lock()
        self.thread = None
        self.running = False
        self.sink = None
        self.cam = None
        self.blur = None
        self.preview_until = 0.0
        self.awake_until = 0.0                    # e.g. the Presentation window is open (no preview pictures needed)
        self.kick_evt = threading.Event()         # set when something changes (a card shown, a Studio edit)
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
        restart_sink = "resolution" in changes and changes["resolution"] != self.settings["resolution"]
        reopen = restart_sink or ("cameraName" in changes and changes["cameraName"] != self.settings["cameraName"])
        with self.lock:
            self.settings.update(changes)
            self._reopen = getattr(self, "_reopen", False) or reopen
            self._resink = getattr(self, "_resink", False) or restart_sink

    def kick(self):
        """Something changed: draw the next frame now (wakes the idle rhythm)."""
        self.kick_evt.set()

    def keep_awake(self, seconds=3.0):
        self.awake_until = time.time() + seconds

    def want_preview(self, seconds=3.0):
        self.preview_until = time.time() + seconds

    # ---------- internals ----------
    def _set(self, **kw):
        self.status.update(kw)

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
                    self._reopen = self._resink = False
                w, h = SIZES.get(s["resolution"], SIZES["720p"])
                if resink and self.sink:
                    self.sink.close()
                    self.sink = None
                if self.sink is None:
                    self.sink = self.sink_factory(w, h)
                if reopen:
                    self._close_camera()
                in_use = self.sink.connected()
                previewing = time.time() < self.preview_until
                awake = time.time() < self.awake_until
                self._set(inUse=in_use)
                if not in_use and not previewing and not awake:
                    if self.cam:
                        self._close_camera()            # webcam light goes off
                    self._set(state="ready", message="Ready. Choose “BCC vCam” as the camera in Zoom or Teams.", fps=0.0)
                    time.sleep(0.5)
                    continue
                need_cam = self.compositor.needs_camera() if self.compositor else True
                if not need_cam:                         # screen-only layout: the webcam is switched off
                    if self.cam:
                        self._close_camera()
                    # Idle rhythm: with no camera and nothing changing, and Zoom not using BCC vCam, check 5x a second
                    # instead of 30. Any change (kick) wakes it at once; changes keep it at 30 fps for 1.5 s.
                    idle = not in_use and self.compositor is not None and time.time() - self.compositor.last_change > 1.5
                    tick += 0.2 if idle else 1 / 30
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
                        self.cam = Grabber(self.camera_factory(s["cameraName"], w, h))
                        seq = 0                          # a fresh webcam session starts counting again
                        self._set(cameraOn=True)
                    prev = seq
                    frame, seq, t_cap = self.cam.next(seq)
                    if prev and seq - prev > 1:
                        self.dropped += seq - prev - 1   # webcam frames that arrived while we were still busy
                t0 = time.perf_counter()
                if frame is not None and (frame.shape[1] != w or frame.shape[0] != h):
                    frame = cv2.resize(frame, (w, h), interpolation=cv2.INTER_AREA)
                if frame is not None and s["mirror"]:
                    frame = cv2.flip(frame, 1)
                grade = s.get("grade")
                if frame is not None and grade is not None:   # Camera Look: the webcam picture only
                    frame = grade.apply(frame)
                strength = s.get("blurStrength", 0) or 0
                if frame is not None and strength > 0:
                    if self.blur is None and self.blur_factory:
                        self.blur = self.blur_factory()
                    if self.blur:
                        frame = self.blur.apply(frame, strength)
                if self.compositor:
                    frame = self.compositor.compose(frame, w, h)    # layout + layers + cards = the final picture
                elif self.overlay:
                    frame = self.overlay(frame)
                frame = np.ascontiguousarray(frame)
                if in_use:
                    self.sink.send(frame)
                lat_sum += time.perf_counter() - t_cap
                if self.compositor:
                    self.compositor.after_send(frame)         # test recording
                busy += time.perf_counter() - t0
                frames += 1
                if previewing and (self.preview_jpeg is None or frames % 3 == 0):
                    small = cv2.resize(frame, (480, int(480 * h / w)), interpolation=cv2.INTER_AREA)
                    ok, jpg = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    if ok:
                        self.preview_jpeg = jpg.tobytes()
                now = time.time()
                if now - t_window >= 1.0:
                    self._set(lookMs=round(s["grade"].ms, 1) if s.get("grade") is not None else 0.0)
                    cpu = (time.process_time() - cpu_t0) / max(0.001, now - cpu_w0) / max(1, os.cpu_count() or 1) * 100
                    cpu_t0, cpu_w0 = time.process_time(), now
                    self._set(captureFps=self.cam.fps if self.cam else 0.0, dropped=self.dropped,
                              latencyMs=round(lat_sum / max(frames, 1) * 1000, 1), cpuPercent=round(cpu, 1))
                    lat_sum = 0.0
                    self._set(fps=round(frames / (now - t_window), 1), msPerFrame=round(busy / max(frames, 1) * 1000, 1),
                              blurMs=round(self.blur.model_ms, 1) if self.blur and s["blur"] != "off" else 0.0)
                    frames, busy, t_window = 0, 0.0, now
                self._set(state="live" if in_use else "preview",
                          message="In use by Zoom or Teams" if in_use else "Preview")
            except Exception as e:
                self._close_camera()
                self._set(state="error", message=str(e) or type(e).__name__, fps=0.0)
                time.sleep(5.0)                          # try again shortly (e.g. the other app lets go of the webcam)
        self._close_camera()
