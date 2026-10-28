import type { Metadata } from "next";

import { PlanPage } from "@/components/plan-page";
import { PRIVATE_PAGE } from "@/lib/site";

export const metadata: Metadata = { title: "Plan · History", ...PRIVATE_PAGE };

// The Running order is now Plan → History and restore; this address keeps working for bookmarks and old links.
export default function ServicesPage() {
  return <PlanPage initial="history" />;
}
