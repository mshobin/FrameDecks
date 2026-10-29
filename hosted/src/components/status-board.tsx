"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";

import { UPDATE_API } from "@/lib/releases";
import { publicSupabaseEnv, readSupabaseConfig } from "@/lib/supabase-config";

// framedecks.com/status (7.0): each service is checked from this browser, now. The program on a PC keeps presenting
// whatever this page shows; only planning together, sync and updates need these services.
type State = "checking" | "up" | "down";

async function reachable(
  url: string,
  init: RequestInit = {},
): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: ctl.signal,
    });
    return init.mode === "no-cors" || r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function StatusBoard() {
  const [states, setStates] = useState<Record<string, State>>({
    site: "up",
    account: "checking",
    updates: "checking",
    downloads: "checking",
  });
  const [at, setAt] = useState("");

  useEffect(() => {
    const cfg = readSupabaseConfig(publicSupabaseEnv());
    const set = (k: string, ok: boolean) =>
      setStates((s) => ({ ...s, [k]: ok ? "up" : "down" }));
    void (
      cfg
        ? reachable(`${cfg.url}/auth/v1/health`, {
            headers: { apikey: cfg.anonKey },
          })
        : Promise.resolve(false)
    ).then((ok) => set("account", ok));
    void reachable(`${UPDATE_API}/health`).then((ok) => set("updates", ok));
    void reachable("https://downloads.framedecks.com/releases/latest.json", {
      mode: "no-cors",
    }).then((ok) => set("downloads", ok));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAt(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    );
  }, []);

  const rows = [
    ["site", "Website", "framedecks.com"],
    ["account", "Sign-in and workspace sync", "Accounts, plans and linked PCs"],
    ["updates", "Update service", "New versions for the program"],
    ["downloads", "Downloads", "The installer"],
  ] as const;
  const allUp = Object.values(states).every((s) => s === "up");
  const anyChecking = Object.values(states).includes("checking");
  // Only the download side missing (also the case before it is first set up): say so plainly, planning still works.
  const onlyReleases =
    states.site === "up" &&
    states.account === "up" &&
    states.updates === "down" &&
    states.downloads === "down";

  return (
    <>
      <p
        className={`fd-status-sum ${anyChecking ? "" : allUp ? "is-up" : "is-down"}`}
        role="status"
      >
        {anyChecking
          ? "Checking…"
          : allUp
            ? "All services are working."
            : onlyReleases
              ? "Planning and sync are working. Downloads and updates are not answering yet."
              : "Some services could not be reached from here."}
        {at && <span> Checked at {at} from your browser.</span>}
      </p>
      <ul className="fd-status">
        {rows.map(([k, name, what]) => (
          <li key={k} className={`is-${states[k]}`}>
            <span className="fd-status-ic" aria-hidden="true">
              {states[k] === "checking" ? (
                <LoaderCircle size={18} />
              ) : states[k] === "up" ? (
                <CircleCheck size={18} />
              ) : (
                <CircleAlert size={18} />
              )}
            </span>
            <span>
              <strong>{name}</strong>
              <small>{what}</small>
            </span>
            <span className="fd-status-word">
              {states[k] === "checking"
                ? "Checking"
                : states[k] === "up"
                  ? "Working"
                  : "Not reachable"}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
