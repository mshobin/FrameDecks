"""FrameDecks - the remote from anywhere, end to end (SaaS Phase 3 exit test).

The real cloud (wrangler dev), the real program with the fixed meeting (tests/fixtures/remote-state.json), and the
remote served from a different address, as Cloudflare Pages will serve it. A phone signs in, chooses the PC, enters the
PIN, and then the remote must look exactly as it does on the Wi-Fi, give the same answers, and control the PC.

    cd cloud && node scripts/make-jwt-key.mjs > .dev.vars && npx wrangler d1 migrations apply framedecks --local
    npx wrangler dev --port 8787            # then, from the repository root:
    python tools/relay_e2e.py [--chromium PATH] [--out DIR]
"""
import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import remote_screens  # noqa: E402  (the same pictures, sizes and layouts as the Wi-Fi check)

PIN = "135790"
EMAIL = f"ann+{int(time.time())}@example.org"   # a new account each run (5 email codes an hour per address)


def program(api):
    data = Path(tempfile.mkdtemp(prefix="fd-relay-e2e-"))
    shutil.copy(remote_screens.STATE, data / "kc-saved-content.json")
    (data / "kc-remote-pin.txt").write_text(PIN + "\n")
    proc = subprocess.Popen([sys.executable, str(ROOT / "server.py"), "--no-browser"], cwd=str(ROOT),
                            env=dict(os.environ, KC_DATA_DIR=str(data), FRAMEDECKS_API=api),
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(80):
        for port in range(8750, 8761):
            try:
                info = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/api/app/info", timeout=0.5))
                if Path(info.get("dataFolder", "")).resolve() == data.resolve():
                    return proc, f"http://127.0.0.1:{port}"
            except (OSError, ValueError):
                pass
        time.sleep(0.25)
    proc.kill()
    raise SystemExit("The program did not start")


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    return json.load(urllib.request.urlopen(req, timeout=15))


def pages(api):
    """The remote exactly as it is published (tools/build_pwa.py), served from another address, as Pages will."""
    import build_pwa
    site = build_pwa.build(api, Path(tempfile.mkdtemp(prefix="fd-pwa-")) / "dist")

    class H(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(H, directory=str(site)))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


async def phone(pwa, local, out, chromium):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(**({"executable_path": chromium} if chromium else {}))
        w, h = remote_screens.SIZES["phone"]
        ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print("PAGE ERROR", e))
        await page.goto(pwa + "/remote.html")
        await page.fill("#cloud-email", EMAIL)
        await page.screenshot(path=str(out / "pwa-1-sign-in.png"))
        await page.click("#cloud-email-form button")
        await page.wait_for_selector("#cloud-code")
        code = (await page.inner_text("#cloud-card .login-msg")).split(":")[-1].strip()
        await page.fill("#cloud-code", code)
        await page.click("#cloud-code-form button")
        await page.wait_for_selector("[data-pc]:not([disabled])")
        await page.screenshot(path=str(out / "pwa-2-choose-pc.png"))
        await page.click("[data-pc]:not([disabled])")
        await page.wait_for_selector("#pin", state="visible", timeout=20000)
        assert await page.evaluate("KCTransport.name") == "relay"
        await page.screenshot(path=str(out / "pwa-3-pin.png"))
        await page.fill("#pin", PIN)
        await page.click("#login-form button")
        await page.wait_for_selector("#app", state="visible")
        print("signed in, chose the PC, entered the PIN: the remote is open through the relay")

        storage = await ctx.storage_state()
        await ctx.close()

        # the same pictures as on the Wi-Fi, through the relay
        (out / "relay").mkdir(parents=True, exist_ok=True)
        for size, (w, h) in remote_screens.SIZES.items():
            for layout, role in remote_screens.ROLES.items():
                c = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, reduced_motion="reduce", storage_state=storage)
                await c.add_init_script(f"try {{ localStorage.setItem('bcc-remote-role', {json.dumps(role)}); }} catch(e) {{}}")
                pg = await c.new_page()
                await pg.goto(pwa + "/remote.html")
                await pg.wait_for_selector("#app", state="visible", timeout=20000)
                await pg.wait_for_timeout(2500)
                await pg.evaluate("document.querySelectorAll('iframe').forEach(f => f.style.visibility = 'hidden')")
                await pg.screenshot(path=str(out / "relay" / f"{size}-{layout}.png"), animations="disabled")
                await c.close()

        c = await browser.new_context(viewport={"width": 390, "height": 844}, storage_state=storage)
        pg = await c.new_page()
        await pg.goto(pwa + "/remote.html")
        await pg.wait_for_selector("#app", state="visible", timeout=20000)
        # the same answers: the state through the relay is the state on the PC
        via = await pg.evaluate("KCTransport.fetch('api/state').then(r => r.json())")
        direct = json.load(urllib.request.urlopen(local + "/api/state"))
        assert via == direct, "api/state through the relay differs from the PC's"
        print("api/state through the relay is identical (rev", via.get("rev"), ")")

        # it controls the PC: HIDE ALL on the phone changes the PC's state
        before = direct.get("rev")
        await pg.click("#hide-all")
        for _ in range(50):
            now = json.load(urllib.request.urlopen(local + "/api/state")).get("rev")
            if now != before:
                break
            await asyncio.sleep(0.1)
        assert now != before, "a press on the phone did not reach the PC"
        print("HIDE ALL pressed on the phone reached the PC (rev", before, "->", now, ")")
        await browser.close()


def main():
    a = argparse.ArgumentParser(description="FrameDecks: the remote from anywhere, end to end")
    a.add_argument("--api", default="http://127.0.0.1:8787")
    a.add_argument("--chromium", default=None)
    a.add_argument("--out", default=None)
    args = a.parse_args()
    out = Path(args.out or tempfile.mkdtemp(prefix="fd-relay-out-"))
    out.mkdir(parents=True, exist_ok=True)
    proc, local = program(args.api)
    srv = None
    try:
        code = post(local + "/api/cloud/email-start", {"email": EMAIL}).get("devCode")
        post(local + "/api/cloud/email-verify", {"email": EMAIL, "code": code})
        post(local + "/api/cloud/settings", {"relay": True, "computerName": "Church PC"})
        for _ in range(60):
            if json.load(urllib.request.urlopen(local + "/api/cloud/status"))["relayLink"]["state"] == "online":
                break
            time.sleep(0.25)
        else:
            raise SystemExit("The PC did not reach the relay")
        print("the PC is connected to the relay")
        # the Wi-Fi pictures first, before the phone presses anything
        asyncio.run(remote_screens.shoot(local, out / "direct", args.chromium, "direct"))
        srv, pwa = pages(args.api)
        asyncio.run(phone(pwa, local, out, args.chromium))
    finally:
        proc.terminate()
        if srv:
            srv.shutdown()
    bad = remote_screens.compare(out / "direct", out / "relay")
    if bad:
        raise SystemExit("Through the relay the remote looks different:\n  " + "\n  ".join(bad) + f"\n(pictures in {out})")
    print(f"RELAY END TO END: OK. The remote looks the same through the relay ({len(list((out / 'relay').glob('*.png')))} pictures, in {out})")


if __name__ == "__main__":
    main()
