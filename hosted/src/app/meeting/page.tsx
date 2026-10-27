import type { Metadata } from "next";

import { PlanPage } from "@/components/plan-page";

export const metadata: Metadata = { title: "Plan" };

// The Meeting Form is now Plan → Edit the meeting; this address keeps working for bookmarks and old links.
export default function MeetingPage() {
  return <PlanPage />;
}
