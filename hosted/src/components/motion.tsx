"use client";

import { useEffect } from "react";

// The website's motion (docs: design.css "Motion"). Three jobs, all cheap enough to sit next to the program:
// 1. [data-reveal] rises into place the first time it scrolls into view. Content is visible without JavaScript:
//    nothing is hidden until this has run (html.fd-reveal-ready), whatever is already on screen shows at once, and
//    anything scrolled past (an anchor jump, a fast flick) is shown too, so no section can stay invisible.
// 2. [data-loop] marks a gentle endless loop (marquee, light beam, teleprompter). It runs only while on screen:
//    this sets [data-live] when the element is visible and removes it when not; CSS keeps every loop paused otherwise.
// 3. [data-spotlight] carries a soft light that follows the pointer, at most once per frame.
// None of it runs for people who ask their device for less motion or turn on "Reduce effects" (html.fd-calm).
export function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    const motion = root.classList.contains("fd-motion");

    // ---------- 1. Reveal ----------
    const pending = new Set<Element>();
    const show = (el: Element) => {
      el.setAttribute("data-in", ""); // an attribute React never rewrites (a class can be replaced on re-render)
      pending.delete(el);
      seen.unobserve(el);
    };
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting || e.boundingClientRect.bottom < 0) show(e.target);
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
    const track = (el: Element) => {
      if (el.hasAttribute("data-in") || pending.has(el)) return;
      // Already on screen or above it when found: shown now (no flash, nothing left behind an anchor jump)
      if (!motion || el.getBoundingClientRect().top < innerHeight) {
        el.setAttribute("data-in", "");
        return;
      }
      pending.add(el);
      seen.observe(el);
    };
    const watch = (scope: ParentNode) => scope.querySelectorAll?.("[data-reveal]").forEach(track);
    watch(document);
    root.classList.add("fd-reveal-ready"); // from here on, what is still below the fold waits to rise in

    // The safety net: after any scroll, whatever has reached the screen or gone past it is shown
    let sweepFrame = 0;
    const sweep = () => {
      sweepFrame = 0;
      for (const el of pending) if (el.getBoundingClientRect().top < innerHeight) show(el);
    };
    const onScroll = () => {
      if (pending.size && !sweepFrame) sweepFrame = requestAnimationFrame(sweep);
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("hashchange", onScroll);

    // ---------- 2. Loops run only while visible ----------
    const loops = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.toggleAttribute("data-live", e.isIntersecting);
      },
      { rootMargin: "80px 0px" },
    );
    const watchLoops = (scope: ParentNode) => scope.querySelectorAll?.("[data-loop]").forEach((el) => loops.observe(el));
    if (motion) watchLoops(document);

    // Pages fill in after loading (workspace data, dialogs): watch what arrives
    const added = new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes) {
          if (!(n instanceof Element)) continue;
          if (n.matches("[data-reveal]")) track(n);
          watch(n);
          if (motion) {
            if (n.matches("[data-loop]")) loops.observe(n);
            watchLoops(n);
          }
        }
    });
    added.observe(document.body, { childList: true, subtree: true });

    // ---------- 3. The light that follows the pointer ----------
    let next: PointerEvent | null = null;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const event = next;
      next = null;
      const el = (event?.target as Element | null)?.closest?.("[data-spotlight]") as HTMLElement | null;
      if (!event || !el) return;
      const box = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${event.clientX - box.left}px`);
      el.style.setProperty("--my", `${event.clientY - box.top}px`);
    };
    const follow = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return; // touch screens have no hover light
      next = event;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    document.addEventListener("pointermove", follow, { passive: true });

    return () => {
      seen.disconnect();
      loops.disconnect();
      added.disconnect();
      removeEventListener("scroll", onScroll);
      removeEventListener("hashchange", onScroll);
      document.removeEventListener("pointermove", follow);
      if (frame) cancelAnimationFrame(frame);
      if (sweepFrame) cancelAnimationFrame(sweepFrame);
    };
  }, []);
  return null;
}

/** The stage light behind every page: two soft glows, navy and gold, that drift for about a minute after the page
 *  opens and then rest (motion.css), so an idle page draws nothing. */
export function Ambient() {
  return (
    <div className="fd-ambient" aria-hidden="true">
      <i className="fd-glow fd-glow-navy" />
      <i className="fd-glow fd-glow-gold" />
    </div>
  );
}
