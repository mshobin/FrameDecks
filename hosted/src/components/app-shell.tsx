import Image from "next/image";
import Link from "next/link";
import { CircleHelp, ClipboardList, Home as HomeIcon, Monitor, NotebookPen, Presentation, Radio, Settings2, Users } from "lucide-react";

import { AccountStatus } from "@/components/account-status";

export type Section = "overview" | "meeting" | "services" | "live" | "members" | "computers";

const navigation = [
  { id: "overview", label: "Overview", href: "/", icon: HomeIcon },
  { id: "meeting", label: "Meeting Form", href: "/meeting", icon: ClipboardList },
  { id: "services", label: "Services", href: "/services", icon: Presentation },
  { id: "live", label: "Live", href: "/live", icon: Radio },
  { id: "members", label: "Members", href: "/members", icon: Users },
  { id: "computers", label: "Computers", href: "/computers", icon: Monitor },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

const titles: Record<Section, string> = {
  overview: "Overview",
  meeting: "Meeting Form",
  services: "Services",
  live: "Live",
  members: "Members",
  computers: "Computers",
};

/** The companion's frame: sidebar, top bar with the account, and the page. */
export function AppShell({ active, children }: Readonly<{ active: Section; children: React.ReactNode }>) {
  return (
    <main className="app-frame">
      <aside className="sidebar" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label="FRAMEDECKS overview">
          <Image src="/framedecks-emblem.webp" alt="" width={48} height={48} priority unoptimized />
          <span className="brand-copy">
            <strong>FRAMEDECKS</strong>
            <span>Hosted companion</span>
          </span>
        </Link>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {navigation.map(({ id, label, icon: Icon, ...item }) =>
            "href" in item ? (
              <Link
                className={id === active ? "nav-item nav-item-active" : "nav-item"}
                href={item.href}
                key={id}
                aria-current={id === active ? "page" : undefined}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
              </Link>
            ) : (
              <button className="nav-item nav-item-disabled" disabled key={id} title="Not available yet" type="button">
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
                <span className="nav-soon">Soon</span>
              </button>
            ),
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <CircleHelp aria-hidden="true" size={18} />
            <div>
              <strong>Need help?</strong>
              <p>Your desktop app works independently of this companion.</p>
              <Link className="help-link" href="/privacy">
                Privacy policy
              </Link>
            </div>
          </div>
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">FRAMEDECKS</span>
            <span>Present · Equip · Inspire</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <strong>{titles[active]}</strong>
          </div>
          <div className="topbar-right">
            <div className="topbar-status">
              <span className="status-dot" />
              Foundation preview
            </div>
            <AccountStatus />
          </div>
        </header>
        <div className="page-content">{children}</div>
      </section>
    </main>
  );
}
