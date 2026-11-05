"use client";

import Link from "next/link";

import { browserSupabase } from "@/lib/supabase-browser";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { useWorkspaces } from "@/lib/use-workspaces";
import { EmptyState, PageSkeleton } from "@/components/states";

/** Shows the page only to a signed-in person with a workspace (and, if asked, only to its owners and admins), with
 * a workspace picker when they have more than one. */
export function WorkspaceGate({
  adminOnly = false,
  what,
  children,
}: Readonly<{ adminOnly?: boolean; what: string; children: (workspace: WorkspaceChoice) => React.ReactNode }>) {
  const supabase = browserSupabase();
  const { session, workspaces, selected, select } = useWorkspaces();

  if (!supabase) return <p className="page-note">Workspace sync is not set up for this site yet.</p>;
  if (session === undefined || (session && workspaces === null)) return <PageSkeleton />;
  if (!session) {
    return (
      <p className="page-note">
        <Link href="/sync">Open your workspace</Link> to see {what}.
      </p>
    );
  }
  if (!selected) {
    return (
      <p className="page-note">
        You haven&apos;t added your team yet. Add it on <Link href="/">Home</Link>.
      </p>
    );
  }
  const admin = selected.role === "owner" || selected.role === "admin";
  return (
    <>
      {workspaces && workspaces.length > 1 && (
        <label className="workspace-picker">
          <span>Team</span>
          <select value={selected.id} onChange={(e) => select(e.target.value)}>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {adminOnly && !admin ? (
        <p className="page-note">Only owners and admins of “{selected.name}” can see {what}.</p>
      ) : (
        children(selected)
      )}
    </>
  );
}

export function NotSetUp() {
  return (
    <EmptyState title="Workspace syncing isn’t ready yet">
      Ask your workspace owner to finish setting it up. Your service PC keeps its local plan.
    </EmptyState>
  );
}
