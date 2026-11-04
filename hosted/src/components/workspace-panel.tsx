"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/confirm-dialog";
import { WorkspaceMembers } from "@/components/workspace-members";
import { browserSupabase } from "@/lib/supabase-browser";
import type { Organization, Role } from "@/lib/supabase-config";
import { useSession } from "@/lib/use-session";
import { ListSkeleton } from "@/components/states";
import { userSafeError } from "@/lib/user-error";

const NAME_LIMIT = 120;
const roleLabels: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" };

type Workspace = Pick<Organization, "id" | "name" | "created_at"> & { role: Role };
type InvitationForMe = { id: string; organization_name: string; role: Role };
type MembershipRow = { role: Role; organizations: Pick<Organization, "id" | "name" | "created_at"> | null };

// The signed-in person's profile and workspaces. Row-level security decides what they can read and write.
export function WorkspacePanel() {
  const supabase = browserSupabase();
  const { ask, dialog } = useConfirmation();
  const session = useSession();
  const userId = session?.user.id;

  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  // null until known; stays null when migration 0002 (invitations) has not been run yet.
  const [invitations, setInvitations] = useState<InvitationForMe[] | null>(null);
  const [openWorkspace, setOpenWorkspace] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [busy, setBusy] = useState<"profile" | "workspace" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    const [memberships, profile, invited] = await Promise.all([
      supabase
        .from("memberships")
        .select("role, organizations(id, name, created_at)")
        .eq("user_id", userId)
        .overrideTypes<MembershipRow[], { merge: false }>(),
      supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      supabase.rpc("my_invitations"),
    ]);
    setInvitations(invited.error ? null : (invited.data as InvitationForMe[]));
    if (memberships.error || profile.error) {
      setProblem(userSafeError(memberships.error ?? profile.error, "Couldn’t load your teams. Check your connection and try again."));
      setWorkspaces([]);
      return;
    }
    setWorkspaces(
      (memberships.data ?? [])
        .filter((row) => row.organizations)
        .map((row) => ({ ...row.organizations!, role: row.role }))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
    setDisplayName(profile.data?.display_name ?? "");
  }, [supabase, userId]);

  useEffect(() => {
    // Loading talks to Supabase; its results arrive asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!supabase || session === undefined) return null;

  if (!session) {
    return (
      <section className="workspace-card workspace-signed-out" aria-label="Your workspace">
        <Building2 aria-hidden="true" size={20} />
        <p>
          <Link href="/sync?intent=save">Save Workspace</Link> to create your team&apos;s space.
        </p>
      </section>
    );
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) return;
    setBusy("profile");
    setProblem(null);
    setNotice(null);
    const name = displayName.trim();
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, display_name: name || null }, { onConflict: "user_id" });
    setBusy(null);
    if (error) setProblem(userSafeError(error, "Couldn’t save your profile. Try again."));
    else setNotice("Your name is saved.");
  }

  async function respond(invitation: InvitationForMe, accept: boolean) {
    if (!supabase) return;
    setProblem(null);
    setNotice(null);
    const { error } = accept
      ? await supabase.rpc("accept_invitation", { invitation: invitation.id })
      : await supabase.from("invitations").delete().eq("id", invitation.id);
    if (error) setProblem(userSafeError(error, "Couldn’t update this invitation. Try again."));
    else setNotice(accept ? `You joined “${invitation.organization_name}”.` : "Invitation declined.");
    await load();
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) return;
    const name = workspaceName.trim();
    if (!name) return;
    setBusy("workspace");
    setProblem(null);
    setNotice(null);
    // The database makes the creator the owner (trigger), so the client never picks a role.
    const { error } = await supabase.from("organizations").insert({ name, created_by: userId });
    setBusy(null);
    if (error) {
      setProblem(userSafeError(error, "Couldn’t create your team. Check your connection and try again."));
      return;
    }
    setWorkspaceName("");
    setNotice(`“${name}” is created. You are its owner.`);
    await load();
  }

  // Owners only (organizations_delete in 0001). Everything in the workspace goes with it: the plan and its history,
  // members and groups, invitations, linked PCs and the audit log (all "on delete cascade").
  async function deleteWorkspace(workspace: Workspace) {
    if (!supabase) return;
    if (!(await ask({
      title: `Delete “${workspace.name}” for everyone?`,
      description: "The shared plan, history, member list, invitations and linked-PC records are removed and can’t be restored. Each linked PC keeps its local copy. Type the team name below to confirm.",
      confirmLabel: "Delete team",
      confirmationText: workspace.name,
      confirmationLabel: `Type “${workspace.name}” to confirm`,
    }))) return;
    setProblem(null);
    setNotice(null);
    const { data, error } = await supabase.from("organizations").delete().eq("id", workspace.id).select("id");
    if (error) {
      setProblem(userSafeError(error, "Couldn’t delete this team. Ask a workspace owner for help."));
      return;
    }
    if (!data?.length) {
      setProblem("Only a workspace owner can delete this team.");
      return;
    }
    setOpenWorkspace(null);
    setNotice(`“${workspace.name}” is deleted.`);
    await load();
  }

  return (
    <section className="workspace-grid" aria-label="Your workspace">
      {invitations && invitations.length > 0 && (
        <article className="workspace-card workspace-invites">
          <header>
            <Building2 aria-hidden="true" size={18} />
            <h2>You&apos;re invited</h2>
          </header>
          <ul className="workspace-list">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <span className="workspace-name">
                  {invitation.organization_name} · {roleLabels[invitation.role]}
                </span>
                <span className="invite-actions">
                  <Button size="sm" type="button" className="auth-primary" onClick={() => respond(invitation, true)}>
                    Join
                  </Button>
                  <Button size="sm" type="button" variant="outline" onClick={() => respond(invitation, false)}>
                    Decline
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}

      <article className="workspace-card">
        <header>
          <UserRound aria-hidden="true" size={18} />
          <h2>Your profile</h2>
        </header>
        <form className="workspace-form" onSubmit={saveProfile}>
          <label htmlFor="display-name">Display name</label>
          <div className="workspace-row">
            <input
              id="display-name"
              maxLength={NAME_LIMIT}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="e.g. Sam Taylor"
            />
            <Button disabled={busy !== null} type="submit" variant="outline">
              {busy === "profile" ? "Saving…" : "Save"}
            </Button>
          </div>
          <p className="workspace-hint">
            Your workspace email: {session.user.email}. People on your team see this name.
          </p>
        </form>
      </article>

      <article className="workspace-card">
        <header>
          <Building2 aria-hidden="true" size={18} />
          <h2>Your teams</h2>
        </header>
        {workspaces === null ? (
          <ListSkeleton />
        ) : workspaces.length === 0 ? (
          <p className="workspace-hint">Nothing yet. Add your team below.</p>
        ) : (
          <ul className="workspace-list">
            {workspaces.map((workspace) => (
              <li className="workspace-item" key={workspace.id}>
                <div className="workspace-item-row">
                  <span className="workspace-name">{workspace.name}</span>
                  <span className="workspace-role">{roleLabels[workspace.role]}</span>
                  {invitations !== null && (
                    <button
                      aria-expanded={openWorkspace === workspace.id}
                      className="member-action"
                      type="button"
                      onClick={() => setOpenWorkspace(openWorkspace === workspace.id ? null : workspace.id)}
                    >
                      {openWorkspace === workspace.id ? "Close" : "Members"}
                    </button>
                  )}
                  {workspace.role === "owner" && (
                    <button
                      className="member-action member-danger"
                      type="button"
                      aria-label={`Delete ${workspace.name}`}
                      onClick={() => deleteWorkspace(workspace)}
                    >
                      Delete
                    </button>
                  )}
                </div>
                {openWorkspace === workspace.id && userId && (
                  <WorkspaceMembers
                    organizationId={workspace.id}
                    myRole={workspace.role}
                    myUserId={userId}
                    onLeft={() => {
                      setOpenWorkspace(null);
                      load();
                    }}
                    onRoleChange={load}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <form className="workspace-form" onSubmit={createWorkspace}>
          <label htmlFor="workspace-name">Add a team</label>
          <div className="workspace-row">
            <input
              id="workspace-name"
              maxLength={NAME_LIMIT}
              required
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="e.g. Riverside Community Group"
            />
            <Button disabled={busy !== null || !workspaceName.trim()} type="submit" variant="outline">
              {busy === "workspace" ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </article>

      {(notice || problem) && (
        <p className={problem ? "workspace-problem" : "workspace-notice"} role={problem ? "alert" : "status"}>
          {problem ?? notice}
        </p>
      )}
      {dialog}
    </section>
  );
}
