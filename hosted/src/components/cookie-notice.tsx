"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { readConsent, saveConsent } from "@/lib/consent";

/** A quiet notice at the bottom, once a year: essential storage only, nothing that tracks. */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(readConsent(localStorage) === null);
  }, []);
  if (!show) return null;
  return (
    <aside className="fd-cookie" role="region" aria-label="Cookies and storage">
      <p>
        FrameDecks uses only essential storage
        <span className="fd-cookie-more">: to keep your workspace open on this device and remember your choices</span>.
        No advertising, no tracking. <Link href="/cookies">Cookie Policy</Link>
      </p>
      <button
        type="button"
        className="fd-btn fd-btn-primary fd-btn-sm"
        onClick={() => {
          saveConsent(localStorage);
          setShow(false);
        }}
      >
        OK
      </button>
    </aside>
  );
}
