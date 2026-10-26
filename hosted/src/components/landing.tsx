import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  ClipboardList,
  Download,
  History,
  Lock,
  Radio,
  Users,
  Video,
} from "lucide-react";

import { AboutButton } from "@/components/about-dialog";
import { MISSION } from "@/components/brand-hero";
import { Words } from "@/components/words";
import { Workflow } from "@/components/workflow";
import { DOWNLOADS } from "@/lib/pc-setup";

const FEATURES = [
  { icon: ClipboardList, title: "Plan together, online", text: "The Meeting Form holds every Frame, question and reading. Leaders prepare from home; the service PC is ready when they arrive." },
  { icon: Video, title: "Present anywhere", text: "One program for the room screen, OBS, and Zoom or Teams through the FRAMECAST camera, with blur and branding." },
  { icon: Radio, title: "Guide from your phone", text: "Next Frame, questions, scripture and a black screen, from the back of the room or across town." },
  { icon: BookOpenText, title: "Scripture and discussion", text: "Readings with their references, discussion questions with timers, and a Teleprompter only the presenter sees." },
  { icon: Users, title: "Your people", text: "Members, groups and birthdays in one list, kept in step between the website and the service PC." },
  { icon: History, title: "Nothing is lost", text: "Every change is kept for 30 days: see who changed what, and restore an earlier version or a deleted Frame." },
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
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <div className="fd-topbar-right">
          <AboutButton />
          <Link className="fd-btn fd-btn-primary fd-btn-sm" href="/sign-in">
            Sign in
          </Link>
        </div>
      </header>

      <section className="fd-hero" aria-labelledby="fd-hero-title">
        <h1 id="fd-hero-title" className="fd-hero-title">
          <Words text="Every gathering, beautifully prepared." />
        </h1>
        <p className="fd-hero-text fd-enter" style={{ "--d": "700ms" } as React.CSSProperties}>
          Plan the meeting here, from any computer or phone. FRAMEDECKS on your service PC puts it on the room screen,
          in Zoom or Teams through the FRAMECAST camera, and in OBS, while you guide it from your phone.
        </p>
        <div className="fd-hero-actions fd-enter" style={{ "--d": "850ms" } as React.CSSProperties}>
          <Link className="fd-btn fd-btn-primary" href="/sign-in">
            Get started <ArrowRight aria-hidden="true" size={17} />
          </Link>
          <a className="fd-btn fd-btn-glass" href={DOWNLOADS} target="_blank" rel="noreferrer">
            <Download aria-hidden="true" size={17} /> FRAMEDECKS for Windows
          </a>
        </div>
        <p className="fd-hero-note fd-enter" style={{ "--d": "1000ms" } as React.CSSProperties}>
          Free and open source (Apache 2.0) · Windows 10 and 11 · Zoom, Teams, Google Meet and OBS · Your pictures and
          video never leave your PC
        </p>
        {/* Product truth (design audit DD-07): the real program and the real phone page, not an illustration */}
        <figure className="fd-shots fd-enter" style={{ "--d": "1100ms" } as React.CSSProperties}>
          <Image
            className="fd-shot-desktop"
            src="/product/studio.webp"
            alt="The FRAMEDECKS Studio on the service PC: the Frames of a Bible study on the left and the verse and discussion question in the preview"
            width={1200}
            height={479}
            priority
            unoptimized
          />
          <Image
            className="fd-shot-phone"
            src="/product/live-phone.webp"
            alt="The website's Live page on a phone: Previous, Next, Hide all and Black screen for the service PC"
            width={390}
            height={844}
            unoptimized
          />
          <figcaption>The Studio on the service PC, and the Live page on a phone during the meeting.</figcaption>
        </figure>
      </section>

      <section className="fd-section" id="how" aria-labelledby="fd-how-title">
        <p className="fd-kicker" data-reveal>How it works</p>
        <h2 id="fd-how-title" className="fd-section-title" data-reveal>
          From the plan to the screen in four steps.
        </h2>
        <Workflow />
      </section>

      <section className="fd-section" id="features" aria-labelledby="fd-features-title">
        <p className="fd-kicker" data-reveal>Features</p>
        <h2 id="fd-features-title" className="fd-section-title" data-reveal>
          Everything a gathering needs, in one calm place.
        </h2>
        <div className="fd-features">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <article className="fd-feature" key={title} data-reveal data-spotlight style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
              <span className="fd-feature-icon">
                <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="fd-cta" aria-labelledby="fd-cta-title" data-reveal data-spotlight>
        <Lock aria-hidden="true" size={22} />
        <h2 id="fd-cta-title">Private by design.</h2>
        <p>
          The website keeps the words of your plan and your people, and only your workspace sees them. Pictures, video,
          the camera and what is on screen stay on your service PC.
        </p>
        <Link className="fd-btn fd-btn-primary" href="/sign-in">
          Sign in to your workspace <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </section>

      <section className="fd-mission" aria-label="Why FRAMEDECKS" data-reveal>
        <p>{MISSION}</p>
      </section>

      <footer className="fd-landing-foot">
        <span>FRAMEDECKS · Present · Equip · Inspire</span>
        <Link href="/privacy">Privacy policy</Link>
      </footer>
    </div>
  );
}
