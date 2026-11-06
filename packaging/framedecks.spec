# PyInstaller recipe for the FrameDecks Windows app.
# Build:  pyinstaller --noconfirm --clean packaging/framedecks.spec --distpath dist --workpath build
# "Folder" mode (not one-file): starts faster and triggers fewer antivirus false alarms.
from pathlib import Path

root = Path(SPECPATH).parent

# ---- Windows file details (right-click the app > Properties > Details) ----
version_file = None
try:  # needs "pefile", which PyInstaller installs automatically on Windows
    import re
    from PyInstaller.utils.win32.versioninfo import (VSVersionInfo, FixedFileInfo, StringFileInfo, StringTable,
                                                     StringStruct, VarFileInfo, VarStruct)
    VERSION = re.search(r'APP_VERSION = "([^"]+)"', (root / "src" / "server.py").read_text(encoding="utf-8")).group(1)
    nums = ([int(x) for x in re.findall(r"\d+", VERSION)] + [0, 0, 0, 0])[:4]
    version_info = VSVersionInfo(
        ffi=FixedFileInfo(filevers=tuple(nums), prodvers=tuple(nums)),
        kids=[StringFileInfo([StringTable("040904B0", [
            StringStruct("CompanyName", "Shobin Mathews"),
            StringStruct("FileDescription", "FrameDecks"),
            StringStruct("FileVersion", VERSION),
            StringStruct("InternalName", "FRAMEDECKS"),
            StringStruct("LegalCopyright", "Copyright (C) Shobin Mathews"),
            StringStruct("OriginalFilename", "FRAMEDECKS.exe"),
            StringStruct("ProductName", "FrameDecks"),
            StringStruct("ProductVersion", VERSION),
            StringStruct("Comments", "Independent tool by Shobin Mathews. Not affiliated with or endorsed by Bible Study Fellowship International."),
        ])]), VarFileInfo([VarStruct("Translation", [1033, 1200])])])
    version_file = Path(workpath) / "version_info.txt"
    version_file.parent.mkdir(parents=True, exist_ok=True)
    version_file.write_text(str(version_info), encoding="utf-8")
except Exception as e:  # never let file details stop a build
    print("Note: Windows file details skipped:", e)
    pass

# python-pptx (PowerPoint export, M-D4) reads its own blank presentation and XML templates at run time
try:
    from PyInstaller.utils.hooks import collect_data_files
    pptx_data = collect_data_files("pptx")
except Exception as e:
    print("Note: python-pptx data not found:", e)
    pptx_data = []

# 9.10.3 the cloud's address and publishable key, when the build wrote them (tools/write_cloud_builtin.py)
builtin = root / "src" / "cloud_builtin.json"
cloud_data = [(str(builtin), ".")] if builtin.exists() else []

# 26.11.2 the speech engine for Follow my voice comes with the installer (the build puts it in src/voice_runtime from the
# pinned file in src/voice_files.json): the installed app then downloads only the model, never program code
voice_rt = root / "src" / "voice_runtime"
voice_data = [(str(voice_rt), "voice_runtime")] if (voice_rt / "libvosk.dll").exists() else []

a = Analysis(
    [str(root / "src" / "desktop_app.py")],
    pathex=[str(root / "src"), str(root)],
    datas=[(str(root / "app"), "app"), (str(root / "src" / "vcam" / "models"), "vcam/models"), (str(root / "src" / "vcam" / "bin"), "vcam/bin"),
           (str(root / "LICENSE"), "."), (str(root / "NOTICE"), "."), (str(root / "docs" / "legal" / "THIRD_PARTY_NOTICES.md"), "."),
           (str(root / "src" / "voice_files.json"), ".")] + pptx_data + cloud_data + voice_data,
    hiddenimports=["server", "errlog", "supervisor", "ai", "pptx_export", "pptx", "lxml._elementpath", "pystray._win32", "PIL.Image", "vcam.engine", "vcam.blur", "vcam.sink", "vcam.devices", "vcam.overlay", "vcam.cards", "vcam.looks", "vcam.screen", "vcam.layers", "vcam.compositor", "vcam.program", "vcam.chatcard", "media_names", "ed25519", "manifest_sig", "updater", "vcam.priority", "vcam.present_window", "desktop_win", "memory", "capture", "legacy", "meeting_form", "meeting_keys", "live_push", "meeting_notes", "voice_follow", "voice_worker",
                   "windows_capture", "pypdfium2", "comtypes", "comtypes.client", "cv2", "numpy",
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
    name="FRAMEDECKS",
    icon=str(root / "packaging" / "framedecks.ico"),
    console=False,          # no black window
    upx=False,              # compression tools are a common cause of antivirus false alarms
    version=str(version_file) if version_file else None,
)
coll = COLLECT(exe, a.binaries, a.datas, name="FRAMEDECKS", upx=False)
