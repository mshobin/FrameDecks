import { AppShell } from "@/components/app-shell";
import { PlanPanel } from "@/components/plan-panel";

/** The Plan page, shared by /plan and the older /meeting and /services addresses. */
export function PlanPage({ initial = "edit" }: Readonly<{ initial?: "edit" | "history" }>) {
  return (
    <AppShell active="plan">
      <section className="page-head">
        <h1>Plan</h1>
        <p className="page-note">
          Everything the meeting shows, Frame by Frame: questions, scripture and the presenter&apos;s script. The service
          PC picks up each change within about a minute.
        </p>
      </section>
      <PlanPanel initial={initial} />
    </AppShell>
  );
}
