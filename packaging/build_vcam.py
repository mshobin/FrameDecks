"""Prepares the "FrameCast" virtual camera source before it is compiled.

Takes softcam (MIT licence, https://github.com/tshino/softcam, a fixed version) and changes only:
  - the camera name shown in Zoom/Teams:        "FrameCast"
  - its unique Windows ID (CLSID):               our own, so it never clashes with other softcam apps
  - the names of the channel that carries frames: our own, for the same reason
Usage:  python packaging/build_vcam.py <path to softcam source>
The ID must match VCAM_CLSID in vcam/sink.py.
"""
import re
import sys
from pathlib import Path

NAME = "FrameCast"
CLSID = "6F2B8C3E-4D7A-4B9E-9C11-B5CC0A1E7D21"


def guid_macro(g):
    a, b, c, d, e = g.split("-")
    parts = [f"0x{a.lower()}", f"0x{b.lower()}", f"0x{c.lower()}"] + [f"0x{x}" for x in re.findall("..", (d + e).lower())]
    return ", ".join(parts)


def patch(path, replacements):
    text = path.read_text(encoding="utf-8")
    for old, new in replacements:
        if old not in text:
            sys.exit(f"build_vcam: expected text not found in {path.name}: {old!r} (softcam version changed?)")
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")


def main(src):
    src = Path(src)
    core = src / "src" / "softcam" / "softcam.cpp"
    text = core.read_text(encoding="utf-8")
    new, n = re.subn(r"DEFINE_GUID\(CLSID_DShowSoftcam,\s*[^;]*\);",
                     f"DEFINE_GUID(CLSID_DShowSoftcam,\n{guid_macro(CLSID)});", text)
    if n != 1:
        sys.exit("build_vcam: camera ID not found in softcam.cpp")
    core.write_text(new, encoding="utf-8")
    patch(core, [('L"DirectShow Softcam"', f'L"{NAME}"')])
    patch(src / "src" / "softcamcore" / "FrameBuffer.cpp", [
        ('"DirectShow Softcam/NamedMutex"', f'"{NAME}/NamedMutex"'),
        ('"DirectShow Softcam/SharedMemory"', f'"{NAME}/SharedMemory"')])
    patch(src / "src" / "softcamcore" / "DShowSoftcam.cpp", [
        ('NAME("DirectShow Softcam")', f'NAME("{NAME}")'),
        ('L"DirectShow Softcam Stream"', f'L"{NAME} Stream"')])
    print(f"Prepared {NAME} with ID {{{CLSID}}}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "softcam")
