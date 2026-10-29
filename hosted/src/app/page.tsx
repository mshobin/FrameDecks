import type { Metadata } from "next";

import { Overview } from "@/components/overview";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { title: "FrameDecks · Prepare with Purpose. Present with Excellence.", url: "/" },
};

export default function Home() {
  return <Overview />;
}
