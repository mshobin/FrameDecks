"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Download } from "lucide-react";

import { AboutButton } from "@/components/about-dialog";
import { EffectsToggle } from "@/components/effects-toggle";
import { applySavedTheme } from "@/components/theme-toggle";
import { useSession } from "@/lib/use-session";

// The front page's bar: clear over the hero, then blurred navy with a hairline once the page has moved 20 px.
// One passive scroll listener that writes only when the state changes.
/** 26.11.2 the website is dark until someone signs in, like the program and its screenshots: layout.tsx leaves the
 *  light theme off before the first paint for a visitor who is not signed in and on every public page; this holds it
 *  while a public page is shown and gives the visitor's own choice back when they move on. Light, Dark and Auto live
 *  in the signed-in workspace only (components/app-shell.tsx). */
function useDarkOnly() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("fd-dark-only");
    root.classList.remove("fd-light");
    return () => {
      root.classList.remove("fd-dark-only");
      applySavedTheme();
    };
  }, []);
}

/** The public pages' bar (the front page, Help, Download, the legal pages): always dark, so no theme button. */
export function LandingNav() {
  const [solid, setSolid] = useState(false);
  useDarkOnly();
  const session = useSession(); // 9.11.1 already signed in on this browser: the bar leads home, not to the email form

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
        <Link href="/#features">Features</Link>
        <Link href="/download">Download</Link>
      </nav>
      <div className="fd-topbar-right">
        <EffectsToggle />
        <AboutButton />
        <Link className="fd-btn fd-btn-ghost fd-btn-sm" href={session ? "/" : "/sync"}>
          {session ? "Go to Home" : "Open Workspace"}
        </Link>
        <Link className="fd-btn fd-btn-primary fd-btn-sm lp-nav-cta" href="/download">
          <Download aria-hidden="true" size={15} /> Download · free
        </Link>
      </div>
    </header>
  );
}
