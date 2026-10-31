"""7.0 updates from FrameDecks servers (src/updater.py): only a checked manifest is believed, only downloads from
downloads.framedecks.com whose size and SHA-256 match are kept, the install script puts the previous version back if
the install fails, and the next start says what happened. No network: a stand-in answers instead."""
import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
import updater  # noqa: E402

PAYLOAD = b"MZ fake installer " * 1000
SHA = hashlib.sha256(PAYLOAD).hexdigest()
URL = "https://downloads.framedecks.com/releases/7.1/FrameDecks-7.1-Setup.exe"


def manifest(**over):
    m = {"version": "7.1", "released": "2026-11-05", "downloadUrl": URL, "sha256": SHA, "size": len(PAYLOAD),
         "releaseNotes": "## What's New\n- Better things\n", "signed": False,
         "platforms": {"windows": {"url": URL, "sha256": SHA, "size": len(PAYLOAD)}},
         "previous": {"version": "7.0", "url": "https://downloads.framedecks.com/releases/7.0/FrameDecks-7.0-Setup.exe",
                      "sha256": SHA, "size": len(PAYLOAD)}}
    m.update(over)
    return m


class Answer(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def opener(routes):
    """routes: url -> bytes (or an exception to raise)."""
    def open_(req, timeout=0):
        got = routes.get(req.full_url)
        if isinstance(got, Exception):
            raise got
        if got is None:
            raise OSError("no route")
        return Answer(got)
    return open_


class Manifest(unittest.TestCase):
    def test_a_good_manifest_is_read(self):
        m = updater.parse_manifest(manifest())
        self.assertEqual(m["version"], "7.1")
        self.assertEqual(m["windows"]["sha256"], SHA)
        self.assertEqual(m["previous"]["version"], "7.0")

    def test_anything_untrustworthy_is_refused(self):
        bad_host = {"url": "https://evil.example/x.exe", "sha256": SHA, "size": 10}
        self.assertIsNone(updater.parse_manifest(manifest(platforms={"windows": bad_host}, downloadUrl="https://evil.example/x.exe")))
        self.assertIsNone(updater.parse_manifest(manifest(version="7.1; rm -rf")))
        self.assertIsNone(updater.parse_manifest(manifest(platforms={}, sha256="xyz")))
        huge = {"url": URL, "sha256": SHA, "size": 10 ** 10}
        self.assertIsNone(updater.parse_manifest(manifest(platforms={"windows": huge}, size=10 ** 10)))
        self.assertIsNone(updater.parse_manifest("not a dict"))
        no_prev = updater.parse_manifest(manifest(previous={"version": "7.0", "url": "http://downloads.framedecks.com/x", "sha256": SHA, "size": 5}))
        self.assertIsNone(no_prev["previous"], "a previous build over plain http is ignored")


class Updating(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.routes = {updater.API: json.dumps(manifest()).encode(), URL: PAYLOAD}
        self.u = updater.Updater(self.dir, "7.0", frozen=False, opener=opener(self.routes), platform="linux")

    def test_check_tells_about_a_newer_version_only(self):
        info = self.u.check()
        self.assertTrue(info["newer"])
        self.assertEqual(info["latest"], "7.1")
        self.assertIn("Better things", info["notes"])
        self.assertEqual(info["previous"], "7.0")
        self.assertFalse(info["canInstall"], "only the installed Windows app installs")
        older = updater.Updater(self.dir, "7.2", opener=opener(self.routes))
        self.assertFalse(older.check()["newer"])

    def test_offline_or_a_broken_answer_says_nothing(self):
        self.routes[updater.API] = OSError("offline")
        self.assertFalse(self.u.check()["newer"])
        self.routes[updater.API] = b"<html>not json</html>"
        self.assertFalse(self.u.check()["newer"])

    def test_a_download_that_matches_is_kept(self):
        self.u.check()
        path, version = self.u.download()
        self.assertEqual(version, "7.1")
        self.assertEqual(path.read_bytes(), PAYLOAD)
        self.assertEqual(self.u.info()["phase"], "ready")

    def test_a_download_that_does_not_match_is_deleted(self):
        self.u.check()
        self.routes[URL] = PAYLOAD[:-1] + b"X"
        with self.assertRaises(ValueError):
            self.u.download()
        self.assertEqual(list(self.dir.joinpath("updates").glob("*.exe")), [])
        self.assertEqual(self.u.info()["phase"], "failed")
        self.assertIn("fingerprint", self.u.info()["error"])
        self.routes[URL] = PAYLOAD + b"more"
        with self.assertRaises(ValueError):
            self.u.download()
        self.assertEqual(list(self.dir.joinpath("updates").glob("*")), [])

    def test_installing_needs_the_installed_windows_app(self):
        self.u.check()
        with self.assertRaises(ValueError):
            self.u.install()

    def test_installing_starts_the_installer_itself_and_closes_framedecks(self):
        # 7.1.1: no PowerShell script; the installer is started directly with its silent update switches
        started, quit = [], []
        u = updater.Updater(self.dir, "7.0", frozen=True, opener=opener(self.routes), platform="win32",
                            popen=lambda cmd, **kw: started.append(cmd))
        u.check()
        u.install(quit_app=lambda: quit.append(True))
        self.assertEqual(len(started), 1)
        cmd = started[0]
        self.assertTrue(cmd[0].endswith("FrameDecks-7.1-Setup.exe"))
        self.assertEqual(cmd[1:], ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/NOCANCEL", "/MERGETASKS=!vcam", "/UPDATE=1"])
        self.assertFalse(any("powershell" in str(c).lower() for c in cmd))
        self.assertEqual(json.loads((self.dir / "updates" / "pending.json").read_text())["to"], "7.1")
        self.assertEqual(u.info()["phase"], "installing")
        self.assertFalse((self.dir / "updates" / "install-update.ps1").exists())

    def test_the_next_start_says_what_happened(self):
        up = self.dir / "updates"
        up.mkdir(parents=True)
        inst = up / "FrameDecks-7.1-Setup.exe"
        inst.write_bytes(PAYLOAD)
        (up / "pending.json").write_text(json.dumps({"from": "7.0", "to": "7.1", "installer": str(inst)}))
        done = updater.Updater(self.dir, "7.1", opener=opener({}))
        self.assertTrue(done.state["result"]["ok"])
        self.assertTrue((up / "installed" / "FrameDecks-7.1-Setup.exe").exists(), "kept for putting it back later")
        self.assertFalse((up / "pending.json").exists())
        (up / "pending.json").write_text(json.dumps({"from": "7.1", "to": "7.2", "installer": "x"}))
        (up / "result.json").write_text(json.dumps({"state": "rolled-back"}))      # left by 7.0's script
        stayed = updater.Updater(self.dir, "7.1", opener=opener({}))
        self.assertFalse(stayed.state["result"]["ok"])
        self.assertIn("FrameDecks 7.1 stayed", stayed.state["result"]["message"])
        self.assertFalse((up / "result.json").exists())
        self.assertIsNone(updater.Updater(self.dir, "7.1", opener=opener({})).state["result"], "told once")


class ServerGuard(unittest.TestCase):
    def test_no_update_while_something_is_on_screen(self):
        os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
        os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
        import server
        self.assertTrue(server.on_screen({"question": {"visible": True}}))
        self.assertTrue(server.on_screen({"live": {"on": {"l1": True}}}))
        self.assertFalse(server.on_screen({"live": {"on": {}}, "verse": {"visible": False}}))
        saved = server.state
        server.state = {"question": {"visible": True}}
        try:
            with self.assertRaises(ValueError):
                server.update_action({"action": "install"})
        finally:
            server.state = saved


if __name__ == "__main__":
    unittest.main()
