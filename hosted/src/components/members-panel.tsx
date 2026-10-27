"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { NotSetUp, WorkspaceGate } from "@/components/workspace-gate";
import {
  birthdayLabel,
  cleanGroupName,
  draftOf,
  groupCounts,
  inGroup,
  memberBody,
  type Group,
  type GroupLinks,
  type MemberBody,
  type MemberDraft,
} from "@/lib/member-edit";
import { browserSupabase } from "@/lib/supabase-browser";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { deleteRecord, pullWorkspace, pushRecord, syncNotSetUp, type PulledRecord } from "@/lib/workspace-sync";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { useConfirmation } from "@/components/confirm-dialog";
import { userSafeError } from "@/lib/user-error";

// The member list (owners and admins). M-D2: the workspace is the list's source; people added, edited or removed
// here reach the service PC at its next sync. M-D6: groups live in the cloud only (0008_member_groups.sql); the
// desktop never sees them.

type Person = MemberBody & { rev: number };
type Message = { ok: boolean; text: string } | null;
type Editing = { id: string | null; draft: MemberDraft; groups: Set<string> } | null;

const groupsNotSetUp = (error: { code?: string; message?: string } | null) =>
  !!error && (["PGRST205", "42P01"].includes(error.code ?? "") || /could not find the table/i.test(error.message ?? ""));

function MemberForm({
  editing,
  groups,
  busy,
  onChange,
  onSave,
  onCancel,
  onRemove,
}: Readonly<{
  editing: NonNullable<Editing>;
  groups: Group[] | null;
  busy: boolean;
  onChange: (e: NonNullable<Editing>) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: (() => void) | null;
}>) {
  const field = (key: keyof MemberDraft, label: string, extra: Record<string, unknown> = {}) => (
    <label>
      {label}
      <input
        value={editing.draft[key]}
        onChange={(e) => onChange({ ...editing, draft: { ...editing.draft, [key]: e.target.value } })}
        {...extra}
      />
    </label>
  );
  return (
    <div className="frame-card frame-editing member-editing">
      <div className="edit-grid member-grid">
        {field("name", "Name", { maxLength: 120, autoFocus: true })}
        {field("birthDate", "Birthday (YYYY-MM-DD, or MM-DD)", { maxLength: 10, placeholder: "1985-03-15" })}
        {field("country", "Country", { maxLength: 80 })}
        {field("phone", "Phone", { maxLength: 40, inputMode: "tel", placeholder: "+965 5000 0000" })}
        {field("email", "Email", { maxLength: 160, type: "email" })}
        {field("role", "Role", { maxLength: 60 })}
      </div>
      {groups && groups.length > 0 && (
        <fieldset className="edit-list member-groups-pick">
          <legend>Groups</legend>
          {groups.map((g) => (
            <label className="member-runner" key={g.id}>
              <input
                type="checkbox"
                checked={editing.groups.has(g.id)}
                onChange={(e) => {
                  const next = new Set(editing.groups);
                  if (e.target.checked) next.add(g.id);
                  else next.delete(g.id);
                  onChange({ ...editing, groups: next });
                }}
              />
              {g.name}
            </label>
          ))}
        </fieldset>
      )}
      <div className="edit-actions">
        <button className="live-btn live-primary" type="button" disabled={busy} onClick={onSave}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="live-btn" type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        {onRemove && (
          <button className="member-action member-remove member-danger" type="button" disabled={busy} onClick={onRemove}>
            Remove from the list
          </button>
        )}
      </div>
    </div>
  );
}

function GroupsManager({
  groups,
  counts,
  busy,
  onAdd,
  onRename,
  onDelete,
}: Readonly<{
  groups: Group[];
  counts: Map<string, number>;
  busy: boolean;
  onAdd: (name: string) => Promise<boolean>;
  onRename: (g: Group, name: string) => Promise<boolean>;
  onDelete: (g: Group) => void;
}>) {
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  return (
    <div className="workspace-card member-groups">
      <p className="section-title">Groups</p>
      {groups.length === 0 && <p className="workspace-hint">No groups yet. Groups are kept online only; the service PC does not show them.</p>}
      <ul className="members-list">
        {groups.map((g) => (
          <li key={g.id}>
            {renaming?.id === g.id ? (
              <form
                className="workspace-row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await onRename(g, renaming.name)) setRenaming(null);
                }}
              >
                <input aria-label="Group name" value={renaming.name} maxLength={60} autoFocus onChange={(e) => setRenaming({ id: g.id, name: e.target.value })} />
                <button type="submit" disabled={busy}>
                  Save
                </button>
                <button type="button" className="member-action" onClick={() => setRenaming(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="member-who">
                  <strong>{g.name}</strong>
                  <span>
                    {counts.get(g.id) ?? 0} member{(counts.get(g.id) ?? 0) === 1 ? "" : "s"}
                  </span>
                </span>
                <button className="member-action" type="button" onClick={() => setRenaming({ id: g.id, name: g.name })}>
                  Rename
                </button>
                <button className="member-action member-danger" type="button" aria-label={`Delete the group ${g.name}`} onClick={() => onDelete(g)}>
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="workspace-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onAdd(name)) setName("");
        }}
      >
        <label htmlFor="new-group">New group</label>
        <div className="workspace-row">
          <input id="new-group" value={name} maxLength={60} placeholder="Choir, Leaders, Prayer team…" onChange={(e) => setName(e.target.value)} />
          <button type="submit" disabled={busy || !cleanGroupName(name)}>
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

function Members({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const { ask, dialog } = useConfirmation();
  const [people, setPeople] = useState<Person[] | "not-set-up" | { error: string } | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null); // null: 0008 not run yet, groups hidden
  const [links, setLinks] = useState<GroupLinks>(new Map());
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { records, error } = await pullWorkspace(supabase, workspace.id);
    if (error) return setPeople(syncNotSetUp(error) ? "not-set-up" : { error: userSafeError(error, "Couldn’t load the member list. Check your connection and try again.") });
    setPeople(
      (records as PulledRecord[])
        .filter((r) => r.kind === "member" && r.body && typeof r.body === "object")
        .map((r) => ({ ...draftOf(r.body as Partial<MemberBody>), ...(r.body as MemberBody), id: r.id, rev: r.rev })),
    );
    const g = await supabase.from("member_groups").select("id, name").eq("organization_id", workspace.id).order("name");
    if (g.error) {
      setGroups(null);
      if (!groupsNotSetUp(g.error)) setMessage({ ok: false, text: userSafeError(g.error, "Couldn’t load member groups. Try again.") });
      return;
    }
    setGroups(g.data as Group[]);
    const l = await supabase.from("member_group_members").select("group_id, member_id").eq("organization_id", workspace.id);
    const next: GroupLinks = new Map();
    for (const row of (l.data as { group_id: string; member_id: string }[] | null) ?? []) {
      if (!next.has(row.member_id)) next.set(row.member_id, new Set());
      next.get(row.member_id)!.add(row.group_id);
    }
    setLinks(next);
  }, [supabase, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const list = useMemo(() => (Array.isArray(people) ? people : []), [people]);
  const counts = useMemo(() => groupCounts(links, new Set(list.map((p) => p.id))), [links, list]);
  const shown = useMemo(() => inGroup(list, links, filter), [list, links, filter]);
  const groupName = useMemo(() => new Map((groups ?? []).map((g) => [g.id, g.name])), [groups]);

  if (!supabase) return null;
  if (people === null) return <PageSkeleton />;
  if (people === "not-set-up") return <NotSetUp />;
  if ("error" in people) return <ErrorState text={people.error} onRetry={load} />;

  async function saveGroupLinks(memberId: string, want: Set<string>) {
    if (!supabase || !groups) return null;
    const have = links.get(memberId) ?? new Set<string>();
    const add = [...want].filter((g) => !have.has(g)).map((g) => ({ organization_id: workspace.id, group_id: g, member_id: memberId }));
    const drop = [...have].filter((g) => !want.has(g));
    if (add.length) {
      const { error } = await supabase.from("member_group_members").insert(add);
      if (error) return userSafeError(error, "The member was saved, but its groups could not be updated.");
    }
    if (drop.length) {
      const { error } = await supabase.from("member_group_members").delete().eq("member_id", memberId).in("group_id", drop);
      if (error) return userSafeError(error, "The member was saved, but its groups could not be updated.");
    }
    return null;
  }

  async function save() {
    if (!supabase || !editing) return;
    const current = editing.id ? list.find((p) => p.id === editing.id) : undefined;
    const { body, errors } = memberBody(editing.id ?? "", editing.draft);
    if (errors.length) return setMessage({ ok: false, text: errors.join(" ") });
    setBusy(true);
    setMessage(null);
    const answer = await pushRecord(supabase, workspace.id, { kind: "member", id: body.id, rev: current?.rev ?? 0 }, body);
    if (answer.status !== "ok") {
      setBusy(false);
      if (answer.status === "conflict") {
        setEditing(null);
        await load();
        return setMessage({ ok: false, text: "Someone changed this person meanwhile (perhaps on the service PC). The latest version is shown; make your change again." });
      }
      return setMessage({ ok: false, text: answer.message });
    }
    const groupProblem = await saveGroupLinks(body.id, editing.groups);
    setBusy(false);
    setEditing(null);
    setMessage(
      groupProblem
        ? { ok: false, text: `${body.name} was saved, but the groups were not: ${groupProblem}` }
        : { ok: true, text: `${body.name} was ${current ? "saved" : "added"}. The service PC gets it at its next sync, usually within a minute.` },
    );
    await load();
  }

  async function remove(person: Person) {
    if (!supabase) return;
    if (!(await ask({
      title: `Remove ${person.name}?`,
      description: "They’ll be removed from the member list here and on the service PC. A copy stays in History for 30 days.",
      confirmLabel: "Remove person",
    }))) return;
    setBusy(true);
    const answer = await deleteRecord(supabase, workspace.id, { kind: "member", id: person.id, rev: person.rev });
    if (answer.status === "ok" && groups) await supabase.from("member_group_members").delete().eq("organization_id", workspace.id).eq("member_id", person.id);
    setBusy(false);
    if (answer.status === "ok") {
      setEditing(null);
      setMessage({ ok: true, text: `${person.name} was removed. The 30-day history keeps a copy.` });
    } else setMessage({ ok: false, text: answer.status === "conflict" ? "Someone changed this person meanwhile; nothing was removed." : answer.message });
    await load();
  }

  async function addGroup(raw: string) {
    if (!supabase) return false;
    const name = cleanGroupName(raw);
    if (!name) return false;
    const { error } = await supabase.from("member_groups").insert({ organization_id: workspace.id, name });
    if (error) {
      setMessage({ ok: false, text: error.code === "23505" ? `There is already a group called “${name}”.` : userSafeError(error, "Couldn’t add this group. Try again.") });
      return false;
    }
    await load();
    return true;
  }

  async function renameGroup(g: Group, raw: string) {
    if (!supabase) return false;
    const name = cleanGroupName(raw);
    if (!name) return false;
    const { error } = await supabase.from("member_groups").update({ name }).eq("id", g.id);
    if (error) {
      setMessage({ ok: false, text: error.code === "23505" ? `There is already a group called “${name}”.` : userSafeError(error, "Couldn’t rename this group. Try again.") });
      return false;
    }
    await load();
    return true;
  }

  async function deleteGroup(g: Group) {
    if (!supabase) return;
    if (!(await ask({
      title: `Delete the group “${g.name}”?`,
      description: "People in the group stay on the member list, but this group and its assignments are removed.",
      confirmLabel: "Delete group",
    }))) return;
    const { error } = await supabase.from("member_groups").delete().eq("id", g.id);
    if (error) setMessage({ ok: false, text: userSafeError(error, "Couldn’t delete this group. Try again.") });
    if (filter === g.id) setFilter("");
    await load();
  }

  const editingPerson = editing?.id ? list.find((p) => p.id === editing.id) : undefined;

  return (
    <>
      <p className="page-note">
        {list.length} member{list.length === 1 ? "" : "s"} in “{workspace.name}”. Only owners and admins can see this list.
        Changes made here reach the service PC at its next sync, and changes made on the PC come here.
      </p>
      <div className="members-tools">
        <button className="live-btn live-primary" type="button" onClick={() => setEditing({ id: null, draft: draftOf(null), groups: new Set(filter ? [filter] : []) })}>
          Add a member
        </button>
        {groups && (
          <>
            <label className="workspace-row members-filter">
              <span className="sr-only">Show</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show members of a group">
                <option value="">Everyone ({list.length})</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({counts.get(g.id) ?? 0})
                  </option>
                ))}
              </select>
            </label>
            <button className="member-action" type="button" aria-expanded={showGroups} onClick={() => setShowGroups(!showGroups)}>
              {showGroups ? "Hide groups" : "Manage groups"}
            </button>
          </>
        )}
      </div>
      {message && <p className={message.ok ? "page-note" : "page-note page-problem"}>{message.text}</p>}
      {groups && showGroups && (
        <GroupsManager groups={groups} counts={counts} busy={busy} onAdd={addGroup} onRename={renameGroup} onDelete={deleteGroup} />
      )}
      {editing && (
        <>
          <p className="section-title">{editingPerson ? `Editing ${editingPerson.name}` : "New member"}</p>
          <MemberForm
            editing={editing}
            groups={groups}
            busy={busy}
            onChange={setEditing}
            onSave={save}
            onCancel={() => setEditing(null)}
            onRemove={editingPerson ? () => remove(editingPerson) : null}
          />
        </>
      )}
      {list.length === 0 ? (
        <EmptyState title="No members yet">Add the first one here, or on the service PC.</EmptyState>
      ) : shown.length === 0 ? (
        <p className="page-note">Nobody is in this group yet. Edit a member to add them.</p>
      ) : (
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
                {groups && <th>Groups</th>}
                <th>
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                  <tr key={m.id} className={editing?.id === m.id ? "member-row-editing" : undefined}>
                    <td>{m.name}</td>
                    <td>{birthdayLabel(m.birthDate)}</td>
                    <td>{m.country}</td>
                    <td>{m.phone}</td>
                    <td>{m.email}</td>
                    <td>{m.role}</td>
                    {groups && (
                      <td>
                        {[...(links.get(m.id) ?? [])]
                          .map((g) => groupName.get(g))
                          .filter(Boolean)
                          .sort()
                          .join(", ")}
                      </td>
                    )}
                    <td>
                      <button
                        className="member-action"
                        type="button"
                        aria-label={`Edit ${m.name}`}
                        onClick={() => {
                          setEditing({ id: m.id, draft: draftOf(m), groups: new Set(links.get(m.id) ?? []) });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {!groups && <p className="workspace-hint">Member groups aren’t ready yet. Ask your workspace owner to finish setting them up.</p>}
      {dialog}
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
