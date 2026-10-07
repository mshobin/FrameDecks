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

TYPES = ("image", "video", "pdf", "window", "camera", "screen", "text", "rect", "ellipse", "background")
LIVE = ("camera", "screen")                  # drawn from live pictures every frame
DEFAULT = {"visible": True, "locked": False, "x": 0.5, "y": 0.5, "w": 0.3, "h": 0.0, "rotation": 0.0, "opacity": 1.0,
           "radius": 0.0, "loop": True, "page": 0}
PROPS = {   # type-specific settings, all optional
    "text": {"text": "Your text here", "font": "sans", "size": 0.06, "color": "#ffffff", "weight": 700,
             "align": "center", "bg": "", "bgOpacity": 0.6},
    "rect": {"fill": "#14284a", "fillOpacity": 0.9, "stroke": "#e3b75a", "strokeWidth": 0},
    "ellipse": {"fill": "#e3b75a", "fillOpacity": 1.0, "stroke": "#ffffff", "strokeWidth": 0},
    "background": {"color": "#0b1222"},
    "camera": {"fit": "cover", "mirror": False},
    "screen": {"fit": "contain"},
}
HEX = __import__("re").compile(r"^#[0-9a-fA-F]{6}$")


def _clean_props(t, p):
    base = dict(PROPS.get(t, {}))
    p = p if isinstance(p, dict) else {}
    for k, dv in base.items():
        v = p.get(k, dv)
        if isinstance(dv, bool):
            base[k] = bool(v)
        elif isinstance(dv, (int, float)) and not isinstance(dv, bool):
            try:
                v = float(v)
            except (TypeError, ValueError):
                v = dv
            lim = {"size": (0.01, 0.5), "weight": (100, 900), "fillOpacity": (0, 1), "bgOpacity": (0, 1), "strokeWidth": (0, 40)}.get(k, (-1e9, 1e9))
            base[k] = min(lim[1], max(lim[0], v)) if v == v else dv
        elif k in ("color", "fill", "stroke", "bg"):
            base[k] = v if isinstance(v, str) and (HEX.match(v) or (k == "bg" and v == "")) else dv
        elif k == "font":
            base[k] = v if v in ("sans", "serif") else dv
        elif k == "align":
            base[k] = v if v in ("left", "center", "right") else dv
        elif k == "fit":
            base[k] = v if v in ("cover", "contain") else dv
        else:
            base[k] = str(v)[:500]
    return base


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
            lim = {"x": (-0.5, 1.5), "y": (-0.5, 1.5), "w": (0.01, 2.0), "h": (0.0, 2.0), "rotation": (-360, 360), "opacity": (0, 1),
                   "radius": (0.0, 0.5)}[k]
            out[k] = min(lim[1], max(lim[0], val)) if val == val else v
    if out["type"] in PROPS:
        out["props"] = _clean_props(out["type"], d.get("props"))
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
    def __init__(self, folder, fonts_dir=None):
        self.folder = Path(folder)
        self.fonts = Path(fonts_dir) if fonts_dir else Path(__file__).resolve().parent.parent / "app" / "fonts"
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
            for key in list(self.cache):                       # free every cached picture of deleted layers
                if key.split(":")[0] not in keep:
                    self.cache.pop(key, None)

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
    def compose(self, frame, cam=None, screen=None, variables=None, cam_ver=0, screen_ver=0, stack=None):
        """Draw the visible layers (bottom first) onto frame. cam/screen: the live pictures for camera/screen layers."""
        H, W = frame.shape[:2]
        if stack is None:
            with self.lock:
                stack = [dict(l) for l in self.layers]
        for l in stack:
            if not l.get("visible", True) or l.get("opacity", 1) <= 0:
                continue
            t = l["type"]
            try:
                if t == "background":
                    col = _hex_bgr(l.get("props", {}).get("color", "#0b1222"))
                    frame[:] = col
                    continue
                if t == "camera":
                    if cam is None:
                        continue
                    img, ver = cam, cam_ver
                elif t == "screen":
                    if screen is None:
                        continue
                    img, ver = screen, screen_ver
                elif t in ("text", "rect", "ellipse"):
                    img, ver = self._generated(l, W, H, variables or {}), 0
                else:
                    s = self._source(l)
                    if s is None:
                        continue
                    if isinstance(s, PdfSource):
                        s.want_width(l["w"] * W)
                    img, ver = s.frame()
                if img is None:
                    continue
                if t in LIVE and self._fast_paste(frame, img, l, W, H, ver):
                    continue
                key = (id(img) if t in ("text", "rect", "ellipse") else ver, W, H, l["x"], l["y"], l["w"], l["h"], l["rotation"],
                       l["opacity"], l["radius"], str(l.get("props")))
                c = self.cache.get(l["id"])
                if c is None or c[0] != key or t in LIVE:
                    c = (key,) + _transform(img, l, W, H)
                    self.cache[l["id"]] = c
                _, layer, x0, y0 = c
                _blend(frame, layer, x0, y0)
            except Exception as e:                       # one broken layer never stops the camera
                self.errors[l["id"]] = str(e)
        return frame

    def _fast_paste(self, frame, img, l, W, H, ver=None):
        """Camera/screen in an upright box (no rotation or fade): copy it straight in. Rounded corners only
        blend the four small corner squares, never the whole picture."""
        if abs(l["rotation"]) > 0.01 or l["opacity"] < 0.999:
            return False
        p = l.get("props", {})
        fit = p.get("fit", "cover")
        bw, bh = _box(img, l, W, H)
        if fit == "contain" and abs(img.shape[1] / img.shape[0] - bw / bh) >= 0.01:
            k = min(bw / img.shape[1], bh / img.shape[0])            # letterbox: the picture itself is the box
            cx, cy = l["x"] * W, l["y"] * H
            bw, bh = max(2, int(round(img.shape[1] * k))), max(2, int(round(img.shape[0] * k)))
            x0, y0 = int(round(cx - bw / 2)), int(round(cy - bh / 2))
        else:
            x0, y0 = int(round(l["x"] * W - bw / 2)), int(round(l["y"] * H - bh / 2))
        if x0 < 0 or y0 < 0 or x0 + bw > W or y0 + bh > H:
            return False
        r = min(int(round(l["radius"] * H)), bw // 2, bh // 2)
        corners = []
        if r > 0:                                                    # keep what is behind the four corners
            for (cy0, cx0) in ((y0, x0), (y0, x0 + bw - r), (y0 + bh - r, x0), (y0 + bh - r, x0 + bw - r)):
                corners.append((cy0, cx0, frame[cy0:cy0 + r, cx0:cx0 + r].copy()))
        key = (ver, bw, bh, fit, bool(p.get("mirror")))
        hit = self.cache.get(l["id"] + ":fast")
        if l["type"] == "screen" and ver not in (None, -1) and hit and hit[0] == key:
            pic = hit[1]                                             # the screen didn't change: reuse the resized picture
        else:
            src = img[..., :3]
            if src.shape[:2] == (bh, bw):
                pic = src
            elif fit == "cover":
                pic = _cover(src, bw, bh)
            else:
                pic = cv2.resize(src, (bw, bh), interpolation=cv2.INTER_AREA if bw < src.shape[1] else cv2.INTER_LINEAR)
            if p.get("mirror"):
                pic = cv2.flip(pic, 1)
            if l["type"] == "screen":
                self.cache[l["id"] + ":fast"] = (key, pic)
        frame[y0:y0 + bh, x0:x0 + bw] = pic
        if r > 0:
            m = _round_mask(2 * r, 2 * r, r)                         # a circle: its quarters are the corner masks
            for i, (cy0, cx0, behind) in enumerate(corners):
                q = m[(i // 2) * r:(i // 2) * r + r, (i % 2) * r:(i % 2) * r + r]
                q3 = cv2.merge([q, q, q])
                roi = frame[cy0:cy0 + r, cx0:cx0 + r]
                frame[cy0:cy0 + r, cx0:cx0 + r] = cv2.add(cv2.multiply(roi, q3, scale=1 / 255.0),
                                                           cv2.multiply(behind, cv2.bitwise_not(q3), scale=1 / 255.0))
        return True

    def _generated(self, l, W, H, variables):
        """Text, rectangle and ellipse pictures (BGRA), cached until their look or text changes."""
        p = l.get("props", {})
        text = _resolve(p.get("text", ""), variables) if l["type"] == "text" else ""
        key = ("gen", l["type"], W, H, l["w"], l["h"], l["radius"], str(p), text)
        c = self.cache.get(l["id"] + ":gen")
        if c and c[0] == key:
            return c[1]
        img = _draw_text(text, p, l, W, H, self.fonts) if l["type"] == "text" else _draw_shape(l, p, W, H)
        self.cache[l["id"] + ":gen"] = (key, img)
        return img


# ---------- helpers ----------
def _hex_bgr(h):
    h = h.lstrip("#")
    return (int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16))


def _resolve(text, variables):
    import re as _re
    return _re.sub(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}", lambda m: str(variables.get(m.group(1), m.group(0))), text)


def _box(img, l, W, H):
    """Pixel size of a layer's box: width from w; height from h, or from the picture's shape when h is 0."""
    bw = max(2, int(round(l["w"] * W)))
    if l.get("h", 0) > 0:
        bh = max(2, int(round(l["h"] * H)))
    else:
        bh = max(2, int(round(bw * img.shape[0] / img.shape[1])))
    return bw, bh


def _cover(img, w, h):
    ih, iw = img.shape[:2]
    k = max(w / iw, h / ih)
    r = cv2.resize(img, (max(w, int(round(iw * k))), max(h, int(round(ih * k)))),
                   interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_LINEAR)   # shrinking: area averaging (crisper)
    y0, x0 = (r.shape[0] - h) // 2, (r.shape[1] - w) // 2
    return r[y0:y0 + h, x0:x0 + w]


def _contain(img, w, h):
    """Fit inside w x h; the empty part is transparent. Returns BGRA."""
    ih, iw = img.shape[:2]
    k = min(w / iw, h / ih)
    nw, nh = max(1, int(round(iw * k))), max(1, int(round(ih * k)))
    small = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_LINEAR)
    if small.shape[2] == 3:
        small = cv2.cvtColor(small, cv2.COLOR_BGR2BGRA)
    out = np.zeros((h, w, 4), np.uint8)
    y0, x0 = (h - nh) // 2, (w - nw) // 2
    out[y0:y0 + nh, x0:x0 + nw] = small
    return out


_masks = {}


def _round_mask(w, h, r):
    """Anti-aliased rounded-corner mask (uint8), cached by size."""
    key = (w, h, r)
    m = _masks.get(key)
    if m is None:
        from PIL import Image, ImageDraw
        big = Image.new("L", (w * 2, h * 2), 0)
        ImageDraw.Draw(big).rounded_rectangle([0, 0, w * 2 - 1, h * 2 - 1], radius=r * 2, fill=255)
        m = np.asarray(big.resize((w, h), Image.LANCZOS))
        if len(_masks) > 64:
            _masks.clear()
        _masks[key] = m
    return m


def _draw_shape(l, p, W, H):
    from PIL import Image, ImageDraw
    bw = max(2, int(round(l["w"] * W)))
    bh = max(2, int(round((l["h"] or l["w"] * W / H) * H)))
    k = 2                                                       # drawn at 2x for smooth edges
    img = Image.new("RGBA", (bw * k, bh * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fill = tuple(int(p["fill"][i:i + 2], 16) for i in (1, 3, 5)) + (int(255 * p["fillOpacity"]),)
    stroke = tuple(int(p["stroke"][i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    sw = int(round(p["strokeWidth"] * H / 1080 * k))
    box = [0, 0, bw * k - 1, bh * k - 1]
    if l["type"] == "ellipse":
        d.ellipse(box, fill=fill, outline=stroke if sw else None, width=sw)
    else:
        d.rounded_rectangle(box, radius=int(l["radius"] * H * k), fill=fill, outline=stroke if sw else None, width=sw)
    a = np.asarray(img.resize((bw, bh), Image.LANCZOS))
    return np.ascontiguousarray(a[..., [2, 1, 0, 3]])          # RGBA -> BGRA


def _draw_text(text, p, l, W, H, fonts_dir):
    from PIL import Image, ImageDraw
    from .cards import Fonts, wrap
    fonts = Fonts(fonts_dir)
    fs = p["size"] * H
    font = fonts.get(p["font"], int(p["weight"]), fs)
    bw = max(4, int(round(l["w"] * W)))
    pad = fs * 0.35
    lines = wrap(text, font, max(10, bw - 2 * pad)) if text else [(0, 0)]
    lh = fs * 1.25
    bh = int(round(l["h"] * H)) if l.get("h", 0) > 0 else int(round(len(lines) * lh + 2 * pad))
    img = Image.new("RGBA", (bw, max(4, bh)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if p.get("bg"):
        bg = tuple(int(p["bg"][i:i + 2], 16) for i in (1, 3, 5)) + (int(255 * p["bgOpacity"]),)
        d.rounded_rectangle([0, 0, bw - 1, bh - 1], radius=int(l["radius"] * H), fill=bg)
    col = tuple(int(p["color"][i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    y = (bh - len(lines) * lh) / 2
    asc, desc = font.getmetrics()
    for a, b in lines:
        s_ = text[a:b]
        tw = font.getlength(s_)
        x = pad if p["align"] == "left" else (bw - pad - tw if p["align"] == "right" else (bw - tw) / 2)
        d.text((x, y + (lh - asc - desc) / 2), s_, font=font, fill=col)
        y += lh
    return np.ascontiguousarray(np.asarray(img)[..., [2, 1, 0, 3]])


def _transform(img, l, W, H):
    """Fit the source into its box, round the corners, rotate, fade; premultiplied 8-bit, placed by its centre."""
    t = l["type"]
    bw, bh = _box(img, l, W, H)
    if img.shape[2] == 4 and img.shape[1] == bw and img.shape[0] == bh:
        src = img
    elif t in ("camera",) or l.get("props", {}).get("fit") == "cover":
        src = _cover(img[..., :3], bw, bh)
        if l.get("props", {}).get("mirror"):
            src = cv2.flip(src, 1)
    elif l.get("h", 0) > 0 or img.shape[2] == 4 and (img.shape[1] != bw or img.shape[0] != bh):
        src = _contain(img, bw, bh)
    else:
        interp = cv2.INTER_AREA if bw < img.shape[1] else cv2.INTER_LINEAR
        src = cv2.resize(img, (bw, bh), interpolation=interp)
    if src.shape[2] == 4:
        bgr, a = src[..., :3], src[..., 3].copy()
    else:
        bgr, a = src, np.full(src.shape[:2], 255, np.uint8)
    if l.get("radius", 0) > 0 and t not in ("rect", "text"):          # rect/text draw their own corners
        r = int(round(l["radius"] * H))
        a = cv2.multiply(a, _round_mask(bw, bh, min(r, bw // 2, bh // 2)), scale=1 / 255.0)
    tw, th = bw, bh
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
    colour = cv2.multiply(np.ascontiguousarray(bgr), a3, scale=1 / 255.0)          # premultiply once
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
