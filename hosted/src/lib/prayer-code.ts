// 26.11.23/24 the members' room code the church PC shows (0019 prayer wall, 0020 members' phones), read from
// /follow#c=CODE or typed: eight characters (26.11.58, migration 0028; six before it, still read while rooms opened
// earlier are open) from the same alphabet as join codes (no 0/O, 1/I/L), tidied the same way.
import { tidyCode } from "@/lib/join-code";

const ROOM = /^(?:[A-HJ-NP-Z2-9]{6}|[A-HJ-NP-Z2-9]{8})$/;

export const tidyPrayerCode = tidyCode;

export function isPrayerCode(text: string): boolean {
  return ROOM.test(tidyCode(text));
}

export function prayerCodeFromHash(hash: string): string | null {
  const code = tidyCode(new URLSearchParams((hash ?? "").replace(/^#/, "")).get("c") ?? "");
  return ROOM.test(code) ? code : null;
}

export const PRAYER_MAX = 500;
export const PRAYER_NAME_MAX = 40;
