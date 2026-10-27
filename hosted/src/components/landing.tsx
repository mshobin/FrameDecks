import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";

import { AboutButton } from "@/components/about-dialog";
import { NextDemo } from "@/components/next-demo";
import { ThemeToggle } from "@/components/theme-toggle";
import brand from "@/lib/brand.json";
import { DOWNLOADS } from "@/lib/pc-setup";

// The front page, rebuilt around one story (owner-approved, 27 October; docs/design-system.md "Identity"):
// what it is in one sentence, the real screens, the moment a tap changes the room, a week with FRAMEDECKS,
// plain answers, and a footer a church administrator can trust. No invented quotes or numbers: when the owner
// supplies a real church's words, they go in the "In their words" slot below the week.

const WEEK = [
  { when: "Tuesday evening", title: "Plan at home", text: "Open Plan on the website: the readings, the discussion questions and the presenter's script. Anyone you invite can help." },
  { when: "Saturday", title: "Practise without fear", text: "On the service PC, open Run and tick Practice mode. The audience would see a black screen while you try every button." },
  { when: "Sunday, 9:40", title: "Before you start", text: "Run shows a short checklist: your Frames, the camera for Zoom, the phone remote. Green means ready." },
  { when: "Sunday, 10:00", title: "Next, from your phone", text: "Stand at the back, or sit with the group. Each tap moves the room screen and Zoom on together." },
] as const;

const DOES = [
  { title: "Scripture and discussion", text: "Verses with their references, questions with gentle timers, and a Teleprompter only the presenter sees." },
  { title: "In the room and in Zoom", text: "One program for the room screen, OBS, and Zoom or Teams through its own camera, FRAMECAST, with blur and your logo." },
  { title: "Guided from a phone", text: "Previous, Next, Hide all and a black screen from any phone, on the church Wi-Fi or across town." },
  { title: "Your people", text: "Members, groups and birthday reminders in one list, kept the same on the website and the service PC." },
] as const;

const FAQ = [
  { q: "What does it cost?", a: "Nothing. FRAMEDECKS is free and open source under the Apache 2.0 licence. There are no adverts and no tracking." },
  { q: "Do we need OBS or a capture card?", a: "No. FRAMECAST appears in Zoom, Teams and Google Meet as a camera. OBS and Camo still work if you already use them." },
  { q: "What if the internet goes down?", a: "The service carries on. It always runs from the service PC; the internet is only for planning together and for the phone away from the church Wi-Fi." },
  { q: "Which computer do we need?", a: "A Windows 10 or 11 PC: the one that drives your room screen or your Zoom. Planning works from any computer or phone." },
  { q: "Who can see our information?", a: "Only the people in your church's space, by their role. Pictures, video, the camera and what is on screen never leave the service PC." },
  { q: "Can several people plan the same meeting?", a: "Yes. Invite leaders by email. Every change is kept for 30 days, so anything can be restored." },
] as const;

/** What a visitor who is not signed in sees at the companion's address. */
export function Landing() {
  return (
    <div className="fd-landing">
      <header className="fd-landing-bar">
        <Link className="fd-brand" href="/" aria-label="FRAMEDECKS">
          <span className="fd-brand-mark">
            <Image src="/framedecks-emblem.webp" alt="" width={30} height={30} priority unoptimized />
          </span>
          <span className="fd-brand-copy">
            <strong>FRAMEDECKS</strong>
          </span>
        </Link>
        <nav className="fd-landing-links" aria-label="On this page">
          <a href="#try">Try it</a>
          <a href="#week">How it works</a>
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
        <section className="fd-hero2" aria-labelledby="fd-hero-title">
          <div className="fd-hero2-copy">
            <p className="fd-kicker">For churches, Bible studies and small groups</p>
            <h1 id="fd-hero-title" className="fd-hero2-title">
              Your church&apos;s screen and Zoom, run from your phone.
            </h1>
            <p className="fd-hero2-text">
              FRAMEDECKS puts verses, discussion questions and slides on the room screen and in Zoom or Teams. Plan during
              the week from any computer; on Sunday a volunteer runs it from the service PC or a phone.
            </p>
            <div className="fd-hero-actions">
              <a className="fd-btn fd-btn-primary" href={DOWNLOADS} target="_blank" rel="noreferrer">
                <Download aria-hidden="true" size={17} /> Download for Windows · free
              </a>
              <Link className="fd-link" href="/sign-in#new">
                Or plan online first <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </div>
            <p className="fd-trustline">
              Free and open source · Works without internet · Your pictures and video never leave your PC ·{" "}
              <Link href="/privacy">Privacy</Link>
            </p>
          </div>
          <figure className="fd-hero2-shot">
            <div className="fd-framed">
              <Image
                src="/product/studio.webp"
                alt="The FRAMEDECKS Studio on the service PC: the running order on the left and the verse and discussion question on the screen"
                width={1200}
                height={479}
                priority
                unoptimized
              />
            </div>
            <figcaption>The Studio on the service PC. What you see is what the room and Zoom see.</figcaption>
          </figure>
        </section>

        <section className="fd-try" id="try" aria-labelledby="fd-try-title">
          <div className="fd-section-head">
            <h2 id="fd-try-title" className="fd-section-title">
              A tap on the phone. The room follows.
            </h2>
            <p>This is the whole idea. Press Next and watch the screen change, as it does on Sunday.</p>
          </div>
          <NextDemo />
        </section>

        <section className="fd-week" id="week" aria-labelledby="fd-week-title">
          <div className="fd-section-head">
            <h2 id="fd-week-title" className="fd-section-title">
              A week with FRAMEDECKS.
            </h2>
            <p>Plan, practise, run: the same three steps every week, with nothing to learn twice.</p>
          </div>
          <ol className="fd-timeline">
            {WEEK.map((w) => (
              <li key={w.when}>
                <span className="fd-when fd-serif">{w.when}</span>
                <div>
                  <h3>{w.title}</h3>
                  <p>{w.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="fd-verse" aria-label="Why it matters">
          <blockquote className="fd-serif">
            “Let all things be done decently and in order.”
            <cite>1 Corinthians 14:40</cite>
          </blockquote>
        </section>

        <section className="fd-does" aria-labelledby="fd-does-title">
          <div className="fd-section-head">
            <h2 id="fd-does-title" className="fd-section-title">
              What it does.
            </h2>
          </div>
          <div className="fd-does-grid">
            <Image
              className="fd-does-phone"
              src="/product/live-phone.webp"
              alt="The website's Live page on a phone: Previous, Next, Hide all and Black screen for the service PC"
              width={390}
              height={844}
              unoptimized
            />
            <dl>
              {DOES.map((d) => (
                <div key={d.title}>
                  <dt>{d.title}</dt>
                  <dd>{d.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="fd-faq" id="questions" aria-labelledby="fd-faq-title">
          <div className="fd-section-head">
            <h2 id="fd-faq-title" className="fd-section-title">
              Questions churches ask.
            </h2>
          </div>
          <div className="fd-faq-list">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="fd-ready-cta" aria-labelledby="fd-ready-title">
          <h2 id="fd-ready-title" className="fd-section-title">
            Ready for Sunday?
          </h2>
          <div className="fd-hero-actions">
            <a className="fd-btn fd-btn-primary" href={DOWNLOADS} target="_blank" rel="noreferrer">
              <Download aria-hidden="true" size={17} /> Download for Windows · free
            </a>
            <Link className="fd-link" href="/sign-in#new">
              Or plan online first <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="fd-landing-foot">
        <div className="fd-foot-brand">
          <strong>FRAMEDECKS</strong>
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
