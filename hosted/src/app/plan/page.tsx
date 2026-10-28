import type { Metadata } from "next";

import { PlanPage } from "@/components/plan-page";
import { PRIVATE_PAGE } from "@/lib/site";

export const metadata: Metadata = { title: "Plan", ...PRIVATE_PAGE };

export default function Plan() {
  return <PlanPage />;
}
