"""FrameDecks 26.11.31 - features you switch on or off.

One list (src/features.py, app/js/features.js), three ready-made sets, switches locked while live, and a feature that
is off disappears from every surface and stops its background work: listening, voice commands, the phone remote,
Capture, Follow my voice, the meeting log and the meeting guard. The camera's switch is How people see it itself."""
import json
import os
import re
import sys
import tempfile
import threading
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import features as FEAT  # noqa: E402
import server  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Registry(unittest.TestCase):
    def test_the_python_and_javascript_lists_are_the_same(self):
        js = read("app/js/features.js")
        found = re.findall(r"\{id: '([a-z]+)', group: '([a-z]+)', label: '([^']+)'", js)
        self.assertEqual([(i, g, l) for i, g, l in found], [tuple(f) for f in FEAT.FEATURES])
        for g in {f[1] for f in FEAT.FEATURES}:
            self.assertIn("{id: '%s', label:" % g, js)
        for p in FEAT.PRESETS:
            self.assertIn("{id: '%s', label:" % p, js)

    def test_never_chosen_means_everything_on_and_the_camera_follows_how_people_see_it(self):
        eff = FEAT.effective({}, "both")
        self.assertTrue(all(eff.values()))
        self.assertFalse(FEAT.effective({}, "window")["vcam"])
        self.assertEqual(FEAT.preset_of(eff), "full")

    def test_presets_and_changes(self):
        new, see = FEAT.change({}, "both", {"preset": "simple"})
        eff = FEAT.effective(new, see)
        self.assertEqual(FEAT.preset_of(eff), "simple")
        self.assertFalse(eff["listen"])
        self.assertTrue(eff["ready"])
        self.assertEqual(see, "both", "a ready-made set never changes how people see it")
        new, see = FEAT.change(new, see, {"set": {"vcam": False}})
        self.assertEqual(see, "window")
        new, see = FEAT.change(new, "window", {"set": {"vcam": True}})
        self.assertEqual(see, "both")
        new, see = FEAT.change(new, "camera", {"set": {"vcam": True}})
        self.assertEqual(see, "camera", "on stays the choice that was made")
        for bad in ({}, {"preset": "huge"}, {"set": {"evil": True}}, {"set": {"memory": "yes"}}, []):
            with self.assertRaises(ValueError):
                FEAT.change({}, "both", bad)

    def test_a_feature_that_is_off_holds_its_settings_off(self):
        held = FEAT.held(FEAT.effective({"listen": False, "voice": False, "remote": False}))
        self.assertEqual(held, {"scriptureListen": False, "scriptureAuto": False, "scriptureMeeting": False,
                                "voiceCommands": False, "remoteAutostart": False})
        self.assertFalse(FEAT.valid({"vcam": False}), "the camera is never stored: How people see it is")
        self.assertFalse(FEAT.valid({"nope": True}))


class Program(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.MainServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.port = cls.httpd.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def setUp(self):
        server.state.setdefault("live", {})["scene"] = ""
        server.save_app_settings({"features": {}, "peopleSee": "both", "scriptureListen": False, "voiceCommands": False})

    def call(self, method, path, body=None):
        import http.client
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=15)
        data = json.dumps(body).encode() if body is not None else None
        c.request(method, path, body=data, headers={"Host": f"127.0.0.1:{self.port}", server.LOCAL_HEADER: server.LOCAL_TOKEN, "Content-Type": "application/json"})
        r = c.getresponse()
        out = r.status, json.loads(r.read() or b"{}")
        c.close()
        return out

    def test_read_switch_and_preset(self):
        code, d = self.call("GET", "/api/app/features")
        self.assertEqual(code, 200)
        self.assertEqual(set(d["features"]), set(FEAT.IDS))
        self.assertEqual(d["preset"], "full")
        code, d = self.call("POST", "/api/app/features", {"set": {"memory": False}})
        self.assertEqual(code, 200)
        self.assertFalse(d["features"]["memory"])
        self.assertEqual(d["preset"], "")
        code, d = self.call("POST", "/api/app/features", {"preset": "study"})
        self.assertEqual(d["preset"], "study")
        self.assertEqual(self.call("POST", "/api/app/features", {"set": {"bogus": True}})[0], 400)
        info = self.call("GET", "/api/app/info")[1]
        self.assertEqual(info["features"]["preset"], "study")

    def test_locked_while_live(self):
        server.state["live"]["scene"] = "sc_live"
        try:
            code, d = self.call("POST", "/api/app/features", {"set": {"memory": False}})
            self.assertEqual(code, 409)
            self.assertIn("Off air", d["error"])
            self.assertTrue(self.call("GET", "/api/app/features")[1]["locked"])
        finally:
            server.state["live"]["scene"] = ""

    def test_the_settings_route_cannot_change_features(self):
        self.call("POST", "/api/app/settings", {"features": {"memory": False}})
        self.assertTrue(server.feature_on("memory"), "features change only through api/app/features (with its lock)")

    def test_off_stops_the_background_work(self):
        server.save_app_settings({"scriptureListen": True, "voiceCommands": True})
        self.call("POST", "/api/app/features", {"set": {"listen": False, "voice": False}})
        cfg = server.app_settings()
        self.assertFalse(cfg["scriptureListen"])
        self.assertFalse(cfg["voiceCommands"])
        with self.assertRaises(ValueError):
            server.verse_listen_action({"op": "mode", "value": "ask"})
        self.assertFalse(server.memory_capture(True) if not server.feature_on("memory") else False)
        self.call("POST", "/api/app/features", {"set": {"memory": False, "guard": False, "summary": False, "follow": False}})
        self.assertFalse(server.memory_capture(True), "Capture never starts while Memory Cards is off")
        self.assertFalse(server._guard_in_use(), "the meeting guard never measures while it is off")
        with self.assertRaises(ValueError):
            server.voice_action({"op": "start", "words": ["hello"]})
        code, d = self.call("POST", "/api/app/remote", {"enabled": True})
        self.assertEqual(code, 200, "the phone remote feature is still on")
        self.call("POST", "/api/app/remote", {"enabled": False})
        self.call("POST", "/api/app/features", {"set": {"remote": False}})
        self.assertEqual(self.call("POST", "/api/app/remote", {"enabled": True})[0], 409)

    def test_the_camera_switch_is_how_people_see_it(self):
        self.call("POST", "/api/app/features", {"set": {"vcam": False}})
        self.assertEqual(server.app_settings()["peopleSee"], "window")
        self.assertFalse(server.feature_on("vcam"))
        server.save_app_settings({"peopleSee": "camera"})
        self.assertTrue(server.feature_on("vcam"), "choosing the camera in How people see it switches it back on")

    def test_pages_hear_about_a_change(self):
        rev = server.RIDERS["ft"]()
        self.call("POST", "/api/app/features", {"set": {"seasons": False}})
        self.assertNotEqual(server.RIDERS["ft"](), rev)
        self.assertFalse(server.remote_studio_body()["features"]["seasons"], "the phone gets the switches with the Studio")


class Surfaces(unittest.TestCase):
    def test_chips_leave_out_what_is_off(self):
        js = read("app/js/chips.js")
        self.assertIn("return everyFeature ? own.concat(also) : own.concat(also).filter(featureOn);", js)
        for aid, fid in (("cards", "memory"), ("capture", "memory"), ("listen", "listen"), ("phone", "remote"), ("sync", "team"), ("camera", "vcam")):
            self.assertRegex(js, r"A\('[a-z]+', '%s'.*feature: '%s'" % (aid, fid))
        self.assertIn("A('more', 'features', 'Features'", js)
        for core in ("golive", "prevnext", "hideall", "black", "emergency"):
            self.assertNotRegex(js, r"A\('[a-z]+', '%s'.*feature:" % core, "the core is never a switch")

    def test_every_surface_follows(self):
        for page in ("dashboard.html", "spotlight.html", "remote.html", "speaker.html"):
            self.assertIn('<script src="js/features.js"></script>', read("app/" + page), page)
        cc = read("app/js/command-center.js")
        self.assertIn("features: {id: 'features', label: 'Features'", cc)
        self.assertIn("tell('Off air to change features.', true)", cc)
        self.assertIn("' is off · Turn on?'", read("app/js/palette.js"))
        self.assertIn("KCFeatures.take({features: d.features})", read("app/js/remote.js"))
        self.assertIn("usePanel(), seePanel(), syncPanel()", read("app/js/onboarding.js"))
        panel = read("app/js/features-panel.js")
        self.assertIn("'Off air to change. Features stay as they are while something is on screen.'", panel)
        html = read("app/dashboard.html")
        for fid in ("memory", "vcam", "remote", "team", "birthdays"):
            self.assertIn('data-feature="%s"' % fid, html)


if __name__ == "__main__":
    unittest.main()
