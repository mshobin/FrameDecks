// Sign-in with a one-time email code (docs/architecture/cloud-api.md §2): 6 digits, 10 minutes, 5 tries.
// Codes are sent with Resend when RESEND_API_KEY and EMAIL_FROM are set; dev and test answer with the code instead.
import { randomToken, sameString, sha256, sixDigits } from "../crypto";
import { type Env, isDevLike } from "../env";
import { clientIp, HttpError, json, readJson } from "../http";
import { HOUR, limit } from "../ratelimit";
import { findOrCreateUser, normEmail, parseClient, signIn, validEmail } from "./accounts";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_TRIES = 5;

export const mailerReady = (env: Env): boolean => !!(env.RESEND_API_KEY && env.EMAIL_FROM);
export const emailAvailable = (env: Env): boolean => mailerReady(env) || isDevLike(env);

/** Makes and sends a code. Returns the code only in dev and test. */
export async function startCode(env: Env, rawEmail: unknown, ip: string): Promise<{ devCode?: string }> {
  const email = normEmail(rawEmail);
  if (!validEmail(email)) throw new HttpError(400, "bad_email", "Please enter a valid email address.");
  if (!emailAvailable(env)) throw new HttpError(503, "email_not_configured", "Email sign-in is not set up on this server yet.");
  await limit(env, `email-start:ip:${await sha256(ip)}`, 20, HOUR);
  await limit(env, `email-start:email:${await sha256(email)}`, 5, HOUR);
  const code = sixDigits();
  const salt = randomToken();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO email_codes (email, code_hash, salt, attempts, created_at, expires_at) VALUES (?1, ?2, ?3, 0, ?4, ?5)
     ON CONFLICT(email) DO UPDATE SET code_hash = ?2, salt = ?3, attempts = 0, created_at = ?4, expires_at = ?5`,
  ).bind(email, await sha256(salt + code), salt, now, now + CODE_TTL_MS).run();
  if (mailerReady(env)) await sendCode(env, email, code);
  return isDevLike(env) ? { devCode: code } : {};
}

/** Checks a code; on success it is used up. Throws code_wrong / code_expired. */
export async function checkCode(env: Env, rawEmail: unknown, rawCode: unknown): Promise<string> {
  const email = normEmail(rawEmail);
  const code = String(rawCode ?? "").replace(/\s+/g, "");
  const expired = new HttpError(400, "code_expired", "That code has expired. Please ask for a new one.");
  const row = await env.DB.prepare("SELECT code_hash, salt, attempts, expires_at FROM email_codes WHERE email = ?").bind(email)
    .first<{ code_hash: string; salt: string; attempts: number; expires_at: number }>();
  if (!row || row.expires_at <= Date.now() || row.attempts >= CODE_TRIES) throw expired;
  if (!/^\d{6}$/.test(code) || !sameString(await sha256(row.salt + code), row.code_hash)) {
    await env.DB.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
    throw new HttpError(400, "code_wrong", "That code is not right. Please check it and try again.");
  }
  await env.DB.prepare("DELETE FROM email_codes WHERE email = ?").bind(email).run();
  return email;
}

/** The user for a verified email address (an email identity verifies the address itself, so it may link). */
export const userForEmail = (env: Env, email: string): Promise<string> =>
  findOrCreateUser(env, { provider: "email", subject: email, email, linkByEmail: true });

async function sendCode(env: Env, email: string, code: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: `Your FrameDecks code: ${code}`,
      text: `Your FrameDecks sign-in code is ${code}.\n\nIt works for 10 minutes. If you did not ask for it, you can ignore this email.`,
    }),
  });
  if (!res.ok) throw new HttpError(502, "email_failed", "The code could not be sent. Please try again in a moment.");
}

// ---------- the API ----------

/** POST /auth/email/start */
export async function apiStart(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: unknown }>(request);
  const r = await startCode(env, body.email, clientIp(request));
  return json({ sent: true, ...r }, 202);
}

/** POST /auth/email/verify */
export async function apiVerify(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: unknown; code?: unknown; client?: unknown }>(request);
  const client = parseClient(body.client);
  const email = await checkCode(env, body.email, body.code);
  const userId = await userForEmail(env, email);
  return json(await signIn(env, userId, client, clientIp(request)));
}
