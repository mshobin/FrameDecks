// One way to show a date on the website (design audit DD-09): recent times as "5 min ago" / "2 h ago",
// older ones as "12 Oct" (or "12 Oct 2025" in another year), and the exact time, to the minute, on hover.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function toDate(at: string | number | Date): Date | null {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "26 Oct 2026, 08:00": the exact time, never with seconds. */
export function exactTime(at: string | number | Date, locale?: string): string {
  const d = toDate(at);
  return d ? d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "";
}

/** "12 Oct", or "12 Oct 2025" when it is not this year. */
export function shortDate(at: string | number | Date, now: number = Date.now(), locale?: string): string {
  const d = toDate(at);
  if (!d) return "";
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(locale, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

/** "just now", "5 min ago", "2 h ago", "yesterday", "3 days ago", then a short date. A time ahead of the clock reads "just now". */
export function relativeTime(at: string | number | Date, now: number = Date.now(), locale?: string): string {
  const d = toDate(at);
  if (!d) return "";
  const ago = now - d.getTime();
  if (ago < MIN) return "just now";
  if (ago < HOUR) return `${Math.floor(ago / MIN)} min ago`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} h ago`;
  if (ago < 2 * DAY) return "yesterday";
  if (ago < 7 * DAY) return `${Math.floor(ago / DAY)} days ago`;
  return shortDate(d, now, locale);
}
