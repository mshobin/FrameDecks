import { ClipboardList, MonitorPlay, RefreshCw, Smartphone } from "lucide-react";

// How FRAMEDECKS works, in four steps: what happens where (docs/architecture/meeting-form.md). Shown on the landing
// page, the Overview and (compact) beside sign-in.
export const STEPS = [
  { icon: ClipboardList, where: "This website", title: "Plan", text: "Build the meeting on the Meeting Form: Frames, questions, scripture and the presenter's script." },
  { icon: RefreshCw, where: "Your workspace", title: "Sync", text: "Your linked service PC receives every change within a minute. Pictures and video stay on the PC." },
  { icon: MonitorPlay, where: "Service PC", title: "Present", text: "FRAMEDECKS shows it on screen, in OBS, and in Zoom or Teams through its own camera." },
  { icon: Smartphone, where: "Your phone", title: "Guide", text: "Run the service from anywhere in the room: next Frame, questions, scripture, black screen." },
] as const;

export function Workflow({ compact = false }: Readonly<{ compact?: boolean }>) {
  return (
    <ol className={compact ? "fd-flow fd-flow-compact" : "fd-flow"} aria-label="How FRAMEDECKS works">
      {STEPS.map(({ icon: Icon, where, title, text }, i) => (
        <li className="fd-flow-step" key={title} data-reveal style={{ "--d": `${i * 110}ms` } as React.CSSProperties}>
          <span className="fd-flow-icon">
            <Icon aria-hidden="true" size={compact ? 17 : 22} strokeWidth={1.8} />
          </span>
          <span className="fd-flow-num">{i + 1}</span>
          <div className="fd-flow-copy">
            <p className="fd-flow-where">{where}</p>
            <h3>{title}</h3>
            {!compact && <p>{text}</p>}
          </div>
          {i < STEPS.length - 1 && <span className="fd-flow-link" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
