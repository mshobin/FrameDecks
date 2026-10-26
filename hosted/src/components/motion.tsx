"use client";

import { useEffect } from "react";

// The website's motion (docs: design.css "Motion"): anything marked data-reveal rises into place the first time it
// scrolls into view, and anything marked data-spotlight carries a soft light that follows the pointer. Only classes
// and two CSS variables change; the animation itself is CSS, and none of it runs for people who ask for less motion.
export function Motion() {
  useEffect(() => {
    // The class itself is set before the first paint (layout.tsx), so nothing flashes before it hides
    if (!document.documentElement.classList.contains("fd-motion")) return;

    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", ""); // an attribute React never rewrites (a class can be replaced on re-render)
          seen.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const watch = (scope: ParentNode) =>
      scope.querySelectorAll?.("[data-reveal]:not([data-in])").forEach((el) => seen.observe(el));
    watch(document);
    // Pages fill in after loading (workspace data, dialogs): watch what arrives
    const added = new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes) {
          if (!(n instanceof Element)) continue;
          if (n.matches("[data-reveal]:not([data-in])")) seen.observe(n);
          watch(n); // and anything revealed inside it
        }
    });
    added.observe(document.body, { childList: true, subtree: true });

    const follow = (event: PointerEvent) => {
      const el = (event.target as Element | null)?.closest?.("[data-spotlight]") as HTMLElement | null;
      if (!el) return;
      const box = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${event.clientX - box.left}px`);
      el.style.setProperty("--my", `${event.clientY - box.top}px`);
    };
    document.addEventListener("pointermove", follow, { passive: true });

    return () => {
      seen.disconnect();
      added.disconnect();
      document.removeEventListener("pointermove", follow);
    };
  }, []);
  return null;
}

/** The light behind every page: three soft glows drifting slowly (transform only, so it costs almost nothing). */
export function Ambient() {
  return (
    <div className="fd-ambient" aria-hidden="true">
      <span className="fd-orb fd-orb-gold" />
      <span className="fd-orb fd-orb-blue" />
      <span className="fd-orb fd-orb-deep" />
    </div>
  );
}
