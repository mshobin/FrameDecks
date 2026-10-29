"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { STEP_SCREENS } from "@/components/landing/step-screens";

// "How it works" (6.13, replacing the scroll-pinned guide and GSAP): four tabs over one app window, played like
// stories. The active tab's gold bar fills over 6 s (a CSS animation, landing.css "how it works") and its end moves
// to the next step. It plays only while the section is on screen, holds while the pointer or keyboard focus is on it,
// stops for good after one round or when someone picks a step, and never starts under "reduce motion" or
// "Reduce effects": step 1 simply waits there.

export type Step = Readonly<{ label: string; title: string; text: string; callout: string; image?: string }>;

function motionAllowed() {
  const root = document.documentElement;
  return root.classList.contains("fd-motion") && !root.classList.contains("fd-calm");
}

export function HowItWorks({
  steps,
  eyebrow,
  title,
  lead,
}: Readonly<{ steps: readonly Step[]; eyebrow: string; title: string; lead: string }>) {
  const section = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuto(motionAllowed());
    const el = section.current;
    if (!el) return;
    const seen = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    seen.observe(el);
    return () => seen.disconnect();
  }, []);

  const running = auto && !paused && !hold && inView;

  function next() {
    if (step < steps.length - 1) setStep(step + 1);
    else setAuto(false); // one round, then it rests on the last step
  }

  function pick(i: number) {
    setStep((i + steps.length) % steps.length);
    setAuto(false);
  }

  function toggle() {
    if (auto) {
      setPaused(!paused);
      return;
    }
    if (!motionAllowed()) return;
    if (step === steps.length - 1) setStep(0);
    setPaused(false);
    setAuto(true);
  }

  function keys(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const to = (step + (e.key === "ArrowRight" ? 1 : -1) + steps.length) % steps.length;
    pick(to);
    document.getElementById(`lp-step-tab-${to}`)?.focus();
  }

  const active = steps[step];
  return (
    <section
      className="lp-how"
      id="how"
      ref={section}
      aria-labelledby="lp-how-title"
      data-auto={auto ? "" : undefined}
      data-run={running ? "" : undefined}
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false);
      }}
    >
      <div className="lp-head" data-reveal="">
        <p className="lp-eyebrow">{eyebrow}</p>
        <h2 id="lp-how-title" className="lp-h2">
          {title}
        </h2>
        <p>{lead}</p>
      </div>

      <div className="lp-tabs" role="tablist" aria-label="The four steps" onKeyDown={keys}>
        {steps.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            id={`lp-step-tab-${i}`}
            aria-selected={i === step}
            aria-controls="lp-step-panel"
            tabIndex={i === step ? 0 : -1}
            className={i === step ? "lp-tab is-on" : i < step ? "lp-tab is-done" : "lp-tab"}
            onClick={() => pick(i)}
          >
            <span className="lp-tab-label">{s.label}</span>
            <span className="lp-tab-title">{s.title}</span>
            <span className="lp-tab-bar" aria-hidden="true">
              <i key={i === step ? `on-${step}` : "off"} onAnimationEnd={i === step ? next : undefined} />
            </span>
          </button>
        ))}
      </div>

      <div className="lp-how-body" id="lp-step-panel" role="tabpanel" aria-labelledby={`lp-step-tab-${step}`}>
        <div className="lp-how-stage">
          <div className="lp-window lp-how-window fd-framed">
            <div className="lp-window-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>FrameDecks · {active.title}</span>
            </div>
            <div className="lp-screens">
              {steps.map((s, i) => {
                const Screen = STEP_SCREENS[i];
                return (
                  <div key={s.title} className={i === step ? "lp-screen is-on" : "lp-screen"} aria-hidden={i !== step}>
                    <Screen image={s.image} alt={`${s.label}: ${s.title}`} />
                  </div>
                );
              })}
            </div>
          </div>
          <span className="lp-callout" key={step}>
            {active.callout}
          </span>
        </div>

        <div className="lp-how-copy">
          <p className="lp-how-day">{active.label}</p>
          <h3>{active.title}</h3>
          <p className="lp-how-now" aria-live="polite">
            {active.text}
          </p>
          <div className="lp-how-controls">
            <button type="button" className="lp-round" aria-label="Previous step" onClick={() => pick(step - 1)}>
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <button type="button" className="lp-round" aria-label={auto && !paused ? "Pause" : "Play the steps"} onClick={toggle}>
              {auto && !paused ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
            </button>
            <button type="button" className="lp-round" aria-label="Next step" onClick={() => pick(step + 1)}>
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
