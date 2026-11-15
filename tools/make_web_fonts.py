"""Make the small WOFF2 copies of the app fonts that the program's pages load (26.11.57).

Every letter of the TTF is kept, only packed smaller (about a third of the size). The TTF files stay: the FrameDecks
vCam and the Share Window draw text with them, and an older browser without WOFF2 reads them instead.
Run after changing a font:  python tools/make_web_fonts.py
"""
import pathlib
import subprocess
import sys

FONTS = pathlib.Path(__file__).resolve().parents[1] / "app" / "fonts"

if __name__ == "__main__":
    for name in ("EBGaramond", "SourceSans3"):
        subprocess.run([sys.executable, "-m", "fontTools.subset", str(FONTS / f"{name}.ttf"), "--unicodes=*", "--glyphs=*",
                        "--layout-features=*", "--name-IDs=*", "--notdef-outline", "--flavor=woff2",
                        f"--output-file={FONTS / (name + '.woff2')}"], check=True)
        print(name, (FONTS / f"{name}.woff2").stat().st_size, "bytes")
