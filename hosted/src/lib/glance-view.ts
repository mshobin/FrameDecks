// FrameDecks 26.11.40 - the left panel's Next meeting card in words (components/side-card.tsx); no imports, so the
// tests read it directly.

/** "Tue 3 Nov · in 2 days" (a date that has passed: just the date) */
export function meetingWhen(date: string, now = Date.now()): string {
  const d = new Date(`${date}T12:00:00`);
  if (!date || Number.isNaN(d.getTime())) return "No date yet";
  const days = Math.round((d.getTime() - now) / 86400000);
  const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const soon = days === 0 ? "today" : days === 1 ? "tomorrow" : days > 1 ? `in ${days} days` : "";
  return soon ? `${label} · ${soon}` : label;
}

/** The five checks: named and dated, Frames added, every Frame filled, nothing waiting for Sync Now, the PC online. */
export function readyCount(m: { name: string; date: string; frames: number; filled: number }, waiting: number, pcOnline: boolean): number {
  return [!!(m.name && m.date), m.frames > 0, m.frames > 0 && m.filled === m.frames, waiting === 0, pcOnline].filter(Boolean).length;
}
