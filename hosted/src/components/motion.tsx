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

    // At most once per frame, and only over a card that has the light (a mouse moves ~120 times a second)
    let pending: PointerEvent | null = null;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const event = pending;
      pending = null;
      const el = (event?.target as Element | null)?.closest?.("[data-spotlight]") as HTMLElement | null;
      if (!event || !el) return;
      const box = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${event.clientX - box.left}px`);
      el.style.setProperty("--my", `${event.clientY - box.top}px`);
    };
    const follow = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return; // touch screens have no hover light
      pending = event;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    document.addEventListener("pointermove", follow, { passive: true });

    return () => {
      seen.disconnect();
      added.disconnect();
      document.removeEventListener("pointermove", follow);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}

/** The light behind every page: soft glows painted once (motion.css), so an idle page costs nothing. */
export function Ambient() {
  return <div className="fd-ambient" aria-hidden="true" />;
}
