"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";

// The hero: the headline rises in word by word (blur to sharp), the second line in gold that catches the light once.
// The Studio window arrives tilted back and settles flat, then leans a little toward the mouse (desktop, at most 6°).
// The phone floats over its corner and a soft gold beam sways behind it while the hero is on screen (motion.tsx).

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

function Words({ text, start, className }: Readonly<{ text: string; start: number; className?: string }>) {
  return (
    <span className={className ? `lp-line ${className}` : "lp-line"}>
      {text.split(" ").map((w, i) => (
        <span key={`${w}-${i}`}>
          <span className="lp-word" style={delay(start + i * 80)}>
            {w}
          </span>{" "}
        </span>
      ))}
    </span>
  );
}

export function LandingHero({
  pill,
  first,
  second,
  lede,
  actions,
  trust,
}: Readonly<{ pill: string; first: string; second: string; lede: string; actions: ReactNode; trust: string }>) {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    const ok = matchMedia("(min-width: 961px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!el || !ok.matches) return;
    const hero = el.closest("section");
    if (!hero) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      if (document.documentElement.classList.contains("fd-calm")) return;
      const box = el.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (x - (box.left + box.width / 2)) / (box.width / 2)));
      const dy = Math.max(-1, Math.min(1, (y - (box.top + box.height / 2)) / (box.height / 2)));
      el.style.setProperty("--ry", `${(dx * 6).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-dy * 4).toFixed(2)}deg`);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const leave = () => {
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--rx", "0deg");
    };
    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerleave", leave);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const secondStart = 120 + first.split(" ").length * 80;
  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero-copy">
        <p className="lp-pill fd-enter" style={delay(0)}>
          <span className="lp-pill-dot" aria-hidden="true" /> {pill}
        </p>
        <h1 id="lp-hero-title" className="lp-title">
          <Words text={first} start={120} /> <Words text={second} start={secondStart} className="lp-sheen" />
        </h1>
        <p className="lp-lede fd-enter" style={delay(secondStart + 260)}>
          {lede}
        </p>
        <div className="fd-enter" style={delay(secondStart + 360)}>
          {actions}
        </div>
        <p className="lp-trust fd-enter" style={delay(secondStart + 460)}>
          {trust}
        </p>
      </div>

      <figure className="lp-stage">
        <div className="lp-beam" data-loop="" aria-hidden="true" />
        <div className="lp-stage-tilt" ref={stage}>
          <div className="lp-stage-in">
            <div className="lp-window fd-framed">
              <div className="lp-window-bar" aria-hidden="true">
                <i />
                <i />
                <i />
                <span>FrameDecks Studio</span>
              </div>
              <Image
                src="/product/studio.webp"
                alt="The FrameDecks Studio on the presenting PC: the running order on the left and what is on screen in the middle"
                width={1200}
                height={480}
                priority
                unoptimized
              />
            </div>
            <div className="lp-float-phone" data-loop="">
              <Image
                src="/product/live-phone.webp"
                alt="The website's Live page on a phone: Previous, Next, Hide all and Black screen"
                width={390}
                height={844}
                priority
                unoptimized
              />
            </div>
          </div>
        </div>
        <figcaption>The Studio on your PC. What you see is what the room and the stream see.</figcaption>
      </figure>
    </section>
  );
}
