"""FrameDecks 9.6 - the website's pictures of the program, captured from the running program.

The landing page shows the Studio (hosted/public/product/studio.webp, 1200 x 480) and the user guide shows the
Spotlight remote (docs/guide/images/spotlight-remote.png). Both are real screens, so the website shows what people
get. Run it after a visible change to the Studio or to Spotlight:

    python src/server.py --no-browser          # in one window, with a fresh data folder (KC_DATA_DIR: the starter Frames)
    python tools/make_product_shots.py         # in another (needs: pip install playwright pillow)

Options: --url (default http://localhost:8750), --chromium <path to a Chromium executable>.
"""
import argparse
import asyncio
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STUDIO = ROOT / "hosted/public/product/studio.webp"
SPOTLIGHT = ROOT / "docs/guide/images/spotlight-remote.png"
TMP = ROOT / "hosted/public/product/.studio.png"          # the full-quality capture (not committed)
QUIET = ("window.KCOnboarding && window.KCOnboarding.close();"
         "document.querySelectorAll('.gd-panel, .gd-spot, .gd-tip, .app-modal-back, .onb, .toast').forEach(e => e.remove())")


async def capture(base, chromium):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": chromium} if chromium else {}))
        # the Studio, live, at 1600 x 640 (the landing's 2.5 : 1), scaled to 1200 x 480 below
        pg = await b.new_page(viewport={"width": 1600, "height": 640}, device_scale_factor=2, reduced_motion="reduce")
        # the picture's layout (this browser only, never the program's own): the Inspector folded, so the canvas has the room
        await pg.add_init_script("try { localStorage.setItem('kc-layout', JSON.stringify({left: 300, canvas: 85, scenes: 58,"
                                 " c: {insp: true}})) } catch (e) {}")
        await pg.goto(base + "/dashboard.html")
        await pg.wait_for_timeout(1500)
        await pg.evaluate(QUIET)
        await pg.wait_for_timeout(600)
        await pg.click("#cb-take")
        await pg.wait_for_timeout(1500)
        await pg.evaluate(QUIET)
        btn = pg.get_by_role("button", name="Hide preview")      # the Up next card folds away
        if await btn.count():
            await btn.first.click()
        await pg.wait_for_timeout(600)
        await pg.mouse.move(1, 1)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(TMP), animations="disabled")
        # Spotlight as a meeting remote, in the dark theme
        sp = await b.new_page(viewport={"width": 820, "height": 400}, device_scale_factor=2, reduced_motion="reduce")
        await sp.goto(base + "/spotlight.html")
        await sp.wait_for_timeout(1800)
        await sp.screenshot(path=str(SPOTLIGHT), animations="disabled")
        await b.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--url", default="http://localhost:8750")
    ap.add_argument("--chromium", default=None)
    a = ap.parse_args()
    asyncio.run(capture(a.url.rstrip("/"), a.chromium))
    from PIL import Image
    Image.open(TMP).convert("RGB").resize((1200, 480), Image.LANCZOS).save(STUDIO, "WEBP", quality=88, method=6)
    TMP.unlink()
    print("wrote", STUDIO.relative_to(ROOT), "and", SPOTLIGHT.relative_to(ROOT))


if __name__ == "__main__":
    main()
