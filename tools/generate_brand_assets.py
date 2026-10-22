"""Generate FRAMEDECKS logo derivatives from assets/brand/framedecks-logo-source.png.

Run with: python tools/generate_brand_assets.py
"""
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/brand/framedecks-logo-source.png"
ICON_CROP = (138, 44, 630, 536)
WORDMARK_CROP = (92, 536, 676, 668)
ICON_SIZES = (180, 192, 512)


def remove_dark_background(image):
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, _ = pixels[x, y]
            luminance = round(0.2126 * red + 0.7152 * green + 0.0722 * blue)
            alpha = max(0, min(255, (luminance - 30) * 5))
            pixels[x, y] = (red, green, blue, alpha)
    return image


def main():
    with Image.open(SOURCE) as original:
        source = original.convert("RGBA")
    if source.size != (768, 768):
        raise SystemExit(f"Expected 768x768 source logo, got {source.width}x{source.height}")

    brand = ROOT / "assets/brand"
    app_icons = ROOT / "app/icons"
    app_images = ROOT / "app/img"
    mark = source.crop(ICON_CROP).resize((512, 512), Image.Resampling.LANCZOS)

    mark.save(brand / "framedecks-logo-icon.png", optimize=True)
    mark.save(brand / "kc-mark.png", optimize=True)
    mark.save(app_images / "kc-emblem.webp", "WEBP", quality=94, method=6)

    for size in ICON_SIZES:
        mark.resize((size, size), Image.Resampling.LANCZOS).save(
            app_icons / f"remote-{size}.png", optimize=True
        )
    for size in (16, 32):
        mark.resize((size, size), Image.Resampling.LANCZOS).save(
            app_icons / f"favicon-{size}.png", optimize=True
        )

    safe = Image.new("RGBA", (512, 512), (3, 14, 33, 255))
    maskable_mark = mark.resize((410, 410), Image.Resampling.LANCZOS)
    safe.alpha_composite(maskable_mark, ((512 - 410) // 2, (512 - 410) // 2))
    safe.save(app_icons / "remote-maskable-512.png", optimize=True)

    mark.save(ROOT / "packaging/kingdom-connect.ico", format="ICO",
              sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    horizontal = Image.new("RGBA", (1500, 560), (3, 14, 33, 255))
    horizontal_mark = remove_dark_background(source.crop(ICON_CROP)).resize(
        (500, 500), Image.Resampling.LANCZOS
    )
    horizontal.alpha_composite(horizontal_mark, (30, 30))
    wordmark = remove_dark_background(source.crop(WORDMARK_CROP)).resize(
        (850, 192), Image.Resampling.LANCZOS
    )
    horizontal.alpha_composite(wordmark, (610, (560 - 192) // 2))
    horizontal.save(brand / "framedecks-logo-horizontal.png", optimize=True)

    source.save(brand / "framedecks-logo-stacked.png", optimize=True)


if __name__ == "__main__":
    main()
