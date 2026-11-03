import Image from "next/image";
import type { CSSProperties } from "react";
import { Check, ChevronRight } from "lucide-react";

// The four screens of "How it works", drawn in HTML so they stay sharp and light. Each one's small animation (CSS,
// landing.css "steps") replays every time its step becomes active, and finishes within about 1.2 s.
// Every screen takes an optional real screenshot instead of the drawing.
// TODO(real screenshots): capture each step from the program and the website at 1200 × 750 as WebP into
// public/product/ (step-plan.webp, step-script.webp, step-check.webp, step-present.webp) and pass `image`.

type ScreenProps = Readonly<{ image?: string; alt: string }>;

function Shot({ image, alt }: Readonly<{ image: string; alt: string }>) {
  return <Image className="lp-step-shot" src={image} alt={alt} width={1200} height={750} loading="lazy" unoptimized />;
}

export function PlanScreen({ image, alt }: ScreenProps) {
  if (image) return <Shot image={image} alt={alt} />;
  const frames = ["Welcome", "Opening reading", "Discussion question", "Closing words"];
  return (
    <div className="lp-scr lp-scr-plan" role="img" aria-label={alt}>
      <div className="lp-scr-head">
        <strong>Evening session</strong>
        <span>Thursday · 7:30 pm</span>
      </div>
      <ol className="lp-plan-list">
        {frames.map((f, i) => (
          <li key={f} style={{ "--i": i } as CSSProperties}>
            <span className="lp-plan-num">{i + 1}</span>
            {f}
          </li>
        ))}
      </ol>
      <div className="lp-plan-team">
        {["AM", "JK", "RS"].map((p, i) => (
          <span key={p} className="lp-avatar" style={{ "--i": i } as CSSProperties}>
            {p}
          </span>
        ))}
        <span className="lp-plan-invited">
          <Check aria-hidden="true" size={14} /> Team invited
        </span>
      </div>
    </div>
  );
}

export function ScriptScreen({ image, alt }: ScreenProps) {
  if (image) return <Shot image={image} alt={alt} />;
  return (
    <div className="lp-scr lp-scr-rehearse" role="img" aria-label={alt}>
      <div className="lp-scr-head">
        <strong>Teleprompter</strong>
        <span>Only you see it</span>
      </div>
      <div className="lp-rehearse-body">
        <div className="lp-mini-slide">
          <span>Your script</span>
          <p>Welcome everyone. Let’s begin with a moment of quiet.</p>
        </div>
        <div className="lp-room">
          <span>What the meeting sees</span>
          <div className="lp-room-screen">
            <p className="fd-serif">Welcome, everyone</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CheckScreen({ image, alt }: ScreenProps) {
  if (image) return <Shot image={image} alt={alt} />;
  const items = ["Frames ready", "Virtual camera FrameDecks vCam", "Phone remote connected"];
  return (
    <div className="lp-scr lp-scr-check" role="img" aria-label={alt}>
      <div className="lp-scr-head">
        <strong>Setup guide: Ready</strong>
        <span>3 checks</span>
      </div>
      <ul className="lp-checks">
        {items.map((t, i) => (
          <li key={t} style={{ "--i": i } as CSSProperties}>
            <span className="lp-check-mark">
              <i className="lp-spin" />
              <Check className="lp-tick" aria-hidden="true" size={14} strokeWidth={3} />
            </span>
            {t}
          </li>
        ))}
      </ul>
      <p className="lp-ready">Ready to present</p>
    </div>
  );
}

export function PresentScreen({ image, alt }: ScreenProps) {
  if (image) return <Shot image={image} alt={alt} />;
  return (
    <div className="lp-scr lp-scr-present" role="img" aria-label={alt}>
      <div className="lp-present-phone">
        <span>Frame 2 of 4</span>
        <span className="lp-present-next">
          Next <ChevronRight aria-hidden="true" size={14} />
          <i className="lp-tap" />
        </span>
      </div>
      <div className="lp-present-outputs">
        <div className="lp-present-out">
          <span>Room screen</span>
          <div className="lp-present-frame">
            <p className="lp-present-a fd-serif">Welcome, everyone</p>
            <p className="lp-present-b fd-serif">What is one idea you will put into practice?</p>
          </div>
        </div>
        <div className="lp-present-out">
          <span>Stream</span>
          <div className="lp-present-frame lp-present-stream">
            <p className="lp-present-a fd-serif">Welcome, everyone</p>
            <p className="lp-present-b fd-serif">What is one idea you will put into practice?</p>
            <i className="lp-live-dot" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Day 5 (8.6): Ctrl twice puts a soft circle on the word, then a pen underlines it, on what the room sees */
export function AnnotateScreen({ image, alt }: ScreenProps) {
  if (image) return <Shot image={image} alt={alt} />;
  return (
    <div className="lp-scr lp-scr-ann" role="img" aria-label={alt}>
      <div className="lp-scr-head">
        <strong>Room screen</strong>
        <span>Ctrl twice</span>
      </div>
      <div className="lp-ann-frame">
        <p className="fd-serif">
          I am the{" "}
          <span className="lp-ann-word">
            vine
            <i className="lp-ann-disc" />
            <i className="lp-ann-wave" />
            <svg className="lp-ann-ptr" viewBox="0 0 16 22" aria-hidden="true">
              <path d="M1 1v17l4.5-4.2 3 6.7 3-1.4-3-6.6H15z" />
            </svg>
          </span>
          ; you are the{" "}
          <span className="lp-ann-under">
            branches
            <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
              <path d="M2 8 C 28 11, 62 3, 98 6" />
            </svg>
          </span>
          .
        </p>
        <span className="lp-ann-ref">John 15:5</span>
      </div>
    </div>
  );
}

export const STEP_SCREENS = [PlanScreen, ScriptScreen, CheckScreen, PresentScreen, AnnotateScreen] as const;
