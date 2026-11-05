"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { STEP_SCREENS } from "@/components/landing/step-screens";

// "How it works": the days in a list beside one app window. The active day's gold line fills over 4 s (a CSS
// animation, landing-page.css) and its end slides the window to the next day; after the last it starts again (8.6:
// no Play, Previous or Next). It plays only while the section is on screen, holds while the pointer or keyboard focus
// is on it, and never starts under "reduce motion" or "Reduce effects": then a day is chosen by clicking it.

export type Step = Readonly<{ label: string; title: string; text: string; callout: string; image?: string }>;

function motionAllowed() {
  const root = document.documentElement;
  return root.classList.contains("fd-motion") && !root.classList.contains("fd-calm");
}

// 9.11.1 it can also play inside the showcase (components/landing/showcase.tsx), without its own heading: then the
// end of the last day hands over to "See it work" (onLoopEnd) instead of starting again.
export function HowItWorks({
  steps,
  eyebrow,
  title,
  lead,
  embedded = false,
  onLoopEnd,
}: Readonly<{
  steps: readonly Step[];
  eyebrow: string;
  title: string;
  lead: string;
  embedded?: boolean;
  onLoopEnd?: () => void;
}>) {
  const section = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [prev, setPrev] = useState(steps.length - 1);
  const [auto, setAuto] = useState(false);
  const [hold, setHold] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuto(motionAllowed());
    const el = section.current;
    if (!el) return;
    const seen = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    seen.observe(el);
    return () => seen.disconnect();
  }, []);

  const running = auto && !hold && inView;

  function go(i: number) {
    const to = (i + steps.length) % steps.length;
    if (to === step) return;
    setPrev(step);
    setStep(to);
  }

  function keys(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const to = (step + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + steps.length) % steps.length;
    go(to);
    document.getElementById(`lp-step-tab-${to}`)?.focus();
  }

  function advance() {
    if (onLoopEnd && step === steps.length - 1) {
      setPrev(step);
      setStep(0);
      onLoopEnd();
      return;
    }
    go(step + 1);
  }

  const active = steps[step];
  const Box = embedded ? "div" : "section";
  return (
    <Box
      className="lp-how"
      id={embedded ? undefined : "how"}
      ref={section as never}
      aria-labelledby={embedded ? undefined : "lp-how-title"}
      data-auto={auto ? "" : undefined}
      data-run={running ? "" : undefined}
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false);
      }}
    >
      {!embedded && (
        <div className="lp-head" data-reveal="">
          <p className="lp-eyebrow">{eyebrow}</p>
          <h2 id="lp-how-title" className="lp-h2">
            {title}
          </h2>
          <p>{lead}</p>
        </div>
      )}

      <div className="lp-how-body">
        {/* 8.6: the days and their words in one list beside the window; the steps play in a loop by themselves
            (pointing at the section holds them), and a day can still be chosen */}
        <div className="lp-tabs" role="tablist" aria-orientation="vertical" aria-label="The steps" onKeyDown={keys}>
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              id={`lp-step-tab-${i}`}
              aria-selected={i === step}
              aria-controls="lp-step-panel"
              tabIndex={i === step ? 0 : -1}
              className={i === step ? "lp-tab is-on" : "lp-tab"}
              onClick={() => go(i)}
            >
              <span className="lp-tab-bar" aria-hidden="true">
                <i key={i === step ? `on-${step}` : "off"} onAnimationEnd={i === step ? advance : undefined} />
              </span>
              <span className="lp-tab-label">{s.label}</span>
              <span className="lp-tab-title">{s.title}</span>
              <span className="lp-tab-text">{s.text}</span>
            </button>
          ))}
        </div>

        <div className="lp-how-stage" id="lp-step-panel" role="tabpanel" aria-labelledby={`lp-step-tab-${step}`}>
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
                  <div key={s.title} className={i === step ? "lp-screen is-on" : i === prev ? "lp-screen is-prev" : "lp-screen"} aria-hidden={i !== step}>
                    <Screen image={s.image} alt={`${s.label}: ${s.title}`} />
                  </div>
                );
              })}
            </div>
          </div>
          <span className="lp-callout" key={step}>
            {active.callout}
          </span>
          <p className="lp-sr" aria-live="polite">
            {active.label}: {active.title}. {active.text}
          </p>
        </div>
      </div>
    </Box>
  );
}
