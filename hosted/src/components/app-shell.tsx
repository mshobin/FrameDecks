import Image from "next/image";
import Link from "next/link";
import { CircleHelp, ClipboardList, Ellipsis, Home as HomeIcon, Monitor, Palette, Radio, Users } from "lucide-react";

import { AboutButton } from "@/components/about-dialog";
import { AccountStatus } from "@/components/account-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { DOWNLOADS } from "@/lib/pc-setup";

export type Section = "home" | "plan" | "live" | "people" | "branding" | "pcs" | "help" | "account";

// Four places, in the order a week goes (owner-approved, 27 October; docs/glossary.md): Home, Plan, Live, People.
// What is set once lives under Settings. Phones show the same four as tabs, so both read the same.
const main = [
  { id: "home", label: "Home", href: "/", icon: HomeIcon },
  { id: "plan", label: "Plan", href: "/plan", icon: ClipboardList },
  { id: "live", label: "Live", href: "/live", icon: Radio },
  { id: "people", label: "People", href: "/members", icon: Users },
] as const;
const settings = [
  { id: "branding", label: "Branding", href: "/branding", icon: Palette },
  { id: "pcs", label: "Service PCs", href: "/computers", icon: Monitor },
  { id: "help", label: "Help", href: "/help", icon: CircleHelp },
] as const;

const titles: Record<Section, string> = {
  home: "Home",
  plan: "Plan",
  live: "Live",
  people: "People",
  branding: "Branding",
  pcs: "Service PCs",
  help: "Help",
  account: "Your account",
};

/** The companion's frame: a translucent sidebar, a sticky top bar with the account, and the page. */
export function AppShell({ active, children }: Readonly<{ active: Section; children: React.ReactNode }>) {
  return (
    <div className="fd-app">
      <aside className="fd-sidebar" aria-label="Main navigation">
        <Link className="fd-brand" href="/" aria-label="FrameDecks home">
          <span className="fd-brand-mark">
            <Image src="/framedecks-emblem.webp" alt="" width={34} height={34} priority unoptimized />
          </span>
          <span className="fd-brand-copy">
            <strong>FrameDecks</strong>
          </span>
        </Link>

        <nav className="fd-nav">
          <div className="fd-nav-group">
            {main.map(({ id, label, href, icon: Icon }) => (
              <Link
                className={id === active ? "fd-nav-item fd-nav-active" : "fd-nav-item"}
                href={href}
                key={id}
                aria-current={id === active ? "page" : undefined}
              >
                <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
          <div className="fd-nav-group">
            <p className="fd-nav-title">Settings</p>
            {settings.map(({ id, label, href, icon: Icon }) => (
              <Link
                className={id === active ? "fd-nav-item fd-nav-active" : "fd-nav-item"}
                href={href}
                key={id}
                aria-current={id === active ? "page" : undefined}
              >
                <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="fd-sidebar-foot">
          <a className="fd-foot-link" href={DOWNLOADS} target="_blank" rel="noreferrer">
            FrameDecks for Windows
          </a>
          <Link className="fd-foot-link" href="/privacy">
            Privacy policy
          </Link>
          <p>Your presentation runs on your service PC. This companion plans and guides it.</p>
        </div>
      </aside>

      <div className="fd-main">
        <header className="fd-topbar">
          <p className="fd-crumb">
            <strong>{titles[active]}</strong>
          </p>
          <div className="fd-topbar-right">
            <ThemeToggle />
            <AboutButton />
            <AccountStatus />
          </div>
        </header>
        <main className="fd-page" id="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="fd-tabbar" aria-label="Main navigation">
        {main.map(({ id, label, href, icon: Icon }) => (
          <Link className="fd-tab" href={href} key={id} aria-current={id === active ? "page" : undefined}>
            <Icon aria-hidden="true" size={20} strokeWidth={1.9} />
            <span>{label}</span>
          </Link>
        ))}
        <details className="fd-more">
          <summary className="fd-tab" aria-current={settings.some((m) => m.id === active) ? "page" : undefined}>
            <Ellipsis aria-hidden="true" size={20} strokeWidth={1.9} />
            <span>More</span>
          </summary>
          <div className="fd-more-sheet">
            {settings.map(({ id, label, href, icon: Icon }) => (
              <Link className="fd-nav-item" href={href} key={id} aria-current={id === active ? "page" : undefined}>
                <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
                <span>{label}</span>
              </Link>
            ))}
            <a className="fd-nav-item" href={DOWNLOADS} target="_blank" rel="noreferrer">
              FrameDecks for Windows
            </a>
            <Link className="fd-nav-item" href="/privacy">
              Privacy policy
            </Link>
          </div>
        </details>
      </nav>
    </div>
  );
}
