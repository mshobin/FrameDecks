"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check } from "lucide-react";

import { VCamPreview, TeleprompterPreview } from "@/components/landing/feature-previews";
import { NextDemo } from "@/components/next-demo";

// "See it work" and the features in one place (6.13): four tabs, each the thing itself on one side and three short
// lines on the other. The first tab is the live demo, so a visitor can press Next without scrolling to find it.
// Every panel stays in the page (hidden when not chosen), so the words are there for search and for screen readers.
// 8.6: when the section comes into view the tabs play through by themselves (a gold line fills under the chosen tab,
// 5 s each), so visitors see there is more than the first; pointing at it holds, and choosing a tab stops the tour.
// Never under "reduce motion" or "Reduce effects".

export type FeatureTab = Readonly<{ id: string; tab: string; title: string; lines: readonly string[] }>;

function Panel({ tab, active, children }: Readonly<{ tab: FeatureTab; active: boolean; children: ReactNode }>) {
  return (
    <div
      className={`lp-feature lp-feature-${tab.id}`}
      id={`lp-feature-${tab.id}`}
      role="tabpanel"
      aria-labelledby={`lp-feature-tab-${tab.id}`}
      hidden={!active}
    >
      <div className="lp-feature-copy">
        <h3>{tab.title}</h3>
        <ul>
          {tab.lines.map((l) => (
            <li key={l}>
              <Check aria-hidden="true" size={16} /> {l}
            </li>
          ))}
        </ul>
      </div>
      <div className="lp-feature-show">{children}</div>
    </div>
  );
}

export function FeatureTabs({ tabs, private: own }: Readonly<{ tabs: readonly FeatureTab[]; private: ReactNode }>) {
  const [at, setAt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const [tour, setTour] = useState(false);
  const [inView, setInView] = useState(false);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTour(root.classList.contains("fd-motion") && !root.classList.contains("fd-calm"));
    const el = box.current;
    if (!el) return;
    const seen = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.45 });
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  const choose = (i: number) => (setAt(i), setTour(false));
  const shows = [<NextDemo key="demo" />, <TeleprompterPreview key="prompter" />, <VCamPreview key="relay" />, own];

  function keys(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const to = (at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    choose(to);
    document.getElementById(`lp-feature-tab-${tabs[to].id}`)?.focus();
  }

  return (
    <div
      className="lp-features"
      ref={box}
      data-tour={tour ? "" : undefined}
      data-run={tour && inView && !hold ? "" : undefined}
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
    >
      <div className="lp-feature-tabs" role="tablist" aria-label="Features" onKeyDown={keys}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`lp-feature-tab-${t.id}`}
            aria-selected={i === at}
            aria-controls={`lp-feature-${t.id}`}
            tabIndex={i === at ? 0 : -1}
            className={i === at ? "lp-feature-tab is-on" : "lp-feature-tab"}
            onClick={() => choose(i)}
          >
            {t.tab}
            {tour && i === at && (
              <span className="lp-feature-bar" aria-hidden="true">
                <i key={at} onAnimationEnd={() => setAt((at + 1) % tabs.length)} />
              </span>
            )}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <Panel key={t.id} tab={t} active={i === at}>
          {shows[i]}
        </Panel>
      ))}
    </div>
  );
}
