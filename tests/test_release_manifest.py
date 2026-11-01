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

    def entry(self, v):
        return {"version": v, "url": f"https://downloads.framedecks.com/releases/{v}/FrameDecks-{v}-Setup.exe",
                "sha256": "c" * 64, "size": 10, "released": "2026-10-01"}

    def test_an_older_version_never_replaces_the_latest(self):
        # 7.1.2: pushing an old tag after a newer release must not move latest.json (or the download page) back
        index = {"latest": "9.10", "releases": [self.entry("9.10"), self.entry("9.8")]}
        out = self.tmp / "old"
        with self.assertRaises(SystemExit) as e:
            mrm.build(self.installer, out, "9.9", "2026-11-01", index, signed=False)
        self.assertIn("older than the published 9.10", str(e.exception))
        self.assertFalse((out / "releases" / "latest.json").exists(), "nothing written")

    def test_previous_is_the_next_lower_version_and_the_index_is_sorted(self):
        # published in a muddled order: 9.7, then 9.8.1, then 9.2 (index lists the most recent upload first)
        index = {"latest": "9.8.1", "releases": [self.entry("9.2"), self.entry("9.8.1"), self.entry("9.7")]}
        out = self.tmp / "sorted"
        m = mrm.build(self.installer, out, "9.9", "2026-11-01", index, signed=False)
        self.assertEqual(m["previous"]["version"], "9.8.1")
        idx = json.loads((out / "releases" / "index.json").read_text())
        self.assertEqual([e["version"] for e in idx["releases"]], ["9.9", "9.8.1", "9.7", "9.2"])
        self.assertEqual(idx["latest"], "9.9")
        self.assertGreater(mrm.version_tuple("9.10"), mrm.version_tuple("9.9"), "numbers, not text")

    def test_an_unreadable_index_stops_the_publish(self):
        bad = self.tmp / "index.json"
        for text in ("<html>502 Bad Gateway</html>", '{"latest": "9.8"}'):
            bad.write_text(text, encoding="utf-8")
            with self.assertRaises(SystemExit):
                mrm.main(["--installer", str(self.installer), "--out", str(self.tmp / "u"), "--version", "9.9", "--index", str(bad)])
        self.assertFalse((self.tmp / "u" / "releases" / "latest.json").exists())

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


class ReleaseWorkflow(unittest.TestCase):
    """7.1.2 guards in .github/workflows/build-windows.yml (the 1 November audit): a tag must match APP_VERSION and
    be pushed, version tags run one at a time, the index comes from R2 itself, and a published version is never
    replaced. infra/update-api/local-test.sh runs the read and upload steps for real against a local bucket."""

    @classmethod
    def setUpClass(cls):        # plain text: the Windows build has no YAML library
        cls.text = (ROOT / ".github" / "workflows" / "build-windows.yml").read_text(encoding="utf-8")

    def step(self, name):
        """The text of one step, from its name to the next step."""
        i = self.text.index(f"- name: {name}")
        j = self.text.find("- name: ", i + 1)
        return self.text[i:j if j > 0 else len(self.text)]

    def test_a_tag_must_match_the_version_and_be_pushed(self):
        run = self.step("The tag must match the version (tags only)")
        self.assertIn("github.ref_name", run)
        self.assertIn("steps.ver.outputs.version", run)
        self.assertIn('-ne "push"', run)

    def test_version_tags_run_one_at_a_time(self):
        self.assertIn("\nconcurrency:\n  group: ${{ startsWith(github.ref, 'refs/tags/v') && 'publish-releases'", self.text)
        self.assertIn("  cancel-in-progress: false\n", self.text)

    def test_the_index_comes_from_r2_and_published_versions_never_change(self):
        run = self.step("Read the releases already published (from R2)")
        self.assertIn("s3api head-object", run)
        self.assertIn("releases/${VERSION}/manifest.json", run)
        self.assertIn("already published", run)
        whole = (ROOT / ".github" / "workflows" / "build-windows.yml").read_text(encoding="utf-8")
        self.assertNotIn("downloads.framedecks.com/releases/index.json", whole, "never the cached public copy")
        self.assertNotIn("|| echo '{\"releases\":[]}'", whole, "errors are never turned into an empty list")


class ReleaseWorkflowR2(ReleaseWorkflow):
    """7.1.2 F1/F2: a tag run without R2 settings fails (never a green run that published nothing), and the AWS CLI
    sends integrity checksums only when required (R2 has rejected the newer default ones)."""

    def test_a_tag_without_r2_settings_fails(self):
        step = self.step("Say what is missing (R2 not set up yet)")
        self.assertIn("::error::", step)
        self.assertIn("exit 1", step)

    def test_checksums_only_when_required(self):
        self.assertIn("AWS_REQUEST_CHECKSUM_CALCULATION: when_required", self.text)
        self.assertIn("AWS_RESPONSE_CHECKSUM_VALIDATION: when_required", self.text)


if __name__ == "__main__":
    unittest.main()
