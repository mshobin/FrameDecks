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
  it("exports only the handler (the Workers runtime refuses to start on any other named export)", () => {
    expect(Object.keys(entry)).toEqual(["default"]);
  });
});
