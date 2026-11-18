"""26.11.64: fixes from the production release review (Song Library safety, wider backups, co-leader limits on the
server, the updater's signer names, attendance kept 12 months, licence texts in the build, corrected wording)."""

import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import care  # noqa: E402
import songbook  # noqa: E402
import updater  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


SONG = {"title": "Amazing Grace", "sections": [{"label": "Verse 1", "text": "Amazing grace"}]}


class SongLibrary(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.backups = os.path.join(self.dir, "backups")
        self.path = os.path.join(self.dir, "kc-songs.json")
        self.book = songbook.Songbook(self.path, self.backups)
        for i in range(3):
            self.book.save(dict(SONG, title="Song %d" % i))

    def test_a_busy_file_is_never_written_over(self):
        before = Path(self.path).read_text(encoding="utf-8")
        real_open = open

        def busy(path, *a, **k):
            if str(path) == self.path and (not a or "r" in a[0]):
                raise PermissionError("busy")
            return real_open(path, *a, **k)
        with mock.patch("builtins.open", busy):
            with self.assertRaises(ValueError) as e:
                self.book.save(dict(SONG, title="New"))
        self.assertIn("Nothing was changed", str(e.exception))
        self.assertEqual(Path(self.path).read_text(encoding="utf-8"), before, "the three songs are still there")
        self.assertEqual(len(self.book.list()), 3)

    def test_a_damaged_file_is_kept_aside_and_the_newest_backup_is_used(self):
        good = os.path.join(self.backups, "2026-11-17")
        os.makedirs(good)
        with open(os.path.join(good, "kc-songs.json"), "w", encoding="utf-8") as f:
            json.dump({"v": 1, "songs": [dict(SONG, id="s1", title="From the backup")]}, f)
        with open(self.path, "w", encoding="utf-8") as f:
            f.write("{ damaged")
        with mock.patch("sys.stdout"):
            songs = self.book.list()
        self.assertEqual([s["title"] for s in songs], ["From the backup"])
        self.assertTrue(any(n.startswith("kc-songs.json.damaged-") for n in os.listdir(self.dir)), "the damaged file is kept")

    def test_a_missing_file_is_an_empty_library(self):
        self.assertEqual(songbook.Songbook(os.path.join(self.dir, "none.json")).list(), [])


class Backups(unittest.TestCase):
    def setUp(self):
        os.environ["KC_DATA_DIR"] = tempfile.mkdtemp()
        import server
        self.s = server

    def test_every_data_file_is_backed_up(self):
        names = {p.name for p in self.s.backup_files()}
        for n in ("kc-saved-content.json", "kc-members-private.json", "kc-songs.json", "kc-care.json",
                  "kc-prayer-journey.json", "kc-app-settings.json", "kc-looks.json", "kc-studio.json"):
            self.assertIn(n, names)

    def test_backups_made_by_hand_never_push_out_the_daily_ones(self):
        s = self.s
        s.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        for i in range(12):
            d = s.BACKUP_DIR / ("2026-10-%02d" % (i + 1))
            d.mkdir()
            os.utime(d, (1_700_000_000 + i, 1_700_000_000 + i))
        s.STATE_FILE.write_text("{}", encoding="utf-8")
        for i in range(12):
            s.backup_now("before-update")
        dirs = [d.name for d in s.BACKUP_DIR.iterdir()]
        daily = [d for d in dirs if len(d) == 10]
        self.assertEqual(len(daily), 10, "the newest 10 daily copies stay")
        self.assertEqual(len(dirs) - len(daily), 10, "and the newest 10 made by hand")


class CoLeader(unittest.TestCase):
    def setUp(self):
        os.environ["KC_DATA_DIR"] = tempfile.mkdtemp()
        import server
        self.s = server

    def test_the_server_refuses_the_leaders_own_things(self):
        self.assertEqual(self.s.CO_DENIED, {"/api/remote/meeting-key", "/api/remote/notes", "/api/remote/voice-commands"})
        src = read("src/server.py")
        allowed = src[src.index("    def allowed(self, path):"):src.index("    def remote_login")]
        self.assertIn('if path in CO_DENIED and self.session_role() == "co":', allowed)
        self.assertIn('remote_state_merge(state, data, switch=self.session_role() != "co")', src)

    def test_a_co_leader_cannot_switch_the_meeting(self):
        cur = {"live": {"meeting": "m1"}, "meeting": {"meetings": [{"id": "m1"}, {"id": "m2"}]}, "scenes": []}
        with mock.patch.object(self.s, "_switch_meeting") as sw:
            self.s.remote_state_merge(cur, {"live": {"meeting": "m2"}}, switch=False)
            sw.assert_not_called()
            self.s.remote_state_merge(cur, {"live": {"meeting": "m2"}})
            sw.assert_called_once()

    def test_co_leader_sign_ins_end_with_the_program(self):
        now = time.time()
        self.s.SESSIONS_FILE.write_text(json.dumps({"co-aaaaaaaaaaaaaaaaaaaaaa": {"exp": now + 3600, "used": now, "role": "co"},
                                                    "leader-aaaaaaaaaaaaaaaaaa": {"exp": now + 3600, "used": now}}), encoding="utf-8")
        loaded = self.s.load_sessions()
        self.assertEqual(list(loaded), ["leader-aaaaaaaaaaaaaaaaaa"])

    def test_the_phone_hides_notes_for_a_co_leader(self):
        self.assertIn("body.co #tab-notes", read("app/css/remote-chat.css"))
        self.assertIn("if (co && tab === 'notes') openTab('control');", read("app/js/remote.js"))


class Updates(unittest.TestCase):
    def test_signpath_signed_updates_are_accepted_by_exact_name(self):
        self.assertEqual(updater.PUBLISHERS, ("Shobin Mathews", "SignPath Foundation"))
        self.assertIn("str(signer).strip() in PUBLISHERS", read("src/updater.py"))


class Attendance(unittest.TestCase):
    def test_meetings_older_than_12_months_go_by_themselves(self):
        now = time.mktime((2026, 11, 18, 12, 0, 0, 0, 0, -1))
        c = care.Care(os.path.join(tempfile.mkdtemp(), "kc-care.json"), clock=lambda: now)
        c.record(["Ann"], 1, "Study", "2025-10-01")
        c.record(["Ben"], 1, "Study", "2026-11-18")
        self.assertEqual([m["date"] for m in c.meetings], ["2026-11-18"])


class LicencesAndWording(unittest.TestCase):
    def test_the_build_collects_the_licence_texts(self):
        out = Path(tempfile.mkdtemp()) / "THIRD_PARTY_LICENSES.txt"
        r = subprocess.run([sys.executable, str(ROOT / "tools" / "write_third_party_licenses.py"), str(out)],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        text = out.read_text(encoding="utf-8")
        self.assertIn("FrameDecks itself is licensed under the Apache License 2.0", text)
        self.assertIn("\n--- ", text, "licence files are copied in full")
        self.assertIn("licence_data", read("packaging/framedecks.spec"))
        wf = read(".github/workflows/build-windows.yml")
        self.assertLess(wf.index("write_third_party_licenses.py"), wf.index("pyinstaller --noconfirm"))
        self.assertIn('throw "THIRD_PARTY_LICENSES.txt is missing"', wf)

    def test_notices_say_what_is_true(self):
        notice, tpn = read("NOTICE"), read("docs/legal/THIRD_PARTY_NOTICES.md")
        self.assertIn("THIRD_PARTY_LICENSES.txt", notice)
        self.assertNotIn("pystray (LGPL-3.0) and the\nFFmpeg libraries inside OpenCV (LGPL-2.1) are shipped as separate", notice)
        for name in ("bottle", "pythonnet", "WebView2", "vcruntime140.dll", "OpenBLAS"):
            self.assertIn(name, tpn)
        self.assertNotIn("All rights reserved", read("packaging/installer.iss"))

    def test_no_claim_that_pictures_never_leave_the_pc(self):
        for rel in ("hosted/src/components/landing.tsx", "hosted/src/components/help-topics.tsx", "docs/guide/faq.md",
                    "docs/guide/getting-started.md", ".github/CONTRIBUTING.md"):
            text = read(rel)
            self.assertNotIn("never leave your PC", text, rel)
            self.assertNotIn("they are never put in the cloud", text, rel)
            self.assertNotIn("no accounts and no cloud", text, rel)
            self.assertNotIn("The only online feature today", text, rel)

    def test_phones_and_the_privacy_policy_say_where_names_go(self):
        self.assertNotIn("Only the leader sees it", read("hosted/src/components/follow-together.tsx"))
        self.assertIn("quiz leaderboard", read("hosted/src/components/follow-together.tsx"))
        privacy = read("docs/legal/privacy.md")
        self.assertNotIn("the only identifier is the random number", privacy)
        self.assertEqual(privacy.count("## Who processes it for us"), 1)
        self.assertIn("meetings older\n  than 12 months are removed by themselves", privacy)
        self.assertIn("| **GitHub** |", privacy)

    def test_no_local_wrangler_state_in_the_repository(self):
        tracked = subprocess.run(["git", "ls-files", "infra/site/.wrangler"], cwd=ROOT, capture_output=True, text=True).stdout
        self.assertEqual(tracked.strip(), "")
        self.assertIn(".wrangler/", read(".gitignore"))


if __name__ == "__main__":
    unittest.main()
