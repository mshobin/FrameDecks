"""Layers for BCC vCam: images, videos and presentations stacked on top of the base picture
(camera / screen layout), under the verse, question and birthday cards.

A layer is plain data (saved in scenes):
  {id, type: image|video|pdf|window, name, file | hwnd, visible, x, y (centre, 0..1 of the picture),
   w (width as a fraction of the picture), rotation (degrees), opacity (0..1), loop, page}
Each layer's transformed picture is cached (premultiplied, 8-bit) and rebuilt only when its source or
transform changes, so a still logo costs one quick blend per frame. Videos decode on their own thread.
"""
import math
import os
import threading
import time
from pathlib import Path

import cv2
import numpy as np

TYPES = ("image", "video", "pdf", "window")
DEFAULT = {"visible": True, "x": 0.5, "y": 0.5, "w": 0.3, "rotation": 0.0, "opacity": 1.0, "loop": True, "page": 0}


def clean_layer(d):
    out = {"id": str(d.get("id", ""))[:40], "type": d.get("type") if d.get("type") in TYPES else "image",
           "name": str(d.get("name") or "Layer")[:60], "file": str(d.get("file") or "")[:200]}
    for k, v in DEFAULT.items():
        val = d.get(k, v)
        if isinstance(v, bool):
            out[k] = bool(val)
        elif isinstance(v, int) and not isinstance(v, bool):
            try:
                out[k] = max(0, int(val))
            except (TypeError, ValueError):
                out[k] = v
        else:
            try:
                val = float(val)
            except (TypeError, ValueError):
                val = v
            lim = {"x": (-0.5, 1.5), "y": (-0.5, 1.5), "w": (0.02, 1.5), "rotation": (-360, 360), "opacity": (0, 1)}[k]
            out[k] = min(lim[1], max(lim[0], val)) if val == val else v
    if d.get("hwnd") is not None:
        try:
            out["hwnd"] = int(d["hwnd"])
        except (TypeError, ValueError):
            pass
    return out


# ---------- sources ----------
class ImageSource:
    def __init__(self, path):
        img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if img is None:
            raise RuntimeError("The picture could not be opened.")
        if img.ndim == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
        elif img.shape[2] == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        self.img, self.version, self.info = img, 1, f"{img.shape[1]}×{img.shape[0]}"

    def frame(self):
        return self.img, self.version

    def close(self):
        pass


class VideoSource:
    """Decodes on its own thread at the video's own pace (never on the UI or camera thread). Muted: no audio is read."""
    def __init__(self, path, loop=True):
        self.path, self.loop = str(path), loop
        self.cmd = "play"
        self.img, self.version = None, 0
        self.hw = "checking"
        self.info = ""
        self.fps = 0.0
        self.ended = False
        self.alive = True
        self.lock = threading.Lock()
        threading.Thread(target=self._run, name="bcc-video", daemon=True).start()

    def control(self, cmd):
        if cmd in ("play", "pause", "stop", "restart"):
            if cmd in ("play", "restart") and (self.ended or cmd == "restart"):
                self.ended = False
                self.cmd = "restart"
            else:
                self.cmd = cmd

    def _open(self):
        params = []
        if hasattr(cv2, "CAP_PROP_HW_ACCELERATION"):
            params = [cv2.CAP_PROP_HW_ACCELERATION, cv2.VIDEO_ACCELERATION_ANY]
        cap = cv2.VideoCapture(self.path, cv2.CAP_FFMPEG, params) if params else cv2.VideoCapture(self.path)
        if not cap.isOpened():
            cap = cv2.VideoCapture(self.path)
        if not cap.isOpened():
            raise RuntimeError("The video could not be opened (unsupported format?).")
        acc = int(cap.get(cv2.CAP_PROP_HW_ACCELERATION)) if params else 0
        self.hw = "hardware decoding" if acc not in (0, -1) else "software decoding (CPU)"
        fps = cap.get(cv2.CAP_PROP_FPS)
        self.src_fps = fps if 1 <= fps <= 120 else 30.0
        self.info = f"{int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}×{int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))} · {self.src_fps:.0f} fps · {self.hw}"
        return cap

    def _run(self):
        try:
            cap = self._open()
        except Exception as e:
            self.info = str(e)
            return
        period = 1.0 / self.src_fps
        nxt = time.perf_counter()
        n, t0 = 0, time.time()
        while self.alive:
            cmd = self.cmd
            if cmd == "restart":
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                self.cmd = "play"
                nxt = time.perf_counter()
                continue
            if cmd == "stop":
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                with self.lock:
                    self.img = None
                    self.version += 1
                self.cmd = "stopped"
                continue                                # stay stopped: don't read the first frame again
            if cmd in ("pause", "stopped"):
                time.sleep(0.05)
                nxt = time.perf_counter()
                continue
            ok, f = cap.read()
            if not ok:
                if self.loop:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                self.ended = True                       # play once: hide at the end (e.g. an intro bumper)
                self.cmd = "stop"
                continue
            with self.lock:
                self.img = f
                self.version += 1
            n += 1
            if time.time() - t0 >= 1:
                self.fps, n, t0 = round(n / (time.time() - t0), 1), 0, time.time()
            nxt += period
            delay = nxt - time.perf_counter()
            if delay > 0:
                time.sleep(delay)
            else:
                nxt = time.perf_counter()               # running late: don't try to catch up in a burst
        cap.release()

    def frame(self):
        with self.lock:
            return self.img, self.version

    def close(self):
        self.alive = False


class PdfSource:
    """Slides from a PDF (export from PowerPoint: File > Export > PDF). Rendered once per page and size."""
    def __init__(self, path):
        import pypdfium2 as pdfium
        self.doc = pdfium.PdfDocument(str(path))
        self.pages = len(self.doc)
        self.page, self.width = 0, 1280
        self.img, self.version, self.info = None, 0, f"{self.pages} slides"
        self.lock = threading.Lock()
        self._render()

    def _render(self):
        pg = self.doc[self.page]
        w, h = pg.get_size()
        bm = pg.render(scale=self.width / max(1.0, w))
        img = np.ascontiguousarray(bm.to_numpy()[..., :3])
        with self.lock:
            self.img, self.version = img, self.version + 1

    def go(self, page):
        page = max(0, min(self.pages - 1, page))
        if page != self.page:
            self.page = page
            self._render()
        return self.page

    def want_width(self, px):
        px = int(min(3840, max(320, px)))
        if abs(px - self.width) > 32:
            self.width = px
            self._render()

    def frame(self):
        with self.lock:
            return self.img, self.version

    def close(self):
        self.doc.close()


class WindowSource:
    """A captured window (e.g. a PowerPoint slide show) with Next/Previous through PowerPoint's own commands."""
    def __init__(self, hwnd, name):
        from .screen import ScreenCapture
        self.hwnd, self.name = hwnd, name
        self.cap = ScreenCapture({"kind": "window", "hwnd": hwnd, "name": name})
        self.info = "window capture"

    def frame(self):
        f, i = self.cap.latest()
        return f, i

    def slide(self, step):
        return powerpoint_slide(step, self.hwnd)

    def close(self):
        self.cap.stop()


def powerpoint_slide(step, hwnd=None):
    """Next (+1) / Previous (-1) in a running PowerPoint slide show. Falls back to Page Down/Up sent to the window."""
    if os.name != "nt":
        return "Only on Windows"
    try:
        import comtypes.client
        app = comtypes.client.GetActiveObject("PowerPoint.Application")
        if app.SlideShowWindows.Count >= 1:
            view = app.SlideShowWindows(1).View
            (view.Next if step > 0 else view.Previous)()
            return "ok"
    except Exception:
        pass
    if hwnd:
        import ctypes
        vk = 0x22 if step > 0 else 0x21                     # VK_NEXT / VK_PRIOR (Page Down / Page Up)
        ctypes.windll.user32.PostMessageW(int(hwnd), 0x0100, vk, 0)
        ctypes.windll.user32.PostMessageW(int(hwnd), 0x0101, vk, 0)
        return "sent keys"
    return "No PowerPoint slide show found"


# ---------- the stack ----------
class LayerManager:
    def __init__(self, folder):
        self.folder = Path(folder)
        self.layers = []                 # list of layer dicts, bottom first
        self.sources = {}                # id -> source object
        self.cache = {}                  # id -> (key, (colour, alpha, inv3), x0, y0)
        self.errors = {}
        self.lock = threading.Lock()

    def set_layers(self, layers):
        """Replace the stack (from the UI or a scene). Sources are reused when the file is unchanged."""
        with self.lock:
            new = [clean_layer(l) for l in layers if l.get("id")]
            keep = {l["id"]: l for l in new}
            for lid in list(self.sources):
                old = next((l for l in self.layers if l["id"] == lid), None)
                n = keep.get(lid)
                if n is None or old is None or (n["file"], n.get("hwnd"), n["type"]) != (old["file"], old.get("hwnd"), old["type"]):
                    self.sources.pop(lid).close()
                    self.cache.pop(lid, None)
                elif n["type"] == "video" and isinstance(self.sources[lid], VideoSource):
                    self.sources[lid].loop = n["loop"]
            self.layers = new

    def _source(self, l):
        s = self.sources.get(l["id"])
        if s is not None:
            return s
        try:
            if l["type"] == "window":
                s = WindowSource(l.get("hwnd"), l["name"])
            else:
                path = self.folder / l["file"]
                if not path.is_file():
                    raise RuntimeError("The file is missing: " + l["file"])
                s = {"image": ImageSource, "pdf": PdfSource}.get(l["type"], None)
                s = s(path) if s else VideoSource(path, l["loop"])
                if isinstance(s, PdfSource):
                    s.go(l.get("page", 0))
            self.errors.pop(l["id"], None)
        except Exception as e:
            self.errors[l["id"]] = str(e)
            s = None
        if s is not None:
            self.sources[l["id"]] = s
        return s

    def control(self, lid, cmd):
        s = self.sources.get(lid)
        if isinstance(s, VideoSource):
            s.control(cmd)
            return True
        return False

    def slide(self, lid, step):
        """Next/Previous for a presentation layer. Returns the new page (PDF) or a status."""
        with self.lock:
            l = next((x for x in self.layers if x["id"] == lid), None)
        s = self.sources.get(lid)
        if l is None or s is None:
            return None
        if isinstance(s, PdfSource):
            l["page"] = s.go(s.page + step)
            return {"page": l["page"] + 1, "pages": s.pages}
        if isinstance(s, WindowSource):
            return {"result": s.slide(step)}
        return None

    def status(self):
        out = {}
        for l in self.layers:
            s = self.sources.get(l["id"])
            st = {"error": self.errors.get(l["id"], "")}
            if s is not None:
                st["info"] = getattr(s, "info", "")
                if isinstance(s, VideoSource):
                    st.update(state=s.cmd, decodeFps=s.fps, hw=s.hw, ended=s.ended)
                if isinstance(s, PdfSource):
                    st.update(page=s.page + 1, pages=s.pages)
                if isinstance(s, WindowSource):
                    st.update(captureFps=s.cap.fps, backend=s.cap.backend, error=s.cap.error or st["error"])
            out[l["id"]] = st
        return out

    # ----- per frame -----
    def compose(self, frame):
        H, W = frame.shape[:2]
        with self.lock:
            stack = [dict(l) for l in self.layers if l["visible"] and l["opacity"] > 0]
        for l in stack:
            s = self._source(l)
            if s is None:
                continue
            if isinstance(s, PdfSource):
                s.want_width(l["w"] * W)
            img, ver = s.frame()
            if img is None:
                continue
            key = (ver, W, H, l["x"], l["y"], l["w"], l["rotation"], l["opacity"])
            c = self.cache.get(l["id"])
            if c is None or c[0] != key:
                c = (key,) + _transform(img, l, W, H)
                self.cache[l["id"]] = c
            _, layer, x0, y0 = c
            _blend(frame, layer, x0, y0)
        return frame


def _transform(img, l, W, H):
    """Scale / rotate / fade a source into a premultiplied 8-bit layer, placed by its centre."""
    tw = max(2, int(round(l["w"] * W)))
    th = max(2, int(round(tw * img.shape[0] / img.shape[1])))
    interp = cv2.INTER_AREA if tw < img.shape[1] else cv2.INTER_LINEAR
    src = cv2.resize(img, (tw, th), interpolation=interp)
    if src.shape[2] == 4:
        bgr, a = src[..., :3], src[..., 3]
    else:
        bgr, a = src, np.full(src.shape[:2], 255, np.uint8)
    if abs(l["rotation"]) > 0.01:
        ang = -l["rotation"]
        c, s_ = abs(math.cos(math.radians(ang))), abs(math.sin(math.radians(ang)))
        nw, nh = int(tw * c + th * s_) + 2, int(tw * s_ + th * c) + 2
        M = cv2.getRotationMatrix2D((tw / 2, th / 2), ang, 1.0)
        M[0, 2] += (nw - tw) / 2
        M[1, 2] += (nh - th) / 2
        bgr = cv2.warpAffine(bgr, M, (nw, nh), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
        a = cv2.warpAffine(a, M, (nw, nh), flags=cv2.INTER_LINEAR, borderValue=0)
        tw, th = nw, nh
    if l["opacity"] < 0.999:
        a = cv2.convertScaleAbs(a, alpha=l["opacity"])
    a3 = cv2.merge([a, a, a])
    colour = cv2.multiply(bgr, a3, scale=1 / 255.0)          # premultiply once
    inv = cv2.bitwise_not(a)
    x0 = int(round(l["x"] * W - tw / 2))
    y0 = int(round(l["y"] * H - th / 2))
    return (colour, cv2.merge([inv, inv, inv])), x0, y0


def _blend(frame, layer, x0, y0):
    colour, inv3 = layer
    H, W = frame.shape[:2]
    h, w = inv3.shape[:2]
    fx0, fy0, fx1, fy1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if fx1 <= fx0 or fy1 <= fy0:
        return
    sy, sx = slice(fy0 - y0, fy1 - y0), slice(fx0 - x0, fx1 - x0)
    roi = frame[fy0:fy1, fx0:fx1]
    frame[fy0:fy1, fx0:fx1] = cv2.add(colour[sy, sx], cv2.multiply(roi, inv3[sy, sx], scale=1 / 255.0))
