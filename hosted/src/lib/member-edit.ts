// Editing the member list in the companion (M-D2, docs/project/history/migration-plan.md: the workspace is the member list's source).
// A person is one sync record of kind "member", the same shape the desktop keeps (app/js/members.js normalizeData):
// what is saved here arrives on the service PC unchanged. Checked against the desktop's own members-core.js in
// tests/member-edit.test.mjs.

export type MemberBody = {
  id: string;
  name: string;
  country: string;
  phone: string;
  email: string;
  birthDate: string; // "1990-04-02", or "--04-02" when the year is not known, or ""
  role: string;
};

export type MemberDraft = Omit<MemberBody, "id">;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LIMITS = { name: 120, country: 80, phone: 40, email: 160, role: 60 } as const;

/** As the desktop's clean(): control characters removed, trimmed, cut to the field's limit. */
export function clean(value: unknown, max: number): string {
  if (value === null || value === undefined) return "";
  const s = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

/** A new person's id, in the desktop's form (members-core.js uid). */
export function newMemberId(): string {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function daysIn(month: number, year: number | null): number {
  if (month === 2) return year === null || (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** "1990-04-02", "04-02" or "--04-02" (no year) → the stored form; "" stays "". An error message otherwise. */
export function parseBirthDate(value: string, today = new Date()): { ok: true; value: string } | { ok: false; error: string } {
  const s = clean(value, 40);
  if (!s) return { ok: true, value: "" };
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  let y: number | null = null;
  let m: number;
  let d: number;
  if (r) {
    y = Number(r[1]);
    m = Number(r[2]);
    d = Number(r[3]);
  } else if ((r = /^(?:--)?(\d{1,2})-(\d{1,2})$/.exec(s))) {
    m = Number(r[1]);
    d = Number(r[2]);
  } else {
    return { ok: false, error: "Write the birth date as YYYY-MM-DD (1985-03-15), or MM-DD (03-15) without the year." };
  }
  if (m < 1 || m > 12) return { ok: false, error: "The month is not valid." };
  if (d < 1 || d > daysIn(m, y)) return { ok: false, error: `Day ${d} does not exist in ${MONTHS[m - 1]}${y ? ` ${y}` : ""}.` };
  if (y !== null) {
    if (y < 1900) return { ok: false, error: "The year is too early." };
    const t = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    if (y * 10000 + m * 100 + d > t) return { ok: false, error: "The birth date is in the future." };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return { ok: true, value: `${y !== null ? y : "-"}-${pad(m)}-${pad(d)}` };
}

/** "2 April 1990", "2 April", or the stored text when it is in an older form. */
export function birthdayLabel(stored: string): string {
  const r = /^(?:(\d{4})|-)-(\d{2})-(\d{2})$/.exec(stored || "");
  if (!r) return stored || "";
  return `${Number(r[3])} ${MONTHS[Number(r[2]) - 1]}${r[1] ? ` ${r[1]}` : ""}`;
}

/** The form's way of showing a stored birth date for editing. */
export function birthDateInput(stored: string): string {
  const r = /^(?:(\d{4})|-)-(\d{2})-(\d{2})$/.exec(stored || "");
  if (!r) return stored || "";
  return r[1] ? stored : `${r[2]}-${r[3]}`;
}

function validEmail(s: string): boolean {
  return /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[A-Za-z]{2,}$/.test(s);
}

/** A draft from the form → the record body to save, or what is wrong with it. Other fields are not kept: the desktop
 * keeps only these. */
export function memberBody(id: string, draft: MemberDraft): { body: MemberBody; errors: string[] } {
  const errors: string[] = [];
  const body: MemberBody = {
    id: clean(id, 40) || newMemberId(),
    name: clean(draft.name, LIMITS.name),
    country: clean(draft.country, LIMITS.country),
    phone: clean(draft.phone, LIMITS.phone),
    email: clean(draft.email, LIMITS.email),
    birthDate: "",
    role: clean(draft.role, LIMITS.role),
  };
  if (!body.name) errors.push("The name is missing.");
  if (body.email && !validEmail(body.email)) errors.push("The email address does not look right.");
  if (body.phone && !/^\+?[\d\s().-]{5,}$/.test(body.phone)) errors.push("The phone number does not look right.");
  const bd = parseBirthDate(draft.birthDate);
  if (bd.ok) body.birthDate = bd.value;
  else errors.push(bd.error);
  return { body, errors };
}

export function draftOf(m: Partial<MemberBody> | null | undefined): MemberDraft {
  return {
    name: m?.name ?? "",
    country: m?.country ?? "",
    phone: m?.phone ?? "",
    email: m?.email ?? "",
    birthDate: birthDateInput(m?.birthDate ?? ""),
    role: m?.role ?? "",
  };
}

export type Group = { id: string; name: string };
export type GroupLinks = Map<string, Set<string>>; // member id → group ids

/** People in a group (or everyone for ""), sorted by name. */
export function inGroup<T extends { id: string; name: string }>(people: T[], links: GroupLinks, groupId: string): T[] {
  const list = groupId ? people.filter((p) => links.get(p.id)?.has(groupId)) : people;
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

export function groupCounts(links: GroupLinks, existing: Set<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [memberId, groups] of links) {
    if (!existing.has(memberId)) continue; // a person removed since: not counted
    for (const g of groups) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return counts;
}

export function cleanGroupName(name: string): string {
  return clean(name, 60).replace(/\s+/g, " ");
}
