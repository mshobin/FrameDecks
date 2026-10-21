"""FrameDecks - the keys of a paired device (SaaS Phase 4; docs/architecture/pairing-protocol.md §1, §4).

X25519 at pairing, HKDF-SHA256 for the device's AES-256-GCM key and the six check digits, and sealing of relay
messages, so the cloud relay carries only ciphertext. Uses the `cryptography` package (part of the installed app);
without it, pairing says it needs the installed app and nothing else changes.
"""
import base64
import json
import os

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    AVAILABLE = True
except ImportError:                                    # the script version without the package: no pairing
    AVAILABLE = False

RELAY_INFO = b"framedecks-relay-v1"
CHECK_INFO = b"framedecks-pair-check"


def b64u(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def unb64u(text):
    text = str(text)
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def new_keypair():
    """-> (private key, public key as base64url). The private key lives only until the pairing ends."""
    priv = X25519PrivateKey.generate()
    pub = priv.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return priv, b64u(pub)


def _hkdf(shared, salt, info, n):
    return HKDF(algorithm=hashes.SHA256(), length=n, salt=salt, info=info).derive(shared)


def derive(priv, peer_pub, pairing_id):
    """-> (32-byte relay key, "482 163"): the same on the phone and the PC."""
    shared = priv.exchange(X25519PublicKey.from_public_bytes(unb64u(peer_pub)))
    salt = str(pairing_id).encode("utf-8")
    key = _hkdf(shared, salt, RELAY_INFO, 32)
    n = int.from_bytes(_hkdf(shared, salt, CHECK_INFO, 4), "big") % 1000000
    digits = f"{n:06d}"
    return key, digits[:3] + " " + digits[3:]


def aad(direction, device_id):
    return f"framedecks-relay-v1|{direction}|{device_id}".encode("utf-8")


def seal(key, direction, device_id, obj):
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(obj, separators=(",", ":")).encode("utf-8"), aad(direction, device_id))
    return {"iv": b64u(iv), "ct": b64u(ct)}


def open_sealed(key, direction, device_id, sealed):
    """-> the message, or raises ValueError (wrong key, tampered, or not for this device and direction)."""
    try:
        pt = AESGCM(key).decrypt(unb64u(sealed["iv"]), unb64u(sealed["ct"]), aad(direction, device_id))
        return json.loads(pt.decode("utf-8"))
    except Exception as e:                             # InvalidTag, bad base64, bad JSON: all the same to the caller
        raise ValueError("A message could not be opened.") from e
