import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Download, Quote, ShieldCheck, Smartphone, Users } from "lucide-react";

import { LandingNav } from "@/components/landing/nav";
import { Keys, Tour, type TourChapter } from "@/components/landing/tour";
import { FlourishLater } from "@/components/landing/flourish-later";
import { Rise } from "@/components/landing/rise";
import { SiteFooter } from "@/components/site-footer";
import { DOWNLOADS } from "@/lib/pc-setup";
import "@/app/landing-page.css"; // 8.4 only the landing page loads its own styles
import "@/app/tour.css";

// The front page (owner's brief, 27 October; redesign 28 October; 26.11.2 the stage, 6 November:
// docs/development/design-system.md "Landing").
// The product tells the story: on arrival a meeting builds itself (Frame, Decks, Content) and lands in the real Studio;
// the page's scroll then moves through the program's own screens, each with the keys it uses
// (components/landing/tour.tsx). Apple's way: one idea per screen, the words beside the picture, gold only where the
// eye should go, the app's own colours. Below the stage each section rises in with the scroll and goes back down as
// the page is scrolled back ([data-rise], components/landing/rise.tsx). Nothing runs at rest; "reduce motion" and
// "Reduce effects" are honoured.
// No invented quotes, logos or usage numbers.

const HERO = { first: "Prepare with Purpose.", second: "Present with Excellence." };

// 26.11.26 after the Studio, three chapters: what the leader does during the meeting, each a whole part of it
// (components/landing/tour.tsx); every key is the app's own
const CHAPTERS: readonly TourChapter[] = [
  {
    id: "control",
    label: "Command Center",
    eyebrow: "Command Center · Voice commands",
    title: "Everything, one shortcut away.",
    text: (
      <>
        Press <Keys k="Alt+Space" /> over Zoom, Teams or any app. Go Live, then <Keys k="Alt+→" /> for the next Frame, or just hold <Keys k="Right Ctrl" /> and
        say “next frame”.
      </>
    ),
  },
  {
    id: "voice",
    label: "Teleprompter",
    eyebrow: "Teleprompter · Follow my voice",
    title: "Your script follows your voice.",
    text: (
      <>
        Press <Keys k="V" /> and the Teleprompter keeps your place as you speak. Read a verse and it is offered: one press and it arrives on screen, word by
        word. It listens on your PC only.
      </>
    ),
  },
  {
    id: "together",
    label: "Together",
    eyebrow: "The whole suite",
    title: "Bring everyone in.",
    text: (
      <>
        Chat messages pop up beside you on camera (<Keys k="Ctrl+C" />). Members follow on their phones with one code; prayer requests reach you in a corner
        card, even behind Zoom; sermon notes follow the meeting.
      </>
    ),
  },
];

const FEATURES = [
  {
    icon: Smartphone,
    title: "Run it from your seat",
    text: "Your phone is the remote: Previous, Next, Hide all and the meeting plan, on the local Wi-Fi or across town.",
  },
  {
    icon: Quote,
    title: "Content that speaks",
    text: "Verses and quotes with their references, questions with gentle timers, slides, pictures and video.",
  },
  {
    icon: Users,
    title: "After the meeting",
    text: "A summary of what was shown and prayed for, and sermon notes members keep on their phones.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    text: "Presenting works without internet. Your voice, video files and the camera stay on your PC; slide pictures go online only while Members\u2019 phones is open. No adverts, no tracking.",
  },
] as const;

const FAQ = [
  { q: "What does it cost?", a: "Nothing. FrameDecks is free to download and use, with no adverts and no tracking. Paid team features may come later; anything free today will not become paid without at least 30 days’ notice." },
  {
    q: "Do we need a capture card or extra software?",
    a: "No. FrameDecks vCam appears as a camera in video meeting and streaming platforms. The live production tools and virtual camera solutions you already use keep working too.",
  },
  {
    q: "What if the internet goes down?",
    a: "The presentation carries on. It always runs from your PC; the internet is only for planning together and for using the phone away from the local Wi-Fi.",
  },
  // the first four show; the rest open from "More questions"
  { q: "Which computer do we need?", a: "A Windows 10 or 11 PC: the one that drives your screen or your stream. Planning works from any computer or phone." },
  {
    q: "Who can see our information?",
    a: "Only the people on your team, by their role. Your pictures, video files and the camera stay on the presenting PC. Members’ phones shows people in the meeting only what you choose to share, while the room is open.",
  },
  { q: "Can several people plan the same meeting?", a: "Yes. Invite people by email. Every change is kept for 30 days, so anything can be restored." },
] as const;

const CTA_TITLE = "Ready to Serve?";
const PROMISE = { before: "Every screen. Every stream.", gold: "Every member of your team." };
const VERSE = { text: "And whatsoever ye do, do it heartily, as to the Lord.", ref: "Colossians 3:23 (KJV)" };

function Actions() {
  return (
    <div className="fd-hero-actions">
      <Link className="fd-btn fd-btn-primary fd-btn-lg" href={DOWNLOADS}>
        <Download aria-hidden="true" size={18} /> Download for Windows · free
      </Link>
      <Link className="fd-btn fd-btn-ghost fd-btn-lg" href="/sync?intent=save">
        Start a free workspace <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </div>
  );
}

function Questions({ list, rise }: Readonly<{ list: readonly { q: string; a: string }[]; rise?: boolean }>) {
  return (
    <div className="lp-faq">
      {list.map((f, i) => (
        <details key={f.q} data-spotlight="" data-rise={rise ? i : undefined}>
          <summary>
            {f.q}
            <span className="lp-plus" aria-hidden="true" />
          </summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/** What a visitor who is not signed in sees at the website's address. */
export function Landing() {
  const ctaWords = CTA_TITLE.split(" ");
  return (
    <div className="fd-landing fd-lp">
      <LandingNav />
      <FlourishLater />
      <Rise />

      <main id="main" tabIndex={-1}>
        <Tour
          intro={
            <>
              <p className="lp-eyebrow">For meetings, classes, conferences, events and services</p>
              <h1>
                {HERO.first} <span>{HERO.second}</span>
              </h1>
              <p className="tr-lede">
                From prayerful preparation to meaningful moments, FrameDecks keeps your entire service seamlessly connected across every screen, every
                stream, and every member of your team.
              </p>
            </>
          }
          chapters={CHAPTERS}
        />

        <section className="lp-section" id="features" aria-labelledby="lp-features-title">
          <div className="lp-head" data-rise="">
            <p className="lp-eyebrow">Made for the whole team</p>
            <h2 id="lp-features-title" className="lp-h2">
              Prepared before. Confident during.
            </h2>
          </div>
          <ul className="lp-promises" data-spotlight="">
            {FEATURES.map((f, i) => (
              <li key={f.title} data-rise={i}>
                <span className="lp-icon">
                  <f.icon aria-hidden="true" size={18} />
                </span>
                <b>{f.title}</b>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section" id="questions" aria-labelledby="lp-faq-title">
          <div className="lp-head" data-rise="">
            <p className="lp-eyebrow">Questions</p>
            <h2 id="lp-faq-title" className="lp-h2">
              Questions teams ask.
            </h2>
          </div>
          <div>
            <Questions list={FAQ.slice(0, 4)} rise />
            <details className="lp-faq-more" data-rise="2">
              <summary>More questions</summary>
              <Questions list={FAQ.slice(4)} />
            </details>
          </div>
        </section>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <div className="lp-cta-panel" data-rise="" data-spotlight="">
            <div className="lp-beam lp-beam-cta" aria-hidden="true" />
            <Image className="lp-cta-mark" src="/framedecks-emblem.webp" alt="" width={56} height={56} loading="lazy" unoptimized />
            <p className="lp-promise fd-serif">
              {PROMISE.before} <b>{PROMISE.gold}</b>
            </p>
            <blockquote className="lp-verse">
              <p className="fd-serif">“{VERSE.text}”</p>
              <cite>{VERSE.ref}</cite>
            </blockquote>
            {/* 9.11.2 the closing scene: a Frame, its Deck and its Content come together above the title (flourish.css
                shows it; without that stylesheet it stays hidden); the three come together with the scroll (rise.tsx) */}
            <p className="lp-assemble" style={{ display: "none" }} aria-hidden="true">
              <span data-rise="2" data-rx="-28">
                Frame
              </span>
              <span data-rise="3">Deck</span>
              <span data-rise="4" data-rx="28">
                Content
              </span>
            </p>
            <h2 id="lp-cta-title" className="lp-h2 lp-cta-title" aria-label={CTA_TITLE}>
              {ctaWords.slice(0, -1).join(" ")} <span className="lp-sheen">{ctaWords.at(-1)}</span>
            </h2>
            <p>Free to download, and ready when your team is.</p>
            <Actions />
          </div>
        </section>
      </main>

      <SiteFooter />
      {/* 26.11.28 everything after the stage is one free-scrolling area for the stage's snap points (tour.css) */}
      <i className="tr-snap-rest" aria-hidden="true" style={{ "--n": CHAPTERS.length + 1 } as CSSProperties} />
    </div>
  );
}
