"""26.11: versions are YY.MM (the year and the month of the release: 26.11), with .1, .2 for further releases in the
same month (26.11.1). The updater, the release manifest and the website all compare them as numbers."""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tools"))

import updater  # noqa: E402
import make_release_manifest as mrm  # noqa: E402

YYMM = re.compile(r"^\d{2}\.(0[1-9]|1[0-2])(\.[1-9]\d*)?$")


def app_version():
    return re.search(r'APP_VERSION = "([^"]+)"', (ROOT / "src/server.py").read_text(encoding="utf-8")).group(1)


class Scheme(unittest.TestCase):
    def test_the_version_is_yy_mm(self):
        v = app_version()
        self.assertRegex(v, YYMM)
        self.assertEqual(json.loads((ROOT / "hosted/src/lib/brand.json").read_text(encoding="utf-8"))["version"], v)
        self.assertTrue(updater.VERSION_RE.match(v))

    def test_every_pc_on_9x_sees_it_as_newer(self):
        for old in ("9.13.0", "9.12.1", "9.0", "8.6.0"):
            self.assertGreater(updater.version_tuple(app_version()), updater.version_tuple(old), old)

    def test_compared_as_numbers_in_both_places(self):
        for vt in (updater.version_tuple, mrm.version_tuple):
            self.assertEqual(vt("26.11"), vt("26.11.0"))
            self.assertLess(vt("26.11"), vt("26.11.1"))
            self.assertLess(vt("26.09"), vt("26.10"))
            self.assertLess(vt("26.12.3"), vt("27.01"))
            self.assertEqual(vt("27.01"), vt("27.1"))

    def test_the_first_yy_mm_release_starts_a_fresh_history(self):
        import tempfile
        tmp = Path(tempfile.mkdtemp())
        inst = tmp / "FrameDecks v26.11.exe"
        inst.write_bytes(b"MZ" + b"0" * 4096)
        old = {"latest": "9.13.0", "releases": [{"version": "9.13.0", "released": "2026-11-05", "size": 9,
               "url": "https://downloads.framedecks.com/releases/9.13.0/FrameDecks-9.13.0-Setup.exe", "sha256": "a" * 64}]}
        notes = ROOT / "docs/releases/v26.11.md"
        if not notes.exists():
            self.skipTest("the 26.11 release notes are not written yet")
        m = mrm.build(inst, tmp / "out", "26.11", "2026-11-06", old, signed=False)
        self.assertIsNone(m["previous"])                       # nothing points at a removed 9.x installer
        idx = json.loads((tmp / "out/releases/index.json").read_text())
        self.assertEqual([e["version"] for e in idx["releases"]], ["26.11"])
        self.assertTrue(mrm.is_yymm("26.11") and not mrm.is_yymm("9.13.0"))

    def test_the_tag_check_compares_the_exact_text(self):
        wf = (ROOT / ".github/workflows/build-windows.yml").read_text(encoding="utf-8")
        self.assertIn('if ($env:TAG -ne $env:WANT) { throw "Tag $($env:TAG) does not match APP_VERSION', wf)


class CleanUp(unittest.TestCase):
    """.github/workflows/clean-up-history.yml: run once by hand after 26.11 is out."""
    def setUp(self):
        self.wf = (ROOT / ".github/workflows/clean-up-history.yml").read_text(encoding="utf-8")

    def test_only_by_hand_with_a_typed_confirmation_and_only_after_the_release(self):
        self.assertIn("workflow_dispatch:", self.wf)
        self.assertNotIn("push:", self.wf)
        self.assertNotIn("schedule:", self.wf)
        self.assertIn('if [ "$CONFIRM" != "DELETE" ]', self.wf)
        self.assertIn("is not published with its installer yet. Nothing was removed.", self.wf)
        self.assertIn('if [ "$latest" != "$version" ]', self.wf)
        self.assertIn("if: github.ref == 'refs/heads/main'", self.wf)
        self.assertIn("CONFIRM: ${{ inputs.confirm }}", self.wf)        # the typed text reaches the script as data

    def test_it_keeps_the_current_release_and_the_latest_run_of_each_workflow(self):
        self.assertIn('[ "$tag" = "$KEEP" ] && continue', self.wf)
        self.assertIn('[ "$ref" = "refs/tags/$KEEP" ] && continue', self.wf)
        self.assertIn('[ "$id" = "$GITHUB_RUN_ID" ] && continue', self.wf)
        self.assertIn('if [ "$major" -lt 20 ]; then', self.wf)           # only 4.9 to 9.13 installers go


if __name__ == "__main__":
    unittest.main()
