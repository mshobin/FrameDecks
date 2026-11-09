"use client";

// FrameDecks 8.6 - the Help Center: topics on the left, the chosen topic on the right (on a phone the topics fold into
// one button above the content). The topic is in the address (#teleprompter), so a link can open one and Back works;
// the older anchors (#guide, #start, #day, #problems, #words, #contact) still land on the right topic.
// Keep the words in docs/guide/glossary.md's language and true to the product; longer guides live in /docs.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, ClipboardList, Download, Home, Radio, ChevronDown, Search, type LucideIcon } from "lucide-react";

import { HelpVote } from "@/components/help-vote";
import { HelpBot } from "@/components/help-bot";
import type { Code } from "@/components/help-bot";
import { searchHelp, type HelpEntry } from "@/lib/help-search";
import { DOWNLOADS } from "@/lib/pc-setup";

import { useSession } from "@/lib/use-session";
import "@/app/help/guide.css";

/** A topic as the page hands it over: its words and icons already drawn (components/help-topics.tsx). */
export type TopicView = { id: string; label: string; blurb: string; icon: ReactNode; big: ReactNode; body: ReactNode };

/** The older anchors on this page, so links from the program (#guide) and elsewhere still work. */
const ALIASES: Record<string, string> = {
  guide: "getting-started",
  start: "getting-started",
  words: "getting-started",
  day: "studio",
  problems: "troubleshooting",
};

export function topicFromHash(hash: string, ids: string[]): { topic: string; anchor?: string } {
  const h = decodeURIComponent(hash.replace(/^#/, "")).toLowerCase();
  if (ids.includes(h)) return { topic: h };
  if (ALIASES[h]) return { topic: ALIASES[h], anchor: h === "guide" ? "guide" : undefined };
  return { topic: ids[0] };
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
function HelpSearch({ index, topics, onTopic }: Readonly<{ index: HelpEntry[]; topics: TopicView[]; onTopic: (id: string, anchor?: string) => void }>) {
  const [q, setQ] = useState("");
  const all = [...topics.map((t) => ({ kind: "Help topic", title: t.label, text: t.blurb, href: `/help#${t.id}` })), ...index];
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
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search Help: “black screen”, “phone won’t connect”, FD-NET-02…"
        aria-label="Search Help"
      />
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
              Nothing found for “{q}”. Try other words, or{" "}
              <a href="#contact" onClick={(ev) => (ev.preventDefault(), setQ(""), onTopic("contact"))}>
                contact us
              </a>
              .
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function HelpCenter({ index = [], codes: list = [], topics }: Readonly<{ index?: HelpEntry[]; codes?: Code[]; topics: TopicView[] }>) {
  const ids = topics.map((t) => t.id).join(" ");
  const session = useSession();
  const router = useRouter();
  const [active, setActive] = useState(topics[0].id);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const topic = topics.find((t) => t.id === active) ?? topics[0];

  useEffect(() => {
    function read() {
      const code = new URLSearchParams(window.location.search).get("code");
      const { topic: t, anchor } = code ? { topic: "codes", anchor: code } : topicFromHash(window.location.hash, ids.split(" "));
      setActive(t);
      if (anchor) requestAnimationFrame(() => mark(anchor));
    }
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [ids]);

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
    ...(session
      ? ([
          ["/plan", "Plan", ClipboardList],
          ["/live", "Live", Radio],
        ] as [string, string, LucideIcon][])
      : []),
    [DOWNLOADS, "Download", Download],
    ["/docs", "Documentation", BookOpen],
  ];
  return (
    <div className="hc">
      <div className="hc-top">
        <HelpSearch index={index} topics={topics} onTopic={choose} />
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
          {topic.icon}
          <span>
            <small>Help topic</small>
            {topic.label}
          </span>
          <ChevronDown aria-hidden="true" size={18} className="hc-chev" />
        </button>
        <ul id="hc-topics">
          {topics.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} aria-current={t.id === active ? "page" : undefined} onClick={(e) => (e.preventDefault(), choose(t.id))}>
                {t.icon}
                <span>{t.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="hc-panel" ref={panel} tabIndex={-1} aria-labelledby="hc-title">
        <header className="hc-head" key={topic.id}>
          <span className="hc-badge" aria-hidden="true">
            {topic.big}
          </span>
          <div>
            <h2 id="hc-title">{topic.label}</h2>
            <p>{topic.blurb}</p>
          </div>
        </header>
        <div className="hc-body" key={`b-${topic.id}`}>
          {topic.id === "ask" ? <HelpBot index={index} codes={list} /> : topic.body}
        </div>
        <HelpVote key={`v-${topic.id}`} article={`help#${topic.id}`} />
      </div>
    </div>
  );
}
