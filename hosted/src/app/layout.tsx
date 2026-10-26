import type { Metadata, Viewport } from "next";

import { Ambient, Motion } from "@/components/motion";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

import "./globals.css";
import "./design.css";
import "./motion.css";
import "./about.css";

export const metadata: Metadata = {
  title: {
    default: "FRAMEDECKS Hosted Companion",
    template: "%s | FRAMEDECKS",
  },
  description:
    "The online-first FRAMEDECKS companion for secure service planning and device management.",
  applicationName: "FRAMEDECKS",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/framedecks-emblem.webp",
    apple: "/framedecks-emblem.webp",
  },
};

export const viewport: Viewport = {
  themeColor: "#070c18",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before the first paint: hide what will rise into view (motion.css), unless the device asks for less motion */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if(window.IntersectionObserver&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('fd-motion')",
          }}
        />
      </head>
      <body>
        <Ambient />
        {children}
        <Motion />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
