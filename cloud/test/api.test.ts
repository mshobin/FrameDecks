import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import * as entry from "../src/index";

const call = (path: string, init?: RequestInit) => exports.default.fetch(new Request(`https://api.test${path}`, init));

describe("GET /v1/health", () => {
  it("reports the service, its version and a working database", async () => {
    const res = await call("/v1/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.json()).toEqual({ ok: true, service: "framedecks-api", version: pkg.version, db: "ok" });
  });

  it("sends the security headers", async () => {
    const res = await call("/v1/health");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("only answers GET", async () => {
    const res = await call("/v1/health", { method: "POST" });
    expect(res.status).toBe(405);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("method_not_allowed");
  });
});

describe("unknown addresses", () => {
  it("return 404 with an error a person can read", async () => {
    const res = await call("/v1/nothing-here");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("not_found");
    expect(body.error.message.length).toBeGreaterThan(0);
  });
});

describe("the worker entry", () => {
  it("exports only the handler and the relay's Durable Object (the Workers runtime refuses any other named export)", () => {
    expect(Object.keys(entry).sort()).toEqual(["RuntimeRelay", "default"]);
  });
});

describe("CORS (the PWA on another origin; CORS_ORIGINS in wrangler.toml)", () => {
  it("answers a preflight from an allowed origin", async () => {
    const res = await call("/v1/relay/runtimes", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PATCH, DELETE");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Authorization, Content-Type");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("600");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("gives a preflight from another origin no CORS headers", async () => {
    const res = await call("/v1/health", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
  });

  it("adds Allow-Origin and Vary for an allowed origin (any local port), and nothing otherwise", async () => {
    for (const origin of ["http://127.0.0.1:8080", "http://localhost:3000"]) {
      const ok = await call("/v1/health", { headers: { Origin: origin } });
      expect(ok.status).toBe(200);
      expect(ok.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(ok.headers.get("Vary")).toContain("Origin");
      expect(ok.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    }
    // errors carry them too, so the PWA can read them
    expect((await call("/v1/me", { headers: { Origin: "http://localhost:3000" } })).headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");

    for (const origin of ["https://evil.example", "http://localhost.evil.example:80", "http://127.0.0.1:80abc", "https://127.0.0.1:8080"]) {
      const no = await call("/v1/health", { headers: { Origin: origin } });
      expect(no.status).toBe(200);    // answered: native clients and others are not refused
      expect(no.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
    const none = await call("/v1/health");
    expect(none.status).toBe(200);
    expect(none.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
