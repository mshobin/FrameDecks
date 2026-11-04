"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/confirm-dialog";
import { browserSupabase } from "@/lib/supabase-browser";
import type { Role } from "@/lib/supabase-config";
import { ListSkeleton } from "@/components/states";
import { userSafeError } from "@/lib/user-error";

type Member = { user_id: string; role: Role; display_name: string | null; email: string };
type Invitation = { id: string; email: string; role: Exclude<Role, "owner"> };

const roleLabels: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" };

// Members and pending invitations of one workspace. Owners and admins can invite, cancel and remove;
// row-level security enforces the same rules in the database.
export function WorkspaceMembers({
  organizationId,
  myRole,
  myUserId,
  onLeft,
  onRoleChange,
}: Readonly<{ organizationId: string; myRole: Role; myUserId: string; onLeft: () => void; onRoleChange?: () => void }>) {
  const supabase = browserSupabase();
  const { ask, dialog } = useConfirmation();
  const canManage = myRole === "owner" || myRole === "admin";
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Invitation["role"]>("member");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Phase 5 (0004_remote.sql): who may run services from the companion; null until known or before 0004 is run
  const [runners, setRunners] = useState<Set<string> | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const people = await supabase.rpc("workspace_members", { org: organizationId });
    if (people.error) {
      setMessage({ ok: false, text: userSafeError(people.error, "Couldn’t load your team’s members. Check your connection and try again.") });
      setMembers([]);
      return;
    }
    setMembers(people.data as Member[]);
    const grants = await supabase.from("memberships").select("user_id, can_run_services").eq("organization_id", organizationId);
    setRunners(
      grants.error
        ? null
        : new Set((grants.data as { user_id: string; can_run_services: boolean }[]).filter((g) => g.can_run_services).map((g) => g.user_id)),
    );
    if (canManage) {
      const pending = await supabase
        .from("invitations")
        .select("id, email, role")
        .eq("organization_id", organizationId)
        .order("created_at");
      setInvitations((pending.data as Invitation[] | null) ?? []);
    }
  }, [supabase, organizationId, canManage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!supabase) return null;

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const address = email.trim().toLowerCase();
    if (!address) return;
    if (members?.some((m) => m.email.toLowerCase() === address)) {
      setMessage({ ok: false, text: `${address} is already in this workspace.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("invitations")
      .insert({ organization_id: organizationId, email: address, role, invited_by: myUserId });
    setBusy(false);
    if (error) {
      setMessage({
        ok: false,
        text: error.code === "23505" ? `${address} is already invited.` : error.code === "23514" ? "That email address does not look right." : userSafeError(error, "Couldn’t send the invitation. Try again."),
      });
      return;
    }
    setEmail("");
    setMessage({ ok: true, text: `Invited ${address}. They join when they open their workspace with that email and accept.` });
    await load();
  }

  async function cancelInvite(id: string, email: string) {
    if (!supabase) return;
    if (!(await ask({
      title: `Cancel the invitation to ${email}?`,
      description: "The link in their email will stop working.",
      confirmLabel: "Cancel invitation",
    }))) return;
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) setMessage({ ok: false, text: userSafeError(error, "Couldn’t cancel this invitation. Try again.") });
    await load();
  }

  async function setRunner(member: Member, allowed: boolean) {
    if (!supabase) return;
    setRunners((current) => {
      const next = new Set(current);
      if (allowed) next.add(member.user_id);
      else next.delete(member.user_id);
      return next;
    });
    const { error } = await supabase
      .from("memberships")
      .update({ can_run_services: allowed })
      .eq("organization_id", organizationId)
      .eq("user_id", member.user_id);
    if (error) setMessage({ ok: false, text: userSafeError(error, "Couldn’t change this member’s service access. Try again.") });
    else
      setMessage({
        ok: true,
        text: allowed
          ? `${member.display_name ?? member.email} can now run services from the companion's Live page.`
          : `${member.display_name ?? member.email} can no longer run services.`,
      });
    await load();
  }

  // 9.3 handing the team to someone already in it (0014 transfer_ownership); the owner stays as an admin
  async function handOver(member: Member) {
    if (!supabase) return;
    const name = member.display_name ?? member.email;
    if (!(await ask({
      title: `Make ${name} the owner?`,
      description: "They can then change roles and delete the team. You stay in the team as an admin.",
      confirmLabel: "Make owner",
    }))) return;
    const { error } = await supabase.rpc("transfer_ownership", { org: organizationId, new_owner: member.user_id });
    if (error) {
      setMessage({ ok: false, text: userSafeError(error, "Couldn’t hand the team over. Try again.") });
      return;
    }
    setMessage({ ok: true, text: `${name} is now the owner. You are an admin.` });
    onRoleChange?.();
    await load();
  }

  async function remove(member: Member) {
    if (!supabase) return;
    const leaving = member.user_id === myUserId;
    const name = member.display_name ?? member.email;
    if (!(await ask({
      title: leaving ? "Leave this team?" : `Remove ${name}?`,
      description: leaving
        ? "You’ll need a new invitation to come back."
        : "They’ll lose access to this team and its shared plan.",
      confirmLabel: leaving ? "Leave team" : "Remove person",
    }))) return;
    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", member.user_id);
    if (error) {
      setMessage({ ok: false, text: userSafeError(error, "Couldn’t update team membership. Try again.") });
      return;
    }
    if (leaving) onLeft();
    else await load();
  }

  return (
    <div className="members">
      {members === null ? (
        <ListSkeleton />
      ) : (
        <ul className="members-list">
          {members.map((member) => {
            const isMe = member.user_id === myUserId;
            const canRemove = member.role !== "owner" && (isMe || canManage);
            return (
              <li key={member.user_id}>
                <span className="member-who">
                  <strong>{member.display_name ?? member.email}</strong>
                  {member.display_name && <span>{member.email}</span>}
                </span>
                <span className="workspace-role">{roleLabels[member.role]}</span>
                {runners && member.role === "member" && canManage && (
                  <label className="member-runner">
                    <input
                      type="checkbox"
                      checked={runners.has(member.user_id)}
                      onChange={(event) => setRunner(member, event.target.checked)}
                    />
                    Can run services
                  </label>
                )}
                {runners && member.role === "member" && !canManage && runners.has(member.user_id) && (
                  <span className="member-runner">Can run services</span>
                )}
                {myRole === "owner" && !isMe && (
                  <button className="member-action" type="button" onClick={() => handOver(member)}>
                    Make owner
                  </button>
                )}
                {canRemove && (
                  <button className="member-action member-danger" type="button" onClick={() => remove(member)}>
                    {isMe ? "Leave" : "Remove"}
                  </button>
                )}
              </li>
            );
          })}
          {invitations.map((invitation) => (
            <li className="member-pending" key={invitation.id}>
              <span className="member-who">
                <strong>{invitation.email}</strong>
                <span>Invited · waiting for them to accept</span>
              </span>
              <span className="workspace-role">{roleLabels[invitation.role]}</span>
              <button className="member-action member-danger" type="button" aria-label={`Cancel the invitation to ${invitation.email}`} onClick={() => cancelInvite(invitation.id, invitation.email)}>
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form className="workspace-form" onSubmit={sendInvite}>
          <label htmlFor={`invite-${organizationId}`}>Invite by email</label>
          <div className="workspace-row">
            <input
              id={`invite-${organizationId}`}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.org"
            />
            <select
              aria-label="Role"
              value={role}
              onChange={(event) => setRole(event.target.value as Invitation["role"])}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button disabled={busy || !email.trim()} type="submit" variant="outline">
              {busy ? "Inviting…" : "Invite"}
            </Button>
          </div>
        </form>
      )}

      {message && (
        <p className={message.ok ? "workspace-notice" : "workspace-problem"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}
      {dialog}
    </div>
  );
}
