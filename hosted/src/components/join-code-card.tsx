"use client";

import "@/app/join.css"; // 26.11.12 loaded only with the Scan to join screens

import { useCallback, useEffect, useRef, useState } from "react";

import { clock, deadlineFrom, formatCode, secondsLeft, shouldRefresh } from "@/lib/join-code";

/** A QR code drawn as SVG. The encoder (lib/qr.ts) is loaded only when a page shows one. Dark on white in both themes,
 * so every phone camera reads it. */
export function QrCode({ value, label }: Readonly<{ value: string; label: string }>) {
  const [drawn, setDrawn] = useState<{ value: string; d: string; n: number } | null>(null);
  useEffect(() => {
    let live = true;
    import("@/lib/qr").then(({ qrMatrix, qrPath }) => {
      const m = qrMatrix(value);
      if (live) setDrawn({ value, d: qrPath(m), n: m.length + 8 });
    });
    return () => {
      live = false;
    };
  }, [value]);
  return (
    <div className="jc-qr">
      {drawn && drawn.value === value ? (
        <svg role="img" aria-label={label} viewBox={`0 0 ${drawn.n} ${drawn.n}`} shapeRendering="crispEdges">
          <path d={drawn.d} fill="#000" />
        </svg>
      ) : (
        <span className="fd-skel" aria-hidden="true" />
      )}
    </div>
  );
}

export type MadeCode = { code: string; expiresAt?: string };

/** A code that is always fresh: made when `on`, counted down each second, and quietly replaced a moment before it runs
 * out. After `rounds` codes nobody used it stops, so an open tab does not make codes all day. */
export function useRotatingCode(make: () => Promise<MadeCode | string>, lifetimeMs: number, on: boolean, rounds = 5) {
  const [made, setMade] = useState<{ code: string; deadline: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [fresh, setFresh] = useState(0);
  const makeRef = useRef(make);
  const busy = useRef(false);
  const count = useRef(0);
  useEffect(() => {
    makeRef.current = make;
  }, [make]);

  const next = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const r = await makeRef.current().catch(() => "Couldn’t make a code. Check your connection and try again.");
    busy.current = false;
    if (typeof r === "string") {
      setProblem(r);
      setMade(null);
      return;
    }
    count.current += 1;
    const deadline = deadlineFrom(r.expiresAt, lifetimeMs);
    setProblem(null);
    setMade({ code: r.code, deadline });
    setLeft(secondsLeft(deadline));
    setFresh((n) => n + 1);
  }, [lifetimeMs]);

  const again = useCallback(() => {
    count.current = 0;
    setStopped(false);
    void next();
  }, [next]);

  useEffect(() => {
    if (!on) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    again();
  }, [on, again]);

  useEffect(() => {
    if (!made || !on) return;
    const t = window.setInterval(() => {
      const s = secondsLeft(made.deadline);
      setLeft(s);
      if (!shouldRefresh(s)) return;
      window.clearInterval(t);
      if (count.current >= rounds) {
        setStopped(true);
        setMade(null);
      } else void next();
    }, 1000);
    return () => window.clearInterval(t);
  }, [made, on, next, rounds]);

  return { code: on ? (made?.code ?? null) : null, left, problem, stopped, fresh, again };
}

/** The QR code, the same code in large letters, and how long it lasts. */
export function JoinCodeCard({
  url,
  code,
  left,
  fresh,
  qrLabel,
  typeHint,
}: Readonly<{ url: string; code: string; left: number; fresh: number; qrLabel: string; typeHint: React.ReactNode }>) {
  const spelled = code.split("").join(" ");
  return (
    <div className="jc-card">
      <QrCode value={url} label={qrLabel} />
      <div className="jc-side">
        <p className="jc-label">{typeHint}</p>
        <p className="jc-code" aria-label={`Code: ${spelled}`}>
          {formatCode(code)}
        </p>
        <p className="jc-timer">
          Works once · runs out in <strong>{clock(left)}</strong>. A new one appears by itself.
        </p>
        <span className="fd-sr" role="status" aria-live="polite">
          {fresh > 1 ? "A new code is ready." : ""}
        </span>
      </div>
    </div>
  );
}

/** When the codes stopped (nobody used them for a while), or one could not be made. */
export function CodeStopped({ problem, onAgain }: Readonly<{ problem?: string | null; onAgain: () => void }>) {
  return (
    <div className="jc-note">
      <p className={problem ? "workspace-problem" : "auth-message"} role={problem ? "alert" : "status"}>
        {problem ?? "The code ran out, so nobody can use it now."}
      </p>
      <button type="button" className="fd-btn fd-btn-glass fd-btn-sm" onClick={onAgain}>
        Show a new code
      </button>
    </div>
  );
}
