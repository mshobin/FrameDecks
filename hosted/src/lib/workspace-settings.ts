// FrameDecks - settings that were only in the program and are now on the website too (owner's request, 26 October):
// Meeting & Branding (the synced "brand" record), the meeting's transition style (the "layout/profile" record) and the
// week's birthdays (from the synced member list). Each body is written in the form the program's store.js normalize
// keeps, so the PC applies it unchanged (tests/workspace-settings.test.mjs). Self-contained, with no imports.

type Obj = { [key: string]: unknown };
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const cut = (v: unknown, n: number) =>
  String(v ?? "")
    .trim()
    .slice(0, n);

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

export type BrandForm = {
  meeting: string;
  org: string;
  color: string;
  auto: boolean;
};

export function brandFormOf(body: unknown): BrandForm {
  const b = isObj(body) ? body : {};
  return {
    meeting: String(b.meeting ?? ""),
    org: String(b.org ?? ""),
    color: String(b.color ?? ""),
    auto: !!b.auto,
  };
}

export function validColor(color: string): boolean {
  return color === "" || /^#[0-9a-f]{6}$/i.test(color);
}

/** The brand record on top of `base`: the logo (a picture on the PC) and its size are kept as they are. */
export function brandFromForm(form: BrandForm, base: unknown): Obj {
  const b: Obj = { logo: "", lw: 0, lh: 0, ...(isObj(base) ? base : {}) };
  b.meeting = cut(form.meeting, 80);
  b.org = cut(form.org, 80);
  b.color = validColor(form.color.trim())
    ? form.color.trim().toLowerCase()
    : "";
  b.auto = !!form.auto;
  return {
    meeting: b.meeting,
    org: b.org,
    color: b.color,
    logo: b.logo,
    lw: b.lw,
    lh: b.lh,
    auto: b.auto,
    ...b,
  };
}

export function hasLogo(body: unknown): boolean {
  return isObj(body) && !!body.logo;
}

// ---- 7.1 The workspace look (the layout/look record; store.js normalize: look) ----

/** One look: the accent it sets (the brand colour; "" = the default gold), the card surface (top to bottom), the
 *  scripture font, and the light or dark base the program's "Follow my workspace" uses. Every look keeps the cards'
 *  text readable: contrast at least 4.5:1 on its own surface (tests/workspace-settings.test.mjs). */
export type Look = {
  id: string;
  name: string;
  feel: string;
  accent: string;
  a: string;
  b: string;
  font: "serif" | "sans";
  base: "dark" | "light";
};

export const LOOKS: Look[] = [
  {
    id: "gold-navy",
    name: "Gold & Navy",
    feel: "The classic: gold edges on deep navy",
    accent: "",
    a: "#182c54",
    b: "#0c1a38",
    font: "serif",
    base: "dark",
  },
  {
    id: "morning-light",
    name: "Morning Light",
    feel: "Dawn blue with warm amber, a light window",
    accent: "#e8a55c",
    a: "#2e4770",
    b: "#1f3354",
    font: "serif",
    base: "light",
  },
  {
    id: "chapel-stone",
    name: "Chapel Stone",
    feel: "Warm stone and brass",
    accent: "#cfae78",
    a: "#3b3631",
    b: "#26221f",
    font: "serif",
    base: "dark",
  },
  {
    id: "deep-ocean",
    name: "Deep Ocean",
    feel: "Teal on deep sea blue, clean sans",
    accent: "#3fb6b0",
    a: "#0d3349",
    b: "#06202f",
    font: "sans",
    base: "dark",
  },
  {
    id: "forest",
    name: "Forest",
    feel: "Spring green on evergreen",
    accent: "#9cc46a",
    a: "#1d3a28",
    b: "#10251a",
    font: "serif",
    base: "dark",
  },
  {
    id: "quiet-mono",
    name: "Quiet Mono",
    feel: "Soft greys, nothing loud",
    accent: "#b8bec8",
    a: "#26272b",
    b: "#151619",
    font: "sans",
    base: "dark",
  },
];
export const DEFAULT_LOOK = "gold-navy";

/** The layout/look record body for a look, as store.js normalize keeps it. */
export function lookBody(look: Look): Obj {
  return {
    id: look.id,
    name: look.name,
    a: look.a,
    b: look.b,
    font: look.font,
    base: look.base,
  };
}

/** Which of the six looks a record holds ("" when none was chosen, or it is not one of them). */
export function lookOf(body: unknown): string {
  const id = isObj(body) ? String(body.id ?? "") : "";
  return LOOKS.some((l) => l.id === id) ? id : "";
}

/** The label colour the cards use for an accent (store.js brandPalette "text": 20% towards white; gold by default). */
export function labelColour(accent: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(accent);
  if (!m) return "#f2c35b";
  const n = parseInt(m[1], 16);
  return `#${[n >> 16, (n >> 8) & 255, n & 255]
    .map((v) =>
      Math.round(v + (255 - v) * 0.2)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(x: string, y: string): number {
  const lum = (h: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (a + 0.05) / (b + 0.05);
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

export type Birthday = {
  id: string;
  name: string;
  inDays: number;
  date: Date;
  turning: number | null;
};

function dayOf(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
}

/** Members whose birthday falls today or in the next `days` days, soonest first. 29 February is kept on 28 February
 * in other years, as the program does. */
export function upcomingBirthdays(
  members: unknown[],
  today: Date = new Date(),
  days = 7,
): Birthday[] {
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
      const date = new Date(
        year,
        month,
        month === 1 && day === 29 && !leap ? 28 : day,
      );
      const inDays = dayOf(date) - start;
      if (inDays >= 0 && inDays <= days) {
        out.push({
          id: String(m.id ?? ""),
          name: String(m.name ?? ""),
          inDays,
          date,
          turning: r[1] ? year - Number(r[1]) : null,
        });
        break;
      }
      if (inDays > days) break;
    }
  }
  return out.sort(
    (a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name),
  );
}

export function whenLabel(b: Birthday): string {
  if (b.inDays === 0) return "Today";
  if (b.inDays === 1) return "Tomorrow";
  return b.date.toLocaleDateString(undefined, { weekday: "long" });
}
