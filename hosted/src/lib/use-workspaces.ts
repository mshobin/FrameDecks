"use client";

import { useCallback, useEffect, useState } from "react";

import { browserSupabase } from "@/lib/supabase-browser";
import type { Role } from "@/lib/supabase-config";
import { useSession } from "@/lib/use-session";

export type WorkspaceChoice = { id: string; name: string; role: Role };

const KEY = "framedecks-workspace";

function remembered(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The signed-in person's workspaces and the one they are looking at (remembered on this device). */
export function useWorkspaces() {
  const supabase = browserSupabase();
  const session = useSession();
  const userId = session?.user.id;
  const [workspaces, setWorkspaces] = useState<WorkspaceChoice[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !userId) return;
    let live = true;
    supabase
      .from("memberships")
      .select("role, organizations(id, name, created_at)")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!live) return;
        const rows = (data ?? []) as unknown as { role: Role; organizations: { id: string; name: string; created_at: string } | null }[];
        const list = rows
          .filter((r) => r.organizations)
          .sort((a, b) => a.organizations!.created_at.localeCompare(b.organizations!.created_at))
          .map((r) => ({ id: r.organizations!.id, name: r.organizations!.name, role: r.role }));
        setWorkspaces(list);
        const saved = remembered();
        setSelectedId(list.some((w) => w.id === saved) ? saved : (list[0]?.id ?? null));
      });
    return () => {
      live = false;
    };
  }, [supabase, userId]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  }, []);

  const selected = workspaces?.find((w) => w.id === selectedId) ?? null;
  return { session, workspaces, selected, select };
}
