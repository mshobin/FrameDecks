import type { Metadata } from "next";

import { PlanPage } from "@/components/plan-page";

export const metadata: Metadata = { title: "Plan" };

export default function Plan() {
  return <PlanPage />;
}
