"""Prints the version number from server.py (used by the build)."""
import re
from pathlib import Path
text = (Path(__file__).resolve().parent.parent / "server.py").read_text(encoding="utf-8")
print(re.search(r'APP_VERSION = "([^"]+)"', text).group(1))
