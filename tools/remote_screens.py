"""FrameDecks - screenshots of the phone remote (remote.html), to prove a change leaves it looking the same.

Starts the program with a fixed meeting (tests/fixtures/remote-state.json) in a temporary data folder, opens
remote.html at phone and tablet size in the Simple and Advanced layouts, and saves or compares the pictures.

    python tools/remote_screens.py --save DIR          # take the pictures
    python tools/remote_screens.py --against DIR       # take them again and compare with DIR (any difference fails)
    python tools/remote_screens.py --transports        # the same pictures through the direct transport and through
                                                       # a loopback relay transport must be identical (CI)

Needs: pip install playwright pillow (and a Chromium: playwright install chromium, or --chromium <path>).
"""
import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "tests" / "fixtures" / "remote-state.json"
SIZES = {"phone": (390, 844), "tablet": (1024, 768)}
ROLES = {"simple": "presenter", "advanced": "admin"}

# A transport that sends every request through a message channel and answers from fetch on the other side: what
# the cloud relay will do (Phase 3), without the cloud. If the remote looks different through it, the seam leaks.
LOOPBACK = """
(function(){
  var pending = {}, n = 0, ch = new MessageChannel();
  ch.port2.onmessage = function(e){                      // the "runtime" side: replay the request, send back the answer
    var m = e.data;
    fetch(m.path, m.init).then(function(r){ return r.arrayBuffer().then(function(b){
      var h = {}; r.headers.forEach(function(v, k){ h[k] = v; });
      ch.port2.postMessage({id: m.id, status: r.status, headers: h, body: b}, [b]);
    }); }).catch(function(err){ ch.port2.postMessage({id: m.id, error: String(err)}); });
  };
  ch.port1.onmessage = function(e){
    var m = e.data, p = pending[m.id]; delete pending[m.id];
    if (m.error) p.reject(new TypeError(m.error));
    else p.resolve(new Response(m.status === 204 || m.status === 304 ? null : m.body, {status: m.status, headers: m.headers}));
  };
  window.KCTransportUse = function(){
    window.KCTransport.use({name: 'loopback', fetch: function(path, init){
      init = Object.assign({}, init || {}); delete init.signal;            // a signal cannot cross the channel
      return new Promise(function(resolve, reject){ var id = ++n; pending[id] = {resolve: resolve, reject: reject};
        ch.port1.postMessage({id: id, path: path, init: init}); });
    }});
  };
})();
"""


def start_program():
    """The program with the fixed meeting in its own data folder. Returns (process, data folder, port): the program
    takes the first free port from 8750, so its port is the one whose app info names this data folder."""
    data = Path(tempfile.mkdtemp(prefix="fd-remote-"))
    shutil.copy(STATE, data / "kc-saved-content.json")
    proc = subprocess.Popen([sys.executable, str(ROOT / "server.py"), "--no-browser"], env=dict(os.environ, KC_DATA_DIR=str(data)),
                            cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(80):
        for port in range(8750, 8761):
            try:
                info = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/api/app/info", timeout=0.5))
                if Path(info.get("dataFolder", "")).resolve() == data.resolve():
                    return proc, data, port
            except (OSError, ValueError):
                pass
        time.sleep(0.25)
    proc.kill()
    raise SystemExit("The program did not start")


async def shoot(base, out, chromium, transport):
    from playwright.async_api import async_playwright
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(**({"executable_path": chromium} if chromium else {}))
        for size, (w, h) in SIZES.items():
            for layout, role in ROLES.items():
                ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, reduced_motion="reduce")
                await ctx.add_init_script(f"try {{ localStorage.setItem('bcc-remote-role', {json.dumps(role)}); }} catch(e) {{}}")
                if transport == "loopback":
                    await ctx.add_init_script(LOOPBACK + "document.addEventListener('DOMContentLoaded', function(){}, true);")
                    # switch before store.js makes its first request: store.js runs synchronously, so hook it there
                    await ctx.add_init_script("""Object.defineProperty(window, 'KCTransport', {configurable: true, set: function(v){
                        Object.defineProperty(window, 'KCTransport', {value: v, writable: true, configurable: true}); window.KCTransportUse(); },
                        get: function(){ return undefined; }});""")
                page = await ctx.new_page()
                await page.goto(base + "/remote.html")
                await page.wait_for_timeout(2500)
                await page.evaluate("document.querySelectorAll('iframe').forEach(f => f.style.visibility = 'hidden')")   # live pictures
                if transport == "loopback":
                    used = await page.evaluate("window.KCTransport && window.KCTransport.name")
                    assert used == "loopback", f"the loopback transport was not used ({used})"
                await page.screenshot(path=str(out / f"{size}-{layout}.png"), animations="disabled")
                await ctx.close()
        await browser.close()


def compare(a, b):
    from PIL import Image, ImageChops
    bad = []
    for f in sorted(Path(a).glob("*.png")):
        g = Path(b) / f.name
        if not g.exists():
            bad.append(f"{f.name}: missing")
            continue
        x, y = Image.open(f).convert("RGB"), Image.open(g).convert("RGB")
        if x.size != y.size or ImageChops.difference(x, y).getbbox():
            box = ImageChops.difference(x, y).getbbox() if x.size == y.size else "size"
            bad.append(f"{f.name}: differs ({box})")
    return bad


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--save")
    g.add_argument("--against")
    g.add_argument("--transports", action="store_true")
    ap.add_argument("--chromium", default=None)
    a = ap.parse_args()
    proc, data, port = start_program()
    try:
        base = f"http://127.0.0.1:{port}"
        if a.save:
            asyncio.run(shoot(base, Path(a.save), a.chromium, "direct"))
            print("saved", a.save)
            return
        tmp = Path(tempfile.mkdtemp(prefix="fd-shots-"))
        if a.against:
            asyncio.run(shoot(base, tmp / "now", a.chromium, "direct"))
            bad = compare(a.against, tmp / "now")
        else:
            asyncio.run(shoot(base, tmp / "direct", a.chromium, "direct"))
            asyncio.run(shoot(base, tmp / "loopback", a.chromium, "loopback"))
            bad = compare(tmp / "direct", tmp / "loopback")
        if bad:
            print("The remote looks different:\n  " + "\n  ".join(bad) + f"\n(pictures in {tmp})")
            sys.exit(1)
        print(f"The remote looks the same ({len(SIZES) * len(ROLES)} pictures)")
    finally:
        proc.terminate()
        shutil.rmtree(data, ignore_errors=True)


if __name__ == "__main__":
    main()
