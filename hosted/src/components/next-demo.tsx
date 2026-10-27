"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// The product's one piece of real magic, shown instead of described (owner-approved, 27 October): a tap on the phone
// changes the screen in the room. It moves only when pressed, so an idle page draws nothing.
const FRAMES = [
  { kind: "Welcome", text: "Welcome to Bible Study", sub: "Tuesday · 7:30 pm", serif: false },
  { kind: "Focus verse", text: "Thy word is a lamp unto my feet, and a light unto my path.", sub: "Psalm 119:105", serif: true },
  { kind: "Discussion question", text: "What does this passage reveal about the character of God?", sub: "Question 1 of 3", serif: false },
  { kind: "Prayer", text: "Let us pray for one another.", sub: "Closing", serif: false },
] as const;

export function NextDemo() {
  const [at, setAt] = useState(1);
  const f = FRAMES[at];
  return (
    <div className="fd-demo">
      <div className="fd-demo-screen fd-framed" aria-live="polite">
        <p className="fd-demo-room">The room screen</p>
        <div className="fd-demo-card" key={at}>
          <span className="fd-demo-kind">{f.kind}</span>
          <p className={f.serif ? "fd-demo-text fd-serif" : "fd-demo-text"}>{f.text}</p>
          <span className="fd-demo-sub">{f.sub}</span>
        </div>
      </div>
      <div className="fd-demo-phone" role="group" aria-label="Try it: the Live page on a phone">
        <p className="fd-demo-room">Your phone</p>
        <p className="fd-demo-now">
          Frame {at + 1} of {FRAMES.length}
        </p>
        <button type="button" className="fd-demo-prev" onClick={() => setAt(Math.max(0, at - 1))} disabled={at === 0}>
          <ChevronLeft aria-hidden="true" size={18} /> Previous
        </button>
        <button type="button" className="fd-demo-next" onClick={() => setAt(Math.min(FRAMES.length - 1, at + 1))} disabled={at === FRAMES.length - 1}>
          Next <ChevronRight aria-hidden="true" size={18} />
        </button>
        <p className="fd-demo-hint">Try it: press Next.</p>
      </div>
    </div>
  );
}
