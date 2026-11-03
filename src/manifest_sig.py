"""FrameDecks 9.2 - the release manifest's signature (production audit H3).

The release workflow signs each manifest it publishes (tools/make_release_manifest.py, with the MANIFEST_SIGNING_KEY
secret); the program trusts a manifest only when one of the public keys built into it (updater.TRUSTED_KEYS) signed it.
So whoever can write to the download bucket cannot hand the program another installer, another checksum, or a
"signed": false that skips the Authenticode check.

The signature is a field of the manifest, so programs before 9.2 read the same file as before:

    "signature": {"alg": "ed25519", "key": "<key id>", "sig": "<base64 signature>"}

It covers every other field, written in one fixed way (keys sorted, no spaces, non-ASCII escaped), after a fixed
prefix that keeps it from ever meaning anything else.
"""
import base64
import hashlib
import json

import ed25519

PREFIX = b"FrameDecks release manifest v1\n"


def canonical(manifest):
    """The bytes a manifest's signature covers: every field but "signature", in one fixed form."""
    body = {k: v for k, v in manifest.items() if k != "signature"}
    return PREFIX + json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def key_id(public):
    """A short name for a public key (the first 16 hex digits of its SHA-256)."""
    return hashlib.sha256(public).hexdigest()[:16]


def sign(manifest, secret):
    """The manifest with its signature (a new dict)."""
    public = ed25519.public_key(secret)
    sig = ed25519.sign(secret, canonical(manifest))
    out = {k: v for k, v in manifest.items() if k != "signature"}
    out["signature"] = {"alg": "ed25519", "key": key_id(public), "sig": base64.b64encode(sig).decode("ascii")}
    return out


def verify(manifest, trusted):
    """True when one of the trusted public keys ({key id: 32-byte hex}) signed this manifest. Never raises."""
    try:
        s = manifest.get("signature")
        if not isinstance(s, dict) or s.get("alg") != "ed25519":
            return False
        pub_hex = trusted.get(str(s.get("key") or ""))
        if not pub_hex:
            return False
        public = bytes.fromhex(pub_hex)
        if key_id(public) != s["key"]:
            return False
        sig = base64.b64decode(str(s.get("sig") or ""), validate=True)
        return ed25519.verify(public, canonical(manifest), sig)
    except Exception:
        return False
