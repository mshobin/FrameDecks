"""FrameDecks 26.11.28 - light and framing hints for the ready check (src/ready_check.py).

From one webcam picture (the one people will see, after mirroring): is the face lit, is the room behind brighter than
the face, and is the face in the middle at a comfortable size. Gentle suggestions only; nothing is changed by itself.
Runs only while the ready check is open (VCamEngine.want_hints), at most every HINT_EVERY seconds, on a small copy of
the picture (a few milliseconds). The face is found with OpenCV's own frontal-face model when it is there; without it,
only the light is judged. Nothing is kept or sent anywhere."""
import time

try:
    import cv2
    import numpy as np
except Exception:          # the hints are optional: a PC without OpenCV still has the rest of the ready check
    cv2 = np = None

HINT_EVERY = 1.5           # seconds between two looks
WIDTH = 320                # the small copy the look is taken on
DARK = 70                  # mean brightness (0-255) of the face below which it reads as dark
BACKLIT = 45               # the room this much brighter than the face: a window or a lamp behind
_face = None


def _detector():
    global _face
    if _face is None:
        _face = False
        try:
            path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            c = cv2.CascadeClassifier(path)
            if not c.empty():
                _face = c
        except Exception:
            _face = False
    return _face or None


def look(frame, find_face=True):
    """One picture (BGR) -> {"light": ok|dark|backlit, "face": bool|None, "x", "y", "size" (0-1, or None), "tips": [...]}"""
    if cv2 is None or frame is None or getattr(frame, "size", 0) == 0:
        return None
    h, w = frame.shape[:2]
    small = cv2.resize(frame, (WIDTH, max(1, round(h * WIDTH / w))), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    whole = float(gray.mean())
    out = {"light": "ok", "face": None, "x": None, "y": None, "size": None, "tips": [], "brightness": round(whole)}
    det = _detector() if find_face else None
    faces = []
    if det is not None:
        try:
            faces = det.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(24, 24))
        except Exception:
            faces = []
        out["face"] = len(faces) > 0
    sh, sw = gray.shape[:2]
    if len(faces):
        fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        face = float(gray[fy:fy + fh, fx:fx + fw].mean())
        out.update(x=round((fx + fw / 2) / sw, 3), y=round((fy + fh / 2) / sh, 3), size=round(fh / sh, 3))
        if face < DARK:
            out["light"] = "dark"
        elif whole - face > BACKLIT:
            out["light"] = "backlit"
    elif whole < DARK - 10:
        out["light"] = "dark"
    out["tips"] = tips(out)
    return out


def tips(o):
    """The look -> plain suggestions, the most useful first (at most three)."""
    t = []
    if o["light"] == "dark":
        t.append("Your face is in shadow. Turn on a lamp in front of you, or face a window.")
    elif o["light"] == "backlit":
        t.append("The light behind you is brighter than your face. Close the curtain behind you, or turn so the window is in front.")
    if o["face"] is False:
        t.append("The camera can't see a face. Check it points at you and nothing covers it.")
    elif o["face"]:
        if o["x"] < 0.32:
            t.append("You're near the left edge of the picture. Move toward the middle.")
        elif o["x"] > 0.68:
            t.append("You're near the right edge of the picture. Move toward the middle.")
        if o["size"] > 0.55:
            t.append("You're very close to the camera. Sit back a little.")
        elif o["size"] < 0.14:
            t.append("You're far from the camera. Come a little closer.")
        if o["y"] > 0.6:
            t.append("The camera looks down on you. Raise it to about eye level.")
    return t[:3]


class HintWatcher:
    """Kept by the vCam engine: the latest look, refreshed only while someone wants it."""
    def __init__(self, clock=time.monotonic):
        self.clock, self.until, self.at, self.last = clock, 0.0, float("-inf"), None

    def want(self, seconds=8.0):
        self.until = max(self.until, self.clock() + seconds)

    def wanted(self):
        return self.clock() < self.until

    def maybe(self, frame):
        now = self.clock()
        if now >= self.until or now - self.at < HINT_EVERY or frame is None:
            return
        self.at = now
        try:
            self.last = dict(look(frame) or {}, at=time.time())
        except Exception:
            self.last = None

    def get(self, max_age=6.0):
        return self.last if self.last and time.time() - self.last.get("at", 0) < max_age else None
