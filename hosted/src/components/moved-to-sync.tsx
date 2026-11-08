"use client";

import Link from "next/link";
import { useEffect } from "react";

export function MovedToSync() {
  useEffect(() => {
    const save = window.location.hash === "#new" || new URLSearchParams(window.location.search).has("new");
    window.location.replace(save ? "/sync?intent=save" : "/sync");
  }, []);
  return (
    <p className="auth-message" role="status">
      One moment… <Link href="/sync">Open Workspace</Link>
    </p>
  );
}

/** 26.11.12 an old address that moved (e.g. /computers → /devices). */
export function Forward({ to, label }: Readonly<{ to: string; label: string }>) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <p className="auth-message" role="status">
      One moment… <Link href={to}>{label}</Link>
    </p>
  );
}
