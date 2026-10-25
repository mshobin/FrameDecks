"""Quick self-check run before every build: the program starts, serves its pages and stops cleanly."""
import json, os, sys, tempfile, threading, urllib.request
from pathlib import Path
root = Path(__file__).resolve().parent.parent
os.environ["KC_DATA_DIR"] = tempfile.mkdtemp(prefix="kc-check-")
sys.path.insert(0, str(root))
import server  # noqa: E402

# Use an ephemeral port so the self-check is not coupled to local port policy.
server.PORTS = [0]
srv = server.start_main_server()
assert srv is not None, "could not start"
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}/"
for page in ["", "dashboard.html", "remote.html", "stage.html", "focus-verse.html", "discussion-question.html",
             "birthday.html", "js/app-bridge.js", "js/brand.js", "js/workspace.js", "js/scripture.js", "js/meeting-sheet.js", "js/meeting-import.js", "js/meeting-book.js", "js/frame-lists.js", "js/annotate.js", "js/preview-edit.js", "speaker.html", "js/speaker.js", "css/speaker.css", "templates/FRAMEDECKS-Meeting-Workbook.xlsx", "js/meeting-brand.js", "js/panels.js", "js/editable.js", "js/teleprompter.js", "js/prompter-dock.js", "js/palette.js", "css/teleprompter.css", "prompter.html", "spotlight.html", "js/prompter.js", "js/window-chrome.js", "css/window.css", "css/prompter.css", "js/about.js", "js/account.js", "remote-manifest.json", "icons/remote-192.png", "icons/favicon-16.png", "icons/favicon-32.png", "icons/tray-64.png"]:
    with urllib.request.urlopen(base + page, timeout=5) as r:
        assert r.status == 200, page
# 6.8 shortcut text checks (pure; the Windows parts are exercised only in the installed app)
import desktop_win as _dw
assert _dw.parse_hotkey("Alt+Space") == (1, 32) and _dw.parse_hotkey("Space") is None and _dw.format_hotkey("ctrl+alt+space") == "Ctrl+Alt+Space"
# 6.9 Export this meeting to Excel: the server fills the template's Meeting Form
req = urllib.request.Request(base + "api/meeting/workbook", method="POST", headers={"Content-Type": "application/json"},
                             data=json.dumps({"meeting": [["Field", "Value"], ["Meeting name", "Check"]], "frames": [[], [1, "Welcome"]]}).encode())
with urllib.request.urlopen(req, timeout=10) as r:
    assert r.status == 200 and r.read(2) == b"PK", "meeting workbook export"
ping = json.loads(urllib.request.urlopen(base + "api/app/ping").read())
assert ping["app"] == "FRAMEDECKS"
for name in ["app/js/overlay.js", "app/js/store.js", "app/fonts/EBGaramond.ttf", "app/vendor/xlsx.full.min.js", "desktop_app.py", "desktop_win.py"]:
    assert (root / name).exists(), name
# FRAMEDECKS: the camera ID in the app must match the one compiled into the camera
import re as _re
build_id = _re.search(r'CLSID = "([0-9A-F-]+)"', (root / "packaging" / "build_vcam.py").read_text()).group(1)
from vcam.sink import VCAM_CLSID
assert VCAM_CLSID == "{" + build_id + "}", "FRAMEDECKS ID mismatch between vcam/sink.py and packaging/build_vcam.py"
from vcam.sink import VCAM_NAME
build_name = _re.search(r'NAME = "([^"]+)"', (root / "packaging" / "build_vcam.py").read_text()).group(1)
assert VCAM_NAME == build_name == "FRAMEDECKS", "the camera must be called FRAMEDECKS"
assert (root / "vcam" / "models" / "selfie_segmentation_landscape.tflite").exists(), "blur model missing"
if os.name == "nt" and os.environ.get("GITHUB_ACTIONS") == "true":
    missing = [f for f in ("kingdomconnect_vcam64.dll", "kingdomconnect_vcam32.dll", "build-info.json") if not (root / "vcam" / "bin" / f).exists()]
    if missing:
        sys.exit("STOP: the FRAMEDECKS camera was not built (" + ", ".join(missing) + " missing).\n"
                 "The build recipe .github/workflows/build-windows.yml in your repository is out of date.\n"
                 "Copy the .github folder from the latest FRAMEDECKS.zip into your repository, then commit and push.")
try:
    import cv2
    from vcam.blur import BackgroundBlur
    BackgroundBlur(root / "vcam" / "models" / "selfie_segmentation_landscape.tflite").close()
    from vcam.cards import CardDrawer, place_verse      # the cards drawn onto FRAMEDECKS
    _st = {"layout": {}, "question": {"visible": True, "text": "Self-check question?", "label": "Discussion Question"}, "birthday": {}}
    _c = CardDrawer(root / "app" / "fonts").draw("verse", {"text": "Self-check verse", "ref": "John 1:1", "label": "Focus Verse"}, {}, 1280, 720, place_verse(_st, 1280, 720))
    assert _c.w > 100 and _c.h > 50, "card drawing failed"
    import numpy as _np
    from vcam.looks import Grade, BUILT_IN               # Camera Looks
    from vcam.compositor import Compositor               # layouts + layers + cards
    _cmp = Compositor(Path(tempfile.mkdtemp()))
    for _m in ("camera", "screen", "pip", "side"):
        _cmp.set_layout({"mode": _m})
        assert _cmp.compose(_np.full((720, 1280, 3), 90, _np.uint8), 1280, 720).shape == (720, 1280, 3), "layout failed: " + _m
    from vcam.program import ProgramFX                   # v6: text layers, transitions, Blackout / Emergency
    _cmp.program_fx = ProgramFX(root / "app" / "fonts", lambda: {"live": {"blackout": True}}, lambda: True)
    assert _cmp.compose(_np.full((720, 1280, 3), 90, _np.uint8), 1280, 720).shape == (720, 1280, 3), "program effects failed"
    import pypdfium2                                     # PDF slides
    for _k in BUILT_IN:
        assert Grade(BUILT_IN[_k]).apply(_np.full((72, 128, 3), 128, _np.uint8)).shape == (72, 128, 3), "look failed: " + _k
    print("FRAMEDECKS: blur model loads with OpenCV", cv2.__version__)
except ImportError:
    print("FRAMEDECKS: OpenCV not installed here (only needed to build the app)")
srv.shutdown()
print("Self-check passed: version", ping["version"])
