import type { Metadata } from "next";

import { PlanPage } from "@/components/plan-page";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Plan · History", "/services", { private: true });

// The Running order is now Plan → History and restore; this address keeps working for bookmarks and old links.
export default function ServicesPage() {
  return <PlanPage initial="history" />;
}
