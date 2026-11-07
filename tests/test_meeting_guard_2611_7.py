"""FrameDecks 26.11.7 - the meeting guard (src/meeting_guard.py): measures only while a meeting app uses FrameDecks
vCam, makes FrameDecks lighter while the PC is very busy, and lists what is in the way with its one action."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import meeting_guard as mg  # noqa: E402


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


class Busy(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.t = [1000.0]
        self.g = mg.Guard(lambda: True, self.calls.append, clock=lambda: self.t[0])
        self.g.checks = lambda max_age=2.0: {"cameras": [], "power": None}

    def look(self, cpu, gpu=None, app=5.0, top=None):
        self.t[0] += 3
        return self.g.look({"cpu": cpu, "gpu": gpu, "appCpu": app, "appGpu": None, "appMB": 300.0, "memLoad": 70, "top": top})

    def test_busy_only_after_about_nine_seconds_and_calm_again_after_six(self):
        self.look(95); self.look(95)
        self.assertFalse(self.g.status["busy"])
        self.look(95)
        self.assertTrue(self.g.status["busy"])
        self.assertEqual(self.calls, [True])                       # FrameDecks makes its camera work lighter once
        self.look(85)                                              # between the lines: stays busy
        self.assertTrue(self.g.status["busy"])
        self.look(50); self.look(50)
        self.assertFalse(self.g.status["busy"])
        self.assertEqual(self.calls, [True, False])

    def test_the_graphics_card_alone_can_make_it_busy(self):
        for _ in range(3):
            self.look(40, gpu=99)
        self.assertTrue(self.g.status["busy"])

    def test_the_note_names_the_busiest_other_program_or_says_framedecks_got_lighter(self):
        for _ in range(3):
            self.look(96, top={"name": "Zoom", "cpu": 60.0})
        w = [x for x in self.g.report()["warnings"] if x["id"] == "busy"][0]
        self.assertIn("processor 96%", w["text"])
        self.assertIn("Most of it: Zoom.", w["text"])
        for _ in range(3):
            self.look(96, app=55.0, top={"name": "Zoom", "cpu": 20.0})
        w = [x for x in self.g.report()["warnings"] if x["id"] == "busy"][0]
        self.assertIn("FrameDecks has made its camera work lighter", w["text"])
        self.assertNotIn("Most of it", w["text"])

    def test_peaks_and_recent_looks_for_the_support_report(self):
        self.look(30); self.look(70, gpu=50)
        r = self.g.report()
        self.assertEqual(r["peak"]["cpu"], 70)
        self.assertEqual(r["peak"]["gpu"], 50)
        self.assertEqual(len(r["recent"]), 2)

    def test_stop_puts_the_camera_work_back(self):
        for _ in range(3):
            self.look(95)
        self.g.stop()
        self.assertEqual(self.calls, [True, False])
        self.assertFalse(self.g.status["active"])


class InTheWay(unittest.TestCase):
    def report(self, cameras=(), power=None):
        g = mg.Guard(lambda: False)
        g.checks = lambda max_age=2.0: {"cameras": list(cameras), "power": power}
        return g.report()["warnings"]

    def test_the_windows_camera_app_gets_close_it(self):
        w = self.report([{"id": mg.CAMERA_APP, "name": "the Windows Camera app", "closable": True, "meeting": False}])
        self.assertEqual([(x["id"], x.get("action")) for x in w], [("camera-app", "close-camera")])

    def test_other_camera_users_are_named_but_meeting_apps_are_expected(self):
        w = self.report([{"id": "x", "name": "OBS", "closable": False, "meeting": False},
                         {"id": "z", "name": "Zoom", "closable": False, "meeting": True}])
        self.assertEqual([(x["id"], x.get("action")) for x in w], [("camera-other", None)])
        self.assertIn("OBS", w[0]["text"])

    def test_battery_saver(self):
        self.assertEqual([x.get("action") for x in self.report(power={"saver": True, "onBattery": True})], ["power"])
        self.assertEqual(self.report(power={"saver": False, "onBattery": True}), [])

    def test_names(self):
        self.assertEqual(mg.friendly("C:#Program Files#Zoom#bin#Zoom.exe"), "Zoom")
        self.assertEqual(mg.friendly(mg.CAMERA_APP), "the Windows Camera app")
        self.assertEqual(mg.friendly("obs64.exe"), "OBS")


class Measuring(unittest.TestCase):
    def test_processor_share_between_two_readings(self):
        self.assertEqual(mg.cpu_percent((100, 1000), (150, 1100)), 50.0)
        self.assertIsNone(mg.cpu_percent(None, (1, 2)))

    def test_framedecks_and_everything_it_started(self):
        procs = [(10, 1, "FRAMEDECKS.exe"), (11, 10, "msedgewebview2.exe"), (12, 11, "msedgewebview2.exe"), (20, 1, "Zoom.exe")]
        self.assertEqual(mg.family(procs, 10), {10, 11, 12})

    def test_off_windows_every_part_is_harmless(self):
        if mg.IS_WIN:
            self.skipTest("Windows")
        self.assertEqual(mg.camera_users(), [])
        self.assertIsNone(mg.power())
        self.assertEqual(mg.close_camera_app(), 0)
        self.assertIsNone(mg.Gpu().read())
        self.assertIsNotNone(mg.system_memory())

    def test_nothing_starts_a_shell_or_ends_another_program(self):
        src = read("src/meeting_guard.py")
        for bad in ("subprocess", "os.system", "TerminateProcess", "taskkill", "powershell", "Popen"):
            self.assertNotIn(bad, src)
        self.assertIn("0x0010", src)                               # Close it is WM_CLOSE, as the app's own X


class Wiring(unittest.TestCase):
    def test_server(self):
        src = read("src/server.py")
        self.assertIn('"ms-settings:batterysaver"', src)
        self.assertIn('if path == "/api/app/guard":', src)
        self.assertIn('if action == "guard":', src)
        self.assertIn("blur.period = 0.2 if busy else 0.1", src)
        self.assertIn('"guard": _guard().report()', src)

    def test_the_studio_rests_behind_a_meeting(self):
        self.assertIn("if (resting()){ pulling = false; return; }", read("app/js/studio.js"))
        self.assertIn("var rest = window.KCGuard && KCGuard.active && !document.hasFocus();", read("app/js/workspace.js"))

    def test_control_shows_what_is_in_the_way_only_while_open_and_in_front(self):
        js = read("app/js/command-center.js")
        self.assertIn("if (!open || !open.control || !document.hasFocus()) return;", js)
        self.assertIn("'close-camera': 'Close it'", js)
        self.assertIn("'Meeting guard: ' + guardLine(d.guard)", read("app/js/settings.js"))


if __name__ == "__main__":
    unittest.main()
