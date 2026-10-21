import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      TEST_MIGRATIONS: D1Migration[];
    }
    // types `exports.default` from "cloudflare:workers" as this Worker's own fetch handler
    interface GlobalProps {
      mainModule: typeof import("../src/index");
    }
  }
}
export {};
