"""FRAMEDECKS - restarts the program if it crashes (architecture audit C2: docs/project/2026-10-25-architecture-audit.md).

The installed FRAMEDECKS.exe starts as a small watchdog that runs the real program as a second FRAMEDECKS.exe and
waits. If the program ends by crashing (a Windows crash code, such as an access violation in a camera or graphics
driver), the watchdog starts it again within a second or two, so the FRAMEDECKS camera in Zoom or Teams comes back by
itself. At most 3 restarts in 5 minutes; then it stops trying.

Never restarted: a normal quit (the tray, the window), the program's own "unexpected problem" message (it closes with
code 0 after telling the person), and being ended by Task Manager or the uninstaller (code 1). The watchdog loads
nothing else (no server, no window), and does nothing when run from source unless FRAMEDECKS_SUPERVISOR=1.
"""
import os
import subprocess
import sys
import time

CHILD_ENV = "FRAMEDECKS_SUPERVISED"      # set in the real program's environment
SWITCH_ENV = "FRAMEDECKS_SUPERVISOR"     # "0" turns the watchdog off, "1" turns it on when run from source
MAX_RESTARTS = 3
WINDOW = 300.0                           # seconds
WAIT_BEFORE_RESTART = 1.0


def is_crash(code):
    """True for Windows exception codes (NTSTATUS 0xC0000000 and up): the process died, nobody ended it."""
    if code is None:
        return False
    return (code & 0xFFFFFFFF) >= 0xC0000000


def should_restart(code, restarts, now):
    """restarts: times of earlier restarts. A crash restarts unless 3 happened in the last 5 minutes."""
    if not is_crash(code):
        return False
    recent = [t for t in restarts if now - t < WINDOW]
    return len(recent) < MAX_RESTARTS


def wanted(environ=os.environ, frozen=None):
    if environ.get(CHILD_ENV) or os.name != "nt":
        return False
    switch = environ.get(SWITCH_ENV)
    if switch == "0":
        return False
    frozen = getattr(sys, "frozen", False) if frozen is None else frozen
    return bool(frozen) or switch == "1"


def _log(line):
    base = os.environ.get("KC_DATA_DIR") or os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "FRAMEDECKS")
    try:
        os.makedirs(base, exist_ok=True)
        with open(os.path.join(base, "kc-app-log.txt"), "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} watchdog: {line}\n")
    except OSError:
        pass


def run(argv=None, spawn=subprocess.call, clock=time.monotonic, sleep=time.sleep):
    """Run the program until it ends normally; restart it after a crash. Returns the exit code to end with."""
    argv = list(argv if argv is not None else ([sys.executable] + sys.argv[1:] if getattr(sys, "frozen", False)
                                               else [sys.executable] + sys.argv))
    env = dict(os.environ, **{CHILD_ENV: "1"})
    restarts = []
    while True:
        code = spawn(argv, env=env)
        if not should_restart(code, restarts, clock()):
            if is_crash(code):
                _log(f"FRAMEDECKS crashed again (code 0x{code & 0xFFFFFFFF:08X}); not restarting after {MAX_RESTARTS} "
                     f"restarts in {int(WINDOW / 60)} minutes")
            return 0 if is_crash(code) else (code or 0)
        restarts.append(clock())
        _log(f"FRAMEDECKS crashed (code 0x{code & 0xFFFFFFFF:08X}); starting it again")
        sleep(WAIT_BEFORE_RESTART)
