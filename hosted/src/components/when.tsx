"use client";

import { exactTime, relativeTime } from "@/lib/when";

/** A date the website's way: "2 h ago", with the exact time on hover (and for screen readers via dateTime). */
export function When({ at, fallback = "" }: { at: string | null | undefined; fallback?: string }) {
  if (!at || !relativeTime(at)) return <>{fallback}</>;
  return (
    <time dateTime={new Date(at).toISOString()} title={exactTime(at)}>
      {relativeTime(at)}
    </time>
  );
}
