// Sign in with Google, Microsoft and Apple (OpenID Connect, authorization code + PKCE + nonce).
// docs/architecture/cloud-api.md §2. Only providers whose secrets are set are offered.
import { b64url, randomToken, utf8 } from "../crypto";
import type { Env } from "../env";
import { HttpError } from "../http";
import { decodePart, importPemEs256, signEs256, verifySignature } from "../jwt";
import type { IdentityIn } from "./accounts";

export type ProviderName = "google" | "microsoft" | "apple";

interface Provider {
  name: ProviderName;
  label: string;
  authorize: string;
  token: string;
  jwks: string;
  scope: string;
  issuer: (claims: Record<string, unknown>) => boolean;
  clientId: (env: Env) => string | undefined;
  configured: (env: Env) => boolean;
  extraAuthorize?: Record<string, string>;
}

const MICROSOFT_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";

export const PROVIDERS: Record<ProviderName, Provider> = {
  google: {
    name: "google", label: "Google",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    jwks: "https://www.googleapis.com/oauth2/v3/certs",
    scope: "openid email profile",
    issuer: (c) => c.iss === "https://accounts.google.com" || c.iss === "accounts.google.com",
    clientId: (env) => env.GOOGLE_CLIENT_ID,
    configured: (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    extraAuthorize: { prompt: "select_account" },
  },
  microsoft: {
    name: "microsoft", label: "Microsoft",
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    jwks: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
    scope: "openid email profile",
    issuer: (c) => typeof c.tid === "string" && c.iss === `https://login.microsoftonline.com/${c.tid}/v2.0`,
    clientId: (env) => env.MICROSOFT_CLIENT_ID,
    configured: (env) => !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
    extraAuthorize: { prompt: "select_account" },
  },
  apple: {
    name: "apple", label: "Apple",
    authorize: "https://appleid.apple.com/auth/authorize",
    token: "https://appleid.apple.com/auth/token",
    jwks: "https://appleid.apple.com/auth/keys",
    scope: "name email",
    issuer: (c) => c.iss === "https://appleid.apple.com",
    clientId: (env) => env.APPLE_CLIENT_ID,
    configured: (env) => !!(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY),
    extraAuthorize: { response_mode: "form_post" },     // Apple sends the code (and the name, once) as a form post
  },
};

export const isProvider = (p: string): p is ProviderName => p in PROVIDERS;

export const configuredProviders = (env: Env): ProviderName[] =>
  (Object.keys(PROVIDERS) as ProviderName[]).filter((p) => PROVIDERS[p].configured(env));

export const redirectUri = (origin: string, p: ProviderName): string => `${origin}/v1/auth/oidc/${p}/callback`;

/** Starts a provider sign-in: the address to send the person to, and what to remember until the callback. */
export async function begin(env: Env, p: ProviderName, origin: string): Promise<{ url: string; state: string; verifier: string; nonce: string }> {
  const pr = PROVIDERS[p];
  if (!pr.configured(env)) throw new HttpError(404, "provider_not_configured", `${pr.label} sign-in is not set up on this server.`);
  const state = randomToken();
  const verifier = randomToken();
  const nonce = randomToken();
  const challenge = b64url(await crypto.subtle.digest("SHA-256", utf8(verifier)));
  const q = new URLSearchParams({
    client_id: pr.clientId(env) || "",
    redirect_uri: redirectUri(origin, p),
    response_type: "code",
    scope: pr.scope,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(pr.extraAuthorize || {}),
  });
  return { url: `${pr.authorize}?${q}`, state, verifier, nonce };
}

/** Apple's client secret is a short-lived ES256 JWT signed with the team's key. */
async function clientSecret(env: Env, p: ProviderName): Promise<string> {
  if (p === "google") return env.GOOGLE_CLIENT_SECRET || "";
  if (p === "microsoft") return env.MICROSOFT_CLIENT_SECRET || "";
  const key = await importPemEs256(env.APPLE_PRIVATE_KEY || "");
  const now = Math.floor(Date.now() / 1000);
  return signEs256({ kid: env.APPLE_KEY_ID }, { iss: env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: env.APPLE_CLIENT_ID }, key);
}

/** Swaps the code for the provider's ID token and checks it; returns who signed in. */
export async function finish(env: Env, p: ProviderName, code: string, verifier: string, nonce: string, origin: string, appleUser?: string): Promise<IdentityIn> {
  const pr = PROVIDERS[p];
  const failed = (why: string) => new HttpError(400, "sign_in_failed", `${pr.label} sign-in did not work (${why}). Please try again.`);
  const res = await fetch(pr.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: redirectUri(origin, p),
      client_id: pr.clientId(env) || "", client_secret: await clientSecret(env, p), code_verifier: verifier,
    }),
  });
  if (!res.ok) throw failed("the code was not accepted");
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw failed("no ID token");
  const claims = await verifyIdToken(pr, body.id_token, env);
  if (claims.nonce !== nonce) throw failed("the answer does not match this sign-in");
  const email = typeof claims.email === "string" ? claims.email : "";
  if (!email) throw failed("no email address was shared");
  let verified = claims.email_verified === true || claims.email_verified === "true";
  let subject = String(claims.sub || "");
  if (p === "microsoft") {
    // Microsoft does not say email_verified. Personal accounts' addresses are verified; a work or school address is
    // trusted only when Microsoft says the domain owner verified it (xms_edov). Never link on anything else.
    verified = claims.tid === MICROSOFT_CONSUMER_TENANT || claims.xms_edov === true || claims.xms_edov === "1";
    subject = `${String(claims.tid)}:${String(claims.oid || claims.sub)}`;
  }
  if (!subject) throw failed("no account id");
  if (p !== "microsoft" && !verified) throw failed("the email address is not verified");
  let name = typeof claims.name === "string" ? claims.name : "";
  if (p === "apple" && appleUser) {
    try {
      const u = JSON.parse(appleUser) as { name?: { firstName?: string; lastName?: string } };
      name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(" ");
    } catch {
      // the name is optional
    }
  }
  return { provider: p, subject, email, name, linkByEmail: verified };
}

// ---------- the providers' signing keys (cached; fetched again once for an unknown key id) ----------

const keyCache = new Map<string, { at: number; keys: (JsonWebKey & { kid?: string })[] }>();
const KEYS_TTL_MS = 60 * 60 * 1000;

async function providerKeys(uri: string, force: boolean): Promise<(JsonWebKey & { kid?: string })[]> {
  const hit = keyCache.get(uri);
  if (hit && !force && Date.now() - hit.at < KEYS_TTL_MS) return hit.keys;
  const res = await fetch(uri, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new HttpError(502, "provider_unavailable", "The sign-in provider did not answer. Please try again.");
  const keys = ((await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] }).keys || [];
  keyCache.set(uri, { at: Date.now(), keys });
  return keys;
}

async function verifyIdToken(pr: Provider, token: string, env: Env): Promise<Record<string, unknown>> {
  const failed = (why: string) => new HttpError(400, "sign_in_failed", `${pr.label} sign-in did not work (${why}). Please try again.`);
  let header: Record<string, unknown>;
  try {
    header = decodePart(token.split(".")[0]);
  } catch {
    throw failed("an unreadable ID token");
  }
  let keys = await providerKeys(pr.jwks, false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await providerKeys(pr.jwks, true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw failed("an unknown signing key");
  let claims: Record<string, unknown>;
  try {
    claims = (await verifySignature(token, jwk)).claims;
  } catch {
    throw failed("a bad signature");
  }
  const now = Date.now() / 1000;
  const aud = claims.aud;
  const clientId = pr.clientId(env);
  if (!(aud === clientId || (Array.isArray(aud) && aud.includes(clientId)))) throw failed("the token is for another app");
  if (!pr.issuer(claims)) throw failed("an unexpected issuer");
  if (typeof claims.exp !== "number" || claims.exp + 60 < now) throw failed("an expired token");
  if (typeof claims.iat === "number" && claims.iat - 300 > now) throw failed("a token from the future");
  return claims;
}

/** For tests: forget the cached provider keys. */
export const clearProviderKeys = (): void => keyCache.clear();
