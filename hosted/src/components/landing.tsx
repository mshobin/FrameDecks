import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Download, MonitorPlay, Quote, ScrollText, ShieldCheck, Smartphone, Users } from "lucide-react";

import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingHero } from "@/components/landing/hero";
import { LandingNav } from "@/components/landing/nav";
import { Statement } from "@/components/landing/statement";
import { FrameRelayPreview, TeleprompterPreview } from "@/components/landing/feature-previews";
import { NextDemo } from "@/components/next-demo";
import brand from "@/lib/brand.json";
import { DOWNLOADS } from "@/lib/pc-setup";

// The front page (owner's brief, 27 October; redesign 28 October; docs/development/design-system.md "Landing").
// One story for every kind of gathering, told with the real screens on a calm stage: a slow light behind the page,
// one easing family, gold only where the eye should go, the serif for scripture and statements. Every loop runs only
// while on screen and stops under "reduce motion" or "Reduce effects" (motion.tsx). No invented quotes, logos or
// usage numbers.

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const HERO = { first: "Prepare with Purpose.", second: "Present with Excellence." };

const FOR = [
  "Meetings",
  "Classes",
  "Conferences",
  "Services",
  "Events",
  "Productions",
  "Workshops",
  "Retreats",
  "Seminars",
  "Livestreams",
] as const;

// How it works: the four steps of the pinned guide (components/landing/how-it-works.tsx), Day 1 to Day 4
const DAYS = [
  {
    title: "Plan together",
    text: "Build the meeting on the website from any computer: slides, readings, discussion questions and the presenter's script. Invite your team to help.",
    callout: "Team invited",
  },
  {
    title: "Rehearse without risk",
    text: "Open Run on the presenting PC and turn on Practice mode. Your audience sees a black screen while you try every button.",
    callout: "Audience sees black",
  },
  {
    title: "Check before you begin",
    text: "A short checklist confirms your Frames, the virtual camera and the phone remote. Green means ready.",
    callout: "Green means ready",
  },
  {
    title: "Present from anywhere",
    text: "Stand at the back or sit with the group. Each tap moves the room screen and the stream together.",
    callout: "One tap, every screen",
  },
];

const FEATURES = [
  {
    icon: Smartphone,
    title: "Guided from your phone",
    text: "Previous, Next, Hide all and a black screen from any phone, on the local Wi-Fi or across town.",
  },
  {
    icon: Quote,
    title: "Content that speaks",
    text: "Verses and quotes with their references, questions with gentle timers, slides, pictures and video.",
  },
  {
    icon: Users,
    title: "Your whole team",
    text: "People, groups and reminders in one list, kept the same on the website and the presenting PC.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    text: "Works without internet. Pictures, video and the camera never leave your PC. No adverts, no tracking.",
  },
] as const;

const FAQ = [
  { q: "What does it cost?", a: "Nothing. FrameDecks is free and open source under the Apache 2.0 licence. There are no adverts and no tracking." },
  {
    q: "Do we need a capture card or extra software?",
    a: "No. FrameRelay appears as a camera in video meeting and streaming platforms. The live production tools and virtual camera solutions you already use keep working too.",
  },
  {
    q: "What if the internet goes down?",
    a: "The presentation carries on. It always runs from your PC; the internet is only for planning together and for using the phone away from the local Wi-Fi.",
  },
  { q: "Which computer do we need?", a: "A Windows 10 or 11 PC: the one that drives your screen or your stream. Planning works from any computer or phone." },
  {
    q: "Who can see our information?",
    a: "Only the people on your team, by their role. Pictures, video, the camera and what is on screen never leave the presenting PC.",
  },
  { q: "Can several people plan the same meeting?", a: "Yes. Invite people by email. Every change is kept for 30 days, so anything can be restored." },
] as const;

const CTA_TITLE = "Ready to Serve?";
const VERSE = { text: "And whatsoever ye do, do it heartily, as to the Lord.", ref: "Colossians 3:23 (KJV)" };

function Actions() {
  return (
    <div className="fd-hero-actions">
      <a className="fd-btn fd-btn-primary fd-btn-lg" href={DOWNLOADS} target="_blank" rel="noreferrer">
        <Download aria-hidden="true" size={18} /> Download for Windows · free
      </a>
      <Link className="fd-btn fd-btn-ghost fd-btn-lg" href="/sign-in#new">
        Plan online first <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </div>
  );
}

/** What a visitor who is not signed in sees at the website's address. */
export function Landing() {
  const ctaWords = CTA_TITLE.split(" ");
  return (
    <div className="fd-landing fd-lp">
      <LandingNav downloads={DOWNLOADS} />

      <main id="main" tabIndex={-1}>
        <LandingHero
          pill="For meetings, classes, conferences, events and services"
          first={HERO.first}
          second={HERO.second}
          lede="From prayerful preparation to meaningful moments, FrameDecks keeps your entire service seamlessly connected
              across every screen, every stream, and every member of your team."
          actions={<Actions />}
          trust="Free and open source · Works without internet · Your pictures and video never leave your PC"
        />

        <section className="lp-for" aria-label="Made for every gathering">
          <div className="lp-marquee" data-loop="">
            <ul className="lp-marquee-track">
              {FOR.map((f) => (
                <li key={f}>{f}</li>
              ))}
              {FOR.map((f) => (
                <li key={`again-${f}`} aria-hidden="true" className="lp-marquee-again">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <HowItWorks
          steps={DAYS.map((d, i) => ({ ...d, label: `Day ${i + 1}` }))}
          eyebrow="How it works"
          title="From first idea to final word."
          lead="Plan, rehearse, present: the same steps every time, with nothing to learn twice."
        />

        <section className="lp-section" id="try" aria-labelledby="lp-try-title">
          <div className="lp-head" data-reveal="">
            <p className="lp-eyebrow">See it work</p>
            <h2 id="lp-try-title" className="lp-h2">
              A tap on the phone. The room follows.
            </h2>
            <p>That is the whole idea. Press Next and watch the screen change, exactly as it does on the day.</p>
          </div>
          <div data-reveal="" style={delay(120)}>
            <NextDemo />
          </div>
        </section>

        <section className="lp-section" id="features" aria-labelledby="lp-features-title">
          <div className="lp-head" data-reveal="">
            <p className="lp-eyebrow">Features</p>
            <h2 id="lp-features-title" className="lp-h2">
              Everything the moment needs. Nothing it doesn&apos;t.
            </h2>
          </div>
          <div className="lp-bento">
            <article className="lp-card lp-card-wide lp-card-prompter" data-reveal="" data-spotlight="">
              <div className="lp-card-copy">
                <span className="lp-icon">
                  <ScrollText aria-hidden="true" size={20} />
                </span>
                <h3>A Teleprompter only you see</h3>
                <p>Your script beside the controls, over the meeting window, or in a window of its own.</p>
              </div>
              <TeleprompterPreview />
            </article>
            <article className="lp-card lp-card-wide lp-card-stream" data-reveal="" data-spotlight="" style={delay(80)}>
              <div className="lp-card-copy">
                <span className="lp-icon">
                  <MonitorPlay aria-hidden="true" size={20} />
                </span>
                <h3>On every screen and stream</h3>
                <p>
                  One program for the room screen, live production tools and video meetings, through its own virtual camera,
                  FrameRelay, with background blur and your logo.
                </p>
              </div>
              <FrameRelayPreview />
            </article>
            {FEATURES.map((f, i) => (
              <article key={f.title} className="lp-card" data-reveal="" data-spotlight="" style={delay(120 + i * 70)}>
                <span className="lp-icon">
                  <f.icon aria-hidden="true" size={20} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <Statement before="Every screen. Every stream." gold="Every member of your team." />

        <section className="lp-section" id="questions" aria-labelledby="lp-faq-title">
          <div className="lp-head" data-reveal="">
            <p className="lp-eyebrow">Questions</p>
            <h2 id="lp-faq-title" className="lp-h2">
              Questions teams ask.
            </h2>
          </div>
          <div className="lp-faq" data-reveal="" style={delay(80)}>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <span className="lp-plus" aria-hidden="true" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <div className="lp-cta-panel" data-reveal="">
            <div className="lp-beam lp-beam-cta" aria-hidden="true" />
            <Image className="lp-cta-mark" src="/framedecks-emblem.webp" alt="" width={56} height={56} loading="lazy" unoptimized />
            <blockquote className="lp-verse">
              <p className="fd-serif">“{VERSE.text}”</p>
              <cite>{VERSE.ref}</cite>
            </blockquote>
            <h2 id="lp-cta-title" className="lp-h2 lp-cta-title" aria-label={CTA_TITLE}>
              {ctaWords.slice(0, -1).join(" ")} <span className="lp-sheen">{ctaWords.at(-1)}</span>
            </h2>
            <p>Free, open source, and ready when your team is.</p>
            <Actions />
          </div>
        </section>
      </main>

      <footer className="fd-landing-foot">
        <div className="fd-foot-brand">
          <strong>FrameDecks</strong>
          <span>Version {brand.version} · Apache 2.0 licence</span>
        </div>
        <nav className="fd-foot-links" aria-label="More">
          <a href={DOWNLOADS} target="_blank" rel="noreferrer">
            Download
          </a>
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="https://github.com/mshobin/FRAMEDECKS/blob/main/LICENSE" target="_blank" rel="noreferrer">
            Licence
          </a>
          <Link href="/help#contact">Contact</Link>
        </nav>
      </footer>
    </div>
  );
}
