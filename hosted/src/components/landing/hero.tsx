import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";

// The hero: the headline rises in word by word (blur to sharp), the second line in gold that catches the light once.
// Then the product arrives the way a room comes to life before a gathering, once and in order (landing.css "hero"):
// the Studio window rises a short way into place, its screen comes on from top to bottom, the gold corners settle
// onto the frame, the phone slides in beside it, and one soft light passes across the glass. Nothing floats or
// loops afterwards; the light behind it is still.

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

function Words({ text, start, className }: Readonly<{ text: string; start: number; className?: string }>) {
  return (
    <span className={className ? `lp-line ${className}` : "lp-line"}>
      {text.split(" ").map((w, i) => (
        <span key={`${w}-${i}`}>
          <span className="lp-word" style={delay(start + i * 80)}>
            {w}
          </span>{" "}
        </span>
      ))}
    </span>
  );
}

export function LandingHero({
  pill,
  first,
  second,
  lede,
  actions,
  trust,
}: Readonly<{
  pill: string;
  first: string;
  second: string;
  lede: string;
  actions: ReactNode;
  trust: string;
}>) {
  const secondStart = 120 + first.split(" ").length * 80;
  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero-copy">
        <p className="lp-pill fd-enter" style={delay(0)}>
          <span className="lp-pill-dot" aria-hidden="true" /> {pill}
        </p>
        <h1 id="lp-hero-title" className="lp-title">
          <Words text={first} start={120} /> <Words text={second} start={secondStart} className="lp-sheen" />
        </h1>
        <p className="lp-lede fd-enter" style={delay(secondStart + 260)}>
          {lede}
        </p>
        <div className="fd-enter" style={delay(secondStart + 360)}>
          {actions}
        </div>
        <p className="lp-trust fd-enter" style={delay(secondStart + 460)}>
          {trust}
        </p>
      </div>

      <figure className="lp-stage">
        <div className="lp-beam" aria-hidden="true" />
        <div className="lp-stage-in">
          <div className="lp-window fd-framed">
            <div className="lp-window-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>FrameDecks Studio</span>
            </div>
            <div className="lp-screen-on">
              <Image
                src="/product/studio.webp"
                alt="The FrameDecks Studio on the presenting PC: the running order on the left and what is on screen in the middle"
                width={1200}
                height={480}
                priority
                unoptimized
              />
              <i className="lp-glint" aria-hidden="true" />
            </div>
          </div>
          <div className="lp-float-phone">
            <Image
              src="/product/live-phone.webp"
              alt="The website's Live page on a phone: Previous, Next, Hide all and Black screen"
              width={390}
              height={844}
              priority
              unoptimized
            />
          </div>
        </div>
        <figcaption>The Studio on your PC. What you see is what the room and the stream see.</figcaption>
      </figure>
    </section>
  );
}
