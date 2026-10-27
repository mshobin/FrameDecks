"""6.11: the website's "Open FrameDecks on this PC" link (docs/architecture/meeting-form.md, section 4)."""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class OpenLinkTest(unittest.TestCase):
    def test_installer_registers_the_link_for_this_user_only(self):
        iss = (ROOT / "packaging" / "installer.iss").read_text(encoding="utf-8")
        lines = [l for l in iss.splitlines() if "Software\\Classes\\framedecks" in l]
        self.assertTrue(lines, "framedecks: is not registered")
        self.assertTrue(all(l.startswith("Root: HKCU;") for l in lines), "the link must be registered for this user only")
        self.assertIn('ValueName: "URL Protocol"', iss)
        self.assertIn("Flags: uninsdeletekey", iss)
        command = [l for l in lines if "shell\\open\\command" in l][0]
        self.assertIn('{app}\\FRAMEDECKS.exe', command)

    def test_the_program_never_reads_the_link(self):
        src = (ROOT / "desktop_app.py").read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"sys\.argv\[", src), "desktop_app.py must not act on its arguments")


if __name__ == "__main__":
    unittest.main()
