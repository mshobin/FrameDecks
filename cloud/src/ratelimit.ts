// Fixed-window rate limits in D1 (docs/architecture/cloud-api.md §6). Over the limit: 429 with retryAfter.
import type { Env } from "./env";
import { HttpError } from "./http";

export const HOUR = 60 * 60 * 1000;
export const MINUTE = 60 * 1000;

/** Counts one use of `key`; throws 429 when this window already had `limit` uses. */
export async function limit(env: Env, key: string, max: number, windowMs: number, now = Date.now()): Promise<void> {
  const start = Math.floor(now / windowMs) * windowMs;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`,
  ).bind(key, start).first<{ count: number }>();
  if ((row?.count ?? 0) > max) {
    const retryAfter = Math.max(1, Math.ceil((start + windowMs - now) / 1000));
    throw new HttpError(429, "rate_limited", "Too many tries. Please wait a little and try again.", { retryAfter });
  }
}
