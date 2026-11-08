// FrameDecks 26.11.12 - Scan to join (docs/architecture/trusted-workspace.md, migration 0018_scan_to_join.sql).
// The small, pure pieces the Join, Allow, Open Workspace and Devices pages share: tidying and showing codes, reading
// them from a QR address, a plain name for a new device, the countdown, and who may give which role.
// Self-contained, with no imports, so the tests load it directly. Codes are secrets: nothing here logs them.

export type JoinRole = "admin" | "member";
export type DeviceRole = "owner" | "admin" | "member" | "pc";

/** The alphabet the database uses (0018 random_code): no 0/O or 1/I/L, so nothing looks alike. */
const SHORT = /^[A-HJ-NP-Z2-9]{8}$/;
const RECOVERY = /^[A-HJ-NP-Z2-9]{16}$/;

/** What was typed or scanned, tidied the way the database does it (spaces, dashes and case do not matter). */
export function tidyCode(text: string): string {
  return (text ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function isShortCode(text: string): boolean {
  return SHORT.test(tidyCode(text));
}

export function isRecoveryCode(text: string): boolean {
  return RECOVERY.test(tidyCode(text));
}

/** "K7PM2XQ9" → "K7PM 2XQ9"; a recovery code → "ABCD-EFGH-JKLM-NPQR". */
export function formatCode(code: string): string {
  const c = tidyCode(code);
  const groups = c.match(/.{1,4}/g) ?? [];
  return groups.join(c.length > 8 ? "-" : " ");
}

/** The code a QR address carries: /join#c=CODE or /allow#c=CODE (in the fragment, so no server ever logs it). */
export function codeFromHash(hash: string): string | null {
  const params = new URLSearchParams((hash ?? "").replace(/^#/, ""));
  const code = tidyCode(params.get("c") ?? "");
  return SHORT.test(code) ? code : null;
}

export function joinUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/join#c=${tidyCode(code)}`;
}

export function allowUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/allow#c=${tidyCode(code)}`;
}

/** A plain first name for a new device, from its browser: "iPhone", "Android phone", "Windows computer", "Mac". iPads
 * since iPadOS 13 say they are a Mac; a touch screen tells them apart. */
export function guessDeviceName(ua: string = globalThis.navigator?.userAgent ?? "", touchPoints = globalThis.navigator?.maxTouchPoints ?? 0): string {
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  if (/CrOS/.test(ua)) return "Chromebook";
  if (/Windows/.test(ua)) return "Windows computer";
  if (/Mac OS X|Macintosh/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux computer";
  return "This device";
}

/** When a code runs out, in this browser's clock. The server's time is used only when it agrees with how long codes
 * last; a browser whose clock is wrong falls back to the full lifetime from now. */
export function deadlineFrom(expiresAt: string | undefined, lifetimeMs: number, now = Date.now()): number {
  const at = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const left = at - now;
  if (!Number.isFinite(left) || left <= 0 || left > lifetimeMs + 5000) return now + lifetimeMs;
  return at;
}

/** Whole seconds left, never below zero. */
export function secondsLeft(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** "1:45" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A fresh code is made a moment before the old one runs out, so the one on screen always works. */
export const REFRESH_AT_SECONDS = 3;
export function shouldRefresh(seconds: number): boolean {
  return seconds <= REFRESH_AT_SECONDS;
}

/** "just now", "40 seconds ago", "3 minutes ago" */
export function agoWords(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 5) return "just now";
  if (s < 90) return `${s} seconds ago`;
  return `${Math.round(s / 60)} minutes ago`;
}

export const ROLE_WORDS: Record<DeviceRole, string> = { owner: "Owner", admin: "Admin", member: "Helper", pc: "PC" };

/** Who may let a device in as what (0018 join_role_allowed): the owner adds Admins or Helpers, an admin only Helpers. */
export function rolesICanGive(myRole: string | null | undefined): JoinRole[] {
  if (myRole === "owner") return ["member", "admin"];
  if (myRole === "admin") return ["member"];
  return [];
}

/** Add a device (one of my own): the highest role I may give. */
export function highestRole(myRole: string | null | undefined): JoinRole | null {
  const roles = rolesICanGive(myRole);
  return roles.length ? roles[roles.length - 1] : null;
}

/** May I remove this device from the team? (0018 device_remove, and computer_revoke for PCs) */
export function canRemove(myRole: string | null | undefined, row: { kind: string; role: string; is_me: boolean }): boolean {
  if (row.kind === "pc") return myRole === "owner" || myRole === "admin";
  if (row.role === "owner") return false;
  return row.is_me || myRole === "owner" || (myRole === "admin" && row.role === "member");
}

/** Anonymous sign-ins switched off in Supabase (owner step): the error says so. */
export function anonymousOff(error: { message?: string; code?: string } | null | undefined): boolean {
  return !!error && (error.code === "anonymous_provider_disabled" || /anonymous sign-?ins are disabled/i.test(error.message ?? ""));
}

/** What a code problem means for the person, or null when it is some other error. */
export function codeProblem(error: { message?: string; code?: string; hint?: string } | null | undefined): "terms" | "too-many" | null {
  if (!error) return null;
  if (error.hint === "terms" || /Accept the Terms first/i.test(error.message ?? "")) return "terms";
  if (error.code === "53400" || /Too many wrong codes/i.test(error.message ?? "")) return "too-many";
  return null;
}
