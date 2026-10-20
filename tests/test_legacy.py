"""Kingdom Connect 6.9 - data saved under the program's earlier name moves to the Kingdom Connect names, nothing lost.
Run: python -m unittest discover -s tests -p "test_*.py\""""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import legacy  # noqa: E402


def write(p, text="x"):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


class DataFolder(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="kc-legacy-"))
        self.old = self.root / legacy.OLD_NAME
        self.new = self.root / legacy.NEW_NAME

    def test_folder_and_files_move(self):
        write(self.old / "bsf-saved-content.json", '{"rev": 7}')
        write(self.old / "bsf-members-private.json", json.dumps({"members": [{"name": "Ann"}], "settings": {"groupName": "BSF"}}))
        write(self.old / "bsf-app-log.txt.old", "log")
        write(self.old / "webview" / "Default" / "Local Storage" / "leveldb" / "000003.log", "profile")
        write(self.old / "backups" / "2026-10-01" / "bsf-saved-content.json", "backup")
        new = legacy.migrate_app_data(self.root)
        self.assertEqual(new, self.new)
        self.assertFalse(self.old.exists())
        self.assertEqual((new / "kc-saved-content.json").read_text(), '{"rev": 7}')
        self.assertTrue((new / "kc-app-log.txt.old").is_file())
        self.assertTrue((new / "webview" / "Default" / "Local Storage" / "leveldb" / "000003.log").is_file())   # the browser profile too
        m = json.loads((new / "kc-members-private.json").read_text())
        self.assertEqual(m["members"][0]["name"], "Ann")
        self.assertEqual(m["settings"]["groupName"], "")            # the old default group name is cleared
        self.assertTrue((new / "backups" / "2026-10-01" / "kc-saved-content.json").is_file())    # backups follow, so they restore

    def test_never_overwrites_newer_data(self):
        write(self.old / "bsf-saved-content.json", "old")
        write(self.old / "bsf-looks.json", "looks")
        write(self.new / "kc-saved-content.json", "new")
        legacy.migrate_app_data(self.root)
        self.assertEqual((self.new / "kc-saved-content.json").read_text(), "new")
        self.assertEqual((self.new / "kc-looks.json").read_text(), "looks")
        self.assertTrue((self.old / "bsf-saved-content.json").is_file())   # left where it was, not lost

    def test_custom_group_name_kept(self):
        write(self.old / "bsf-members-private.json", json.dumps({"members": [], "settings": {"groupName": "New Life Fellowship"}}))
        legacy.migrate_app_data(self.root)
        self.assertEqual(json.loads((self.new / "kc-members-private.json").read_text())["settings"]["groupName"], "New Life Fellowship")

    def test_nothing_to_do(self):
        self.assertFalse(legacy.migrate_folder(self.root))
        write(self.new / "kc-studio.json", "{}")
        legacy.migrate_app_data(self.root)
        self.assertEqual((self.new / "kc-studio.json").read_text(), "{}")

    def test_find_either_name(self):
        write(self.root / "older" / "bsf-saved-content.json", "a")
        self.assertEqual(legacy.find(self.root / "older", "kc-saved-content.json").name, "bsf-saved-content.json")
        write(self.root / "older" / "kc-saved-content.json", "b")
        self.assertEqual(legacy.find(self.root / "older", "kc-saved-content.json").name, "kc-saved-content.json")
        self.assertIsNone(legacy.find(self.root / "older", "kc-studio.json"))

    def test_names(self):
        self.assertEqual(legacy.new_file_name("bsf-vcam-settings.json"), "kc-vcam-settings.json")
        self.assertEqual(legacy.old_file_name("kc-looks.json"), "bsf-looks.json")
        self.assertEqual(legacy.new_file_name("notes.txt"), "notes.txt")

    def test_recordings(self):
        write(self.root / legacy.OLD_NAME / "2026-10-01 Meeting.mp4", "video")
        self.assertTrue(legacy.migrate_recordings(self.root))
        self.assertTrue((self.root / "Kingdom Connect" / "2026-10-01 Meeting.mp4").is_file())


if __name__ == "__main__":
    unittest.main()
