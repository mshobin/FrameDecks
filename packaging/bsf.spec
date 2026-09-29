# PyInstaller recipe for the BSF Command Center Windows app.
# Build:  pyinstaller --noconfirm --clean packaging/bsf.spec --distpath dist --workpath build
# "Folder" mode (not one-file): starts faster and triggers fewer antivirus false alarms.
from pathlib import Path

root = Path(SPECPATH).parent

a = Analysis(
    [str(root / "desktop_app.py")],
    pathex=[str(root)],
    datas=[(str(root / "app"), "app")],
    hiddenimports=["server", "pystray._win32", "PIL.Image"],
    excludes=["tkinter", "unittest", "pydoc_data"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="BSF Command Center",
    icon=str(root / "packaging" / "bsf.ico"),
    console=False,          # no black window
    upx=False,              # compression tools are a common cause of antivirus false alarms
)
coll = COLLECT(exe, a.binaries, a.datas, name="BSF Command Center", upx=False)
