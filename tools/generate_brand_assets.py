"""Generate the legacy horizontal and stacked FRAMEDECKS logos from assets/brand/framedecks-logo-source.png.

The emblem, icons, favicons and .ico are NOT written here any more; run tools/make_emblem_assets.py for those.
Run with: python tools/generate_brand_assets.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

NAVY = (3, 14, 33, 255)
GOLD = (228, 184, 79, 255)


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/brand/framedecks-logo-source.png"
ICON_CROP = (138, 44, 630, 536)
WORDMARK_CROP = (92, 536, 676, 668)


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

    with Image.open(brand / "framedecks-emblem-1024.png") as opened:
        emblem = opened.convert("RGBA")

    horizontal = Image.new("RGBA", (1500, 560), NAVY)
    horizontal.alpha_composite(emblem.resize((500, 500), Image.Resampling.LANCZOS), (30, 30))
    wordmark = remove_dark_background(source.crop(WORDMARK_CROP))
    horizontal.alpha_composite(wordmark.resize((850, 192), Image.Resampling.LANCZOS), (610, (560 - 192) // 2))
    horizontal.save(brand / "framedecks-logo-horizontal.png", optimize=True)

    scale = 4
    tile = Image.new("RGBA", (768 * scale, 768 * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    draw.rounded_rectangle((40 * scale, 28 * scale, 728 * scale, 740 * scale), radius=130 * scale,
                           fill=NAVY, outline=GOLD, width=3 * scale)
    stacked = tile.resize((768, 768), Image.Resampling.LANCZOS)
    stacked.alpha_composite(emblem.resize((440, 440), Image.Resampling.LANCZOS), (164, 60))
    stacked.alpha_composite(wordmark, (92, 536))
    stacked.save(brand / "framedecks-logo-stacked.png", optimize=True)


if __name__ == "__main__":
    main()
