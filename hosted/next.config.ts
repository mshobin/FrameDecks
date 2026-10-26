import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plain static files (out/): any free static host can serve the companion (docs/architecture/hosting.md).
  // Every page runs in the browser and talks to Supabase; the one route, /api/sync-config, is written at build time.
  output: "export",
  images: { unoptimized: true },
  // cacheComponents / partialPrefetching were on before; they need a server (partial prerendering), and nothing here
  // used them: every page is a client component.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
