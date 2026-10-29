import type { Metadata } from "next";
import Link from "next/link";

import { PublicPage } from "@/components/public-page";
import { ShowGuide } from "@/components/show-guide";
import brand from "@/lib/brand.json";
import { DOWNLOADS } from "@/lib/pc-setup";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Help", "/help");


// One page a volunteer can open on a phone five minutes before the service (owner-approved, 27 October).
// Keep it short, in the words of docs/guide/glossary.md, and true to the product; longer guides live in docs/.
export default function HelpPage() {
  const contact = "hello@framedecks.com";
  return (
    <PublicPage eyebrow="Help Center" title="Help" lead="What a volunteer needs five minutes before the service. Longer guides are in the Documentation.">
      <div className="auth-legal fd-help">
        <nav aria-label="On this page" className="fd-help-toc">
          <a href="#start">Getting started</a> · <a href="#day">On the day</a> · <a href="#problems">If something goes wrong</a> ·{" "}
          <a href="#words">Words</a> · <a href="#contact">Contact</a>
        </nav>

        <h2 id="start">Getting started</h2>
        <ol>
          <li>
            <strong>Install FrameDecks</strong> on the Windows PC that drives your screen or your stream:{" "}
            <Link href={DOWNLOADS}>download it here</Link>
            . It is free.
          </li>
          <li>
            <strong>Plan</strong> the meeting: in the program (Studio → Prepare) or on this website (Plan), from any
            computer or phone.
          </li>
          <li>
            <strong>Choose how people see it</strong>: in the program, Settings → How people see it (FrameRelay in your video meeting or
            streaming platform, the Share Window, or a projector, TV or live production tool).
          </li>
          <li>
            <strong>Practise</strong>: Studio → Run → tick Practice mode. Your audience would see a black screen while you
            try Go Live, Next and Hide all.
          </li>
        </ol>

        <p>
          <strong>Setup guide:</strong> the same seven steps, each ticked when it is really done. In FrameDecks on the PC:
          Settings → About → Guided tour. Here: <ShowGuide />
        </p>

        <h2 id="day">On the day</h2>
        <ul>
          <li>Open FrameDecks on the service PC and select <strong>Run</strong>.</li>
          <li>
            Read <strong>Before you start</strong>: every line green? Untick Practice mode if it is on.
          </li>
          <li>
            In your video meeting or streaming platform, choose <strong>FrameRelay</strong> as the camera (if that is how people see it).
          </li>
          <li>
            Running from a phone? Open <Link href="/live">Live</Link> here, or the phone remote on the local Wi-Fi.
          </li>
          <li>
            The keys: <kbd>T</kbd> Go Live, <kbd>]</kbd> Next, <kbd>[</kbd> Previous, <kbd>Esc</kbd> Hide all,{" "}
            <kbd>K</kbd> Black screen.
          </li>
        </ul>

        <h2 id="problems">If something goes wrong</h2>
        <ul>
          <li>
            <strong>Something wrong is on screen:</strong> press <kbd>Esc</kbd> (Hide all). It always works.
          </li>
          <li>
            <strong>The screen must go dark now:</strong> press <kbd>K</kbd> (Black screen); press it again to come back.
          </li>
          <li>
            <strong>Your meeting app shows no FrameRelay camera:</strong> in FrameDecks, Settings → How people see it → FrameRelay
            Camera → Install, then restart the meeting app.
          </li>
          <li>
            <strong>The website says the PC is offline:</strong> open FrameDecks on that PC and check its internet.
          </li>
          <li>
            More answers:{" "}
            <Link href="/docs/troubleshooting">
              troubleshooting guide
            </Link>
            ,{" "}
            <Link href="/docs/getting-started">
              full getting-started guide
            </Link>
            .
          </li>
        </ul>

        <h2 id="words">Words</h2>
        <dl className="fd-help-words">
          <dt>Frame</dt>
          <dd>One step of the meeting: what is on screen at one moment.</dd>
          <dt>Prepare / Run</dt>
          <dd>Plan and edit / run the service, with nothing to edit by accident.</dd>
          <dt>FrameRelay</dt>
          <dd>FrameDecks&apos;s own camera, which you choose in your video meeting or streaming platform.</dd>
          <dt>Service PC</dt>
          <dd>The Windows PC that runs the meeting.</dd>
        </dl>
        <p>
          All the words:{" "}
          <Link href="/docs/glossary">
            glossary
          </Link>
          .
        </p>

        <h2 id="contact">Contact</h2>
        <p>
          A question, a problem or an idea? Write to{" "}
          <a href={`mailto:${contact}?subject=${encodeURIComponent(`FrameDecks ${brand.version}: help`)}`}>{contact}</a>. In
          the program, Settings → Diagnostics → Copy diagnostics adds useful details (never your PIN or members).
        </p>
        <p className="fd-help-version">
          FrameDecks {brand.version} · <Link href="/docs">Documentation</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </div>
    </PublicPage>
  );
}
