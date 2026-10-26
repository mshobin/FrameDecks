import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowUpRight, BookOpen, Monitor, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PcSetupCard } from "@/components/pc-setup-card";
import { buttonVariants } from "@/components/ui/button";
import { WorkspacePanel } from "@/components/workspace-panel";

const statusCards = [
  {
    label: "Cloud workspace",
    value: "Services and members",
    detail: "Synced from a linked service PC",
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
    <AppShell active="overview">
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

      <PcSetupCard />

      <WorkspacePanel />

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
          <h2 id="foundation-title">See your services from anywhere.</h2>
          <p>
            Link the service PC under Computers and its plans appear under
            Services, view only. Controlling a service from your phone through
            the companion is not implemented yet. The companion never connects
            to your PC; the PC sends its plans to your workspace itself.
          </p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/services">
          <span>View services</span>
          <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
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
    </AppShell>
  );
}
