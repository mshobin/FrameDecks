"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download, Monitor, MonitorCheck, X } from "lucide-react";

import { DOWNLOADS, OPEN_LINK, placeOf, setupOf, type Setup } from "@/lib/pc-setup";

const HIDDEN = "fd-pc-card-hidden";

async function cameraNames(): Promise<string[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput").map((d) => d.label);
}

// Is FrameDecks on this computer? (docs/architecture/meeting-form.md, section 4.) Reads only the camera names the
// browser shows; the website never talks to the program, it only offers the installer or the framedecks:// link.
export function PcSetupCard() {
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
              Check for the FRAMECAST camera: your browser asks for camera access once, and the camera may turn on for a
              moment. Nothing is recorded or sent.
            </p>
          </>
        )}
        {setup === "missing" && (
          <>
            <h2 id="pc-setup-title">FrameDecks is not on this PC yet.</h2>
            <p>
              Install FrameDecks for Windows and tick “Install the FRAMECAST camera”. Already installed? Add the camera in
              FrameDecks → Settings → FRAMECAST Camera.
            </p>
          </>
        )}
        {found && (
          <>
            <h2 id="pc-setup-title">FrameDecks is installed on this PC.</h2>
            <p>
              Present from the program; plan the meeting and run it from your phone here. Not linked yet? In FrameDecks →
              Settings → FrameDecks account → Link, then type the code under <Link href="/computers">Computers</Link>.
            </p>
          </>
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
          {(found || setup === "ask") && (
            <a className={found ? "pc-setup-primary" : "pc-setup-quiet"} href={OPEN_LINK}>
              Open FrameDecks on this PC
            </a>
          )}
          {!found && (
            <a className={setup === "missing" ? "pc-setup-primary" : "pc-setup-quiet"} href={DOWNLOADS} target="_blank" rel="noreferrer">
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
