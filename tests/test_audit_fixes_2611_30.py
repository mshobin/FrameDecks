"""FrameDecks 26.11.30 - the fixes from the 26.11.29 release audit.

H1  another website could show the Studio inside a hidden frame: pages now say X-Frame-Options and an enforced
    frame-ancestors.  M1 the Content-Security-Policy is enforced.  M2 a plan restored from backup is said on screen.
M3  Off air's accessible name is what it shows.  M4 the camera's layers and cards, the Windows clipboard listener and
    the program's own link get tests of their own.  L1 a bigger connection queue.  L2 the Studio's status comes in one
    request.  L3 setuptools 84.1.0.  L4 the Share Window never asks for a stream that is not there.  L5 the Ready check
    says how to black the screen in a hurry."""
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402

try:
    import numpy as np
    import cv2
    from vcam import layers as VL
    from vcam import overlay as VO
except Exception:                     # OpenCV is part of the program; skip where it is not installed
    np = cv2 = VL = VO = None


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Served(unittest.TestCase):
    """A real program server on a free port (the same Handler the app uses)."""
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.MainServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.port = cls.httpd.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def get(self, path):
        import http.client
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=15)
        c.request("GET", path, headers={"Host": f"127.0.0.1:{self.port}"})
        r = c.getresponse()
        body = r.read()
        c.close()
        return r, body


class Framing(Served):
    def test_pages_refuse_other_sites_frames_and_enforce_the_policy(self):          # H1 + M1
        self.assertEqual(server.CSP_HEADER, "Content-Security-Policy")
        for path in ("/dashboard.html", "/", "/remote.html", "/stage.html", "/present.html"):
            r, _ = self.get(path)
            self.assertEqual(r.status, 200, path)
            self.assertEqual(r.getheader("X-Frame-Options"), "SAMEORIGIN", path)
            csp = r.getheader("Content-Security-Policy") or ""
            self.assertIn("frame-ancestors 'self'", csp, path)
            self.assertIsNone(r.getheader("Content-Security-Policy-Report-Only"), path)
        r, _ = self.get("/js/store.js")
        self.assertIsNone(r.getheader("X-Frame-Options"), "scripts and pictures need no framing rule")

    def test_the_connection_queue(self):                                              # L1
        self.assertGreaterEqual(server.MainServer.request_queue_size, 64)
        self.assertEqual(self.httpd.request_queue_size, server.MainServer.request_queue_size)


class OneStatusRequest(Served):                                                       # L2
    def test_each_part_is_what_its_own_address_answers(self):
        r, body = self.get("/api/app/status?want=presence,sync,slides,guard,nonsense,remote")
        self.assertEqual(r.status, 200)
        d = json.loads(body)
        self.assertEqual(set(d), {"presence", "sync", "slides", "guard", "remote"}, "unknown names are ignored")
        _, own = self.get("/api/presence")
        self.assertEqual(d["presence"], json.loads(own))
        self.assertEqual(set(d["guard"]), {"active", "busy", "front", "known"})
        _, own = self.get("/api/app/guard?brief=1")
        self.assertEqual(set(json.loads(own)), set(d["guard"]))
        self.assertIn("enabled", d["remote"])
        self.assertIn("state", d["sync"])

    def test_nothing_asked_nothing_answered_and_a_broken_part_spoils_nothing(self):
        self.assertEqual(json.loads(self.get("/api/app/status")[1]), {})
        keep = server.STATUS_PARTS["presence"]
        server.STATUS_PARTS["presence"] = lambda port, fresh: 1 / 0
        try:
            d = server.status_bundle("presence,guard", self.port)
        finally:
            server.STATUS_PARTS["presence"] = keep
        self.assertEqual(set(d), {"guard"})

    def test_the_studio_names_its_parts_instead_of_seven_timers(self):
        m = read("app/js/meeting.js")
        self.assertIn("fetch('api/app/status?want=' + want.join(',')", m)
        self.assertIn("bundleT = setTimeout(bundle, Store.pace(3000))", m)
        self.assertNotIn("setInterval(pollSync, 4000)", m)
        self.assertNotIn("setTimeout(pollSlides", m)
        for key in ("remote", "presence", "sync", "slides"):
            self.assertIn("Status.part('%s'" % key, m)
        self.assertIn("KCStatus.part('guard'", read("app/js/meeting-mode.js"))
        self.assertIn("KS.part('studio'", read("app/js/studio.js"))
        self.assertIn("KS.part('vcam'", read("app/js/vcam-panel.js"))
        html = read("app/dashboard.html")
        for f in ("vcam-panel.js", "studio.js"):          # these name their part at load, so the loop must exist first
            self.assertLess(html.index('src="js/meeting.js"'), html.index('src="js/' + f + '"'), f)


class PlanRecoveryNotice(Served):                                                     # M2
    def test_app_info_carries_it_and_the_studio_says_it_once(self):
        server.PLAN_RECOVERY.update(at="20261109-120000", problem="ValueError: bad", keptAs="x.damaged", restoredFrom="2026-11-08")
        try:
            d = json.loads(self.get("/api/app/info")[1])
            self.assertEqual(d["planRecovery"]["restoredFrom"], "2026-11-08")
        finally:
            server.PLAN_RECOVERY.clear()
        self.assertIsNone(json.loads(self.get("/api/app/info")[1])["planRecovery"])
        js = read("app/js/studio-feel.js")
        self.assertIn("var k = 'kc-plan-recovery-' + p.at;", js)
        self.assertIn("the backup from ' + p.restoredFrom + ' was opened. The damaged file was kept.", js)
        self.assertIn("KCShowSection('diag')", js)


class ShareWindow(unittest.TestCase):                                                  # L4
    def test_the_stream_is_asked_for_only_when_the_engine_runs(self):
        html = read("app/present.html")
        self.assertIn("engine(function(on){ if (on === false) overlays(); else connect(); });", html)
        self.assertNotRegex(html, r"\n  connect\(\);\n", "never straight to the stream")


class OffAirName(unittest.TestCase):                                                   # M3
    def test_the_name_is_what_it_shows(self):
        js, ls = read("app/js/off-air.js"), read("app/js/live-stage.js")
        self.assertNotIn("'Off air: press and hold to take everything off screen'", js)
        self.assertNotIn("'Off air: press and hold to take everything off screen'", ls)
        self.assertIn("btn.removeAttribute('aria-label')", js)
        self.assertIn("btn.setAttribute('aria-describedby', holdHint())", js)
        self.assertIn("go.setAttribute('aria-describedby', 'kc-hold-hint')", ls)
        self.assertIn("Press and hold for a second to take everything off screen.", js)


class ReadyCheckSafety(unittest.TestCase):                                             # L5
    def test_the_keys_for_a_hurry(self):
        js = read("app/js/ready-check.js")
        self.assertIn("SCK.short('blackout')", js)
        self.assertIn("' blacks the screen, '", js)
        self.assertIn("Control → Emergency screen shows your message.", js)
        self.assertIn("safety(),", js)


class BuildTool(unittest.TestCase):                                                    # L3
    def test_setuptools_is_past_the_advisory(self):
        self.assertIn("setuptools==84.1.0", read("packaging/constraints.txt"))
        self.assertIn("setuptools==84.1.0 \\", read("packaging/requirements-lock.txt"))
        self.assertNotIn("setuptools==84.0.0", read("packaging/requirements-lock.txt"))


# ---------- M4: the parts that had almost no tests ----------
@unittest.skipIf(VL is None, "OpenCV not installed")
class CameraLayers(unittest.TestCase):
    def test_clean_layer_clamps_and_never_takes_a_path(self):
        l = VL.clean_layer({"id": "a" * 99, "type": "evil", "file": "..\\..\\Windows\\win.ini", "x": 9, "w": -1,
                            "opacity": float("nan"), "visible": 0})
        self.assertEqual((len(l["id"]), l["type"], l["x"], l["w"], l["opacity"], l["visible"]), (40, "image", 1.5, 0.01, 1.0, False))
        self.assertNotIn("\\", l["file"])
        self.assertNotIn("..", l["file"])
        t = VL.clean_layer({"id": "t", "type": "text", "props": {"color": "red", "size": 9, "align": "middle"}})
        self.assertEqual(t["props"]["size"], 0.5)
        self.assertTrue(VL.HEX.match(t["props"]["color"]))
        self.assertIn(t["props"]["align"], ("left", "center", "right"))

    def test_a_huge_picture_is_shrunk_once(self):
        big = np.zeros((4000, 8000, 3), np.uint8)
        self.assertEqual(VL.fit_for_drawing(big).shape[:2], (2160, 4320))
        small = np.zeros((100, 100, 3), np.uint8)
        self.assertIs(VL.fit_for_drawing(small), small)

    def test_layers_draw_bottom_first_and_a_broken_file_never_stops_the_picture(self):
        d = Path(tempfile.mkdtemp())
        img = np.zeros((100, 100, 3), np.uint8)
        img[:] = (0, 0, 255)
        cv2.imwrite(str(d / "red.png"), img)
        m = VL.LayerManager(d)
        m.set_layers([{"id": "bg", "type": "background", "props": {"color": "#00ff00"}},
                      {"id": "pic", "type": "image", "file": "red.png", "x": 0.5, "y": 0.5, "w": 0.2},
                      {"id": "gone", "type": "image", "file": "missing.png"}])
        out = m.compose(np.zeros((720, 1280, 3), np.uint8))
        self.assertEqual(tuple(int(v) for v in out[5, 5]), (0, 255, 0), "the background fills the picture")
        self.assertEqual(tuple(int(v) for v in out[360, 640]), (0, 0, 255), "the picture sits in the middle on top")
        m.set_layers([{"id": "bg", "type": "background", "props": {"color": "#00ff00"}}])
        self.assertNotIn("pic", m.sources, "a removed layer lets go of its file")


@unittest.skipIf(VO is None, "OpenCV not installed")
class CameraCards(unittest.TestCase):
    def test_easing_runs_from_nothing_to_all(self):
        f = VO.bezier(0.2, 0.0, 0.0, 1.0)
        self.assertAlmostEqual(f(0.0), 0.0, places=3)
        self.assertAlmostEqual(f(1.0), 1.0, places=3)
        self.assertLess(f(0.25), f(0.75))

    def test_a_question_comes_onto_the_picture_and_black_screen_takes_it_off(self):
        st = {"question": {"visible": True, "text": "What stood out to you?"}, "live": {}}
        layer = VO.OverlayLayer(VL.fonts_folder(), lambda: st, reduced_motion=True)
        blank = np.zeros((720, 1280, 3), np.uint8)
        drawn = False
        for _ in range(60):                               # the card is drawn on its own thread
            if layer(blank.copy()).any():
                drawn = True
                break
            time.sleep(0.05)
        self.assertTrue(drawn, "the question card is drawn")
        st["live"] = {"blackout": True}
        for _ in range(60):
            out = layer(blank.copy())
            if not out.any():
                break
            time.sleep(0.05)
        self.assertFalse(out.any(), "Black screen takes the card away")


class ProgramLinkAndClipboard(unittest.TestCase):
    def test_only_the_one_link_with_a_grant_is_read(self):
        import desktop_app
        g = desktop_app.grant_from_args
        self.assertEqual(g(["app", "framedecks://connect?grant=ab12cd34"]), "AB12CD34")
        self.assertEqual(g(["app", "framedecks://connect/?grant=AB12CD34/"]), "AB12CD34")
        for bad in ("framedecks://connect?grant=short", "framedecks://other?grant=AB12CD34", "https://evil/?grant=AB12CD34",
                    "framedecks://connect?grant=AB12CD34&x=1"):
            self.assertIsNone(g(["app", bad]), bad)

    def test_the_page_a_copy_came_from(self):
        import capture
        html = "Version:0.9\r\nStartHTML:0001\r\nSourceURL:https://teams.microsoft.com/chat\r\n<html>"
        self.assertEqual(capture.source_url(html), "https://teams.microsoft.com/chat")
        self.assertEqual(capture.source_url(None), "")

    @unittest.skipUnless(os.name == "nt", "the clipboard listener is Windows only")
    def test_the_clipboard_listener_starts_and_stops(self):
        import capture
        w = capture.ClipboardWatcher(lambda *a: None)
        if not w.start():
            self.skipTest("no clipboard listener in this session (a service desktop)")
        self.assertTrue(w.running)
        self.assertTrue(w.start(), "starting twice keeps the one listener")
        w.stop()
        w._thread.join(3)
        self.assertFalse(w._thread.is_alive(), "its thread ends")


if __name__ == "__main__":
    unittest.main()
