"use client";

import { useState, type MouseEvent } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, EyeOff, Square } from "lucide-react";

// The product's one piece of real magic, shown instead of described (owner-approved, 27 October; enlarged 28 October):
// a tap on the phone changes the screen in the room. Next, Previous, Hide all and Black screen all work; each tap
// sends a gold light along the wire to the screen, and a question shows its gentle timer. Everything here plays once
// per tap, so an idle page draws nothing.
const FRAMES = [
  { kind: "Welcome", text: "Welcome, everyone", sub: "Evening session · 7:30 pm", serif: false, timer: 0 },
  {
    kind: "Scripture",
    text: "Commit thy works unto the LORD, and thy thoughts shall be established.",
    sub: "Proverbs 16:3 (KJV)",
    serif: true,
    timer: 0,
  },
  { kind: "Discussion question", text: "What is one idea you will put into practice this week?", sub: "Question 1 of 3", serif: false, timer: 30 },
  { kind: "Closing", text: "Thank you for being here.", sub: "See you next time", serif: false, timer: 0 },
] as const;

type Screen = "show" | "hidden" | "black";

export function NextDemo() {
  const [at, setAt] = useState(1);
  const [screen, setScreen] = useState<Screen>("show");
  const [pulse, setPulse] = useState(0);
  const [ripple, setRipple] = useState<{ id: number; x: number; y: number; on: string } | null>(null);
  const f = FRAMES[at];

  function tap(event: MouseEvent<HTMLButtonElement>, name: string, act: () => void) {
    const box = event.currentTarget.getBoundingClientRect();
    setRipple({ id: pulse + 1, x: event.clientX - box.left, y: event.clientY - box.top, on: name });
    setPulse(pulse + 1);
    act();
  }

  const rippleOn = (name: string) =>
    ripple?.on === name ? <i className="lp-ripple" key={ripple.id} style={{ left: ripple.x, top: ripple.y }} /> : null;

  const status = screen === "black" ? "Black screen" : screen === "hidden" ? "Everything hidden" : `Frame ${at + 1} of ${FRAMES.length}`;
  return (
    <div className="fd-demo">
      <div className="fd-demo-room-col">
        <p className="fd-demo-room">The room screen</p>
        <div className={`fd-demo-screen fd-framed is-${screen}`} aria-live="polite">
          <div className="fd-demo-backdrop" aria-hidden="true">
            <Image src="/framedecks-emblem.webp" alt="" width={44} height={44} loading="lazy" unoptimized />
          </div>
          {screen === "show" ? (
            <div className="fd-demo-card" key={at}>
              <span className="fd-demo-kind">{f.kind}</span>
              <p className={f.serif ? "fd-demo-text fd-serif" : "fd-demo-text"}>{f.text}</p>
              <span className="fd-demo-sub">{f.sub}</span>
              {f.timer ? (
                <span className="fd-demo-timer" aria-label={`${f.timer} second timer`}>
                  <i style={{ animationDuration: `${f.timer}s` }} />
                </span>
              ) : null}
            </div>
          ) : (
            <p className="fd-sr">{screen === "black" ? "The screen is black." : "Everything is hidden; the background shows."}</p>
          )}
        </div>
      </div>

      <div className="fd-demo-wire" aria-hidden="true">
        <i className="fd-demo-wire-line" />
        {pulse ? <i className="fd-demo-wire-dot" key={pulse} /> : null}
      </div>

      <div className="fd-demo-phone" role="group" aria-label="Try it: the Live page on a phone">
        <p className="fd-demo-room">Your phone</p>
        <p className="fd-demo-now">{status}</p>
        <button
          type="button"
          className="fd-demo-next"
          onClick={(e) =>
            tap(e, "next", () => {
              setAt(Math.min(FRAMES.length - 1, at + 1));
              setScreen("show");
            })
          }
          disabled={screen === "show" && at === FRAMES.length - 1}
        >
          Next <ChevronRight aria-hidden="true" size={18} />
          {rippleOn("next")}
        </button>
        <button
          type="button"
          className="fd-demo-prev"
          onClick={(e) =>
            tap(e, "prev", () => {
              setAt(Math.max(0, at - 1));
              setScreen("show");
            })
          }
          disabled={screen === "show" && at === 0}
        >
          <ChevronLeft aria-hidden="true" size={18} /> Previous
          {rippleOn("prev")}
        </button>
        <div className="fd-demo-row">
          <button
            type="button"
            className="fd-demo-tool"
            aria-pressed={screen === "hidden"}
            onClick={(e) => tap(e, "hide", () => setScreen(screen === "hidden" ? "show" : "hidden"))}
          >
            <EyeOff aria-hidden="true" size={16} /> Hide all
            {rippleOn("hide")}
          </button>
          <button
            type="button"
            className="fd-demo-tool"
            aria-pressed={screen === "black"}
            onClick={(e) => tap(e, "black", () => setScreen(screen === "black" ? "show" : "black"))}
          >
            <Square aria-hidden="true" size={16} /> Black screen
            {rippleOn("black")}
          </button>
        </div>
        <p className="fd-demo-hint">Try it: press Next.</p>
      </div>
    </div>
  );
}
