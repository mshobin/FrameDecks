"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Layers, MonitorPlay, Users } from "lucide-react";

import { isOnline, nowShowing, type LiveComputer } from "@/lib/live-view";
import { browserSupabase } from "@/lib/supabase-browser";
import { join } from "@/lib/sync-entities";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { pullWorkspace } from "@/lib/workspace-sync";

type Glance = {
  title: string;
  date: string;
  frames: number;
  lastChange: string | null;
  people: number;
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

/** The workspace at a glance: the next meeting, the plan, the people and the service PC, each opening its page. */
export function GlanceTiles({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const [glance, setGlance] = useState<Glance | null>(null);

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
          pc: list[0] ?? null,
        });
    })();
    return () => {
      live = false;
    };
  }, [supabase, workspace.id]);

  const online = glance?.pc ? isOnline(glance.pc) : false;
  const tiles = [
    {
      href: "/meeting",
      icon: CalendarDays,
      label: "Next meeting",
      value: glance ? glance.title || "Not named yet" : "…",
      detail: glance ? (glance.date ? when(glance.date) : "Add the date on the Meeting Form") : "",
    },
    {
      href: "/services",
      icon: Layers,
      label: "Service plan",
      value: glance ? `${glance.frames} Frame${glance.frames === 1 ? "" : "s"}` : "…",
      detail: glance?.lastChange ? `Updated ${new Date(glance.lastChange).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : glance ? "Link the service PC to sync it" : "",
    },
    {
      href: "/live",
      icon: MonitorPlay,
      label: glance?.pc ? glance.pc.name : "Service PC",
      value: glance ? (glance.pc ? (online ? "Online" : "Offline") : "Not linked") : "…",
      detail: glance ? (glance.pc ? (online ? nowShowing(glance.pc.status) : "Open FRAMEDECKS to go live") : "Link it under Computers") : "",
      tone: online ? "ok" : undefined,
    },
    {
      href: "/members",
      icon: Users,
      label: "People",
      value: glance ? `${glance.people} member${glance.people === 1 ? "" : "s"}` : "…",
      detail: glance ? `In ${workspace.name}` : "",
    },
  ];

  return (
    <section className="fd-glance" aria-label="At a glance">
      {tiles.map(({ href, icon: Icon, label, value, detail, tone }) => (
        <Link className={tone === "ok" ? "fd-tile fd-tile-ok" : "fd-tile"} href={href} key={href}>
          <span className="fd-tile-icon">
            <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
          </span>
          <span className="fd-tile-label">{label}</span>
          <strong className="fd-tile-value">
            {tone === "ok" && <span className="fd-dot" aria-hidden="true" />}
            {value}
          </strong>
          <span className="fd-tile-detail">{detail}</span>
          <ChevronRight className="fd-tile-go" aria-hidden="true" size={16} />
        </Link>
      ))}
    </section>
  );
}
