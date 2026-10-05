"""Quick self-check run before every build: the program starts, serves its pages and stops cleanly."""
import json, os, sys, tempfile, threading, urllib.request
from pathlib import Path
root = Path(__file__).resolve().parent.parent
os.environ["BSF_DATA_DIR"] = tempfile.mkdtemp(prefix="bsf-check-")
sys.path.insert(0, str(root))
import server  # noqa: E402

srv = server.start_main_server()
assert srv is not None, "could not start"
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}/"
for page in ["", "dashboard.html", "remote.html", "stage.html", "focus-verse.html", "discussion-question.html",
             "birthday.html", "js/app-bridge.js", "js/brand.js", "js/about.js", "remote-manifest.json", "icons/remote-192.png"]:
    with urllib.request.urlopen(base + page, timeout=5) as r:
        assert r.status == 200, page
ping = json.loads(urllib.request.urlopen(base + "api/app/ping").read())
assert ping["app"] == "BSF Command Center"
for name in ["app/js/overlay.js", "app/js/store.js", "app/fonts/EBGaramond.ttf", "app/vendor/xlsx.full.min.js", "desktop_app.py"]:
    assert (root / name).exists(), name
# BCC vCam: the camera ID in the app must match the one compiled into the camera
import re as _re
build_id = _re.search(r'CLSID = "([0-9A-F-]+)"', (root / "packaging" / "build_vcam.py").read_text()).group(1)
from vcam.sink import VCAM_CLSID
assert VCAM_CLSID == "{" + build_id + "}", "BCC vCam ID mismatch between vcam/sink.py and packaging/build_vcam.py"
assert (root / "vcam" / "models" / "selfie_segmentation_landscape.tflite").exists(), "blur model missing"
if os.name == "nt" and os.environ.get("GITHUB_ACTIONS") == "true":
    missing = [f for f in ("bcc_vcam64.dll", "bcc_vcam32.dll", "build-info.json") if not (root / "vcam" / "bin" / f).exists()]
    if missing:
        sys.exit("STOP: the BCC vCam camera was not built (" + ", ".join(missing) + " missing).\n"
                 "The build recipe .github/workflows/build-windows.yml in your repository is out of date.\n"
                 "Copy the .github folder from the latest BSF-Command-Center.zip into your repository, then commit and push.")
try:
    import cv2
    from vcam.blur import BackgroundBlur
    BackgroundBlur(root / "vcam" / "models" / "selfie_segmentation_landscape.tflite").close()
    print("BCC vCam: blur model loads with OpenCV", cv2.__version__)
except ImportError:
    print("BCC vCam: OpenCV not installed here (only needed to build the app)")
srv.shutdown()
print("Self-check passed: version", ping["version"])
