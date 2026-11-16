"""FrameDecks - personal data kept encrypted on this PC (26.11.58, release sign-off L3).

On Windows the member list (kc-members-private.json) and its copies in backups/ are encrypted with Windows' own data
protection (DPAPI, CryptProtectData for the current Windows account). Only the same Windows account on the same PC can
read them; another account on this PC, or the file copied to another computer, cannot. Nothing to remember, no key
stored by FrameDecks. On other systems (development, the Mac start file, CI) the file stays plain JSON as before.

    encode(text) -> bytes      b"FDDPAPI1\\n" + DPAPI blob on Windows, else the UTF-8 text
    decode(raw) -> text        either form (a file from an earlier version is plain JSON); Unreadable when it can't
    is_protected(raw)          the encrypted form?

A file that cannot be decrypted is never replaced: callers keep it and report Unreadable (an OSError).
"""
import ctypes
import os
from pathlib import Path

HEADER = b"FDDPAPI1\n"
DESCRIPTION = "FrameDecks member data"
CRYPTPROTECT_UI_FORBIDDEN = 0x01


class Unreadable(OSError):
    """The file is encrypted and this Windows account (or this system) cannot decrypt it."""


class _Blob(ctypes.Structure):
    _fields_ = [("cbData", ctypes.c_uint32), ("pbData", ctypes.POINTER(ctypes.c_char))]


def available():
    """Windows' data protection is there (Windows only)."""
    return os.name == "nt"


def _crypt(data, protect):
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32")
    buf = ctypes.create_string_buffer(bytes(data), len(data))
    blob_in = _Blob(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    blob_out = _Blob()
    if protect:
        ok = crypt32.CryptProtectData(ctypes.byref(blob_in), ctypes.c_wchar_p(DESCRIPTION), None, None, None,
                                      CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(blob_out))
    else:
        ok = crypt32.CryptUnprotectData(ctypes.byref(blob_in), None, None, None, None,
                                        CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(blob_out))
    if not ok:
        raise OSError(ctypes.get_last_error(), "Windows data protection refused the request")
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        kernel32.LocalFree(blob_out.pbData)


def protect(data):
    """Encrypt bytes for the current Windows account."""
    return _crypt(data, True)


def unprotect(data):
    """Decrypt bytes encrypted by protect() for the current Windows account."""
    return _crypt(data, False)


def is_protected(raw):
    return isinstance(raw, (bytes, bytearray)) and bytes(raw[:len(HEADER)]) == HEADER


def encode(text):
    raw = text.encode("utf-8")
    return HEADER + protect(raw) if available() else raw


def decode(raw):
    if not is_protected(raw):
        return bytes(raw).decode("utf-8-sig")                 # plain JSON (earlier versions, other systems)
    if not available():
        raise Unreadable("This file is encrypted for a Windows account; it can only be read there.")
    try:
        return unprotect(bytes(raw[len(HEADER):])).decode("utf-8")
    except (OSError, ValueError) as e:
        raise Unreadable("This file was encrypted by another Windows account or another PC, so it can't be read "
                         f"here ({type(e).__name__}).") from e


def read_text(path):
    return decode(Path(path).read_bytes())


def protect_file(path):
    """Encrypt a plain file in place (a backup written before this version). True when it changed. Never touches a
    file it cannot read."""
    path = Path(path)
    if not available():
        return False
    raw = path.read_bytes()
    if is_protected(raw):
        return False
    data = encode(decode(raw))
    st, folder = path.stat(), path.parent.stat()
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)
    os.utime(path, (st.st_atime, st.st_mtime))                 # a backup keeps its date (and its place in the list)
    os.utime(path.parent, (folder.st_atime, folder.st_mtime))
    return True
