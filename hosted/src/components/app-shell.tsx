import Image from "next/image";
import Link from "next/link";
import { ClipboardList, Home as HomeIcon, Monitor, Presentation, Radio, Users } from "lucide-react";

import { AboutButton } from "@/components/about-dialog";
import { AccountStatus } from "@/components/account-status";
import { DOWNLOADS } from "@/lib/pc-setup";

export type Section = "overview" | "meeting" | "services" | "live" | "members" | "computers";

// Grouped as the work flows: plan the meeting, present it, look after the people (docs/architecture/meeting-form.md)
const groups = [
  {
    title: "Plan",
    items: [
      { id: "overview", label: "Overview", href: "/", icon: HomeIcon },
      { id: "meeting", label: "Meeting Form", href: "/meeting", icon: ClipboardList },
      { id: "services", label: "Services", href: "/services", icon: Presentation },
    ],
  },
  {
    title: "Present",
    items: [
      { id: "live", label: "Live", href: "/live", icon: Radio },
      { id: "computers", label: "Computers", href: "/computers", icon: Monitor },
    ],
  },
  { title: "People", items: [{ id: "members", label: "Members", href: "/members", icon: Users }] },
] as const;

const titles: Record<Section, string> = {
  overview: "Overview",
  meeting: "Meeting Form",
  services: "Services",
  live: "Live",
  members: "Members",
  computers: "Computers",
};

/** The companion's frame: a translucent sidebar, a sticky top bar with the account, and the page. */
export function AppShell({ active, children }: Readonly<{ active: Section; children: React.ReactNode }>) {
  return (
    <div className="fd-app">
      <aside className="fd-sidebar" aria-label="Main navigation">
        <Link className="fd-brand" href="/" aria-label="FRAMEDECKS overview">
          <span className="fd-brand-mark">
            <Image src="/framedecks-emblem.webp" alt="" width={34} height={34} priority unoptimized />
          </span>
          <span className="fd-brand-copy">
            <strong>FRAMEDECKS</strong>
            <span>Present · Equip · Inspire</span>
          </span>
        </Link>

        <nav className="fd-nav">
          {groups.map((group) => (
            <div className="fd-nav-group" key={group.title}>
              <p className="fd-nav-title">{group.title}</p>
              {group.items.map(({ id, label, href, icon: Icon }) => (
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
          ))}
        </nav>

        <div className="fd-sidebar-foot">
          <a className="fd-foot-link" href={DOWNLOADS} target="_blank" rel="noreferrer">
            FRAMEDECKS for Windows
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
            <span>Workspace</span>
            <span aria-hidden="true">›</span>
            <strong>{titles[active]}</strong>
          </p>
          <div className="fd-topbar-right">
            <AboutButton />
            <AccountStatus />
          </div>
        </header>
        <main className="fd-page">{children}</main>
      </div>
    </div>
  );
}
