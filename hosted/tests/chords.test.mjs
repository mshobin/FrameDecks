// 26.11.63 the musicians' view on /follow: ChordPro lines read into chords over lyrics, chords moved to a new key with
// the new key's sharps or flats (slash chords too), capo shapes, and the musician's choices kept in range.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { firstChord, keyAfter, keyUsesFlats, lineHasChords, parseChordLine, readPrefs, savePrefs, songKey, tidyPrefs, transposeChord } from "../src/lib/chords.ts";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("a ChordPro line splits into lyric pieces with the chord before each", () => {
  assert.deepEqual(parseChordLine("[G]Amazing [C]grace, how [G]sweet"), [
    { chord: "G", text: "Amazing " },
    { chord: "C", text: "grace, how " },
    { chord: "G", text: "sweet" },
  ]);
  assert.deepEqual(parseChordLine("How sweet [D7]the sound"), [
    { chord: "", text: "How sweet " },
    { chord: "D7", text: "the sound" },
  ]);
  assert.deepEqual(parseChordLine("no chords here"), [{ chord: "", text: "no chords here" }]);
  assert.deepEqual(parseChordLine(""), [{ chord: "", text: "" }]);
  assert.deepEqual(parseChordLine("[G] [D/F#]"), [{ chord: "G", text: " " }, { chord: "D/F#", text: "" }]);
  assert.equal(lineHasChords(parseChordLine("plain")), false);
  assert.equal(lineHasChords(parseChordLine("[Em]x")), true);
});

test("chords move by semitones with sharps or flats", () => {
  assert.equal(transposeChord("G", 2), "A");
  assert.equal(transposeChord("G", 0), "G");
  assert.equal(transposeChord("G", 12), "G");
  assert.equal(transposeChord("C", 1), "C#");
  assert.equal(transposeChord("C", 1, true), "Db");
  assert.equal(transposeChord("C", 3), "Eb", "a plain root takes the usual spelling");
  assert.equal(transposeChord("Bb", 2), "C");
  assert.equal(transposeChord("Bb", 1), "B");
  assert.equal(transposeChord("Eb", 2), "F");
  assert.equal(transposeChord("Ab", 1), "A");
  assert.equal(transposeChord("Db", -1), "C");
  assert.equal(transposeChord("F#", 1), "G");
  assert.equal(transposeChord("F#", 2), "G#", "a sharp stays a sharp");
  assert.equal(transposeChord("Gb", 2), "Ab", "a flat stays a flat");
  assert.equal(transposeChord("A", 1, false), "A#");
  assert.equal(transposeChord("C", -1), "B");
  assert.equal(transposeChord("C", -13), "B");
});

test("chord qualities and slash chords keep their shape", () => {
  assert.equal(transposeChord("Am7", 2), "Bm7");
  assert.equal(transposeChord("Cmaj7", 5), "Fmaj7");
  assert.equal(transposeChord("Dsus4", 2), "Esus4");
  assert.equal(transposeChord("F#m7b5", 1), "Gm7b5");
  assert.equal(transposeChord("E7(#9)", 3, true), "G7(#9)");
  assert.equal(transposeChord("G/B", 2), "A/C#");
  assert.equal(transposeChord("G/B", 3, true), "Bb/D");
  assert.equal(transposeChord("C/E", -2, true), "Bb/D");
  assert.equal(transposeChord("D/F#", -2, true), "C/E");
  assert.equal(transposeChord("C6/9", 2), "D6/9");
  assert.equal(transposeChord("Cadd9", 7), "Gadd9");
});

test("words and markers that are not chords are left as they are", () => {
  for (const w of ["N.C.", "Bridge", "Chorus", "x2", "", "Hm", "Gospel"]) assert.equal(transposeChord(w, 3), w, w);
});

test("keys move and are spelled as keys are written", () => {
  assert.equal(keyAfter("G", 2), "A");
  assert.equal(keyAfter("G", 3), "Bb");
  assert.equal(keyAfter("C", 1), "Db");
  assert.equal(keyAfter("C", 6), "F#");
  assert.equal(keyAfter("Em", 1), "Fm");
  assert.equal(keyAfter("Am", 1), "Bbm");
  assert.equal(keyAfter("Am", 4), "C#m");
  assert.equal(keyAfter("A minor", 0), "Am");
  assert.equal(keyAfter("Bb", -1), "A");
  assert.equal(keyAfter("CM", 2), "D");
  assert.equal(keyAfter("", 3), "");
  assert.equal(keyAfter("Free", 2), "Free");
  assert.equal(keyUsesFlats("F"), true);
  assert.equal(keyUsesFlats("Dm"), true);
  assert.equal(keyUsesFlats("G"), false);
  assert.equal(keyUsesFlats("C#m"), false);
});

test("a song's key comes from the leader, or from its first chord", () => {
  assert.equal(songKey("G", "C"), "G");
  assert.equal(songKey("", "Am7"), "Am");
  assert.equal(songKey("", "Cmaj7"), "C");
  assert.equal(songKey("", ""), "");
  assert.equal(firstChord("Amazing grace\n[G]How [C]sweet"), "G");
  assert.equal(firstChord("no chords"), "");
});

test("the musician's choices are kept in range and survive blocked storage", () => {
  assert.deepEqual(tidyPrefs(null), { shift: 0, capo: 0 });
  assert.deepEqual(tidyPrefs({ shift: 40, capo: -2 }), { shift: 11, capo: 0 });
  assert.deepEqual(tidyPrefs({ shift: "-3", capo: 9 }), { shift: -3, capo: 7 });
  const kept = new Map();
  const store = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
  savePrefs({ shift: 2, capo: 3 }, store);
  assert.deepEqual(readPrefs(store), { shift: 2, capo: 3 });
  assert.equal(kept.get("fd-chords"), '{"shift":2,"capo":3}');
  kept.set("fd-chords", "{broken");
  assert.deepEqual(readPrefs(store), { shift: 0, capo: 0 });
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(readPrefs(broken), { shift: 0, capo: 0 });
  assert.doesNotThrow(() => savePrefs({ shift: 1, capo: 1 }, broken));
});

test("the follow page offers a Chords tab (components/follow-together.tsx) and remembers the musician's choices", () => {
  const panel = src("components/join-panel.tsx") + src("components/follow-together.tsx");
  for (const s of ['"Chords"', "readPrefs()", "savePrefs(", "transposeChord(", "scrollIntoView"]) assert.ok(panel.includes(s), s);
});
