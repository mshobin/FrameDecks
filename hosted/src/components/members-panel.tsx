"use client";

import { useEffect, useState } from "react";

import { NotSetUp, WorkspaceGate } from "@/components/workspace-gate";
import { describeMembers, type MemberView } from "@/lib/services-view";
import { browserSupabase } from "@/lib/supabase-browser";
import { join } from "@/lib/sync-entities";
import { pullWorkspace, syncNotSetUp } from "@/lib/workspace-sync";
import type { WorkspaceChoice } from "@/lib/use-workspaces";

function Members({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const [members, setMembers] = useState<MemberView[] | "not-set-up" | { error: string } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    pullWorkspace(supabase, workspace.id).then(({ records, error }) => {
      if (!live) return;
      if (error) return setMembers(syncNotSetUp(error) ? "not-set-up" : { error: error.message });
      setMembers(describeMembers(join(records, {}).members));
    });
    return () => {
      live = false;
    };
  }, [supabase, workspace.id]);

  if (members === null) return <p className="page-note">Loading…</p>;
  if (members === "not-set-up") return <NotSetUp />;
  if ("error" in members) return <p className="page-note page-problem">{members.error}</p>;
  if (!members.length) return <p className="page-note">No members have been synced from the service PC yet.</p>;
  return (
    <>
      <p className="page-note">
        {members.length} member{members.length === 1 ? "" : "s"}, synced from the service PC. Only owners and admins of
        “{workspace.name}” can see this list. View only: edit on the service PC.
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Birthday</th>
              <th>Country</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.birthDate}</td>
                <td>{m.country}</td>
                <td>{m.phone}</td>
                <td>{m.email}</td>
                <td>{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MembersPanel() {
  return (
    <WorkspaceGate adminOnly what="the member list">
      {(w) => <Members key={w.id} workspace={w} />}
    </WorkspaceGate>
  );
}
