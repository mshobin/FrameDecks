"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, HandHeart, Info, Mail, Quote, ShieldCheck, X } from "lucide-react";

import brand from "@/lib/brand.json";
import { DOWNLOADS } from "@/lib/pc-setup";

// The program's About page (Settings → About, app/js/about.js) on the website: the same words, from
// app/js/brand.js through src/lib/brand.json, in the website's design. Opened from the small (i) button.
export function AboutButton({ label = false }: Readonly<{ label?: boolean }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    setOpen(true);
    dialog.current?.showModal();
    dialog.current?.scrollTo({ top: 0 });
  };
  const close = () => {
    dialog.current?.close();
  };

  return (
    <>
      <button className={label ? "fd-about-btn fd-about-btn-label" : "fd-about-btn"} type="button" aria-label="About FrameDecks" title="About FrameDecks" onClick={show}>
        <Info aria-hidden="true" size={16} />
        {label && <span>About</span>}
      </button>
      <dialog
        ref={dialog}
        className="fd-about"
        aria-label="About FrameDecks"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && close()}
      >
        {open && <AboutPage onClose={close} />}
      </dialog>
    </>
  );
}

function Verses() {
  const list = brand.scriptures;
  const [i, setI] = useState(() => Math.floor(Date.now() / 86400000) % list.length);
  useEffect(() => {
    const timer = window.setInterval(() => setI((n) => (n + 1) % list.length), 14000);
    return () => window.clearInterval(timer);
  }, [list.length]);
  return (
    <figure className="fd-ab-verse" data-reveal>
      <BookOpen className="fd-ab-verse-icon" aria-hidden="true" size={24} />
      <blockquote key={i} className="fd-ab-verse-text">
        “{list[i].text}”
      </blockquote>
      <figcaption>{list[i].ref} (ESV)</figcaption>
      <div className="fd-ab-dots" role="tablist" aria-label="Choose a verse">
        {list.map((v, k) => (
          <button key={v.ref} type="button" role="tab" aria-selected={k === i} aria-label={v.ref} onClick={() => setI(k)} />
        ))}
      </div>
      <p className="fd-ab-credit">{brand.scriptureCredit}</p>
    </figure>
  );
}

function AboutPage({ onClose }: Readonly<{ onClose: () => void }>) {
  const c = brand.creator;
  const initials = c.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    <div className="fd-ab">
      <button className="fd-ab-close" type="button" aria-label="Close" onClick={onClose}>
        <X aria-hidden="true" size={18} />
      </button>

      <header className="fd-ab-hero">
        <div className="fd-mark-glow" aria-hidden="true" />
        <Image className="fd-ab-emblem" src="/framedecks-emblem.webp" alt="" width={110} height={110} unoptimized />
        <h2 className="fd-wordmark">{brand.name}</h2>
        <p className="fd-tagline">{brand.tagline.replace(/•/g, "·")}</p>
        <p className="fd-ab-intro">{brand.intro}</p>
        <span className="fd-ab-version">FrameDecks for Windows {brand.version}</span>
      </header>

      <section className="fd-ab-two" data-reveal>
        <article>
          <p className="fd-kicker">Our mission</p>
          <p className="fd-ab-big">{brand.mission}</p>
        </article>
        <article>
          <p className="fd-kicker">Our vision</p>
          <p className="fd-ab-big">{brand.vision}</p>
        </article>
      </section>

      <section className="fd-ab-why" data-reveal>
        <div>
          <p className="fd-kicker">Why FrameDecks exists</p>
          <h3>{brand.why.lead}</h3>
          <p>{brand.why.text}</p>
          <ul className="fd-ab-pills">
            {brand.why.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <figure className="fd-ab-principle">
          <Quote aria-hidden="true" size={24} />
          <figcaption>Guiding principle</figcaption>
          {brand.why.principle.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </figure>
      </section>

      <section className="fd-ab-sec" data-reveal>
        <p className="fd-kicker">Core values</p>
        <h3>What shapes every decision</h3>
        <div className="fd-ab-values">
          {brand.values.map((v, i) => (
            <article key={v.title} className="fd-ab-value" data-reveal style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
              <span className="fd-ab-num">0{i + 1}</span>
              <h4>{v.title}</h4>
              <p>{v.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="fd-ab-sec" data-reveal>
        <p className="fd-kicker">Who it serves</p>
        <h3>For everyone who gathers people around God’s Word</h3>
        <ul className="fd-ab-pills fd-ab-pills-wide">
          {brand.serves.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <Verses />

      <section className="fd-ab-heart" data-reveal>
        <p className="fd-kicker">Our heart for ministry</p>
        {brand.heart.lines.map((l) => (
          <p key={l} className="fd-ab-heart-line">
            {l}
          </p>
        ))}
        <p className="fd-ab-prayer">{brand.heart.prayer}</p>
      </section>

      <section className="fd-ab-founder" data-reveal>
        <aside className="fd-ab-card">
          <div className="fd-avatar fd-ab-avatar" aria-hidden="true">
            {initials}
          </div>
          <p className="fd-kicker">Founder</p>
          <h4>{c.name}</h4>
          <ul>
            {c.roles.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {c.badge && (
            <span className="fd-ab-badge">
              <HandHeart aria-hidden="true" size={14} /> {c.badge}
            </span>
          )}
        </aside>
        <div>
          <p className="fd-kicker">The story</p>
          <h3>Built by a believer, for believers</h3>
          {c.story.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <ol className="fd-ab-journey">
            {c.journey.map((j) => (
              <li key={j.title}>
                <b>{j.title}</b>
                <span>{j.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="fd-ab-sec" data-reveal>
        <p className="fd-kicker">Our commitment</p>
        <h3>FrameDecks is committed to</h3>
        <ul className="fd-ab-pills fd-ab-pills-wide">
          {brand.commitment.points.map((p) => (
            <li key={p}>
              <ShieldCheck aria-hidden="true" size={14} /> {p}
            </li>
          ))}
        </ul>
        {brand.commitment.lines.map((l) => (
          <p key={l} className="fd-ab-line">
            {l}
          </p>
        ))}
      </section>

      <section className="fd-ab-join" data-reveal>
        <p className="fd-kicker">Join the mission</p>
        <h3>{brand.join.thanks}</h3>
        <p>{brand.join.text}</p>
        <div className="fd-hero-actions">
          <a className="fd-btn fd-btn-primary" href={DOWNLOADS}>
            <Download aria-hidden="true" size={16} /> FrameDecks for Windows
          </a>
          <a className="fd-btn fd-btn-glass" href={`mailto:${c.email}?subject=${encodeURIComponent(`FrameDecks ${brand.version} – question or feedback`)}`}>
            <Mail aria-hidden="true" size={16} /> Contact us
          </a>
        </div>
      </section>

      <footer className="fd-ab-foot">
        <p>{brand.footer}</p>
        <p>
          Version {brand.version} · {brand.disclaimer}
        </p>
      </footer>
    </div>
  );
}
