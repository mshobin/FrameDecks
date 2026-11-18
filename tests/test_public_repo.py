"""Ready for a public repository (26.11.63): open source under the Apache License 2.0, no personal email in the
program or the website, and the nightly database backup never becomes a public workflow artifact."""

import hashlib
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Licence(unittest.TestCase):
    def test_license_is_the_official_apache_2_text(self):
        # the SHA-256 of https://www.apache.org/licenses/LICENSE-2.0.txt (LF line endings)
        self.assertEqual(hashlib.sha256((ROOT / "LICENSE").read_bytes()).hexdigest(),
                         "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30")

    def test_the_names_stay_ours_and_the_history_is_stated(self):
        notice = read("NOTICE")
        self.assertIn("Licensed under the Apache License, Version 2.0", notice)
        self.assertIn("The License does not grant\npermission to use them (its section 6)", notice)
        self.assertIn("versions 7.0 to 26.11.62 under\nthe FrameDecks Proprietary Software License", notice)

    def test_the_installer_shows_the_eula_and_ships_every_licence_file(self):
        iss, spec = read("packaging/installer.iss"), read("packaging/framedecks.spec")
        self.assertRegex(iss, r"(?m)^LicenseFile=\.\.\\docs\\legal\\eula\.md$")
        for f in ('"LICENSE"', '"NOTICE"', '"eula.md"', '"THIRD_PARTY_NOTICES.md"'):
            self.assertIn(f, spec)

    def test_the_program_says_open_source(self):
        about = read("app/js/about.js")
        self.assertIn("FrameDecks is open-source software under the Apache License 2.0", about)
        self.assertNotIn("is proprietary software", about)


class NoPersonalEmail(unittest.TestCase):
    def test_the_credit_line_uses_the_framedecks_address(self):
        self.assertIn("email: 'hello@framedecks.com'", read("app/js/brand.js"))
        self.assertIn('"email": "hello@framedecks.com"', read("hosted/src/lib/brand.json"))

    def test_no_personal_mailbox_in_tracked_files(self):
        out = subprocess.run(["git", "grep", "-n", "-I", "-E", r"[A-Za-z0-9._%+-]+@(gmail|hotmail|yahoo|outlook)\.com", "--",
                              ".", ":!hosted/package-lock.json"], cwd=ROOT, capture_output=True, text=True).stdout
        hits = [l for l in out.splitlines() if not re.search(r"m•••@gmail\.com|mary@gmail\.com", l)]
        self.assertEqual(hits, [])


class Backups(unittest.TestCase):
    def setUp(self):
        self.wf = read(".github/workflows/db-backup.yml")

    def test_the_artifact_is_only_for_a_private_repository_without_r2(self):
        i = self.wf.index("uses: actions/upload-artifact")
        step = self.wf[self.wf.rindex("- name:", 0, i):i]
        self.assertIn("steps.where.outputs.to == 'artifact' && steps.where.outputs.private == 'true'", step)
        self.assertEqual(self.wf.count("actions/upload-artifact"), 1)

    def test_a_public_repository_without_r2_uploads_nothing_and_fails(self):
        where = self.wf[self.wf.index("id: where"):self.wf.index("- name: Keep it in the private R2 bucket")]
        self.assertIn('gh api "repos/$GITHUB_REPOSITORY" --jq .private', where)
        self.assertRegex(where, r'else\n\s+echo "::error::The repository is public and R2 is not set up[^\n]*\n\s+exit 1')

    def test_r2_is_private_checked_and_old_artifacts_go(self):
        self.assertIn("R2_BUCKET: framedecks-backups", self.wf)
        self.assertIn(".r2.cloudflarestorage.com", self.wf)
        self.assertIn("head-object", self.wf, "the size in R2 is checked")
        self.assertIn('startswith("framedecks-backup-")', self.wf)
        self.assertIn("actions: write", self.wf)


if __name__ == "__main__":
    unittest.main()
