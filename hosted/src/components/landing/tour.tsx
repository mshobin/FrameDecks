"use client";

import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";

// 26.11.2 the front page's stage (owner's brief, 6 November; app/tour.css, docs/development/design-system.md "Landing").
// On arrival, with no scrolling, a meeting builds itself: a Frame, its Decks, their Content, joined by lines in the
// app's own level colours; a moment later (HOLD), or as soon as the page is scrolled, each card flies to its place in
// the real Studio and the screenshot takes over. Scrolling back to the top turns the Studio back into the flowchart.
// From there the Studio stays, and the page's scroll moves one camera over it through three chapters (26.11.27, below).
// 26.11.28 one scroll, one chapter (owner, 9 November: "it should feel seamless"): the page snaps to each chapter
// (tour.css .tr-snap, the browser's own scroll snapping, so wheels, trackpads, keys and touch all work as usual), a
// spring carries the camera there (FOLLOW), and the chapter's story then plays by itself (STORY). Scrolling back goes
// straight to where the chapter before ended.
// Light on resources: one passive scroll listener, attached only while the stage is on screen; one animation frame
// loop that runs only while the stage is still catching up and stops when it has settled; only transform and opacity
// move. "Reduce effects" (html.fd-calm) shows the finished Studio at once; with less motion asked for (no
// html.fd-motion) the steps still arrive one by one and the chapters change in place, without moving.

export type TourChapter = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  text: ReactNode;
};

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
type Card = {
  cls: string;
  at: Box;
  tall: Box;
  to: Box;
  kind: string;
  text: string;
};
const SHOT = { w: 1200, h: 480, top: 110 }; // studio.webp's size, and where the stage draws it (1000 px wide from y 110)
const CARDS: readonly Card[] = [
  {
    cls: "tr-frame",
    at: [380, 108, 240, 66],
    tall: [140, 0, 240, 66],
    to: [9, 186, 207, 78],
    kind: "Frame 1",
    text: "Bible Study",
  },
  {
    cls: "tr-deck",
    at: [150, 236, 200, 44],
    tall: [0, 110, 250, 44],
    to: [9, 338, 207, 40],
    kind: "",
    text: "Scripture",
  },
  {
    cls: "tr-deck",
    at: [610, 236, 220, 44],
    tall: [270, 110, 250, 44],
    to: [9, 381, 207, 40],
    kind: "",
    text: "Question",
  },
  {
    cls: "tr-item tr-verse",
    at: [150, 330, 200, 92],
    tall: [20, 194, 230, 92],
    to: [455, 124, 307, 67],
    kind: "Psalm 119:105",
    text: "Thy word is a lamp unto my feet, and a light unto my path.",
  },
  {
    cls: "tr-item",
    at: [470, 330, 160, 92],
    tall: [290, 194, 230, 84],
    to: [403, 249, 413, 55], // 26.11.52 the question on the preview (the list is behind Show text fields)
    kind: "Question 1",
    text: "What does this passage reveal about the character of God?",
  },
  {
    cls: "tr-item",
    at: [640, 330, 160, 92],
    tall: [290, 290, 230, 84],
    to: [403, 249, 413, 55], // 26.11.52 the question on the preview (the list is behind Show text fields)
    kind: "Question 2",
    text: "Which phrase in this passage stood out to you most, and why?",
  },
  {
    cls: "tr-item",
    at: [810, 330, 160, 92],
    tall: [290, 386, 230, 84],
    to: [403, 249, 413, 55], // 26.11.52 the question on the preview (the list is behind Show text fields)
    kind: "Question 3",
    text: "Think of a situation you are facing right now.",
  },
];
const TALL = [520, 526, 56] as const; // the phone flowchart: width, height, and the room above it for the steps

function cardStyle(c: Card, i: number) {
  const [x, y, w, h] = c.at;
  return {
    left: x,
    top: y,
    width: w,
    height: h,
    "--d": `${[0, 0, 60, 0, 50, 100, 150][i]}ms`,
  } as CSSProperties;
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

// 26.11.27 the Studio never leaves (owner, 9 November: "the features reveal through the Studio"). After it lands, the
// page's scroll moves one camera over the real Studio screenshot, and each chapter happens on it or around it:
// 1 the Command Center drops onto the dimmed Studio (Alt+Space, as over any app): Go Live, Next Frame, then Right Ctrl
//   held and "next frame" said; 2 the camera moves into the Studio's live picture, the Teleprompter docks beside it
//   and follows the voice, and the verse it hears arrives on the picture word by word (overlay.css word-in);
// 3 the camera pulls back and the rest of the suite pops out of the Studio: Memory Cards on the camera, the corner
//   card, the phone remote, members' phones and the sermon notes.
type Move = { at: number; x: number; y: number; tap?: boolean };
type Scene = {
  cls: string;
  keys: readonly (readonly [string, string])[];
  hot: readonly number[];
  from: readonly [number, number];
  moves?: readonly Move[];
};
const SCENES: readonly Scene[] = [
  {
    cls: "tr-sc-cc",
    keys: [
      ["Alt+Space", "over any app"],
      ["Alt+→", "Next Frame"],
      ["Right Ctrl", "hold: “next frame”"],
    ],
    hot: [0, 0.38, 0.62],
    from: [0, -60],
    moves: [
      { at: 0, x: 72, y: 96 },
      { at: 0.16, x: 86.8, y: 44.9, tap: true },
      { at: 0.26, x: 86.8, y: 44.9 },
      { at: 0.38, x: 31.2, y: 67, tap: true }, // 26.11.52 Next Frame sits lower since the Go Live progress bar
      { at: 0.5, x: 31.2, y: 67 },
      { at: 0.64, x: 70, y: 98 },
    ],
  },
  {
    cls: "tr-sc-tp",
    keys: [
      ["V", "Follow my voice"],
      ["", "a verse heard: one press to show it"],
    ],
    hot: [0, 0.6],
    from: [90, 0],
  },
  { cls: "tr-sc-suite", keys: [], hot: [], from: [0, 0] },
];
const SAY_AT = 0.62; // Command Center: where Right Ctrl is held...
const SAID_AT = 0.8; // ...and "next frame" is heard and done

// the camera over the Studio, per chapter: where the Studio's centre goes on the stage, its scale, and how far it dims
const cam = (cx: number, cy: number, sc: number, veil: number) => [cx - 500 * sc, cy - 110 - 200 * sc, sc, veil];
const CAM = [cam(500, 310, 1, 0), cam(500, 330, 0.94, 0.62), [322 - 507 * 1.3, 300 - 110 - 159 * 1.3, 1.3, 0], cam(500, 300, 0.56, 0)];
const SCREEN = [302, 44, 411, 231] as const; // the Studio's live picture, in the screenshot's place on the stage (1000 px wide)

// The Teleprompter's script (the same words as the program's own capture)
const SCRIPT = [
  "Good evening, and welcome to week five of our study.",
  "Tonight we look at one simple idea: small faithful steps, taken together.",
  "Turn to the reading on the screen, Psalm 119:105.",
  "Take a moment with the first question before we share in groups.",
  "Then we will close in prayer.",
];
const BAND = 120; // where the reading line sits in the Teleprompter (as in the program, about a third of the way down)
const VERSE = "Thy word is a lamp unto my feet, and a light unto my path.";
const HEARD = SCRIPT.join(" ")
  .split(" ")
  .findIndex((w) => w.startsWith("119:105")); // the word after which it is heard
const SHOW_AT = 5; // words after that, Show is pressed

// 26.11.3 Memory Cards in the program's own overlay style (overlay.css .chat-list: initials, name, the words; pinned in
// gold), in the copy order, the picture making room beside them as FrameDecks vCam does
type Chat = { who: string; ini: string; c: string; text: string };
const CHAT: readonly Chat[] = [
  {
    who: "Daniel",
    ini: "D",
    c: "#3a7bd5",
    text: "Verse 105 is my favourite: a light for each step.",
  },
  {
    who: "Samuel",
    ini: "S",
    c: "#8a5cc7",
    text: "How do we stay faithful when the path is unclear?",
  },
  {
    who: "Grace",
    ini: "G",
    c: "#b5651d",
    text: "Praise God, our baby girl arrived safely this week!",
  },
];
const POP = 0.13; // the suite: one piece after another, this far apart in the chapter

// 26.11.4 the build on arrival, brisk (owner, 8 November): ms after the stage is on screen for the Frame, its name
// typed a letter at a time, the Decks, the Content, and the moment the flowchart is complete
const BUILD = [80, 180, 600, 850, 1100] as const;
const HOLD = 1200; // 26.11.4 the finished flowchart stays this long, then the Studio takes over (at once if the page is scrolled)
const TAKE = 100; // ...or over the first pixels of scroll; scrolling back to the top turns the Studio back into the flowchart
const MIX = 0.3; // 26.11.3 how much of the scroll two neighbouring chapters share while one hands over to the next
// 26.11.4 the stage follows the scroll through a critically damped spring (per second; higher is tighter): a trackpad's
// many small steps and a mouse wheel's few big ones both become one continuous movement, a little behind the page
const FOLLOW = 12;
const TAKEOVER = 8; // the flowchart-to-Studio flight is slower, so it reads as one gesture
const STORY = 2.6; // 26.11.28 seconds a chapter's story takes to play once the camera has arrived

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
    const veil = st.querySelector(".tr-veil") as HTMLElement;
    const screen = st.querySelector(".tr-screen") as HTMLElement;
    const sats = q(".tr-sat");
    const msgs = q(".tr-mc-msg");
    const room = st.querySelector(".tr-mc-cam") as HTMLElement;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    // 26.11.3 one flow: with motion allowed, the page's scroll itself carries the camera and each chapter in and out;
    // otherwise the chapters change in place, without movement
    const fluid = () => !still.matches && html.classList.contains("fd-motion") && !html.classList.contains("fd-calm");
    const loose = () =>
      [...scenes, ...sats, ...caps.current, keys].forEach((l) => l && ["opacity", "transform", "visibility"].forEach((k) => l.style.removeProperty(k)));
    let said = -1;
    // the pointer on the Command Center (Scene.moves), and the callout of the key in use (Scene.hot), driven by the
    // chapter's own progress
    const kit = scenes.map((fig, i) => ({
      s: SCENES[i],
      box: fig.querySelector<HTMLElement>(".tr-cc") ?? fig,
      ptr: fig.querySelector<HTMLElement>(".tr-ptr"),
      tap: fig.querySelector<HTMLElement>(".tr-tap"),
      calls: Array.from(fig.querySelectorAll<HTMLElement>(".tr-callouts > span")),
      fired: new Set<number>(),
    }));
    const px = (el: HTMLElement, x: number, y: number) => [(x / 100) * el.offsetWidth, (y / 100) * el.offsetHeight];
    const move = (k: (typeof kit)[number], t: number) => {
      const { s, box } = k;
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
      const [x, y] = px(box, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
      k.ptr.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      m.forEach((p, i) => {
        if (!p.tap) return;
        if (t < p.at) k.fired.delete(i);
        else if (!k.fired.has(i) && t - p.at < 0.2 && k.tap) {
          k.fired.add(i);
          const [tx, ty] = px(box, p.x, p.y);
          k.tap.style.left = `${tx}px`;
          k.tap.style.top = `${ty}px`;
          k.tap.classList.remove("is-tap");
          void k.tap.offsetWidth;
          k.tap.classList.add("is-tap");
        } else if (!k.fired.has(i)) k.fired.add(i);
      });
    };
    // the suite: each piece rises out of the Studio's middle to its own place (worked out once the stage has a size)
    let homes: number[][] = [];
    const place = () => (homes = sats.map((el) => [(500 - el.offsetLeft - el.offsetWidth / 2) * 0.55, (300 - el.offsetTop - el.offsetHeight / 2) * 0.55]));

    // ---- size: the stage is drawn at 1000 × 620 and scaled to the room it has. On a tall screen (a phone) the
    // flowchart takes its narrower shape at its own, larger scale, and each card's flight is worked out from there ----
    let flight: number[][] = [];
    let drawn = -1;
    const view = { s: 1, w: 0, h: 0, tall: false };
    const size = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      const s = Math.max(0.2, Math.min(w / 1000, h / 620));
      Object.assign(view, { s, w, h, tall: w / h < 1.2 });
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
        Object.assign(bs[i].style, {
          left: `${x}px`,
          top: `${y}px`,
          width: `${cw}px`,
          height: `${ch}px`,
        });
        const [X, Y, W, H] = c.to;
        return [(X * r - bx) / k - x, (SHOT.top + Y * r - by) / k - y, (W * r) / k / cw, (H * r) / k / ch];
      });
      drawn = -1;
      place();
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
      // 26.11.28 the chapter the page is on; the stage goes to where its story ends (the last one to the very end)
      const k = Math.min(n - 1, Math.floor(clamp(down / (tr.offsetHeight - innerHeight)) * n));
      const goal = k === 0 ? 0 : k === n - 1 ? n : k + 1 - MIX / 2;
      const edge = Math.max(0, k) + MIX / 2; // where the camera has arrived and the story begins
      const take = Math.max(auto, clamp(down / TAKE));
      const flow = fluid();
      let busy = false;
      if (prev < 0)
        [X.x, S.x] = [goal, take]; // the first picture is where the page is: no sweep from the top
      else if (flow) {
        // back: straight to the chapter before's end; on: the camera springs to the chapter, then its story plays
        let a = false;
        if (goal <= X.x || X.x < edge - 1e-3) a = spring(X, goal <= X.x ? goal : edge, FOLLOW, dt) || goal > X.x;
        else if (X.x < goal) {
          X.v = 0;
          X.x = Math.min(goal, X.x + (dt * (1 - MIX)) / STORY);
          a = X.x < goal;
        }
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
        scenes.forEach((s, i) => s.classList.toggle("is-on", i === ch - 1));
        rail.current.forEach((b, i) => {
          if (!b) return;
          b.classList.toggle("is-on", i === ch);
          if (i === ch) b.setAttribute("aria-current", "step");
          else b.removeAttribute("aria-current");
        });
        prev = ch;
      }
      rail.current.forEach((b, i) => b?.style.setProperty("--f", String(i < ch ? 1 : i === ch ? t : 0)));
      // the camera: each chapter's place, handed over across MIX of the scroll around each boundary
      const w = CAM.map((_, k) => (k === 0 ? 1 : flow ? ease(clamp((x - k + MIX / 2) / MIX)) : x >= k ? 1 : 0));
      const [cx, cy, cs, cv] = [0, 1, 2, 3].map((j) => CAM.reduce((v, c, k) => (k ? v + w[k] * (c[j] - CAM[k - 1][j]) : c[j]), 0));
      const studio = flow ? clamp((S.x - 0.35) / 0.6) : 1;
      const o0 = studio < 1 ? 1.03 - 0.03 * studio : 1; // the Studio settles as the flowchart lands on it
      base.style.transform = `translate3d(${(cx + (1 - o0) * 500).toFixed(1)}px, ${(cy + (1 - o0) * 200).toFixed(1)}px, 0) scale(${(cs * o0).toFixed(4)})`;
      if (flow) base.style.opacity = (studio * studio).toFixed(3);
      else base.style.removeProperty("opacity");
      veil.style.opacity = cv.toFixed(3);
      if (view.tall) {
        // the phone's view: each chapter's zoom and focus, the Teleprompter's turning to the picture once the verse is
        // heard, and the suite followed from left to right as it pops out, then seen whole
        // 26.11.27 on a phone (a tall stage) the whole 1000 px stage would be small, so the view moves too: per chapter
        // how far it zooms in and where it looks (stage pixels), following what happens within the chapter
        const go = (k: number, from: number, len: number) => ease(clamp((x - k - from) / len));
        const at = (k: number) =>
          [
            [1 + 0.3 * studio, 500, 310], // the Studio, a little closer once it has landed
            [1.75, 500, 280],
            [1.65, 795 - 473 * go(2, 0.48, 0.2), 300],
            [1.6, 505, 330], // the suite, stacked above and below the Studio (tour.css .is-tall .tr-sat-*)
          ][k];
        const [vz, vx, vy] = [0, 1, 2].map((j) => [0, 1, 2, 3].reduce((v, k) => (k ? v + w[k] * (at(k)[j] - at(k - 1)[j]) : at(0)[j]), 0));
        const vs = view.s * vz;
        st.style.transform = `translate3d(${(view.w / 2 - vx * vs).toFixed(1)}px, ${Math.max(0, view.h / 2 - vy * vs).toFixed(1)}px, 0) scale(${vs.toFixed(4)})`;
      }
      screen.style.opacity = (w[2] - w[3]).toFixed(3);
      if (flow) {
        st.dataset.fluid = "";
        // each chapter shares MIX of the scroll with its neighbours: it comes in from its own side as the camera
        // moves, and fades as the next one arrives; the words above change with it
        for (let i = 0; i < n; i++) {
          const a = i === 0 ? 1 : clamp((x - i + MIX / 2) / MIX);
          const b = i === n - 1 ? 1 : clamp((i + 1 + MIX / 2 - x) / MIX);
          const o = Math.min(a, b);
          const cap = caps.current[i];
          if (cap) {
            const co = i === 0 ? b : o;
            cap.style.opacity = (co * co).toFixed(3);
            cap.style.transform = `translate3d(0, ${((a < 1 ? 1 - a : b - 1) * 24).toFixed(1)}px, 0)`;
            cap.style.visibility = co > 0.002 ? "visible" : "hidden";
          }
          const l = scenes[i - 1];
          if (!l) continue;
          const [fx, fy] = SCENES[i - 1].from;
          const k = a < 1 ? 1 - ease(a) : 0;
          l.style.opacity = (o * o).toFixed(3);
          l.style.transform = `translate3d(${(fx * k).toFixed(1)}px, ${(fy * k).toFixed(1)}px, 0) scale(${(0.98 + 0.02 * b).toFixed(4)})`;
          l.style.visibility = o > 0.002 ? "visible" : "hidden";
        }
        // Alt+Space: the keys are pressed as the Command Center drops in, and lift away as it settles
        const kp = clamp((x - 1 + MIX / 2 - 0.02) / 0.45);
        keys.style.opacity = (Math.sin(Math.PI * kp) ** 2).toFixed(3);
        keys.style.transform = `translate3d(-50%, ${(-50 - 40 * kp).toFixed(1)}%, 0)`;
        keys.classList.toggle("is-press", kp > 0.3 && kp < 0.6);
      } else if ("fluid" in st.dataset) {
        delete st.dataset.fluid;
        loose();
      }
      if (ch >= 1 && kit[ch - 1]) move(kit[ch - 1], t);
      // 1 the voice: Right Ctrl held, "next frame" heard, Next Frame pressed by it
      set("is-say", ch === 1 && t >= SAY_AT);
      set("is-said", ch === 1 && t >= SAID_AT);
      // 2 the Teleprompter follows the page as Follow my voice follows the presenter: read words fade, the next word
      // stays on the reading line; the reference read is heard, offered, and shown on the Studio's picture
      const tt = ch === 2 ? t : ch > 2 ? 1 : 0;
      const nw = Math.min(words.length, Math.floor(clamp(tt * 1.15) * words.length));
      if (nw !== said && words.length) {
        words.forEach((wd, i) => wd.classList.toggle("is-said", i < nw));
        said = nw;
        const next = words[Math.min(nw, words.length - 1)];
        script.style.transform = `translate3d(0, ${BAND - next.offsetTop}px, 0)`;
      }
      set("is-heard", nw > HEARD);
      set("is-shown", nw > HEARD + SHOW_AT);
      // 3 the suite rises out of the Studio, one piece after another; the Memory Cards pop beside the presenter
      const t3 = ch === 3 ? t : ch > 3 ? 1 : 0;
      sats.forEach((el, i) => {
        const p = ease(clamp((t3 - 0.04 - i * POP) / 0.3));
        if (flow) {
          const [hx, hy] = homes[i] ?? [0, 0];
          el.style.opacity = p.toFixed(3);
          el.style.transform = `translate3d(${(hx * (1 - p)).toFixed(1)}px, ${(hy * (1 - p)).toFixed(1)}px, 0) scale(${(0.7 + 0.3 * p).toFixed(4)})`;
        }
        el.classList.toggle("is-on", p > 0.5);
      });
      msgs.forEach((m, i) => m.classList.toggle("is-pop", t3 >= 0.3 + i * 0.07));
      msgs[2]?.classList.toggle("is-pin", t3 >= 0.62);
      room?.classList.toggle("is-room", t3 >= 0.28);
    };
    function kick() {
      if (!raf) raf = requestAnimationFrame(frame);
    }
    const onScroll = kick;
    // 26.11.28 one gesture on the stage moves exactly one chapter, with a wheel, a trackpad or a finger: the browser's
    // snapping alone would send a small turn back where it was, and a long swipe further than one. A trackpad's glide
    // after the step is spent waiting, so one gesture is one step; after the stage, the page scrolls as usual.
    let quiet = 0; // when the last wheel event arrived
    let stepped = 0; // when the last step was
    let y0 = -1; // where a finger went down (-1: none, or the page's own scrolling)
    let dy = 0;
    /** Where a gesture going `dir` (1 down, -1 up) takes the page, or -1 where the page's own scrolling applies. */
    const target = (dir: number) => {
      const h = tr.offsetHeight;
      const down = -tr.getBoundingClientRect().top;
      const stops = Array.from({ length: n }, (_, i) => ((h - innerHeight) * (i && i + 0.5)) / n);
      stops.push(h - 65);
      let at = 0;
      stops.forEach((p, i) => void (Math.abs(p - down) < Math.abs(stops[at] - down) && (at = i)));
      const to = at + dir;
      return down < -2 || down > h - 63 || to < 0 || to > n ? -1 : scrollY - down + stops[to];
    };
    const step = (top: number) => {
      stepped = performance.now();
      scrollTo({ top, behavior: fluid() ? "smooth" : "auto" });
    };
    const off = new AbortController();
    const on = (t: string, f: (e: never) => void, passive = true) => tr.addEventListener(t, f as EventListener, { passive, signal: off.signal });
    on(
      "wheel",
      (e: WheelEvent) => {
        const top = target(Math.sign(e.deltaY));
        if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX) || top < 0) return;
        e.preventDefault();
        const now = performance.now();
        if (now - quiet > 120 && now - stepped > 500) step(top); // a pause, then a new gesture
        quiet = now;
      },
      false,
    );
    // a finger: the stage holds still under it, and a swipe of 30 px or more up or down moves one chapter
    on("touchstart", (e: TouchEvent) => {
      y0 = e.touches.length === 1 ? e.touches[0].clientY : -1;
      dy = 0;
    });
    on(
      "touchmove",
      (e: TouchEvent) => {
        if (y0 < 0) return;
        dy = y0 - e.touches[0].clientY;
        if (e.touches.length > 1 || target(Math.sign(dy)) < 0) y0 = -1;
        else if (e.cancelable) e.preventDefault();
      },
      false,
    );
    on("touchend", () => {
      const top = y0 < 0 || Math.abs(dy) < 30 ? -1 : target(Math.sign(dy));
      y0 = -1;
      if (top >= 0) step(top);
    });
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
      off.abort();
      document.removeEventListener("visibilitychange", begin);
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [n]);

  // a chapter's own snap point (.tr-snap below)
  const go = (i: number) =>
    track.current?.querySelectorAll(".tr-snap")[i]?.scrollIntoView({ behavior: document.documentElement.classList.contains("fd-motion") ? "smooth" : "auto" });

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
            {/* the real Studio: the build lands on it, and every chapter happens on it or around it */}
            <div className="tr-base">
              <Image
                src="/product/studio.webp"
                alt="The FrameDecks Studio: Frames and Decks on the left, the live preview, and the question cards under it"
                width={SHOT.w}
                height={SHOT.h}
                priority
                unoptimized
              />
              <Screen />
              <i className="tr-veil" />
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

            {/* the chapters, on the Studio and around it */}
            {SCENES.map((s) => (
              <figure key={s.cls} className={`tr-sc ${s.cls}`}>
                {s.cls === "tr-sc-cc" ? <Command /> : s.cls === "tr-sc-tp" ? <Prompter /> : <Suite />}
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
      {/* 26.11.28 one snap point per chapter (tour.css .tr-snap): one scroll moves one chapter */}
      {labels.map((l, i) => (
        <i key={l} className="tr-snap" aria-hidden="true" style={{ "--at": i ? (i + 0.5) / n : 0 } as CSSProperties} />
      ))}
    </section>
  );
}

/** The Studio's live picture, redrawn over the screenshot for the Teleprompter chapter: the Frame's title, then the
 *  verse heard, in the program's own scripture card (app/css/overlay.css .card-verse: gold label, rule, words arriving
 *  one after another, the reference between lines). */
function Screen() {
  const [l, tp, w, h] = SCREEN;
  return (
    <div className="tr-screen" aria-hidden="true" style={{ left: l, top: tp, width: w, height: h }}>
      <span className="tr-screen-live">Live</span>
      <div className="tr-vo-card tr-vo-title">
        <span className="tr-vo-label">Bible Study</span>
        <p>Small faithful steps, taken together</p>
      </div>
      <div className="tr-vo-card tr-vo-verse">
        <span className="tr-vo-label">Scripture</span>
        <i className="tr-vo-rule" />
        <p>
          {VERSE.split(" ").map((wd, i) => (
            <Fragment key={i}>
              <span className="tr-vw" style={{ "--i": i } as CSSProperties}>
                {wd}
              </span>{" "}
            </Fragment>
          ))}
        </p>
        <span className="tr-vo-ref">Psalm 119:105</span>
      </div>
    </div>
  );
}

/** Chapter 1: the Command Center over the Studio (its real screenshot), pressed by a pointer, then by the voice. */
function Command() {
  return (
    <>
      <div className="tr-cc">
        <Image
          src="/product/cc-control.webp"
          alt="The Command Center over the Studio while a Frame is live: Go Live, Previous, Next Frame, Hide all and Black screen"
          width={820}
          height={720}
          unoptimized
        />
        <span className="tr-cc-hit" aria-hidden="true" />
        <span className="tr-tap" aria-hidden="true" />
        <span className="tr-ptr" aria-hidden="true">
          <svg width="22" height="26" viewBox="0 0 22 26">
            <path d="M2 2 L2 21 L7.5 16 L11 24 L14.5 22.5 L11 14.8 L18.5 14.8 Z" fill="#fff" stroke="#0b1020" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <div className="tr-vo-say" aria-hidden="true">
        <span className="tr-vo-mic">
          <i />
          <i />
          <i />
        </span>
        <kbd>Right Ctrl</kbd> <span className="tr-say-a">“next frame”</span>
        <b className="tr-say-b">Next Frame ✓</b>
      </div>
    </>
  );
}

/** Chapter 2: the Teleprompter docked beside the Studio's picture (app/css/speaker.css), and the verse it heard. */
function Prompter() {
  return (
    <div
      role="img"
      aria-label="The Teleprompter follows the presenter's voice; Psalm 119:105, read aloud, is offered and shown on the live picture word by word."
    >
      <div className="tr-tp" aria-hidden="true">
        <span className="tr-tp-live">Following your voice</span>
        <span className="tr-band" />
        <div className="tr-tp-text">
          {SCRIPT.map((line) => (
            <p key={line}>
              {line.split(" ").map((wd, i) => (
                <span key={i} className="tr-w">
                  {wd}{" "}
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>
      <div className="tr-vo-offer" aria-hidden="true">
        <span className="tr-vo-ear">Heard</span>
        <b>Psalm 119:105</b>
        <span className="tr-vo-show" />
      </div>
    </div>
  );
}

/** Chapter 3: the suite, out of the Studio: Memory Cards on the camera, the corner card, the phone remote, members'
 *  phones and the sermon notes. */
function Suite() {
  const tint = (c: string) => `color-mix(in srgb, ${c} 45%, #fff)`;
  return (
    <div
      role="img"
      aria-label="Around the Studio: Memory Cards on camera, a prayer request in the corner card, the phone remote, a member's phone and the sermon notes"
    >
      <div className="tr-sat tr-sat-mem">
        <span className="tr-sat-tag">
          Memory Cards · <Keys k="Ctrl+C" />
        </span>
        <div className="tr-mc-cam">
          <div className="tr-mc-pic">
            <i className="tr-mc-who" />
          </div>
          <span className="tr-mc-live">FrameDecks vCam</span>
          <ul className="tr-mc-list">
            {CHAT.map((m) => (
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
            ))}
          </ul>
        </div>
      </div>
      <div className="tr-sat tr-sat-remote">
        <span className="tr-sat-tag">Phone remote</span>
        <Image src="/product/phone-remote.webp" alt="" width={390} height={844} unoptimized />
      </div>
      <div className="tr-sat tr-sat-notes">
        <p className="tr-ac-kick">Sermon notes · shared to members’ phones</p>
        <p className="tr-notes-v">
          <b>Psalm 119:105</b> Thy word is a lamp unto my feet…
        </p>
        <p className="tr-notes-v">
          <b>Question</b> What does this passage reveal about the character of God?
        </p>
      </div>
      <div className="tr-sat tr-sat-card">
        <span className="tr-sat-tag">Corner card, over Zoom or Teams</span>
        <p className="tr-ac-kick">🙏 Prayer request · 1 waiting</p>
        <p className="tr-ac-body">“That our family grows closer to God this year.”</p>
        <p className="tr-ac-acts">
          <b>Show</b>
          <span>Show with “Grace”</span>
          <span>Later</span>
        </p>
      </div>
      <div className="tr-sat tr-sat-follow">
        <span className="tr-sat-tag">Members’ phones</span>
        <Image src="/product/follow.webp" alt="" width={560} height={847} unoptimized />
      </div>
    </div>
  );
}
