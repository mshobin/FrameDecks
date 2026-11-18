"""FrameDecks - writes THIRD_PARTY_LICENSES.txt for the Windows build (26.11.64, release review B6).

MIT, BSD and similar licences ask for their text to travel with every copy. The installer ships the Python packages
the program is built from, so the build collects each installed package's own licence files (from its .dist-info:
the License-File entries, or LICENSE/COPYING/NOTICE files) into one plain-text file that packaging/framedecks.spec puts
next to FRAMEDECKS.exe, beside LICENSE, NOTICE and THIRD_PARTY_NOTICES.md. Build tools that are not shipped
(PyInstaller, pip, setuptools, wheel) are left out.

    python tools/write_third_party_licenses.py [output]      # default: build-extra/THIRD_PARTY_LICENSES.txt
"""
import re
import sys
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOT_SHIPPED = {"pip", "setuptools", "wheel", "pyinstaller", "pyinstaller-hooks-contrib", "altgraph", "pefile",
               "pywin32-ctypes", "packaging", "macholib", "ruff"}
NAMES = re.compile(r"^(licen[cs]e|copying|notice|authors)([._-].*)?$", re.I)


def licence_files(dist):
    """The licence texts a package ships: (name, text) pairs, each file once."""
    seen, out = set(), []
    declared = {Path(f).name for f in (dist.metadata.get_all("License-File") or [])}
    for f in dist.files or []:
        name = Path(str(f)).name
        in_meta = ".dist-info" in str(f) or ".egg-info" in str(f)
        if in_meta and (name in declared or NAMES.match(name)):
            p = Path(dist.locate_file(f))
            if p.is_file() and p.name not in seen:
                try:
                    text = p.read_text(encoding="utf-8", errors="replace").strip()
                except OSError:
                    continue
                if text:
                    seen.add(p.name)
                    out.append((str(f), text))
    return out


def collect():
    rows, seen = [], set()
    for dist in metadata.distributions():
        name = (dist.metadata.get("Name") or "").strip()
        if not name or name.lower() in NOT_SHIPPED or name.lower() in seen:
            continue
        seen.add(name.lower())
        lic = (dist.metadata.get("License-Expression") or dist.metadata.get("License") or "").strip()
        if len(lic) > 200:                                   # some packages put the whole text here
            lic = lic.splitlines()[0][:200]
        classifiers = [c.split("::")[-1].strip() for c in dist.metadata.get_all("Classifier") or [] if c.startswith("License ::")]
        rows.append((name, dist.version, lic or ", ".join(classifiers) or "see the files below", licence_files(dist)))
    rows.sort(key=lambda r: r[0].lower())
    return rows


def render(rows):
    out = ["FrameDecks - licences of the third-party Python packages inside this program",
           "",
           "FrameDecks itself is licensed under the Apache License 2.0 (LICENSE). The packages below are included in",
           "the program under their own licences, whose texts follow. Other components (fonts, icons, the camera driver,",
           "models) are listed with their licences in THIRD_PARTY_NOTICES.md.",
           ""]
    for name, version, lic, files in rows:
        out += ["=" * 78, "%s %s  -  %s" % (name, version, lic), "=" * 78]
        if not files:
            out += ["(This package ships no separate licence file; its licence is: %s.)" % lic, ""]
        for path, text in files:
            out += ["--- %s ---" % path, text, ""]
    return "\n".join(out).rstrip() + "\n"


def main(argv):
    dest = Path(argv[1]) if len(argv) > 1 else ROOT / "build-extra" / "THIRD_PARTY_LICENSES.txt"
    rows = collect()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(render(rows), encoding="utf-8")
    missing = [r[0] for r in rows if not r[3]]
    print("THIRD_PARTY_LICENSES.txt: %d packages, %d without a licence file%s" % (
        len(rows), len(missing), (" (" + ", ".join(missing[:12]) + ")") if missing else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
