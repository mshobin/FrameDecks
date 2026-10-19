"""Kingdom Connect - the README header, captured from the About screen (6.7).

Renders the About screen's hero (logo, KINGDOM CONNECT, tagline, motto, introduction and version) from the running
app and saves it as assets/brand/kc-about-header.webp, so the GitHub page looks exactly like the About screen.

Run it after changing app/js/brand.js, the About screen or the version (server.py APP_VERSION):

    python server.py --no-browser          # in one window
    python tools/make_readme_header.py     # in another (needs: pip install playwright pillow; playwright install chromium)

Options: --url (default http://localhost:8750/dashboard.html), --chromium <path to a Chromium executable>.
"""
import argparse
import asyncio
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/brand/kc-about-header.webp"
VERSION_FILE = ROOT / "assets/brand/kc-about-header.version"   # the version the picture shows
PNG = ROOT / "assets/brand/.kc-about-header.png"      # the full-quality capture (not committed)


def app_version():
    import re
    return re.search(r'APP_VERSION = "([^"]+)"', (ROOT / "server.py").read_text(encoding="utf-8")).group(1)


async def capture(url, chromium):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": chromium} if chromium else {}))
        pg = await b.new_page(viewport={"width": 1180, "height": 900}, device_scale_factor=2, reduced_motion="reduce")
        await pg.goto(url)
        await pg.wait_for_timeout(1500)
        await pg.evaluate("BSFSetTab('settings'); BSFShowSection('about')")
        await pg.wait_for_timeout(1500)
        hero = pg.locator("#about-body .kc-hero")
        await hero.screenshot(path=str(PNG), animations="disabled", omit_background=True)
        await b.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--url", default="http://localhost:8750/dashboard.html")
    ap.add_argument("--chromium", default=None)
    a = ap.parse_args()
    asyncio.run(capture(a.url, a.chromium))
    from PIL import Image                  # WebP keeps the transparent corners and is about a sixth of the PNG's size
    Image.open(PNG).convert("RGBA").save(OUT, "WEBP", quality=92, method=6)
    PNG.unlink()
    VERSION_FILE.write_text(app_version() + "\n", encoding="ascii")   # make_release_notes.py --check compares it
    print("wrote", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
