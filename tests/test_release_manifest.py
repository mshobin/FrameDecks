"""7.0 release pipeline (tools/make_release_manifest.py): the folder uploaded to R2, the manifest the updater and the
download page read, the previous release kept for putting it back, and release notes that never name repository files."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "src"))
import make_release_manifest as mrm  # noqa: E402
import updater  # noqa: E402

NOTES = "## FrameDecks v9.9\n\nIntro for GitHub.\n\n## What's New\n- A thing\n\n## Fixes\n- None in this release.\n"


class ReleaseManifest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / "docs" / "releases").mkdir(parents=True)
        (self.tmp / "docs" / "releases" / "v9.9.md").write_text(NOTES, encoding="utf-8")
        self.real_root, mrm.ROOT = mrm.ROOT, self.tmp
        self.addCleanup(setattr, mrm, "ROOT", self.real_root)
        self.installer = self.tmp / "FrameDecks v9.9.exe"
        self.installer.write_bytes(b"installer bytes" * 100)

    def test_the_release_folder_and_manifest(self):
        index = {"latest": "9.8", "releases": [{"version": "9.8", "url": "https://downloads.framedecks.com/releases/9.8/FrameDecks-9.8-Setup.exe",
                                                 "sha256": "b" * 64, "size": 10, "released": "2026-10-01"}]}
        out = self.tmp / "publish"
        m = mrm.build(self.installer, out, "9.9", "2026-11-01", index, signed=False)
        name = "FrameDecks-9.9-Setup.exe"
        for rel in (f"releases/9.9/{name}", f"releases/9.9/{name}.sha256", "releases/9.9/manifest.json",
                    "releases/latest.json", "releases/index.json", "latest/FrameDecks-Setup.exe"):
            self.assertTrue((out / rel).exists(), rel)
        self.assertEqual(m["sha256"], hashlib.sha256(self.installer.read_bytes()).hexdigest())
        self.assertEqual(m["downloadUrl"], f"https://downloads.framedecks.com/releases/9.9/{name}")
        self.assertTrue(m["releaseNotes"].startswith("## What's New"), "no title or GitHub intro")
        self.assertEqual(m["previous"]["version"], "9.8")
        idx = json.loads((out / "releases" / "index.json").read_text())
        self.assertEqual([e["version"] for e in idx["releases"]], ["9.9", "9.8"])
        # what the program's updater reads is exactly this manifest
        parsed = updater.parse_manifest(json.loads((out / "releases" / "latest.json").read_text()))
        self.assertEqual(parsed["version"], "9.9")
        self.assertEqual(parsed["previous"]["version"], "9.8")

    def test_publishing_the_same_version_again_does_not_list_it_twice(self):
        out = self.tmp / "p"
        first = mrm.build(self.installer, out, "9.9", "2026-11-01", None, signed=False)
        idx = json.loads((out / "releases" / "index.json").read_text())
        again = mrm.build(self.installer, out, "9.9", "2026-11-01", idx, signed=True)
        self.assertIsNone(first["previous"])
        self.assertIsNone(again["previous"])
        self.assertTrue(again["signed"])

    def test_release_notes_naming_repository_files_are_refused(self):
        (self.tmp / "docs" / "releases" / "v9.9.md").write_text(
            NOTES + "## Known Issues\n- Owners: run hosted/supabase/migrations/0011_accounts_legal.sql first.\n", encoding="utf-8")
        with self.assertRaises(SystemExit):
            mrm.build(self.installer, self.tmp / "x", "9.9", "2026-11-01", None, signed=False)

    def test_this_versions_notes_are_fit_to_publish(self):
        mrm.ROOT = self.real_root
        version = mrm.app_version()
        notes = mrm.user_notes((self.real_root / "docs" / "releases" / f"v{version}.md").read_text(encoding="utf-8"))
        self.assertEqual(mrm.internal_lines(notes), [], f"docs/releases/v{version}.md")


if __name__ == "__main__":
    unittest.main()
