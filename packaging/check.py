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
srv.shutdown()
print("Self-check passed: version", ping["version"])
