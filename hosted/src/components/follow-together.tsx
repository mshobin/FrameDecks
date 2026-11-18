"use client";

// 26.11.63 meeting together on members' phones (/follow, 0030_meeting_together.sql): an optional first name so the leader
// can invite someone to share, a hand to raise, a quiz with a countdown, the chords for musicians, and the take-home page
// for the week. Each piece hides quietly when the workspace does not have its function yet (an error from the RPC).

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";

import type { SupabaseClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { firstChord, keyAfter, keyUsesFlats, lineHasChords, parseChordLine, readPrefs, savePrefs, songKey, transposeChord, type ChordPrefs } from "@/lib/chords";
import { voterId } from "@/lib/room-responses";
import { dayDate, joinTarget, myPrayerStates, paragraphs, readMyPrayers, tidyTakehome, type Takehome } from "@/lib/takehome";
import { userSafeError } from "@/lib/user-error";

export type Song = { title?: string; credit?: string; key?: string; at?: number; items?: { label?: string; text?: string; chords?: string }[] };

const NAME_KEY = "fd-follow-name";
const LETTERS = "ABCD";
const checkedIn = new Set<string>();
const handsUp = new Map<string, boolean>(); // kept while the page is open, so changing tabs keeps the hand

function keptName(): string {
  try {
    return (localStorage.getItem(NAME_KEY) ?? "").slice(0, 40);
  } catch {
    return "";
  }
}

/** Says this phone joined (with the first name kept on it, if any) once per room; false when the workspace has no
 * room_checkin yet, so the name box stays hidden. */
export function useCheckin(supabase: SupabaseClient | null, code: string | null, people: boolean): boolean {
  const [ok, setOk] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!supabase || !code || !people || checkedIn.has(code)) return;
    checkedIn.add(code);
    void supabase.rpc("room_checkin", { code, voter: voterId(), name: keptName() || null }).then(
      ({ error }) => setOk((o) => ({ ...o, [code]: !error })),
      () => setOk((o) => ({ ...o, [code]: false })),
    );
  }, [supabase, code, people]);
  return !!(code && people && ok[code]);
}

/** The optional first name, in a slim bar above the screen. */
export function NameBar({ supabase, code }: Readonly<{ supabase: SupabaseClient; code: string }>) {
  const [saved, setSaved] = useState(keptName);
  const [typed, setTyped] = useState(saved);
  const [editing, setEditing] = useState(!saved);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    const name = typed.replace(/\s+/g, " ").trim().slice(0, 40);
    setBusy(true);
    const { error } = await supabase.rpc("room_checkin", { code, voter: voterId(), name: name || null }).then((r) => r, (x: unknown) => ({ error: x }));
    setBusy(false);
    if (error) return setProblem(userSafeError(error, "Couldn’t save your name. Try again."));
    try {
      if (name) localStorage.setItem(NAME_KEY, name);
      else localStorage.removeItem(NAME_KEY);
    } catch {
      /* storage blocked: the leader still has it for this meeting */
    }
    setProblem(null);
    setSaved(name);
    setEditing(!name);
  }
  if (!editing)
    return (
      <p className="fl-name fl-name-in">
        <span>
          You joined as <b>{saved}</b>
        </span>
        <button type="button" className="fl-chip" onClick={() => setEditing(true)}>
          Change
        </button>
      </p>
    );
  return (
    <form className="fl-name" onSubmit={save}>
      <label htmlFor="fl-name-in">Your first name (optional)</label>
      <span className="fl-name-row">
        <input id="fl-name-in" value={typed} maxLength={40} autoComplete="given-name" onChange={(e) => setTyped(e.target.value)} />
        <button type="submit" className="fl-chip" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </span>
      <small>So the leader can invite you to share. Only the leader sees it.</small>
      {problem && (
        <small className="auth-error" role="alert">
          {problem}
        </small>
      )}
    </form>
  );
}

/** "I’d like to share": a hand raised for the leader to see. Hidden when the workspace has no room_hand yet. */
export function HandButton({ supabase, code, rev }: Readonly<{ supabase: SupabaseClient; code: string; rev: number }>) {
  const [up, setUp] = useState(() => handsUp.get(code) ?? false);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  // the leader lowering hands moves the room's rev: a raised hand asks again (up null changes nothing)
  useEffect(() => {
    if (!up) return;
    let live = true;
    void supabase.rpc("room_hand", { code, voter: voterId(), up: null }).then(
      ({ data, error }) => {
        const d = (data ?? {}) as { status?: string; hand?: boolean };
        if (live && !error && d.status === "in" && !d.hand) {
          setUp(false);
          handsUp.set(code, false);
        }
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);
  if (gone) return null;
  async function toggle() {
    setBusy(true);
    const { data, error } = await supabase.rpc("room_hand", { code, voter: voterId(), up: !up }).then((r) => r, (x: unknown) => ({ data: null, error: x }));
    setBusy(false);
    const d = (data ?? {}) as { status?: string; hand?: boolean };
    // a workspace without room_hand (not set up yet), or a room that closed, hides the button
    if (error || d.status !== "in") return setGone(true);
    setUp(!!d.hand);
    handsUp.set(code, !!d.hand);
  }
  return (
    <div className="fl-hand">
      <button type="button" aria-pressed={up} disabled={busy} onClick={() => void toggle()}>
        {up ? "Your hand is up" : "I’d like to share"}
      </button>
      <p className="fl-resp-note" role="status">
        {up ? "The leader can see your hand. Tap again to lower it." : "Raise your hand and the leader may invite you to share."}
      </p>
    </div>
  );
}

type Quiz = { id: string; question: string; options: string[]; closesAt: number; revealed: boolean; correct: number | null; mine: number | null };

function tidyQuiz(raw: unknown): Quiz | null {
  const q = raw as { id?: unknown; question?: unknown; options?: unknown; closesAt?: unknown; revealed?: unknown; correct?: unknown; mine?: unknown } | null;
  const options = Array.isArray(q?.options) ? q.options.filter((o): o is string => typeof o === "string").slice(0, 4) : [];
  if (!q || typeof q.id !== "string" || typeof q.question !== "string" || options.length < 2) return null;
  const idx = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < options.length ? (v as number) : null);
  return { id: q.id, question: q.question, options, closesAt: Date.parse(String(q.closesAt)) || 0, revealed: q.revealed === true, correct: q.revealed === true ? idx(q.correct) : null, mine: idx(q.mine) };
}

/** A quiz the leader opened: the question, big lettered answers, a countdown, one answer per phone, and after the
 * leader shows the answer, the right one marked. Looked at again whenever the room changes. */
export function QuizBox({ supabase, code, roomRev }: Readonly<{ supabase: SupabaseClient; code: string; roomRev: number }>) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [again, setAgain] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let gone = false;
    void supabase.rpc("room_quiz_view", { code, voter: voterId() }).then(
      ({ data, error }) => {
        if (gone) return;
        const d = (data ?? {}) as { status?: string; quiz?: unknown };
        setQuiz(!error && d.status === "open" ? tidyQuiz(d.quiz) : null);
      },
      () => !gone && setQuiz(null),
    );
    return () => {
      gone = true;
    };
  }, [supabase, code, roomRev, again]);
  const ticking = !!quiz && !quiz.revealed && quiz.closesAt > now;
  useEffect(() => {
    if (!ticking) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [ticking]);
  if (!quiz) return null;
  const left = Math.max(0, Math.ceil((quiz.closesAt - now) / 1000));
  const closed = quiz.revealed || left === 0;
  async function pick(i: number) {
    if (!quiz || busy || quiz.mine !== null || closed) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("room_quiz_answer", { code, voter: voterId(), quiz: quiz.id, choice: i }).then((r) => r, (x: unknown) => ({ data: null, error: x }));
    setBusy(false);
    const st = (data as { status?: string } | null)?.status;
    if (error) return setNote(userSafeError(error, "Couldn’t send your answer. Try again."));
    if (st === "in") {
      setQuiz({ ...quiz, mine: i });
      return setNote(null);
    }
    setNote(st === "already" ? "You already answered this one." : st === "late" ? "Time’s up, so that answer didn’t count." : st === "changed" ? "The leader asked a new question." : null);
    setAgain((n) => n + 1);
  }
  const right = quiz.correct;
  const result = quiz.revealed && right !== null ? (quiz.mine === right ? "You got it!" : `The answer was ${LETTERS[right]}: ${quiz.options[right]}`) : null;
  return (
    <section className="fl-resp fl-quiz" aria-label="Quiz">
      <p className="fl-quiz-top">
        <span>Quiz</span>
        {!quiz.revealed && <span className="fl-quiz-time">{left > 0 ? `${left} s left` : "Time’s up"}</span>}
      </p>
      <h2 className="fl-resp-q">{quiz.question}</h2>
      <div className="fl-quiz-opts">
        {quiz.options.map((o, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={quiz.mine === i}
            disabled={closed || quiz.mine !== null || busy}
            className={right === i ? "fl-quiz-right" : quiz.revealed && quiz.mine === i ? "fl-quiz-wrong" : undefined}
            onClick={() => void pick(i)}
          >
            <span className="fl-quiz-l" aria-hidden="true">
              {LETTERS[i]}
            </span>
            <span>{o}</span>
          </button>
        ))}
      </div>
      <p className="fl-resp-note" role="status">
        {result ?? note ?? (quiz.mine !== null ? "Answer sent. The leader shows the answer soon." : closed ? "Time’s up. The leader shows the answer soon." : "Tap your answer. One try.")}
      </p>
    </section>
  );
}

/** True when a song on screen has chords for musicians. */
export const songHasChords = (song: Song | undefined) => !!song?.items?.some((it) => it.chords?.includes("["));

function ChordLine({ line, semis, flats }: Readonly<{ line: string; semis: number; flats: boolean | undefined }>) {
  if (/^\s*\{.*\}\s*$/.test(line)) return null; // a ChordPro directive ({title: …}, {comment: …})
  if (!line.trim()) return <div className="fl-ch-gap" />;
  const segs = parseChordLine(line);
  if (!lineHasChords(segs)) return <p className="fl-ch-line">{line}</p>;
  return (
    <p className="fl-ch-line fl-ch-has">
      {segs.map((s, i) => (
        <span key={i} className="fl-ch-seg">
          <b>{s.chord ? transposeChord(s.chord, semis, flats) : " "}</b>
          <span>{s.text || " "}</span>
        </span>
      ))}
    </p>
  );
}

/** The musicians' view: the whole song with chords over the words, the part on screen marked and kept in view, moved to
 * another key and shown as capo shapes (kept on this phone). */
export function ChordsView({ song }: Readonly<{ song: Song }>) {
  const [prefs, setPrefs] = useState<ChordPrefs>(() => readPrefs());
  const nowRef = useRef<HTMLElement>(null);
  const items = song.items ?? [];
  const at = Number.isInteger(song.at) ? (song.at as number) : -1;
  useEffect(() => {
    const html = document.documentElement;
    const move = html.classList.contains("fd-motion") && !html.classList.contains("fd-calm") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nowRef.current?.scrollIntoView({ block: "center", behavior: move ? "smooth" : "auto" });
  }, [at, song.title]);
  const change = (p: Partial<ChordPrefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    savePrefs(next);
  };
  const key = songKey(song.key ?? "", firstChord(items.map((it) => it.chords ?? "").join("\n")));
  const semis = prefs.shift - prefs.capo;
  const flats = key ? keyUsesFlats(keyAfter(key, semis)) : undefined;
  const sounds = key && song.key ? keyAfter(key, prefs.shift) : "";
  return (
    <article className="fl-ch">
      <header>
        <p className="fd-kicker">Chords</p>
        <h2 className="fl-notes-title">{song.title}</h2>
        {song.credit && <p className="fl-notes-sub">{song.credit}</p>}
      </header>
      <div className="fl-ch-tools">
        <span className="fl-ch-step" role="group" aria-label="Transpose">
          <span>Transpose</span>
          <button type="button" aria-label="Down a semitone" disabled={prefs.shift <= -11} onClick={() => change({ shift: prefs.shift - 1 })}>
            −
          </button>
          <output aria-live="polite">
            {prefs.shift > 0 ? `+${prefs.shift}` : prefs.shift}
            {sounds && ` · ${sounds}`}
          </output>
          <button type="button" aria-label="Up a semitone" disabled={prefs.shift >= 11} onClick={() => change({ shift: prefs.shift + 1 })}>
            +
          </button>
        </span>
        <span className="fl-ch-step" role="group" aria-label="Capo">
          <span>Capo</span>
          <button type="button" aria-label="Capo down" disabled={prefs.capo <= 0} onClick={() => change({ capo: prefs.capo - 1 })}>
            −
          </button>
          <output aria-live="polite">{prefs.capo}</output>
          <button type="button" aria-label="Capo up" disabled={prefs.capo >= 7} onClick={() => change({ capo: prefs.capo + 1 })}>
            +
          </button>
        </span>
      </div>
      {prefs.capo > 0 && (
        <p className="fl-resp-note">
          Capo {prefs.capo}: chords shown as shapes{key ? ` in ${keyAfter(key, semis)}` : ""}
          {sounds ? `, sounding in ${sounds}` : ""}.
        </p>
      )}
      {items.map((it, i) => (
        <section key={i} ref={i === at ? nowRef : undefined} className={i === at ? "fl-ch-item fl-ch-now" : "fl-ch-item"} aria-current={i === at ? "true" : undefined}>
          {it.label && <h3>{it.label}</h3>}
          {(it.chords || it.text || "").split("\n").map((line, j) => (
            <ChordLine key={j} line={line} semis={semis} flats={flats} />
          ))}
        </section>
      ))}
    </article>
  );
}

/** The take-home page for this code, or null (none published, or the workspace has no room_takehome yet). Looked at
 * again when key changes (the room's rev while it is open). */
export function useTakehome(supabase: SupabaseClient | null, code: string | null, key: string, on: boolean): Takehome | null {
  const [got, setGot] = useState<{ at: string; t: Takehome | null }>({ at: "", t: null });
  const at = `${code}:${key}`;
  useEffect(() => {
    if (!supabase || !code || !on) return;
    let gone = false;
    void supabase.rpc("room_takehome", { code }).then(
      ({ data, error }) => {
        const d = (data ?? {}) as { status?: string; body?: unknown };
        if (!gone) setGot({ at, t: !error && d.status === "ok" ? tidyTakehome(d.body) : null });
      },
      () => !gone && setGot({ at, t: null }),
    );
    return () => {
      gone = true;
    };
  }, [supabase, code, on, at]);
  // the last page stays shown while the next look is on its way, but only for the same code
  return on && got.at.startsWith(`${code}:`) ? got.t : null;
}

const fullDate = (d: string) => dayDate(d)?.toLocaleDateString(undefined, { dateStyle: "full" }) ?? "";

function List({ items }: Readonly<{ items: string[] }>) {
  return (
    <ul>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

/** The take-home page: the meeting, the leader's note, this week's verses, questions and songs, the sermon notes, prayer,
 * this phone's own requests and how they are going, the next meeting and the days between. */
export function TakeHomeView({ t }: Readonly<{ t: Takehome }>) {
  const [mine] = useState(readMyPrayers);
  const yours = myPrayerStates(mine, t.status);
  const join = t.next?.join ? joinTarget(t.next.join) : null;
  const week = t.verses.length > 0 || t.questions.length > 0 || t.songs.length > 0;
  const accent = t.color ? ({ "--th": t.color } as CSSProperties) : undefined;
  return (
    <article className="fl-notes fl-th" style={accent}>
      <header className="fl-th-head">
        <p className="fd-kicker">Take-home</p>
        <h2 className="fl-notes-title">{t.meeting || "This week"}</h2>
        <p className="fl-notes-sub">{[t.org, fullDate(t.date)].filter(Boolean).join(" · ")}</p>
      </header>
      {t.note && (
        <section className="fl-th-note">
          {paragraphs(t.note).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      )}
      {week && (
        <section className="fl-sec">
          <h3>This week</h3>
          {t.verses.map((v, i) => (
            <blockquote key={i}>
              {v.text && <p>{v.text}</p>}
              <cite>
                {v.ref}
                {v.version ? ` (${v.version})` : ""}
              </cite>
            </blockquote>
          ))}
          {t.questions.length > 0 && (
            <>
              <p className="fl-reflect">To reflect on</p>
              <List items={t.questions} />
            </>
          )}
          {t.songs.length > 0 && (
            <>
              <p className="fl-reflect">Songs</p>
              <ul>
                {t.songs.map((s, i) => (
                  <li key={i}>
                    {s.title}
                    {s.credit && <span className="fl-th-soft"> · {s.credit}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {t.notes && (
        <section className="fl-sec">
          <h3>Sermon notes</h3>
          {paragraphs(t.notes).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      )}
      {t.prayers.length > 0 && (
        <section className="fl-sec">
          <h3>Praying for</h3>
          <List items={t.prayers} />
        </section>
      )}
      {t.answered.length > 0 && (
        <section className="fl-sec">
          <h3>Answered prayers</h3>
          <List items={t.answered} />
        </section>
      )}
      {yours.length > 0 && (
        <section className="fl-sec">
          <h3>Your prayer requests</h3>
          <ul className="fl-th-mine">
            {yours.map((p) => (
              <li key={p.id}>
                <span>{p.text || "Your request"}</span>
                <span className={p.state === "answered" ? "fl-th-tag fl-th-yes" : "fl-th-tag"}>{p.state === "answered" ? "Answered" : "Still praying"}</span>
              </li>
            ))}
          </ul>
          <p className="fl-resp-note">Only this phone knows these are yours.</p>
        </section>
      )}
      {t.next && (
        <section className="fl-sec fl-th-next">
          <h3>Next time</h3>
          <p>
            <b>{t.next.name}</b>
            {(t.next.date || t.next.time) && <span className="fl-th-soft"> · {[fullDate(t.next.date), t.next.time].filter(Boolean).join(", ")}</span>}
          </p>
          {t.next.read.length > 0 && (
            <>
              <p className="fl-reflect">Read before</p>
              <List items={t.next.read} />
            </>
          )}
          {t.next.questions.length > 0 && (
            <>
              <p className="fl-reflect">Questions to think about</p>
              <List items={t.next.questions} />
            </>
          )}
          {join && (
            <p>
              Join: {join.href ? <a href={join.href} rel={join.href.startsWith("https:") ? "noopener noreferrer" : undefined}>{join.text}</a> : join.text}
            </p>
          )}
        </section>
      )}
      {t.days.length > 0 && (
        <section className="fl-sec">
          <h3>Between meetings</h3>
          <dl className="fl-th-days">
            {t.days.map((d, i) => (
              <div key={i}>
                <dt>{d.label}</dt>
                <dd>{d.read}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <Button className="auth-primary fl-print" type="button" onClick={() => window.print()}>
        Save as PDF or print
      </Button>
    </article>
  );
}
