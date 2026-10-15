"""Windows thread priority for KingdomConnect's background helpers.

Background work (blur model, card drawing, video decoding, recording, screen capture, picture encoding for the
Presentation window) runs at "below normal" priority, so Windows always lets the desktop, the apps you switch to
and Zoom go first: the PC stays responsive even when the CPU is busy. The camera's own frame loop keeps normal
priority, so the virtual camera stays smooth. On other systems this does nothing.
"""
import os

THREAD_PRIORITY_BELOW_NORMAL = -1


def lower_this_thread():
    if os.name != "nt":
        return False
    try:
        import ctypes
        k = ctypes.windll.kernel32
        return bool(k.SetThreadPriority(k.GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL))
    except Exception:
        return False
