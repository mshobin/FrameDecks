"""The release notes the installer build publishes for a version tag (tools/make_release_notes.py)."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ReleaseNotes(unittest.TestCase):
    def test_current_version_builds_with_the_about_header(self):
        # The tag build runs exactly this; an empty motto in app/js/brand.js once made it crash before publishing.
        with tempfile.TemporaryDirectory() as tmp:
            notes = Path(tmp) / "release-notes.md"
            subprocess.run([sys.executable, str(ROOT / "tools/make_release_notes.py"), "--repo", "owner/repo", "--ref", "abc123",
                            "--out", str(notes)], capture_output=True, check=True)
            out = notes.read_text(encoding="utf-8")
        self.assertIn("framedecks-about-header.webp?raw=true", out)
        self.assertIn("Present • Equip • Inspire", out)
        for section in ("## What's New", "## Enhancements", "## Fixes", "## Performance Improvements", "## Known Issues"):
            self.assertIn(section, out)
        self.assertNotIn("Kingdom", out)


if __name__ == "__main__":
    unittest.main()
