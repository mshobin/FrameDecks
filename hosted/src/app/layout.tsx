import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegister } from "@/components/service-worker-register";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FRAMEDECKS Hosted Companion",
    template: "%s | FRAMEDECKS",
  },
  description:
    "The online-first FRAMEDECKS companion for secure service planning and device management.",
  applicationName: "FRAMEDECKS",
  icons: {
    icon: "/framedecks-emblem.webp",
    apple: "/framedecks-emblem.webp",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a1426",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
