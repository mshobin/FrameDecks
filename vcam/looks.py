"""Camera Looks for BCC vCam: colour grading of the webcam picture only (never the cards).
Each look is a "filter" with an intensity 0-100 (at_intensity); 100 is the look as defined here.

Same steps and order as the reference shader:
    colour += brightness
    colour  = (colour - 0.5) * contrast + 0.5
    colour  = temperature / tint
    colour  = pow(max(colour, 0), 1 / gamma)
    colour  = lerp(luma, colour, saturation)        (Rec.709 luma)
    clamp 0..1

The first four steps act on each channel on its own, so they are folded into one 256-entry lookup
table per channel (computed once when the look changes; applied with cv2.LUT). Saturation mixes the
channels, so it is one 3x3 colour matrix (cv2.transform). Optional vignette: a precomputed gain map.

Looks are data (bsf-looks.json), so new looks need no code changes.
"""
import json
import time

import cv2
import numpy as np

SCHEMA_VERSION = 1
LIMITS = {"brightness": (-0.5, 0.5, 0.0), "contrast": (0.5, 2.0, 1.0), "gamma": (0.5, 2.0, 1.0),
          "temperature": (-100.0, 100.0, 0.0), "tint": (-100.0, 100.0, 0.0), "saturation": (0.0, 2.0, 1.0),
          "vignette": (0.0, 0.5, 0.0)}
BUILT_IN = {
    "warm":    {"name": "Warm", "temperature": 12, "tint": 1.5, "gamma": 1.07, "contrast": 1.05, "saturation": 1.10},
    "dark":    {"name": "Dark / Polished", "brightness": -0.07, "contrast": 1.20, "gamma": 0.97, "temperature": -7,
                "saturation": 0.88, "vignette": 0.12},
    "neutral": {"name": "Neutral / Clean", "temperature": 0, "tint": 0, "gamma": 1.0, "contrast": 1.05, "saturation": 1.0},
}
ORDER = ["warm", "dark", "neutral"]          # Ctrl+Alt+1 / 2 / 3
# Temperature/tint: an inexpensive approximation (per-channel gains), not a colour-management pipeline.
TEMP_K, TINT_K = 0.0045, 0.004


def clean(look):
    """Clamp every value into a safe range; unknown keys are ignored."""
    out = {"name": str(look.get("name") or "Look")[:40]}
    for k, (lo, hi, default) in LIMITS.items():
        try:
            v = float(look.get(k, default))
        except (TypeError, ValueError):
            v = default
        out[k] = min(hi, max(lo, v)) if v == v else default      # NaN -> default
    return out


def at_intensity(look, intensity):
    """The look scaled toward neutral: 100 = the look exactly, 0 = no change at all (None: nothing to apply).
    Every value moves in a straight line from its neutral default, so the steps in between stay subtle."""
    g = clean(look)
    t = min(100.0, max(0.0, float(intensity))) / 100.0
    if t <= 0:
        return None
    if t >= 1:
        return g
    return {"name": g["name"], **{k: d + (g[k] - d) * t for k, (_lo, _hi, d) in LIMITS.items()}}


def load(path):
    """Built-in looks, plus any added in bsf-looks.json. A damaged file never stops the camera."""
    looks = {k: clean(v) for k, v in BUILT_IN.items()}
    note = ""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("looks", {}), dict):
            raise ValueError("not a looks file")
        for lid, look in data.get("looks", {}).items():
            if isinstance(lid, str) and lid.isidentifier() and isinstance(look, dict):
                looks[lid] = clean({**BUILT_IN.get(lid, {}), **look})
    except FileNotFoundError:
        save_default(path)
    except (OSError, ValueError) as e:
        note = f"bsf-looks.json could not be read ({e}); the built-in looks are used."
    return looks, note


def save_default(path):
    try:
        path.write_text(json.dumps({"version": SCHEMA_VERSION, "looks": BUILT_IN}, indent=2), encoding="utf-8")
    except OSError:
        pass


def reference(rgb01, g):
    """The shader maths, per pixel in floating point (used by the tests to check the fast version)."""
    c = rgb01.astype(np.float64) + g["brightness"]
    c = (c - 0.5) * g["contrast"] + 0.5
    c = c * _gains(g)
    c = np.power(np.maximum(c, 0.0), 1.0 / max(g["gamma"], 0.001))
    luma = c @ np.array([0.2126, 0.7152, 0.0722])
    c = luma[..., None] + (c - luma[..., None]) * g["saturation"]
    return np.clip(c, 0, 1)


def _gains(g):
    t, n = g["temperature"], g["tint"]
    return np.array([1 + TEMP_K * t + TINT_K * n * 0.5, 1 - TINT_K * n, 1 - TEMP_K * t + TINT_K * n * 0.5])   # R, G, B


class Grade:
    """A look ready to apply to BGR frames: lookup tables + saturation matrix (+ vignette map, cached per size)."""
    def __init__(self, look):
        g = clean(look)
        self.look = g
        x = np.arange(256, dtype=np.float64) / 255.0
        c = (x + g["brightness"] - 0.5) * g["contrast"] + 0.5
        gains = _gains(g)
        raw = [np.power(np.maximum(c * gains[ch], 0.0), 1.0 / max(g["gamma"], 0.001)) for ch in (2, 1, 0)]   # B, G, R
        s = g["saturation"]
        # If highlights go past white before the saturation step, keep them (16-bit) so the result matches the
        # shader exactly; otherwise the faster 8-bit path is identical.
        # If highlights go past white before the saturation step, the table stores them scaled down (headroom)
        # and the saturation matrix scales them back up, so they are only clamped at the very end - like the
        # shader - while everything stays in fast 8-bit.
        top = max(float(r.max()) for r in raw)
        self.headroom = top if (abs(s - 1) > 1e-6 and top > 1.0) else 1.0
        self.lut = cv2.merge([np.clip(np.round(r * 255.0 / self.headroom), 0, 255).astype(np.uint8) for r in raw]).reshape(256, 1, 3)
        wb, wg, wr = 0.0722, 0.7152, 0.2126                          # luma weights in B, G, R order
        L = np.array([[wb, wg, wr]] * 3)
        self.matrix = ((1 - s) * L + s * np.eye(3)) * self.headroom if abs(s - 1) > 1e-6 else None
        self.vignette = g["vignette"]
        self._vmap = None
        self.ms = 0.0

    def apply(self, frame):
        t = time.perf_counter()
        out = cv2.LUT(frame, self.lut)
        if self.matrix is not None:
            out = cv2.transform(out, self.matrix)                   # 8-bit: clamps to 0..255 at the end
        if self.vignette > 0:
            h, w = out.shape[:2]
            if self._vmap is None or self._vmap.shape[:2] != (h, w):
                yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
                r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)
                gain = 1 - self.vignette * np.clip((r - 0.45) / 0.55, 0, 1) ** 2      # only the outer edge, very gently
                m = (gain * 255).astype(np.uint8)
                self._vmap = cv2.merge([m, m, m])
            out = cv2.multiply(out, self._vmap, scale=1 / 255.0)
        self.ms = (time.perf_counter() - t) * 1000
        return out
