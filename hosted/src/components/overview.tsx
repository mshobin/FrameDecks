"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, MonitorPlay, Radio } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-hero";
import { GlanceTiles } from "@/components/glance";
import { Landing } from "@/components/landing";
import { PcSetupCard } from "@/components/pc-setup-card";
import { Words } from "@/components/words";
import { Workflow } from "@/components/workflow";
import { WorkspacePanel } from "@/components/workspace-panel";
import { OPEN_LINK } from "@/lib/pc-setup";
import { browserSupabase } from "@/lib/supabase-browser";
import { useSession } from "@/lib/use-session";
import { useWorkspaces } from "@/lib/use-workspaces";

function greeting(hour: number): string {
  return hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** The companion's front page: a landing page before sign-in, the workspace dashboard after. */
export function Overview() {
  const supabase = browserSupabase();
  const session = useSession();
  if (supabase && session === undefined) {
    return (
      <main className="fd-splash" id="main" aria-busy="true">
        <BrandMark size="medium" />
      </main>
    );
  }
  if (!session) return <Landing />;
  return <Dashboard name={String(session.user.user_metadata?.full_name ?? "").split(" ")[0]} />;
}

function Dashboard({ name }: Readonly<{ name: string }>) {
  const { selected } = useWorkspaces();
  return (
    <AppShell active="overview">
      <section className="fd-welcome fd-enter-card" aria-labelledby="fd-welcome-title" data-spotlight>
        <div className="fd-welcome-copy">
          <p className="fd-kicker">
            {greeting(new Date().getHours())}
            {name ? `, ${name}` : ""}
            {selected ? ` · ${selected.name}` : ""}
          </p>
          <h1 id="fd-welcome-title" className="fd-welcome-title">
            <Words text="Ready for your next gathering." />
          </h1>
          <p className="fd-welcome-text fd-enter" style={{ "--d": "600ms" } as React.CSSProperties}>
            Plan the meeting, then run it from the service PC or your phone.
          </p>
          <div className="fd-hero-actions fd-enter" style={{ "--d": "750ms" } as React.CSSProperties}>
            <Link className="fd-btn fd-btn-primary" href="/meeting">
              <ClipboardList aria-hidden="true" size={17} /> Plan the meeting
            </Link>
            <Link className="fd-btn fd-btn-glass" href="/live">
              <Radio aria-hidden="true" size={17} /> Go live
            </Link>
            <a className="fd-btn fd-btn-ghost" href={OPEN_LINK}>
              <MonitorPlay aria-hidden="true" size={17} /> Open FRAMEDECKS on this PC
            </a>
          </div>
        </div>
      </section>

      {selected && <GlanceTiles workspace={selected} />}

      <PcSetupCard />

      {/* Task first (design audit DD-24): How it works only until there is a workspace to work in */}
      {!selected && (
        <section className="fd-block" aria-labelledby="fd-how-title" data-reveal>
          <div className="fd-block-head">
            <div>
              <p className="fd-kicker">How it works</p>
              <h2 id="fd-how-title">From the plan to the screen.</h2>
            </div>
            <Link className="fd-link" href="/meeting">
              Start planning <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>
          <Workflow />
        </section>
      )}

      <section className="fd-block" aria-labelledby="fd-account-title" data-reveal>
        <div className="fd-block-head">
          <div>
            <p className="fd-kicker">Your account</p>
            <h2 id="fd-account-title">Profile and workspaces.</h2>
          </div>
        </div>
        <WorkspacePanel />
      </section>

      <p className="fd-assurance">
        Your presentation stays on your service PC: pictures, video, the camera and what is on screen never come to this
        website. <Link href="/privacy">Privacy policy</Link>
      </p>
    </AppShell>
  );
}
