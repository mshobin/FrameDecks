"""FrameDecks - the ESV API key is kept in Windows Credential Manager, not in the JSON file (migration step 2:
docs/migration-plan.md). A key an older version saved in the file is moved the first time it is read; if the store
fails, the file keeps it and Scripture works as before. (Off Windows, and here, the store is a file only its owner reads.)"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import server  # noqa: E402


def in_file():
    return json.loads(server.SCRIPTURE_FILE.read_text(encoding="utf-8"))


class EsvKeyTest(unittest.TestCase):
    def setUp(self):
        for f in (server.SCRIPTURE_FILE, server.ESV_KEY.fallback):
            f.unlink(missing_ok=True)
        self.addCleanup(server.ESV_KEY.fallback.unlink, missing_ok=True)

    def test_a_key_saved_by_an_older_version_is_moved_out_of_the_file(self):
        server.SCRIPTURE_FILE.write_text(json.dumps({"provider": "esv", "key": "abc123DEF", "translation": "typed"}))
        st = server.scripture_settings()
        self.assertEqual((st["key"], st["translation"]), ("abc123DEF", "typed"))
        self.assertNotIn("key", in_file())
        self.assertEqual(in_file()["translation"], "typed")
        self.assertEqual(server.ESV_KEY.get(), "abc123DEF")
        self.assertEqual(server.scripture_settings()["key"], "abc123DEF", "read from the store from now on")
        self.assertEqual(server.scripture_info()["keyHint"], "…3DEF")

    def test_saving_settings_keeps_the_key_out_of_the_file(self):
        server.save_scripture_settings({"key": "NEWkey99", "translation": "ESV"})
        self.assertNotIn("key", in_file())
        self.assertEqual(server.scripture_settings()["key"], "NEWkey99")
        server.save_scripture_settings({"key": "", "translation": "ESV"})
        self.assertEqual(server.scripture_settings()["key"], "")
        self.assertFalse(server.ESV_KEY.fallback.exists(), "removing the key removes it from the store")

    def test_if_the_store_fails_the_file_keeps_the_key(self):
        real = server.ESV_KEY.set

        def broken(value):
            raise OSError("Credential Manager refused")
        server.ESV_KEY.set = broken
        self.addCleanup(setattr, server.ESV_KEY, "set", real)
        server.SCRIPTURE_FILE.write_text(json.dumps({"key": "oldKEY1"}))
        self.assertEqual(server.scripture_settings()["key"], "oldKEY1")
        self.assertEqual(in_file()["key"], "oldKEY1", "never removed before the store holds it")
        server.save_scripture_settings({"key": "typedKEY2", "translation": "ESV"})
        self.assertEqual(in_file()["key"], "typedKEY2")
        self.assertEqual(server.scripture_settings()["key"], "typedKEY2")

    def test_no_key_and_no_file(self):
        st = server.scripture_settings()
        self.assertEqual((st["key"], st["translation"]), ("", "ESV"))
        self.assertFalse(server.scripture_info()["hasKey"])


if __name__ == "__main__":
    unittest.main()
