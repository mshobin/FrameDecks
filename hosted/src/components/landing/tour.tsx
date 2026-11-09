"use client";

import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";

// 26.11.2 the front page's stage (owner's brief, 6 November; app/tour.css, docs/development/design-system.md "Landing").
// On arrival, with no scrolling, a meeting builds itself: a Frame, its Decks, their Content, joined by lines in the
// app's own level colours; a moment later (HOLD), or as soon as the page is scrolled, each card flies to its place in
// the real Studio and the screenshot takes over. Scrolling back to the top turns the Studio back into the flowchart.
// From there the page's scroll moves through three chapters (26.11.26): Voice, the Teleprompter drawn in the app's own
// style (speaker.css) following the page's scroll word by word as Follow my voice follows the presenter, with the verse
// it hears arriving on the meeting screen; Control, the Command Center's real screenshot (tools/make_product_shots.py);
// and Together, Memory Cards from the chat and a member's phone following the meeting. Every key shown is the app's own.
// 26.11.4 every movement after the build is the scroll's own, forwards and backwards: no button to see it
// again and no one-off timers; scrolling back up plays it again.
// A spring follows the scroll (FOLLOW), so a trackpad's stream of small steps reads as one movement; the page's own
// scrolling is never held back or taken over.
// Light on resources: one passive scroll listener, attached only while the stage is on screen; one animation frame
// loop that runs only while the stage is still catching up and stops when it has settled; only transform and opacity
// move. "Reduce effects" (html.fd-calm) shows the finished Studio at once; with less motion asked for (no
// html.fd-motion) the steps still arrive one by one and the chapters change in place, without moving.

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

// Where each card sits in the flowchart (`at`: stage pixels, 1000 × 620; `tall`: the phone flowchart's own pixels, a
// narrower tree that keeps the words readable) and where it lands in the Studio screenshot (`to`).
// `to` is in the screenshot's own pixels (studio.webp, SHOT.w × SHOT.h), so after a retake by
// tools/make_product_shots.py only SHOT and these four numbers per card need checking: the place of the Frame, the two
// Decks, the verse and the three question cards in the new picture. The flight is one transform from one to the other.
type Box = readonly [number, number, number, number];
type Card = { cls: string; at: Box; tall: Box; to: Box; kind: string; text: string };
const SHOT = { w: 1200, h: 480, top: 110 }; // studio.webp's size, and where the stage draws it (1000 px wide from y 110)
const CARDS: readonly Card[] = [
  { cls: "tr-frame", at: [380, 108, 240, 66], tall: [140, 0, 240, 66], to: [9, 174, 207, 78], kind: "Frame 1", text: "Bible Study" },
  { cls: "tr-deck", at: [150, 236, 200, 44], tall: [0, 110, 250, 44], to: [9, 338, 207, 40], kind: "", text: "Scripture" },
  { cls: "tr-deck", at: [610, 236, 220, 44], tall: [270, 110, 250, 44], to: [9, 381, 207, 40], kind: "", text: "Question" },
  { cls: "tr-item tr-verse", at: [150, 330, 200, 92], tall: [20, 194, 230, 92], to: [455, 124, 307, 67], kind: "Psalm 119:105", text: "Thy word is a lamp unto my feet, and a light unto my path." },
  { cls: "tr-item", at: [470, 330, 160, 92], tall: [290, 194, 230, 84], to: [240, 392, 312, 48], kind: "Question 1", text: "What does this passage reveal about the character of God?" },
  { cls: "tr-item", at: [640, 330, 160, 92], tall: [290, 290, 230, 84], to: [558, 392, 313, 48], kind: "Question 2", text: "Which phrase in this passage stood out to you most, and why?" },
  { cls: "tr-item", at: [810, 330, 160, 92], tall: [290, 386, 230, 84], to: [877, 392, 312, 48], kind: "Question 3", text: "Think of a situation you are facing right now." },
];
const TALL = [520, 526, 56] as const; // the phone flowchart: width, height, and the room above it for the steps

function cardStyle(c: Card, i: number) {
  const [x, y, w, h] = c.at;
  return { left: x, top: y, width: w, height: h, "--d": `${[0, 0, 60, 0, 50, 100, 150][i]}ms` } as CSSProperties;
}

// the lines between them: [level, wide, tall]
const LINES = [
  ["tr-a1", "M500 174 C500 205 250 205 250 236", "M260 66 C260 88 125 88 125 110"],
  ["tr-a1", "M500 174 C500 205 720 205 720 236", "M260 66 C260 88 395 88 395 110"],
  ["tr-a2", "M250 280 C250 305 250 305 250 330", "M10 154 V240 H20"],
  ["tr-a2", "M720 280 C720 305 550 305 550 330", "M280 154 V236 H290"],
  ["tr-a2", "M720 280 C720 305 720 305 720 330", "M280 154 V332 H290"],
  ["tr-a2", "M720 280 C720 305 890 305 890 330", "M280 154 V428 H290"],
] as const;

// 26.11.26 three chapters after the Studio (owner, 9 November: "2 or 3 slides"), each one a whole part of the meeting:
// Voice (the Teleprompter following the voice, a verse heard and put on screen, a spoken "next frame"), Control (the
// Command Center over any app) and Together (Memory Cards from the chat, members following on their phones). The movement
// is drawn over the picture, never into it: a pointer that goes to the real control (in % of the picture) and presses
// it. The page's scroll drives it; `hot` lights each key's callout from that point of the chapter on.
type Move = { at: number; x: number; y: number; tap?: boolean };
type Scene = {
  src: string;
  w: number;
  h: number;
  cls: string;
  alt: string;
  keys: readonly (readonly [string, string])[];
  hot: readonly number[];
  moves?: readonly Move[];
  draw?: "tp" | "mc"; // drawn live in the program's own style instead of a screenshot (Teleprompter, Memory Cards)
};
const SCENES: readonly Scene[] = [
  {
    src: "",
    w: 0,
    h: 0,
    cls: "tr-sc-tp",
    alt: "",
    draw: "tp",
    keys: [
      ["V", "Follow my voice"],
      ["Right Ctrl", "hold: voice commands"],
    ],
    hot: [0, 0.8],
  },
  {
    src: "/product/cc-control.webp",
    w: 820,
    h: 720,
    cls: "tr-sc-live",
    alt: "The Command Center's Control chip while a Frame is live: Go Live, Previous, Next Frame, Hide all and Black screen",
    keys: [
      ["Alt+Space", "over any app"],
      ["Alt+→", "Next Frame"],
      ["Alt+H", "Hide all"],
    ],
    hot: [0, 0.42, 0.72],
    moves: [
      { at: 0, x: 70, y: 92 },
      { at: 0.2, x: 86.8, y: 44.9, tap: true },
      { at: 0.3, x: 86.8, y: 44.9 },
      { at: 0.42, x: 31.2, y: 63.6, tap: true },
      { at: 0.58, x: 31.2, y: 63.6 },
      { at: 0.72, x: 48.6, y: 62, tap: true },
      { at: 1, x: 48.6, y: 62 },
    ],
  },
  {
    src: "",
    w: 0,
    h: 0,
    cls: "tr-sc-mc",
    alt: "",
    draw: "mc",
    keys: [
      ["Ctrl+C", "a chat message becomes a Memory Card"],
      ["", "Members' phones: one code for everyone"],
    ],
    hot: [0, 0.66],
  },
];

// 26.11.3 Memory Cards (owner's request): a meeting's chat, three messages copied (Ctrl+C) one after another, each
// flying to the camera picture and popping up there as a bubble in the program's own overlay style (overlay.css
// .chat-list: initials, name, the words; pinned in gold), the picture shrinking beside them as FrameDecks vCam does.
type Chat = { who: string; ini: string; c: string; text: string };
const CHAT: readonly Chat[] = [
  { who: "Grace", ini: "G", c: "#b5651d", text: "Could we pray for my mother's surgery on Friday?" },
  { who: "Daniel", ini: "D", c: "#3a7bd5", text: "Verse 105 is my favourite: a light for each step." },
  { who: "Ruth", ini: "R", c: "#2e9e6b", text: "Joining from the car, I can hear you clearly." },
  { who: "Samuel", ini: "S", c: "#8a5cc7", text: "How do we stay faithful when the path is unclear?" },
];
const COPIED = [1, 3, 0] as const; // the rows copied, in copy order (the bubbles keep this order)
const COPY_AT = [0.04, 0.2, 0.36] as const; // where in the chapter each copy happens
const PIN_AT = 0.56; // ...when the prayer request is pinned
const PHONE_AT = 0.66; // ...and when the chat makes way for a member's phone following the meeting (/follow)

// The Teleprompter's script (the same words as the program's own capture)
const SCRIPT = [
  "Good evening, and welcome to week five of our study.",
  "Tonight we look at one simple idea: small faithful steps, taken together.",
  "Turn to the reading on the screen, Psalm 119:105.",
  "Take a moment with the first question before we share in groups.",
  "Then we will close in prayer.",
];
const BAND = 170; // where the reading line sits in the Teleprompter (as in the program, about a third of the way down)
// 26.11.26 the voice runs the meeting: once the reading passes the reference it is heard and offered (Show), shown on
// the meeting screen in the program's own scripture card (overlay.css: gold label, rule, words arriving softly), then a
// spoken "next frame" (Right Ctrl held) brings the question
const VERSE = "Thy word is a lamp unto my feet, and a light unto my path.";
const HEARD = SCRIPT.join(" ").split(" ").findIndex((w) => w.startsWith("119:105")); // the word after which it is heard
const SHOW_AT = 4; // words after that, Show is pressed
const SAY_AT = 0.8; // where in the chapter "next frame" is said...
const NEXT_AT = 0.9; // ...and the next Frame is on screen

const TPI = SCENES.findIndex((s) => s.draw === "tp") + 1; // the chapter numbers of the drawn chapters and the Command Center
const MCI = SCENES.findIndex((s) => s.draw === "mc") + 1;
const CCI = SCENES.findIndex((s) => s.cls === "tr-sc-live") + 1;
// 26.11.4 the build on arrival, brisk (owner, 8 November): ms after the stage is on screen for the Frame, its name
// typed a letter at a time, the Decks, the Content, and the moment the flowchart is complete
const BUILD = [80, 180, 600, 850, 1100] as const;
const HOLD = 1200; // 26.11.4 the finished flowchart stays this long, then the Studio takes over (at once if the page is scrolled)
const TAKE = 100; // ...or over the first pixels of scroll; scrolling back to the top turns the Studio back into the flowchart
const MIX = 0.3; // 26.11.3 how much of the scroll two neighbouring screens share while one hands over to the next
const RISE = 70; // ...and how far (stage pixels) a screen rises as it arrives, or as it leaves upwards
// 26.11.4 the stage follows the scroll through a critically damped spring (per second; higher is tighter): a trackpad's
// many small steps and a mouse wheel's few big ones both become one continuous movement, a little behind the page
const FOLLOW = 15;
const TAKEOVER = 8; // the flowchart-to-Studio flight is slower, so it reads as one gesture

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v: number) => (v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2);
/** One step of a critically damped spring towards `to`; false once it has settled there. */
function spring(m: { x: number; v: number }, to: number, w: number, dt: number) {
  m.v += (w * w * (to - m.x) - 2 * w * m.v) * dt;
  m.x += m.v * dt;
  if (Math.abs(to - m.x) > 2e-4 || Math.abs(m.v) > 2e-3) return true;
  m.x = to;
  m.v = 0;
  return false;
}

/** The pinned stage and its chapters. `intro` is the first chapter's words (the page's headline and actions). */
export function Tour({ intro, chapters }: Readonly<{ intro: ReactNode; chapters: readonly TourChapter[] }>) {
  const track = useRef<HTMLElement>(null);
  const fit = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const caps = useRef<(HTMLDivElement | null)[]>([]);
  const rail = useRef<(HTMLButtonElement | null)[]>([]);
  const n = chapters.length + 1;

  useEffect(() => {
    const st = stage.current;
    const box = fit.current;
    const tr = track.current;
    if (!st || !box || !tr) return;
    const html = document.documentElement;
    const calm = html.classList.contains("fd-calm");
    const q = <T extends Element = HTMLElement>(s: string) => Array.from(st.querySelectorAll<T & HTMLElement>(s));
    const name = st.querySelector(".tr-name") as HTMLElement;
    const build = st.querySelector(".tr-build") as HTMLElement;
    const keys = st.querySelector(".tr-bigkeys") as HTMLElement;
    const scenes = q(".tr-sc");
    const words = q(".tr-w");
    const bs = q(".tr-b");
    const paths = q<SVGPathElement>(".tr-links path");
    const script = st.querySelector(".tr-tp-text") as HTMLElement;
    const base = st.querySelector(".tr-base") as HTMLElement;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    // 26.11.3 one flow: with motion allowed, the page's scroll itself carries each screen in and the last one out
    // (screens rise as one page rather than swap); otherwise the chapters change as before, without movement
    const fluid = () => !still.matches && html.classList.contains("fd-motion") && !html.classList.contains("fd-calm");
    const layers = [base, ...scenes];
    const loose = () =>
      [...layers, ...caps.current, keys].forEach((l) => l && ["opacity", "transform", "visibility"].forEach((k) => l.style.removeProperty(k)));
    let said = -1;
    // Memory Cards: the copied rows, their bubbles and the card that flies between them (positions in stage pixels)
    const mcRoot = st.querySelector<HTMLElement>(".tr-mc");
    const mc = mcRoot && {
      root: mcRoot,
      rows: Array.from(mcRoot.querySelectorAll<HTMLElement>(".tr-mc-row")),
      msgs: Array.from(mcRoot.querySelectorAll<HTMLElement>(".tr-mc-msg")),
      ghost: mcRoot.querySelector<HTMLElement>(".tr-mc-ghost")!,
      ghostText: mcRoot.querySelector<HTMLElement>(".tr-mc-ghost span")!,
      pic: mcRoot.querySelector<HTMLElement>(".tr-mc-cam")!,
    };
    const rel = (el: HTMLElement) => {
      let x = 0;
      let y = 0;
      for (let e: HTMLElement | null = el; e && e !== mcRoot; e = e.offsetParent as HTMLElement | null) {
        x += e.offsetLeft;
        y += e.offsetTop;
      }
      return [x, y];
    };
    let flying = -1;
    const cards = (t: number) => {
      if (!mc) return;
      let fly = -1;
      let g = 0;
      COPIED.forEach((row, k) => {
        const at = COPY_AT[k];
        mc.rows[row].classList.toggle("is-sel", t >= at);
        mc.rows[row].classList.toggle("is-key", t >= at && t < at + 0.12);
        mc.msgs[k].classList.toggle("is-pop", t >= at + 0.17);
        const f = clamp((t - at - 0.04) / 0.13);
        if (f > 0 && f < 1) [fly, g] = [k, f];
      });
      mc.msgs[2].classList.toggle("is-pin", t >= PIN_AT);
      mc.root.classList.toggle("is-phone", t >= PHONE_AT);
      mc.pic.classList.toggle("is-room", t >= COPY_AT[0] + 0.15);
      // the copied card lifts off the chat and arcs onto the picture (only with motion; otherwise the bubbles simply appear)
      if (fly < 0 || !fluid()) {
        mc.ghost.style.opacity = "0";
        flying = -1;
        return;
      }
      if (fly !== flying) {
        mc.ghostText.textContent = CHAT[COPIED[fly]].text;
        flying = fly;
      }
      const [ax, ay] = rel(mc.rows[COPIED[fly]]);
      const [bx, by] = rel(mc.msgs[fly]);
      const e = ease(g);
      const gx = ax + 40 + (bx - ax - 40) * e;
      const gy = ay + 6 + (by - ay - 6) * e - Math.sin(Math.PI * e) * 70;
      mc.ghost.style.opacity = (g < 0.85 ? 1 : (1 - g) / 0.15).toFixed(3);
      mc.ghost.style.transform = `translate3d(${gx.toFixed(1)}px, ${gy.toFixed(1)}px, 0) rotate(${(-6 * Math.sin(Math.PI * e)).toFixed(2)}deg) scale(${(1 - 0.25 * e).toFixed(3)})`;
    };
    // the movement on each screen (Scene.moves), and the callout of the key in use (Scene.hot), driven by the
    // chapter's own progress
    const kit = scenes.map((fig, i) => ({
      fig,
      s: SCENES[i],
      ptr: fig.querySelector<HTMLElement>(".tr-ptr"),
      tap: fig.querySelector<HTMLElement>(".tr-tap"),
      calls: Array.from(fig.querySelectorAll<HTMLElement>(".tr-callouts > span")),
      fired: new Set<number>(),
    }));
    const px = (fig: HTMLElement, x: number, y: number) => [(x / 100) * fig.offsetWidth, (y / 100) * fig.offsetHeight];
    const move = (k: (typeof kit)[number], t: number) => {
      const { s, fig } = k;
      let hot = 0;
      s.hot.forEach((h, i) => void (t >= h && (hot = i)));
      k.calls.forEach((c, i) => c.classList.toggle("is-hot", i === hot));
      if (!s.moves || !k.ptr) return;
      const m = s.moves;
      let j = 0;
      while (j < m.length - 1 && m[j + 1].at <= t) j++;
      const a = m[j];
      const b = m[Math.min(j + 1, m.length - 1)];
      const f = b === a ? 0 : ease(clamp((t - a.at) / (b.at - a.at)));
      const [x, y] = px(fig, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
      k.ptr.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      m.forEach((p, i) => {
        if (!p.tap) return;
        if (t < p.at) k.fired.delete(i);
        else if (!k.fired.has(i) && t - p.at < 0.2 && k.tap) {
          k.fired.add(i);
          const [tx, ty] = px(fig, p.x, p.y);
          k.tap.style.left = `${tx}px`;
          k.tap.style.top = `${ty}px`;
          k.tap.classList.remove("is-tap");
          void k.tap.offsetWidth;
          k.tap.classList.add("is-tap");
        } else if (!k.fired.has(i)) k.fired.add(i);
      });
    };
    // the voice running the meeting beside the Teleprompter: heard, Show, on screen, "next frame", the next Frame
    const vo = st.querySelector<HTMLElement>(".tr-vo");
    const voice = (said: number, t: number) => {
      if (!vo) return;
      const heard = said > HEARD;
      const shown = said > HEARD + SHOW_AT;
      vo.classList.toggle("is-heard", heard && t < NEXT_AT);
      vo.classList.toggle("is-shown", shown);
      vo.classList.toggle("is-say", t >= SAY_AT);
      vo.classList.toggle("is-next", t >= NEXT_AT);
    };

    // ---- size: the stage is drawn at 1000 × 620 and scaled to the room it has. On a tall screen (a phone) the
    // flowchart takes its narrower shape at its own, larger scale, and each card's flight is worked out from there ----
    let flight: number[][] = [];
    let drawn = -1;
    const size = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      const s = Math.max(0.2, Math.min(w / 1000, h / 620));
      const sx = (w - 1000 * s) / 2;
      const sy = Math.max(0, (h - 620 * s) / 2);
      st.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
      const tall = w / h < 1.2;
      st.classList.toggle("is-tall", tall);
      let [k, bx, by] = [1, 0, 0];
      if (tall) {
        const [tw, th, tt] = TALL;
        const b = Math.min(w / (tw + 20), h / (th + 30), 1.3);
        [k, bx, by] = [b / s, ((w - tw * b) / 2 - sx) / s, ((h - th * b) / 2 + tt * b - sy) / s];
        build.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0) scale(${k.toFixed(4)})`;
      } else build.style.removeProperty("transform");
      paths.forEach((p, i) => p.setAttribute("d", LINES[i][tall ? 2 : 1]));
      const r = 1000 / SHOT.w;
      flight = CARDS.map((c, i) => {
        const [x, y, cw, ch] = tall ? c.tall : c.at;
        Object.assign(bs[i].style, { left: `${x}px`, top: `${y}px`, width: `${cw}px`, height: `${ch}px` });
        const [X, Y, W, H] = c.to;
        return [(X * r - bx) / k - x, (SHOT.top + Y * r - by) / k - y, (W * r) / k / cw, (H * r) / k / ch];
      });
      drawn = -1;
      kick();
    };
    const ro = new ResizeObserver(size);

    // ---- the build: plays by itself once the stage is on screen; the Studio follows after HOLD or on scroll ----
    const timers: number[] = [];
    let built = calm;
    let auto = calm ? 1 : 0; // 1 once HOLD has passed: the Studio shows without scrolling
    const set = (cls: string, on = true) => st.classList.toggle(cls, on);
    const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    const word = "Bible Study";
    const finish = () => {
      if (built) return;
      built = true;
      timers.forEach(clearTimeout);
      name.textContent = word;
      ["is-frame", "is-decks", "is-items"].forEach((c) => set(c));
      at(HOLD, () => {
        auto = 1;
        kick();
      });
    };
    const play = () => {
      at(BUILD[0], () => set("is-frame"));
      for (let i = 1; i <= word.length; i++) at(BUILD[1] + i * 35, () => (name.textContent = word.slice(0, i)));
      at(BUILD[2], () => set("is-decks"));
      at(BUILD[3], () => set("is-items"));
      at(BUILD[4], finish);
    };
    ["is-studio", "is-done", ...(calm ? [] : ["is-frame", "is-decks", "is-items"])].forEach((p) => set(p, false));
    if (!calm) name.textContent = "";
    st.setAttribute("data-ready", "");
    let played = calm;
    let seen = false;
    const begin = () => {
      if (played || !seen || document.visibilityState !== "visible") return;
      played = true;
      play();
    };
    const start = new IntersectionObserver(
      ([e]) => {
        seen = e.isIntersecting;
        begin();
      },
      { threshold: 0.35 },
    );
    start.observe(box);
    document.addEventListener("visibilitychange", begin);

    // ---- the chapters: the page's scroll position chooses one, and a spring carries the stage there ----
    let prev = -1;
    const X = { x: 0, v: 0 }; // where the stage is, in chapters (0 … n)
    const S = { x: calm ? 1 : 0, v: 0 }; // how far the flowchart has become the Studio (0 … 1)
    const opening = (s: number) => {
      if (s === drawn) return;
      drawn = s;
      set("is-studio", s >= 0.5);
      set("is-done", s > 0.999);
      st.toggleAttribute("data-fly", s > 0.001);
      st.style.setProperty("--s", s.toFixed(3));
      // each card lifts out of the flowchart and lands on its own place in the Studio, a moment after the one before
      bs.forEach((b, i) => {
        if (s <= 0.001) return ["transform", "opacity", "--c"].forEach((k) => b.style.removeProperty(k));
        const f = ease(clamp((s - i * 0.035) / 0.6));
        const [dx, dy, kx, ky] = flight[i];
        b.style.transform = `translate3d(${(dx * f).toFixed(1)}px, ${(dy * f).toFixed(1)}px, 0) scale(${(1 + (kx - 1) * f).toFixed(4)}, ${(1 + (ky - 1) * f).toFixed(4)})`;
        b.style.opacity = clamp((1 - s) / 0.25).toFixed(3);
        b.style.setProperty("--c", clamp(1 - s * 3).toFixed(3));
      });
    };
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const r = tr.getBoundingClientRect();
      const down = -r.top;
      if (down > 2) finish(); // scrolled on before the build has finished: it completes at once
      if (down > TAKE) {
        // from here the scroll alone decides: back at the top, the flowchart returns and stays
        auto = 0;
        timers.forEach(clearTimeout);
      }
      const goal = clamp(down / (tr.offsetHeight - innerHeight)) * n;
      const take = Math.max(auto, clamp(down / TAKE));
      const flow = fluid();
      let busy = false;
      if (prev < 0) [X.x, S.x] = [goal, take]; // the first picture is where the page is: no sweep from the top
      else if (flow) {
        const a = spring(X, goal, FOLLOW, dt);
        busy = spring(S, take, TAKEOVER, dt) || a;
      } else {
        X.x = goal;
        S.x = take < 0.5 ? 0 : 1;
      }
      if (busy) raf = requestAnimationFrame(frame);
      else last = 0;
      const x = X.x;
      opening(S.x);
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
        prev = ch;
      }
      rail.current.forEach((b, i) => b?.style.setProperty("--f", String(i < ch ? 1 : i === ch ? t : 0)));
      if (flow) {
        st.dataset.fluid = "";
        // each screen shares MIX of the scroll with its neighbours: it rises in as the last one rises away, and
        // drifts up a little while it is the one on show (the Teleprompter's words do their own moving); the words
        // above move with their screen
        const studio = clamp((S.x - 0.35) / 0.6);
        layers.forEach((l, i) => {
          const a = i === 0 ? studio : clamp((x - i + MIX / 2) / MIX);
          const b = i === n - 1 ? 1 : clamp((i + 1 + MIX / 2 - x) / MIX);
          const o = Math.min(a, b);
          const rise = i && a < 1 ? 1 - a : b - 1;
          const y = rise * RISE + (i === TPI ? 0 : -14 * clamp(x - i));
          const sc = i === 0 && a < 1 ? 1.03 - 0.03 * a : 0.97 + 0.03 * o;
          const cap = caps.current[i];
          if (cap) {
            const co = i === 0 ? b : o;
            cap.style.opacity = (co * co).toFixed(3);
            cap.style.transform = `translate3d(0, ${(rise * 24).toFixed(1)}px, 0)`;
            cap.style.visibility = co > 0.002 ? "visible" : "hidden";
          }
          l.style.opacity = (o * o).toFixed(3); // eased: two screens never sit half and half on each other
          l.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
          l.style.visibility = o > 0.002 ? "visible" : "hidden";
        });
        // Alt+Space: the keys are pressed as the Command Center rises in, and lift away as it settles
        const kp = clamp((x - CCI + MIX / 2 - 0.02) / 0.45);
        keys.style.opacity = (Math.sin(Math.PI * kp) ** 2).toFixed(3);
        keys.style.transform = `translate3d(-50%, ${(-50 - 40 * kp).toFixed(1)}%, 0)`;
        keys.classList.toggle("is-press", kp > 0.3 && kp < 0.6);
      } else {
        if ("fluid" in st.dataset) {
          delete st.dataset.fluid;
          loose();
        }
        // a slow drift through the chapter: the screenshot rises a little as the page moves on
        const on = scenes[ch - 1];
        if (on && ch !== TPI) on.style.setProperty("--y", `${(-14 * t).toFixed(1)}px`);
      }
      if (ch >= 1 && kit[ch - 1]) move(kit[ch - 1], t);
      // the Teleprompter follows the page as Follow my voice follows the presenter: read words fade, the next word
      // stays on the reading line
      if (ch === MCI && mc) cards(t);
      if (ch === TPI && words.length) {
        const n = Math.min(words.length, Math.floor(clamp(t * 1.12) * words.length));
        if (n !== said) {
          words.forEach((w, i) => w.classList.toggle("is-said", i < n));
          said = n;
          const next = words[Math.min(n, words.length - 1)];
          script.style.transform = `translate3d(0, ${BAND - next.offsetTop}px, 0)`;
        }
        voice(said, t);
      }
    };
    function kick() {
      if (!raf) raf = requestAnimationFrame(frame);
    }
    const onScroll = kick;
    const near = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        addEventListener("scroll", onScroll, { passive: true });
        onScroll();
      } else removeEventListener("scroll", onScroll);
    });
    near.observe(tr);
    // "Reduce effects" switched on or off: the stage takes its new manner at once
    const mode = new MutationObserver(kick);
    mode.observe(html, { attributes: true, attributeFilter: ["class"] });
    ro.observe(box);
    size();

    return () => {
      ro.disconnect();
      start.disconnect();
      near.disconnect();
      mode.disconnect();
      removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", begin);
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [n]);

  const go = (i: number) => {
    const tr = track.current;
    if (!tr) return;
    const span = tr.offsetHeight - innerHeight;
    const top = tr.getBoundingClientRect().top + scrollY + span * ((i + 0.2) / n);
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
          <div className="tr-stage is-frame is-decks is-items is-studio is-done" ref={stage} data-ch="0" style={{ "--s": 1 } as CSSProperties}>
            <div className="tr-glows" aria-hidden="true">
              {labels.map((l) => (
                <i key={l} />
              ))}
            </div>
            {/* the real Studio stays behind every chapter, quieter once the program moves on */}
            <div className="tr-base">
              <Image src="/product/studio.webp" alt="The FrameDecks Studio: Frames and Decks on the left, the live preview, and the question cards under it" width={SHOT.w} height={SHOT.h} priority unoptimized />
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
              <figure key={s.cls} className={`tr-sc ${s.cls}`}>
                {s.draw === "mc" ? (
                  <MemoryCards />
                ) : s.src ? (
                  <Image src={s.src} alt={s.alt} width={s.w} height={s.h} unoptimized />
                ) : (
                  <Voice />
                )}
                {s.moves && (
                  <>
                    <span className="tr-tap" aria-hidden="true" />
                    <span className="tr-ptr" aria-hidden="true">
                      <svg width="22" height="26" viewBox="0 0 22 26">
                        <path d="M2 2 L2 21 L7.5 16 L11 24 L14.5 22.5 L11 14.8 L18.5 14.8 Z" fill="#fff" stroke="#0b1020" strokeWidth="1.6" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </>
                )}
                {s.keys.length > 0 && (
                  <figcaption className="tr-callouts">
                    {s.keys.map(([k, what]) => (
                      <span key={what}>
                        {k && <Keys k={k} />} {what}
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

/** The Voice chapter: the Teleprompter following the voice (app/css/speaker.css), and beside it the meeting screen,
 *  where the verse it heard arrives in the program's own scripture card (app/css/overlay.css .card-verse, word-in). */
function Voice() {
  return (
    <div
      className="tr-voice"
      role="img"
      aria-label="The Teleprompter follows the presenter's voice. When the presenter reads Psalm 119:105 it is heard and offered; shown, the verse arrives on the meeting screen word by word. Holding Right Ctrl and saying next frame brings the first question."
    >
      <div className="tr-tp" aria-hidden="true">
        <span className="tr-tp-live">Following your voice</span>
        <span className="tr-band" />
        <div className="tr-tp-text">
          {SCRIPT.map((line) => (
            <p key={line}>
              {line.split(" ").map((w, i) => (
                <span key={i} className="tr-w">
                  {w}{" "}
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>
      <div className="tr-vo" aria-hidden="true">
        <p className="tr-vo-head">
          <span className="tr-vo-dot" />
          On screen
          <span className="tr-vo-frame">
            <b>Frame 1</b>
            <b>Frame 2</b>
          </span>
        </p>
        <div className="tr-vo-screen">
          <div className="tr-vo-card tr-vo-title">
            <span className="tr-vo-label">Bible Study</span>
            <p>Small faithful steps, taken together</p>
          </div>
          <div className="tr-vo-card tr-vo-verse">
            <span className="tr-vo-label">Scripture</span>
            <i className="tr-vo-rule" />
            <p>
              {VERSE.split(" ").map((w, i) => (
                <Fragment key={i}>
                  <span className="tr-vw" style={{ "--i": i } as CSSProperties}>
                    {w}
                  </span>{" "}
                </Fragment>
              ))}
            </p>
            <span className="tr-vo-ref">Psalm 119:105</span>
          </div>
          <div className="tr-vo-card tr-vo-q">
            <span className="tr-vo-label">Question 1</span>
            <p>What does this passage reveal about the character of God?</p>
          </div>
        </div>
        <div className="tr-vo-offer">
          <span className="tr-vo-ear">Heard</span>
          <b>Psalm 119:105</b>
          <span className="tr-vo-show" />
        </div>
        <div className="tr-vo-say">
          <span className="tr-vo-mic">
            <i />
            <i />
            <i />
          </span>
          <kbd>Right Ctrl</kbd> “next frame”
        </div>
      </div>
    </div>
  );
}

/** The Memory Cards chapter, drawn in the program's own chat-overlay style (app/css/overlay.css .chat-list). */
function MemoryCards() {
  const tint = (c: string) => `color-mix(in srgb, ${c} 45%, #fff)`;
  return (
    <div
      className="tr-mc"
      role="img"
      aria-label="Three messages copied from the meeting chat pop up as bubbles beside the presenter on the camera picture, in the order they were copied; the prayer request is pinned"
    >
      <div className="tr-mc-chat" aria-hidden="true">
        <p className="tr-mc-h">
          Meeting chat <span className="tr-mc-cap">Capture on</span>
        </p>
        {CHAT.map((m) => (
          <div key={m.who} className="tr-mc-row">
            <span className="tr-mc-av" style={{ background: m.c }}>
              {m.ini}
            </span>
            <div>
              <b style={{ color: tint(m.c) }}>{m.who}</b>
              <p>{m.text}</p>
            </div>
            <span className="tr-mc-key">
              <kbd>Ctrl</kbd>+<kbd>C</kbd>
            </span>
          </div>
        ))}
      </div>
      <div className="tr-mc-cam" aria-hidden="true">
        <div className="tr-mc-pic">
          <i className="tr-mc-who" />
        </div>
        <span className="tr-mc-live">FrameDecks vCam</span>
        <ul className="tr-mc-list">
          {COPIED.map((row) => {
            const m = CHAT[row];
            return (
              <li key={m.who} className="tr-mc-msg">
                <span className="tr-mc-av" style={{ background: m.c }}>
                  {m.ini}
                </span>
                <div className="tr-mc-bub">
                  <span className="tr-mc-head">
                    <b style={{ color: tint(m.c) }}>{m.who}</b>
                    <em>Pinned</em>
                  </span>
                  <p>{m.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="tr-mc-ghost" aria-hidden="true">
        <span />
      </div>
      {/* 26.11.26 then the chat makes way for a member's phone following the meeting screen (framedecks.com/follow) */}
      <div className="tr-mc-phone">
        <Image src="/product/follow.webp" alt="" width={560} height={847} unoptimized />
      </div>
    </div>
  );
}
