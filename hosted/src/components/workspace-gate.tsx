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

  if (!supabase) return <p className="page-note">Sign-in is not set up for this site yet.</p>;
  if (session === undefined || (session && workspaces === null)) return <PageSkeleton />;
  if (!session) {
    return (
      <p className="page-note">
        <Link href="/sign-in">Sign in</Link> to see {what}.
      </p>
    );
  }
  if (!selected) {
    return (
      <p className="page-note">
        You are not in a workspace yet. Create one on the <Link href="/">Overview</Link>.
      </p>
    );
  }
  const admin = selected.role === "owner" || selected.role === "admin";
  return (
    <>
      {workspaces && workspaces.length > 1 && (
        <label className="workspace-picker">
          <span>Workspace</span>
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
    <EmptyState title="Syncing isn’t switched on yet">
      Whoever set up FRAMEDECKS for your church finishes it once, in the database (step <code>0003_sync.sql</code>).
    </EmptyState>
  );
}
