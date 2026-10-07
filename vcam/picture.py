"""Picture settings for BCC vCam: profiles, validation/migration, user adjustments and camera controls.

Settings schema (bsf-vcam-settings.json, "schemaVersion": 2). Version 1 files (no schemaVersion) keep working:
missing keys get defaults that reproduce the version-1 picture exactly (filterIntensity 100, zoom 1.0,
captureResolution "auto", every adjustment neutral, camera controls untouched).

Processing order in the engine (one resample, then per-pixel stages at output size):
    capture -> crop + zoom + resize (one high-quality resample) -> mirror -> colour-range fix
    -> background blur -> filter (Camera Look x intensity) -> adjustments -> layers/cards -> BCC vCam (RGB24)

Adjustments (this module) run in this order:
    1 exposure compensation  2 white balance (temperature/tint)          } per channel: one 256-entry
    3 brightness  4 contrast  5 gamma                                    } lookup table (cv2.LUT)
    6 saturation  7 vibrance  8 hue                                      } 3x3 matrices (+ vibrance)
    9 sharpness                                                          } unsharp mask, last
Exposure and white balance act on linear light (the table decodes sRGB, scales, re-encodes), so they behave
like a camera's own gain and white balance instead of tinting the shadows.
"""
import math
import time

import cv2
import numpy as np

SCHEMA_VERSION = 2

# key: (kind, allowed values or (lo, hi), default). Defaults = the version-1 picture (nothing changes).
FIELDS = {
    "outputProfile":        ("enum", ("custom", "meetings"), "custom"),
    "captureResolution":    ("enum", ("auto", "720p", "1080p"), "auto"),     # auto = same as the output size
    "frameRate":            ("enum", (15, 24, 30), 30),
    "pixelFormat":          ("enum", ("auto", "mjpg", "yuy2", "nv12"), "auto"),   # webcam mode to ask for
    "colorRange":           ("enum", ("auto", "expand-limited"), "auto"),
    "outputPacing":         ("enum", ("camera", "fixed"), "camera"),
    "framingMode":          ("enum", ("center", "centered-person"), "center"),
    "zoom":                 ("num", (1.0, 2.0), 1.0),
    "exposureMode":         ("enum", ("auto", "manual"), "auto"),
    "shutterSpeed":         ("num", (-13.0, 0.0), -6.0),       # OpenCV exposure units: log2(seconds), -6 = 1/64 s
    "gain":                 ("num", (0.0, 255.0), 0.0),        # camera units; manual exposure only
    "exposureCompensation": ("num", (-2.0, 2.0), 0.0),         # EV, applied by BCC (software)
    "whiteBalanceMode":     ("enum", ("auto", "manual"), "auto"),
    "whiteBalanceKelvin":   ("num", (2500.0, 7500.0), 4600.0), # manual white balance only (camera control)
    "temperature":          ("num", (-100.0, 100.0), 0.0),     # BCC fine-tune: warmer + / cooler -
    "tint":                 ("num", (-100.0, 100.0), 0.0),     # magenta + / green -
    "brightness":           ("num", (-100.0, 100.0), 0.0),
    "contrast":             ("num", (-100.0, 100.0), 0.0),
    "gamma":                ("num", (-100.0, 100.0), 0.0),     # + lifts mid-tones
    "saturation":           ("num", (-100.0, 100.0), 0.0),
    "vibrance":             ("num", (-100.0, 100.0), 0.0),     # saturation that spares already-strong colours
    "hue":                  ("num", (-180.0, 180.0), 0.0),     # degrees
    "sharpness":            ("num", (0.0, 100.0), 0.0),
    "backlightCompensation": ("enum", ("default", "off", "on"), "default"),
    "antiFlicker":          ("enum", ("off", "50", "60", "auto"), "off"),
    "spotlight":            ("bool", None, False),              # reserved: not implemented by BCC (always off)
    "retouch":              ("bool", None, False),              # reserved: not implemented by BCC (always off)
    "effects":              ("enum", ("none",), "none"),
    "filterIntensity":      ("num", (0.0, 100.0), 100.0),      # 100 = the Camera Look exactly as in version 1
}
ADJUSTMENTS = ("exposureCompensation", "temperature", "tint", "brightness", "contrast", "gamma",
               "saturation", "vibrance", "hue", "sharpness")
CAMERA_CONTROLS = ("exposureMode", "shutterSpeed", "gain", "whiteBalanceMode", "whiteBalanceKelvin",
                   "backlightCompensation", "antiFlicker")
NEEDS_REOPEN = ("captureResolution", "pixelFormat", "frameRate")
NEEDS_RESINK = ("outputPacing", "frameRate")

# Profiles only set what they name; everything else (webcam, blur, cards, mirror...) is left as it is.
PROFILES = {
    "meetings": {
        "name": "Meetings",
        "settings": {
            "resolution": "720p", "frameRate": 30, "captureResolution": "1080p", "framingMode": "centered-person",
            "zoom": 1.01, "exposureMode": "auto", "whiteBalanceMode": "auto", "spotlight": False, "retouch": False,
            "effects": "none", "look": "warm", "filterIntensity": 25, "antiFlicker": "off",
            **{k: FIELDS[k][2] for k in ADJUSTMENTS},
        },
    },
}


def clean(d):
    """Validated copy of the picture fields present in d (unknown keys and bad values are dropped)."""
    out = {}
    if not isinstance(d, dict):
        return out
    for k, (kind, allowed, _default) in FIELDS.items():
        if k not in d:
            continue
        v = d[k]
        if kind == "bool":
            if isinstance(v, bool):
                out[k] = v
        elif kind == "enum":
            if isinstance(v, str) and v.isdigit() and int(v) in allowed:
                v = int(v)
            if not isinstance(v, bool) and v in allowed:
                out[k] = v
        elif isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf"):
            lo, hi = allowed
            out[k] = round(min(hi, max(lo, float(v))), 3)
    for k in ("spotlight", "retouch"):           # not implemented: never claim they are on
        if k in out:
            out[k] = False
    return out


def defaults():
    return {k: v[2] for k, v in FIELDS.items()}


def migrate(raw):
    """Bring a stored settings dict up to the current schema. Version 1 had no schemaVersion; its pictures
    are reproduced exactly by the defaults. Returns (settings, changed)."""
    if not isinstance(raw, dict):
        return {}, False
    ver = raw.get("schemaVersion")
    out = dict(raw)
    changed = False
    if not isinstance(ver, int) or ver < 2:
        out.setdefault("filterIntensity", 100)
        out.setdefault("outputProfile", "custom")
        out["schemaVersion"] = SCHEMA_VERSION
        changed = True
    return out, changed


def profile_changes(pid):
    p = PROFILES.get(pid)
    return dict(p["settings"], outputProfile=pid) if p else None


def background_mode(blur_strength):
    return "blur" if (blur_strength or 0) > 0 else "none"


# ---------- Adjustments ----------
def _to_linear(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def _to_srgb(x):
    x = np.maximum(x, 0.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


TEMP_K, TINT_K = 0.0045, 0.004              # same scale as the Camera Looks' temperature/tint
LUMA = np.array([0.2126, 0.7152, 0.0722])  # Rec.709 (R, G, B)


def _wb_gains(t, n):
    return np.array([1 + TEMP_K * t + TINT_K * n * 0.5, 1 - TINT_K * n, 1 - TEMP_K * t + TINT_K * n * 0.5])  # R, G, B


def _sat_matrix(s):
    return (1 - s) * np.tile(LUMA, (3, 1)) + s * np.eye(3)


def _hue_matrix(deg):
    """Luma-preserving hue rotation (the W3C Filter Effects 'hue-rotate' matrix), RGB order."""
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([
        [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
        [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283],
        [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]])


def _bgr(m):
    """An RGB-order 3x3 matrix as the equivalent matrix for BGR pixels."""
    p = np.array([[0, 0, 1], [0, 1, 0], [1, 0, 0]], dtype=np.float64)
    return p @ m @ p


def curves(a):
    """Per-channel curves (R, G, B) for x in 0..1: steps 1-5. Shared by Adjust and the tests' reference."""
    x = np.arange(256, dtype=np.float64) / 255.0
    lin = _to_linear(x)
    ev = 2.0 ** a["exposureCompensation"]
    gains = _wb_gains(a["temperature"], a["tint"])
    out = []
    for ch in range(3):
        c = _to_srgb(lin * ev * gains[ch])                            # 1 exposure, 2 white balance (linear light)
        c = c + a["brightness"] / 100 * 0.2                           # 3 brightness: up to +/- 0.2
        c = (c - 0.5) * (1 + a["contrast"] / 200) + 0.5               # 4 contrast: x0.5 .. x1.5
        g = 2.0 ** (a["gamma"] / 100)                                 # 5 gamma: 0.5 .. 2 (+ lifts mid-tones)
        c = np.power(np.clip(c, 0, 1), 1 / g)
        out.append(np.clip(c, 0, 1))
    return out


class Adjust:
    """User adjustments, ready to apply to BGR frames. Build with Adjust.of(settings); None = all neutral."""

    @staticmethod
    def of(s):
        a = {k: float(s.get(k, FIELDS[k][2]) or 0) for k in ADJUSTMENTS}
        return Adjust(a) if any(abs(v) > 1e-9 for v in a.values()) else None

    def __init__(self, a):
        self.a = a
        per_channel = any(abs(a[k]) > 1e-9 for k in ("exposureCompensation", "temperature", "tint", "brightness", "contrast", "gamma"))
        if per_channel:
            r, g, b = curves(a)
            self.lut = cv2.merge([np.round(c * 255).astype(np.uint8) for c in (b, g, r)]).reshape(256, 1, 3)
        else:
            self.lut = None
        sat = _sat_matrix(1 + a["saturation"] / 100)
        hue = _hue_matrix(a["hue"])
        self.vibrance = a["vibrance"] / 100
        if abs(self.vibrance) < 1e-9:                                  # 6 + 8 folded into one matrix
            m = hue @ sat
            self.m1 = None if np.allclose(m, np.eye(3)) else _bgr(m).astype(np.float32)
            self.m2 = None
        else:
            self.m1 = None if abs(a["saturation"]) < 1e-9 else _bgr(sat).astype(np.float32)
            self.m2 = None if abs(a["hue"]) < 1e-9 else _bgr(hue).astype(np.float32)
        self.sharp = a["sharpness"] / 100 * 0.8                         # unsharp-mask amount, at most 0.8
        self.ms = 0.0

    def _vibrance(self, img):
        """luma + (c - luma) * (1 + v * (1 - chroma)), computed exactly as a blend of the picture with a fully
        "vibrance-saturated" copy (one 3x3 matrix), weighted per pixel by 1 - chroma: all fast 8-bit operations."""
        if getattr(self, "_vm", None) is None:
            self._vm = _bgr(_sat_matrix(1 + self.vibrance)).astype(np.float32)
            self._wlut = (1 - np.arange(256, dtype=np.float32) / 255).reshape(256, 1)
        b, g, r = cv2.split(img)
        chroma = cv2.subtract(cv2.max(cv2.max(b, g), r), cv2.min(cv2.min(b, g), r))   # 0 = grey .. 255 = vivid
        w = cv2.LUT(chroma, self._wlut)                                # weaker on already-strong colours
        return cv2.blendLinear(img, cv2.transform(img, self._vm), 1 - w, w)

    def apply(self, frame):
        t = time.perf_counter()
        out = frame
        if self.lut is not None:
            out = cv2.LUT(out, self.lut)
        if self.m1 is not None:
            out = cv2.transform(out, self.m1)
        if abs(self.vibrance) > 1e-9:
            out = self._vibrance(out)
        if self.m2 is not None:
            out = cv2.transform(out, self.m2)
        if self.sharp > 0:                                             # 9 sharpness, last (after every resize)
            soft = cv2.GaussianBlur(out, (0, 0), 1.0)
            out = cv2.addWeighted(out, 1 + self.sharp, soft, -self.sharp, 0)
        self.ms = (time.perf_counter() - t) * 1000
        return out


# Limited-range (16-235) pictures decoded as full range look grey and flat; this stretches them back.
_EXPAND = np.clip(np.round((np.arange(256) - 16) * 255.0 / 219.0), 0, 255).astype(np.uint8)


def fix_range(frame, mode):
    return cv2.LUT(frame, _EXPAND) if mode == "expand-limited" else frame


def levels(frame):
    """Black and white level of the picture (1st and 99th percentile of luma, 0-255), on a small copy."""
    small = frame[::8, ::8]
    y = cv2.cvtColor(np.ascontiguousarray(small), cv2.COLOR_BGR2GRAY)
    lo, hi = np.percentile(y, (1, 99))
    return int(lo), int(hi)


# ---------- Camera hardware controls (best effort, through OpenCV) ----------
def apply_controls(cap, s, previous=None):
    """Write the camera controls the settings ask for. "auto"/"default" values are NOT written unless the
    previous settings forced them manual in this session (the driver's own automatic mode stays in charge).
    Returns {control: "applied" | "driver default" | "not supported by this webcam" | "not available"}."""
    prev = previous or {}
    res = {}

    def put(prop, value):
        try:
            return bool(cap.set(prop, float(value)))
        except Exception:
            return False

    if s.get("exposureMode") == "manual":
        ok = put(cv2.CAP_PROP_AUTO_EXPOSURE, 0) | put(cv2.CAP_PROP_EXPOSURE, s.get("shutterSpeed", -6))
        if s.get("gain", 0) > 0:
            ok = put(cv2.CAP_PROP_GAIN, s["gain"]) and ok
        res["exposure"] = "applied" if ok else "not supported by this webcam"
    elif prev.get("exposureMode") == "manual":
        res["exposure"] = "auto restored" if put(cv2.CAP_PROP_AUTO_EXPOSURE, 1) else "reconnect the webcam to restore auto"
    else:
        res["exposure"] = "driver default"
    if s.get("whiteBalanceMode") == "manual":
        ok = put(cv2.CAP_PROP_AUTO_WB, 0) | put(cv2.CAP_PROP_WB_TEMPERATURE, s.get("whiteBalanceKelvin", 4600))
        res["whiteBalance"] = "applied" if ok else "not supported by this webcam"
    elif prev.get("whiteBalanceMode") == "manual":
        res["whiteBalance"] = "auto restored" if put(cv2.CAP_PROP_AUTO_WB, 1) else "reconnect the webcam to restore auto"
    else:
        res["whiteBalance"] = "driver default"
    bl = s.get("backlightCompensation", "default")
    if bl != "default":
        res["backlight"] = "applied" if put(cv2.CAP_PROP_BACKLIGHT, 1 if bl == "on" else 0) else "not supported by this webcam"
    else:
        res["backlight"] = "driver default"
    # Power-line frequency is not exposed by OpenCV's capture backends; see ARCHITECTURE.md section 17.
    res["antiFlicker"] = "driver default" if s.get("antiFlicker", "off") == "off" else "not available in this version (driver default kept)"
    return res
