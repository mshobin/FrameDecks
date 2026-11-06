"""FrameDecks 26.11.4 - the Help Center's short clips, recorded from the real program (never drawn or staged).

Each clip is a few seconds of the program doing one thing, saved as a looping animated WebP and a still for people who
asked for less motion (hosted/public/help/clips/<name>.webp and <name>-still.webp). The Help Center shows them with
components/help-clip.tsx. Run it again whenever one of these screens changes:

    KC_DATA_DIR=/tmp/FrameDecks python src/server.py --no-browser     # in one window (a clean plan, a clean path)
    python tools/make_help_clips.py [--chromium PATH]                  # in another

Needs playwright and pillow. It acts on the running program's plan (Go Live, a card); use a scratch data folder.
"""
import argparse
import asyncio
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "hosted/public/help/clips"
QUIET = ("window.KCOnboarding && window.KCOnboarding.close();"
         "document.querySelectorAll('.gd-panel, .gd-spot, .gd-tip, .app-modal-back, .onb, .toast, .wn').forEach(e => e.remove())")
FPS = 8
STAGE = {"x": 140, "y": 0, "width": 1140, "height": 440}   # the top bar and the preview: where the action is


def post(base, path, body):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read() or b"{}")


async def rec(pg, seconds, frames, clip=None):
    """Screenshots at about FPS a second for `seconds`, appended to `frames`."""
    from PIL import Image
    n = max(1, int(seconds * FPS))
    for _ in range(n):
        t = asyncio.get_event_loop().time()
        shot = await pg.screenshot(clip=clip) if clip else await pg.screenshot()
        frames.append(Image.open(io.BytesIO(shot)).convert("RGB"))
        await asyncio.sleep(max(0, 1 / FPS - (asyncio.get_event_loop().time() - t)))


def save(name, frames, width, still_at=-1):
    from PIL import Image
    OUT.mkdir(parents=True, exist_ok=True)
    h = round(width * frames[0].height / frames[0].width)
    small = [f.resize((width, h), Image.LANCZOS) for f in frames]
    small[0].save(OUT / f"{name}.webp", "WEBP", save_all=True, append_images=small[1:], duration=int(1000 / FPS), loop=0,
                  quality=62, method=4)
    small[still_at].save(OUT / f"{name}-still.webp", "WEBP", quality=80, method=6)
    print(f"wrote {name}: {len(small)} frames, {(OUT / f'{name}.webp').stat().st_size // 1024} KB")


async def studio(b, base):
    pg = await b.new_page(viewport={"width": 1280, "height": 720})
    await pg.add_init_script("try { localStorage.setItem('kc-pv-hint', '1'); localStorage.setItem('kc-whats-new', '99') } catch (e) {}")
    await pg.goto(base + "/dashboard.html")
    await pg.wait_for_timeout(1800)
    await pg.evaluate(QUIET)
    await pg.evaluate("KCStore.update(n => { KCScenes.hideAll(n); n.live.scene = ''; })")
    # the first Frame chosen in the Studio (the clips before may have left another one selected)
    await pg.evaluate("(() => { const s = KCScenes.order(KCStore.get())[0]; if (s && window.KCWorkspace) KCWorkspace.select(s.id); })()")
    await pg.wait_for_timeout(600)
    return pg


async def go_live(b, base):
    pg = await studio(b, base)
    f = []
    await rec(pg, 0.8, f, STAGE)
    await pg.click("#cb-take")                      # Go Live: the first Frame goes on screen
    await rec(pg, 2.0, f, STAGE)
    await pg.mouse.move(1, 1)
    await pg.keyboard.press("ArrowRight")           # the next question, on screen
    await rec(pg, 1.6, f, STAGE)
    await pg.keyboard.press("ArrowRight")
    await rec(pg, 1.6, f, STAGE)
    save("go-live", f, 960, still_at=int(2.4 * FPS))
    await pg.close()


async def spotlight(b, base):
    pg = await studio(b, base)
    await pg.evaluate("KCStore.update(n => { KCScenes.take(n, KCScenes.order(n)[0].id, null); })")
    await pg.wait_for_timeout(1500)
    f = []
    await rec(pg, 0.6, f, STAGE)
    still = 0
    for fx, fy in ((0.47, 0.30), (0.62, 0.31)):      # the Spotlight lands on a word, then (Esc) on the next one
        await pg.evaluate(f"window.KCAnnotate.spotAtPicture({fx}, {fy})")
        await rec(pg, 1.6, f, STAGE)
        still = still or len(f) - 2
        await pg.keyboard.press("Escape")
        await rec(pg, 0.5, f, STAGE)
    save("spotlight", f, 960, still_at=still)
    await pg.close()


async def memory_cards(b, base):
    pg = await studio(b, base)
    await pg.evaluate("KCStore.update(n => { KCScenes.take(n, KCScenes.order(n)[0].id, null); })")
    await pg.wait_for_timeout(1500)
    post(base, "/api/memory", {"action": "clear"})
    f = []
    await rec(pg, 0.8, f, STAGE)
    post(base, "/api/memory", {"action": "add", "text": "Grace: Could we pray for my mother’s surgery on Friday?", "show": True})
    await rec(pg, 2.0, f, STAGE)
    post(base, "/api/memory", {"action": "add", "text": "Daniel: Verse 105 is my favourite, a light for each step.", "show": True})
    await rec(pg, 2.2, f, STAGE)
    post(base, "/api/memory", {"action": "clear"})
    save("memory-cards", f, 960, still_at=-2)
    await pg.close()


async def phone(b, base):
    pg = await studio(b, base)
    await pg.evaluate("KCStore.update(n => { KCScenes.take(n, KCScenes.order(n)[0].id, null); })")
    await pg.close()
    ph = await b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    await ph.goto(base + "/remote.html")
    await ph.wait_for_selector("#app:not([hidden])")
    await ph.wait_for_timeout(1500)
    f = []
    await rec(ph, 0.8, f)
    for _ in range(2):
        await ph.tap("#next")                       # Next Frame, from the phone
        await rec(ph, 1.6, f)
    save("phone-remote", f, 330)
    await ph.close()


async def connection_check(b, base):
    post(base, "/api/app/remote", {"enabled": False})
    pg = await studio(b, base)
    await pg.evaluate("KCSetTab('settings'); KCShowSection('ipad')")
    await pg.wait_for_timeout(800)
    box = await pg.evaluate("(() => { const r = document.getElementById('remote-box').getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: Math.min(560, 720 - r.y)}; })()")
    f = []
    await rec(pg, 0.6, f, box)
    await pg.click("#cx-run")                       # Check my connection
    await rec(pg, 2.6, f, box)
    await pg.click(".cx li button")                 # the one fix offered: Turn it on
    await rec(pg, 3.4, f, box)
    save("check-connection", f, 900)
    await pg.close()


async def main_async(base, chromium, only=()):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": chromium} if chromium else {}))
        for clip in (go_live, spotlight, memory_cards, phone, connection_check):
            if not only or clip.__name__ in only:
                await clip(b, base)
        await b.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--url", default="http://localhost:8750")
    ap.add_argument("--chromium", default=None)
    ap.add_argument("only", nargs="*", help="only these clips (go_live, spotlight, memory_cards, phone, connection_check)")
    a = ap.parse_args()
    asyncio.run(main_async(a.url.rstrip("/"), a.chromium, tuple(a.only)))


if __name__ == "__main__":
    main()
