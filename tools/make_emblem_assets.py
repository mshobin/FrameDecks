"""Build every FrameDecks emblem derivative from the vector master.

Master: assets/brand/framedecks-emblem.svg, rendered to assets/brand/framedecks-emblem-1024.png.
Small sizes (16-32 px: favicons, tray, the small .ico images) use framedecks-emblem-small.svg, rendered to
framedecks-emblem-small-1024.png: the same mark with heavier strokes, so it stays visible on light tabs and taskbars.
Run with: python tools/make_emblem_assets.py   (Pillow only; re-render the PNG if the SVG changes).
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "assets/brand/framedecks-emblem-1024.png"
SMALL_MASTER = ROOT / "assets/brand/framedecks-emblem-small-1024.png"
NAVY = (3, 14, 33, 255)


def resized(master, size):
    return master.resize((size, size), Image.Resampling.LANCZOS)


def load(path):
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
    if image.size != (1024, 1024):
        raise SystemExit(f"Expected 1024x1024 {path.name}, got {image.width}x{image.height}")
    return image


def main():
    master = load(MASTER)
    small = load(SMALL_MASTER)

    brand = ROOT / "assets/brand"
    app_icons = ROOT / "app/icons"
    hosted = ROOT / "hosted"

    for target in (ROOT / "app/img/kc-emblem.webp", hosted / "public/framedecks-emblem.webp"):
        master.save(target, "WEBP", lossless=True, quality=100, method=6)

    icon512 = resized(master, 512)
    icon512.save(brand / "framedecks-logo-icon.png", optimize=True)
    icon512.save(hosted / "public/framedecks-logo-icon.png", optimize=True)

    for size in (180, 192, 512):
        resized(master, size).save(app_icons / f"remote-{size}.png", optimize=True)
    for size in (16, 32):
        resized(small, size).save(app_icons / f"favicon-{size}.png", optimize=True)
    resized(small, 32).save(hosted / "src/app/icon.png", optimize=True)
    resized(small, 64).save(app_icons / "tray-64.png", optimize=True)   # Windows scales it to 16-32 px

    safe = Image.new("RGBA", (512, 512), NAVY)
    safe.alpha_composite(resized(master, 410), ((512 - 410) // 2, (512 - 410) // 2))
    safe.save(app_icons / "remote-maskable-512.png", optimize=True)

    # ICO keeps one image per size: 16-32 from the small master, 48 and up from the main one.
    small_ico = [resized(small, size) for size in (16, 20, 24, 32)]
    large_ico = [resized(master, size) for size in (48, 64, 128, 256)]
    large_ico[-1].save(ROOT / "packaging/framedecks.ico", format="ICO",
                       sizes=[im.size for im in small_ico + large_ico], append_images=small_ico + large_ico[:-1])


if __name__ == "__main__":
    main()
