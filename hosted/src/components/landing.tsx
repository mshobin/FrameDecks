import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Download, Quote, ShieldCheck, Smartphone, Users } from "lucide-react";

import { FeatureTabs, type FeatureTab } from "@/components/landing/feature-tabs";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingHero } from "@/components/landing/hero";
import { LandingNav } from "@/components/landing/nav";
import brand from "@/lib/brand.json";
import { DOWNLOADS } from "@/lib/pc-setup";

// The front page (owner's brief, 27 October; redesign 28 October; about four screens since 6.13, 29 October:
// docs/development/design-system.md "Landing").
// One story for every kind of gathering, told with the real screens on a calm stage: a slow light behind the page,
// one easing family, gold only where the eye should go, the serif for scripture and statements. Every loop runs only
// while on screen and stops under "reduce motion" or "Reduce effects" (motion.tsx). No invented quotes, logos or
// usage numbers.

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const HERO = { first: "Prepare with Purpose.", second: "Present with Excellence." };

const PROOF = ["Free and open source", "Works without internet", "Your phone is the remote", "Every screen and stream"] as const;

// How it works: the four steps that play by themselves (components/landing/how-it-works.tsx), Day 1 to Day 4
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

const TABS: readonly FeatureTab[] = [
  {
    id: "present",
    tab: "Present",
    title: "A tap on the phone. The room follows.",
    lines: ["Press Next and watch the screen change", "Hide all or a black screen in one tap", "Questions show a gentle timer"],
  },
  {
    id: "prompter",
    tab: "Teleprompter",
    title: "A Teleprompter only you see",
    lines: ["Your script beside the controls", "Over the meeting window, or in a window of its own", "It moves on with every Frame"],
  },
  {
    id: "relay",
    tab: "Every screen",
    title: "On every screen and stream",
    lines: [
      "The room screen, live production tools and video meetings",
      "FrameRelay, its own virtual camera, with background blur",
      "Your logo and a lower third on the picture",
    ],
  },
  {
    id: "team",
    tab: "Team and privacy",
    title: "Your whole team. Your own PC.",
    lines: ["Plan together on the website", "Everyone sees only what their role allows", "Pictures, video and the camera stay on your PC"],
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
  // the first four show; the rest open from "More questions"
  { q: "Which computer do we need?", a: "A Windows 10 or 11 PC: the one that drives your screen or your stream. Planning works from any computer or phone." },
  {
    q: "Who can see our information?",
    a: "Only the people on your team, by their role. Pictures, video, the camera and what is on screen never leave the presenting PC.",
  },
  { q: "Can several people plan the same meeting?", a: "Yes. Invite people by email. Every change is kept for 30 days, so anything can be restored." },
] as const;

const CTA_TITLE = "Ready to Serve?";
const PROMISE = { before: "Every screen. Every stream.", gold: "Every member of your team." };
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

function Questions({ list }: Readonly<{ list: readonly { q: string; a: string }[] }>) {
  return (
    <div className="lp-faq">
      {list.map((f) => (
        <details key={f.q}>
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
      <LandingNav downloads={DOWNLOADS} />

      <main id="main" tabIndex={-1}>
        <LandingHero
          pill="For meetings, classes, conferences, events and services"
          first={HERO.first}
          second={HERO.second}
          lede="From prayerful preparation to meaningful moments, FrameDecks keeps your entire service seamlessly connected
              across every screen, every stream, and every member of your team."
          actions={<Actions />}
          proof={PROOF}
        />

        <HowItWorks
          steps={DAYS.map((d, i) => ({ ...d, label: `Day ${i + 1}` }))}
          eyebrow="How it works"
          title="From first idea to final word."
          lead="Plan, rehearse, present: the same steps every time, with nothing to learn twice."
        />

        <section className="lp-section" id="features" aria-labelledby="lp-features-title">
          <div className="lp-head" data-reveal="">
            <p className="lp-eyebrow">See it work</p>
            <h2 id="lp-features-title" className="lp-h2">
              Everything the moment needs. Nothing it doesn&apos;t.
            </h2>
          </div>
          <div data-reveal="" data-spotlight="" style={delay(80)}>
            <FeatureTabs
              tabs={TABS}
              private={
                <ul className="lp-promises">
                  {FEATURES.map((f) => (
                    <li key={f.title}>
                      <span className="lp-icon">
                        <f.icon aria-hidden="true" size={18} />
                      </span>
                      <b>{f.title}</b>
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
              }
            />
          </div>
        </section>

        <section className="lp-section" id="questions" aria-labelledby="lp-faq-title">
          <div className="lp-head" data-reveal="">
            <p className="lp-eyebrow">Questions</p>
            <h2 id="lp-faq-title" className="lp-h2">
              Questions teams ask.
            </h2>
          </div>
          <div data-reveal="" style={delay(80)}>
            <Questions list={FAQ.slice(0, 4)} />
            <details className="lp-faq-more">
              <summary>More questions</summary>
              <Questions list={FAQ.slice(4)} />
            </details>
          </div>
        </section>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <div className="lp-cta-panel" data-reveal="">
            <div className="lp-beam lp-beam-cta" aria-hidden="true" />
            <Image className="lp-cta-mark" src="/framedecks-emblem.webp" alt="" width={56} height={56} loading="lazy" unoptimized />
            <p className="lp-promise fd-serif">
              {PROMISE.before} <b>{PROMISE.gold}</b>
            </p>
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
