"""FrameDecks 26.11.12 - How people see it: Camera, Share a window, or Both. "Share a window" switches FrameDecks vCam
off and, from the next start, does not load it at all; everything else works. The choice is in Settings and in the
Welcome tour, and the camera panel offers one button back."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


class Engine:
    def __init__(self):
        self.calls = []

    def start(self):
        self.calls.append("start")

    def stop(self):
        self.calls.append("stop")


class PeopleSee(unittest.TestCase):
    def setUp(self):
        import server
        self.s = server
        self.tmp = tempfile.TemporaryDirectory()
        self.vcam = {"enabled": True}
        patches = [mock.patch.object(server, "APP_SETTINGS_FILE", Path(self.tmp.name) / "kc-app-settings.json"),
                   mock.patch.object(server, "vcam_settings", lambda: dict(self.vcam)),
                   mock.patch.object(server, "vcam_save", lambda cur: self.vcam.update(cur))]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self.tmp.cleanup)
        self.engine = Engine()
        self.addCleanup(server.VCAM.update, {"engine": server.VCAM["engine"]})
        server.VCAM["engine"] = self.engine

    def test_both_by_default_and_only_the_three_choices(self):
        self.assertEqual(self.s.app_settings()["peopleSee"], "both")
        self.assertEqual(self.s.save_app_settings({"peopleSee": "projector"})["peopleSee"], "both")

    def test_share_a_window_switches_the_camera_off_and_back(self):
        self.s.save_app_settings({"peopleSee": "window"})
        self.assertFalse(self.vcam["enabled"])
        self.assertEqual(self.engine.calls, ["stop"])
        self.s.save_app_settings({"peopleSee": "camera"})
        self.assertTrue(self.vcam["enabled"])
        self.assertEqual(self.engine.calls, ["stop", "start"])

    def test_with_no_camera_loaded_it_is_started_when_wanted_again(self):
        self.s.VCAM["engine"] = None
        with mock.patch.object(self.s.threading, "Thread") as thread:
            self.s.save_app_settings({"peopleSee": "both"})
        thread.assert_called_once()
        self.assertIs(thread.call_args.kwargs["target"], self.s.vcam_start)

    def test_the_program_does_not_load_the_camera_at_start_for_a_window_only_choice(self):
        src = read("src/server.py")
        self.assertIn('if app_settings()["peopleSee"] != "window":', src)
        self.assertIn('"Off: How people see it is set to Share a window."', src)


class Screens(unittest.TestCase):
    def test_settings_the_welcome_tour_and_the_camera_panel(self):
        svc = read("app/js/service.js")
        self.assertIn("How will people see it?", svc)
        self.assertIn("body: JSON.stringify({peopleSee: v})", svc)
        onb = read("app/js/onboarding.js")
        self.assertIn("seePanel(), syncPanel()]", onb)
        self.assertIn("post('settings', {peopleSee: cur})", onb)
        vp = read("app/js/vcam-panel.js")
        self.assertIn("'Use the camera too'", vp)
        self.assertIn("KCPeopleSee.set('both')", vp)


if __name__ == "__main__":
    unittest.main()
