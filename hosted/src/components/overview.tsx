"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Download } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-hero";
import { NextService } from "@/components/glance";
import { Landing } from "@/components/landing";
import { PcSetupCard } from "@/components/pc-setup-card";
import { SetupGuide } from "@/components/setup-guide";
import { PageSkeleton } from "@/components/states";
import { DOWNLOADS } from "@/lib/pc-setup";
import { browserSupabase } from "@/lib/supabase-browser";
import { useSession } from "@/lib/use-session";
import { useWorkspaces } from "@/lib/use-workspaces";
import { userSafeError } from "@/lib/user-error";

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
  const { workspaces, selected } = useWorkspaces();
  // "/" is the front page for visitors (its static title) and Home once signed in: name the tab like the other places
  useEffect(() => {
    const before = document.title;
    document.title = "Home | FrameDecks";
    return () => {
      document.title = before;
    };
  }, []);
  return (
    <AppShell active="home">
      {workspaces === null ? (
        <PageSkeleton />
      ) : selected ? (
        <>
          <Invitations />
          <NextService workspace={selected} name={name} />
          <SetupGuide workspace={selected} />
          <PcSetupCard />
        </>
      ) : (
        <FirstSteps name={name} />
      )}
      <p className="fd-assurance">
        Your presentation stays on your service PC: pictures, video, the camera and what is on screen never come to this
        website. <Link href="/privacy">Privacy policy</Link>
      </p>
    </AppShell>
  );
}

/** A small line when someone has invited you to their team (you accept on Your account). */
function Invitations() {
  const supabase = browserSupabase();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.rpc("my_invitations").then(({ data, error }) => {
      if (live && !error) setCount(((data as unknown[] | null) ?? []).length);
    });
    return () => {
      live = false;
    };
  }, [supabase]);
  if (!count) return null;
  return (
    <p className="workspace-notice" role="status">
      You have {count === 1 ? "an invitation" : `${count} invitations`} to join a team.{" "}
      <Link href="/account">Accept it on Your workspace</Link>
    </p>
  );
}

/** The first visit (owner-approved, 27 October): three steps, in order, each saying what it is for. */
function FirstSteps({ name }: Readonly<{ name: string }>) {
  const supabase = browserSupabase();
  const session = useSession();
  const [team, setTeam] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = team.trim();
    if (!supabase || !session || !title) return;
    setBusy(true);
    setProblem(null);
    // The database makes the creator the owner (trigger), so the client never picks a role.
    const { error } = await supabase.from("organizations").insert({ name: title, created_by: session.user.id });
    setBusy(false);
    if (error) setProblem(userSafeError(error, "Couldn’t create your team’s space. Check your connection and try again."));
    else window.location.reload();
  }

  return (
    <section className="fd-first" aria-labelledby="fd-first-title">
      <p className="fd-kicker">Welcome{name ? `, ${name}` : ""}</p>
      <h1 id="fd-first-title" className="fd-next-title">
        Let&apos;s get your team ready for the first meeting.
      </h1>
      <p className="fd-next-when">Three steps, about ten minutes. You can stop after any of them.</p>
      <Invitations />
      <ol className="fd-steps">
        <li className="fd-step">
          <span className="fd-step-n" aria-hidden="true">
            1
          </span>
          <div>
            <h2>Name your team</h2>
            <p>Your plans and your people are kept under this name. You can invite others later.</p>
            <form className="workspace-row" onSubmit={create}>
              <label className="sr-only" htmlFor="first-team">
                Team name
              </label>
              <input id="first-team" maxLength={120} required value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. Riverside Community Group" />
              <button className="fd-btn fd-btn-primary" type="submit" disabled={busy || !team.trim()}>
                {busy ? "Adding…" : "Add"}
              </button>
            </form>
            {problem && (
              <p className="workspace-problem" role="alert">
                {problem}
              </p>
            )}
          </div>
        </li>
        <li className="fd-step">
          <span className="fd-step-n" aria-hidden="true">
            2
          </span>
          <div>
            <h2>Install FrameDecks on the service PC</h2>
            <p>The Windows PC that drives your screen or your Zoom. It is free; the meeting always runs from there.</p>
            <a className="fd-btn fd-btn-ghost" href={DOWNLOADS}>
              <Download aria-hidden="true" size={17} /> Download for Windows
            </a>
          </div>
        </li>
        <li className="fd-step">
          <span className="fd-step-n" aria-hidden="true">
            3
          </span>
          <div>
            <h2>Link that PC</h2>
            <p>
              In FrameDecks: Settings → Workspace Sync → Connect to FrameDecks. Your browser asks you to allow that PC;
              your plan then reaches it within a minute. Linked PCs show under Service PCs.
            </p>
            <Link className="fd-link" href="/computers">
              Service PCs <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>
        </li>
      </ol>
    </section>
  );
}
