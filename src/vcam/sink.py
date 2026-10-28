"""Where finished frames go.

SoftcamSink sends frames to the "FrameRelay" virtual camera (our build of the MIT-licensed softcam
library, renamed and with its own ID). FakeSink is used for tests on computers without it.
"""
import ctypes
import os
import sys
import threading
from pathlib import Path

# Must match the ID compiled into framedecks_vcam64.dll / framedecks_vcam32.dll (see packaging/build_vcam.py)
VCAM_CLSID = "{6F2B8C3E-4D7A-4B9E-9C11-B5CC0A1E7D21}"
VCAM_NAME = "FrameRelay"


def dll_path(base):
    return Path(base) / "vcam" / "bin" / ("framedecks_vcam64.dll" if sys.maxsize > 2**32 else "framedecks_vcam32.dll")


def is_registered():
    """True if Windows knows about the FrameRelay camera (read-only registry check)."""
    if os.name != "nt":
        return False
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, rf"CLSID\{VCAM_CLSID}\InprocServer32"):
            return True
    except OSError:
        return False


class SoftcamSink:
    def __init__(self, dll, width, height):
        self.lib = ctypes.CDLL(str(dll))
        self.lib.scCreateCamera.restype = ctypes.c_void_p
        self.lib.scCreateCamera.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_float]
        self.lib.scDeleteCamera.argtypes = [ctypes.c_void_p]
        self.lib.scSendFrame.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
        self.lib.scIsConnected.argtypes = [ctypes.c_void_p]
        self.lib.scIsConnected.restype = ctypes.c_bool
        self.width, self.height = width, height
        # framerate 0 = send each frame immediately (the webcam sets the pace)
        self.cam = self.lib.scCreateCamera(width, height, ctypes.c_float(0.0))
        if not self.cam:
            raise RuntimeError("FrameRelay is already in use by another program.")

    def connected(self):
        return bool(self.cam) and bool(self.lib.scIsConnected(self.cam))

    def send(self, frame):
        # frame: numpy uint8 array (height, width, 3), BGR, top row first, contiguous
        self.lib.scSendFrame(self.cam, frame.ctypes.data)

    def close(self):
        if self.cam:
            self.lib.scDeleteCamera(self.cam)
            self.cam = None


class FakeSink:
    """Stand-in for tests: pretend an app is connected, and keep the last frame."""
    def __init__(self, width, height, connected=True):
        self.width, self.height = width, height
        self._connected = connected
        self.frames = 0
        self.last = None
        self.lock = threading.Lock()

    def connected(self):
        return self._connected

    def send(self, frame):
        assert frame.shape == (self.height, self.width, 3) and frame.flags["C_CONTIGUOUS"]
        with self.lock:
            self.frames += 1
            self.last = frame.copy()

    def close(self):
        pass
