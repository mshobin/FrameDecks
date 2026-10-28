"""The licence sits at the top level for GitHub (licence detection, the website's footer link) and in docs/legal/ for the
installer (packaging/framedecks.spec). The two copies must stay the same file."""
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class LicenceCopy(unittest.TestCase):
    def test_top_level_licence_matches_legal(self):
        self.assertEqual((ROOT / "LICENSE").read_bytes(), (ROOT / "docs" / "legal" / "LICENSE").read_bytes())


if __name__ == "__main__":
    unittest.main()
