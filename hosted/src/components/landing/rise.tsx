"use client";

import { useEffect } from "react";

// 26.11.4 the front page's sections arrive with the scroll (owner, 8 November): each [data-rise] element's place on
// screen sets how far it has risen in (fading up from 28 px below, a touch smaller), so scrolling back plays it
// backwards. The number in data-rise staggers neighbours (0, 1, 2 …); data-rx adds a sideways start in px. A spring
// follows the scroll, so a trackpad's many small steps read as one movement; settled once the element is well in
// view, and whatever is above the screen (or the end of the page) is always fully shown.
// Content is visible without JavaScript and stays still for less motion or "Reduce effects" (html.fd-calm). Light on
// resources: the scroll listener is attached only while one of them is near the screen, one animation frame loop runs
// only until they settle, and only transform and opacity change. [data-in] is set once one has fully arrived (the
// closing title's sheen, landing-page.css).
export function Rise() {
  useEffect(() => {
    const html = document.documentElement;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => !still.matches && html.classList.contains("fd-motion") && !html.classList.contains("fd-calm");
    const all = Array.from(document.querySelectorAll<HTMLElement>("[data-rise]")).map((el) => ({
      el,
      i: Number(el.dataset.rise) || 0,
      rx: Number(el.dataset.rx) || 0,
      x: -1,
      v: 0,
    }));
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const moving = on();
      const h = innerHeight;
      const end = scrollY + h >= html.scrollHeight - 2;
      // read every place first, then write
      const goals = all.map(({ el, i }) => (end ? 1 : Math.min(1, Math.max(0, (h * (1 - 0.05 * i) - el.getBoundingClientRect().top) / (h * 0.25)))));
      let busy = false;
      all.forEach((r, k) => {
        const { el } = r;
        if (!moving) {
          r.x = -1;
          ["opacity", "transform"].forEach((p) => el.style.removeProperty(p));
          el.setAttribute("data-in", "");
          return;
        }
        const to = goals[k];
        if (r.x < 0) r.x = to; // the first picture is where the page is
        r.v += (144 * (to - r.x) - 24 * r.v) * dt; // a critically damped spring, 12 per second
        r.x += r.v * dt;
        if (Math.abs(to - r.x) < 1e-3 && Math.abs(r.v) < 1e-2) [r.x, r.v] = [to, 0];
        else busy = true;
        const e = 1 - (1 - Math.min(1, Math.max(0, r.x))) ** 3;
        el.style.opacity = e.toFixed(3);
        el.style.transform = e > 0.999 ? "none" : `translate3d(${(r.rx * (1 - e)).toFixed(1)}px, ${(28 * (1 - e)).toFixed(1)}px, 0) scale(${(0.97 + 0.03 * e).toFixed(4)})`;
        if (e > 0.99) el.setAttribute("data-in", "");
        else if (e < 0.01) el.removeAttribute("data-in");
      });
      if (busy) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const near = new Set<Element>();
    const watch = new IntersectionObserver(
      (entries) => {
        for (const e of entries) near[e.isIntersecting ? "add" : "delete"](e.target);
        if (near.size) addEventListener("scroll", kick, { passive: true });
        else removeEventListener("scroll", kick);
        kick(); // one last look as the last one leaves, so nothing is left half way
      },
      { rootMargin: "25% 0px" },
    );
    all.forEach((r) => watch.observe(r.el));
    const mode = new MutationObserver(kick);
    mode.observe(html, { attributes: true, attributeFilter: ["class"] });
    addEventListener("resize", kick, { passive: true });
    kick();
    return () => {
      watch.disconnect();
      mode.disconnect();
      removeEventListener("scroll", kick);
      removeEventListener("resize", kick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
