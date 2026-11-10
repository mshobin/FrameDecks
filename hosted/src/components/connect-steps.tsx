// FrameDecks 26.11.37 - opening the workspace as a small animated flowchart: each step ticks in turn, a line runs
// between them, and the last one connects into a picture of the workspace, which lights up with its name when it opens.
// Styles in app/join.css (.cs-*); still for reduced motion.
export type StepState = "done" | "now" | "next";

/** `team`: the workspace has opened (it lights up); `name`: the workspace it will open, shown dimmed while waiting. */
export function ConnectSteps({ steps, team, name, label }: Readonly<{ steps: [string, StepState][]; team?: string | null; name?: string | null; label: string }>) {
  return (
    <div className={team ? "cs cs-in" : "cs"}>
      <ol className="cs-list" aria-label={label}>
        {steps.map(([text, state], i) => (
          <li key={text} className={`cs-${state}`} style={{ ["--i" as string]: i }} aria-current={state === "now" ? "step" : undefined}>
            <span className="cs-dot" aria-hidden="true" />
            {text}
            {state === "done" && <span className="sr-only"> (done)</span>}
          </li>
        ))}
      </ol>
      <div className="cs-ws" aria-hidden="true">
        <i className="cs-ws-top" />
        <b>{team || name || "Your workspace"}</b>
        <span className="cs-ws-rows">
          <i />
          <i />
          <i />
        </span>
      </div>
      {team && (
        <p className="sr-only" role="status">
          Opening {team}
        </p>
      )}
    </div>
  );
}

/** A moment for the last tick and the workspace to light up before the page changes (none for reduced motion). */
export function settle(): Promise<void> {
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return new Promise((r) => setTimeout(r, still ? 0 : 1400));
}
