# PyInstaller recipe for the BSF Command Center Windows app.
# Build:  pyinstaller --noconfirm --clean packaging/bsf.spec --distpath dist --workpath build
# "Folder" mode (not one-file): starts faster and triggers fewer antivirus false alarms.
from pathlib import Path

root = Path(SPECPATH).parent

# ---- Windows file details (right-click the app > Properties > Details) ----
version_file = None
try:  # needs "pefile", which PyInstaller installs automatically on Windows
    import re
    from PyInstaller.utils.win32.versioninfo import (VSVersionInfo, FixedFileInfo, StringFileInfo, StringTable,
                                                     StringStruct, VarFileInfo, VarStruct)
    VERSION = re.search(r'APP_VERSION = "([^"]+)"', (root / "server.py").read_text(encoding="utf-8")).group(1)
    nums = ([int(x) for x in re.findall(r"\d+", VERSION)] + [0, 0, 0, 0])[:4]
    version_info = VSVersionInfo(
        ffi=FixedFileInfo(filevers=tuple(nums), prodvers=tuple(nums)),
        kids=[StringFileInfo([StringTable("040904B0", [
            StringStruct("CompanyName", "Shobin Mathews"),
            StringStruct("FileDescription", "BSF Command Center"),
            StringStruct("FileVersion", VERSION),
            StringStruct("InternalName", "BSF Command Center"),
            StringStruct("LegalCopyright", "Copyright (C) Shobin Mathews"),
            StringStruct("OriginalFilename", "BSF Command Center.exe"),
            StringStruct("ProductName", "BSF Command Center"),
            StringStruct("ProductVersion", VERSION),
            StringStruct("Comments", "Independent tool by Shobin Mathews. Not affiliated with or endorsed by Bible Study Fellowship International."),
        ])]), VarFileInfo([VarStruct("Translation", [1033, 1200])])])
    version_file = Path(workpath) / "version_info.txt"
    version_file.parent.mkdir(parents=True, exist_ok=True)
    version_file.write_text(str(version_info), encoding="utf-8")
except Exception as e:  # never let file details stop a build
    print("Note: Windows file details skipped:", e)
    pass

a = Analysis(
    [str(root / "desktop_app.py")],
    pathex=[str(root)],
    datas=[(str(root / "app"), "app"), (str(root / "vcam" / "models"), "vcam/models"), (str(root / "vcam" / "bin"), "vcam/bin")],
    hiddenimports=["server", "pystray._win32", "PIL.Image", "vcam.engine", "vcam.blur", "vcam.sink", "vcam.devices", "cv2", "numpy",
                   "cv2_enumerate_cameras", "cv2_enumerate_cameras.windows_backend", "cv2_enumerate_cameras._windows_backend"],
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
    version=str(version_file) if version_file else None,
)
coll = COLLECT(exe, a.binaries, a.datas, name="BSF Command Center", upx=False)
