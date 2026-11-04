"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Download } from "lucide-react";

import { AboutButton } from "@/components/about-dialog";
import { EffectsToggle } from "@/components/effects-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

// The front page's bar: clear over the hero, then blurred navy with a hairline once the page has moved 20 px.
// One passive scroll listener that writes only when the state changes.
export function LandingNav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      setSolid(scrollY > 20);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className="fd-landing-bar lp-nav" data-solid={solid ? "" : undefined}>
      <Link className="fd-brand" href="/" aria-label="FrameDecks home">
        <span className="fd-brand-mark">
          <Image src="/framedecks-emblem.webp" alt="" width={30} height={30} priority unoptimized />
        </span>
        <span className="fd-brand-copy">
          <strong>FrameDecks</strong>
        </span>
      </Link>
      <nav className="fd-landing-links" aria-label="On this page">
        <Link href="/#how">How it works</Link>
        <Link href="/#features">See it work</Link>
        <Link href="/download">Download</Link>
      </nav>
      <div className="fd-topbar-right">
        <EffectsToggle />
        <ThemeToggle />
        <AboutButton />
        <Link className="fd-btn fd-btn-ghost fd-btn-sm" href="/sync">
          Sync Workspace
        </Link>
        <Link className="fd-btn fd-btn-primary fd-btn-sm lp-nav-cta" href="/download">
          <Download aria-hidden="true" size={15} /> Download · free
        </Link>
      </div>
    </header>
  );
}
