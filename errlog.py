"""FRAMEDECKS - errors the program deliberately carries on after (production audit M8).

Many places keep going when something optional fails (a window that has already closed, a camera that went away).
They used to say nothing, so a problem left no trace. swallowed() writes one line to the log (stderr, which the
installed program sends to kc-app-log.txt) and never raises; the same place and error is written at most once a
minute, so a loop that fails 30 times a second cannot flood the log."""
import sys
import threading
import time

_last = {}
_lock = threading.Lock()
QUIET_SECONDS = 60


def swallowed(where, error):
    try:
        key = (where, type(error).__name__)
        now = time.monotonic()
        with _lock:
            if now - _last.get(key, -QUIET_SECONDS) < QUIET_SECONDS:
                return
            _last[key] = now
        sys.stderr.write(f"{time.strftime('%H:%M:%S')} carried on after an error in {where}: "
                         f"{type(error).__name__}: {error}\n")
    except Exception:  # logging must never become the problem
        pass
