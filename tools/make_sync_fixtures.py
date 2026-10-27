"""Writes tests/fixtures/sync/*.json: saved plans (built by tools/sync_fixture_docs.js with the app's own store.js),
their member lists, and the records sync_entities.split makes of them. The desktop (tests/test_sync_entities.py), the
store (tests/sync-fixtures.test.js) and the companion (hosted/tests/sync-entities.test.mjs) all check these files.

Run after changing store.js normalize or the record mapping:  python tools/make_sync_fixtures.py
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import sync_entities  # noqa: E402


def main():
    raw = subprocess.run(["node", str(ROOT / "tools" / "sync_fixture_docs.js")], check=True, capture_output=True,
                         text=True, encoding="utf-8").stdout
    out = ROOT / "tests" / "fixtures" / "sync"
    out.mkdir(parents=True, exist_ok=True)
    for name, fx in json.loads(raw).items():
        fx["split"] = sync_entities.split(fx["normalized"], fx["members"])
        (out / f"{name}.json").write_text(json.dumps(fx, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{name}: {len(fx['split']['entities'])} records")


if __name__ == "__main__":
    main()
