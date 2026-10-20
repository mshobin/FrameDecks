"""Kingdom Connect 6.8 - desktop settings, shortcut and restart tests (python -m unittest discover -s tests -p "test_*.py").
The Windows window features themselves (ribbon, glass, tray, global shortcut) need a real Windows desktop; these tests
cover the logic around them on any system."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))

import desktop_win as dw  # noqa: E402
import server  # noqa: E402


class Shortcuts(unittest.TestCase):
    def test_parse(self):
        self.assertEqual(dw.parse_hotkey("Alt+Space"), (0x1, 0x20))
        self.assertEqual(dw.parse_hotkey("ctrl+alt+space"), (0x3, 0x20))
        self.assertEqual(dw.parse_hotkey("Win+Shift+K"), (0xC, ord("K")))
        self.assertEqual(dw.parse_hotkey("Ctrl+F12"), (0x2, 0x7B))

    def test_refuses_keys_that_would_break_typing(self):
        for bad in ("", "Space", "K", "Shift+K", "Ctrl+", "Ctrl+Nope", "Hyper+K"):
            self.assertIsNone(dw.parse_hotkey(bad), bad)

    def test_format(self):
        self.assertEqual(dw.format_hotkey("alt+space"), "Alt+Space")
        self.assertEqual(dw.format_hotkey("shift+ctrl+p"), "Ctrl+Shift+P")
        self.assertEqual(dw.format_hotkey("nonsense"), "")

    def test_windows_calls_are_safe_elsewhere(self):
        if dw.IS_WIN:
            self.skipTest("Windows: covered by the installed app")
        self.assertFalse(dw.Chrome(0).ok)
        self.assertFalse(dw.glass(0))
        self.assertFalse(dw.fade(0, 0.5))
        self.assertFalse(dw.hide_from_capture(0))
        dw.center_on_cursor(0); dw.bring_to_front(0); dw.round_corners(0); dw.drag(0)
        self.assertEqual(dw.Hotkeys(lambda n: None).set("spotlight", "Alt+Space"), "Only on Windows")


class Settings(unittest.TestCase):
    def setUp(self):
        server.APP_SETTINGS_FILE.unlink(missing_ok=True)

    def test_defaults(self):
        s = server.app_settings()
        self.assertTrue(s["customChrome"])
        self.assertEqual(s["minimizeTo"], "ask")
        self.assertEqual(s["spotlightKey"], "Alt+Space")
        self.assertEqual(s["overlayMode"], "meeting")
        self.assertTrue(s["overlayOnTop"])
        self.assertFalse(s["overlayFade"])

    def test_valid_values_are_kept_and_normalised(self):
        s = server.save_app_settings({"minimizeTo": "tray", "overlayMode": "ghost", "spotlightKey": "ctrl+alt+space", "overlayFrost": False})
        self.assertEqual((s["minimizeTo"], s["overlayMode"], s["spotlightKey"], s["overlayFrost"]), ("tray", "ghost", "Ctrl+Alt+Space", False))
        self.assertEqual(server.app_settings()["spotlightKey"], "Ctrl+Alt+Space")
        self.assertEqual(server.save_app_settings({"spotlightKey": ""})["spotlightKey"], "")      # off

    def test_invalid_values_are_ignored(self):
        s = server.save_app_settings({"minimizeTo": "desktop", "overlayMode": 3, "spotlightKey": "Space", "customChrome": "yes", "unknown": 1})
        self.assertEqual((s["minimizeTo"], s["overlayMode"], s["spotlightKey"], s["customChrome"]), ("ask", "meeting", "Alt+Space", True))
        self.assertNotIn("unknown", s)

    def test_older_settings_files_still_load(self):
        server.APP_SETTINGS_FILE.write_text(json.dumps({"lowGpu": False, "remoteAutostart": True}), encoding="utf-8")
        s = server.app_settings()
        self.assertFalse(s["lowGpu"]); self.assertTrue(s["remoteAutostart"]); self.assertEqual(s["minimizeTo"], "ask")

    def test_settings_change_reaches_the_desktop(self):
        seen = []
        server.DESKTOP["settings_changed"] = seen.append
        try:
            server.save_app_settings({"spotlightKey": "Ctrl+Space"})
        finally:
            server.DESKTOP.pop("settings_changed", None)
        self.assertEqual(seen[-1]["spotlightKey"], "Ctrl+Space")


class Restart(unittest.TestCase):
    """6.10: after Quit the program must free its port, and a copy that holds the port without answering is told
    apart from another program (it used to make the next start show "127.0.0.1 refused to connect")."""

    def test_quit_frees_the_port(self):
        import socket
        srv = server.MainServer(("127.0.0.1", 0), server.Handler)
        port = srv.server_address[1]
        import threading
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        srv.shutdown()
        srv.server_close()
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", port))                    # free at once for the next start
        finally:
            s.close()

    def test_main_server_never_shares_its_port_on_windows(self):
        self.assertEqual(server.MainServer.allow_reuse_address, os.name != "nt")

    def test_a_copy_that_does_not_answer_is_stuck(self):
        import socket
        import desktop_app
        silent = socket.socket()
        silent.bind(("127.0.0.1", 0))
        silent.listen(5)                                   # takes connections, never answers (a copy left behind)
        try:
            self.assertEqual(desktop_app.running_copy(silent.getsockname()[1]), "stuck")
        finally:
            silent.close()
        free = socket.socket()
        free.bind(("127.0.0.1", 0))
        port = free.getsockname()[1]
        free.close()                                       # nothing listening there
        self.assertIsNone(desktop_app.running_copy(port))

    def test_ending_stuck_copies_only_in_the_installed_app(self):
        import desktop_app
        if os.name != "nt" or not getattr(sys, "frozen", False):
            self.assertFalse(desktop_app.end_stuck_copies())


if __name__ == "__main__":
    unittest.main()
