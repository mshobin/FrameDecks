"""7.1.1 Windows jobs without shells (src/winapi.py). Microsoft Defender quarantined 7.1 as a "Trojan" for behaving
like remote-control malware: an unsigned program starting hidden PowerShell (one with an encoded command, one with
-ExecutionPolicy Bypass), netsh and taskkill. These tests keep every such launch out of the program, and on the
Windows CI runner they call the real Windows interfaces that replaced them."""
import ast
import ctypes
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import legacy  # noqa: E402
import winapi  # noqa: E402

SHELLS = {"powershell", "powershell.exe", "pwsh", "pwsh.exe", "taskkill", "taskkill.exe", "netsh", "netsh.exe",
          "cmd", "cmd.exe", "wmic", "wmic.exe", "schtasks", "schtasks.exe"}
WINDOWS = os.name == "nt"


def admin():
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


LAUNCHERS = {"run", "Popen", "call", "check_call", "check_output", "system", "startfile", "spawnl", "spawnv",
             "run_elevated"}


def _program_of(node):
    """The program a launch call starts, if it is written as a literal: run(["x", ...]), Popen("x ..."), system("x")."""
    if not node.args:
        return None
    first = node.args[0]
    if isinstance(first, (ast.List, ast.Tuple)) and first.elts:
        first = first.elts[0]
    if isinstance(first, ast.Constant) and isinstance(first.value, str):
        return first.value.strip().split(" ")[0].strip('"').lower()
    return None


class NoShells(unittest.TestCase):
    def test_the_program_never_starts_a_shell(self):
        found = []
        for f in sorted((ROOT / "src").rglob("*.py")):
            for node in ast.walk(ast.parse(f.read_text(encoding="utf-8"))):
                prog = None
                if isinstance(node, ast.Call):
                    name = getattr(node.func, "attr", None) or getattr(node.func, "id", None)
                    prog = _program_of(node) if name in LAUNCHERS else None
                elif isinstance(node, (ast.List, ast.Tuple)) and node.elts and isinstance(node.elts[0], ast.Constant) \
                        and isinstance(node.elts[0].value, str):
                    prog = node.elts[0].value.strip().lower()             # a command line kept in a variable first
                if prog and Path(prog).name in SHELLS:
                    found.append(f"{f.relative_to(ROOT)}:{node.lineno} {prog}")
        self.assertEqual(found, [], "no PowerShell, taskkill, netsh, cmd, wmic or schtasks from the program")

    def test_nothing_encoded_or_bypassing(self):
        for f in sorted((ROOT / "src").rglob("*.py")):
            text = f.read_text(encoding="utf-8")
            for word in ("-EncodedCommand", "ExecutionPolicy"):
                self.assertNotIn(word, text, f"{f.name}: {word}")


class Basics(unittest.TestCase):
    def test_earlier_firewall_rules_are_the_ones_earlier_versions_made(self):
        self.assertIn(legacy.OLD_FIREWALL_RULE, winapi.OLD_FIREWALL_RULES)
        self.assertIn("Kingdom Connect Phone Remote", winapi.OLD_FIREWALL_RULES)

    def test_the_firewall_mode_checks_its_arguments(self):
        self.assertEqual(winapi.firewall_main(["x", "--firewall"]), 2)
        self.assertEqual(winapi.firewall_main(["x", "--firewall", "open", "--program", "a.exe"]), 2)

    @unittest.skipIf(WINDOWS, "off Windows only")
    def test_off_windows_nothing_happens(self):
        self.assertEqual(winapi.run_elevated("x"), ("error", None))
        self.assertEqual(winapi.processes(), [])
        self.assertEqual(winapi.end_other_copies("FRAMEDECKS.exe"), 0)
        self.assertEqual(winapi.network_profiles(), [])
        self.assertIsNone(winapi.firewall_rule_exists())
        self.assertEqual(winapi.authenticode(__file__), (False, ""))


@unittest.skipUnless(WINDOWS, "Windows only (runs on the Windows CI runner)")
class OnWindows(unittest.TestCase):
    def test_signatures(self):
        fd, path = tempfile.mkstemp(suffix=".exe")
        os.write(fd, b"MZ not really a program")
        os.close(fd)
        try:
            self.assertEqual(winapi.authenticode(path), (False, ""))
        finally:
            os.unlink(path)
        valid, signer = winapi.authenticode(sys.executable)     # python.org builds are signed by the PSF
        print("python.exe signature:", valid, signer)
        if valid:
            self.assertTrue(signer)

    def test_processes_and_other_copies(self):
        me = [p for p in winapi.processes() if p[0] == os.getpid()]
        self.assertEqual(len(me), 1)
        self.assertTrue(me[0][2].lower().startswith("python"))
        self.assertEqual(winapi.end_other_copies("no-such-program-framedecks.exe"), 0)

    def test_networks(self):
        nets = winapi.network_profiles()
        print("networks:", nets)
        self.assertIsInstance(nets, list)
        for n in nets:
            self.assertIn(n["category"], ("Public", "Private", "DomainAuthenticated"))

    def test_firewall_rule(self):
        name = "FrameDecks test rule (7.1.1)"
        self.assertFalse(winapi.firewall_rule_exists(name))
        if not admin():
            self.skipTest("adding a rule needs administrator rights")
        try:
            self.assertTrue(winapi.firewall_apply("allow", sys.executable, name=name, old=()))
            self.assertTrue(winapi.firewall_rule_exists(name))
        finally:
            self.assertTrue(winapi.firewall_apply("undo", sys.executable, name=name, old=()))
        self.assertFalse(winapi.firewall_rule_exists(name))


if __name__ == "__main__":
    unittest.main()
