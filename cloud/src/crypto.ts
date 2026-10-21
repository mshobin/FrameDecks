// Random ids, base64url and hashing (WebCrypto only).

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const c of b) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const t = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** A random 128-bit id with a short prefix: "u_…", "w_…", "r_…". */
export const randomId = (prefix: string): string => `${prefix}_${b64url(randomBytes(16))}`;

/** A random token: 32 bytes, base64url. */
export const randomToken = (): string => b64url(randomBytes(32));

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", utf8(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** A 6-digit code, uniform. */
export function sixDigits(): string {
  const n = new Uint32Array(1);
  do crypto.getRandomValues(n); while (n[0] >= 4294000000);   // 4294000000 is a multiple of 10^6: no bias
  return String(n[0] % 1000000).padStart(6, "0");
}

/** Compares two strings in constant time for their length. */
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
