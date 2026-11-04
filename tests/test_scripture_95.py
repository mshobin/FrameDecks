"""FrameDecks 9.5 - the KJV and the World English Bible (public domain) fetched without a key from bible-api.com and
saved for offline use like the ESV."""
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402

REPLY = {"reference": "John 3:16", "verses": [{"book_name": "John", "chapter": 3, "verse": 16,
         "text": "For God so loved the world, that he gave his one and only Son,\n"}],
         "text": "For God so loved the world, that he gave his one and only Son,\n", "translation_id": "web"}


class Reply(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class OpenBibles(unittest.TestCase):
    def setUp(self):
        self.calls = []

    def fake(self, payload=REPLY, error=None):
        def urlopen(req, timeout=0):
            self.calls.append(req.full_url)
            if error:
                raise error
            return Reply(json.dumps(payload).encode())
        return mock.patch("urllib.request.urlopen", urlopen)

    def test_web_is_fetched_without_a_key_and_saved(self):
        with self.fake():
            d = server.scripture_lookup("John 3:16", "WEB", fresh=True)
        self.assertEqual((d["ref"], d["version"], d["cached"]), ("John 3:16", "WEB", False))
        self.assertEqual(d["text"], "For God so loved the world, that he gave his one and only Son,")
        self.assertIn("bible-api.com/John%203%3A16?translation=web", self.calls[0])
        with self.fake(error=OSError("offline")):
            again = server.scripture_lookup("John 3:16", "web")          # lower case works; from this PC
        self.assertTrue(again["cached"])
        self.assertEqual(again["version"], "WEB")

    def test_kjv_offline_with_nothing_saved(self):
        with self.fake(error=OSError("offline")):
            with self.assertRaises(ValueError) as e:
                server.scripture_lookup("Psalm 117:2", "KJV", fresh=True)
        self.assertIn("No internet connection", str(e.exception))

    def test_other_translations_are_typed(self):
        with self.assertRaises(ValueError) as e:
            server.scripture_lookup("John 3:16", "NIV")
        self.assertIn("ESV, KJV and WEB", str(e.exception))


if __name__ == "__main__":
    unittest.main()


class Onboarding(unittest.TestCase):
    """9.5 the Welcome flow's record in kc-app-settings.json (kept by updates and reinstalls)."""

    def test_valid_records(self):
        for ok in ({}, {"done": True}, {"done": True, "at": 1793776365}, {"done": True, "skipped": True, "at": 1.5}):
            self.assertTrue(server._valid_onboarding(ok), ok)
        for bad in ([], {"done": "yes"}, {"done": True, "who": "x"}, {"at": -1}, {"at": True}, {"skipped": 1}):
            self.assertFalse(server._valid_onboarding(bad), bad)

    def test_saved_and_read_back(self):
        self.assertEqual(server.app_settings()["onboarding"], {})
        server.save_app_settings({"onboarding": {"done": True, "at": 1793776365}})
        self.assertEqual(server.app_settings()["onboarding"], {"done": True, "at": 1793776365})
        server.save_app_settings({"onboarding": {"done": "no"}})                    # refused: the record stays
        self.assertTrue(server.app_settings()["onboarding"]["done"])


class WelcomeFlowWiring(unittest.TestCase):
    def read(self, rel):
        return (ROOT / "app" / rel).read_text(encoding="utf-8")

    def test_replaces_the_first_run_dialog_and_the_setup_guide_at_start(self):
        bridge = self.read("js/app-bridge.js")
        self.assertIn("window.KCOnboarding.start(d)", bridge)
        self.assertNotIn("importDialog(d.migration.candidates, true)", bridge)
        self.assertNotIn("KCGuide.start(", bridge)
        html = self.read("dashboard.html")
        self.assertIn('<script src="js/onboarding.js"></script>', html)
        self.assertIn('href="css/onboarding.css"', html)
        self.assertLess(html.index("js/onboarding.js"), html.index("js/app-bridge.js"))

    def test_four_pages_and_a_saved_finish(self):
        js = self.read("js/onboarding.js")
        for kicker in ("Adding Frames", "Adding Decks", "Adding Content", "All set"):
            self.assertIn(kicker, js)
        self.assertIn("post('settings', {onboarding: rec})", js)
        self.assertIn("o.done || localDone()) return false;", js)

    def test_pc_only_never_the_remote(self):
        self.assertNotIn("onboarding", self.read("remote.html"))
        self.assertNotIn("onboarding", self.read("js/remote.js"))
        for path in ("/js/onboarding.js", "/css/onboarding.css", "/dashboard.html", "/api/app/info", "/api/app/settings"):
            self.assertNotIn(path, server.REMOTE_PUBLIC)
            self.assertNotIn(path, server.REMOTE_SIGNED_IN)
        self.assertIn("if (!thisPC(d) || o.done || localDone()) return false;", self.read("js/onboarding.js"))

    def test_ways_back_to_it(self):
        self.assertIn("KCOnboarding.open()", self.read("js/guide.js"))
        self.assertIn("KCOnboarding.open()", self.read("js/palette.js"))
