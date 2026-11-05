"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";

import { FeatureTabs, type FeatureTab } from "@/components/landing/feature-tabs";
import { HowItWorks, type Step } from "@/components/landing/how-it-works";

// 9.11.1 "How it works" and "See it work" in one stage, so the page is a whole screen shorter: a two-part switch
// above one window. The days play through (3 s each), then the stage glides into the features (3.5 s each) and back,
// by itself, while it is on screen; pointing at it holds, choosing a part stops the tour (as before). The header's
// "How it works" (/#how) and "See it work" (/#features) both land here, on their part.

export type Chapter = Readonly<{ id: "how" | "see"; label: string; title: string; lead: string }>;

export function chapterFromHash(hash: string): 0 | 1 | null {
  if (hash === "#how") return 0;
  if (hash === "#features") return 1;
  return null;
}

export function Showcase({
  chapters,
  steps,
  tabs,
  extra,
}: Readonly<{ chapters: readonly [Chapter, Chapter]; steps: readonly Step[]; tabs: readonly FeatureTab[]; extra: ReactNode }>) {
  const [at, setAt] = useState<0 | 1>(0);
  const [chosen, setChosen] = useState(false); // a visitor picked a part: no more switching by itself

  useEffect(() => {
    const read = () => {
      const c = chapterFromHash(window.location.hash);
      if (c !== null) {
        setAt(c);
        setChosen(true);
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const choose = (i: 0 | 1) => {
    setAt(i);
    setChosen(true);
  };
  const next = () => {
    if (!chosen) setAt((c) => (c === 0 ? 1 : 0));
  };

  function keys(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const to = at === 0 ? 1 : 0;
    choose(to);
    document.getElementById(`lp-show-tab-${chapters[to].id}`)?.focus();
  }

  const c = chapters[at];
  return (
    <section className="lp-section lp-show" id="how" aria-labelledby="lp-show-title" data-chapter={c.id}>
      <span id="features" className="lp-show-anchor" aria-hidden="true" />
      <div className="lp-head" data-reveal="">
        <div className="lp-feature-tabs lp-show-switch" role="tablist" aria-label="How it works and See it work" onKeyDown={keys}>
          {chapters.map((ch, i) => (
            <button
              key={ch.id}
              type="button"
              role="tab"
              id={`lp-show-tab-${ch.id}`}
              aria-selected={i === at}
              aria-controls="lp-show-stage"
              tabIndex={i === at ? 0 : -1}
              className={i === at ? "lp-feature-tab is-on" : "lp-feature-tab"}
              onClick={() => choose(i as 0 | 1)}
            >
              {ch.label}
            </button>
          ))}
        </div>
        <h2 id="lp-show-title" className="lp-h2" key={`t-${c.id}`}>
          {c.title}
        </h2>
        <p key={`l-${c.id}`}>{c.lead}</p>
      </div>
      {/* Both parts stay in the page (the inactive one hidden), so their words are there for search and screen
          readers; a hidden part's tour waits, as it does off screen */}
      <div className="lp-show-stage" id="lp-show-stage" role="tabpanel" aria-labelledby={`lp-show-tab-${c.id}`} data-reveal="" data-spotlight="">
        <div className="lp-show-part" hidden={at !== 0}>
          <HowItWorks steps={steps} eyebrow={chapters[0].label} title={chapters[0].title} lead={chapters[0].lead} embedded onLoopEnd={next} />
        </div>
        <div className="lp-show-part" hidden={at !== 1}>
          <FeatureTabs tabs={tabs} private={extra} onLoopEnd={next} />
        </div>
      </div>
    </section>
  );
}
