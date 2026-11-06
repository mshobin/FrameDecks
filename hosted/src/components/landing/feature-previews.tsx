import Image from "next/image";

// The two large feature tiles show the thing itself, drawn in HTML: the Teleprompter's script gliding past a gold
// reading line, and a FrameDecks vCam picture (soft background, LIVE, logo, lower third). The script glides only
// while the tile is on screen (data-loop, motion.tsx) and stays still under "reduce motion" or "Reduce effects".

const SCRIPT = [
  "Good evening, and welcome.",
  "Tonight we look at one simple idea:",
  "small faithful steps, taken together.",
  "Turn to the reading on the screen.",
  "Take a moment with the question.",
  "Share one thought with the person next to you.",
  "Then we will hear from two groups.",
  "Thank you for being here.",
];

export function TeleprompterPreview({ listening = false }: Readonly<{ listening?: boolean }>) {
  return (
    <div className="lp-prompter" aria-hidden="true">
      <div className="lp-prompter-bar">
        <span>Teleprompter</span>
        <span>{listening ? "● Following your voice" : "Only you see this"}</span>
      </div>
      <div className="lp-prompter-view" data-loop="">
        <div className="lp-prompter-roll">
          {[...SCRIPT, ...SCRIPT].map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <i className="lp-prompter-line" />
      </div>
    </div>
  );
}

export function VCamPreview() {
  return (
    <div className="lp-cam" aria-hidden="true">
      <div className="lp-cam-picture">
        <i className="lp-cam-room" />
        <i className="lp-cam-person" />
        <span className="lp-cam-live" data-loop="">
          <i /> LIVE
        </span>
        <span className="lp-cam-logo">
          <Image src="/framedecks-emblem.webp" alt="" width={28} height={28} loading="lazy" unoptimized />
        </span>
        <div className="lp-cam-third">
          <strong>Welcome, everyone</strong>
          <span>Evening session</span>
        </div>
      </div>
      <p className="lp-cam-name">FrameDecks vCam · background blur on</p>
    </div>
  );
}
