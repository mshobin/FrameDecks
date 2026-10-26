// FRAMEDECKS - settings that were only in the program and are now on the website too (owner's request, 26 October):
// Meeting & Branding (the synced "brand" record), the meeting's transition style (the "layout/profile" record) and the
// week's birthdays (from the synced member list). Each body is written in the form the program's store.js normalize
// keeps, so the PC applies it unchanged (tests/workspace-settings.test.mjs). Self-contained, with no imports.

type Obj = { [key: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const cut = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

// ---- Meeting & Branding (store.js normalize: brand) ----

/** The program's accent swatches (app/js/meeting-brand.js SWATCHES); "" is the default gold. */
export const SWATCHES: [string, string][] = [
  ["", "Gold (default)"],
  ["#1f3a6d", "Navy"],
  ["#2f6fb0", "Blue"],
  ["#0f766e", "Teal"],
  ["#15803d", "Green"],
  ["#7c3aed", "Purple"],
  ["#b4235a", "Crimson"],
  ["#c2410c", "Orange"],
];
export const DEFAULT_GOLD = "#d9ab4a";

export type BrandForm = { meeting: string; org: string; color: string; auto: boolean };

export function brandFormOf(body: unknown): BrandForm {
  const b = isObj(body) ? body : {};
  return { meeting: String(b.meeting ?? ""), org: String(b.org ?? ""), color: String(b.color ?? ""), auto: !!b.auto };
}

export function validColor(color: string): boolean {
  return color === "" || /^#[0-9a-f]{6}$/i.test(color);
}

/** The brand record on top of `base`: the logo (a picture on the PC) and its size are kept as they are. */
export function brandFromForm(form: BrandForm, base: unknown): Obj {
  const b: Obj = { logo: "", lw: 0, lh: 0, ...(isObj(base) ? base : {}) };
  b.meeting = cut(form.meeting, 80);
  b.org = cut(form.org, 80);
  b.color = validColor(form.color.trim()) ? form.color.trim().toLowerCase() : "";
  b.auto = !!form.auto;
  return { meeting: b.meeting, org: b.org, color: b.color, logo: b.logo, lw: b.lw, lh: b.lh, auto: b.auto, ...b };
}

export function hasLogo(body: unknown): boolean {
  return isObj(body) && !!body.logo;
}

// ---- The meeting's transition style (store.js PROFILES; the record is layout/profile {value}) ----

export const PROFILES: { id: string; name: string; feel: string }[] = [
  { id: "sunday", name: "Sunday Service", feel: "Fade, half a second" },
  { id: "bible-study", name: "Bible Study", feel: "Quick fade" },
  { id: "youth", name: "Youth Service", feel: "Push, fast" },
  { id: "conference", name: "Conference", feel: "Cross dissolve" },
  { id: "wedding", name: "Wedding", feel: "Slow cinema fade" },
  { id: "funeral", name: "Funeral", feel: "Gentle church fade" },
  { id: "christmas", name: "Christmas Service", feel: "Dip to white" },
  { id: "livestream", name: "Livestream", feel: "Cut, instant" },
];
export const DEFAULT_PROFILE = "bible-study";

export function profileOf(body: unknown): string {
  const v = isObj(body) ? String(body.value ?? "") : "";
  return PROFILES.some((p) => p.id === v) ? v : DEFAULT_PROFILE;
}

// ---- Birthdays this week (members' birthDate: "1990-04-02", "--04-02" without the year, or "") ----

export type Birthday = { id: string; name: string; inDays: number; date: Date; turning: number | null };

function dayOf(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
}

/** Members whose birthday falls today or in the next `days` days, soonest first. 29 February is kept on 28 February
 * in other years, as the program does. */
export function upcomingBirthdays(members: unknown[], today: Date = new Date(), days = 7): Birthday[] {
  const out: Birthday[] = [];
  const start = dayOf(today);
  for (const m of members) {
    if (!isObj(m)) continue;
    const r = /^(?:(\d{4})|-)-(\d{2})-(\d{2})$/.exec(String(m.birthDate ?? ""));
    if (!r) continue;
    const month = Number(r[2]) - 1;
    const day = Number(r[3]);
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
      const leap = new Date(year, 1, 29).getMonth() === 1;
      const date = new Date(year, month, month === 1 && day === 29 && !leap ? 28 : day);
      const inDays = dayOf(date) - start;
      if (inDays >= 0 && inDays <= days) {
        out.push({ id: String(m.id ?? ""), name: String(m.name ?? ""), inDays, date, turning: r[1] ? year - Number(r[1]) : null });
        break;
      }
      if (inDays > days) break;
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name));
}

export function whenLabel(b: Birthday): string {
  if (b.inDays === 0) return "Today";
  if (b.inDays === 1) return "Tomorrow";
  return b.date.toLocaleDateString(undefined, { weekday: "long" });
}
