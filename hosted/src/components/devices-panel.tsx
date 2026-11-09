"use client";

import "@/app/devices.css"; // 9.8 loaded only with these components

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KeyRound, Laptop, Monitor, Smartphone, UserPlus } from "lucide-react";

import { useConfirmation } from "@/components/confirm-dialog";
import { CodeStopped, JoinCodeCard, useRotatingCode } from "@/components/join-code-card";
import { ListSkeleton } from "@/components/states";
import { When } from "@/components/when";
import { WorkspaceGate } from "@/components/workspace-gate";
import { canRemove, highestRole, joinUrl, ROLE_WORDS, rolesICanGive, type DeviceRole, type JoinRole } from "@/lib/join-code";
import { signOutAndLeave } from "@/lib/sign-out";
import { browserSupabase, callbackUrl } from "@/lib/supabase-browser";
import { clearTrust, readTrust } from "@/lib/trusted-device";
import { useSession } from "@/lib/use-session";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { userSafeError } from "@/lib/user-error";
import { syncNotSetUp } from "@/lib/workspace-sync";

type Row = { kind: "person" | "pc"; id: string; name: string; role: DeviceRole; is_me: boolean; last_seen_at: string | null; joined_at: string };
type Event = { action: string; device_name: string | null; at: string };
type Browser = { id: string; name: string; last_seen_at: string; current: boolean };
type Recovery = { hasCode: boolean; codeMadeAt: string | null; ownerHasEmail: boolean; iAmOwner: boolean };

const EVENT_WORDS: Record<string, string> = {
  "link.requested": "Email link asked for",
  "link.used": "Email link opened",
  "device.trusted": "Device kept",
  "device.revoked": "Device removed",
  "device.expired": "Device trust ended (180 days)",
  joined: "Joined a team",
  removed: "Removed from a team",
  "team.recovered": "Team recovered with the recovery code",
};

const roleWord = (r: JoinRole) => (r === "admin" ? "an Admin" : "a Helper");

/** 26.11.12 Devices: one list per team, people's devices and the church PCs, with Remove; Add a device and Invite
 * someone (a QR code that lasts 2 minutes); the owner's recovery code and emergency email; recent activity. */
export function DevicesPanel() {
  return <WorkspaceGate what="your team’s devices">{(w) => <Devices key={w.id} workspace={w} />}</WorkspaceGate>;
}

function Devices({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const session = useSession();
  const { ask, dialog } = useConfirmation();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [browsers, setBrowsers] = useState<Browser[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [showing, setShowing] = useState<"add" | "invite" | null>(null);
  const [inviteRole, setInviteRole] = useState<JoinRole>("member");
  const myRole = workspace.role;
  const giving = rolesICanGive(myRole);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [d, e, b] = await Promise.all([
      supabase.rpc("workspace_devices", { org: workspace.id }),
      supabase.rpc("security_event_list", { max_rows: 30 }),
      supabase.rpc("device_list"),
    ]);
    if (d.error) {
      setProblem(
        syncNotSetUp(d.error as { code?: string; message?: string } | null)
          ? "Joining with codes isn’t ready yet. Ask your workspace owner to finish setting it up. (FD-CLD-04)"
          : userSafeError(d.error, "Couldn’t load the devices. Check the internet connection and try again. (FD-CLD-05)"),
      );
      setRows([]);
      return;
    }
    setRows((d.data ?? []) as Row[]);
    setEvents(e.error ? [] : ((e.data ?? []) as Event[]));
    setBrowsers(b.error ? [] : ((b.data ?? []) as Browser[]));
  }, [supabase, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(row: Row) {
    if (!supabase) return;
    const pc = row.kind === "pc";
    const ok = await ask({
      title: row.is_me ? `Remove this device from “${workspace.name}”?` : `Remove “${row.name}”?`,
      description: pc
        ? "The PC stops syncing at once. Its service plan stays on the PC. To connect it again, scan its code with a phone that’s in your team."
        : row.is_me
          ? "This device leaves the team now and stops syncing. To come back, someone in the team adds it again."
          : "It loses access to your team at once. To come back, someone in the team adds it again.",
      confirmLabel: pc ? "Remove PC" : "Remove device",
      tone: "danger",
      confirmationText: row.name,
      confirmationLabel: `Type “${row.name}” to confirm`,
    });
    if (!ok) return;
    const { error } = pc
      ? await supabase.rpc("computer_revoke", { computer: row.id })
      : await supabase.rpc("device_remove", { org: workspace.id, person: row.id });
    if (error) {
      setProblem(userSafeError(error, "Couldn’t remove that device. Try again."));
      return;
    }
    if (row.is_me) {
      const left = await supabase.from("memberships").select("organization_id", { count: "exact", head: true }).eq("user_id", row.id);
      if (!left.error && (left.count ?? 0) > 0) {
        window.location.replace("/");
        return;
      }
      clearTrust();
      await signOutAndLeave(supabase);
      return;
    }
    load();
  }

  async function forgetBrowser(b: Browser) {
    if (!supabase) return;
    const here = b.current || b.id === readTrust()?.id;
    if (!(await ask({
      title: `Forget “${b.name}”?`,
      description: "That browser stops opening your workspace with no new link, at once.",
      confirmLabel: "Forget browser",
      tone: "danger",
    }))) return;
    const { error } = await supabase.rpc("device_revoke", { device: b.id });
    if (error) return setProblem(userSafeError(error, "Couldn’t forget that browser. Try again."));
    if (here) {
      clearTrust();
      await signOutAndLeave(supabase);
      return;
    }
    load();
  }

  if (!supabase || !session) return null;
  return (
    <>
      {dialog}
      {giving.length > 0 ? (
        <section className="workspace-card" aria-labelledby="add-title">
          <h2 id="add-title" className="device-title">
            <UserPlus aria-hidden="true" size={18} /> Add to {workspace.name}
          </h2>
          <p className="page-note">
            A phone or computer joins by scanning a code. No email and nothing to remember: it stays in sync by itself.
          </p>
          <div className="jc-actions">
            <button type="button" className="fd-btn fd-btn-primary" aria-expanded={showing === "add"} onClick={() => setShowing(showing === "add" ? null : "add")}>
              Add a device
            </button>
            <button
              type="button"
              className="fd-btn fd-btn-glass"
              aria-expanded={showing === "invite"}
              onClick={() => setShowing(showing === "invite" ? null : "invite")}
            >
              Invite someone
            </button>
            <Link className="fd-link" href="/allow">
              A new browser shows a code? Allow it
            </Link>
          </div>
          {showing === "invite" && giving.length > 1 && (
            <fieldset className="jc-roles device-invite-role">
              <legend>They join as</legend>
              <label>
                <input type="radio" name="invite-role" checked={inviteRole === "member"} onChange={() => setInviteRole("member")} /> Helper
              </label>
              <label>
                <input type="radio" name="invite-role" checked={inviteRole === "admin"} onChange={() => setInviteRole("admin")} /> Admin
              </label>
            </fieldset>
          )}
          {showing && (
            <InviteCode
              key={`${showing}-${showing === "add" ? "top" : inviteRole}`}
              org={workspace.id}
              team={workspace.name}
              role={showing === "add" ? (highestRole(myRole) as JoinRole) : giving.includes(inviteRole) ? inviteRole : "member"}
              forSomeone={showing === "invite"}
              onDone={() => {
                setShowing(null);
                load();
              }}
            />
          )}
        </section>
      ) : (
        <p className="page-note">Ask your team’s owner or an admin to add a new device.</p>
      )}

      <section className="workspace-card" aria-labelledby="devices-title">
        <h2 id="devices-title" className="device-title">
          Devices in {workspace.name}
        </h2>
        {problem && (
          <p className="workspace-problem" role="alert">
            {problem}
          </p>
        )}
        {rows === null ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <p className="workspace-hint">No devices yet.</p>
        ) : (
          <ul className="device-list">
            {rows.map((r) => {
              const Icon = r.kind === "pc" ? Monitor : Smartphone;
              return (
                <li key={`${r.kind}-${r.id}`} className="device-row">
                  <Icon aria-hidden="true" size={18} />
                  <div className="device-text">
                    <strong>
                      {r.name}
                      {r.is_me && <span className="device-here"> · This device</span>}
                    </strong>
                    <small>
                      {r.last_seen_at ? (
                        <>
                          Last seen <When at={r.last_seen_at} />
                        </>
                      ) : r.kind === "pc" ? (
                        "Waiting for the PC to confirm: open FrameDecks on it (FD-CLD-03)"
                      ) : (
                        <>
                          Joined <When at={r.joined_at} />
                        </>
                      )}
                    </small>
                  </div>
                  <span className="workspace-role">{ROLE_WORDS[r.role] ?? r.role}</span>
                  {canRemove(myRole, r) ? (
                    <button type="button" className="member-action member-danger" aria-label={`Remove ${r.name}`} onClick={() => remove(r)}>
                      Remove
                    </button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {myRole === "owner" && <RecoveryCard org={workspace.id} team={workspace.name} ask={ask} />}

      {browsers.length > 0 && session.user.email && (
        <section className="workspace-card" aria-labelledby="browsers-title">
          <h2 id="browsers-title" className="device-title">
            Browsers opened with your email
          </h2>
          <ul className="device-list">
            {browsers.map((b) => (
              <li key={b.id} className="device-row">
                <Laptop aria-hidden="true" size={18} />
                <div className="device-text">
                  <strong>
                    {b.name}
                    {(b.current || b.id === readTrust()?.id) && <span className="device-here"> · This device</span>}
                  </strong>
                  <small>
                    Last used <When at={b.last_seen_at} />
                  </small>
                </div>
                <span aria-hidden="true" />
                <button type="button" className="member-action member-danger" aria-label={`Forget ${b.name}`} onClick={() => forgetBrowser(b)}>
                  Forget
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="workspace-card" aria-labelledby="activity-title">
        <h2 id="activity-title" className="device-title">
          Recent activity
        </h2>
        {events.length === 0 ? (
          <p className="workspace-hint">Nothing yet.</p>
        ) : (
          <ul className="device-events">
            {events.map((e, i) => (
              <li key={i}>
                <span>{EVENT_WORDS[e.action] ?? e.action}</span>
                {e.device_name && <span className="device-ev-name"> · {e.device_name}</span>}
                <span className="device-ev-when">
                  <When at={e.at} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="page-note">Kept for one year. Owners and admins also see device changes and syncs in the team’s log.</p>
      </section>
    </>
  );
}

/** Add a device / Invite someone: a 2-minute code, made again by itself when it runs out. */
function InviteCode({
  org,
  team,
  role,
  forSomeone,
  onDone,
}: Readonly<{ org: string; team: string; role: JoinRole; forSomeone: boolean; onDone: () => void }>) {
  const supabase = browserSupabase();
  const [who, setWho] = useState<string | null>(null);
  const make = useCallback(async () => {
    if (!supabase) return "Workspace sync is not set up for this site yet.";
    // 26.11.26 Add a device: the phone signs in as you (no guest account); an invite when that isn't possible
    if (!forSomeone) {
      const self = await supabase.rpc("device_code_create", { org });
      if (!self.error && self.data?.code) {
        setWho(self.data.who ?? "you");
        return self.data as { code: string; expiresAt: string };
      }
    }
    const { data, error } = await supabase.rpc("invite_create", { org, wanted: role });
    if (error) return userSafeError(error, "Couldn’t make a code. Check your connection and try again.");
    return data as { code: string; expiresAt: string };
  }, [supabase, org, role, forSomeone]);
  const rotating = useRotatingCode(make, 2 * 60_000, true);
  const host = typeof window === "undefined" ? "" : window.location.host;
  return (
    <div className="device-invite">
      <p className="jc-note">
        {forSomeone
          ? `Show this to the person you’re inviting. They scan it with their phone’s camera and join ${team} as ${roleWord(role)}.`
          : who
            ? `On your phone or tablet, open the camera and scan this code. It opens your workspace as ${who}: nothing to type, nothing to remember.`
            : `On the new phone or tablet, open the camera and scan this code. It joins ${team} as ${roleWord(role)}.`}
      </p>
      {rotating.stopped || rotating.problem ? (
        <CodeStopped problem={rotating.problem} onAgain={rotating.again} />
      ) : rotating.code ? (
        <JoinCodeCard
          url={joinUrl(window.location.origin, rotating.code)}
          code={rotating.code}
          left={rotating.left}
          fresh={rotating.fresh}
          qrLabel={`QR code to join ${team}. Scan it with the new device’s camera.`}
          typeHint={`No camera? Open ${host}/join on it and type`}
        />
      ) : (
        <ListSkeleton rows={1} />
      )}
      <button type="button" className="fd-btn fd-btn-glass fd-btn-sm" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

/** Owner only: the printed recovery code (shown once, replaces the last one) and the emergency email. */
function RecoveryCard({ org, team, ask }: Readonly<{ org: string; team: string; ask: ReturnType<typeof useConfirmation>["ask"] }>) {
  const supabase = browserSupabase();
  const session = useSession();
  const [status, setStatus] = useState<Recovery | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("recovery_status", { org });
    if (!error) setStatus(data as Recovery);
  }, [supabase, org]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!supabase || !session || !status?.iAmOwner) return null;

  async function makeCode() {
    if (!supabase) return;
    if (status?.hasCode && !(await ask({
      title: "Make a new recovery code?",
      description: "The old recovery code stops working at once. Print or save the new one.",
      confirmLabel: "Make a new code",
      tone: "primary",
    }))) return;
    setBusy(true);
    setProblem(null);
    const { data, error } = await supabase.rpc("recovery_code_create", { org });
    setBusy(false);
    if (error) return setProblem(userSafeError(error, "Couldn’t make a recovery code. Try again."));
    setCode(String(data));
    setCopied(false);
    load();
  }

  async function addEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const address = email.trim();
    setBusy(true);
    setProblem(null);
    const { error } = await supabase.auth.updateUser({ email: address }, { emailRedirectTo: callbackUrl() });
    setBusy(false);
    if (error) return setProblem(userSafeError(error, "Couldn’t save that email. Check the address and try again."));
    setSentTo(address);
  }

  const mine = session.user.email;
  const waiting = sentTo ?? session.user.new_email;
  return (
    <section className="workspace-card" aria-labelledby="recovery-title">
      <h2 id="recovery-title" className="device-title">
        <KeyRound aria-hidden="true" size={18} /> Recovery
      </h2>
      <p className="page-note">
        If every device is lost, a recovery code gets {team} back on a new phone: on framedecks.com choose Open Workspace, then
        Use your recovery code. Only you, the owner, can make one.
      </p>
      {code ? (
        <div className="jc-recovery" role="status">
          <p className="jc-label">Recovery code for {team}</p>
          <p className="jc-code">{code}</p>
          <p className="jc-note">Shown only this once. Keep it somewhere safe, away from your devices. It works once.</p>
          <div className="jc-actions device-recovery-actions">
            <button type="button" className="fd-btn fd-btn-primary fd-btn-sm" onClick={() => window.print()}>
              Print
            </button>
            <button
              type="button"
              className="fd-btn fd-btn-glass fd-btn-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" className="fd-link" onClick={() => setCode(null)}>
              I’ve kept it safe
            </button>
          </div>
        </div>
      ) : (
        <div className="jc-actions">
          <button type="button" className="fd-btn fd-btn-glass" disabled={busy} onClick={makeCode}>
            {status.hasCode ? "Make a new recovery code" : "Make a recovery code"}
          </button>
          <span className="workspace-hint">
            {status.hasCode ? (
              <>
                The current code was made <When at={status.codeMadeAt} />. A new one replaces it.
              </>
            ) : (
              "No recovery code yet."
            )}
          </span>
        </div>
      )}

      <h3 className="device-sub">Emergency email</h3>
      {mine ? (
        <p className="workspace-hint">
          Set to <strong>{mine}</strong>. If you lose every device, Open Workspace → Use an email code instead opens your team with it.
        </p>
      ) : waiting ? (
        <p className="workspace-notice" role="status">
          We sent a confirmation to <strong>{waiting}</strong>. Open it to finish; until then, nothing changes.
        </p>
      ) : (
        <form className="workspace-form" onSubmit={addEmail}>
          <label htmlFor="emergency-email">
            Optional. If every device is lost, an email code opens your team again{status.ownerHasEmail ? "" : " (none set yet)"}.
          </label>
          <div className="workspace-row">
            <input id="emergency-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.org" />
            <button type="submit" disabled={busy || !email.trim()}>
              Add email
            </button>
          </div>
        </form>
      )}
      {problem && (
        <p className="workspace-problem" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}
