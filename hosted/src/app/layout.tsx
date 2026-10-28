import type { Metadata, Viewport } from "next";

import { Ambient, Motion } from "@/components/motion";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { SITE_URL } from "@/lib/site";

import "./globals.css";
import "./design.css";
import "./motion.css";
import "./about.css";
import "./identity.css";
import "./landing.css";
import "./light.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FrameDecks · Prepare with Purpose. Present with Excellence.",
    template: "%s | FrameDecks",
  },
  description:
    "Plan, rehearse and present meetings, classes, conferences, events and services on every screen and stream, guided from your phone.",
  applicationName: "FrameDecks",
  openGraph: {
    type: "website",
    siteName: "FrameDecks",
    url: "/",
    title: "FrameDecks · Prepare with Purpose. Present with Excellence.",
    description:
      "Plan, rehearse and present meetings, classes, conferences, events and services on every screen and stream, guided from your phone.",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/framedecks-emblem.webp",
    apple: "/framedecks-emblem.webp",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#070c18" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before the first paint: allow motion unless the device asks for less (motion.css; nothing is hidden until
            components/motion.tsx has run), apply "Reduce effects" (components/effects-toggle.tsx) and the light or dark
            theme (light.css, components/theme-toggle.tsx) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if(window.IntersectionObserver&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('fd-motion');" +
              "try{if(localStorage.getItem('fd-effects')==='calm')document.documentElement.classList.add('fd-calm')}catch(e){}" +
              "try{var t=localStorage.getItem('fd-theme');if(t==='light'||(t!=='dark'&&matchMedia('(prefers-color-scheme: light)').matches))document.documentElement.classList.add('fd-light')}catch(e){}",
          }}
        />
      </head>
      <body>
        <a className="fd-skip" href="#main">
          Skip to content
        </a>
        <Ambient />
        {children}
        <Motion />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
