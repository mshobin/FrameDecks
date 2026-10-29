import type { Metadata } from "next";

import { PlanPage } from "@/components/plan-page";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Plan", "/plan", { private: true });

export default function Plan() {
  return <PlanPage />;
}
