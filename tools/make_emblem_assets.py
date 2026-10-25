"""Build every FRAMEDECKS emblem derivative from the vector master.

Master: assets/brand/framedecks-emblem.svg, rendered to assets/brand/framedecks-emblem-1024.png.
Run with: python tools/make_emblem_assets.py   (Pillow only; re-render the PNG if the SVG changes).
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "assets/brand/framedecks-emblem-1024.png"
NAVY = (3, 14, 33, 255)


def resized(master, size):
    return master.resize((size, size), Image.Resampling.LANCZOS)


def main():
    with Image.open(MASTER) as opened:
        master = opened.convert("RGBA")
    if master.size != (1024, 1024):
        raise SystemExit(f"Expected 1024x1024 master, got {master.width}x{master.height}")

    brand = ROOT / "assets/brand"
    app_icons = ROOT / "app/icons"
    hosted = ROOT / "hosted"

    for target in (ROOT / "app/img/kc-emblem.webp", hosted / "public/framedecks-emblem.webp"):
        master.save(target, "WEBP", lossless=True, quality=100, method=6)

    icon512 = resized(master, 512)
    icon512.save(brand / "framedecks-logo-icon.png", optimize=True)
    icon512.save(brand / "kc-mark.png", optimize=True)
    icon512.save(hosted / "public/framedecks-logo-icon.png", optimize=True)

    for size in (180, 192, 512):
        resized(master, size).save(app_icons / f"remote-{size}.png", optimize=True)
    for size in (16, 32):
        resized(master, size).save(app_icons / f"favicon-{size}.png", optimize=True)
    resized(master, 32).save(hosted / "src/app/icon.png", optimize=True)

    safe = Image.new("RGBA", (512, 512), NAVY)
    safe.alpha_composite(resized(master, 410), ((512 - 410) // 2, (512 - 410) // 2))
    safe.save(app_icons / "remote-maskable-512.png", optimize=True)

    master.save(ROOT / "packaging/kingdom-connect.ico", format="ICO",
                sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


if __name__ == "__main__":
    main()
