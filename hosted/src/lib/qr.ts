// FrameDecks 26.11.12 - a small QR code encoder for the website's Scan to join codes (a short https address).
// Byte mode, error correction level M, versions 1-10 (up to 213 bytes): all a join address needs, in a fraction of
// the size of a general library, so pages stay within the JavaScript budget. Loaded with import() only by the pages
// that show a QR code. The output is checked module for module against the program's encoder (app/vendor/qrcode.js,
// qrcode-generator by Kazuhiko Arase, MIT) in tests/scan-to-join.test.mjs. The algorithm follows ISO/IEC 18004.
// Self-contained, with no imports.

// Level M, versions 1-10: error correction codewords per block, and the number of blocks
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;

function rawModules(ver: number): number {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

function dataCodewords(ver: number): number {
  return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * BLOCKS[ver];
}

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

// Reed-Solomon over GF(256), polynomial 0x11D
function mul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function divisor(degree: number): number[] {
  const out = new Array<number>(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      out[j] = mul(out[j], root);
      if (j + 1 < degree) out[j] ^= out[j + 1];
    }
    root = mul(root, 0x02);
  }
  return out;
}

function remainder(data: number[], div: number[]): number[] {
  const out = new Array<number>(div.length).fill(0);
  for (const b of data) {
    const factor = b ^ (out.shift() as number);
    out.push(0);
    div.forEach((coef, i) => (out[i] ^= mul(coef, factor)));
  }
  return out;
}

/** The smallest version that holds `bytes` bytes, or 0 when none up to 10 does. */
export function versionFor(bytes: number): number {
  for (let v = 1; v <= MAX_VERSION; v++) {
    const countBits = v < 10 ? 8 : 16;
    if (4 + countBits + bytes * 8 <= dataCodewords(v) * 8) return v;
  }
  return 0;
}

function codewords(bytes: number[], ver: number): number[] {
  const bits: number[] = [];
  const put = (value: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const capacity = dataCodewords(ver) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // split into blocks, add error correction, interleave
  const blocks = BLOCKS[ver];
  const ecc = ECC_PER_BLOCK[ver];
  const total = Math.floor(rawModules(ver) / 8);
  const shortBlocks = blocks - (total % blocks);
  const shortLen = Math.floor(total / blocks) - ecc;
  const div = divisor(ecc);
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const len = shortLen + (i < shortBlocks ? 0 : 1);
    const part = data.slice(k, k + len);
    k += len;
    dataBlocks.push(part);
    eccBlocks.push(remainder(part, div));
  }
  const out: number[] = [];
  for (let i = 0; i <= shortLen; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecc; i++) for (const b of eccBlocks) out.push(b[i]);
  return out;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function build(ver: number, words: number[], mask: number): boolean[][] {
  const size = ver * 4 + 17;
  const dark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, on: boolean) => {
    dark[y][x] = on;
    fixed[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
  }
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const pos = [6];
    for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    pos.forEach((ax, i) =>
      pos.forEach((ay, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }),
    );
  }
  // format bits (level M = 0b00), with the mask
  const fdata = mask;
  let rem = fdata;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fbits = ((fdata << 10) | rem) ^ 0x5412;
  const bit = (v: number, i: number) => ((v >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(fbits, i));
  set(8, 7, bit(fbits, 6));
  set(8, 8, bit(fbits, 7));
  set(7, 8, bit(fbits, 8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(fbits, i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(fbits, i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(fbits, i));
  set(8, size - 8, true);
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const vbits = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, bit(vbits, i));
      set(b, a, bit(vbits, i));
    }
  }
  // the data, in the zigzag order, masked
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (fixed[y][x]) continue;
        const on = i < words.length * 8 && bit(words[i >>> 3], 7 - (i & 7));
        i++;
        dark[y][x] = on !== MASKS[mask](x, y);
      }
  }
  return dark;
}

/** How hard a pattern is to scan (the standard's four penalty rules, simplified); the lowest wins. */
function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  let darkCount = 0;
  const lines: string[] = [];
  for (let y = 0; y < n; y++) {
    let row = "", col = "";
    for (let x = 0; x < n; x++) {
      row += m[y][x] ? "1" : "0";
      col += m[x][y] ? "1" : "0";
      if (m[y][x]) darkCount++;
      if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    }
    lines.push(row, col);
  }
  for (const line of lines) {
    for (const run of line.match(/0{5,}|1{5,}/g) ?? []) score += run.length - 2;
    score += 40 * (line.match(/(?=(10111010000|00001011101))/g)?.length ?? 0);
  }
  score += Math.floor(Math.abs((darkCount * 20) / (n * n) - 10)) * 10;
  return score;
}

/** The QR code for `text` as rows of dark (true) and light modules, without the quiet zone. `mask` and `version` are
 * for the tests; normally the best mask and the smallest version are chosen. */
export function qrMatrix(text: string, opts: { mask?: number; version?: number } = {}): boolean[][] {
  const bytes = utf8(text);
  const ver = opts.version ?? versionFor(bytes.length);
  if (!ver || versionFor(bytes.length) === 0 || ver < versionFor(bytes.length)) throw new Error("Too long for a QR code here");
  const words = codewords(bytes, ver);
  if (opts.mask !== undefined) return build(ver, words, opts.mask);
  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = build(ver, words, mask);
    const s = penalty(m);
    if (s < bestScore) [best, bestScore] = [m, s];
  }
  return best as boolean[][];
}

/** One SVG path for the dark modules, offset by a quiet zone of `margin` modules. */
export function qrPath(matrix: boolean[][], margin = 4): string {
  let d = "";
  matrix.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x + margin} ${y + margin}h1v1h-1z`;
    }),
  );
  return d;
}
