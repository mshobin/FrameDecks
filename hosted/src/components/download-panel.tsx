"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Apple,
  Download,
  LoaderCircle,
  Monitor,
  ShieldCheck,
  Terminal,
} from "lucide-react";

import { FlourishLater } from "@/components/landing/flourish-later";
import {
  UPDATE_API,
  detectOs,
  downloadState,
  formatSize,
  noteBlocks,
  parseRelease,
  type Os,
  type Release,
} from "@/lib/releases";

// framedecks.com/download (7.0): the newest version for this computer, straight from the update service
// (api.framedecks.com/releases/latest, the same manifest the program's updater reads). If the service cannot be
// reached (or is not set up yet), the page says downloads open soon and offers planning on the website instead: it
// never shows a link it has not been given, so there is no dead download button.

type Fallback = { version: string; notes: string };

export function DownloadPanel({ fallback }: Readonly<{ fallback: Fallback }>) {
  const [release, setRelease] = useState<Release | null>(null);
  const [checked, setChecked] = useState(false);
  const [os, setOs] = useState<Os>("windows");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOs(detectOs(nav.userAgent, nav.userAgentData?.platform ?? ""));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    fetch(`${UPDATE_API}/releases/latest`, {
      signal: ctl.signal,
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRelease(parseRelease(d)))
      .catch(() => setRelease(null))
      .finally(() => {
        clearTimeout(timer);
        setChecked(true);
      });
    return () => ctl.abort();
  }, []);

  const version = release?.version ?? fallback.version;
  const win =
    release?.platforms.windows ??
    (release
      ? {
          url: release.downloadUrl,
          sha256: release.sha256,
          size: release.size,
          file: "",
        }
      : null);
  const state = downloadState(checked, release);
  const href = win?.url ?? "";
  const notes = noteBlocks(release?.releaseNotes || fallback.notes);
  const date = release?.released
    ? new Date(`${release.released}T12:00:00`).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const elsewhere = os === "macos" || os === "linux";
  const waitButton = (
    <button
      type="button"
      className="fd-btn fd-btn-primary fd-btn-lg"
      disabled
      aria-describedby={state === "unavailable" ? "fd-dl-soon" : undefined}
    >
      {state === "checking" ? (
        <>
          <LoaderCircle aria-hidden="true" size={18} /> Finding the newest
          version…
        </>
      ) : (
        <>
          <Download aria-hidden="true" size={18} /> Download opens soon
        </>
      )}
    </button>
  );

  return (
    <div className="fd-dl">
      <FlourishLater />
      <section className="fd-dl-card" aria-labelledby="fd-dl-title" data-spotlight="">
        <span className="fd-dl-icon" aria-hidden="true">
          {os === "macos" ? (
            <Apple size={26} />
          ) : os === "linux" ? (
            <Terminal size={26} />
          ) : (
            <Monitor size={26} />
          )}
        </span>
        {elsewhere ? (
          <>
            <h2 id="fd-dl-title">
              FrameDecks for {os === "macos" ? "Mac" : "Linux"} is coming later
            </h2>
            <p>
              FrameDecks runs on Windows 10 and 11 today. You can plan on this
              website from any computer, and download the Windows version for
              the PC that runs your screen.
            </p>
            <div className="fd-dl-actions">
              {state === "ready" ? (
                <a
                  className="fd-btn fd-btn-primary fd-btn-lg"
                  href={href}
                  onClick={() => setStarted(true)}
                >
                  <Download aria-hidden="true" size={18} /> Download for Windows
                  · {version}
                </a>
              ) : (
                waitButton
              )}
              <Link
                className="fd-btn fd-btn-ghost fd-btn-lg"
                href="/sync?intent=save"
              >
                Start a free workspace
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 id="fd-dl-title">FrameDecks {version} for Windows</h2>
            <p>
              Free for every church, school and team. Windows 10 or 11, 64-bit.
              {date ? ` Released ${date}.` : ""}
            </p>
            <div className="fd-dl-actions">
              {state === "ready" ? (
                <a
                  className="fd-btn fd-btn-primary fd-btn-lg"
                  href={href}
                  onClick={() => setStarted(true)}
                >
                  <Download aria-hidden="true" size={18} /> Download for Windows
                  {win?.size ? ` · ${formatSize(win.size)}` : ""}
                </a>
              ) : (
                waitButton
              )}
              {state === "unavailable" && (
                <Link
                  className="fd-btn fd-btn-ghost fd-btn-lg"
                  href="/sync?intent=save"
                >
                  Start a free workspace
                </Link>
              )}
            </div>
          </>
        )}
        <p className="fd-dl-fine">
          By downloading you accept the{" "}
          <Link href="/eula">End User License Agreement</Link>. Installed copies
          update themselves.
        </p>
        {started && (
          <div className="fd-dl-next" role="status">
            <strong>Your download has started.</strong>
            <ol>
              <li>
                Open the file when it finishes. If Windows says it protected
                your PC, choose More info, then Run anyway.
              </li>
              <li>
                Keep “Install the FrameDecks vCam” ticked, and allow the one
                administrator prompt.
              </li>
              <li>
                FrameDecks opens with a Setup guide. It takes about ten minutes.
              </li>
            </ol>
          </div>
        )}
        {win?.sha256 && (
          <details className="fd-dl-hash">
            <summary>
              <ShieldCheck aria-hidden="true" size={16} /> Check the download
              (SHA-256)
            </summary>
            <code>{win.sha256}</code>
            <p>
              In PowerShell:{" "}
              <code>
                Get-FileHash .\{win.file || "FrameDecks-Setup.exe"} -Algorithm
                SHA256
              </code>
              . The two must match.
            </p>
          </details>
        )}
        {state === "unavailable" && (
          <p id="fd-dl-soon" className="fd-dl-soon" role="status">
            <strong>Downloads open here very soon.</strong> The download service
            is not answering yet, so there is nothing to download at this
            moment. Come back to this page in a little while; meanwhile you can
            create your workspace and plan your first service on the website.
          </p>
        )}
      </section>

      <section className="fd-dl-notes" aria-labelledby="fd-dl-notes-title" data-spotlight="">
        <h2 id="fd-dl-notes-title">What&apos;s new in {version}</h2>
        {notes.map((b) => (
          <div key={b.heading}>
            <h3>{b.heading}</h3>
            <ul>
              {b.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
