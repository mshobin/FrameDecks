"use client";

import "@/app/devices.css"; // 9.8 loaded only with these components

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Laptop, ShieldCheck } from "lucide-react";

import { useConfirmation } from "@/components/confirm-dialog";
import { ListSkeleton } from "@/components/states";
import { When } from "@/components/when";
import { shortDate } from "@/lib/when";
import { browserSupabase } from "@/lib/supabase-browser";
import { clearTrust, readTrust } from "@/lib/trusted-device";
import { signOutAndLeave } from "@/lib/sign-out";
import { useSession } from "@/lib/use-session";
import { userSafeError } from "@/lib/user-error";

type Device = { id: string; name: string; trusted_at: string; last_seen_at: string; expires_at: string; current: boolean };
type Event = { action: string; device_name: string | null; at: string };

const EVENT_WORDS: Record<string, string> = {
  "link.requested": "Link asked for",
  "link.used": "Link opened",
  "device.trusted": "Device trusted",
  "device.revoked": "Device removed",
  "device.expired": "Device trust ended (180 days)",
};

/** 9.8 Manage Devices: the Trusted Devices of this workspace member, removing one (its access ends at once), the
 * recent security activity, and Continue on Another Device. */
export function DevicesPanel() {
  const supabase = browserSupabase();
  const session = useSession();
  const { ask, dialog } = useConfirmation();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const mine = readTrust();

  const load = useCallback(async () => {
    if (!supabase || !session) return;
    const [d, e] = await Promise.all([supabase.rpc("device_list"), supabase.rpc("security_event_list", { max_rows: 30 })]);
    if (d.error) {
      setProblem(userSafeError(d.error, "Couldn’t load your devices. Check your connection and try again."));
      setDevices([]);
      return;
    }
    setDevices((d.data ?? []) as Device[]);
    setEvents(e.error ? [] : ((e.data ?? []) as Event[]));
  }, [session, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(device: Device) {
    if (!supabase) return;
    const here = device.current || device.id === mine?.id;
    const ok = await ask({
      title: `Remove “${device.name}”?`,
      description: here
        ? "This device stops being trusted and leaves your workspace now. To come back, open your workspace again."
        : "That device loses access to your workspace at once. To use it again, open your workspace on it.",
      confirmLabel: "Remove device",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.rpc("device_revoke", { device: device.id });
    if (error) {
      setProblem(userSafeError(error, "Couldn’t remove that device. Try again."));
      return;
    }
    if (here) {
      clearTrust();
      await signOutAndLeave(supabase, (url) => window.location.assign(url));
      return;
    }
    load();
  }

  if (!supabase || !session) return null;
  const continueUrl = `${window.location.origin}/sync?intent=continue&email=${encodeURIComponent(session.user.email ?? "")}`;
  return (
    <>
      {dialog}
      <section className="workspace-card" aria-labelledby="devices-title">
        <h2 id="devices-title" className="device-title">
          <ShieldCheck aria-hidden="true" size={18} /> Trusted Devices
        </h2>
        <p className="page-note">
          A Trusted Device opens your workspace with no new link for 180 days, then asks for one link again. Remove a device
          you no longer use, or one you lost: it loses access at once.
        </p>
        {problem && (
          <p className="workspace-problem" role="alert">
            {problem}
          </p>
        )}
        {devices === null ? (
          <ListSkeleton />
        ) : devices.length === 0 ? (
          <p className="workspace-hint">No Trusted Devices yet. After the next link, choose Trust This Device.</p>
        ) : (
          <ul className="device-list">
            {devices.map((d) => (
              <li key={d.id} className="device-row">
                <Laptop aria-hidden="true" size={18} />
                <div className="device-text">
                  <strong>
                    {d.name}
                    {(d.current || d.id === mine?.id) && <span className="device-here"> · This device</span>}
                  </strong>
                  <small>
                    Trusted <When at={d.trusted_at} /> · last used <When at={d.last_seen_at} /> · trusted until {shortDate(d.expires_at)}
                  </small>
                </div>
                <button type="button" className="member-action member-danger" onClick={() => remove(d)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="workspace-card" aria-labelledby="pcs-title">
        <h2 id="pcs-title" className="device-title">
          Service PCs
        </h2>
        <p className="page-note">
          FrameDecks on a PC is linked once (on the PC: Settings → Workspace Sync → Connect to FrameDecks) and then stays in
          sync by itself, with no link and nothing to repeat. See or remove linked PCs on{" "}
          <Link href="/computers">Service PCs</Link>.
        </p>
      </section>

      <section className="workspace-card" aria-labelledby="continue-title">
        <h2 id="continue-title" className="device-title">
          Continue on Another Device
        </h2>
        <p className="page-note">
          On your phone, tablet or another computer, open this address and enter <strong>{session.user.email}</strong>. The
          link we send opens your workspace there.
        </p>
        <div className="workspace-row">
          <input className="device-url" readOnly value={continueUrl} aria-label="Address to open on the other device" onFocus={(e) => e.target.select()} />
          <button
            type="button"
            className="fd-btn fd-btn-ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(continueUrl);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </section>

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
        <p className="page-note">Kept for one year. Owners and admins also see device changes and syncs in the workspace log.</p>
      </section>
    </>
  );
}
