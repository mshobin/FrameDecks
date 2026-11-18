// 26.11.63 the musicians' view on /follow: a Song's ChordPro chords ("[G]Amazing [C]grace"), read line by line, moved
// to another key (sharps or flats as the new key spells them, slash chords too) and shown as capo shapes. Pure and small:
// no dependencies, so the phone page stays within the JavaScript budget.

export type ChordSeg = { chord: string; text: string };
export type ChordPrefs = { shift: number; capo: number };

export const CHORDS_KEY = "fd-chords";

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const USUAL = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MAJOR_KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_KEYS = ["Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm"]);
const BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// what may follow a chord's root: m, maj7, sus4, add9, dim, aug, 7(#9), m7b5, 6/9 … (never an ordinary word like "Bridge")
const QUALITY = /^(?:maj|min|dim|aug|sus|add|no|alt|m|M|\d+|\/\d+|[#b♯♭+\-()°ø△^,.])*$/;
const CHORD = /^([A-G])([#b♯♭]?)(.*?)(?:\/([A-G])([#b♯♭]?))?$/;

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const pitch = (letter: string, acc: string) => mod12(BASE[letter] + (acc === "#" || acc === "♯" ? 1 : acc === "b" || acc === "♭" ? -1 : 0));
const isFlat = (acc: string) => acc === "b" || acc === "♭";

/** One line of ChordPro split into pieces of lyric, each with the chord written just before it ("" when none). A line
 * without chords comes back as one piece with no chord. */
export function parseChordLine(line: string): ChordSeg[] {
  const parts = String(line ?? "").split(/\[([^\]]*)\]/);
  const segs: ChordSeg[] = [];
  if (parts[0]) segs.push({ chord: "", text: parts[0] });
  for (let i = 1; i < parts.length; i += 2) segs.push({ chord: parts[i].trim(), text: parts[i + 1] ?? "" });
  return segs.length ? segs : [{ chord: "", text: "" }];
}

/** True when a line has at least one chord in it. */
export const lineHasChords = (segs: readonly ChordSeg[]) => segs.some((s) => s.chord);

/** A chord moved by some semitones. flats chooses the spelling (Bb or A#); left out, the chord keeps the kind of
 * accidental it was written with, and a plain root takes the usual spelling (C#, Eb, F#, Ab, Bb). Anything that is not a
 * chord (N.C., a word) comes back as it was. */
export function transposeChord(chord: string, semis: number, flats?: boolean): string {
  const c = String(chord ?? "").trim();
  const m = CHORD.exec(c);
  if (!m || !QUALITY.test(m[3])) return chord;
  const n = Math.round(Number(semis) || 0);
  if (mod12(n) === 0 && flats === undefined) return c;
  const name = (letter: string, acc: string) => {
    const p = mod12(pitch(letter, acc) + n);
    const useFlats = flats ?? (acc ? isFlat(acc) : null);
    return useFlats === null ? USUAL[p] : useFlats ? FLATS[p] : SHARPS[p];
  };
  return name(m[1], m[2]) + m[3] + (m[4] ? `/${name(m[4], m[5])}` : "");
}

/** A key ("G", "Bb", "F#m", "A minor") moved by some semitones, spelled as the key is usually written; "" stays "", and
 * something that is not a key comes back as it was. */
export function keyAfter(key: string, semis: number): string {
  const k = String(key ?? "").trim();
  const m = /^([A-G])([#b♯♭]?)\s*(.*)$/.exec(k);
  if (!m) return k;
  const rest = m[3];
  const minor = /^(m(?!aj)|min)/.test(rest) || /^min(or)?$/i.test(rest);
  if (rest && !minor && !/^(maj(or)?|M)$/i.test(rest)) return k;
  const p = mod12(pitch(m[1], m[2]) + Math.round(Number(semis) || 0));
  return (minor ? MINOR_KEYS : MAJOR_KEYS)[p];
}

/** Whether a key is written with flats (F, Bb, Eb, Dm, Gm …). */
export const keyUsesFlats = (key: string) => FLAT_KEYS.has(keyAfter(key, 0));

/** The key a song's chords are in: the leader's key when given, else read from its first chord ("Am7" → "Am"). */
export function songKey(key: string, firstChord: string): string {
  if (String(key ?? "").trim()) return keyAfter(key, 0);
  const m = CHORD.exec(String(firstChord ?? "").trim());
  if (!m || !QUALITY.test(m[3])) return "";
  return m[1] + m[2] + (/^m(?!aj)/.test(m[3]) ? "m" : "");
}

/** The first chord written anywhere in some ChordPro text, or "". */
export function firstChord(text: string): string {
  const m = /\[([^\]]+)\]/.exec(String(text ?? ""));
  return m ? m[1].trim() : "";
}

/** The musician's choices, kept in range: a shift of -11..11 semitones and a capo of 0..7. */
export function tidyPrefs(raw: unknown): ChordPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ChordPrefs>;
  const clamp = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || 0));
  return { shift: clamp(r.shift, -11, 11), capo: clamp(r.capo, 0, 7) };
}

export function readPrefs(store?: Pick<Storage, "getItem"> | null): ChordPrefs {
  try {
    const s = store === undefined ? localStorage : store;
    return tidyPrefs(JSON.parse(s?.getItem(CHORDS_KEY) ?? "null"));
  } catch {
    return tidyPrefs(null);
  }
}

export function savePrefs(prefs: ChordPrefs, store?: Pick<Storage, "setItem"> | null): void {
  try {
    (store === undefined ? localStorage : store)?.setItem(CHORDS_KEY, JSON.stringify(tidyPrefs(prefs)));
  } catch {
    /* storage blocked: kept for this visit only */
  }
}
