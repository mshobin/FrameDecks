"""FrameDecks 26.11.61: Branding is one badge for every Frame, set only in Settings > Meeting look; the camera follows
the same rule as the Studio (src/vcam/program.py live_brand). Also the preview without labels, Hide all held for a
second goes off air, Next week left the Frames panel, and the phone remote shows the meeting's own logo."""
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from vcam.program import live_brand  # noqa: E402


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


class Badge(unittest.TestCase):
    def st(self, **kw):
        st = {"brand": {"meeting": "Tuesday", "logo": "v1", "show": True,
                        "badge": {"logo": True, "name": True, "org": False, "pos": "upper-right", "vcam": True, "obs": True}},
              "scenes": [{"id": "a", "layers": []}], "live": {"scene": "a", "on": {}}}
        st["brand"].update(kw)
        return st

    def test_one_badge_on_any_live_frame(self):
        got = live_brand(self.st())
        self.assertEqual([x["id"] for x in got], ["brand-badge"])

    def test_off_hidden_or_not_on_the_camera(self):
        self.assertEqual(live_brand(self.st(show=False)), [])
        st = self.st(); st["live"]["brandOff"] = "a"
        self.assertEqual(live_brand(st), [], "Hide all takes it off this Frame")
        st = self.st(); st["brand"]["badge"]["vcam"] = False
        self.assertEqual(live_brand(st, "vcam"), [])
        st = self.st(); st["live"]["scene"] = ""
        self.assertEqual(live_brand(st), [], "nothing live, no badge")

    def test_members_qr_shows_even_with_branding_off(self):
        st = self.st(show=False)
        st["live"]["join"] = {"url": "https://framedecks.com/follow?c=ABCD1234", "code": "ABCD1234", "pos": "beside"}
        got = live_brand(st)
        self.assertEqual(len(got), 1, "the QR has a badge of its own")
        self.assertFalse(got[0]["c"]["logo"] or got[0]["c"]["name"], "the QR alone")
        st["brand"]["show"] = True
        self.assertTrue(live_brand(st)[0]["c"]["logo"], "with Branding on, the QR sits beside the logo")

    def test_old_branding_content_is_not_shown_twice(self):
        st = self.st(show=False)
        st["scenes"][0]["layers"] = [{"id": "B", "kind": "brand", "c": {"logo": True}}]
        st["live"]["on"] = {"B": True}
        self.assertEqual(live_brand(st), [])


class Studio(unittest.TestCase):
    def test_branding_left_the_decks_panel(self):
        ws = read("app/js/workspace.js")
        self.assertNotIn("['brand', 'Branding (logo + Meeting Name)', 'star']", ws)
        self.assertIn("if (l.kind === 'brand') return;", ws)
        self.assertNotIn("Branding: show my logo and Meeting Name in this Frame", ws)

    def test_settings_page_holds_every_branding_choice(self):
        mb = read("app/js/meeting-brand.js")
        for want in ("Branding on screen", "What it shows", "Where", "Size and style", "Shows on", "Colours on screen", "mb-qr"):
            self.assertIn(want, mb)
        self.assertNotIn("Where branding appears", mb)
        html = read("app/dashboard.html")
        self.assertLess(html.index('id="meeting-body"'), html.index('id="s-look"'), "this window's look comes last")

    def test_no_labels_over_the_picture(self):
        self.assertIn("html body .stage-row .canvas-badge,html body .program-badge,html body .s2-badge{display:none}", read("app/css/theme.css"))

    def test_hide_all_hold_goes_off_air(self):
        js = read("app/js/off-air.js")
        self.assertIn("document.querySelector('.cmdbar [data-cb=\"hideAll\"]')", js)
        self.assertIn("Hold for a second to go off air.", js)

    def test_next_week_left_the_frames_panel(self):
        self.assertNotIn('id="mt-next"', read("app/dashboard.html"))

    def test_phone_remote_shows_the_meetings_logo(self):
        js = read("app/js/remote.js")
        self.assertIn("'api/brand/logo?v=' + encodeURIComponent(logo) : 'img/framedecks-emblem.webp'", js)


if __name__ == "__main__":
    unittest.main()
