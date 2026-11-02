"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { legalNotSetUp } from "@/lib/legal";
import { signOutAndLeave } from "@/lib/sign-out";
import { browserSupabase } from "@/lib/supabase-browser";
import { useWorkspaces } from "@/lib/use-workspaces";
import { userSafeError } from "@/lib/user-error";
import { pullWorkspace } from "@/lib/workspace-sync";

// Your account → Your data (7.0; docs/legal/privacy.md "Your rights"): one JSON file with everything kept about you
// and the workspace records you can see, and deleting your account (0011_accounts_legal.sql delete_my_account).

function save(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AccountData() {
  const supabase = browserSupabase();
  const { workspaces } = useWorkspaces();
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  async function exportData() {
    if (!supabase) return;
    setBusy("export");
    setMessage(null);
    const mine = await supabase.rpc("export_my_data");
    if (mine.error && !legalNotSetUp(mine.error)) {
      setBusy(null);
      setMessage({
        ok: false,
        text: userSafeError(
          mine.error,
          "Couldn’t prepare your data. Check your connection and try again.",
        ),
      });
      return;
    }
    const records: Record<string, unknown> = {};
    for (const w of workspaces ?? []) {
      const pulled = await pullWorkspace(supabase, w.id);
      records[w.name] = { role: w.role, records: pulled.records };
    }
    save(`framedecks-data-${new Date().toISOString().slice(0, 10)}.json`, {
      you: mine.data ?? null,
      workspaceRecords: records,
    });
    setBusy(null);
    setMessage({
      ok: true,
      text: "Your file is downloading. It holds your account, your workspaces and their records.",
    });
  }

  async function deleteAccount() {
    if (!supabase || typed.trim().toUpperCase() !== "DELETE") return;
    setBusy("delete");
    setMessage(null);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(null);
      const text = legalNotSetUp(error)
        ? "Deleting accounts is not switched on yet. Write to privacy@framedecks.com and it is done within 30 days."
        : error.message?.startsWith("Make someone else an owner")
          ? `${error.message}. Open that workspace's People page, make someone else an owner, then try again.`
          : userSafeError(
              error,
              "Couldn’t delete your account. Try again, or write to privacy@framedecks.com.",
            );
      setMessage({ ok: false, text });
      return;
    }
    await signOutAndLeave(supabase);
  }

  return (
    <section
      className="workspace-card fd-account-data"
      aria-labelledby="fd-data-title"
    >
      <header>
        <h2 id="fd-data-title">Your data</h2>
      </header>
      <p className="workspace-hint">
        Download everything FrameDecks keeps about you, or delete your account.
        Your presentations on your PC are never affected. See the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <div className="workspace-row">
        <Button
          variant="outline"
          type="button"
          onClick={exportData}
          disabled={busy !== null}
        >
          <Download aria-hidden="true" size={16} />{" "}
          {busy === "export" ? "Preparing…" : "Download my data"}
        </Button>
        {!confirming && (
          <Button
            variant="outline"
            className="fd-danger"
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy !== null}
          >
            <Trash2 aria-hidden="true" size={16} /> Delete my account
          </Button>
        )}
      </div>
      {confirming && (
        <div
          className="fd-delete-confirm"
          role="group"
          aria-labelledby="fd-delete-title"
        >
          <p id="fd-delete-title">
            <strong>Delete your account for good?</strong> You leave every
            workspace; a workspace with nobody else in it is deleted with your
            account. This cannot be undone. Type <b>DELETE</b> to confirm.
          </p>
          <div className="workspace-row">
            <label className="sr-only" htmlFor="fd-delete-typed">
              Type DELETE to confirm
            </label>
            <input
              id="fd-delete-typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              placeholder="DELETE"
            />
            <Button
              className="fd-danger-solid"
              type="button"
              onClick={deleteAccount}
              disabled={
                busy !== null || typed.trim().toUpperCase() !== "DELETE"
              }
            >
              {busy === "delete" ? "Deleting…" : "Delete my account"}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setConfirming(false);
                setTyped("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {message && (
        <p
          className={message.ok ? "workspace-notice" : "workspace-problem"}
          role={message.ok ? "status" : "alert"}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
