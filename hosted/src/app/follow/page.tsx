import type { Metadata, Viewport } from "next";

import { FollowPanel } from "@/components/join-panel";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Follow the meeting", "/follow", { private: true });

// 26.11.48 the whole phone screen, past the notch and the home bar (join.css pads by the safe areas)
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#070c18" },
  ],
};

// 26.11.24 Members' phones: the church PC shows a QR to /follow#c=CODE (or the code is typed). No account needed.
// 26.11.48 once the code is in, the meeting fills the phone: the FrameDecks name, the meeting's name, the screen, tabs below.
export default function FollowPage() {
  return <FollowPanel />;
}
