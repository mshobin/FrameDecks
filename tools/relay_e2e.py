"""FrameDecks - the remote from anywhere, end to end (the exit tests of SaaS Phase 3 and Phase 4).

The real cloud (wrangler dev), the real program with the fixed meeting (tests/fixtures/remote-state.json), the PC's
Settings in a browser, and the remote served from a different address exactly as published (tools/build_pwa.py).

  1. Pair by QR (Phase 4): the phone opens the QR's address, signs in, and waits; Settings at the PC shows the same
     six check digits; Approve. The remote opens with no PIN, in under a minute.
  2. The same as on the Wi-Fi (Phase 3): identical pictures (phone and tablet, Simple and Advanced) and an identical
     api/state through the sealed relay; a press on the phone reaches the PC.
  3. Pair by code, as a Viewer: the phone types the code shown at the PC; it sees, and changes nothing.
  4. Revoke at the PC: the phone is cut off within a second and asked to pair again.

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


def program(api, remote):
    data = Path(tempfile.mkdtemp(prefix="fd-relay-e2e-"))
    shutil.copy(remote_screens.STATE, data / "kc-saved-content.json")
    (data / "kc-remote-pin.txt").write_text(PIN + "\n")
    proc = subprocess.Popen([sys.executable, str(ROOT / "server.py"), "--no-browser"], cwd=str(ROOT),
                            env=dict(os.environ, KC_DATA_DIR=str(data), FRAMEDECKS_API=api, FRAMEDECKS_REMOTE=remote),
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


def get(url):
    return json.load(urllib.request.urlopen(url, timeout=15))


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


async def sign_in(page):
    await page.wait_for_selector("#cloud-email")
    await page.fill("#cloud-email", EMAIL)
    await page.click("#cloud-email-form button")
    await page.wait_for_selector("#cloud-code")
    code = (await page.inner_text("#cloud-card .login-msg")).split(":")[-1].strip()
    await page.fill("#cloud-code", code)
    await page.click("#cloud-code-form button")


async def run(pwa, local, out, chromium):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(**({"executable_path": chromium} if chromium else {}))
        # the PC's Settings
        pc = await (await browser.new_context(viewport={"width": 1440, "height": 1000})).new_page()
        pc.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pc.goto(local + "/dashboard.html")
        await pc.wait_for_function("window.KCStore && KCStore.get()")
        await pc.evaluate("() => { KCSetTab('settings'); KCShowSection('ipad'); }")
        await pc.wait_for_selector("#pair-start")

        # 1. pair by QR
        w, h = remote_screens.SIZES["phone"]
        ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2)
        phone = await ctx.new_page()
        phone.on("pageerror", lambda e: print("PAGE ERROR", e))
        await pc.click("#pair-start")
        await pc.wait_for_selector("#pair-code")
        qr = get(local + "/api/cloud/pairing")["qr"]
        assert qr.startswith(pwa + "/remote.html#pair="), qr
        t0 = time.time()
        await phone.goto(qr)                                   # what the Camera opens
        await sign_in(phone)
        await phone.wait_for_selector("#cloud-card #pair-check")
        assert "pair=" not in phone.url, "the pairing token leaves the address bar"
        on_phone = (await phone.inner_text("#cloud-card #pair-check")).strip()
        await pc.wait_for_selector("#pair-ask #pair-check", timeout=10000)
        on_pc = (await pc.inner_text("#pair-ask #pair-check")).strip()
        assert on_phone == on_pc, f"check digits differ: phone {on_phone}, PC {on_pc}"
        await phone.screenshot(path=str(out / "pair-1-phone-waiting.png"))
        await pc.locator("#remote-anywhere").screenshot(path=str(out / "pair-2-pc-approve.png"))
        await pc.click("#pair-approve")
        await phone.wait_for_selector("#app", state="visible", timeout=20000)
        took = time.time() - t0
        assert took < 60, f"pairing took {took:.0f} s"
        print(f"1. paired by QR with approval at the PC in {took:.1f} s; both showed {on_phone}; the remote opened with no PIN")
        storage = await ctx.storage_state()
        await ctx.close()

        # 2. the same as on the Wi-Fi, through the sealed relay
        (out / "relay").mkdir(parents=True, exist_ok=True)
        for size, (w2, h2) in remote_screens.SIZES.items():
            for layout, role in remote_screens.ROLES.items():
                c = await browser.new_context(viewport={"width": w2, "height": h2}, device_scale_factor=2, reduced_motion="reduce", storage_state=storage)
                await c.add_init_script(f"try {{ localStorage.setItem('bcc-remote-role', {json.dumps(role)}); }} catch(e) {{}}")
                pg = await c.new_page()
                await pg.goto(pwa + "/remote.html")
                await pg.wait_for_selector("#app", state="visible", timeout=20000)
                await pg.wait_for_timeout(2500)
                await pg.evaluate("document.querySelectorAll('iframe').forEach(f => f.style.visibility = 'hidden')")
                await pg.screenshot(path=str(out / "relay" / f"{size}-{layout}.png"), animations="disabled")
                await c.close()
        op_ctx = await browser.new_context(viewport={"width": 390, "height": 844}, storage_state=storage)
        op = await op_ctx.new_page()
        await op.goto(pwa + "/remote.html")
        await op.wait_for_selector("#app", state="visible", timeout=20000)
        via = await op.evaluate("KCTransport.fetch('api/state').then(r => r.json())")
        assert via == get(local + "/api/state"), "api/state through the relay differs from the PC's"
        before = via.get("rev")
        await op.click("#hide-all")
        for _ in range(50):
            if get(local + "/api/state").get("rev") != before:
                break
            await asyncio.sleep(0.1)
        assert get(local + "/api/state").get("rev") != before, "a press on the phone did not reach the PC"
        print("2. through the sealed relay: api/state identical, HIDE ALL reached the PC")

        # 3. pair by code, as a Viewer
        vctx = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        viewer = await vctx.new_page()
        if os.environ.get("FD_E2E_DEBUG"):
            viewer.on("console", lambda m: print("VIEWER CONSOLE", m.type, m.text))
            viewer.on("response", lambda r: print("VIEWER", r.request.method, r.url.split("/v1")[-1], r.status) if "/v1/" in r.url else None)
        await viewer.goto(pwa + "/remote.html")
        await sign_in(viewer)
        await viewer.click("[data-pc]:not([disabled])")
        await viewer.wait_for_selector("#pair-code")
        await pc.click("#pair-start")
        await pc.wait_for_selector("#pair-box #pair-code")
        code = (await pc.inner_text("#pair-box #pair-code")).strip()
        await viewer.fill("#pair-code", code)
        await viewer.screenshot(path=str(out / "pair-3-phone-code.png"))
        await viewer.click("#pair-form button")
        try:
            await viewer.wait_for_selector("#cloud-card #pair-check", timeout=15000)
        except Exception:
            raise SystemExit("Pairing by code did not reach the waiting card; the phone shows: " + await viewer.inner_text("#cloud-card"))
        await pc.wait_for_selector("#pair-ask #pair-check", timeout=10000)
        assert (await viewer.inner_text("#cloud-card #pair-check")).strip() == (await pc.inner_text("#pair-ask #pair-check")).strip()
        await pc.select_option("#pair-ask select", "viewer")
        await pc.click("#pair-approve")
        await viewer.wait_for_selector("#app", state="visible", timeout=20000)
        before = get(local + "/api/state").get("rev")
        status = await viewer.evaluate("""KCTransport.fetch('api/state', {method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({rev: %d})}).then(r => r.status)""" % before)
        assert status == 403 and get(local + "/api/state").get("rev") == before, "a Viewer changed something"
        print("3. paired by code as a Viewer: it sees the state and its changes are refused (403)")

        # 4. revoke at the PC: cut off within a second
        await pc.wait_for_selector("#trusted-devices tr[data-device]")
        rows = await pc.query_selector_all("#trusted-devices tr[data-device]")
        await pc.locator("#remote-anywhere").screenshot(path=str(out / "pair-4-pc-devices.png"))
        assert len(rows) == 2, f"two trusted devices expected, found {len(rows)}"
        first = await rows[0].get_attribute("data-device")
        target = op if first == (await op.evaluate("JSON.parse(Object.entries(localStorage).find(([k]) => k.includes(':dev:'))[1]).id")) else viewer
        t1 = time.time()
        await (await rows[0].query_selector("button.danger")).click()
        await target.wait_for_selector("text=This phone was removed", timeout=5000)
        cut = time.time() - t1
        failed = await target.evaluate("KCTransport.fetch('api/rev').then(() => false, () => true)")
        assert failed, "the revoked phone still reaches the PC"
        assert cut < 1.0, f"cut off after {cut:.2f} s"
        await target.screenshot(path=str(out / "pair-5-phone-removed.png"))
        print(f"4. revoked at the PC: the phone was cut off in {cut * 1000:.0f} ms and asked to pair again")
        await browser.close()


def main():
    a = argparse.ArgumentParser(description="FrameDecks: the remote from anywhere and pairing, end to end")
    a.add_argument("--api", default="http://127.0.0.1:8787")
    a.add_argument("--chromium", default=None)
    a.add_argument("--out", default=None)
    args = a.parse_args()
    out = Path(args.out or tempfile.mkdtemp(prefix="fd-relay-out-"))
    out.mkdir(parents=True, exist_ok=True)
    srv, pwa = pages(args.api)
    proc, local = program(args.api, pwa)
    try:
        code = post(local + "/api/cloud/email-start", {"email": EMAIL}).get("devCode")
        post(local + "/api/cloud/email-verify", {"email": EMAIL, "code": code})
        post(local + "/api/cloud/settings", {"relay": True, "computerName": "Church PC"})
        post(local + "/api/app/skip-import", {})
        for _ in range(60):
            if get(local + "/api/cloud/status")["relayLink"]["state"] == "online":
                break
            time.sleep(0.25)
        else:
            raise SystemExit("The PC did not reach the relay")
        asyncio.run(remote_screens.shoot(local, out / "direct", args.chromium, "direct"))   # the Wi-Fi pictures first
        asyncio.run(run(pwa, local, out, args.chromium))
    finally:
        proc.terminate()
        srv.shutdown()
    bad = remote_screens.compare(out / "direct", out / "relay")
    if bad:
        raise SystemExit("Through the relay the remote looks different:\n  " + "\n  ".join(bad) + f"\n(pictures in {out})")
    print(f"END TO END: OK. Pairing, roles and revoke work; the remote looks the same through the relay (pictures in {out})")


if __name__ == "__main__":
    main()
