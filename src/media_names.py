"""FrameDecks 9.1.2 - a media file name from a plan is a name, never a path.

Layer files (pictures, videos, PDFs, audio) live in one folder: the plan stores only their file names. A plan can come
from the phone remote, from cloud sync or from an imported file, so a "name" such as "..\\..\\Documents\\x.pdf",
"C:\\Users\\x\\y.png" or "\\\\server\\share\\a.png" must never be joined onto that folder: it would read a file outside
it, or make Windows connect to another computer (leaking the user's sign-in hash). safe_name() keeps a plain file
name and turns anything else into "" (treated as "no file chosen" / "missing"). Pure Python; tests/test_hardening.py.
"""

_BAD = set('/\\:<>"|?*') | {chr(c) for c in range(32)}


def safe_name(name):
    """name if it is a plain file name (no folder, drive, share, '..' or control characters), else ''."""
    n = str(name or "")
    if not n or len(n) > 200 or n.strip(" .") == "" or any(ch in _BAD for ch in n):
        return ""
    return n
