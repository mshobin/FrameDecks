import type { MetadataRoute } from "next";

import { guides } from "@/lib/markdown";
import { PUBLIC_PATHS, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths: string[] = [...PUBLIC_PATHS, ...guides().map((g) => `/docs/${g.slug}`)];
  return paths.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/download" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/download" ? 0.9 : 0.5,
  }));
}
