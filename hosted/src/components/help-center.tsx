"use client";

// FrameDecks 8.6 - the Help Center: topics on the left, the chosen topic on the right (on a phone the topics fold into
// one button above the content). The topic is in the address (#teleprompter), so a link can open one and Back works;
// the older anchors (#guide, #start, #day, #problems, #words, #contact) still land on the right topic.
// Keep the words in docs/guide/glossary.md's language and true to the product; longer guides live in /docs.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Download,
  Home,
  Radio,
  ChevronDown,
  CreditCard,
  Layers,
  LifeBuoy,
  Mail,
  MessageCircle,
  MonitorPlay,
  Rocket,
  ScrollText,
  Search,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { HelpGuide } from "@/components/help-guide";
import { HelpVote } from "@/components/help-vote";
import { HelpClips } from "@/components/help-clip";
import { HelpBot } from "@/components/help-bot";
import codes from "../../content/help-codes.json";
import { searchHelp, type HelpEntry } from "@/lib/help-search";
import { ShowGuide } from "@/components/show-guide";
import brand from "@/lib/brand.json";
import { DOWNLOADS } from "@/lib/pc-setup";
import { useSession } from "@/lib/use-session";
import "@/app/help/guide.css";

type Topic = { id: string; label: string; icon: LucideIcon; blurb: string; body: () => ReactNode };

const CONTACT = "hello@framedecks.com";

function More({ links }: Readonly<{ links: [string, string][] }>) {
  return (
    <p className="hc-more">
      <BookOpen aria-hidden="true" size={16} />
      <span>
        Read more:{" "}
        {links.map(([href, text], i) => (
          <span key={href}>
            {i ? " · " : ""}
            <Link href={href}>{text}</Link>
          </span>
        ))}
      </span>
    </p>
  );
}

export const TOPICS: Topic[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    icon: Rocket,
    blurb: "Install, plan your first meeting and choose how people see it.",
    body: () => (
      <>
        <ol className="hc-steps">
          <li>
            <b>Install FrameDecks</b> on the Windows PC that drives your screen or your stream:{" "}
            <Link href={DOWNLOADS}>download it here</Link>. It is free.
          </li>
          <li>
            <b>Plan</b> the meeting, in the program (Studio) or here on the website (Plan), from any computer or phone.
            Plan guides you in five steps: your meeting, Add Frame, Write Script, Preview, then Export for Service PC.
          </li>
          <li>
            <b>Choose how people see it</b>: in the program, Settings → How people see it (FrameDecks vCam in your video
            meeting or streaming platform, the Share Window, or a projector, TV or live production tool).
          </li>
          <li>
            <b>Write your script</b>: each Frame has a Teleprompter script that only you see during the meeting.
          </li>
        </ol>
        <p className="hc-note">
          <b>Setup guide:</b> the same steps, one at a time, each ticked when it is really done. In FrameDecks on the PC:
          Settings → About → Guided tour. Here: <ShowGuide />
        </p>
        <HelpGuide />
        <h3 className="hc-h3">Words you will see</h3>
        <dl className="hc-words">
          <div>
            <dt>Frame</dt>
            <dd>One step of the meeting: what is on screen at one moment.</dd>
          </div>
          <div>
            <dt>Prepare / Run</dt>
            <dd>Plan and edit / run the service, with nothing to edit by accident.</dd>
          </div>
          <div>
            <dt>FrameDecks vCam</dt>
            <dd>FrameDecks&apos;s own camera, which you choose in your video meeting or streaming platform.</dd>
          </div>
          <div>
            <dt>Service PC</dt>
            <dd>The Windows PC that runs the meeting.</dd>
          </div>
        </dl>
        <More links={[["/docs/getting-started", "Getting started guide"], ["/docs/glossary", "Glossary"]]} />
      </>
    ),
  },
  {
    id: "ask",
    label: "Ask Help",
    icon: MessageCircle,
    blurb: "Choose a problem and go through it one step at a time, or type a question or an error code. Nothing you type leaves this page.",
    body: () => null, // HelpCenter draws the helper (it needs the search index)
  },
  {
    id: "studio",
    label: "Studio",
    icon: MonitorPlay,
    blurb: "The program on the service PC: plan, preview and run the meeting.",
    body: () => (
      <>
        <div className="hc-cards">
          <section>
            <h3>The Studio at a glance</h3>
            <ul>
              <li>The <b>Frames</b> list on the left is the meeting, in order.</li>
              <li><b>Decks</b> under it shows the selected Frame&apos;s Content.</li>
              <li>The <b>Studio Canvas</b> previews the selected Frame. Nobody else sees it.</li>
              <li>With several meetings, the <b>Meeting</b> list above the Frames chooses the one this PC runs.</li>
            </ul>
          </section>
          <section>
            <h3>Quick Start</h3>
            <ul>
              <li><b>Quick Start</b> makes a full set of Frames for a Bible study, prayer meeting, youth gathering or fellowship meeting.</li>
              <li><b>Import a Frame file…</b> in Quick Start opens a .frame file from the website or another PC, exactly as Settings → Data / Backup does.</li>
            </ul>
          </section>
          <section>
            <h3>On the day</h3>
            <ul>
              <li>Previous, Next, Go Live and Hide all are in the top bar.</li>
              <li>Settings → About → Guided tour checks everything works, with a fix for anything that isn&apos;t.</li>
              <li>Running from a phone? Open <Link href="/live">Live</Link> here, or the phone remote on the local Wi-Fi.</li>
            </ul>
          </section>
          <section>
            <h3>The keys</h3>
            <ul className="hc-keys">
              <li><kbd>T</kbd> Go Live</li>
              <li><kbd>]</kbd> Next</li>
              <li><kbd>[</kbd> Previous</li>
              <li><kbd>Esc</kbd> Hide all</li>
              <li><kbd>K</kbd> Black screen</li>
              <li><kbd>Ctrl</kbd> + <kbd>K</kbd> Command palette</li>
            </ul>
          </section>
        </div>
        <HelpClips
          clips={[
            { name: "go-live", title: "Go Live.", caption: "The first Frame goes on screen, then → shows the next question." },
            { name: "spotlight", title: "Spotlight.", caption: "A soft light on the word you are talking about, for everyone at once." },
            { name: "memory-cards", title: "Memory Cards.", caption: "Copied chat messages pop up beside you on the picture." },
          ]}
        />
        <More links={[["/docs/user-guide", "User guide"], ["/docs/presentations", "Presenting"], ["/docs/remote-control", "Phone remote"]]} />
      </>
    ),
  },
  {
    id: "frames",
    label: "Frames",
    icon: Layers,
    blurb: "Build the meeting Frame by Frame, reorder it and move it between computers.",
    body: () => (
      <>
        <div className="hc-cards">
          <section>
            <h3>Add and fill Frames</h3>
            <ul>
              <li>Website: Plan → <b>Add Frame</b>, give it a name, then add Content: a question, a scripture, text or a picture.</li>
              <li>PC: <b>+ Frame</b> above the list, then <b>+ Content</b> under Decks.</li>
              <li><b>Duplicate Frame</b> (Ctrl + D on the PC) makes an independent copy right after it.</li>
            </ul>
          </section>
          <section>
            <h3>Order and meetings</h3>
            <ul>
              <li>Drag a Frame on the website&apos;s timeline, or select it and press Alt + ↑ or ↓.</li>
              <li>A workspace can hold several meetings, each with its own Frames: <b>New meeting</b> at the top of Plan.</li>
            </ul>
          </section>
          <section>
            <h3>Frame files (.frame)</h3>
            <ul>
              <li>Website: Plan → <b>Export for Service PC</b> saves the meeting you are planning.</li>
              <li>PC: Quick Start → <b>Import a Frame file…</b>, or Settings → Data / Backup → <b>Import Frame File…</b>.</li>
              <li><b>Use this plan</b> shows exactly what is in the file; a check then confirms everything matches.</li>
            </ul>
          </section>
        </div>
        <More links={[["/docs/frames", "Frames"], ["/docs/service-planning", "Planning a meeting"], ["/docs/content", "Content"]]} />
      </>
    ),
  },
  {
    id: "teleprompter",
    label: "Teleprompter",
    icon: ScrollText,
    blurb: "Your script in a window only you see, over Zoom or Teams.",
    body: () => (
      <>
        <div className="hc-cards">
          <section>
            <h3>Open it</h3>
            <ul>
              <li>On the PC: Engage → <b>Teleprompter</b>, or press <kbd>R</kbd>.</li>
              <li>It stays out of screen sharing and recordings. Only you see it.</li>
              <li>The small arrow at the top shows its top bar: time, Frame, timer and the script tools.</li>
            </ul>
          </section>
          <section>
            <h3>Write or upload the script</h3>
            <ul>
              <li><b>Write Script</b> to type; <b>Upload</b> for a .txt, .md or Word file.</li>
              <li><b>Each Frame</b> keeps one script per Frame; <b>Whole meeting</b> keeps one for all.</li>
              <li>Use # for a heading, - for a bullet and [PAUSE] for a pause.</li>
            </ul>
          </section>
          <section>
            <h3>While you speak</h3>
            <ul>
              <li><b>Scroll</b> starts and stops the text; A− and A+ change its size.</li>
              <li>Pin it above Zoom or Teams and choose how see-through it is.</li>
              <li>The phone remote has the Teleprompter too.</li>
            </ul>
          </section>
        </div>
        <More links={[["/docs/presentations", "Presenting and the Teleprompter"]]} />
      </>
    ),
  },
  {
    id: "account",
    label: "Workspace",
    icon: UserRound,
    blurb: "Opening your workspace, adding a device, your team, linking a service PC and your data.",
    body: () => (
      <>
        <div className="hc-cards">
          <section>
            <h3>Your workspace on your devices</h3>
            <ul>
              <li><b>Scan to join:</b> a device that’s already in (the church PC, or your phone) shows a QR code under <b>Add a device</b>. Scan it with the new phone’s camera and it’s in. No email, nothing to remember.</li>
              <li>A computer with no camera: <Link href="/sync">Open Workspace</Link> → <b>Show a code for this browser</b>, then scan it with a phone that’s in, or type it into FrameDecks on the church PC.</li>
              <li><Link href="/devices">Devices</Link> lists every phone, computer and PC in your team; removing one ends its access at once. Owners can print a recovery code there.</li>
              <li>The button next to your name disconnects this device and takes you to framedecks.com.</li>
            </ul>
          </section>
          <section>
            <h3>Your team</h3>
            <ul>
              <li><b>People</b> lists your team. Owners and admins can edit the plan and invite others.</li>
              <li><b>Devices</b> lists the phones, computers and PCs in your team.</li>
            </ul>
          </section>
          <section>
            <h3>Link a service PC</h3>
            <ul>
              <li>On the PC, open <b>Sync</b>: it shows a QR code. Scan it with your phone and choose <b>Connect the PC</b>. A brand-new phone at a brand-new PC starts your team.</li>
              <li>A linked PC gets every change by itself within about a minute.</li>
            </ul>
          </section>
          <section>
            <h3>Your data</h3>
            <ul>
              <li><Link href="/account">Your workspace</Link> lets you download your data or delete it, with your workspace email.</li>
              <li>Pictures and video stay on your devices; they are never put in the cloud.</li>
            </ul>
          </section>
        </div>
        <More links={[["/privacy", "Privacy"], ["/security", "Security"]]} />
      </>
    ),
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    blurb: "What FrameDecks costs.",
    body: () => (
      <>
        <div className="hc-callout">
          <b>FrameDecks is free.</b>
          <span>The program and the website cost nothing, and there is nothing to pay or cancel. We never ask for card details.</span>
        </div>
        <ul className="hc-list">
          <li>If paid plans for extra team or cloud features come one day, we will tell you before anything you use becomes paid, and the free features stay free.</li>
          <li>Questions about this? Write to <a href={`mailto:${CONTACT}?subject=${encodeURIComponent("FrameDecks: billing")}`}>{CONTACT}</a>.</li>
        </ul>
        <More links={[["/terms", "Terms of Service"]]} />
      </>
    ),
  },
  {
    id: "troubleshooting",
    label: "Troubleshooting",
    icon: LifeBuoy,
    blurb: "Quick fixes for the moments that matter.",
    body: () => (
      <>
        <dl className="hc-fixes">
          <div>
            <dt>Something wrong is on screen</dt>
            <dd>Press <kbd>Esc</kbd> (Hide all). It always works.</dd>
          </div>
          <div>
            <dt>The screen must go dark now</dt>
            <dd>Press <kbd>K</kbd> (Black screen); press it again to come back.</dd>
          </div>
          <div>
            <dt>Your meeting app shows no FrameDecks vCam</dt>
            <dd>In FrameDecks, Settings → How people see it → FrameDecks vCam → Install, then restart the meeting app.</dd>
          </div>
          <div>
            <dt>The website says the PC is offline</dt>
            <dd>Open FrameDecks on that PC and check its internet.</dd>
          </div>
          <div>
            <dt>The PC does not show the latest plan</dt>
            <dd>On the PC, choose the status button at the top right, then Sync, then <b>Sync now</b>.</dd>
          </div>
          <div>
            <dt>A .frame file is refused</dt>
            <dd>It was cut short or changed after it was made. Export it again and copy it again.</dd>
          </div>
          <div>
            <dt>Windows asks before installing</dt>
            <dd>The installer is not yet code-signed: choose <b>More info → Run anyway</b>.</dd>
          </div>
        </dl>
        <HelpClips
          clips={[
            { name: "check-connection", title: "Check my connection.", caption: "Every step from the PC to the phone; the first problem gets one button that fixes it." },
            { name: "phone-remote", title: "The phone remote.", caption: "Next Frame from your seat, on the same Wi-Fi.", portrait: true },
          ]}
        />
        <More links={[["/docs/troubleshooting", "Troubleshooting guide"], ["/docs/faq", "Questions and answers"]]} />
      </>
    ),
  },
  {
    id: "codes",
    label: "Error codes",
    icon: TriangleAlert,
    blurb: "A short code like FD-NET-02 appears with every connection problem, on the PC, the phone and here.",
    body: () => (
      <>
        <ul className="hc-codes">
          {(codes as { code: string; area: string; title: string; why: string; fix: string }[]).map((c) => (
            <li key={c.code} id={c.code}>
              <b>
                <code>{c.code}</code> {c.title}
              </b>
              <span className="hc-codes-area">{c.area}</span>
              <p>{c.why}</p>
              <p>
                <b>Fix:</b> {c.fix}
              </p>
            </li>
          ))}
        </ul>
        <p className="hc-more">
          On the PC, <b>Settings → Phone &amp; iPad Remote → Check my connection</b> goes through every step and shows the code for
          the first one that needs fixing.
        </p>
        <More links={[["/docs/remote-control", "Phone remote guide"], ["/docs/troubleshooting", "Troubleshooting guide"]]} />
      </>
    ),
  },
  {
    id: "contact",
    label: "Contact Support",
    icon: Mail,
    blurb: "A question, a problem or an idea? We read every message.",
    body: () => (
      <>
        <div className="hc-callout">
          <b>Write to us</b>
          <span>
            <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(`FrameDecks ${brand.version}: help`)}`}>{CONTACT}</a>
          </span>
        </div>
        <ul className="hc-list">
          <li>Say what you were doing and what you saw; a screenshot helps.</li>
          <li>In the program, Settings → Diagnostics → <b>Copy diagnostics</b> adds useful details (never your PIN or members).</li>
        </ul>
        <p className="fd-help-version">
          FrameDecks {brand.version} · <Link href="/docs">Documentation</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </>
    ),
  },
];

/** The older anchors on this page, so links from the program (#guide) and elsewhere still work. */
const ALIASES: Record<string, string> = { guide: "getting-started", start: "getting-started", words: "getting-started", day: "studio", problems: "troubleshooting" };

export function topicFromHash(hash: string): { topic: string; anchor?: string } {
  const h = decodeURIComponent(hash.replace(/^#/, "")).toLowerCase();
  if (TOPICS.some((t) => t.id === h)) return { topic: h };
  if (ALIASES[h]) return { topic: ALIASES[h], anchor: h === "guide" ? "guide" : undefined };
  return { topic: TOPICS[0].id };
}

/** Back where the person came from on this site, else Home (8.6: Help had no way back but the browser's). */
function back(home: () => void) {
  let same = false;
  try {
    same = !!document.referrer && new URL(document.referrer).origin === location.origin && !/\/help\/?$/.test(new URL(document.referrer).pathname);
  } catch {
    same = false;
  }
  if (same && history.length > 1) history.back();
  else home();
}

/** An error code from the program or the phone (help?code=FD-NET-02): its entry, scrolled to and lit once */
function mark(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "start" });
  el.classList.add("is-asked");
}

/** 26.11.4 search across everything Help can answer: the index from the server plus these topics */
function HelpSearch({ index, onTopic }: Readonly<{ index: HelpEntry[]; onTopic: (id: string, anchor?: string) => void }>) {
  const [q, setQ] = useState("");
  const all = [...TOPICS.map((t) => ({ kind: "Help topic", title: t.label, text: t.blurb, href: `/help#${t.id}` })), ...index];
  const found = searchHelp(all, q);
  function go(e: HelpEntry, ev: React.MouseEvent) {
    const m = /^\/help(?:\?code=([^#]+))?#(.+)$/.exec(e.href);
    if (!m) return; // another page: the link does it
    ev.preventDefault();
    setQ("");
    onTopic(m[2], m[1]);
  }
  return (
    <div className="hc-search" role="search">
      <Search aria-hidden="true" size={16} />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Help: “black screen”, “phone won’t connect”, FD-NET-02…" aria-label="Search Help" />
      {q.trim() && (
        <ul className="hc-results" aria-live="polite">
          {found.length ? (
            found.map((e) => (
              <li key={e.href + e.title}>
                <Link href={e.href} onClick={(ev) => go(e, ev)}>
                  <small>{e.kind}</small>
                  <b>{e.title}</b>
                  <span>{e.text}</span>
                </Link>
              </li>
            ))
          ) : (
            <li className="hc-none">
              Nothing found for “{q}”. Try other words, or <a href="#contact" onClick={(ev) => (ev.preventDefault(), setQ(""), onTopic("contact"))}>contact us</a>.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function HelpCenter({ index = [] }: Readonly<{ index?: HelpEntry[] }>) {
  const session = useSession();
  const router = useRouter();
  const [active, setActive] = useState(TOPICS[0].id);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const topic = TOPICS.find((t) => t.id === active) ?? TOPICS[0];

  useEffect(() => {
    function read() {
      const code = new URLSearchParams(window.location.search).get("code");
      const { topic: t, anchor } = code ? { topic: "codes", anchor: code } : topicFromHash(window.location.hash);
      setActive(t);
      if (anchor) requestAnimationFrame(() => mark(anchor));
    }
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  function choose(id: string, anchor?: string) {
    setActive(id);
    setOpen(false);
    history.replaceState(null, "", anchor ? `?code=${anchor}#${id}` : `#${id}`);
    if (anchor) requestAnimationFrame(() => mark(anchor));
    const top = panel.current?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight * 0.6) panel.current?.scrollIntoView({ block: "start" });
    panel.current?.focus({ preventScroll: true });
  }

  const places: [string, string, LucideIcon][] = [
    ["/", "Home", Home],
    ...(session ? ([["/plan", "Plan", ClipboardList], ["/live", "Live", Radio]] as [string, string, LucideIcon][]) : []),
    [DOWNLOADS, "Download", Download],
    ["/docs", "Documentation", BookOpen],
  ];
  return (
    <div className="hc">
      <div className="hc-top">
        <HelpSearch index={index} onTopic={choose} />
        <button type="button" className="hc-back" onClick={() => back(() => router.push("/"))}>
          <ArrowLeft aria-hidden="true" size={16} /> Back
        </button>
        <nav className="hc-places" aria-label="Go to">
          {places.map(([href, label, Icon]) => (
            <Link key={href} href={href}>
              <Icon aria-hidden="true" size={15} /> {label}
            </Link>
          ))}
        </nav>
      </div>
      <nav className={`hc-nav${open ? " is-open" : ""}`} aria-label="Help topics">
        <button type="button" className="hc-toggle" aria-expanded={open} aria-controls="hc-topics" onClick={() => setOpen((o) => !o)}>
          <topic.icon aria-hidden="true" size={18} />
          <span>
            <small>Help topic</small>
            {topic.label}
          </span>
          <ChevronDown aria-hidden="true" size={18} className="hc-chev" />
        </button>
        <ul id="hc-topics">
          {TOPICS.map((t) => (
            <li key={t.id}>
              <a
                href={`#${t.id}`}
                aria-current={t.id === active ? "page" : undefined}
                onClick={(e) => (e.preventDefault(), choose(t.id))}
              >
                <t.icon aria-hidden="true" size={18} />
                <span>{t.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="hc-panel" ref={panel} tabIndex={-1} aria-labelledby="hc-title">
        <header className="hc-head" key={topic.id}>
          <span className="hc-badge" aria-hidden="true">
            <topic.icon size={22} />
          </span>
          <div>
            <h2 id="hc-title">{topic.label}</h2>
            <p>{topic.blurb}</p>
          </div>
        </header>
        <div className="hc-body" key={`b-${topic.id}`}>
          {topic.id === "ask" ? <HelpBot index={index} /> : topic.body()}
        </div>
        <HelpVote key={`v-${topic.id}`} article={`help#${topic.id}`} />
      </div>
    </div>
  );
}
