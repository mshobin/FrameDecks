"""Rebuild the gold-only transparent emblem used on the app background.

Run from the repository root AFTER tools/generate_brand_assets.py, which writes the opaque emblem this tool replaces:

    python tools/make_transparent_emblem.py

It keeps only the gold artwork (everything else becomes transparent so the page background shows through), removes
glow haze and edge fringing, upscales to 1024x1024 and writes app/img/kc-emblem.webp and
hosted/public/framedecks-emblem.webp. Developer-only; needs numpy and Pillow. The source is the committed emblem
from git history (the last opaque version), so the result does not change when this tool is run twice.
"""
import io
import subprocess

import numpy as np
from PIL import Image, ImageFilter

OPAQUE_SOURCE_REV = "e02dd52~1"
TARGETS = ["app/img/kc-emblem.webp", "hosted/public/framedecks-emblem.webp"]
NAVY = np.array([10, 18, 34], np.float32) / 255.0


def load_opaque_source():
    data = subprocess.run(
        ["git", "show", f"{OPAQUE_SOURCE_REV}:app/img/kc-emblem.webp"], capture_output=True, check=True
    ).stdout
    return Image.open(io.BytesIO(data)).convert("RGB")


def zone(xx, yy, x0, x1, y0, y1, blur):
    mask = ((xx > x0) & (xx < x1) & (yy > y0) & (yy < y1)).astype(np.uint8) * 255
    return np.asarray(Image.fromarray(mask).filter(ImageFilter.GaussianBlur(blur))).astype(np.float32) / 255.0


def build(im):
    a = np.asarray(im).astype(np.float32) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    yy, xx = np.mgrid[0:512, 0:512]

    warm = (r >= g * 0.98) & (g >= b * 0.9) & ((r - b) > 0.04)
    gold = np.clip((sat - 0.22) / 0.2, 0, 1) * np.clip((mx - 0.35) / 0.3, 0, 1) * warm
    pale = np.clip((mx - 0.62) / 0.2, 0, 1) * (r >= b - 0.01)
    hot = np.clip((mn - 0.72) / 0.2, 0, 1)
    alpha = np.clip((np.maximum(np.maximum(gold, pale), hot) - 0.04) / 0.96, 0, 1)

    # Cross: drop the diffuse haze so only the crisp cross, rays and mountain edge stay.
    box = zone(xx, yy, 268, 372, 150, 302, 6)
    box = np.maximum(box, zone(xx, yy, 248, 290, 170, 240, 6))
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    tight = np.clip((lum - 0.80) / 0.14, 0, 1)
    alpha = alpha * (1 - box) + np.minimum(alpha, tight) * box

    alpha = np.clip((alpha - 0.10) / 0.90, 0, 1)

    # Bleed zones (beside the play arrow, around the mountain base): keep only solid gold.
    bleed = np.maximum.reduce([
        zone(xx, yy, 238, 292, 180, 305, 5),
        zone(xx, yy, 232, 400, 300, 395, 5),
        zone(xx, yy, 226, 340, 385, 445, 5),
    ])
    solid = np.clip((alpha - 0.55) / 0.30, 0, 1)
    solid = np.asarray(Image.fromarray((solid * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1)))
    alpha = alpha * (1 - bleed) + (solid.astype(np.float32) / 255.0) * bleed

    # Reflection blotch under the front frame: clear it, keep the thin vertical ray to the bottom node.
    edge_y = 368 + (xx - 180) * (44.0 / 284.0)
    blot = ((xx > 232) & (xx < 332) & (yy > edge_y + 14) & (yy < 432) & ~((xx > 251) & (xx < 262)))
    blot = np.asarray(Image.fromarray(blot.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(2)))
    alpha = alpha * (1 - blot.astype(np.float32) / 255.0)

    alpha = np.where(alpha < 0.02, 0, alpha)
    # Un-matte edge colours so no navy fringe remains.
    colour = np.clip((a - NAVY * (1 - alpha[..., None])) / np.maximum(alpha, 1e-3)[..., None], 0, 1)

    out = (np.dstack([colour, alpha]) * 255 + 0.5).astype(np.uint8)
    res = Image.fromarray(out, "RGBA")
    return res.convert("RGBa").resize((1024, 1024), Image.LANCZOS).convert("RGBA")


def main():
    res = build(load_opaque_source())
    for target in TARGETS:
        res.save(target, "WEBP", lossless=True, exact=True)
        print("wrote", target)


if __name__ == "__main__":
    main()
