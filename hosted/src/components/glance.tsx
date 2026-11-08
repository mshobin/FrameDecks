"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CakeSlice, ChevronRight, CircleCheck, CircleDashed, ClipboardList, Radio } from "lucide-react";

import { isOnline, nowShowing, type LiveComputer } from "@/lib/live-view";
import { browserSupabase } from "@/lib/supabase-browser";
import { join } from "@/lib/sync-entities";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { relativeTime } from "@/lib/when";
import { pullWorkspace } from "@/lib/workspace-sync";
import { upcomingBirthdays, whenLabel, type Birthday } from "@/lib/workspace-settings";

type Glance = {
  title: string;
  date: string;
  frames: number;
  lastChange: string | null;
  people: number;
  birthdays: Birthday[];
  pc: LiveComputer | null;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function when(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  const label = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return days === 0 ? `Today · ${label}` : days === 1 ? `Tomorrow · ${label}` : days > 1 && days < 7 ? `In ${days} days · ${label}` : label;
}

/** Home's one job (owner-approved, 27 October): the next service, how ready it is, and the one thing to do next.
 * Volunteers who may only run services get "Run from my phone" as the main button. */
export function NextService({ workspace, name }: Readonly<{ workspace: WorkspaceChoice; name: string }>) {
  const supabase = browserSupabase();
  const [glance, setGlance] = useState<Glance | null>(null);
  const [runner, setRunner] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    (async () => {
      const { records } = await pullWorkspace(supabase, workspace.id);
      const pcs = await supabase.rpc("remote_computers", { org: workspace.id });
      const { doc, members } = join(records, {});
      const meeting = isObj(doc.meeting) ? doc.meeting : {};
      const scenes = Array.isArray(doc.scenes) ? doc.scenes.filter((s) => isObj(s) && !s.tpl) : [];
      const list = ((pcs.data as LiveComputer[] | null) ?? []).sort((a, b) => Number(isOnline(b)) - Number(isOnline(a)));
      if (live)
        setGlance({
          title: String(meeting.title ?? ""),
          date: String(meeting.date ?? ""),
          frames: scenes.length,
          lastChange: records.map((r) => r.updatedAt ?? "").sort().at(-1) || null,
          people: members.length,
          birthdays: upcomingBirthdays(members),
          pc: list[0] ?? null,
        });
    })();
    if (workspace.role === "member") {
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        supabase
          .from("memberships")
          .select("can_run_services")
          .eq("organization_id", workspace.id)
          .eq("user_id", data.user.id)
          .maybeSingle()
          .then(({ data: row }) => {
            if (live) setRunner(Boolean((row as { can_run_services?: boolean } | null)?.can_run_services));
          });
      });
    }
    return () => {
      live = false;
    };
  }, [supabase, workspace.id, workspace.role]);

  const online = glance?.pc ? isOnline(glance.pc) : false;
  const editor = workspace.role !== "member";
  const ready = [
    {
      ok: Boolean(glance && glance.frames > 0),
      text: glance ? (glance.frames ? `The plan has ${glance.frames} Frame${glance.frames === 1 ? "" : "s"}` : "No Frames planned yet") : "Checking the plan…",
      detail: glance?.lastChange ? `updated ${relativeTime(glance.lastChange)}` : "",
      href: "/plan",
      action: glance && !glance.frames ? "Plan it" : "",
    },
    {
      ok: online,
      text: glance ? (glance.pc ? `${glance.pc.name} is ${online ? "online" : "offline"}` : "No service PC linked yet") : "Checking the service PC…",
      detail: glance?.pc && online ? nowShowing(glance.pc.status) : glance?.pc ? "Open FrameDecks on it to run the service" : "",
      href: "/devices",
      action: glance && !glance.pc && editor ? "Link one" : "",
    },
  ];
  const title = glance ? glance.title || "Your next meeting" : "…";
  return (
    <>
      <section className="fd-next" aria-labelledby="fd-next-title">
        <p className="fd-kicker">
          {greeting(new Date().getHours())}
          {name ? `, ${name}` : ""} · {workspace.name}
        </p>
        <h1 id="fd-next-title" className="fd-next-title">
          {title}
        </h1>
        <p className="fd-next-when">{glance ? (glance.date ? when(glance.date) : "No date yet: add it in Plan") : ""}</p>
        <ul className="fd-ready" aria-label="Ready for the service">
          {ready.map((r) => (
            <li key={r.href} className={r.ok ? "is-ok" : "is-todo"}>
              {r.ok ? <CircleCheck aria-hidden="true" size={18} /> : <CircleDashed aria-hidden="true" size={18} />}
              <span>
                <strong>{r.text}</strong>
                {r.detail ? <span> · {r.detail}</span> : null}
              </span>
              {r.action ? (
                <Link className="fd-link" href={r.href}>
                  {r.action} <ChevronRight aria-hidden="true" size={15} />
                </Link>
              ) : null}
              <span className="sr-only">{r.ok ? "(ready)" : "(to do)"}</span>
            </li>
          ))}
        </ul>
        <div className="fd-hero-actions">
          {runner || !editor ? (
            <>
              <Link className="fd-btn fd-btn-primary" href="/live">
                <Radio aria-hidden="true" size={17} /> {runner ? "Run the service" : "Follow the service"}
              </Link>
              <Link className="fd-btn fd-btn-ghost" href="/plan">
                <ClipboardList aria-hidden="true" size={17} /> See the plan
              </Link>
            </>
          ) : (
            <>
              <Link className="fd-btn fd-btn-primary" href="/plan">
                <ClipboardList aria-hidden="true" size={17} /> Open the plan
              </Link>
              <Link className="fd-btn fd-btn-ghost" href="/live">
                <Radio aria-hidden="true" size={17} /> Run from my phone
              </Link>
            </>
          )}
        </div>
      </section>
      {glance && <BirthdaysThisWeek birthdays={glance.birthdays} />}
    </>
  );
}

function greeting(hour: number): string {
  return hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** The program's birthday reminders, from the workspace's member list (Settings → Birthdays on the PC). */
function BirthdaysThisWeek({ birthdays }: Readonly<{ birthdays: Birthday[] }>) {
  return (
    <section className="fd-birthdays" aria-labelledby="fd-bd-title">
      <div className="fd-birthdays-head">
        <span className="fd-tile-icon">
          <CakeSlice aria-hidden="true" size={18} strokeWidth={1.9} />
        </span>
        <h2 id="fd-bd-title">Birthdays this week</h2>
        <Link className="fd-link" href="/members">
          People <ChevronRight aria-hidden="true" size={15} />
        </Link>
      </div>
      {birthdays.length === 0 ? (
        <p className="workspace-hint">No birthdays in the next seven days.</p>
      ) : (
        <ul className="fd-birthday-list">
          {birthdays.map((b) => (
            <li key={b.id || b.name} className={b.inDays === 0 ? "fd-birthday fd-birthday-today" : "fd-birthday"}>
              <span className="fd-avatar" aria-hidden="true">
                {b.name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="fd-birthday-name">{b.name}</span>
              <span className="fd-birthday-when">
                {whenLabel(b)}
                {b.turning ? ` · turns ${b.turning}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
