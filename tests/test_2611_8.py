"""FrameDecks 26.11.8 - a sharper meeting meter, meeting mode in every window, and Branding's Background slider."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import meeting_guard as mg  # noqa: E402


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


class GpuSplit(unittest.TestCase):
    def test_framedecks_share_by_process_and_by_kind(self):
        vals = [("pid_10_luid_0x0_0x1_phys_0_eng_0_engtype_3D", 20.0),        # the program
                ("pid_11_luid_0x0_0x1_phys_0_eng_0_engtype_3D", 45.0),        # its pages (WebView2)
                ("pid_11_luid_0x0_0x1_phys_0_eng_3_engtype_VideoDecode", 12.0),
                ("pid_20_luid_0x0_0x1_phys_0_eng_0_engtype_3D", 30.0),        # Zoom
                ("_Total", 99.0)]
        r = mg.split_gpu(vals, {10, 11}, {10: "FRAMEDECKS.exe", 11: "msedgewebview2.exe", 20: "Zoom.exe"})
        self.assertEqual(r["total"], 95.0)                                    # the busiest engine (3D: 20 + 45 + 30)
        self.assertEqual(r["app"], 65.0)
        self.assertEqual(r["pages"], 45.0)
        self.assertEqual(r["program"], 20.0)
        self.assertEqual(r["kinds"], {"3D": 65.0, "VideoDecode": 12.0})

    def test_the_look_keeps_the_split_and_which_window_was_in_front(self):
        g = mg.Guard(lambda: True)
        g.checks = lambda max_age=2.0: {"cameras": [], "power": None}
        g.look({"cpu": 50, "gpu": 90, "appCpu": 10, "appGpu": 70, "pagesGpu": 60, "programGpu": 10, "gpuKinds": {"3D": 70},
                "appMB": 900, "memLoad": 40, "front": None, "open": ["Studio", "Teleprompter"]})
        last = g.report()["recent"][-1]
        self.assertEqual((last["pagesGpu"], last["open"], last["front"]), (60, ["Studio", "Teleprompter"], None))
        self.assertEqual(g.report()["peak"]["pagesGpu"], 60)


class MeetingMode(unittest.TestCase):
    def test_every_window_knows_and_the_program_says_which_is_in_front(self):
        js = read("app/js/meeting-mode.js")
        self.assertIn("fetch('api/app/guard?brief=1'", js)
        self.assertIn("root.classList.toggle('kc-meeting', !!g.active);", js)
        self.assertIn("return g.known ? g.front !== win : !document.hasFocus();", js)
        for page in ("app/dashboard.html", "app/speaker.html"):
            self.assertIn('<script src="js/meeting-mode.js"></script>', read(page))
        src = read("src/server.py")
        self.assertIn('if "brief=1" in url.query:', src)
        self.assertIn('context=lambda: DESKTOP["windows"]() if DESKTOP.get("windows") else {}', src)
        self.assertIn("windows=windows_now, alert_card=alert_card", read("src/desktop_app.py"))   # 26.11.25 the corner card follows

    def test_up_next_is_hidden_never_reloaded_and_the_pictures_rest(self):
        ws = read("app/js/workspace.js")
        self.assertIn("$('un-frame').classList.toggle('kc-rest', rest);", ws)
        self.assertIn(".un-pic iframe.kc-rest{display:none}", read("app/css/theme.css"))
        self.assertIn("KCGuardRest('Studio')", read("app/js/studio.js"))
        self.assertIn("KCGuardRest('Studio')", read("app/js/vcam-panel.js"))

    def test_the_teleprompter_drops_its_blur_in_a_meeting(self):
        css = read("app/css/teleprompter.css")
        self.assertIn("html.kc-meeting .tp-float-mode .tp-cues,html.kc-meeting .tp-float.tp-controls{-webkit-backdrop-filter:none;backdrop-filter:none", css)

    def test_the_report_names_pages_and_counts_memory(self):
        import server
        server.REQ["counts"].clear()
        server.count_request("/stage.html")
        server.count_request("/js/store.js")
        self.assertEqual(server.REQ["counts"], {"page stage.html": 1, "file": 1})
        self.assertTrue(server.process_memory_mb())


class BrandBackground(unittest.TestCase):
    def test_the_slider_replaces_the_switch_and_older_plans_keep_their_look(self):
        ws = read("app/js/workspace.js")
        self.assertIn("row('Background', rangeCtl(bg, 0, 1, 0.01,", ws)
        self.assertIn("var bg = c.plate === false ? 0 : (c.bg == null ? 1 : c.bg);", ws)
        st = read("app/js/store.js")
        self.assertIn("plate: true, pad: 1, margin: 4, bg: 1}", st)
        self.assertIn("bg: [0, 1], at: [0, 99]}", st)   # 26.11.33 at: the song verse on screen

    def test_overlay_and_camera_fade_the_plate(self):
        self.assertIn("x.card.style.setProperty('--bga', String(bga));", read("app/js/overlay.js"))
        self.assertIn(".card-brand::after{content:\"\";position:absolute;inset:0;z-index:-1;", read("app/css/overlay.css"))
        from vcam.program import ProgramFX
        import numpy as np
        fx = ProgramFX(str(ROOT / "app/fonts"), lambda: {})
        d = {"brand": True, "meeting": "Bible Study", "org": "", "logo": None, "name": True, "show_org": False}
        alpha = {}
        for bg in (1.0, 0.5, 0.0):
            c = fx._badge(d, {"scale": 1.0, "accent": "", "pad": 1.0, "plate": True, "bg": bg, "margin": 4.0, "look": {}}, 1920, 1080)
            b = np.asarray(c.base, dtype=np.float32)
            alpha[bg] = float(b[b.shape[0] // 2, c.margin + 20, 3])
        self.assertAlmostEqual(alpha[1.0], 225 / 255, places=2)              # 100 %: the plate as before
        self.assertAlmostEqual(alpha[0.5], 0.5 * 225 / 255, delta=0.01)
        self.assertLess(alpha[0.0], 0.1)                                      # none: only the soft shadow


if __name__ == "__main__":
    unittest.main()
