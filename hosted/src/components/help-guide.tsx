"use client";

// FrameDecks 8.4 - the step-by-step guide on the Help page: the website and the service PC, eight steps each, every
// step with a real screenshot and the place to click circled. Content: lib/help-guide.ts; pictures and circles:
// tests/visual/help-shots.mjs (public/help, lib/help-shots.json).
import { useMemo, useState, type ReactNode } from "react";
import { Laptop, MonitorPlay, Search, Sparkles, X } from "lucide-react";

import { CORE, GUIDE, searchGuide, type GuideStep, type GuideTrack } from "@/lib/help-guide";
import SHOTS from "@/lib/help-shots.json";
import "@/app/help/guide.css";

type Shots = Record<string, { w: number; h: number; spots: Record<string, number[]> }>;
const shots = SHOTS as Shots;

/** "Choose **Save**" with the label in bold */
function words(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

/** The screen, zoomed in on the circled place so it is readable on a phone; a tap shows the whole screen. */
function Shot({ step }: Readonly<{ step: GuideStep }>) {
  const [whole, setWhole] = useState(false);
  const s = shots[step.shot];
  const spot = s?.spots[step.spot];
  let z = 1, left = 0, top = 0;
  if (spot && !whole) {
    z = Math.max(1, Math.min(2.4, 46 / Math.max(spot[2], spot[3] * 1.2)));
    const view = 100 / z;
    left = Math.min(Math.max(spot[0] + spot[2] / 2 - view / 2, 0), 100 - view);
    top = Math.min(Math.max(spot[1] + spot[3] / 2 - view / 2, 0), 100 - view);
  }
  return (
    <figure className="hg-shot">
      <button
        type="button"
        className="hg-frame"
        style={s ? { aspectRatio: `${s.w} / ${s.h}` } : undefined}
        aria-label={whole ? "Zoom in on the place to click" : "Show the whole screen"}
        onClick={() => setWhole((w) => !w)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a plain static picture, the site is a static export */}
        <img
          src={`/help/${step.shot}.jpg`}
          alt={`${step.title}: ${step.ui.join(", ")}`}
          loading="lazy"
          decoding="async"
          style={{ transform: `scale(${z}) translate(${-left}%, ${-top}%)` }}
        />
        {spot && (
          <span
            className="hg-spot"
            aria-hidden="true"
            style={{ left: `${(spot[0] - left) * z}%`, top: `${(spot[1] - top) * z}%`, width: `${spot[2] * z}%`, height: `${spot[3] * z}%` }}
          />
        )}
      </button>
      <figcaption>
        {step.caption ? <b>{step.caption}</b> : <>Click {step.ui.slice(0, 2).map((u, i) => <b key={u}>{i ? " then " : ""}{u}</b>)}</>}
        <span> · {whole ? "tap to zoom in" : "tap for the whole screen"}</span>
      </figcaption>
    </figure>
  );
}

function StepCard({ step, n, track }: Readonly<{ step: GuideStep; n: number; track: GuideTrack }>) {
  return (
    <li className="hg-step" id={step.id}>
      <div className="hg-text">
        <p className="hg-kicker">
          <span className="hg-num" aria-hidden="true">{n}</span>
          {track === "website" ? "Website" : "Service PC"} · {CORE[step.core - 1]}
        </p>
        <h3>{step.title}</h3>
        <p className="hg-why">{step.why}</p>
        <ol className="hg-do">
          {step.steps.map((t) => (
            <li key={t}>{words(t)}</li>
          ))}
        </ol>
        {step.tip && (
          <p className="hg-tip">
            <Sparkles aria-hidden="true" size={15} /> {step.tip}
          </p>
        )}
      </div>
      <Shot step={step} />
    </li>
  );
}

export function HelpGuide() {
  const [track, setTrack] = useState<GuideTrack>("website");
  const [query, setQuery] = useState("");
  const found = useMemo(() => (query.trim() ? searchGuide(query) : null), [query]);
  const list = found ?? GUIDE[track].steps.map((step) => ({ track, step }));

  return (
    <section className="hg" aria-labelledby="guide">
      <h2 id="guide">Step-by-step guide</h2>
      <p className="hg-lead">From opening your workspace to running the meeting, with the place to click circled on each picture.</p>
      <div className="hg-bar">
        <div className="hg-tabs" role="tablist" aria-label="Where you are working">
          <button type="button" role="tab" aria-selected={!found && track === "website"} onClick={() => (setTrack("website"), setQuery(""))}>
            <Laptop aria-hidden="true" size={18} /> Website
          </button>
          <button type="button" role="tab" aria-selected={!found && track === "pc"} onClick={() => (setTrack("pc"), setQuery(""))}>
            <MonitorPlay aria-hidden="true" size={18} /> Service PC
          </button>
        </div>
        <label className="hg-search">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search the guide</span>
          <input type="search" placeholder="Search the guide: export, Teleprompter, Spotlight…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button type="button" aria-label="Clear the search" onClick={() => setQuery("")}>
              <X aria-hidden="true" size={16} />
            </button>
          )}
        </label>
      </div>
      {!found && (
        <nav className="hg-map" aria-label={`${GUIDE[track].title}: the steps`}>
          <p>{GUIDE[track].lead}</p>
          <ol>
            {GUIDE[track].steps.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <span>{i + 1}</span> {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {found && (
        <p className="hg-found" role="status">
          {found.length ? `${found.length} step${found.length === 1 ? "" : "s"} for “${query.trim()}”` : `Nothing in the guide for “${query.trim()}”. Try another word, or see the questions below.`}
        </p>
      )}
      <ol className="hg-steps" key={found ? `q${query}` : track}>
        {list.map(({ track: t, step }) => (
          <StepCard key={step.id} step={step} track={t} n={GUIDE[t].steps.indexOf(step) + 1} />
        ))}
      </ol>
    </section>
  );
}
