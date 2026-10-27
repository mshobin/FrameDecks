import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ReadmeReleaseFacts(unittest.TestCase):
    def test_readme_does_not_claim_an_outdated_product_version(self):
        readme = (ROOT / ".github" / "README.md").read_text(encoding="utf-8")
        self.assertNotRegex(readme, re.compile(r"FrameDecks 6\.(?:9|10)\b", re.IGNORECASE))
        self.assertNotIn("v6.10.exe", readme)
        self.assertIn("releases/latest", readme)
        self.assertIn("Cloudflare Pages", readme)
        install = readme.split("## Install\n", 1)[1].split("\n## ", 1)[0]
        self.assertIn("latest installer", install)
        self.assertNotRegex(install, re.compile(r"`FrameDecks v\d+\.\d+\.\d+\.exe`"))

    def test_companion_docs_describe_the_shipped_product(self):
        readme = (ROOT / ".github" / "README.md").read_text(encoding="utf-8").lower()
        hosted = (ROOT / "hosted" / "README.md").read_text(encoding="utf-8").lower()
        for content in (readme, hosted):
            self.assertNotIn("foundation preview", content)
            self.assertNotIn("cloud data and device pairing are not implemented", content)
        self.assertIn("service plans", hosted)
        self.assertIn("remote control", hosted)


if __name__ == "__main__":
    unittest.main()
