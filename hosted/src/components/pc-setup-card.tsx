"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download, Monitor, MonitorCheck, X } from "lucide-react";

import { DOWNLOADS, OPEN_LINK, placeOf, setupOf, type Setup } from "@/lib/pc-setup";
import { browserSupabase } from "@/lib/supabase-browser";

const HIDDEN = "fd-pc-card-hidden";

async function cameraNames(): Promise<string[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput").map((d) => d.label);
}

// Is FrameDecks on this computer? (docs/architecture/meeting-form.md, section 4.) Reads only the camera names the
// browser shows; the website never talks to the program, it only offers the installer or the framedecks:// link.
// 26.11.26 `org` (owners and admins): Connect this PC hands the program a one-time grant through that link; the program
// shows which team it is and connects with one click (no code to type).
export function PcSetupCard({ org }: Readonly<{ org?: string }>) {
  const [setup, setSetup] = useState<Setup | null>(null);
  // Server and first render show nothing (setup is null), so reading storage here never changes the first picture
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(HIDDEN) === "1";
    } catch {
      return false; // storage unavailable (private window): the card simply shows
    }
  });
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState(false);
  const [linked, setLinked] = useState<string | null>(null); // 26.11.37 a PC already in this team: no Connect this PC
  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase || !org) return;
    void supabase.rpc("workspace_devices", { org }).then(({ data }) => {
      const pc = ((data as { kind: string; name: string }[] | null) ?? []).find((d) => d.kind === "pc");
      setLinked(pc ? pc.name : null);
    });
  }, [org]);
  const connect = async () => {
    const supabase = browserSupabase();
    if (!supabase || !org) return;
    setProblem("");
    const failed = await (await import("@/lib/quick-sign-in")).connectThisPc(supabase, org);
    if (failed) setProblem(failed);
    else setSent(true);
  };

  useEffect(() => {
    let live = true;
    const place = placeOf(navigator.userAgent);
    if (place !== "windows" || !navigator.mediaDevices?.enumerateDevices) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSetup(place === "windows" ? "ask" : place);
      return;
    }
    cameraNames()
      .then((labels) => live && setSetup(setupOf(place, labels)))
      .catch(() => live && setSetup("ask"));
    return () => {
      live = false;
    };
  }, []);

  // The browser names cameras only once access is allowed. The camera may turn on for a moment; it is stopped at once.
  const check = useCallback(async () => {
    setProblem("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setSetup(setupOf("windows", await cameraNames()));
    } catch {
      setProblem("Camera access was not allowed, so this PC could not be checked. You can still download or open FrameDecks below.");
    }
  }, []);

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDDEN, "1");
    } catch {
      // not remembered: it shows again next time
    }
  };

  if (setup === null || setup === "phone" || (hidden && setup === "found")) return null;
  const found = setup === "found";

  return (
    <section className="pc-setup" aria-labelledby="pc-setup-title">
      <div className={found ? "pc-setup-icon pc-setup-ok" : "pc-setup-icon"}>
        {found ? <MonitorCheck aria-hidden="true" size={20} /> : <Monitor aria-hidden="true" size={20} />}
      </div>
      <div className="pc-setup-copy">
        <p className="eyebrow">This computer</p>
        {setup === "other" && (
          <>
            <h2 id="pc-setup-title">FrameDecks presents from a Windows PC.</h2>
            <p>Use this computer to plan, edit and run the service here; install FrameDecks on the service PC.</p>
          </>
        )}
        {setup === "ask" && (
          <>
            <h2 id="pc-setup-title">Is FrameDecks installed on this PC?</h2>
            <p>
              Check for the FrameDecks vCam: your browser asks for camera access once, and the camera may turn on for a
              moment. Nothing is recorded or sent.
            </p>
          </>
        )}
        {setup === "missing" && (
          <>
            <h2 id="pc-setup-title">FrameDecks is not on this PC yet.</h2>
            <p>
              Install FrameDecks for Windows and tick “Install the FrameDecks vCam”. Already installed? Add the camera in
              FrameDecks → Settings → FrameDecks vCam.
            </p>
          </>
        )}
        {found && (
          <>
            <h2 id="pc-setup-title">FrameDecks is installed on this PC.</h2>
            <p>
              Present from the program; plan the meeting and run it from your phone here. Not linked yet? Choose Connect this
              PC and confirm in FrameDecks; the PC then shows under <Link href="/devices">Devices</Link>.
            </p>
          </>
        )}
        {linked && (
          <p role="status">
            <strong>{linked}</strong> is connected to this team.
          </p>
        )}
        {sent && (
          <p role="status">FrameDecks opens on this PC and asks once: choose Connect. Nothing to type.</p>
        )}
        {problem && (
          <p className="pc-setup-problem" role="alert">
            {problem}
          </p>
        )}
        <div className="pc-setup-actions">
          {setup === "ask" && (
            <button className="pc-setup-primary" type="button" onClick={check}>
              Check this PC
            </button>
          )}
          {org && !linked && (found || setup === "ask") && (
            <button className={found ? "pc-setup-primary" : "pc-setup-quiet"} type="button" onClick={connect}>
              Connect this PC
            </button>
          )}
          {(found || setup === "ask") && (
            <a className={found && !org ? "pc-setup-primary" : "pc-setup-quiet"} href={OPEN_LINK}>
              Open FrameDecks on this PC
            </a>
          )}
          {!found && (
            <a className={setup === "missing" ? "pc-setup-primary" : "pc-setup-quiet"} href={DOWNLOADS}>
              <Download aria-hidden="true" size={15} /> Download FrameDecks for Windows
            </a>
          )}
        </div>
      </div>
      {found && (
        <button className="pc-setup-close" type="button" aria-label="Hide this card" onClick={hide}>
          <X aria-hidden="true" size={16} />
        </button>
      )}
    </section>
  );
}
