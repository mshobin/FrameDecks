"""FrameDecks - end to end: the real cloud (wrangler dev) and two copies of the program syncing through it.

    cd cloud && node scripts/make-jwt-key.mjs > .dev.vars && npx wrangler d1 migrations apply framedecks --local
    npx wrangler dev --port 8787            # then, from the repository root:
    python tools/cloud_e2e.py [--chromium PATH] [--out DIR]

Two computers sign in through Settings > FrameDecks account, then: Frames reach the second computer (the starter Frame
both made is not doubled), a new Deck travels one way and a new Frame the other, a Frame renamed on both is kept twice
and both end the same, and going live sends nothing. Then the members list: turned on with a recovery key on one,
unlocked with it on the other (both lists merged; the cloud holds only ciphertext), the account downloaded, and deleted.
Use a fresh local database (delete cloud/.wrangler/state).
"""
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
import argparse
EMAIL = f"ann+{int(time.time())}@example.org"   # a new account each run (5 email codes an hour per address)
ROOT = Path(__file__).resolve().parent.parent
ARGS = argparse.ArgumentParser(description="FrameDecks cloud sync, end to end")
ARGS.add_argument("--api", default="http://127.0.0.1:8787")
ARGS.add_argument("--chromium", default=None, help="a Chromium to use instead of Playwright's own")
ARGS.add_argument("--out", default=None, help="where the screenshots and program logs go (default: a new temp folder)")
A_ = ARGS.parse_args()
API = A_.api
OUT = Path(A_.out or tempfile.mkdtemp(prefix="fd-e2e-out-")); OUT.mkdir(parents=True, exist_ok=True)

def start(name):
    data = Path(tempfile.mkdtemp(prefix=f"fd-e2e-{name}-"))
    proc = subprocess.Popen([sys.executable, str(ROOT / "server.py"), "--no-browser"], cwd=str(ROOT),
                            env=dict(os.environ, KC_DATA_DIR=str(data), FRAMEDECKS_API=API),
                            stdout=open(OUT / f"{name}.log", "w"), stderr=subprocess.STDOUT)
    for _ in range(80):
        for port in range(8750, 8761):
            try:
                info = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/api/app/info", timeout=0.5))
                if Path(info.get("dataFolder", "")).resolve() == data.resolve():
                    return proc, port
            except (OSError, ValueError):
                pass
        time.sleep(0.25)
    raise SystemExit("program did not start")

async def main():
    from playwright.async_api import async_playwright
    (pa, porta), (pb, portb) = start("A"), start("B")
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch(**({"executable_path": A_.chromium} if A_.chromium else {}))
            async def open_(port, comp):
                ctx = await br.new_context(viewport={"width": 1440, "height": 900})
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: print(comp, "PAGE ERROR", e))
                pg.on("dialog", lambda d: asyncio.ensure_future(d.accept("DELETE") if d.type == "prompt" else d.accept()))
                urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{port}/api/app/skip-import", data=b"{}", headers={"Content-Type": "application/json"}))
                await pg.goto(f"http://127.0.0.1:{port}/dashboard.html")
                await pg.wait_for_function("window.KCStore && window.KCStore.get()")
                await pg.evaluate("n => fetch('api/cloud/settings', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({computerName:n})})", comp)
                return pg
            A, B = await open_(porta, "Church PC"), await open_(portb, "Home Mac")

            async def sign_in(pg, shot):
                await pg.evaluate("() => { KCSetTab('settings'); KCShowSection('account'); }")
                await pg.wait_for_selector("#acct-email")
                await pg.fill("#acct-email", EMAIL)
                await pg.click("#account-body button:text-is(\"Email me a code\")")
                await pg.wait_for_selector("#acct-code")
                code = await pg.evaluate("""() => new Promise(r => { const f = () => { const t = [...document.querySelectorAll('.toast, [class*=toast]')].map(e => e.textContent).join(' '); const m = t.match(/Test code: (\\d{6})/); m ? r(m[1]) : setTimeout(f, 100); }; f(); })""")
                await pg.fill("#acct-code", code)
                await pg.click("#account-body button:text-is(\"Sign in\")")
                try:
                    await pg.wait_for_selector("text=Signed in as", timeout=10000)
                except Exception:
                    await pg.screenshot(path=str(OUT / "fail.png"))
                    print("BODY:", await pg.inner_text("#account-body"))
                    print("STATUS:", await pg.evaluate("() => fetch('api/cloud/status').then(r => r.json())"))
                    raise
                if shot: await pg.screenshot(path=str(OUT / shot))

            names = lambda pg: pg.evaluate("() => KCStore.get().scenes.map(s => s.name)")
            sync = lambda pg: pg.evaluate("() => KCCloudSync && fetch('api/cloud/status').then(() => window.__sync())")
            for pg in (A, B):   # a handle on the running engine's syncNow
                await pg.evaluate("() => { window.__sync = () => new Promise(r => { const b = [...document.querySelectorAll('#account-body button')].find(x => x.textContent === 'Sync now'); b.click(); setTimeout(r, 2500); }); }")

            # A has Frames of its own
            await A.evaluate("""() => KCStore.update(n => { n.scenes[0].name = 'Sunday Welcome'; })""")
            await sign_in(A, "e2e-a-signed-in.png")
            await A.wait_for_timeout(1500); await sync(A)
            await sign_in(B, None)
            await B.wait_for_timeout(1500); await sync(B)
            na, nb = await names(A), await names(B)
            print("1 after both signed in  A:", na, " B:", nb)
            assert "Sunday Welcome" in nb, "B received A's Frames"
            assert nb.count("Birthday") == 1, "the starter Frame both computers made is not added twice"

            # 2. A -> B: rename a Deck
            await A.evaluate("""() => KCStore.update(n => { const s = n.scenes.find(x => x.name === 'Sunday Welcome'); KCScenes.addDeck(s, 'Prayer'); })""")
            await sync(A); await sync(B)
            decks = await B.evaluate("() => KCScenes.decksOf(KCStore.get().scenes.find(x => x.name === 'Sunday Welcome')).map(d => d.name)")
            print("2 B sees A's new Deck:", decks); assert "Prayer" in decks

            # 3. B -> A: a new Frame made on B
            await B.evaluate("""() => KCStore.update(n => { const c = JSON.parse(JSON.stringify(n.scenes[0])); c.name = 'Made on the Mac'; KCScenes.freshIds(c); c.id = 'sc_mac1'; n.scenes.push(c); })""")
            await sync(B); await sync(A)
            na = await names(A); print("3 A:", na); assert "Made on the Mac" in na

            # 4. Conflict: the same Frame renamed on both before syncing
            await A.evaluate("() => KCStore.update(n => { n.scenes.find(x => x.id === 'sc_mac1').name = 'Renamed on PC'; })")
            await B.evaluate("() => KCStore.update(n => { n.scenes.find(x => x.id === 'sc_mac1').name = 'Renamed on Mac'; })")
            await sync(A); await sync(B); await sync(A)
            na, nb = await names(A), await names(B)
            print("4 A:", na, "\n  B:", nb)
            assert sorted(na) == sorted(nb), "both end the same"
            assert "Renamed on PC" in na and "Renamed on Mac (from Home Mac)" in na, "nothing lost"
            await B.screenshot(path=str(OUT / "e2e-b-after-conflict.png"))

            # 5. Going live on A sends nothing
            seq0 = json.load(urllib.request.urlopen(f"http://127.0.0.1:{porta}/api/cloud/sync-state"))["seq"]
            await A.evaluate("() => KCStore.update(n => { KCScenes.take(n, n.scenes[0].id, 'cut'); })")
            await sync(A)
            seq1 = json.load(urllib.request.urlopen(f"http://127.0.0.1:{porta}/api/cloud/sync-state"))["seq"]
            print("5 seq before/after going live:", seq0, seq1); assert seq0 == seq1
            # 6. The members list: turned on with a recovery key on A, unlocked with it on B
            post = lambda pg, path, body: pg.evaluate("([p, b]) => fetch(p, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(b)}).then(r => r.status)", [path, body])
            await post(A, "api/private", {"members": [{"id": "m1", "name": "Ann Lee"}], "settings": {}})
            await post(B, "api/private", {"members": [{"id": "m2", "name": "Bob Diaz"}], "settings": {}})
            await A.reload(); await B.reload()
            for pg in (A, B):
                await pg.wait_for_function("window.KCStore && window.KCStore.get()")
                await pg.evaluate("() => { KCSetTab('settings'); KCShowSection('account'); }")
                await pg.evaluate("() => { window.__sync = () => new Promise(r => { const b = [...document.querySelectorAll('#account-body button')].find(x => x.textContent === 'Sync now'); b.click(); setTimeout(r, 2500); }); }")
            await A.click("#account-body button:text-is(\"Sync my members list too…\")")
            await A.wait_for_selector(".acct-key")
            code = (await A.inner_text(".acct-key")).strip()
            await A.screenshot(path=str(OUT / "e2e-a-recovery-key.png"))
            await A.wait_for_timeout(2500); await sync(B)
            await B.wait_for_selector("#acct-recovery")
            await B.fill("#acct-recovery", code.lower().replace("-", " "))
            await B.click("#account-body button:text-is(\"Unlock\")")
            await B.wait_for_timeout(4000); await sync(A)
            people = lambda pg: pg.evaluate("() => fetch('api/private').then(r => r.json()).then(d => d.members.map(m => m.name).sort())")
            pa_, pb_ = await people(A), await people(B)
            print("6 members  A:", pa_, " B:", pb_)
            assert pa_ == pb_ == ["Ann Lee", "Bob Diaz"], "both lists merged on both computers"
            raw = subprocess.run(["npx", "wrangler", "d1", "execute", "framedecks", "--local", "--json", "--command",
                                  "SELECT body FROM entities WHERE kind = 'members'"], cwd=str(ROOT / "cloud"), capture_output=True, text=True).stdout
            assert '"ct' in raw and "Ann" not in raw and "Bob" not in raw, "the cloud holds only ciphertext"
            print("  the cloud's copy is sealed:", raw.count('ct'), "envelope, no names")

            # 7. Download a copy of the account
            exp = await A.evaluate("() => fetch('api/cloud/export').then(r => r.json())")
            print("7 export has:", sorted(exp)[:8]); assert exp

            # 8. Delete the account from B: B is signed out, A finds itself signed out on its next sync; both keep everything
            await B.click("#account-body button:text-is(\"Delete my account…\")")
            await B.wait_for_selector("#acct-email", timeout=10000)
            await sync(A); await A.wait_for_timeout(1000)
            sa = await A.evaluate("() => fetch('api/cloud/status').then(r => r.json())")
            print("8 after delete: A signed in?", sa["signedIn"], " B Frames kept:", len(await names(B)))
            assert not sa["signedIn"] and len(await names(B)) >= 4
            print("END TO END: OK  (screenshots and logs in", OUT, ")")
            await br.close()
    finally:
        pa.terminate(); pb.terminate()

asyncio.run(main())
