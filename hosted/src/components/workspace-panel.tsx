"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { browserSupabase } from "@/lib/supabase-browser";
import type { Organization, Role } from "@/lib/supabase-config";
import { useSession } from "@/lib/use-session";

const NAME_LIMIT = 120;
const roleLabels: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" };

type Workspace = Pick<Organization, "id" | "name" | "created_at"> & { role: Role };
type MembershipRow = { role: Role; organizations: Pick<Organization, "id" | "name" | "created_at"> | null };

// The signed-in person's profile and workspaces. Row-level security decides what they can read and write.
export function WorkspacePanel() {
  const supabase = browserSupabase();
  const session = useSession();
  const userId = session?.user.id;

  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [busy, setBusy] = useState<"profile" | "workspace" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    const [memberships, profile] = await Promise.all([
      supabase
        .from("memberships")
        .select("role, organizations(id, name, created_at)")
        .eq("user_id", userId)
        .overrideTypes<MembershipRow[], { merge: false }>(),
      supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
    ]);
    if (memberships.error || profile.error) {
      setProblem((memberships.error ?? profile.error)?.message ?? "Could not load your workspace.");
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
          <Link href="/sign-in">Sign in</Link> to create your church&apos;s workspace.
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
    if (error) setProblem(error.message);
    else setNotice("Your name is saved.");
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
      setProblem(error.message);
      return;
    }
    setWorkspaceName("");
    setNotice(`“${name}” is created. You are its owner.`);
    await load();
  }

  return (
    <section className="workspace-grid" aria-label="Your workspace">
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
              placeholder="e.g. Pastor John"
            />
            <Button disabled={busy !== null} type="submit" variant="outline">
              {busy === "profile" ? "Saving…" : "Save"}
            </Button>
          </div>
          <p className="workspace-hint">Signed in as {session.user.email}. Only you can see your profile.</p>
        </form>
      </article>

      <article className="workspace-card">
        <header>
          <Building2 aria-hidden="true" size={18} />
          <h2>Your workspaces</h2>
        </header>
        {workspaces === null ? (
          <p className="workspace-hint">Loading…</p>
        ) : workspaces.length === 0 ? (
          <p className="workspace-hint">No workspace yet. Create one for your church or ministry.</p>
        ) : (
          <ul className="workspace-list">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <span className="workspace-name">{workspace.name}</span>
                <span className="workspace-role">{roleLabels[workspace.role]}</span>
              </li>
            ))}
          </ul>
        )}
        <form className="workspace-form" onSubmit={createWorkspace}>
          <label htmlFor="workspace-name">New workspace</label>
          <div className="workspace-row">
            <input
              id="workspace-name"
              maxLength={NAME_LIMIT}
              required
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="e.g. Grace Church"
            />
            <Button disabled={busy !== null || !workspaceName.trim()} type="submit" variant="outline">
              {busy === "workspace" ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </article>

      {(notice || problem) && (
        <p className={problem ? "workspace-problem" : "workspace-notice"} role={problem ? "alert" : "status"}>
          {problem ?? notice}
        </p>
      )}
    </section>
  );
}
