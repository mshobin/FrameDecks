"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { NotSetUp, WorkspaceGate } from "@/components/workspace-gate";
import { When } from "@/components/when";
import { browserSupabase } from "@/lib/supabase-browser";
import { useConfirmation } from "@/components/confirm-dialog";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { syncNotSetUp } from "@/lib/workspace-sync";
import { ListSkeleton } from "@/components/states";
import { userSafeError } from "@/lib/user-error";

type Computer = { id: string; name: string; created_at: string; last_seen_at: string | null; revoked_at: string | null };


function Computers({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const [computers, setComputers] = useState<Computer[] | "not-set-up" | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const { ask, dialog } = useConfirmation();

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("computers")
      .select("id, name, created_at, last_seen_at, revoked_at")
      .eq("organization_id", workspace.id)
      .order("created_at");
    if (error) {
      if (syncNotSetUp(error)) setComputers("not-set-up");
      else setMessage({ ok: false, text: userSafeError(error, "Couldn’t load linked PCs. Check your connection and try again.") });
      return;
    }
    setComputers((data as Computer[]) ?? []);
  }, [supabase, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!supabase) return null;
  if (computers === "not-set-up") return <NotSetUp />;

  async function link(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const typed = code.replace(/\s+/g, "").toUpperCase();
    if (typed.length !== 8) {
      setMessage({ ok: false, text: "The code has 8 letters and numbers, as shown on the PC." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("computer_link_approve", { code: typed, org: workspace.id });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: syncNotSetUp(error) ? "Workspace syncing isn’t ready yet. Ask your workspace owner to finish setting it up." : userSafeError(error, "Couldn’t link this PC. Check the code and try again.") });
      return;
    }
    setCode("");
    setMessage({ ok: true, text: `Linked. The PC shows “Linked to ${workspace.name}” within a few seconds and starts syncing.` });
    await load();
  }

  async function disconnect(computer: Computer) {
    if (!supabase) return;
    if (!(await ask({
      title: `Disconnect “${computer.name}”?`,
      description: "It stops syncing at once. The service plan stays on that PC.",
      confirmLabel: "Disconnect",
    }))) return;
    const { error } = await supabase.rpc("computer_revoke", { computer: computer.id });
    if (error) setMessage({ ok: false, text: userSafeError(error, "Couldn’t disconnect this PC. Try again.") });
    await load();
  }

  const active = computers?.filter((c) => !c.revoked_at) ?? [];
  const past = computers?.filter((c) => c.revoked_at) ?? [];
  return (
    <div className="computers">
      <article className="workspace-card">
        <header>
          <h2>Link a PC</h2>
        </header>
        <p className="workspace-hint">
          On the service PC: Settings → FrameDecks account → Connect to FrameDecks. Its browser opens and asks you to allow it. No browser there? Type the code the PC shows instead.
        </p>
        <form className="workspace-form" onSubmit={link}>
          <label htmlFor="link-code">Code from the PC</label>
          <div className="workspace-row">
            <input
              id="link-code"
              className="code-input"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={9}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="K7PM 2XQ9"
            />
            <Button disabled={busy || !code.trim()} type="submit" variant="outline">
              {busy ? "Linking…" : "Link"}
            </Button>
          </div>
        </form>
        {message && (
          <p className={message.ok ? "workspace-notice" : "workspace-problem"} role={message.ok ? "status" : "alert"}>
            {message.text}
          </p>
        )}
      </article>

      <article className="workspace-card">
        <header>
          <h2>Linked PCs</h2>
        </header>
        {computers === null ? (
          <ListSkeleton />
        ) : active.length === 0 ? (
          <p className="workspace-hint">No PC is linked to “{workspace.name}” yet.</p>
        ) : (
          <ul className="members-list">
            {active.map((c) => (
              <li key={c.id}>
                <span className="member-who">
                  <strong>{c.name}</strong>
                  <span>Linked <When at={c.created_at} /> · last synced <When at={c.last_seen_at} fallback="not yet" /></span>
                </span>
                <button className="member-action member-danger" type="button" aria-label={`Disconnect ${c.name}`} onClick={() => disconnect(c)}>
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <p className="workspace-hint">
            Disconnected: {past.map((c) => c.name).join(", ")}.
          </p>
        )}
      </article>
      {dialog}
    </div>
  );
}

export function ComputersPanel() {
  return (
    <WorkspaceGate adminOnly what="the linked computers">
      {(w) => <Computers key={w.id} workspace={w} />}
    </WorkspaceGate>
  );
}
