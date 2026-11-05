"use client";

import "@/app/devices.css"; // 9.8 loaded only with these components

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { browserSupabase } from "@/lib/supabase-browser";
import {
  clearTrust,
  deviceName,
  isLegacyKeep,
  markDecided,
  moveSession,
  readTrust,
  writeTrust,
  type DeviceStatus,
} from "@/lib/trusted-device";
import { clearLocalSession } from "@/lib/sign-out";
import { useSession } from "@/lib/use-session";
import { userSafeError } from "@/lib/user-error";

const ASKED_KEY = "fd-trust-asked";          // this tab: "Just this visit" was chosen
const CHECK_EVERY_MS = 60_000;

/** At every start (and when the window comes back, at most once a minute) a trusted device checks its token. A removed
 * device, or one trusted 180 days ago, forgets the session here and goes to Open Workspace. */
export function TrustedDeviceGuard() {
  const session = useSession();
  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase || !session) return;
    let last = 0;
    let gone = false;
    async function check() {
      const trust = readTrust();
      if (!trust || gone || Date.now() - last < CHECK_EVERY_MS) return;
      last = Date.now();
      const { data, error } = await supabase!.rpc("device_check", { token: trust.token });
      if (error) return;                                   // offline or before 0015: try again later
      const status = data as DeviceStatus;
      if (status === "unknown") {                          // another person's token on a shared browser: just forget it
        clearTrust();
        return;
      }
      if (status === "revoked" || status === "expired") {
        gone = true;
        clearTrust();
        await supabase!.auth.signOut({ scope: "local" }).catch(() => undefined);
        try {
          clearLocalSession(localStorage);
          clearLocalSession(sessionStorage);
        } catch {
          /* storage blocked */
        }
        window.location.replace(`/sync?reason=${status}`);
      }
    }
    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [session]);
  return null;
}

/** After the link: "Trust This Device". Trusted, the workspace opens here for 180 days with no new link. "Just this
 * visit" keeps it in this tab only. Shown once per tab until chosen. */
export function TrustPrompt() {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let asked = false;
    try {
      asked = sessionStorage.getItem(ASKED_KEY) === "1";
    } catch {
      asked = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!readTrust() && !asked);
    setName(deviceName());
  }, [session]);

  const trust = useCallback(async () => {
    const supabase = browserSupabase();
    if (!supabase) return;
    setBusy(true);
    setProblem(null);
    const { data, error } = await supabase.rpc("trust_device", { device_name: name.trim() || deviceName() });
    setBusy(false);
    if (error || !data?.token) {
      setProblem(userSafeError(error, "Couldn’t trust this device. Check your connection and try again."));
      return;
    }
    writeTrust({ token: data.token, id: data.id, name: name.trim() || deviceName(), expiresAt: data.expires_at });
    moveSession(true);
    setOpen(false);
  }, [name]);

  const justThisVisit = useCallback(() => {
    try {
      sessionStorage.setItem(ASKED_KEY, "1");
    } catch {
      /* storage blocked */
    }
    if (isLegacyKeep()) {
      markDecided();
      moveSession(false);                                  // an earlier version kept it on the device: now this tab only
    }
    setOpen(false);
  }, []);

  if (!open || !session) return null;
  return (
    <section className="fd-trust" aria-labelledby="fd-trust-title">
      <ShieldCheck aria-hidden="true" size={22} className="fd-trust-icon" />
      <div className="fd-trust-text">
        <h2 id="fd-trust-title">Trust This Device?</h2>
        <p>
          Keep your workspace open here, with no new link, for 180 days. Only on a device you use yourself. You can remove
          it any time in Manage Devices.
        </p>
        <label className="fd-trust-name">
          <span>Device name</span>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        {problem && (
          <p className="workspace-problem" role="alert">
            {problem}
          </p>
        )}
      </div>
      <div className="fd-trust-actions">
        <button type="button" className="fd-btn fd-btn-primary" disabled={busy} onClick={trust}>
          {busy ? "Trusting…" : "Trust This Device"}
        </button>
        <button type="button" className="fd-btn fd-btn-ghost" onClick={justThisVisit}>
          Just this visit
        </button>
      </div>
    </section>
  );
}
