// Responses and requests. Every JSON answer carries the security headers; errors are
// {"error": {"code", "message"}} with messages written for people (docs/architecture/cloud-api.md).

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      ...extra,
    },
  });
}

export function empty(status = 204): Response {
  return new Response(null, { status, headers: SECURITY_HEADERS });
}

export function error(status: number, code: string, message: string, extra: Record<string, unknown> = {}): Response {
  return json({ error: { code, message, ...extra } }, status);
}

/** A small page (the browser sign-in). Inline styles only; it posts forms back to this API and nowhere else. */
export function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

export function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { ...SECURITY_HEADERS, Location: location } });
}

/** Thrown anywhere in a handler; the router turns it into the error answer. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
  response(): Response {
    return error(this.status, this.code, this.message, this.extra);
  }
}

/** The request body as JSON, at most `max` bytes. */
export async function readJson<T = Record<string, unknown>>(request: Request, max = 64 * 1024): Promise<T> {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > max) throw new HttpError(413, "too_large", "That request is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > max) throw new HttpError(413, "too_large", "That request is too large.");
  try {
    const v = JSON.parse(text || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("not an object");
    return v as T;
  } catch {
    throw new HttpError(400, "bad_json", "The request is not valid JSON.");
  }
}

/** A form (application/x-www-form-urlencoded) or, failing that, the query string. */
export async function readForm(request: Request): Promise<URLSearchParams> {
  if (request.method === "POST") {
    const text = new TextDecoder().decode(await request.arrayBuffer());
    if (text.length > 64 * 1024) throw new HttpError(413, "too_large", "That request is too large.");
    return new URLSearchParams(text);
  }
  return new URL(request.url).searchParams;
}

export const clientIp = (request: Request): string => request.headers.get("CF-Connecting-IP") || "unknown";

/** The API's own public address (for links and provider redirect addresses). */
export function origin(request: Request, publicOrigin?: string): string {
  return (publicOrigin || new URL(request.url).origin).replace(/\/+$/, "");
}
