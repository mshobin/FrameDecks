"""FrameDecks - a fixed pairing test vector from the PC's side (pairing_crypto.py), so the phone's WebCrypto code
(app/js/pair-crypto.js) is checked against it (tests/pair-crypto.test.js). Run: python tools/make_pairing_vector.py"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import pairing_crypto as P  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey  # noqa: E402

raw = lambda k: k.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
pub = lambda k: k.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
pc, phone = X25519PrivateKey.from_private_bytes(bytes(range(32))), X25519PrivateKey.from_private_bytes(bytes(range(32, 64)))
key, check = P.derive(pc, P.b64u(pub(phone)), "pr_test1")
sealed = P.seal(key, "res", "dev_test", {"n": 1, "status": 200, "body": "{\"rev\":5}"})
out = {"pairingId": "pr_test1", "device": "dev_test",
       "pc": {"d": P.b64u(raw(pc)), "x": P.b64u(pub(pc))}, "phone": {"d": P.b64u(raw(phone)), "x": P.b64u(pub(phone))},
       "key": P.b64u(key), "check": check, "sealedRes": sealed, "plainRes": {"n": 1, "status": 200, "body": "{\"rev\":5}"}}
(ROOT / "tests" / "fixtures" / "pairing-vector.json").write_text(json.dumps(out, indent=2) + "\n")
print("wrote tests/fixtures/pairing-vector.json", check)
