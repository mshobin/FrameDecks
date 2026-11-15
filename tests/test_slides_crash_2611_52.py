"""FrameDecks 26.11.52 - adding a PowerPoint and pressing Present slides no longer crashes the program (owner, 15 November:
"When i added the ppt, and tried to present the slides, the app crashed").

PDFium (pypdfium2) is not thread-safe. Since 26.11.49 a deck's small pictures are made in the background as soon as it
is added; Present then puts the deck live at once, so the camera drew the same PDF from another thread (and the slides
window and phones asked for pictures too). Every use of PDFium now holds one lock."""
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class OneThreadInPdfium(unittest.TestCase):
    def setUp(self):
        try:
            import pypdfium2  # noqa: F401
            from PIL import Image  # noqa: F401
        except ImportError:
            self.skipTest("pypdfium2 or Pillow is not installed")
        from test_slides_2611_45 import make_pdf
        self.dir = Path(tempfile.mkdtemp())
        make_pdf(self.dir / "Deck52.pdf", ["navy", "maroon", "green"])

    def blocked_while_held(self, fn):
        """fn() runs in a thread while the lock is held here: it must wait for it."""
        import slides
        done = threading.Event()
        with slides.PDFIUM_LOCK:
            t = threading.Thread(target=lambda: (fn(), done.set()), daemon=True)
            t.start()
            time.sleep(0.4)
            waited = not done.is_set()
        t.join(10)
        self.assertTrue(done.is_set(), "it finishes once the lock is free")
        return waited

    def test_small_pictures_page_count_and_text_wait_for_the_lock(self):
        import slides
        self.assertTrue(self.blocked_while_held(lambda: slides.thumb(self.dir, "Deck52.pdf", 2, 160)))
        self.assertTrue(self.blocked_while_held(lambda: slides.page_count(self.dir / "Deck52.pdf")))
        self.assertTrue(self.blocked_while_held(lambda: slides.read_pdf(self.dir / "Deck52.pdf")))

    def test_the_camera_waits_for_it_too(self):
        try:
            from vcam.layers import PdfSource
        except ImportError as e:
            self.skipTest("the camera's modules are not available here: %s" % e)
        src = PdfSource(self.dir / "Deck52.pdf")
        try:
            self.assertTrue(self.blocked_while_held(lambda: src.go(2)))
        finally:
            src.close()

    def test_many_threads_at_once_stay_up(self):
        import slides
        errors = []

        def work(k):
            try:
                for n in (1, 2, 3):
                    slides.thumb(self.dir, "Deck52.pdf", n, (160, 320, 480)[k % 3])
                    slides.page_count(self.dir / "Deck52.pdf")
            except Exception as e:                     # noqa: BLE001
                errors.append(e)
        ts = [threading.Thread(target=work, args=(k,)) for k in range(6)]
        [t.start() for t in ts]
        [t.join(30) for t in ts]
        self.assertEqual(errors, [])


class CrashReporter(unittest.TestCase):
    def test_a_crash_leaves_a_trace_in_the_support_bundle(self):
        import faulthandler
        import os
        os.environ["KC_DATA_DIR"] = tempfile.mkdtemp()
        import server
        was = faulthandler.is_enabled()
        try:
            server.crash_reporter()
            f = server.DATA / server.CRASH_LOG
            self.assertTrue(f.is_file())
            self.assertIn("FrameDecks " + server.APP_VERSION + " started", f.read_text(encoding="utf-8"))
            self.assertTrue(faulthandler.is_enabled())
        finally:
            faulthandler.disable()
            if was:
                faulthandler.enable()
        src = read("src/server.py")
        self.assertIn("SUPPORT_LOG, CRASH_LOG", src)
        self.assertLess(src.index("    crash_reporter()"), src.index("    server = start_main_server()"))


class Wiring(unittest.TestCase):
    def test_every_use_holds_the_lock(self):
        sl, ly = read("src/slides.py"), read("src/vcam/layers.py")
        self.assertIn("PDFIUM_LOCK = threading.RLock()", sl)
        self.assertEqual(sl.count("with PDFIUM_LOCK:"), 3)
        self.assertEqual(ly.count("with _pdfium_lock():"), 3)
        self.assertIn("time.sleep(0.05)", read("src/server.py")[read("src/server.py").index("def deck_ready"):][:1200])


if __name__ == "__main__":
    unittest.main()
