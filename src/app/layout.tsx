import type { Metadata, Viewport } from "next";

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
    icon: "/icon.png",
    apple: "/framedecks-logo-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f7fa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
