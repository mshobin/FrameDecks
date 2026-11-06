"use client";

import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";

// 26.11.2 the front page's stage (owner's brief, 6 November; app/tour.css, docs/development/design-system.md "Landing").
// On arrival, with no scrolling, a meeting builds itself: a Frame, its Decks, their Content, joined by lines in the
// app's own level colours; then each card flies to its place in the real Studio and the screenshot takes over. From
// there the page's scroll moves through the program, one real screenshot per chapter (tools/make_product_shots.py
// writes them all): the Command Center (Alt+Space), the Teleprompter, Spotlight on the live picture, the Command
// Center's Control chip while live, and the phone remote. Every key shown is the app's own.
// Light on resources: one passive scroll listener, attached only while the stage is on screen and batched to one
// frame; only transform and opacity move; nothing runs at rest. "Reduce effects" (html.fd-calm) shows the finished
// Studio at once; with less motion asked for (no html.fd-motion) the steps still arrive one by one, without moving.

export type TourChapter = { id: string; label: string; eyebrow: string; title: string; text: ReactNode };

/** The keys as the app writes them, e.g. "Alt+Space" or "Ctrl". */
export function Keys({ k }: Readonly<{ k: string }>) {
  return (
    <span className="tr-keys">
      {k.split("+").map((p, i) => (
        <Fragment key={p}>
          {i > 0 && "+"}
          <kbd>{p}</kbd>
        </Fragment>
      ))}
    </span>
  );
}

// Where each card sits in the flowchart and where it lands in the Studio screenshot (stage pixels, 1000 × 620; the
// screenshot is drawn 1000 × 400 from y 110). The flight is one transform from the first to the second.
type Card = { cls: string; at: readonly [number, number, number, number]; to: readonly [number, number, number, number]; kind: string; text: string };
const CARDS: readonly Card[] = [
  { cls: "tr-frame", at: [380, 108, 240, 66], to: [8, 257, 171, 62], kind: "Frame 1", text: "Bible Study" },
  { cls: "tr-deck", at: [150, 236, 200, 44], to: [8, 393, 171, 33], kind: "", text: "Scripture" },
  { cls: "tr-deck", at: [610, 236, 220, 44], to: [8, 429, 171, 33], kind: "", text: "Question" },
  { cls: "tr-item tr-verse", at: [150, 330, 200, 92], to: [506, 217, 179, 30], kind: "Psalm 119:105", text: "Thy word is a lamp unto my feet, and a light unto my path." },
  { cls: "tr-item", at: [470, 330, 160, 92], to: [200, 407, 258, 39], kind: "Question 1", text: "What does this passage reveal about the character of God?" },
  { cls: "tr-item", at: [640, 330, 160, 92], to: [467, 407, 258, 39], kind: "Question 2", text: "Which phrase in this passage stood out to you most, and why?" },
  { cls: "tr-item", at: [810, 330, 160, 92], to: [732, 407, 258, 39], kind: "Question 3", text: "Think of a situation you are facing right now." },
];

function cardStyle(c: Card, i: number) {
  const [x, y, w, h] = c.at;
  const [X, Y, W, H] = c.to;
  return {
    left: x,
    top: y,
    width: w,
    height: h,
    "--d": `${[0, 0, 60, 0, 50, 100, 150][i]}ms`,
    "--to": `translate3d(${X - x}px, ${Y - y}px, 0) scale(${(W / w).toFixed(3)}, ${(H / h).toFixed(3)})`,
  } as CSSProperties;
}

const LINES = [
  ["tr-a1", "M500 174 C500 205 250 205 250 236"],
  ["tr-a1", "M500 174 C500 205 720 205 720 236"],
  ["tr-a2", "M250 280 C250 305 250 305 250 330"],
  ["tr-a2", "M720 280 C720 305 550 305 550 330"],
  ["tr-a2", "M720 280 C720 305 720 305 720 330"],
  ["tr-a2", "M720 280 C720 305 890 305 890 330"],
] as const;

// One real screenshot per chapter after the Studio, with the keys that chapter is about
type Scene = { src: string; w: number; h: number; cls: string; alt: string; keys: readonly (readonly [string, string])[] };
const SCENES: readonly Scene[] = [
  { src: "/product/command-center.webp", w: 820, h: 270, cls: "tr-sc-cc", alt: "The Command Center: a search bar and the chips Prepare, Engage, Control, Notes and More", keys: [["Alt+Space", "opens it anywhere"]] },
  { src: "/product/teleprompter.webp", w: 1100, h: 640, cls: "tr-sc-tp", alt: "The Teleprompter showing the presenter's script", keys: [["R", "Teleprompter"], ["V", "Follow my voice"]] },
  { src: "/product/annotate.webp", w: 1000, h: 490, cls: "tr-sc-an", alt: "A soft spotlight on a word of the live scripture, and an underline", keys: [["Ctrl", "twice: Spotlight"], ["Alt+D", "Draw"]] },
  { src: "/product/command-center-live.webp", w: 820, h: 720, cls: "tr-sc-live", alt: "The Command Center's Control chip while a Frame is live: Go Live, Previous, Next Frame, Hide all and Black", keys: [["Alt+→", "Next Frame"], ["Alt+H", "Hide all"], ["Alt+B", "Black screen"]] },
  { src: "/product/phone-remote.webp", w: 390, h: 844, cls: "tr-sc-phone", alt: "The phone remote: what is on screen, Previous and Next, and the meeting plan", keys: [] },
];

const PHASES = ["is-frame", "is-decks", "is-items", "is-studio", "is-done"];

/** The pinned stage and its chapters. `intro` is the first chapter's words (the page's headline and actions). */
export function Tour({ intro, chapters }: Readonly<{ intro: ReactNode; chapters: readonly TourChapter[] }>) {
  const track = useRef<HTMLElement>(null);
  const fit = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const caps = useRef<(HTMLDivElement | null)[]>([]);
  const rail = useRef<(HTMLButtonElement | null)[]>([]);
  const replay = useRef<HTMLButtonElement>(null);
  const n = chapters.length + 1;

  useEffect(() => {
    const st = stage.current;
    const box = fit.current;
    const tr = track.current;
    if (!st || !box || !tr) return;
    const calm = document.documentElement.classList.contains("fd-calm");
    const name = st.querySelector(".tr-name") as HTMLElement;
    const scenes = Array.from(st.querySelectorAll<HTMLElement>(".tr-sc"));

    // ---- size: the stage is drawn at 1000 × 620 and scaled to the room it has ----
    const size = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      const s = Math.max(0.2, Math.min(w / 1000, h / 620));
      st.style.transform = `translate3d(${((w - 1000 * s) / 2).toFixed(1)}px, ${Math.max(0, (h - 620 * s) / 2).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
    };
    const ro = new ResizeObserver(size);
    ro.observe(box);
    size();

    // ---- the build: plays by itself once the stage is on screen ----
    let timers: number[] = [];
    const set = (cls: string, on = true) => st.classList.toggle(cls, on);
    const play = () => {
      timers.forEach(clearTimeout);
      timers = [];
      PHASES.forEach((p) => set(p, false));
      name.textContent = "";
      const word = "Bible Study";
      const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
      at(300, () => set("is-frame"));
      for (let i = 1; i <= word.length; i++) at(500 + i * 55, () => (name.textContent = word.slice(0, i)));
      at(1400, () => set("is-decks"));
      at(2200, () => set("is-items"));
      at(3300, () => set("is-studio"));
      at(4600, () => set("is-done"));
    };
    if (!calm) PHASES.forEach((p) => set(p, false));
    st.setAttribute("data-ready", "");
    let played = calm;
    const start = new IntersectionObserver(
      ([e]) => {
        if (!played && e.isIntersecting && document.visibilityState === "visible") {
          played = true;
          play();
        }
      },
      { threshold: 0.35 },
    );
    start.observe(box);
    const again = () => play();
    const button = replay.current;
    button?.addEventListener("click", again);

    // ---- the chapters: the page's scroll position chooses one ----
    let prev = -1;
    let boot = 0;
    const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    let raf = 0;
    const frame = () => {
      raf = 0;
      const r = tr.getBoundingClientRect();
      const x = clamp(-r.top / (tr.offsetHeight - innerHeight)) * n;
      const ch = Math.min(n - 1, Math.floor(x));
      const t = clamp(x - ch);
      if (ch !== prev) {
        st.dataset.ch = String(ch);
        caps.current.forEach((c, i) => c?.classList.toggle("is-on", i === ch));
        scenes.forEach((s, i) => {
          s.classList.toggle("is-on", i === ch - 1);
          s.classList.toggle("is-past", i < ch - 1);
        });
        rail.current.forEach((b, i) => {
          if (!b) return;
          b.classList.toggle("is-on", i === ch);
          if (i === ch) b.setAttribute("aria-current", "step");
          else b.removeAttribute("aria-current");
        });
        if (ch === 1) {
          // Alt+Space: the keys are pressed and the Command Center drops in
          set("is-boot", false);
          void st.offsetWidth;
          set("is-boot");
          clearTimeout(boot);
          boot = window.setTimeout(() => set("is-boot", false), 1800);
        }
        prev = ch;
      }
      rail.current.forEach((b, i) => b?.style.setProperty("--f", String(i < ch ? 1 : i === ch ? t : 0)));
      // a slow drift through the chapter: the screenshot rises a little as the page moves on
      const on = scenes[ch - 1];
      if (on) on.style.setProperty("--y", `${(-14 * t).toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const near = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        addEventListener("scroll", onScroll, { passive: true });
        onScroll();
      } else removeEventListener("scroll", onScroll);
    });
    near.observe(tr);
    frame();

    return () => {
      ro.disconnect();
      start.disconnect();
      near.disconnect();
      removeEventListener("scroll", onScroll);
      button?.removeEventListener("click", again);
      timers.forEach(clearTimeout);
      clearTimeout(boot);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [n]);

  const go = (i: number) => {
    const tr = track.current;
    if (!tr) return;
    const span = tr.offsetHeight - innerHeight;
    const top = tr.getBoundingClientRect().top + scrollY + span * ((i + 0.05) / n);
    scrollTo({ top, behavior: document.documentElement.classList.contains("fd-motion") ? "smooth" : "auto" });
  };

  const labels = ["Studio", ...chapters.map((c) => c.label)];

  return (
    <section className="tr" id="how" ref={track} aria-label="FrameDecks, from planning to presenting" style={{ "--n": n } as CSSProperties}>
      <div className="tr-pin">
        <div className="tr-caps">
          <div className="tr-cap is-on" ref={(el) => void (caps.current[0] = el)}>
            {intro}
          </div>
          {chapters.map((c, i) => (
            <div className="tr-cap" key={c.id} id={c.id} ref={(el) => void (caps.current[i + 1] = el)}>
              <p className="lp-eyebrow">{c.eyebrow}</p>
              <h2 className="tr-h">{c.title}</h2>
              <p className="tr-text">{c.text}</p>
            </div>
          ))}
        </div>

        <div className="tr-fit" ref={fit}>
          <div className="tr-stage is-frame is-decks is-items is-studio is-done" ref={stage} data-ch="0">
            {/* the real Studio stays behind every chapter, quieter once the program moves on */}
            <div className="tr-base">
              <Image src="/product/studio.webp" alt="The FrameDecks Studio: Frames and Decks on the left, the live preview, and the question cards under it" width={1200} height={480} priority unoptimized />
            </div>

            {/* the build: Frame → Decks → Content, then the Studio */}
            <div className="tr-build" aria-hidden="true">
              <div className="tr-steps">
                <span className="tr-s1">Frame</span>
                <i />
                <span className="tr-s2">Decks</span>
                <i />
                <span className="tr-s3">Content</span>
                <i />
                <span className="tr-s4">Studio</span>
              </div>
              <span className="tr-lv tr-l1">Frame</span>
              <span className="tr-lv tr-l2">Decks</span>
              <span className="tr-lv tr-l3">Content</span>
              <svg className="tr-links" viewBox="0 0 1000 620" width="1000" height="620">
                {LINES.map(([c, d]) => (
                  <path key={d} className={c} pathLength={1} d={d} />
                ))}
              </svg>
              {CARDS.map((c, i) => (
                <div key={c.text} className={`tr-b ${c.cls}`} style={cardStyle(c, i)}>
                  {c.cls === "tr-deck" && <i />}
                  {c.kind && <span className="tr-bk">{c.kind}</span>}
                  {c.cls === "tr-frame" ? (
                    <b>
                      <span className="tr-name">Bible Study</span>
                      <span className="tr-caret" />
                    </b>
                  ) : (
                    <span>{c.text}</span>
                  )}
                </div>
              ))}
            </div>

            {/* the chapters: the program's own screens */}
            {SCENES.map((s) => (
              <figure key={s.src} className={`tr-sc ${s.cls}`}>
                <Image src={s.src} alt={s.alt} width={s.w} height={s.h} unoptimized />
                {s.keys.length > 0 && (
                  <figcaption className="tr-callouts">
                    {s.keys.map(([k, what]) => (
                      <span key={k}>
                        <Keys k={k} /> {what}
                      </span>
                    ))}
                  </figcaption>
                )}
              </figure>
            ))}

            <div className="tr-bigkeys" aria-hidden="true">
              <kbd>Alt</kbd>+<kbd>Space</kbd>
            </div>
          </div>
          <button className="tr-replay" type="button" ref={replay}>
            ↻ Replay
          </button>
        </div>

        <nav className="tr-rail" aria-label="Chapters">
          {labels.map((l, i) => (
            <button key={l} type="button" className={i === 0 ? "is-on" : undefined} ref={(el) => void (rail.current[i] = el)} onClick={() => go(i)}>
              <i />
              {l}
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
