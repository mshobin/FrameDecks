"use client";

import { useEffect, useRef, type CSSProperties } from "react";

// The promise, said once in the serif: its words light up one by one as the reader scrolls through it.
// One CSS variable (--p, 0 to 1) is written per frame, and only while the statement is on screen; each word works
// out its own brightness from it in CSS. With "reduce motion" every word is simply lit.
export function Statement({ before, gold }: Readonly<{ before: string; gold: string }>) {
  const ref = useRef<HTMLElement>(null);
  const words = [...before.split(" ").map((w) => ({ w, gold: false })), ...gold.split(" ").map((w) => ({ w, gold: true }))];

  useEffect(() => {
    const el = ref.current;
    if (!el || !document.documentElement.classList.contains("fd-motion")) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const p = (innerHeight * 0.85 - box.top) / (innerHeight * 0.6);
      el.style.setProperty("--p", Math.max(0, Math.min(1, p)).toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const seen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        addEventListener("scroll", onScroll, { passive: true });
        paint();
      } else {
        removeEventListener("scroll", onScroll);
        paint(); // settle at fully lit (above) or unlit (below)
      }
    });
    seen.observe(el);
    return () => {
      seen.disconnect();
      removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="lp-statement" ref={ref} aria-label="Our promise" style={{ "--n": words.length } as CSSProperties}>
      <p className="fd-serif">
        {words.map(({ w, gold: g }, i) => (
          <span key={`${w}-${i}`}>
            <span className={g ? "lp-sw lp-sw-gold" : "lp-sw"} style={{ "--i": i } as CSSProperties}>
              {w}
            </span>{" "}
          </span>
        ))}
      </p>
    </section>
  );
}
