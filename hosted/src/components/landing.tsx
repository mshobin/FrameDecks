import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Download, MonitorPlay, Quote, ScrollText, ShieldCheck, Smartphone, Users } from "lucide-react";

import { AboutButton } from "@/components/about-dialog";
import { NextDemo } from "@/components/next-demo";
import { ThemeToggle } from "@/components/theme-toggle";
import brand from "@/lib/brand.json";
import { DOWNLOADS } from "@/lib/pc-setup";

// The front page (owner's brief, 27 October; docs/design-system.md "Landing"): one story for every kind of gathering,
// told with the real screens and quiet, cinematic motion. Motion is CSS only (landing.css, motion.css): it plays once,
// moves only transform and opacity, and stops for people who ask their device for less motion. No invented quotes,
// logos or usage numbers.

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const FOR = ["Meetings", "Classes", "Conferences", "Services", "Events", "Productions"] as const;

const DAYS = [
  {
    title: "Plan together",
    text: "Build the meeting on the website from any computer: slides, readings, discussion questions and the presenter's script. Invite your team to help.",
  },
  {
    title: "Rehearse without risk",
    text: "Open Run on the presenting PC and turn on Practice mode. Your audience sees a black screen while you try every button.",
  },
  {
    title: "Check before you begin",
    text: "A short checklist confirms your Frames, the virtual camera and the phone remote. Green means ready.",
  },
  {
    title: "Present from anywhere",
    text: "Stand at the back or sit with the group. Each tap moves the room screen and the stream together.",
  },
] as const;

const FEATURES = [
  {
    icon: MonitorPlay,
    title: "On every screen and stream",
    text: "One program for the room screen, live production tools and video meetings, through its own virtual camera, FRAMECAST, with background blur and your logo.",
  },
  {
    icon: Quote,
    title: "Content that speaks",
    text: "Verses and quotes with their references, questions with gentle timers, slides, pictures and video.",
  },
  {
    icon: ScrollText,
    title: "A Teleprompter only you see",
    text: "Your script beside the controls, over the meeting window, or in a window of its own.",
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
    a: "No. FRAMECAST appears as a camera in video meeting and streaming platforms. The live production tools and virtual camera solutions you already use keep working too.",
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
  return (
    <div className="fd-landing fd-lp">
      <header className="fd-landing-bar">
        <Link className="fd-brand" href="/" aria-label="FrameDecks home">
          <span className="fd-brand-mark">
            <Image src="/framedecks-emblem.webp" alt="" width={30} height={30} priority unoptimized />
          </span>
          <span className="fd-brand-copy">
            <strong>FrameDecks</strong>
          </span>
        </Link>
        <nav className="fd-landing-links" aria-label="On this page">
          <a href="#try">See it work</a>
          <a href="#features">Features</a>
          <a href="#days">How it works</a>
          <a href="#questions">Questions</a>
        </nav>
        <div className="fd-topbar-right">
          <ThemeToggle />
          <AboutButton />
          <Link className="fd-btn fd-btn-ghost fd-btn-sm" href="/sign-in">
            Sign in
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-hero-copy">
            <p className="lp-pill fd-enter" style={delay(0)}>
              <span className="lp-pill-dot" aria-hidden="true" /> For meetings, classes, conferences, events and services
            </p>
            <h1 id="lp-hero-title" className="lp-title">
              <span className="lp-line fd-enter" style={delay(90)}>
                Prepare with Purpose.
              </span>{" "}
              <span className="lp-line lp-gold fd-enter" style={delay(200)}>
                Present with Excellence.
              </span>
            </h1>
            <p className="lp-lede fd-enter" style={delay(320)}>
              From prayerful preparation to meaningful moments, FrameDecks keeps your entire service seamlessly connected
              across every screen, every stream, and every member of your team.
            </p>
            <div className="fd-enter" style={delay(430)}>
              <Actions />
            </div>
            <p className="lp-trust fd-enter" style={delay(540)}>
              Free and open source · Works without internet · Your pictures and video never leave your PC
            </p>
          </div>

          <figure className="lp-stage fd-enter-card">
            <div className="lp-stage-glow" aria-hidden="true" />
            <div className="lp-stage-tilt">
              <div className="lp-window fd-framed">
                <div className="lp-window-bar" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <span>FrameDecks Studio</span>
                </div>
                <Image
                  src="/product/studio.webp"
                  alt="The FrameDecks Studio on the presenting PC: the running order on the left and what is on screen in the middle"
                  width={1200}
                  height={480}
                  priority
                  unoptimized
                />
              </div>
            </div>
            <figcaption>The Studio on your PC. What you see is what the room and the stream see.</figcaption>
          </figure>
        </section>

        <section className="lp-for" aria-label="Made for every gathering">
          <ul>
            {FOR.map((f, i) => (
              <li key={f} data-reveal="" style={delay(i * 60)}>
                {f}
              </li>
            ))}
          </ul>
        </section>

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
            <article className="lp-card lp-card-hero" data-reveal="" data-spotlight="">
              <div className="lp-card-copy">
                <span className="lp-icon">
                  <Smartphone aria-hidden="true" size={20} />
                </span>
                <h3>Guided from your phone</h3>
                <p>Previous, Next, Hide all and a black screen from any phone, on the local Wi-Fi or across town.</p>
              </div>
              <Image
                className="lp-phone"
                src="/product/live-phone.webp"
                alt="The website's Live page on a phone: Previous, Next, Hide all and Black screen"
                width={390}
                height={844}
                unoptimized
              />
            </article>
            {FEATURES.map((f, i) => (
              <article key={f.title} className="lp-card" data-reveal="" data-spotlight="" style={delay(80 + i * 70)}>
                <span className="lp-icon">
                  <f.icon aria-hidden="true" size={20} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" id="days" aria-labelledby="lp-days-title">
          <div className="lp-head" data-reveal="">
            <p className="lp-eyebrow">How it works</p>
            <h2 id="lp-days-title" className="lp-h2">
              From first idea to final word.
            </h2>
            <p>Plan, rehearse, present: the same steps every time, with nothing to learn twice.</p>
          </div>
          <ol className="lp-days">
            {DAYS.map((d, i) => (
              <li key={d.title} data-reveal="" style={delay(i * 110)}>
                <span className="lp-day">Day {i + 1}</span>
                <span className="lp-node" aria-hidden="true" />
                <div>
                  <h3>{d.title}</h3>
                  <p>{d.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-statement" aria-label="Our promise">
          <p className="fd-serif" data-reveal="">
            Every screen. Every stream. <span className="lp-gold">Every member of your team.</span>
          </p>
        </section>

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
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <div className="lp-cta-panel" data-reveal="">
            <Image className="lp-cta-mark" src="/framedecks-emblem.webp" alt="" width={56} height={56} unoptimized />
            <h2 id="lp-cta-title" className="lp-h2">
              Ready to Serve?
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
