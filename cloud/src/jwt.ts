// JSON Web Tokens with WebCrypto: FrameDecks access tokens (ES256, our key), and the ID tokens of the sign-in
// providers (RS256 or ES256, their published keys). docs/architecture/cloud-api.md §1.
import { b64url, fromB64url, utf8 } from "./crypto";
import type { Env } from "./env";
import { HttpError } from "./http";

export const ISSUER = "framedecks";
export const AUDIENCE = "framedecks-api";
export const ACCESS_TTL_MS = 10 * 60 * 1000;

export interface AccessClaims {
  sub: string;                // the user id, or the runtime id
  typ: "user" | "runtime";
  uid: string;                // the user
  ws: string;                 // the workspace
  role: string;               // the user's role in it
  jti: string;
  iat: number;                // seconds
  exp: number;
  iss?: string;
  aud?: string;
}

type Jwk = JsonWebKey & { kid?: string; alg?: string };

const ES256 = { name: "ECDSA", namedCurve: "P-256" } as const;
const ES256_SIGN = { name: "ECDSA", hash: "SHA-256" } as const;
const RS256 = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

function encodePart(v: unknown): string {
  return b64url(utf8(JSON.stringify(v)));
}

export function decodePart<T = Record<string, unknown>>(part: string): T {
  return JSON.parse(new TextDecoder().decode(fromB64url(part))) as T;
}

/** Signs a JWT with an ECDSA P-256 key (ES256). */
export async function signEs256(header: Record<string, unknown>, claims: Record<string, unknown>, key: CryptoKey): Promise<string> {
  const input = `${encodePart({ alg: "ES256", typ: "JWT", ...header })}.${encodePart(claims)}`;
  const sig = await crypto.subtle.sign(ES256_SIGN, key, utf8(input));      // raw r||s, as JWS wants
  return `${input}.${b64url(sig)}`;
}

/** Checks a JWT's signature against one public key; returns header and claims (the caller checks the claims). */
export async function verifySignature(token: string, jwk: Jwk): Promise<{ header: Record<string, unknown>; claims: Record<string, unknown> }> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("not a JWT");
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  const alg = header.alg;
  let ok = false;
  if (alg === "ES256" && jwk.kty === "EC") {
    const key = await crypto.subtle.importKey("jwk", { ...jwk, key_ops: ["verify"], ext: true }, ES256, false, ["verify"]);
    ok = await crypto.subtle.verify(ES256_SIGN, key, fromB64url(parts[2]), utf8(`${parts[0]}.${parts[1]}`));
  } else if (alg === "RS256" && jwk.kty === "RSA") {
    const key = await crypto.subtle.importKey("jwk", { ...jwk, alg: "RS256", key_ops: ["verify"], ext: true }, RS256, false, ["verify"]);
    ok = await crypto.subtle.verify(RS256, key, fromB64url(parts[2]), utf8(`${parts[0]}.${parts[1]}`));
  } else {
    throw new Error(`unsupported algorithm ${String(alg)}`);
  }
  if (!ok) throw new Error("bad signature");
  return { header, claims };
}

// ---------- our own keys ----------

interface OurKeys { kid: string; privateKey: CryptoKey; publicJwk: Jwk }
let cached: { source: string; keys: OurKeys } | null = null;

async function ourKeys(env: Env): Promise<OurKeys> {
  if (!env.JWT_PRIVATE_KEY) throw new HttpError(503, "not_configured", "Sign-in is not set up on this server yet.");
  if (cached && cached.source === env.JWT_PRIVATE_KEY + (env.JWT_KID || "")) return cached.keys;
  const jwk = JSON.parse(env.JWT_PRIVATE_KEY) as Jwk;
  const kid = env.JWT_KID || jwk.kid || "k1";
  const privateKey = await crypto.subtle.importKey("jwk", { ...jwk, key_ops: ["sign"], ext: true }, ES256, false, ["sign"]);
  const { d: _d, key_ops: _o, ext: _e, ...pub } = jwk;
  const keys = { kid, privateKey, publicJwk: { ...pub, kid, alg: "ES256", use: "sig" } as Jwk };
  cached = { source: env.JWT_PRIVATE_KEY + (env.JWT_KID || ""), keys };
  return keys;
}

/** GET /v1/.well-known/jwks.json */
export async function jwks(env: Env): Promise<{ keys: Jwk[] }> {
  if (!env.JWT_PRIVATE_KEY) return { keys: [] };
  return { keys: [(await ourKeys(env)).publicJwk] };
}

export async function signAccess(env: Env, claims: Omit<AccessClaims, "iat" | "exp" | "iss" | "aud">, now = Date.now(), ttl = ACCESS_TTL_MS): Promise<{ token: string; expiresAt: number }> {
  const k = await ourKeys(env);
  const iat = Math.floor(now / 1000);
  const exp = Math.floor((now + ttl) / 1000);
  const token = await signEs256({ kid: k.kid }, { ...claims, iss: ISSUER, aud: AUDIENCE, iat, exp }, k.privateKey);
  return { token, expiresAt: exp * 1000 };
}

/** The claims of a valid FrameDecks access token, or a 401. */
export async function verifyAccess(env: Env, token: string, now = Date.now()): Promise<AccessClaims> {
  const unauthorized = new HttpError(401, "unauthorized", "Please sign in again.");
  let k: OurKeys;
  try {
    k = await ourKeys(env);
  } catch {
    throw unauthorized;
  }
  try {
    const { header, claims } = await verifySignature(token, k.publicJwk);
    if (header.kid !== k.kid || header.alg !== "ES256") throw new Error("key");
    const c = claims as unknown as AccessClaims;
    if (c.iss !== ISSUER || c.aud !== AUDIENCE) throw new Error("issuer");
    if (typeof c.exp !== "number" || c.exp * 1000 <= now) throw new Error("expired");
    if ((c.typ !== "user" && c.typ !== "runtime") || !c.sub || !c.uid || !c.ws) throw new Error("claims");
    return c;
  } catch {
    throw unauthorized;
  }
}

/** Imports a PKCS#8 PEM ECDSA P-256 private key (Apple's .p8). */
export async function importPemEs256(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, ES256, false, ["sign"]);
}

// ---------- relay tickets (docs/architecture/relay-protocol.md §1) ----------

/** Tickets carry their own audience, so a ticket is never an access token and an access token never a ticket. */
export const TICKET_AUDIENCE = "framedecks-relay";
export const TICKET_TTL_S = 60;

export interface TicketClaims {
  sub: string;                // the user id (a device) or the runtime id
  role: "runtime" | "device";
  rid: string;                // the runtime this socket is for
  jti: string;
  exp: number;                // seconds
}

export async function signTicket(env: Env, claims: Omit<TicketClaims, "exp">, now = Date.now(), ttlS = TICKET_TTL_S): Promise<string> {
  const k = await ourKeys(env);
  const iat = Math.floor(now / 1000);
  return signEs256({ kid: k.kid }, { ...claims, iss: ISSUER, aud: TICKET_AUDIENCE, iat, exp: iat + ttlS }, k.privateKey);
}

/** The claims of a valid, unexpired ticket for `rid`, or null. (Whether its jti was used is the relay's to know.) */
export async function verifyTicket(env: Env, token: string, rid: string, now = Date.now()): Promise<TicketClaims | null> {
  try {
    const k = await ourKeys(env);
    const { header, claims } = await verifySignature(token, k.publicJwk);
    if (header.kid !== k.kid || header.alg !== "ES256") return null;
    const c = claims as unknown as TicketClaims & { iss?: string; aud?: string };
    if (c.iss !== ISSUER || c.aud !== TICKET_AUDIENCE) return null;
    if (typeof c.exp !== "number" || c.exp * 1000 <= now) return null;
    if (c.role !== "runtime" && c.role !== "device") return null;
    if (typeof c.sub !== "string" || !c.sub || typeof c.jti !== "string" || !c.jti || c.rid !== rid) return null;
    if (c.role === "runtime" && c.sub !== rid) return null;
    return { sub: c.sub, role: c.role, rid: c.rid, jti: c.jti, exp: c.exp };
  } catch {
    return null;
  }
}
