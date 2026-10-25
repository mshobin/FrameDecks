"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { browserSupabase } from "@/lib/supabase-browser";
import type { Role } from "@/lib/supabase-config";

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
}: Readonly<{ organizationId: string; myRole: Role; myUserId: string; onLeft: () => void }>) {
  const supabase = browserSupabase();
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
      setMessage({ ok: false, text: people.error.message });
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
        text: error.code === "23505" ? `${address} is already invited.` : error.code === "23514" ? "That email address does not look right." : error.message,
      });
      return;
    }
    setEmail("");
    setMessage({ ok: true, text: `Invited ${address}. They join when they sign in with that email and accept.` });
    await load();
  }

  async function cancelInvite(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) setMessage({ ok: false, text: error.message });
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
    if (error) setMessage({ ok: false, text: error.message });
    else
      setMessage({
        ok: true,
        text: allowed
          ? `${member.display_name ?? member.email} can now run services from the companion's Live page.`
          : `${member.display_name ?? member.email} can no longer run services.`,
      });
    await load();
  }

  async function remove(member: Member) {
    if (!supabase) return;
    const leaving = member.user_id === myUserId;
    const question = leaving
      ? "Leave this workspace? You will need a new invitation to come back."
      : `Remove ${member.display_name ?? member.email} from this workspace?`;
    if (!window.confirm(question)) return;
    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", member.user_id);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    if (leaving) onLeft();
    else await load();
  }

  return (
    <div className="members">
      {members === null ? (
        <p className="workspace-hint">Loading members…</p>
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
                {canRemove && (
                  <button className="member-action" type="button" onClick={() => remove(member)}>
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
                <span>Invited · waiting for them to sign in</span>
              </span>
              <span className="workspace-role">{roleLabels[invitation.role]}</span>
              <button className="member-action" type="button" onClick={() => cancelInvite(invitation.id)}>
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
              placeholder="name@church.org"
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
    </div>
  );
}
