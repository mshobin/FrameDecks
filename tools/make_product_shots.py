"""FrameDecks 9.6 - the website's pictures of the program, captured from the running program.

The landing page shows the Studio (hosted/public/product/studio.webp, 1200 x 480) and the user guide shows the
Command Center (docs/guide/images/command-center.png) and its live remote (docs/guide/images/spotlight-remote.png). Both are real screens, so the website shows what people
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
COMMAND_CENTER = ROOT / "docs/guide/images/command-center.png"
ANNOTATE = ROOT / "hosted/public/product/annotate.webp"        # 26.11.2 the landing's "Point it out" tab
CC_WEB = ROOT / "hosted/public/product/command-center.webp"    # 26.11.2 the landing's Command Center tab (from the guide's picture)
CC_LIVE_WEB = ROOT / "hosted/public/product/command-center-live.webp"
PHONE_SHOT = ROOT / "docs/guide/images/remote-simple.png"        # the phone remote (tests/visual/help-shots.mjs)
PHONE_WEB = ROOT / "hosted/public/product/phone-remote.webp"      # 26.11.2 the landing's phone chapter
GUIDE_ANNOTATE = ROOT / "docs/guide/images/annotate.png"        # 26.11.2 the user guide's other pictures, from the program
GUIDE_PALETTE = ROOT / "docs/guide/images/command-palette.png"
GUIDE_REMOTE = ROOT / "docs/guide/images/remote-simple.png"
GUIDE_REMOTE_DRAW = ROOT / "docs/guide/images/remote-annotate.png"
GUIDE_STUDIO = ROOT / "docs/guide/images/studio.png"            # 26.11.2 the Studio with its content area (user guide)
GUIDE_EDIT = ROOT / "docs/guide/images/canvas-edit.png"         # 26.11.2 editing a card on the live preview: a draft
TMP = ROOT / "hosted/public/product/.studio.png"          # the full-quality capture (not committed)
QUIET = ("window.KCOnboarding && window.KCOnboarding.close();"
         "document.querySelectorAll('.gd-panel, .gd-spot, .gd-tip, .app-modal-back, .onb, .toast').forEach(e => e.remove())")


BACKDROP = ("document.documentElement.classList.add('kc-glass');"
            "document.documentElement.style.background = 'linear-gradient(160deg,#6b5fa8 0%,#c58a7a 45%,#2c3e66 75%,#16213b 100%)'")


async def command_center(b, base):
    """9.10 the Command Center over a desktop-like picture (the window itself is see-through): the bar and its four
    chips, then Control while a Frame is live."""
    sp = await b.new_page(viewport={"width": 820, "height": 270}, device_scale_factor=2, reduced_motion="reduce")
    await sp.goto(base + "/spotlight.html")
    await sp.wait_for_timeout(1500)
    await sp.evaluate(BACKDROP)
    await sp.hover(".cc-handle")                 # 9.11 the chips fold away under the bar; pointing at the arrow shows them
    await sp.wait_for_timeout(300)
    await sp.screenshot(path=str(COMMAND_CENTER), animations="disabled")
    await sp.set_viewport_size({"width": 820, "height": 720})
    await sp.evaluate("KCStore.update(n => { KCScenes.take(n, KCScenes.order(n)[0].id, null); })")
    await sp.wait_for_timeout(800)
    await sp.keyboard.press("Alt+3")
    await sp.wait_for_timeout(1200)
    await sp.screenshot(path=str(SPOTLIGHT), animations="disabled")
    await sp.evaluate("KCStore.update(n => { KCScenes.hideAll(n); n.live.scene = ''; })")
    await sp.wait_for_timeout(400)


async def command_center_web(b, base):
    """26.11.2 the website's Command Center pictures with nothing behind them (transparent): the see-through window sits
    on the website's own background, as it sits on whatever app is open (the guide's pictures keep their desktop)."""
    sp = await b.new_page(viewport={"width": 820, "height": 270}, device_scale_factor=2, reduced_motion="reduce")
    await sp.goto(base + "/spotlight.html")
    await sp.wait_for_timeout(1500)
    await sp.evaluate("document.documentElement.classList.add('kc-glass');"
                      "for (const e of [document.documentElement, document.body]) e.style.background = 'transparent'")
    await sp.hover(".cc-handle")
    await sp.wait_for_timeout(300)
    from PIL import Image
    tmp = CC_WEB.with_suffix(".png")
    await sp.screenshot(path=str(tmp), animations="disabled", omit_background=True)
    im = Image.open(tmp).convert("RGBA")
    im.resize((820, round(820 * im.height / im.width)), Image.LANCZOS).save(CC_WEB, "WEBP", quality=88, method=6)
    await sp.set_viewport_size({"width": 820, "height": 720})
    await sp.evaluate("KCStore.update(n => { KCScenes.take(n, KCScenes.order(n)[0].id, null); })")
    await sp.wait_for_timeout(800)
    await sp.keyboard.press("Alt+3")
    await sp.wait_for_timeout(1200)
    await sp.screenshot(path=str(tmp), animations="disabled", omit_background=True)
    im = Image.open(tmp).convert("RGBA")
    im.resize((820, round(820 * im.height / im.width)), Image.LANCZOS).save(CC_LIVE_WEB, "WEBP", quality=88, method=6)
    tmp.unlink()
    await sp.evaluate("KCStore.update(n => { KCScenes.hideAll(n); n.live.scene = ''; })")
    await sp.wait_for_timeout(400)
    await sp.close()


async def guide_studio(b, base):
    """26.11.2 the user guide's Studio (live, the question cards under the preview) and a card edited on the live
    preview (the draft with Update screen)."""
    pg = await b.new_page(viewport={"width": 1600, "height": 900}, reduced_motion="reduce")
    await pg.add_init_script("try { localStorage.setItem('kc-pv-hint', '1') } catch (e) {}")
    await pg.goto(base + "/dashboard.html")
    await pg.wait_for_timeout(1500)
    await pg.evaluate(QUIET)
    await pg.evaluate("KCStore.update(n => { KCScenes.take(n, KCScenes.order(n)[0].id, null); })")
    await pg.wait_for_timeout(1200)
    await pg.evaluate(QUIET)
    await pg.evaluate("(() => { const s = KCScenes.order(KCStore.get())[0]; const q = (s.layers || []).find(l => l.kind === 'question');"
                      " if (q) KCWorkspace.select(s.id, q.id); })()")
    await pg.wait_for_timeout(800)
    await pg.mouse.move(1, 1)
    await pg.screenshot(path=str(GUIDE_STUDIO), animations="disabled")
    box = await pg.evaluate("""(() => { const f = document.getElementById('program-frame'), r = f.getBoundingClientRect(), s = r.width / 1920;
        const c = f.contentDocument.querySelector('.card-question:not(.out)'); if (!c) return null; const b = c.getBoundingClientRect();
        return {x: r.left + (b.left + b.width / 2) * s, y: r.top + (b.top + b.height * .7) * s, top: r.top}; })()""")
    if box:
        await pg.mouse.dblclick(box["x"], box["y"])
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=str(GUIDE_EDIT), animations="disabled", clip={"x": 304, "y": 58, "width": 1296, "height": 560})
        await pg.keyboard.press("Escape")
    await pg.close()


async def annotate(b, base):
    """26.11.2 the landing's "Point it out": live, a gold underline drawn under the question and the Spotlight on a word."""
    pg = await b.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=2, reduced_motion="reduce")
    await pg.add_init_script("try { localStorage.setItem('kc-pv-hint', '1'); localStorage.setItem('kc-layout', JSON.stringify("
                             "{left: 300, canvas: 85, scenes: 58, c: {insp: true}})) } catch (e) {}")
    await pg.goto(base + "/dashboard.html")
    await pg.wait_for_timeout(1500)
    await pg.evaluate(QUIET)
    await pg.evaluate("KCStore.update(n => { KCScenes.take(n, KCScenes.order(n)[0].id, null); })")
    await pg.wait_for_timeout(1200)
    await pg.keyboard.press("d")
    await pg.wait_for_timeout(500)
    r = await pg.evaluate("(() => { const e = document.getElementById('program').getBoundingClientRect(); return {x: e.x, y: e.y, w: e.width, h: e.height}; })()")
    await pg.mouse.move(r["x"] + r["w"] * 0.22, r["y"] + r["h"] * 0.86)
    await pg.mouse.down()
    for i in range(21):
        await pg.mouse.move(r["x"] + r["w"] * (0.22 + i * 0.012), r["y"] + r["h"] * 0.86)
    await pg.mouse.up()
    await pg.evaluate("window.KCAnnotate.spotAtPicture(0.47, 0.30)")
    await pg.wait_for_timeout(700)
    tmp = ANNOTATE.with_suffix(".png")
    await pg.screenshot(path=str(tmp), clip={"x": 320, "y": 116, "width": 1266, "height": 620})
    await pg.keyboard.press("Escape")
    await pg.close()
    from PIL import Image
    im = Image.open(tmp).convert("RGB")
    im.resize((1000, round(1000 * im.height / im.width)), Image.LANCZOS).save(ANNOTATE, "WEBP", quality=86, method=6)
    tmp.unlink()


async def guide_more(b, base):
    """26.11.2 the rest of the user guide's pictures: Annotate on the live picture (a pen line and a rectangle), the
    command palette with "bible" typed, and the phone remote upright and sideways while drawing."""
    pg = await b.new_page(viewport={"width": 1600, "height": 900}, reduced_motion="reduce")
    await pg.add_init_script("try { localStorage.setItem('kc-pv-hint', '1'); localStorage.setItem('kc-layout', JSON.stringify("
                             "{left: 300, canvas: 85, scenes: 58, c: {insp: true}})) } catch (e) {}")
    await pg.goto(base + "/dashboard.html")
    await pg.wait_for_timeout(1500)
    await pg.evaluate(QUIET)
    await pg.evaluate("KCStore.update(n => { KCScenes.take(n, KCScenes.order(n)[0].id, null); })")
    await pg.wait_for_timeout(1200)
    # Annotate: a pen line across the picture, then a rectangle around the question
    await pg.keyboard.press("d")
    await pg.wait_for_timeout(500)
    r = await pg.evaluate("(() => { const e = document.getElementById('program').getBoundingClientRect(); return {x: e.x, y: e.y, w: e.width, h: e.height}; })()")
    pt = lambda fx, fy: (r["x"] + r["w"] * fx, r["y"] + r["h"] * fy)  # noqa: E731
    await pg.mouse.move(*pt(0.18, 0.62))
    await pg.mouse.down()
    for i, (fx, fy) in enumerate([(0.24, 0.58), (0.3, 0.64), (0.36, 0.57), (0.42, 0.63), (0.48, 0.56), (0.54, 0.62)]):
        await pg.mouse.move(*pt(fx, fy), steps=4)
    await pg.mouse.up()
    await pg.keyboard.press("r")
    await pg.mouse.move(*pt(0.62, 0.18))
    await pg.mouse.down()
    await pg.mouse.move(*pt(0.86, 0.4), steps=8)
    await pg.mouse.up()
    await pg.wait_for_timeout(500)
    await pg.screenshot(path=str(GUIDE_ANNOTATE), clip={"x": 320, "y": 70, "width": 1266, "height": 620})
    await pg.keyboard.press("Escape")
    await pg.evaluate("KCStore.update(n => { n.live.ink = {items: []}; })")
    await pg.wait_for_timeout(400)
    # the command palette
    await pg.keyboard.press("Control+k")
    await pg.wait_for_timeout(500)
    await pg.keyboard.type("bible", delay=40)
    await pg.wait_for_timeout(700)
    await pg.screenshot(path=str(GUIDE_PALETTE))
    await pg.keyboard.press("Escape")
    # the phone remote, upright (a Frame is live), then sideways with Draw open
    ph = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion="reduce")
    await ph.goto(base + "/remote.html")
    await ph.wait_for_selector("#app:not([hidden])")
    await ph.wait_for_timeout(1500)
    await ph.screenshot(path=str(GUIDE_REMOTE))
    await ph.set_viewport_size({"width": 844, "height": 390})
    await ph.wait_for_timeout(800)
    await ph.evaluate("document.getElementById('pic-draw')?.click() || document.getElementById('t-draw')?.click()")
    await ph.wait_for_timeout(900)
    c = await ph.evaluate("(() => { const e = document.querySelector('.dr-canvas, #dr-canvas, canvas'); if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; })()")
    if c:
        await ph.mouse.move(c["x"] + c["w"] * 0.15, c["y"] + c["h"] * 0.42)
        await ph.mouse.down()
        for fx, fy in [(0.22, 0.38), (0.3, 0.45), (0.38, 0.37), (0.46, 0.44), (0.54, 0.36)]:
            await ph.mouse.move(c["x"] + c["w"] * fx, c["y"] + c["h"] * fy, steps=4)
        await ph.mouse.up()
        await ph.wait_for_timeout(600)
    await ph.screenshot(path=str(GUIDE_REMOTE_DRAW))
    await ph.close()
    await pg.evaluate("KCStore.update(n => { n.live.ink = {items: []}; KCScenes.hideAll(n); n.live.scene = ''; })")
    await pg.wait_for_timeout(400)
    await pg.close()


def web_copies():
    """26.11.2 the phone remote's picture (from the guide's), as a small webp for the landing."""
    from PIL import Image
    im = Image.open(PHONE_SHOT).convert("RGB")
    im.resize((390, round(390 * im.height / im.width)), Image.LANCZOS).save(PHONE_WEB, "WEBP", quality=86, method=6)


async def capture(base, chromium, guide_only=False):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": chromium} if chromium else {}))
        if guide_only:
            await command_center(b, base)
            await guide_studio(b, base)
            await b.close()
            return
        # the Studio, live, at 1600 x 640 (the landing's 2.5 : 1), scaled to 1200 x 480 below
        pg = await b.new_page(viewport={"width": 1600, "height": 640}, device_scale_factor=2, reduced_motion="reduce")
        # the picture's layout (this browser only, never the program's own). 26.11.2: the content area under the preview
        # is shown (the question cards of the live Frame), so the website shows the Studio as people use it
        await pg.add_init_script("try { localStorage.setItem('kc-layout', JSON.stringify({left: 300, canvas: 60, scenes: 58,"
                                 " c: {}})); localStorage.setItem('kc-pv-hint', '1') } catch (e) {}")
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
        await pg.evaluate("(() => { const s = KCScenes.order(KCStore.get())[0]; const q = (s.layers || []).find(l => l.kind === 'question');"
                          " if (q) KCWorkspace.select(s.id, q.id); })()")
        await pg.wait_for_timeout(600)
        await pg.mouse.move(1, 1)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(TMP), animations="disabled")
        await command_center(b, base)       # 9.9 the Command Center, in the dark theme
        await command_center_web(b, base)   # 26.11.2 and with nothing behind it, for the website
        await guide_studio(b, base)
        await annotate(b, base)
        await guide_more(b, base)
        await b.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--url", default="http://localhost:8750")
    ap.add_argument("--chromium", default=None)
    ap.add_argument("--guide-only", action="store_true", help="only the user guide's Command Center pictures")
    a = ap.parse_args()
    asyncio.run(capture(a.url.rstrip("/"), a.chromium, a.guide_only))
    if a.guide_only:
        print("wrote", COMMAND_CENTER.relative_to(ROOT), "and", SPOTLIGHT.relative_to(ROOT))
        return
    from PIL import Image
    Image.open(TMP).convert("RGB").resize((1200, 480), Image.LANCZOS).save(STUDIO, "WEBP", quality=88, method=6)
    web_copies()
    TMP.unlink()
    print("wrote", STUDIO.relative_to(ROOT), "and", SPOTLIGHT.relative_to(ROOT))


if __name__ == "__main__":
    main()
