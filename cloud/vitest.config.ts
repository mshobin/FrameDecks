// Tests run inside the Workers runtime (Miniflare) with a local D1; the migrations are applied before each file.
// A fresh ES256 signing key is made for every test run (the real one is a secret, see README).
import { generateKeyPairSync } from "node:crypto";
import path from "node:path";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENVIRONMENT: "test",
            JWT_PRIVATE_KEY: JSON.stringify(privateKey.export({ format: "jwk" })),
            JWT_KID: "test-1",
          },
        },
      }),
    ],
    test: { setupFiles: ["./test/apply-migrations.ts"] },
  };
});
