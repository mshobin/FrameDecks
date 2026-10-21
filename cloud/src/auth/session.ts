// The browser sign-in session (docs/architecture/cloud-api.md §2): a runtime opens a small cloud page in the system
// browser, the person signs in there (Google, Microsoft, Apple or an email code), and the runtime polls for the result.
import { randomId, randomToken, sha256 } from "../crypto";
import type { Env } from "../env";
import { clientIp, html, HttpError, json, origin, readForm, readJson, redirect } from "../http";
import { HOUR, limit } from "../ratelimit";
import { findOrCreateUser, parseClient, signIn } from "./accounts";
import { checkCode, emailAvailable, startCode, userForEmail } from "./email";
import { begin, configuredProviders, finish, isProvider, PROVIDERS, type ProviderName } from "./oidc";

export const SESSION_TTL_MS = 10 * 60 * 1000;

interface SessionRow {
  id: string; client: string; status: "open" | "done" | "collected"; provider: string | null; state: string | null;
  verifier: string | null; nonce: string | null; email: string | null; user_id: string | null; expires_at: number;
}

const live = (s: SessionRow | null): s is SessionRow => !!s && s.expires_at > Date.now();

/** POST /auth/session */
export async function create(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ client?: unknown }>(request);
  const client = parseClient(body.client);
  await limit(env, `session:ip:${await sha256(clientIp(request))}`, 20, HOUR);
  const id = randomId("s");
  const pollToken = randomToken();
  const now = Date.now();
  await env.DB.prepare("INSERT INTO auth_sessions (id, poll_hash, client, status, created_at, expires_at) VALUES (?, ?, ?, 'open', ?, ?)")
    .bind(id, await sha256(pollToken), JSON.stringify(client), now, now + SESSION_TTL_MS).run();
  return json({ id, url: `${origin(request, env.PUBLIC_ORIGIN)}/v1/auth/session/${id}`, pollToken, expiresAt: now + SESSION_TTL_MS }, 201);
}

/** POST /auth/session/poll */
export async function poll(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ pollToken?: unknown }>(request);
  const expired = new HttpError(410, "session_expired", "This sign-in has expired. Please start again.");
  if (typeof body.pollToken !== "string" || !body.pollToken) throw expired;
  const s = await env.DB.prepare("SELECT * FROM auth_sessions WHERE poll_hash = ?").bind(await sha256(body.pollToken)).first<SessionRow>();
  if (!live(s) || s.status === "collected") throw expired;
  if (s.status === "open" || !s.user_id) return json({ pending: true }, 202);
  // hand the result over once
  const claimed = await env.DB.prepare("UPDATE auth_sessions SET status = 'collected' WHERE id = ? AND status = 'done'").bind(s.id).run();
  if (!claimed.meta.changes) throw expired;
  return json(await signIn(env, s.user_id, parseClient(JSON.parse(s.client)), clientIp(request)));
}

async function load(env: Env, id: string): Promise<SessionRow | null> {
  return env.DB.prepare("SELECT * FROM auth_sessions WHERE id = ?").bind(id).first<SessionRow>();
}

/** GET /auth/session/{id}: the sign-in page */
export async function page(request: Request, env: Env, id: string): Promise<Response> {
  const s = await load(env, id);
  if (!live(s)) return html(view("This sign-in link has expired", "<p>Please start again from FrameDecks.</p>"), 410);
  if (s.status !== "open") return html(done());
  return html(chooser(env, id));
}

/** GET /auth/session/{id}/oidc/{provider}: off to the provider */
export async function toProvider(request: Request, env: Env, id: string, provider: string): Promise<Response> {
  const s = await load(env, id);
  if (!live(s) || s.status !== "open") return html(view("This sign-in link has expired", "<p>Please start again from FrameDecks.</p>"), 410);
  if (!isProvider(provider)) throw new HttpError(404, "not_found", "There is nothing at this address.");
  const b = await begin(env, provider, origin(request, env.PUBLIC_ORIGIN));
  await env.DB.prepare("UPDATE auth_sessions SET provider = ?, state = ?, verifier = ?, nonce = ? WHERE id = ?")
    .bind(provider, b.state, b.verifier, b.nonce, id).run();
  return redirect(b.url);
}

/** GET or POST /auth/oidc/{provider}/callback */
export async function callback(request: Request, env: Env, provider: string): Promise<Response> {
  if (!isProvider(provider)) throw new HttpError(404, "not_found", "There is nothing at this address.");
  const f = await readForm(request);
  const state = f.get("state") || "";
  const s = state ? await env.DB.prepare("SELECT * FROM auth_sessions WHERE state = ? AND provider = ?").bind(state, provider).first<SessionRow>() : null;
  if (!live(s) || s.status !== "open" || !s.verifier || !s.nonce) {
    return html(view("This sign-in link has expired", "<p>Please start again from FrameDecks.</p>"), 410);
  }
  // the state is single-use: clear it before anything else can go wrong
  await env.DB.prepare("UPDATE auth_sessions SET state = NULL, verifier = NULL, nonce = NULL WHERE id = ?").bind(s.id).run();
  if (f.get("error") || !f.get("code")) {
    return html(view("Sign-in was cancelled", `<p>Nothing was changed.</p><p><a href="/v1/auth/session/${esc(s.id)}">Try again</a></p>`), 400);
  }
  try {
    const who = await finish(env, provider, f.get("code") || "", s.verifier, s.nonce, origin(request, env.PUBLIC_ORIGIN), f.get("user") || undefined);
    const userId = await findOrCreateUser(env, who);
    await env.DB.prepare("UPDATE auth_sessions SET status = 'done', user_id = ? WHERE id = ? AND status = 'open'").bind(userId, s.id).run();
    return html(done());
  } catch (e) {
    const message = e instanceof HttpError ? e.message : "Something went wrong. Please try again.";
    return html(view("Sign-in did not work", `<p>${esc(message)}</p><p><a href="/v1/auth/session/${esc(s.id)}">Try again</a></p>`), 400);
  }
}

/** POST /auth/session/{id}/email (form: email) and /auth/session/{id}/email/verify (form: code) */
export async function pageEmail(request: Request, env: Env, id: string, step: "start" | "verify"): Promise<Response> {
  const s = await load(env, id);
  if (!live(s) || s.status !== "open") return html(view("This sign-in link has expired", "<p>Please start again from FrameDecks.</p>"), 410);
  const f = await readForm(request);
  try {
    if (step === "start") {
      const email = (f.get("email") || "").trim().toLowerCase();
      const r = await startCode(env, email, clientIp(request));
      await env.DB.prepare("UPDATE auth_sessions SET email = ? WHERE id = ?").bind(email, id).run();
      return html(codeForm(id, email, r.devCode));
    }
    const email = await checkCode(env, s.email, f.get("code"));
    const userId = await userForEmail(env, email);
    await env.DB.prepare("UPDATE auth_sessions SET status = 'done', user_id = ? WHERE id = ? AND status = 'open'").bind(userId, id).run();
    return html(done());
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    if (step === "verify" && e.code === "code_wrong") return html(codeForm(id, s.email || "", undefined, e.message), 400);
    return html(view("Email sign-in did not work", `<p>${esc(e.message)}</p><p><a href="/v1/auth/session/${esc(id)}">Try again</a></p>`), e.status);
  }
}

// ---------- the pages: FrameDecks navy and gold, plain words ----------

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function view(title: string, inner: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · FrameDecks</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#04152D;color:#F8F9FA;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(420px,calc(100vw - 32px));padding:28px;border:1px solid rgba(212,175,55,.45);border-radius:18px;background:#0B2A52}
h1{margin:0 0 4px;font-size:22px}.brand{color:#D4AF37;letter-spacing:.18em;font-size:12px;font-weight:700;margin:0 0 18px}
p{margin:0 0 14px;color:#dfe5ee}a{color:#F7E08A}
.btn{display:block;width:100%;box-sizing:border-box;margin:0 0 10px;padding:12px 14px;border-radius:10px;border:1px solid rgba(212,175,55,.6);
background:transparent;color:#F8F9FA;font:inherit;font-weight:600;text-align:center;text-decoration:none;cursor:pointer}
.btn.gold{background:#D4AF37;color:#04152D;border-color:#D4AF37}
input{display:block;width:100%;box-sizing:border-box;margin:0 0 10px;padding:12px;border-radius:10px;border:1px solid #3a5278;background:#04152D;color:#F8F9FA;font:inherit}
.or{margin:16px 0 12px;text-align:center;color:#9fb0c8;font-size:13px}.note{color:#9fb0c8;font-size:13px}
</style></head><body><main><p class="brand">FRAMEDECKS</p><h1>${esc(title)}</h1>${inner}</main></body></html>`;
}

function chooser(env: Env, id: string): string {
  const providers = configuredProviders(env).map((p: ProviderName) =>
    `<a class="btn" href="/v1/auth/session/${esc(id)}/oidc/${p}">Continue with ${esc(PROVIDERS[p].label)}</a>`).join("");
  const email = emailAvailable(env)
    ? `${providers ? '<p class="or">or</p>' : ""}<form method="post" action="/v1/auth/session/${esc(id)}/email">
<input type="email" name="email" placeholder="you@example.org" autocomplete="email" required aria-label="Email address">
<button class="btn gold" type="submit">Email me a code</button></form>`
    : "";
  return view("Sign in to FrameDecks", `<p>Sign in to sync your Frames between your computers.</p>${providers}${email || (providers ? "" : "<p>Sign-in is not set up on this server yet.</p>")}`);
}

function codeForm(id: string, email: string, devCode?: string, problem?: string): string {
  return view("Enter your code", `<p>We sent a 6-digit code to <b>${esc(email)}</b>. It works for 10 minutes.</p>
${problem ? `<p>${esc(problem)}</p>` : ""}${devCode ? `<p class="note">Test server: the code is ${esc(devCode)}</p>` : ""}
<form method="post" action="/v1/auth/session/${esc(id)}/email/verify">
<input name="code" inputmode="numeric" pattern="[0-9 ]{6,7}" maxlength="7" autocomplete="one-time-code" placeholder="123456" required aria-label="Code">
<button class="btn gold" type="submit">Sign in</button></form>`);
}

const done = (): string => view("You're signed in", "<p>You can close this window and go back to FrameDecks.</p>");
