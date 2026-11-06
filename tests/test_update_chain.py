"""FrameDecks 9.2 update chain (production audit H3, M3, M4, L7, L8, L9): Ed25519-signed release manifests, the
updater's stricter checks, the release tool's signing guard, and the release workflow's guards."""
import base64
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tools"))
import ed25519  # noqa: E402
import make_release_manifest as mrm  # noqa: E402
import manifest_key  # noqa: E402
import manifest_sig  # noqa: E402
import updater  # noqa: E402

SECRET = bytes(range(32))
PUBLIC = ed25519.public_key(SECRET)
TRUSTED = {manifest_sig.key_id(PUBLIC): PUBLIC.hex()}
URL = "https://downloads.framedecks.com/releases/9.2/FrameDecks-9.2-Setup.exe"


def manifest(version="9.2", notes="Grüße – new things"):
    return {"version": version, "released": "2026-11-04", "downloadUrl": URL, "sha256": "a" * 64, "size": 1000,
            "releaseNotes": notes, "signed": False,
            "platforms": {"windows": {"url": URL, "sha256": "a" * 64, "size": 1000, "file": "x.exe"}}, "previous": None}


class Ed25519(unittest.TestCase):
    def test_rfc8032_vectors(self):
        vectors = [
            ("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
             "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", "",
             "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"),
            ("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb",
             "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c", "72",
             "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00"),
            ("c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7",
             "fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025", "af82",
             "6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a"),
        ]
        for sk, pk, msg, sig in vectors:
            sk, pk, msg, sig = map(bytes.fromhex, (sk, pk, msg, sig))
            self.assertEqual(ed25519.public_key(sk), pk)
            self.assertEqual(ed25519.sign(sk, msg), sig)
            self.assertTrue(ed25519.verify(pk, msg, sig))
            self.assertFalse(ed25519.verify(pk, msg + b"!", sig))

    def test_bad_input_is_refused_never_raised(self):
        sig = ed25519.sign(SECRET, b"m")
        s = int.from_bytes(sig[32:], "little") + ed25519.L            # the same signature with s + L: malleable form
        for pub, msg, sg in [(PUBLIC, b"m", sig[:32] + s.to_bytes(32, "little")), (b"\x00" * 31, b"m", sig),
                             (PUBLIC, b"m", sig[:63]), (b"\xff" * 32, b"m", sig), (PUBLIC, b"m", b"\x00" * 64)]:
            self.assertFalse(ed25519.verify(pub, msg, sg))

    def test_matches_the_cryptography_library_when_present(self):
        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        except ImportError:
            self.skipTest("cryptography not installed")
        for i in range(20):
            seed, msg = os.urandom(32), os.urandom(i * 7)
            self.assertEqual(ed25519.sign(seed, msg), Ed25519PrivateKey.from_private_bytes(seed).sign(msg))


class ManifestSignature(unittest.TestCase):
    def test_a_signed_manifest_survives_json_and_any_change_breaks_it(self):
        signed = json.loads(json.dumps(manifest_sig.sign(manifest(), SECRET), indent=2))
        self.assertTrue(manifest_sig.verify(signed, TRUSTED))
        for field, value in [("sha256", "b" * 64), ("signed", True), ("downloadUrl", URL + "x"), ("version", "9.3"),
                             ("previous", {"version": "1.0"}), ("releaseNotes", "other")]:
            self.assertFalse(manifest_sig.verify(dict(signed, **{field: value}), TRUSTED), field)
        extra = dict(signed, platforms={"windows": dict(signed["platforms"]["windows"], url=URL + "?evil")})
        self.assertFalse(manifest_sig.verify(extra, TRUSTED))

    def test_only_a_trusted_key_counts(self):
        other = manifest_sig.sign(manifest(), os.urandom(32))
        self.assertFalse(manifest_sig.verify(other, TRUSTED))
        lying = dict(other, signature=dict(other["signature"], key=next(iter(TRUSTED))))
        self.assertFalse(manifest_sig.verify(lying, TRUSTED), "a key id that is not the signer's")
        self.assertFalse(manifest_sig.verify(manifest(), TRUSTED), "unsigned")
        bad = manifest_sig.sign(manifest(), SECRET)
        bad["signature"]["sig"] = base64.b64encode(b"x" * 64).decode()
        self.assertFalse(manifest_sig.verify(bad, TRUSTED))
        self.assertFalse(manifest_sig.verify({"signature": "nonsense"}, TRUSTED))


class _Resp:
    def __init__(self, body):
        self.body = body

    def read(self, n=-1):
        b, self.body = self.body, b""
        return b

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class Updater(unittest.TestCase):
    def make(self, body, trusted, current="9.1.2", frozen=False):
        d = tempfile.mkdtemp()
        return updater.Updater(d, current, frozen=frozen, platform="linux", trusted=trusted,
                               opener=lambda req, timeout=None: _Resp(json.dumps(body).encode()))

    def test_with_a_key_only_signed_manifests_count(self):
        good = self.make(manifest_sig.sign(manifest(), SECRET), TRUSTED).check()
        self.assertEqual((good["latest"], good["newer"]), ("9.2", True))
        bad = self.make(manifest(), TRUSTED)
        info = bad.check()
        self.assertIsNone(info["latest"], "an unsigned manifest is ignored")
        self.assertEqual(bad.state.get("checkError"), "BadSignature")
        tampered = dict(manifest_sig.sign(manifest(), SECRET), sha256="b" * 64)
        self.assertIsNone(self.make(tampered, TRUSTED).check()["latest"])

    def test_without_a_key_manifests_read_as_before(self):
        self.assertEqual(updater.TRUSTED_KEYS, {}, "no key is built in until the owner adds one (tools/manifest_key.py)")
        self.assertEqual(self.make(manifest(), {}).check()["latest"], "9.2")

    def test_the_installed_app_ignores_the_api_override(self):
        with mock.patch.object(updater, "API", "https://evil.example/latest"):
            self.assertEqual(updater.Updater(tempfile.mkdtemp(), "9.2", frozen=True).api, updater.API_DEFAULT)
            self.assertEqual(updater.Updater(tempfile.mkdtemp(), "9.2", frozen=False).api, "https://evil.example/latest")

    def test_redirects_only_to_framedecks(self):
        from urllib.error import HTTPError
        from urllib.request import Request
        h = updater._NoOffsiteRedirect()
        req = Request(URL)
        with self.assertRaises(HTTPError):
            h.redirect_request(req, None, 302, "Found", {}, "https://evil.example/x.exe")
        with self.assertRaises(HTTPError):
            h.redirect_request(req, None, 302, "Found", {}, "http://downloads.framedecks.com/x.exe")
        self.assertIsNotNone(h.redirect_request(req, None, 302, "Found", {}, "https://downloads.framedecks.com/y.exe"))

    def test_latest_never_installs_an_older_version(self):
        u = self.make(manifest("9.1"), {}, current="9.1.2")
        u.check()
        with self.assertRaises(ValueError):
            u.download("latest")

    def test_the_signer_must_be_exactly_the_publisher(self):
        u = updater.Updater(tempfile.mkdtemp(), "9.2", platform="win32")
        for name, ok in (("Shobin Mathews", True), ("Shobin Mathews Ltd", False), ("Not Shobin Mathews", False)):
            fake = types.SimpleNamespace(authenticode=lambda path, n=name: (True, n))
            with mock.patch.dict(sys.modules, {"winapi": fake}):
                self.assertEqual(u.signature_ok("x.exe"), ok, name)


class ReleaseTool(unittest.TestCase):
    def test_signing_key_rules(self):
        hexkey = SECRET.hex()
        with mock.patch.object(mrm, "trusted_keys", return_value={}):
            self.assertIsNone(mrm.signing_key({}), "no key needed yet")
            self.assertEqual(mrm.signing_key({"MANIFEST_SIGNING_KEY": hexkey}), SECRET)
        with mock.patch.object(mrm, "trusted_keys", return_value=TRUSTED):
            with self.assertRaises(SystemExit):
                mrm.signing_key({})                                  # the program trusts a key: the secret is required
            with self.assertRaises(SystemExit):
                mrm.signing_key({"MANIFEST_SIGNING_KEY": os.urandom(32).hex()})    # not the trusted key
            self.assertEqual(mrm.signing_key({"MANIFEST_SIGNING_KEY": hexkey}), SECRET)
        with self.assertRaises(SystemExit):
            mrm.signing_key({"MANIFEST_SIGNING_KEY": "nothex"})

    def test_reads_trusted_keys_from_the_program(self):
        self.assertEqual(mrm.trusted_keys(), updater.TRUSTED_KEYS)

    def test_published_manifests_are_signed(self):
        d = Path(tempfile.mkdtemp())
        v = mrm.app_version()                     # 26.11: the notes of this version (the older ones are archived)
        inst = d / f"FrameDecks v{v}.exe"
        inst.write_bytes(b"installer")
        m = mrm.build(inst, d / "out", v, "2026-11-04", None, False, key=SECRET)
        for f in (d / "out" / "releases" / "latest.json", d / "out" / "releases" / v / "manifest.json"):
            self.assertTrue(manifest_sig.verify(json.loads(f.read_text()), TRUSTED), f.name)
        self.assertEqual(m["signature"]["key"], next(iter(TRUSTED)))

    def test_the_key_tool(self):
        d = Path(tempfile.mkdtemp())
        f = d / "k.txt"
        manifest_key.main(["new", "--out", str(f)])
        secret = bytes.fromhex(f.read_text().strip())
        line = manifest_key.trusted_line(secret)
        self.assertIn(manifest_sig.key_id(ed25519.public_key(secret)), line)
        with self.assertRaises(SystemExit):
            manifest_key.main(["new", "--out", str(f)])              # never overwrites a key
        self.assertIn("framedecks-manifest-key", (ROOT / ".gitignore").read_text(), "the private key is never committed")


class Workflow(unittest.TestCase):
    def setUp(self):
        self.text = (ROOT / ".github" / "workflows" / "build-windows.yml").read_text(encoding="utf-8")

    def test_release_guards(self):
        self.assertIn("git merge-base --is-ancestor $env:GITHUB_SHA origin/main", self.text, "tags must be on main")
        self.assertIn("steps.sigcheck.outcome == 'success'", self.text, "signed comes from the signature check")
        self.assertNotIn("RELEASE_SIGNED", self.text)
        self.assertIn("MANIFEST_SIGNING_KEY: ${{ secrets.MANIFEST_SIGNING_KEY }}", self.text)

    def test_no_untrusted_text_inside_scripts_and_pinned_runners(self):
        for line in self.text.splitlines():
            if "${{ github.ref_name }}" in line:
                self.assertRegex(line.strip(), r"^[A-Z_]+: \$\{\{ github\.ref_name \}\}$", "only through env: " + line)
        self.assertNotIn("runs-on: windows-latest", self.text)
        self.assertNotIn("runs-on: ubuntu-latest", self.text)


if __name__ == "__main__":
    unittest.main()
