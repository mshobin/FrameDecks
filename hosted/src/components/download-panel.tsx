"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Apple,
  Camera,
  Cpu,
  Download,
  HardDrive,
  LoaderCircle,
  MemoryStick,
  Monitor,
  MonitorSmartphone,
  ShieldCheck,
  Video,
  Wifi,
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
  shortVersion,
  updatedLabel,
} from "@/lib/releases";

// framedecks.com/download (7.0): the newest version for this computer, straight from the update service
// (api.framedecks.com/releases/latest, the same manifest the program's updater reads). If the service cannot be
// reached (or is not set up yet), the page says downloads open soon and offers planning on the website instead: it
// never shows a link it has not been given, so there is no dead download button.

type Fallback = { version: string; notes: string };

// 26.11.45 what the PC that runs the meeting screen needs (docs/guide/installation.md, the 4 GB check in
// docs/development/performance.md: FrameDecks is measured on a 4 GB PC with no graphics card)
const NEEDS = [
  { icon: Monitor, title: "Windows 10 or 11", text: "64-bit" },
  { icon: Cpu, title: "Dual-core processor", text: "No graphics card needed" },
  { icon: MemoryStick, title: "4 GB memory", text: "8 GB with Zoom or Teams open" },
  { icon: HardDrive, title: "1 GB free space", text: "For the program and backups" },
  { icon: MonitorSmartphone, title: "1280 × 720 screen", text: "Or larger" },
  { icon: Camera, title: "A webcam", text: "Optional, for FrameDecks vCam" },
  { icon: Wifi, title: "Internet", text: "For sync, members’ phones and updates" },
  { icon: Video, title: "Zoom, Teams or Meet", text: "Any meeting app that can choose a camera" },
];

const STEPS = [
  { title: "Download and open", text: "The installer is not code-signed yet, so Windows may warn you. Check its SHA-256 below, then choose More info, then Run anyway." },
  { title: "Keep the camera ticked", text: "“Install the FrameDecks vCam” needs one administrator prompt." },
  { title: "Follow the Setup guide", text: "FrameDecks opens with it. About ten minutes, then you are ready." },
];

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
  const updated = updatedLabel(release?.released ?? "", version);
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
      <div className="fd-dl-main">
        <section className="fd-dl-card" aria-labelledby="fd-dl-title" data-spotlight="">
          <div className="fd-dl-head">
            <span className="fd-dl-icon" aria-hidden="true">
              <Monitor size={26} />
            </span>
            <div>
              <h2 id="fd-dl-title">FrameDecks {shortVersion(version)}</h2>
              <p className="fd-dl-channel">
                <strong>Stable Release</strong>
                {updated ? <span>{updated}</span> : null}
              </p>
              <p>
                For Windows. Free for every church, school and team.
              </p>
            </div>
          </div>
          {elsewhere && (
            <p className="fd-dl-note">
              You are on {os === "macos" ? "a Mac" : "Linux"}. Download the
              Windows version for the PC that runs your meeting screen; plan on
              this website from any computer.
            </p>
          )}
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
            <button
              type="button"
              className="fd-btn fd-btn-ghost fd-btn-lg fd-dl-mac"
              disabled
              aria-describedby="fd-dl-mac-soon"
            >
              <Apple aria-hidden="true" size={18} /> Download for Mac
              <span className="fd-dl-soon-tag" id="fd-dl-mac-soon">
                Coming soon
              </span>
            </button>
          </div>
          {state === "unavailable" && (
            <p id="fd-dl-soon" className="fd-dl-soon" role="status">
              <strong>Downloads open here very soon.</strong> The download
              service is not answering yet, so there is nothing to download at
              this moment. Come back to this page in a little while; meanwhile{" "}
              <Link href="/sync?intent=save">start a free workspace</Link> and
              plan your first service on the website.
            </p>
          )}
          {started && (
            <div className="fd-dl-next" role="status">
              <strong>Your download has started.</strong> Follow the three steps
              below.
            </div>
          )}
          <div className="fd-dl-req" aria-labelledby="fd-dl-req-title">
            <h3 id="fd-dl-req-title">Minimum requirements</h3>
            <ul>
              {NEEDS.map((n) => (
                <li key={n.title}>
                  <n.icon aria-hidden="true" size={18} />
                  <span>
                    <b>{n.title}</b>
                    <small>{n.text}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="fd-dl-fine">
            Build {version}{date ? `, released ${date}` : ""}. By downloading
            you accept the <Link href="/eula">End User License Agreement</Link>.
            Installed copies update themselves.
          </p>
          <p className="fd-dl-fine fd-dl-signing">
            Free code signing provided by{" "}
            <a href="https://about.signpath.io/" rel="noopener">
              SignPath.io
            </a>
            , certificate by{" "}
            <a href="https://signpath.org/" rel="noopener">
              SignPath Foundation
            </a>
            . Applied for in November 2026: until it is approved, the installer
            is not signed yet.
          </p>
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
        </section>

        <section className="fd-dl-steps" aria-labelledby="fd-dl-steps-title" data-spotlight="">
          <h2 id="fd-dl-steps-title">Install in three steps</h2>
          <ol>
            {STEPS.map((st, i) => (
              <li key={st.title}>
                <span className="fd-dl-step-n" aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <b>{st.title}</b>
                  <small>{st.text}</small>
                </span>
              </li>
            ))}
          </ol>
          <p className="fd-dl-fine">
            Plan together on the website from any computer: <Link href="/sync?intent=save">start a free workspace</Link>.
            Full guide: <Link href="/docs/installation">Installing FrameDecks</Link>.
          </p>
        </section>
      </div>

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
