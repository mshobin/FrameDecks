import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plain static files (out/): any free static host can serve the companion (docs/architecture/hosting.md).
  // Every page runs in the browser and talks to Supabase; the one route, /api/sync-config, is written at build time.
  output: "export",
  images: { unoptimized: true },
  // `next dev` writes no generated notes file into hosted/.
  agentRules: false,
  // cacheComponents / partialPrefetching were on before; they need a server (partial prerendering), and nothing here
  // used them: every page is a client component.
  turbopack: {
    // 26.11.58 (size budget): the website uses no Supabase Storage; src/lib/no-storage.ts says why it is left out
    resolveAlias: { "@supabase/storage-js": { browser: "./src/lib/no-storage.ts" } },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
