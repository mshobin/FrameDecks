"""Where finished frames go.

The "KingdomConnect" camera comes in two builds, and Windows lists only one of them (see
vcam/bin/kingdomconnect-camera.ps1):
  MFSink       Windows 11: a Media Foundation virtual camera (our build of the MIT-licensed VCamSample media source,
               packaging/build_mfcam.py). Windows' Frame Server serves it to every app.
  SoftcamSink  Windows 10: a DirectShow camera (our build of the MIT-licensed softcam library, renamed and with its
               own ID, packaging/build_vcam.py).
FakeSink is used for tests on computers without either.
"""
import ctypes
import os
import sys
import threading
from pathlib import Path

# Must match the ID compiled into kingdomconnect_vcam64.dll / kingdomconnect_vcam32.dll (see packaging/build_vcam.py)
VCAM_CLSID = "{6F2B8C3E-4D7A-4B9E-9C11-B5CC0A1E7D21}"
VCAM_NAME = "KingdomConnect"
# Must match CLSID in packaging/build_mfcam.py (the Windows 11 camera)
MF_CLSID = "{06BACA0B-14C0-4E9B-8161-ED7D11F73518}"
WINDOWS_11_BUILD = 22000


def dll_path(base):
    return Path(base) / "vcam" / "bin" / ("kingdomconnect_vcam64.dll" if sys.maxsize > 2**32 else "kingdomconnect_vcam32.dll")


def mf_dll_path(base):
    return Path(base) / "vcam" / "bin" / ("kingdomconnect_mfcam64.dll" if sys.maxsize > 2**32 else "kingdomconnect_mfcam32.dll")


def windows_build():
    """Windows' build number (22000 and later is Windows 11), or 0 elsewhere."""
    if os.name != "nt":
        return 0
    try:
        return sys.getwindowsversion().build
    except (AttributeError, OSError):
        return 0


def windows_11():
    return windows_build() >= WINDOWS_11_BUILD


def _registered_file(clsid):
    """The file Windows loads for this camera ID, or None (read-only registry check)."""
    if os.name != "nt":
        return None
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, rf"SOFTWARE\Classes\CLSID\{clsid}\InprocServer32", 0,
                            winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as k:
            return winreg.QueryValueEx(k, None)[0] or None
    except OSError:
        pass
    try:
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, rf"CLSID\{clsid}\InprocServer32") as k:
            return winreg.QueryValueEx(k, None)[0] or ""
    except OSError:
        return None


def mf_registered():
    """True if the Windows 11 camera is registered and its file is still there."""
    f = _registered_file(MF_CLSID)
    return bool(f) and Path(f).exists()


def is_registered():
    """True if Windows knows about a KingdomConnect camera (read-only registry check)."""
    if os.name != "nt":
        return False
    return mf_registered() or _registered_file(VCAM_CLSID) is not None


def choose(base_dirs):
    """Which camera to use: ("mf", dll) on Windows 11 once its camera is registered, else ("softcam", dll).
    The dll is the first of base_dirs that has the file (None when none has)."""
    def first(path_for):
        for b in base_dirs:
            if path_for(b).exists():
                return path_for(b)
        return None
    if windows_11() and mf_registered():
        dll = first(mf_dll_path)
        if dll is not None:
            return "mf", dll
    return "softcam", first(dll_path)


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
            raise RuntimeError("KingdomConnect is already in use by another program.")

    def connected(self):
        return bool(self.cam) and bool(self.lib.scIsConnected(self.cam))

    def send(self, frame):
        # frame: numpy uint8 array (height, width, 3), BGR, top row first, contiguous
        self.lib.scSendFrame(self.cam, frame.ctypes.data)

    def close(self):
        if self.cam:
            self.lib.scDeleteCamera(self.cam)
            self.cam = None


class MFSink:
    """The Windows 11 camera (vcam/mfcam/KcCam.cpp). The same methods as SoftcamSink."""
    def __init__(self, dll, width, height):
        self.lib = ctypes.CDLL(str(dll))
        self.lib.KcCamCreate.restype = ctypes.c_void_p
        self.lib.KcCamCreate.argtypes = [ctypes.c_wchar_p]
        self.lib.KcCamLastError.restype = ctypes.c_int
        self.lib.KcCamLastStep.restype = ctypes.c_int
        self.lib.KcCamIsConnected.argtypes = [ctypes.c_void_p]
        self.lib.KcCamIsConnected.restype = ctypes.c_int
        self.lib.KcCamSend.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int, ctypes.c_int]
        self.lib.KcCamSend.restype = ctypes.c_int
        self.lib.KcCamDelete.argtypes = [ctypes.c_void_p]
        self.width, self.height = width, height
        self.cam = self.lib.KcCamCreate(VCAM_NAME)
        if not self.cam:
            code = self.lib.KcCamLastError() & 0xFFFFFFFF
            raise RuntimeError(mf_error(code, self.lib.KcCamLastStep()))

    def connected(self):
        return bool(self.cam) and bool(self.lib.KcCamIsConnected(self.cam))

    def send(self, frame):
        # frame: numpy uint8 array (height, width, 3), BGR, top row first, contiguous
        self.lib.KcCamSend(self.cam, frame.ctypes.data, frame.shape[1], frame.shape[0])

    def close(self):
        if self.cam:
            self.lib.KcCamDelete(self.cam)
            self.cam = None


MF_STEPS = {1: "starting Media Foundation", 2: "creating the camera", 3: "starting the camera"}


def mf_error(code, step=0):
    """Windows' answer to "show the camera", in words (step: where it failed, see KcCamLastStep)."""
    words = {
        0x80040154: "the KingdomConnect camera is not installed (Settings → KingdomConnect → Install)",
        0x80070005: "Windows refused access to the camera (Settings → Privacy & security → Camera)",
        0x80004001: "this version of Windows has no virtual cameras (Windows 11 is needed)",
    }
    where = f" (while {MF_STEPS[step]}, 0x{code:08X})" if step in MF_STEPS else ""
    return "KingdomConnect couldn’t start: " + words.get(code, f"Windows error 0x{code:08X}") + where + "."


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
