// The browser sign-in session with Google, Microsoft and Apple (cloud-api.md §2). The providers are played by a
// mocked fetch: their token endpoint answers with an ID token the test signs, their key endpoint with its key.
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearProviderKeys } from "../src/auth/oidc";
import type { Env } from "../src/env";
import { call, newEmail, newIp, post, RUNTIME, signIn } from "./helpers";

const b64u = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const part = (v: unknown) => b64u(new TextEncoder().encode(JSON.stringify(v)));

/** A provider: an RSA key, a key endpoint, a token endpoint that hands out an ID token with the given claims. */
async function provider(tokenUrl: string, jwksUrl: string, claims: (form: URLSearchParams) => Record<string, unknown>) {
  const kp = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["sign", "verify"])) as CryptoKeyPair;
  const kid = `kid-${Math.random().toString(36).slice(2)}`;
  const pub = { ...(await crypto.subtle.exportKey("jwk", kp.publicKey)), kid, alg: "RS256", use: "sig" };
  const forms: URLSearchParams[] = [];
  const real = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === jwksUrl) return new Response(JSON.stringify({ keys: [pub] }), { headers: { "Content-Type": "application/json" } });
    if (url === tokenUrl) {
      const form = new URLSearchParams(String(init?.body ?? ""));
      forms.push(form);
      const now = Math.floor(Date.now() / 1000);
      const input = `${part({ alg: "RS256", kid, typ: "JWT" })}.${part({ iat: now, exp: now + 600, ...claims(form) })}`;
      const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(input));
      return new Response(JSON.stringify({ id_token: `${input}.${b64u(sig)}`, access_token: "x" }), { headers: { "Content-Type": "application/json" } });
    }
    return real(input, init);
  });
  return { forms };
}

const GOOGLE: Partial<Env> = { GOOGLE_CLIENT_ID: "google-client", GOOGLE_CLIENT_SECRET: "google-secret" };
const MICROSOFT: Partial<Env> = { MICROSOFT_CLIENT_ID: "ms-client", MICROSOFT_CLIENT_SECRET: "ms-secret" };

async function appleEnv(): Promise<Partial<Env>> {
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const der = (await crypto.subtle.exportKey("pkcs8", kp.privateKey)) as ArrayBuffer;
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(der)))}\n-----END PRIVATE KEY-----`;
  return { APPLE_CLIENT_ID: "org.framedecks.web", APPLE_TEAM_ID: "TEAM123456", APPLE_KEY_ID: "KEY1234567", APPLE_PRIVATE_KEY: pem };
}

/** POST /auth/session, then off to the provider: returns the session and what the provider was sent. */
async function start(p: string, env: Partial<Env>) {
  const ip = newIp();
  const s = await post("/v1/auth/session", { client: RUNTIME }, { ip, env });
  expect(s.status).toBe(201);
  const go = await call(`/v1/auth/session/${s.body.id}/oidc/${p}`, { env });
  expect(go.status).toBe(302);
  const loc = new URL(go.headers.get("Location")!);
  return { session: s.body, loc, q: loc.searchParams, env, ip };
}

afterEach(() => {
  vi.restoreAllMocks();
  clearProviderKeys();
});

describe("providers", () => {
  it("lists only the providers whose secrets are set", async () => {
    expect((await call("/v1/auth/providers")).body).toEqual({ providers: [], email: true });
    expect((await call("/v1/auth/providers", { env: GOOGLE })).body.providers).toEqual(["google"]);
    const all = await call("/v1/auth/providers", { env: { ...GOOGLE, ...MICROSOFT, ...(await appleEnv()) } });
    expect(all.body.providers).toEqual(["google", "microsoft", "apple"]);
    expect((await call("/v1/auth/session/s_x/oidc/google")).status).toBe(410);       // an unknown session
  });
});

describe("the browser sign-in session", () => {
  it("Google: page, provider (PKCE + state + nonce), callback, then the runtime polls its session once", async () => {
    const email = newEmail();
    const env = GOOGLE;
    const s = await post("/v1/auth/session", { client: { ...RUNTIME, name: "Sanctuary PC" } }, { ip: newIp(), env });
    expect(s.body.url).toBe(`https://api.test/v1/auth/session/${s.body.id}`);
    expect(s.body.expiresAt).toBeGreaterThan(Date.now());
    expect((await post("/v1/auth/session/poll", { pollToken: s.body.pollToken })).status).toBe(202);
    const page = await call(`/v1/auth/session/${s.body.id}`, { env });
    expect(page.headers.get("Content-Type")).toContain("text/html");
    expect(page.headers.get("Content-Security-Policy")).toContain("form-action 'self'");
    expect(page.text).toContain("Continue with Google");
    expect(page.text).toContain("Email me a code");
    expect(page.text).not.toContain("Continue with Apple");

    const go = await call(`/v1/auth/session/${s.body.id}/oidc/google`, { env });
    const q = new URL(go.headers.get("Location")!).searchParams;
    expect(go.headers.get("Location")).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    expect(q.get("client_id")).toBe("google-client");
    expect(q.get("redirect_uri")).toBe("https://api.test/v1/auth/oidc/google/callback");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("state")!.length).toBeGreaterThan(30);

    const p = await provider("https://oauth2.googleapis.com/token", "https://www.googleapis.com/oauth2/v3/certs", () => ({
      iss: "https://accounts.google.com", aud: "google-client", sub: "g-123", email, email_verified: true, name: "Ann Lee", nonce: q.get("nonce"),
    }));
    const cb = await call(`/v1/auth/oidc/google/callback?code=the-code&state=${q.get("state")}`, { env });
    expect(cb.status).toBe(200);
    expect(cb.text).toContain("close this window");
    // the PKCE verifier went to the provider, and matches the challenge
    const verifier = p.forms[0].get("code_verifier")!;
    const challenge = b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    expect(challenge).toBe(q.get("code_challenge"));
    expect(p.forms[0].get("client_secret")).toBe("google-secret");

    const got = await post("/v1/auth/session/poll", { pollToken: s.body.pollToken });
    expect(got.status).toBe(200);
    expect(got.body.user).toMatchObject({ email, name: "Ann Lee" });
    expect(got.body.runtime.name).toBe("Sanctuary PC");
    expect((await call("/v1/me", { token: got.body.access })).status).toBe(200);
    // handed over once; the state cannot be used again
    expect((await post("/v1/auth/session/poll", { pollToken: s.body.pollToken })).status).toBe(410);
    expect((await call(`/v1/auth/oidc/google/callback?code=again&state=${q.get("state")}`, { env })).status).toBe(410);
    // the same Google account later is the same user
    const again = await start("google", env);
    vi.restoreAllMocks();
    await provider("https://oauth2.googleapis.com/token", "https://www.googleapis.com/oauth2/v3/certs", () => ({
      iss: "accounts.google.com", aud: "google-client", sub: "g-123", email, email_verified: true, nonce: again.q.get("nonce"),
    }));
    await call(`/v1/auth/oidc/google/callback?code=c&state=${again.q.get("state")}`, { env });
    const got2 = await post("/v1/auth/session/poll", { pollToken: again.session.pollToken });
    expect(got2.body.user.id).toBe(got.body.user.id);
  });

  it("refuses a token for another app, a wrong nonce, an unverified email, a cancelled sign-in", async () => {
    const env = GOOGLE;
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ aud: "someone-else" }, /another app/],
      [{ nonce: "wrong" }, /does not match/],
      [{ email_verified: false }, /not verified/],
      [{ iss: "https://evil.example" }, /unexpected issuer/],
    ];
    for (const [bad, why] of cases) {
      const st = await start("google", env);
      await provider("https://oauth2.googleapis.com/token", "https://www.googleapis.com/oauth2/v3/certs", () => ({
        iss: "https://accounts.google.com", aud: "google-client", sub: "g-9", email: newEmail(), email_verified: true, nonce: st.q.get("nonce"), ...bad,
      }));
      const cb = await call(`/v1/auth/oidc/google/callback?code=c&state=${st.q.get("state")}`, { env });
      expect(cb.status).toBe(400);
      expect(cb.text).toMatch(why);
      expect((await post("/v1/auth/session/poll", { pollToken: st.session.pollToken })).status).toBe(202);   // still not signed in
      vi.restoreAllMocks();
      clearProviderKeys();
    }
    const st = await start("google", env);
    const cancelled = await call(`/v1/auth/oidc/google/callback?error=access_denied&state=${st.q.get("state")}`, { env });
    expect(cancelled.status).toBe(400);
    expect(cancelled.text).toContain("cancelled");
  });

  it("Apple: a form post with the name, and a signed client secret", async () => {
    const env = await appleEnv();
    const email = newEmail();
    const st = await start("apple", env);
    expect(st.q.get("response_mode")).toBe("form_post");
    expect(st.q.get("scope")).toBe("name email");
    const p = await provider("https://appleid.apple.com/auth/token", "https://appleid.apple.com/auth/keys", () => ({
      iss: "https://appleid.apple.com", aud: "org.framedecks.web", sub: "apple-001", email, email_verified: "true", nonce: st.q.get("nonce"),
    }));
    const form = new URLSearchParams({ code: "c", state: st.q.get("state")!, user: JSON.stringify({ name: { firstName: "Sam", lastName: "Ortiz" } }) });
    const cb = await call("/v1/auth/oidc/apple/callback", { method: "POST", body: form.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" }, env });
    expect(cb.status).toBe(200);
    const secret = p.forms[0].get("client_secret")!.split(".");
    expect(JSON.parse(atob(secret[0].replace(/-/g, "+").replace(/_/g, "/")))).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(atob(secret[1].replace(/-/g, "+").replace(/_/g, "/")))).toMatchObject({ iss: "TEAM123456", sub: "org.framedecks.web", aud: "https://appleid.apple.com" });
    const got = await post("/v1/auth/session/poll", { pollToken: st.session.pollToken });
    expect(got.body.user).toMatchObject({ email, name: "Sam Ortiz" });
  });

  it("Microsoft: a work address the domain owner has not verified never joins an existing account", async () => {
    const env = MICROSOFT;
    const email = newEmail();
    await signIn(email);                                         // an account with this address already exists
    const st = await start("microsoft", env);
    await provider("https://login.microsoftonline.com/common/oauth2/v2.0/token", "https://login.microsoftonline.com/common/discovery/v2.0/keys", () => ({
      iss: "https://login.microsoftonline.com/tenant-1/v2.0", tid: "tenant-1", oid: "oid-1", sub: "s", aud: "ms-client", email, nonce: st.q.get("nonce"),
    }));
    const cb = await call(`/v1/auth/oidc/microsoft/callback?code=c&state=${st.q.get("state")}`, { env });
    expect(cb.status).toBe(400);
    expect(cb.text).toContain("already has a FrameDecks account");
    vi.restoreAllMocks();
    clearProviderKeys();
    // a personal Microsoft account's address is verified: it joins
    const st2 = await start("microsoft", env);
    const consumer = "9188040d-6c67-4c5b-b112-36a304b66dad";
    await provider("https://login.microsoftonline.com/common/oauth2/v2.0/token", "https://login.microsoftonline.com/common/discovery/v2.0/keys", () => ({
      iss: `https://login.microsoftonline.com/${consumer}/v2.0`, tid: consumer, oid: "oid-2", sub: "s2", aud: "ms-client", email, nonce: st2.q.get("nonce"),
    }));
    expect((await call(`/v1/auth/oidc/microsoft/callback?code=c&state=${st2.q.get("state")}`, { env })).status).toBe(200);
    const got = await post("/v1/auth/session/poll", { pollToken: st2.session.pollToken });
    expect(got.body.user.email).toBe(email);
  });

  it("the page's email code completes the session too", async () => {
    const email = newEmail();
    const s = await post("/v1/auth/session", { client: RUNTIME }, { ip: newIp() });
    const form = (data: Record<string, string>) => ({ method: "POST", body: new URLSearchParams(data).toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    const sent = await call(`/v1/auth/session/${s.body.id}/email`, form({ email }));
    expect(sent.status).toBe(200);
    const code = /the code is (\d{6})/.exec(sent.text)![1];
    const wrong = await call(`/v1/auth/session/${s.body.id}/email/verify`, form({ code: code === "000000" ? "111111" : "000000" }));
    expect(wrong.status).toBe(400);
    expect(wrong.text).toContain("not right");
    const ok = await call(`/v1/auth/session/${s.body.id}/email/verify`, form({ code }));
    expect(ok.text).toContain("close this window");
    const got = await post("/v1/auth/session/poll", { pollToken: s.body.pollToken });
    expect(got.body.user.email).toBe(email);
    expect(got.body.runtime).toBeDefined();
  });

  it("expires after 10 minutes", async () => {
    const s = await post("/v1/auth/session", { client: RUNTIME }, { ip: newIp() });
    const { env } = await import("cloudflare:workers");
    await (env as unknown as Env).DB.prepare("UPDATE auth_sessions SET expires_at = ? WHERE id = ?").bind(Date.now() - 1, s.body.id).run();
    expect((await post("/v1/auth/session/poll", { pollToken: s.body.pollToken })).status).toBe(410);
    expect((await call(`/v1/auth/session/${s.body.id}`)).status).toBe(410);
    expect((await post("/v1/auth/session/poll", { pollToken: "made-up" })).body.error.code).toBe("session_expired");
  });
});
