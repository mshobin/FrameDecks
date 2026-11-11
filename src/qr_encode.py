"""FrameDecks 26.11.44 - a small QR code encoder (ISO/IEC 18004), written for the members' phones link.

Byte mode, medium error correction (a phone still reads it when a video call softens the picture), versions 1 to 10
(up to 213 bytes; a members' phones link is about 40). The mask with the lowest penalty is chosen, as the standard
describes. Pure Python with no dependencies, so the vCam and the server draw the same code; tests/test_join_qr_2611_44.py
decodes what it makes with OpenCV when it is installed."""

# error correction codewords per block and number of blocks, medium level, by version (index 0 unused)
ECC_PER_BLOCK = (0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26)
NUM_BLOCKS = (0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5)
MAX_VERSION = 10
FORMAT_M = 0                       # the two error correction level bits for "medium"


def _gf_mul(a, b):
    """Multiply in GF(2^8) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1."""
    r = 0
    while b:
        if b & 1:
            r ^= a
        b >>= 1
        a <<= 1
        if a & 0x100:
            a ^= 0x11D
    return r


def _rs_divisor(degree):
    """The Reed-Solomon generator polynomial's coefficients (highest first, leading 1 left out)."""
    out = [0] * (degree - 1) + [1]
    root = 1
    for _ in range(degree):
        for j in range(degree):
            out[j] = _gf_mul(out[j], root)
            if j + 1 < degree:
                out[j] ^= out[j + 1]
        root = _gf_mul(root, 2)
    return out


def _rs_remainder(data, divisor):
    out = [0] * len(divisor)
    for b in data:
        factor = b ^ out.pop(0)
        out.append(0)
        for i, coef in enumerate(divisor):
            out[i] ^= _gf_mul(coef, factor)
    return out


def _raw_modules(ver):
    """How many modules carry data (everything but the function patterns and format/version bits)."""
    n = (16 * ver + 128) * ver + 64
    if ver >= 2:
        k = ver // 7 + 2
        n -= (25 * k - 10) * k - 55
        if ver >= 7:
            n -= 36
    return n


def _data_codewords(ver):
    return _raw_modules(ver) // 8 - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver]


def _align_positions(ver, size):
    if ver == 1:
        return []
    k = ver // 7 + 2
    step = (ver * 8 + k * 3 + 5) // (k * 4 - 4) * 2
    return [6] + sorted(size - 7 - i * step for i in range(k - 1))


class _Grid:
    def __init__(self, ver):
        self.ver, self.size = ver, ver * 4 + 17
        self.dark = [[False] * self.size for _ in range(self.size)]
        self.func = [[False] * self.size for _ in range(self.size)]

    def put(self, x, y, on):
        self.dark[y][x] = bool(on)
        self.func[y][x] = True

    def patterns(self):
        n = self.size
        for i in range(n):                                   # timing lines
            self.put(6, i, i % 2 == 0)
            self.put(i, 6, i % 2 == 0)
        for cx, cy in ((3, 3), (n - 4, 3), (3, n - 4)):      # finders with their white separators
            for dy in range(-4, 5):
                for dx in range(-4, 5):
                    x, y = cx + dx, cy + dy
                    if 0 <= x < n and 0 <= y < n:
                        self.put(x, y, max(abs(dx), abs(dy)) not in (2, 4))
        pos = _align_positions(self.ver, n)
        last = len(pos) - 1
        for i, ay in enumerate(pos):
            for j, ax in enumerate(pos):
                if (i, j) in ((0, 0), (0, last), (last, 0)):
                    continue                                 # under a finder
                for dy in range(-2, 3):
                    for dx in range(-2, 3):
                        self.put(ax + dx, ay + dy, max(abs(dx), abs(dy)) != 1)
        self.format_bits(0)                                  # reserves the format areas (redrawn with the mask)
        if self.ver >= 7:
            rem = self.ver
            for _ in range(12):
                rem = (rem << 1) ^ ((rem >> 11) * 0x1F25)
            bits = self.ver << 12 | rem
            for i in range(18):
                on = (bits >> i) & 1
                a, b = n - 11 + i % 3, i // 3
                self.put(a, b, on)
                self.put(b, a, on)

    def format_bits(self, mask):
        n = self.size
        data = FORMAT_M << 3 | mask
        rem = data
        for _ in range(10):
            rem = (rem << 1) ^ ((rem >> 9) * 0x537)
        bits = (data << 10 | rem) ^ 0x5412

        def bit(i):
            return (bits >> i) & 1
        for i in range(6):
            self.put(8, i, bit(i))
        self.put(8, 7, bit(6))
        self.put(8, 8, bit(7))
        self.put(7, 8, bit(8))
        for i in range(9, 15):
            self.put(14 - i, 8, bit(i))
        for i in range(8):
            self.put(n - 1 - i, 8, bit(i))
        for i in range(8, 15):
            self.put(8, n - 15 + i, bit(i))
        self.put(8, n - 8, True)                             # the dark module

    def codewords(self, words):
        n, i, total = self.size, 0, len(words) * 8
        right = n - 1
        while right >= 1:
            if right == 6:
                right = 5
            up = ((right + 1) & 2) == 0
            for vert in range(n):
                y = n - 1 - vert if up else vert
                for x in (right, right - 1):
                    if not self.func[y][x] and i < total:
                        self.dark[y][x] = bool((words[i >> 3] >> (7 - (i & 7))) & 1)
                        i += 1
            right -= 2


MASKS = (
    lambda x, y: (x + y) % 2 == 0,
    lambda x, y: y % 2 == 0,
    lambda x, y: x % 3 == 0,
    lambda x, y: (x + y) % 3 == 0,
    lambda x, y: (x // 3 + y // 2) % 2 == 0,
    lambda x, y: x * y % 2 + x * y % 3 == 0,
    lambda x, y: (x * y % 2 + x * y % 3) % 2 == 0,
    lambda x, y: ((x + y) % 2 + x * y % 3) % 2 == 0,
)


def _masked(grid, mask):
    f = MASKS[mask]
    return [[grid.dark[y][x] != (not grid.func[y][x] and f(x, y)) for x in range(grid.size)] for y in range(grid.size)]


def _penalty(m):
    n = len(m)
    score = 0
    lines = m + [list(col) for col in zip(*m)]
    for line in lines:                                       # rule 1: runs of five or more alike
        run, prev = 0, None
        for v in line:
            if v == prev:
                run += 1
            else:
                if run >= 5:
                    score += run - 2
                run, prev = 1, v
        if run >= 5:
            score += run - 2
        s = "".join("1" if v else "0" for v in line)       # rule 3: finder-like 1:1:3:1:1 with four light beside it
        for pat in ("10111010000", "00001011101"):
            start = s.find(pat)
            while start != -1:
                score += 40
                start = s.find(pat, start + 1)
    for y in range(n - 1):                                   # rule 2: 2x2 blocks alike
        for x in range(n - 1):
            if m[y][x] == m[y][x + 1] == m[y + 1][x] == m[y + 1][x + 1]:
                score += 3
    dark, total = sum(map(sum, m)), n * n                    # rule 4: how far from half dark
    score += ((abs(dark * 20 - total * 10) + total - 1) // total - 1) * 10
    return score


def encode(text):
    """The QR code for this text (UTF-8, byte mode, medium correction) as rows of booleans (True = dark), without the
    quiet zone. Raises ValueError when it is too long for version 10."""
    data = text.encode("utf-8")
    ver = next((v for v in range(1, MAX_VERSION + 1) if 4 + (8 if v < 10 else 16) + 8 * len(data) <= _data_codewords(v) * 8), 0)
    if not ver:
        raise ValueError("Too long for a QR code here")
    cap = _data_codewords(ver) * 8
    bits = [0, 1, 0, 0]                                      # byte mode
    count_bits = 8 if ver < 10 else 16
    bits += [(len(data) >> i) & 1 for i in range(count_bits - 1, -1, -1)]
    for b in data:
        bits += [(b >> i) & 1 for i in range(7, -1, -1)]
    bits += [0] * min(4, cap - len(bits))                    # terminator
    bits += [0] * (-len(bits) % 8)
    words = [int("".join(map(str, bits[i:i + 8])), 2) for i in range(0, len(bits), 8)]
    pad = 0xEC
    while len(words) < cap // 8:
        words.append(pad)
        pad ^= 0xEC ^ 0x11
    # split into blocks (short blocks first), add each block's error correction, interleave
    nb, ecl = NUM_BLOCKS[ver], ECC_PER_BLOCK[ver]
    raw = _raw_modules(ver) // 8
    short = nb - raw % nb
    short_len = raw // nb - ecl
    divisor = _rs_divisor(ecl)
    blocks, k = [], 0
    for i in range(nb):
        size = short_len + (0 if i < short else 1)
        part = words[k:k + size]
        k += size
        blocks.append((part, _rs_remainder(part, divisor)))
    out = [blk[0][i] for i in range(short_len + 1) for blk in blocks if i < len(blk[0])]
    out += [blk[1][i] for i in range(ecl) for blk in blocks]
    grid = _Grid(ver)
    grid.patterns()
    grid.codewords(out)
    best = None
    for mask in range(8):
        grid.format_bits(mask)
        m = _masked(grid, mask)
        p = _penalty(m)
        if best is None or p < best[0]:
            best = (p, m)
    return tuple(tuple(row) for row in best[1])
