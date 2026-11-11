"""FrameDecks 26.11.44 - a QR code to scan for members' phones (owner, 11 November).

1. "Show the code on screen" showed only the code: the card now carries the QR code too, on the camera and on every
   overlay page, so people on Zoom or Teams scan it.
2. Settings -> Meeting & Branding: a small QR code beside or below the logo on the Branding badge, while members' phones
   is open, so someone who arrives late scans it.
One encoder (src/qr_encode.py), checked here by decoding what it makes."""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

URL = "https://framedecks.com/follow#c=K7M2QX"


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def _cv2():
    try:
        import cv2
        return cv2
    except ImportError:
        return None


def _render(rows, px=8, quiet=4):
    import numpy as np
    n = len(rows)
    img = np.full(((n + 2 * quiet) * px, (n + 2 * quiet) * px), 255, np.uint8)
    for y, row in enumerate(rows):
        for x, on in enumerate(row):
            if on:
                img[(y + quiet) * px:(y + quiet + 1) * px, (x + quiet) * px:(x + quiet + 1) * px] = 0
    return img


class Encoder(unittest.TestCase):
    def test_sizes_follow_the_length(self):
        import qr_encode
        self.assertEqual(len(qr_encode.encode("hi")), 21)                   # version 1
        self.assertEqual(len(qr_encode.encode(URL)), 29)                    # a members' phones link: version 3
        self.assertEqual(len(qr_encode.encode("https://a.example/" + "z" * 190)), 57)   # version 10
        with self.assertRaises(ValueError):
            qr_encode.encode("x" * 400)

    def test_finder_patterns_and_timing(self):
        import qr_encode
        m = qr_encode.encode(URL)
        n = len(m)
        for cx, cy in ((3, 3), (n - 4, 3), (3, n - 4)):
            self.assertTrue(m[cy][cx])                                        # the dark centre
            self.assertFalse(m[cy - 2][cx])                                   # the light ring
            self.assertTrue(m[cy - 3][cx])                                    # the dark ring
        self.assertEqual([m[6][x] for x in range(8, n - 8)], [x % 2 == 0 for x in range(8, n - 8)])
        self.assertTrue(m[n - 8][8])                                          # the dark module

    @unittest.skipUnless(_cv2(), "OpenCV not installed")
    def test_a_phone_reads_what_it_makes(self):
        import qr_encode
        cv2 = _cv2()
        det = cv2.QRCodeDetector()
        for text in ("hi", URL, "https://a.example/" + "x" * 60, "https://a.example/" + "y" * 120, "https://a.example/" + "z" * 190):
            self.assertEqual(det.detectAndDecode(_render(qr_encode.encode(text)))[0], text)


class Helper(unittest.TestCase):
    def test_only_a_short_https_link(self):
        import join_qr
        self.assertTrue(join_qr.valid(URL))
        for bad in ("http://framedecks.com/follow#c=K7", "javascript:alert(1)", "https://x", "https://" + "a" * 300, None, 5):
            self.assertFalse(join_qr.valid(bad))

    def test_svg_and_picture(self):
        import join_qr
        svg = join_qr.svg(URL)
        self.assertTrue(svg.startswith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37"'))   # 29 + 2 x 4 quiet
        self.assertIn('fill="#fff"', svg)
        img = join_qr.image(URL, 200)
        self.assertEqual(img.size, (185, 185))                               # whole pixels per module, nearest to 200
        self.assertEqual(img.getpixel((0, 0)), (255, 255, 255, 255))         # the white quiet zone


class TheCodeCard(unittest.TestCase):
    def test_the_card_carries_the_link(self):
        import memory
        m = memory.Memory(path=None)
        m.put("Follow along on your phone", "Go to framedecks.com/follow and type the code K7M2QX", stay=True, qr=URL)
        card = m.overlay(12)[0][0]
        self.assertEqual(card["qr"], URL)
        m.put("Prayer request", "Pray for the youth camp")
        self.assertNotIn("qr", [c for c in m.overlay(12)[0] if c["title"] == "Prayer request"][0])
        m.put("x", "a card", qr="javascript:alert(1)")
        self.assertNotIn("qr", [c for c in m.overlay(12)[0] if c["title"] == "x"][0])

    @unittest.skipUnless(_cv2(), "OpenCV not installed")
    def test_the_camera_draws_a_qr_that_reads(self):
        import numpy as np
        from vcam import chatcard
        from vcam.cards import Fonts
        cv2 = _cv2()
        card = {"id": "m1", "title": "Follow along on your phone", "text": "Go to framedecks.com/follow and type the code K7M2QX",
                "src": "phone", "full": True, "qr": URL}
        made = chatcard.draw(Fonts(ROOT / "app" / "fonts"), [card], 1920, 1080, "beside", "right")[0]
        b = np.asarray(made.base, dtype=np.float32)
        a = b[..., 3:4]
        gray = cv2.cvtColor(np.clip(b[..., :3] * 255 + (1 - a) * np.array([40, 60, 90]), 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
        self.assertEqual(cv2.QRCodeDetector().detectAndDecode(gray)[0], URL)
        small = cv2.resize(gray, None, fx=0.66, fy=0.66, interpolation=cv2.INTER_AREA)   # a 1080p camera sent at 720p
        self.assertEqual(cv2.QRCodeDetector().detectAndDecode(small)[0], URL)
        plain = chatcard.draw(Fonts(ROOT / "app" / "fonts"), [dict(card, qr="")], 1920, 1080, "beside", "right")[0]
        self.assertLess(plain.h, made.h)                                        # no link, no QR

    def test_the_overlay_pages_show_it(self):
        js = read("app/js/overlay.js")
        self.assertIn("q.className = 'chat-qr';", js)
        self.assertIn("'api/join-qr.svg?c=' + encodeURIComponent(", js)
        self.assertIn(".chat-qr{display:block;width:calc(var(--u)*11)", read("app/css/overlay.css"))
        self.assertIn("if (joinUrl(c.qr)) o.qr = c.qr;", read("app/js/store.js"))


class OnTheBadge(unittest.TestCase):
    def setUp(self):
        os.environ["KC_DATA_DIR"] = tempfile.mkdtemp()
        import server
        self.server = server

    def test_live_join_only_while_open_and_asked(self):
        s = self.server
        s.save_app_settings({"joinQr": "off"})
        r = s.ROOM
        was = (r.code, r.url, r.closes_at)
        try:
            r.code, r.url, r.closes_at = "K7M2QX", URL, time.time() + 3600
            self.assertIsNone(s.join_live())                                  # open, but the setting is off
            s.save_app_settings({"joinQr": "below"})
            self.assertEqual(s.join_live(), {"url": URL, "code": "K7M2QX", "pos": "below"})
            s.update_state(lambda st: st)
            self.assertEqual(s.state["live"]["join"]["pos"], "below")
            s.update_state(lambda st: dict(st, live=dict(st.get("live") or {}, join={"url": "https://evil.example/x", "pos": "beside"})))
            self.assertEqual(s.state["live"]["join"]["url"], URL)             # the server's, whatever a save sends
            r.closes_at = time.time() - 1                                     # closed
            self.assertIsNone(s.join_live())
            s.update_state(lambda st: st)
            self.assertNotIn("join", s.state["live"])
        finally:
            r.code, r.url, r.closes_at = was
            s.save_app_settings({"joinQr": "off"})

    def test_the_setting_has_three_choices(self):
        s = self.server
        self.assertEqual(s.APP_SETTINGS_DEFAULTS["joinQr"], "off")
        self.assertEqual(s.APP_SETTING_CHOICES["joinQr"], ("off", "beside", "below"))
        self.assertFalse(s._valid_setting("joinQr", "left"))

    @unittest.skipUnless(_cv2(), "OpenCV not installed")
    def test_the_camera_badge_reads_beside_and_below(self):
        import numpy as np
        from vcam.program import ProgramFX
        cv2 = _cv2()
        fx = ProgramFX(str(ROOT / "app/fonts"), lambda: {})
        L = {"scale": 1.0, "accent": "", "pad": 1.0, "plate": True, "bg": 1.0, "margin": 4.0, "look": {}}
        base = {"brand": True, "meeting": "Bible Study", "org": "", "logo": None, "name": True, "show_org": False}
        plain = fx._badge(dict(base, join=None), L, 1920, 1080)
        for pos in ("beside", "below"):
            c = fx._badge(dict(base, join=(URL, pos)), L, 1920, 1080)
            b = np.asarray(c.base, dtype=np.float32)
            a = b[..., 3:4]
            gray = cv2.cvtColor(np.clip(b[..., :3] * 255 + (1 - a) * np.array([40, 60, 90]), 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
            self.assertEqual(cv2.QRCodeDetector().detectAndDecode(gray)[0], URL, pos)
            self.assertGreater(c.w if pos == "beside" else c.h, plain.w if pos == "beside" else plain.h)

    def test_the_overlay_badge_and_the_setting(self):
        js = read("app/js/overlay.js")
        self.assertIn("x.card.classList.toggle('qr-beside', !!j && j.pos === 'beside');", js)
        self.assertIn("qf.appendChild(el('figcaption', '', 'Scan to follow'));", js)
        css = read("app/css/overlay.css")
        self.assertIn(".card-brand.qr-below .brand-qr{flex-basis:100%}", css)
        mb = read("app/js/meeting-brand.js")
        self.assertIn("[['off', 'Off'], ['beside', 'Beside the logo'], ['below', 'Below the logo']]", mb)
        self.assertIn("body: JSON.stringify({joinQr: v})", mb)
        self.assertIn("{cls: 'box', id: 'mb-join', 'data-feature': 'team'}", mb)

    def test_the_svg_endpoint_only_while_open(self):
        src = read("src/server.py")
        self.assertIn('if path == "/api/join-qr.svg":', src)
        self.assertIn('return self.reply(404, "Members\' phones is closed", "text/plain; charset=utf-8")', src)


if __name__ == "__main__":
    unittest.main()
