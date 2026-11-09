// 26.11.23 Prayer requests wall (migration 0019): the code the church PC shows, read from /pray#c=CODE or typed.
// Six characters from the same alphabet as join codes (no 0/O, 1/I/L).
const PRAYER = /^[A-HJ-NP-Z2-9]{6}$/;

export function tidyPrayerCode(text: string): string {
  return (text ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function isPrayerCode(text: string): boolean {
  return PRAYER.test(tidyPrayerCode(text));
}

export function prayerCodeFromHash(hash: string): string | null {
  const code = tidyPrayerCode(new URLSearchParams((hash ?? "").replace(/^#/, "")).get("c") ?? "");
  return PRAYER.test(code) ? code : null;
}

export function prayUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/pray#c=${tidyPrayerCode(code)}`;
}

export const PRAYER_MAX = 500;
export const PRAYER_NAME_MAX = 40;
