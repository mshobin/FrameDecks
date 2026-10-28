"use client";

import { useEffect, useRef, useState } from "react";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";

import { STEP_SCREENS } from "@/components/landing/step-screens";

// "How it works": four steps, one app window. On a wide screen with motion allowed the section pins for a short
// stretch (1.6 viewports in all, about 40% of a viewport per step) and snaps to each step, so one normal flick of the
// wheel moves exactly one step. Elsewhere (≤960 px, or "reduce motion") nothing pins: the steps are tabs, the
// description sits below, and the screens move on by themselves every 4 s while on screen until someone picks one.

export type Step = Readonly<{ label: string; title: string; text: string; callout: string; image?: string }>;

const SNAPS = [0, 1 / 3, 2 / 3, 1];
const PIN = "(min-width: 961px) and (prefers-reduced-motion: no-preference)";

export function HowItWorks({
  steps,
  eyebrow,
  title,
  lead,
}: Readonly<{ steps: readonly Step[]; eyebrow: string; title: string; lead: string }>) {
  const section = useRef<HTMLElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const trigger = useRef<ScrollTriggerType | null>(null);
  const current = useRef(0);
  const [step, setStep] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);

  // GSAP (with ScrollTrigger) is fetched only where the section can pin: wide screens with motion allowed. Phones and
  // "reduce motion" never download it. gsap.matchMedia sets the pin up when the screen qualifies and reverts it
  // (unpinning, restoring the layout) when it stops qualifying or the page goes away.
  useEffect(() => {
    const wide = matchMedia(PIN);
    let revert: (() => void) | undefined;
    let gone = false;
    let loading = false;
    const load = () => {
      if (loading || !wide.matches) return;
      loading = true;
      void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ default: gsap }, { ScrollTrigger }]) => {
        if (gone) return;
        gsap.registerPlugin(ScrollTrigger);
        const mm = gsap.matchMedia();
        mm.add(PIN, () => {
          setPinned(true);
          trigger.current = ScrollTrigger.create({
            trigger: section.current,
            start: "top top",
            end: () => "+=" + window.innerHeight * 1.6,
            pin: true,
            invalidateOnRefresh: true,
            snap: { snapTo: SNAPS, duration: { min: 0.2, max: 0.45 }, ease: "power2.out", delay: 0.05 },
            onUpdate: (self) => {
              if (fill.current) fill.current.style.transform = `scaleY(${self.progress})`;
              const at = Math.round(self.progress * 3);
              if (at !== current.current) {
                current.current = at;
                setStep(at);
              }
            },
          });
          return () => {
            trigger.current = null;
            setPinned(false);
            if (fill.current) fill.current.style.transform = "";
          };
        });
        revert = () => mm.revert();
      });
    };
    load();
    wide.addEventListener("change", load); // a window widened later still gets the pinned guide
    return () => {
      gone = true;
      wide.removeEventListener("change", load);
      revert?.();
    };
  }, []);

  // Tabs: move on every 4 s while on screen, until someone picks a step (never under "reduce motion"/"Reduce effects")
  useEffect(() => {
    const el = section.current;
    if (!el || pinned) return;
    const seen = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    seen.observe(el);
    return () => seen.disconnect();
  }, [pinned]);

  useEffect(() => {
    const root = document.documentElement;
    if (pinned || picked || !inView || !root.classList.contains("fd-motion") || root.classList.contains("fd-calm")) return;
    const timer = setInterval(() => {
      current.current = (current.current + 1) % steps.length;
      setStep(current.current);
    }, 4000);
    return () => clearInterval(timer);
  }, [pinned, picked, inView, steps.length]);

  function go(i: number) {
    const st = trigger.current;
    if (pinned && st) {
      window.scrollTo({ top: st.start + (st.end - st.start) * SNAPS[i], behavior: "smooth" });
      return;
    }
    current.current = i;
    setStep(i);
    setPicked(true);
  }

  const active = steps[step];
  return (
    <section className="lp-how" id="how" ref={section} aria-labelledby="lp-how-title" data-pinned={pinned ? "" : undefined}>
      <div className="lp-how-inner">
        <div className="lp-how-copy">
          <p className="lp-eyebrow">{eyebrow}</p>
          <h2 id="lp-how-title" className="lp-h2">
            {title}
          </h2>
          <p className="lp-how-lead">{lead}</p>
          <ol className="lp-rail" role="tablist" aria-label="The four steps">
            <span className="lp-rail-line" aria-hidden="true">
              <span className="lp-rail-fill" ref={fill} />
            </span>
            {steps.map((s, i) => (
              <li key={s.title} role="presentation">
                <button
                  type="button"
                  role="tab"
                  id={`lp-step-tab-${i}`}
                  aria-selected={i === step}
                  aria-controls="lp-step-panel"
                  className={i === step ? "lp-rail-item is-on" : i < step ? "lp-rail-item is-done" : "lp-rail-item"}
                  onClick={() => go(i)}
                >
                  <span className="lp-rail-dot" aria-hidden="true" />
                  <span className="lp-rail-label">{s.label}</span>
                  <span className="lp-rail-title">{s.title}</span>
                  <span className="lp-rail-text">{s.text}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="lp-how-now" aria-live="polite">
            {active.text}
          </p>
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
      </div>
    </section>
  );
}
