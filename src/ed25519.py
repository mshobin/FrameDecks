"""FrameDecks 9.2 - Ed25519 signatures (RFC 8032), in pure Python.

The release manifest the updater reads is signed by the release workflow with a private key only it holds
(tools/manifest_key.py); the program checks the signature with the public key built into it (updater.TRUSTED_KEYS).
Standard library only, so the installer gains no dependency; a check takes a few milliseconds and runs once per update
check. Follows the reference code in RFC 8032 section 6; tests/test_update_chain.py checks it against the RFC's test
vectors and against the cryptography library.
"""
import hashlib

P = 2 ** 255 - 19
L = 2 ** 252 + 27742317777372353535851937790883648493           # the group order
D = -121665 * pow(121666, P - 2, P) % P
SQRT_M1 = pow(2, (P - 1) // 4, P)


def _sha512_int(data):
    return int.from_bytes(hashlib.sha512(data).digest(), "little")


# points in extended homogeneous coordinates (X, Y, Z, T) with x = X/Z, y = Y/Z, x*y = T/Z
def _add(a, b):
    A = (a[1] - a[0]) * (b[1] - b[0]) % P
    B = (a[1] + a[0]) * (b[1] + b[0]) % P
    C = 2 * a[3] * b[3] * D % P
    Dd = 2 * a[2] * b[2] % P
    E, F, G, H = B - A, Dd - C, Dd + C, B + A
    return (E * F % P, G * H % P, F * G % P, E * H % P)


def _mul(s, pt):
    q = (0, 1, 1, 0)                                              # the neutral element
    while s > 0:
        if s & 1:
            q = _add(q, pt)
        pt = _add(pt, pt)
        s >>= 1
    return q


def _equal(a, b):
    return (a[0] * b[2] - b[0] * a[2]) % P == 0 and (a[1] * b[2] - b[1] * a[2]) % P == 0


def _recover_x(y, sign):
    if y >= P:
        return None
    x2 = (y * y - 1) * pow(D * y * y + 1, P - 2, P)
    if x2 == 0:
        return None if sign else 0
    x = pow(x2, (P + 3) // 8, P)
    if (x * x - x2) % P != 0:
        x = x * SQRT_M1 % P
    if (x * x - x2) % P != 0:
        return None
    if (x & 1) != sign:
        x = P - x
    return x


_GY = 4 * pow(5, P - 2, P) % P
_GX = _recover_x(_GY, 0)
G = (_GX, _GY, 1, _GX * _GY % P)


def _compress(pt):
    zinv = pow(pt[2], P - 2, P)
    x, y = pt[0] * zinv % P, pt[1] * zinv % P
    return int.to_bytes(y | ((x & 1) << 255), 32, "little")


def _decompress(s):
    if len(s) != 32:
        return None
    y = int.from_bytes(s, "little")
    sign = y >> 255
    y &= (1 << 255) - 1
    x = _recover_x(y, sign)
    if x is None:
        return None
    return (x, y, 1, x * y % P)


def _expand(secret):
    if len(secret) != 32:
        raise ValueError("An Ed25519 private key is 32 bytes")
    h = hashlib.sha512(secret).digest()
    a = int.from_bytes(h[:32], "little")
    a &= (1 << 254) - 8
    a |= 1 << 254
    return a, h[32:]


def public_key(secret):
    """The 32-byte public key for a 32-byte private key (seed)."""
    a, _ = _expand(secret)
    return _compress(_mul(a, G))


def sign(secret, msg):
    """The 64-byte signature of msg."""
    a, prefix = _expand(secret)
    A = _compress(_mul(a, G))
    r = _sha512_int(prefix + msg) % L
    R = _compress(_mul(r, G))
    h = _sha512_int(R + A + msg) % L
    s = (r + h * a) % L
    return R + int.to_bytes(s, 32, "little")


def verify(public, msg, signature):
    """True only for a valid signature of msg by public (both bytes). Never raises."""
    try:
        if len(public) != 32 or len(signature) != 64:
            return False
        A = _decompress(public)
        if A is None:
            return False
        Rs = signature[:32]
        R = _decompress(Rs)
        if R is None:
            return False
        s = int.from_bytes(signature[32:], "little")
        if s >= L:
            return False
        h = _sha512_int(Rs + public + msg) % L
        return _equal(_mul(s, G), _add(R, _mul(h, A)))
    except Exception:
        return False
