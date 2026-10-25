import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FRAMEDECKS",
    short_name: "FRAMEDECKS",
    description:
      "The online-first FRAMEDECKS companion for secure service planning and device management.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0c1426",
    theme_color: "#0a1426",
    icons: [
      {
        src: "/framedecks-emblem.webp",
        sizes: "1024x1024",
        type: "image/webp",
        purpose: "any",
      },
    ],
  };
}
