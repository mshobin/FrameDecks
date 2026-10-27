"use client";

import { useEffect, useState } from "react";

import { MeetingFormPanel } from "@/components/meeting-form-panel";
import { ServicesPanel } from "@/components/services-panel";

type View = "edit" | "history";

/** One place to plan (owner-approved, 27 October): the meeting's Frames to edit, and their history to restore. The
 * old addresses still work: /meeting opens Edit, /services opens History, and #history picks it on /plan. */
export function PlanPanel({ initial = "edit" }: Readonly<{ initial?: View }>) {
  const [view, setView] = useState<View>(initial);
  useEffect(() => {
    // The address is only known in the browser (static export), so the choice is read after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.location.hash === "#history") setView("history");
  }, []);
  function choose(next: View) {
    setView(next);
    try {
      history.replaceState(null, "", next === "history" ? "#history" : window.location.pathname);
    } catch {}
  }
  return (
    <>
      <div className="plan-views" role="tablist" aria-label="Plan">
        <button type="button" role="tab" id="plan-tab-edit" aria-selected={view === "edit"} aria-controls="plan-view" onClick={() => choose("edit")}>
          Edit the meeting
        </button>
        <button type="button" role="tab" id="plan-tab-history" aria-selected={view === "history"} aria-controls="plan-view" onClick={() => choose("history")}>
          History and restore
        </button>
      </div>
      <div id="plan-view" role="tabpanel" aria-labelledby={view === "edit" ? "plan-tab-edit" : "plan-tab-history"}>
        {view === "edit" ? <MeetingFormPanel /> : <ServicesPanel historyOnly />}
      </div>
    </>
  );
}
