"""KingdomConnect camera: which build the app uses, and (on the Windows build machine) the Windows 11 camera end to end.
python -m unittest discover -s tests -p "test_*.py"

The end-to-end test needs Windows 11 (or Windows Server 2025), administrator rights and KC_CAMERA_E2E=1, which the
GitHub build has: it installs the camera, sends it a picture of one colour, reads the camera back as Zoom or Teams
would (OpenCV, Media Foundation), checks the colour, and removes the camera again.
"""
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from vcam import sink  # noqa: E402


class Choice(unittest.TestCase):
    def setUp(self):
        self.a, self.b = Path(tempfile.mkdtemp()), Path(tempfile.mkdtemp())
        for base in (self.a, self.b):
            (base / "vcam" / "bin").mkdir(parents=True)

    def touch(self, path):
        path.write_bytes(b"")
        return path

    def test_windows_10_uses_softcam(self):
        dll = self.touch(sink.dll_path(self.b))
        self.touch(sink.mf_dll_path(self.a))
        with mock.patch.object(sink, "windows_build", return_value=19045), mock.patch.object(sink, "mf_registered", return_value=True):
            self.assertEqual(sink.choose([self.a, self.b]), ("softcam", dll))

    def test_windows_11_uses_its_camera_once_installed(self):
        self.touch(sink.dll_path(self.a))
        mf = self.touch(sink.mf_dll_path(self.b))
        with mock.patch.object(sink, "windows_build", return_value=22631), mock.patch.object(sink, "mf_registered", return_value=True):
            self.assertEqual(sink.choose([self.a, self.b]), ("mf", mf))

    def test_windows_11_before_installing_keeps_softcam(self):
        dll = self.touch(sink.dll_path(self.a))
        self.touch(sink.mf_dll_path(self.a))
        with mock.patch.object(sink, "windows_build", return_value=26100), mock.patch.object(sink, "mf_registered", return_value=False):
            self.assertEqual(sink.choose([self.a, self.b]), ("softcam", dll))

    def test_windows_11_camera_file_missing_falls_back(self):
        dll = self.touch(sink.dll_path(self.a))
        with mock.patch.object(sink, "windows_build", return_value=22631), mock.patch.object(sink, "mf_registered", return_value=True):
            self.assertEqual(sink.choose([self.a, self.b]), ("softcam", dll))

    def test_nothing_built(self):
        with mock.patch.object(sink, "windows_build", return_value=22631), mock.patch.object(sink, "mf_registered", return_value=False):
            self.assertEqual(sink.choose([self.a]), ("softcam", None))


class Ids(unittest.TestCase):
    def test_build_script_and_app_agree(self):
        text = (ROOT / "packaging" / "build_mfcam.py").read_text()
        self.assertEqual("{" + re.search(r'CLSID = "([0-9A-F-]+)"', text).group(1) + "}", sink.MF_CLSID)
        self.assertNotEqual(sink.MF_CLSID, sink.VCAM_CLSID)

    def test_guid_initialiser(self):
        sys.path.insert(0, str(ROOT / "packaging"))
        import build_mfcam
        self.assertEqual(build_mfcam.guid_init("06BACA0B-14C0-4E9B-8161-ED7D11F73518"),
                         "{ 0x06baca0b,0x14c0,0x4e9b,{0x81,0x61,0xed,0x7d,0x11,0xf7,0x35,0x18} }")

    def test_errors_in_words(self):
        self.assertIn("not installed", sink.mf_error(0x80040154))
        self.assertIn("0x8000FFFF", sink.mf_error(0x8000FFFF))


def _bin():
    return ROOT / "vcam" / "bin"


@unittest.skipUnless(os.name == "nt" and os.environ.get("KC_CAMERA_E2E") == "1", "the Windows build machine only (KC_CAMERA_E2E=1)")
class Windows11Camera(unittest.TestCase):
    COLOUR = (40, 160, 220)   # BGR

    def run_cmd(self, name):
        r = subprocess.run(["cmd", "/c", str(_bin() / name)], capture_output=True, text=True, timeout=180)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_end_to_end(self):
        import cv2
        import numpy as np
        dll = sink.mf_dll_path(ROOT)
        if not dll.exists():
            self.fail(f"{dll.name} was not built")
        if not sink.windows_11():
            self.skipTest(f"Windows build {sink.windows_build()} has no virtual cameras")
        self.run_cmd("register-kingdomconnect-camera.cmd")
        try:
            self.assertTrue(sink.mf_registered(), "the install script did not register the camera")
            self.assertEqual(sink.choose([ROOT])[0], "mf")
            try:
                cam = sink.MFSink(dll, 1280, 720)
            except RuntimeError as e:
                self.skipTest(f"this Windows cannot host virtual cameras here: {e}")
            frame = np.empty((720, 1280, 3), np.uint8)
            frame[:] = self.COLOUR
            stop = threading.Event()

            def feed():
                while not stop.is_set():
                    cam.send(frame)
                    time.sleep(1 / 30)
            t = threading.Thread(target=feed, daemon=True)
            t.start()
            try:
                seen, opened, connected = None, 0, False
                for index in range(8):
                    cap = cv2.VideoCapture(index, cv2.CAP_MSMF)
                    if not cap.isOpened():
                        continue
                    opened += 1
                    try:
                        for _ in range(60):
                            ok, img = cap.read()
                            connected = connected or cam.connected()
                            if ok and img is not None:
                                mean = img.reshape(-1, 3).mean(axis=0)
                                if all(abs(float(m) - c) < 12 for m, c in zip(mean, self.COLOUR)):
                                    seen = (index, [round(float(m)) for m in mean])
                                    break
                    finally:
                        cap.release()
                    if seen:
                        break
                self.assertTrue(seen, f"no camera showed the picture sent to KingdomConnect ({opened} cameras opened)")
                self.assertTrue(connected, "the app was not told an app is receiving the camera")
            finally:
                stop.set()
                t.join(2)
                cam.close()
        finally:
            self.run_cmd("unregister-kingdomconnect-camera.cmd")
        self.assertFalse(sink.mf_registered(), "the remove script left the camera registered")


if __name__ == "__main__":
    unittest.main()
