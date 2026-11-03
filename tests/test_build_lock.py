"""9.3 (production audit M5): the Windows build installs packaging/requirements-lock.txt with --require-hashes. This
keeps the lock, packaging/constraints.txt and packaging/requirements-desktop.txt telling the same story."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "packaging"


def norm(name):
    return re.sub(r"[-_.]+", "-", name).lower()


def pins(text):
    return {norm(m.group(1)): m.group(2) for m in re.finditer(r"^([A-Za-z0-9_.-]+)==([^\s;\\]+)", text, re.M)}


class BuildLock(unittest.TestCase):
    def setUp(self):
        self.lock_text = (PKG / "requirements-lock.txt").read_text(encoding="utf-8")
        self.lock = pins(self.lock_text)
        self.constraints = pins((PKG / "constraints.txt").read_text(encoding="utf-8"))

    def test_the_lock_and_the_constraints_pin_the_same_versions(self):
        self.assertEqual(self.lock, self.constraints)

    def test_every_package_the_build_asks_for_is_locked(self):
        wanted = [norm(re.split(r"[<>=!~;\s\[]", line.strip())[0])
                  for line in (PKG / "requirements-desktop.txt").read_text(encoding="utf-8").splitlines()
                  if line.strip() and not line.lstrip().startswith("#")]
        self.assertTrue(wanted)
        for name in wanted:
            self.assertIn(name, self.lock, name)

    def test_every_locked_package_has_hashes(self):
        for block in re.split(r"\n(?=[A-Za-z])", self.lock_text):
            m = re.match(r"([A-Za-z0-9_.-]+)==", block)
            if m:
                self.assertRegex(block, r"--hash=sha256:[0-9a-f]{64}", m.group(1))

    def test_the_build_installs_the_lock_with_hashes(self):
        wf = (ROOT / ".github" / "workflows" / "build-windows.yml").read_text(encoding="utf-8")
        self.assertIn("--require-hashes --no-deps -r packaging/requirements-lock.txt", wf)
        self.assertNotIn("install --upgrade pip", wf)
        self.assertIn("--no-binary pyinstaller --require-hashes", wf)


if __name__ == "__main__":
    unittest.main()
