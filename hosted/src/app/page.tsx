import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Home as HomeIcon,
  Monitor,
  NotebookPen,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { AccountStatus } from "@/components/account-status";
import { Button } from "@/components/ui/button";

const navigation = [
  { label: "Overview", icon: HomeIcon, active: true },
  { label: "Sessions", icon: CalendarDays },
  { label: "Notes", icon: NotebookPen },
  { label: "Devices", icon: Monitor },
  { label: "Settings", icon: Settings2 },
];

const statusCards = [
  {
    label: "Cloud workspace",
    value: "Not connected",
    detail: "Sign in now; shared workspaces come next",
    icon: Activity,
    tone: "muted",
  },
  {
    label: "Local runtime",
    value: "Not paired",
    detail: "Pairing is not available yet",
    icon: Monitor,
    tone: "muted",
  },
  {
    label: "Presentation media",
    value: "Stays on your PC",
    detail: "Media is never sent to this companion",
    icon: ShieldCheck,
    tone: "safe",
  },
];

export default function Home() {
  return (
    <main className="app-frame">
      <aside className="sidebar" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label="FRAMEDECKS overview">
          <Image
            src="/framedecks-emblem.webp"
            alt=""
            width={48}
            height={48}
            priority
            unoptimized
          />
          <span className="brand-copy">
            <strong>FRAMEDECKS</strong>
            <span>Hosted companion</span>
          </span>
        </Link>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {navigation.map(({ label, icon: Icon, active }) =>
            active ? (
              <Link
                className="nav-item nav-item-active"
                href="/"
                key={label}
                aria-current="page"
              >
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
              </Link>
            ) : (
              <button
                className="nav-item nav-item-disabled"
                disabled
                key={label}
                title="Not available yet"
                type="button"
              >
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
            <strong>Overview</strong>
          </div>
          <div className="topbar-right">
            <div className="topbar-status">
              <span className="status-dot" />
              Foundation preview
            </div>
            <AccountStatus />
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">YOUR HOSTED COMPANION</p>
              <h1>A calmer view of your service.</h1>
              <p className="welcome-copy">
                Secure planning and remote tools will be introduced in
                carefully tested steps. Your local FRAMEDECKS workflow remains
                unchanged.
              </p>
            </div>
            <div className="welcome-mark" aria-hidden="true">
              <Image
                src="/framedecks-emblem.webp"
                alt=""
                width={94}
                height={94}
                unoptimized
              />
            </div>
          </section>

          <section className="status-grid" aria-label="Workspace status">
            {statusCards.map(({ label, value, detail, icon: Icon, tone }) => (
              <article className="status-card" key={label}>
                <div className={`status-icon status-icon-${tone}`}>
                  <Icon aria-hidden="true" size={19} />
                </div>
                <p className="card-label">{label}</p>
                <p className="card-value">{value}</p>
                <p className="card-detail">{detail}</p>
              </article>
            ))}
          </section>

          <section className="foundation-card" aria-labelledby="foundation-title">
            <div className="foundation-icon">
              <BookOpen aria-hidden="true" size={21} />
            </div>
            <div className="foundation-copy">
              <p className="eyebrow">FOUNDATION IN PROGRESS</p>
              <h2 id="foundation-title">This space is not connected yet.</h2>
              <p>
                You can sign in, but cloud workspaces and secure device pairing
                are not implemented yet. This preview does not read your desktop
                data or send commands to your local server.
              </p>
            </div>
            <Button disabled variant="outline">
              <span>Explore workspace</span>
              <ArrowUpRight aria-hidden="true" size={16} />
            </Button>
          </section>

          <section className="boundary-note" aria-label="Local-first assurance">
            <div className="boundary-icon">
              <ShieldCheck aria-hidden="true" size={18} />
            </div>
            <p>
              <strong>Your presentation stays local.</strong> Frames, media,
              camera output, and live presentation controls remain on your
              service PC. This hosted companion will use a separate secure
              connection when those features are ready.
            </p>
          </section>

          <footer className="page-footer">
            <span>FRAMEDECKS · Present · Equip · Inspire</span>
            <span>Hosted companion · Online-first</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
