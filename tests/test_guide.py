"""6.14 Setup guide: its progress is kept in kc-app-settings.json ("guide"), and only valid progress is saved."""
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402


class GuideSettings(unittest.TestCase):
    def test_the_server_knows_the_same_steps_and_kinds_as_the_program(self):
        js = (ROOT / "app/js/guide-steps.js").read_text(encoding="utf-8")
        steps = re.findall(r"\{id: '([a-z-]+)', title:", js)
        kinds = re.findall(r"\{id: '([a-z-]+)', name:", js)
        self.assertEqual(tuple(steps), server.GUIDE_STEPS)
        self.assertEqual(tuple(kinds), server.GUIDE_KINDS)

    def test_valid_progress_is_saved_and_anything_else_is_refused(self):
        good = {"seen": True, "closed": False, "finished": False, "kind": "youth", "done": ["welcome", "frame"]}
        self.assertEqual(server.save_app_settings({"guide": good})["guide"], good)
        self.assertEqual(server.app_settings()["guide"], good)
        for bad in ({"done": ["hack"]}, {"kind": "party"}, {"seen": "yes"}, {"extra": 1}, ["welcome"],
                    {"done": ["welcome"] * 8}):
            self.assertEqual(server.save_app_settings({"guide": bad})["guide"], good, bad)

    def test_progress_from_7_x_keeps_its_ticks_without_the_retired_practice_step(self):
        import json
        server.APP_SETTINGS_FILE.write_text(json.dumps({"guide": {"seen": True, "done": ["welcome", "rehearse", "frame"]}}), encoding="utf-8")
        self.assertEqual(server.app_settings()["guide"], {"seen": True, "done": ["welcome", "frame"]})
        self.assertNotIn("rehearse", server.GUIDE_STEPS)

    def test_a_new_pc_starts_with_no_progress(self):
        self.assertEqual(server.APP_SETTINGS_DEFAULTS["guide"], {})


if __name__ == "__main__":
    unittest.main()
