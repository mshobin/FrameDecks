"use client";

import "@/app/join.css";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { codeFromHash, codeProblem, guessDeviceName, isShortCode, tidyCode, type JoinRole } from "@/lib/join-code";
import { finishDevice, startDevice, takeHashCode } from "@/lib/join-device";
import { signInWithCode } from "@/lib/quick-sign-in";
import { TERMS_VERSION } from "@/lib/legal";
import { PRAYER_MAX, PRAYER_NAME_MAX, isPrayerCode, prayerCodeFromHash, tidyPrayerCode } from "@/lib/prayer-code";
import { percentages, tidyResponse, voterId, type RoomResponse } from "@/lib/room-responses";
import { browserSupabase } from "@/lib/supabase-browser";
import { useSession, useSessionAtArrival } from "@/lib/use-session";
import { userSafeError } from "@/lib/user-error";

type Peek =
  | { status: "invite"; team: string; role: JoinRole; byPc: boolean }
  | { status: "self"; team: string; who: string | null; byPc: boolean }
  | { status: "pc"; pc: string }
  | { status: "expired" | "unknown" };

const TOO_MANY = "Too many wrong codes from this device or network. Wait an hour, then try again.";
const CHECK_FAILED = "Couldn’t check the code. Check your connection and try again.";

/** 26.11.12 /join: a phone scanned the QR code shown by the church PC or by a device already in (/join#c=CODE), or a
 * code is typed. The code is looked at first, with no session, so a wrong code never makes a new device. */
export function JoinPanel() {
  const supabase = browserSupabase();
  const session = useSession();
  const arrived = useSessionAtArrival(session);
  const [code, setCode] = useState<string | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [checking, setChecking] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [termsAsked, setTermsAsked] = useState(false);
  const [teams, setTeams] = useState<{ id: string; name: string }[] | null>(null);
  const [org, setOrg] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const look = useCallback(
    async (c: string) => {
      if (!supabase) return;
      setChecking(true);
      setProblem(null);
      setTeams(null);
      const { data, error } = await supabase.rpc("join_code_peek", { code: c });
      setChecking(false);
      if (error) {
        setPeek(null);
        setProblem(codeProblem(error) === "too-many" ? TOO_MANY : userSafeError(error, CHECK_FAILED));
        return;
      }
      setCode(c);
      setPeek(data as Peek);
    },
    [supabase],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(guessDeviceName());
    const c = takeHashCode(codeFromHash);
    if (c) void look(c);
  }, [look]);

  if (!supabase) {
    return (
      <p className="auth-message" role="status">
        Workspace sync is not set up for this site yet. The rest of FrameDecks works without it.
      </p>
    );
  }

  const fresh = arrived === false;                      // a new device: no session on this browser when it came
  const needTerms = (fresh || termsAsked) && peek?.status !== "self"; // a self code signs in to an account that agreed already
  const ready = peek?.status === "invite" || peek?.status === "pc" || peek?.status === "self";

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !code || busy || (needTerms && !agreed)) return;
    setBusy(true);
    setProblem(null);
    const deviceName = name.trim() || guessDeviceName();
    if (peek?.status === "self") {
      // 26.11.26 Add a device: this phone signs in as the person themselves (no guest account, no approval)
      const done = await signInWithCode(supabase, code, deviceName);
      if (done.problem) {
        setBusy(false);
        setProblem(done.problem);
        return;
      }
      await finishDevice(supabase, deviceName, !shared, done.organizationId);
      return;
    }
    const started = await startDevice(supabase, shared);
    if (started) {
      setBusy(false);
      setProblem(started);
      return;
    }
    if (needTerms && agreed) await supabase.rpc("accept_terms", { version: TERMS_VERSION }).then(() => undefined, () => undefined);
    const { data, error } = await supabase.rpc("join_with_code", { code, device_name: deviceName, ...(org ? { org } : {}) });
    if (error) {
      setBusy(false);
      const kind = codeProblem(error);
      if (kind === "terms") {
        setTermsAsked(true);
        setProblem("This starts a new team on this device. Tick the box to agree to the Terms first.");
      } else setProblem(kind === "too-many" ? TOO_MANY : userSafeError(error, "Couldn’t join with this code. Try again."));
      return;
    }
    const answer = data as { status: string; organizationId?: string; teams?: { id: string; name: string }[] };
    if (answer.status === "choose") {
      setBusy(false);
      setTeams(answer.teams ?? []);
      setOrg(answer.teams?.[0]?.id ?? "");
      return;
    }
    if (answer.status !== "joined" && answer.status !== "linked") {
      setBusy(false);
      setPeek({ status: "expired" });
      return;
    }
    await finishDevice(supabase, deviceName, fresh && !shared, answer.organizationId);
  }

  const title = !peek
    ? "Join a team"
    : peek.status === "self"
      ? `Open ${peek.team} here`
      : peek.status === "invite"
      ? `Join ${peek.team}`
      : peek.status === "pc"
        ? "Connect the church PC"
        : peek.status === "expired"
          ? "This code has run out"
          : "That code doesn’t match";

  return (
    <>
      <h1 className="fd-auth-title">{title}</h1>

      {peek?.status === "invite" && (
        <p className="jc-ask">
          Join <strong>{peek.team}</strong> as {peek.role === "admin" ? "an Admin" : "a Helper"}.
          {peek.byPc && " The code came from your church PC."}
        </p>
      )}
      {peek?.status === "self" && (
        <p className="jc-ask">
          This device opens your workspace as {peek.who ? <strong>{peek.who}</strong> : "you"}
          {peek.byPc ? ", from your church PC." : "."} Nothing to type, nothing to remember.
        </p>
      )}
      {peek?.status === "pc" && (
        <>
          <p className="jc-ask">
            Connect <strong>{peek.pc}</strong> to your team.
          </p>
          <p className="jc-note">Its plans then sync by themselves. If this device isn’t in a team yet, this starts one and you are its owner.</p>
        </>
      )}
      {(peek?.status === "expired" || peek?.status === "unknown") && (
        <p className="jc-note">
          {peek.status === "expired"
            ? "Codes last 2 minutes and work once. Ask for a fresh one on the screen that showed it, then scan again."
            : "Check the letters and try again, or scan the QR code instead."}
        </p>
      )}

      {ready && !teams && (
        <form onSubmit={join}>
          <label className="jc-field">
            Name this device
            <input value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          </label>
          {(fresh || peek?.status === "self") && (
            <label className="auth-agree">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
              <span>This is a shared computer: forget me when I close this tab.</span>
            </label>
          )}
          {needTerms && (
            <label className="auth-agree">
              <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                I agree to the <Link href="/terms">Terms of Service</Link> and the <Link href="/privacy">Privacy Policy</Link>.
              </span>
            </label>
          )}
          <Button className="auth-primary" type="submit" disabled={busy || (needTerms && !agreed)}>
            {busy ? "Joining…" : peek?.status === "pc" ? "Connect the PC" : peek?.status === "self" ? "Open my workspace" : "Join"}
          </Button>
        </form>
      )}

      {teams && (
        <form onSubmit={join}>
          <fieldset className="jc-roles">
            <legend>Which team should the PC join?</legend>
            {teams.map((t) => (
              <label key={t.id}>
                <input type="radio" name="team" value={t.id} checked={org === t.id} onChange={() => setOrg(t.id)} />
                {t.name}
              </label>
            ))}
          </fieldset>
          <Button className="auth-primary" type="submit" disabled={busy || !org}>
            {busy ? "Connecting…" : "Connect to this team"}
          </Button>
        </form>
      )}

      {!ready && (
        <CodeBox
          prompt={peek ? "Try another code" : "Type the code from the other screen"}
          button="Check the code"
          placeholder="K7PM 2XQ9"
          busy={checking}
          read={(t) => (isShortCode(t) ? tidyCode(t) : null)}
          onCode={(c) => void look(c)}
          onBad={() => setProblem("Codes have 8 letters and numbers, as shown on the other screen. Spaces don’t matter. (FD-CLD-01)")}
        />
      )}

      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
      {checking && (
        <p className="auth-message" role="status">
          Checking the code…
        </p>
      )}
    </>
  );
}

// 26.11.23 /pray lives here too: the same kind of page (a code from the church PC's screen), one shared chunk.

/** 26.11.24 the prayer request form on /follow (the room passes the open prayer wall's code; 26.11.23's /pray page is
 * folded into /follow: one page and one code for members). */
function PrayerForm({ code }: Readonly<{ code: string }>) {
  const supabase = browserSupabase();
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setProblem(null);
    const { error } = await supabase.rpc("prayer_send", { code, body: body.trim(), name: name.trim() || null });
    setBusy(false);
    if (error) {
      setProblem(userSafeError(error, "Couldn’t send your request. Check your connection and try again."));
      return;
    }
    setSent(name.trim());
    setBody("");
  }

  if (sent !== null) {
    return (
      <p className="auth-message" role="status">
        Thank you. The leader reads it first and chooses what is shared{sent ? "" : ", without your name"}.
      </p>
    );
  }
  return (
    <form onSubmit={send}>
      <label className="jc-field">
        Your prayer request
        <textarea value={body} maxLength={PRAYER_MAX} rows={5} required onChange={(e) => setBody(e.target.value)} placeholder="What would you like us to pray for?" />
      </label>
      <label className="jc-field">
        Your first name (optional)
        <input value={name} maxLength={PRAYER_NAME_MAX} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="auth-message">Leave your name empty to stay anonymous. The leader reads it first; nothing is kept online.</p>
      <Button className="auth-primary" type="submit" disabled={busy || body.trim().length < 2}>
        {busy ? "Sending…" : "Send my request"}
      </Button>
      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}

/** The code box of /join (8 characters) and /follow (6): what was typed is tidied by read(), or refused. */
function CodeBox(p: Readonly<{ prompt: string; button: string; placeholder: string; busy: boolean; read: (t: string) => string | null; onCode: (c: string) => void; onBad: () => void }>) {
  const [typed, setTyped] = useState("");
  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        const c = p.read(typed);
        if (!c) return p.onBad();
        setTyped("");
        p.onCode(c);
      }}
    >
      <label htmlFor="code-in">{p.prompt}</label>
      <input id="code-in" className="jc-type" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={p.placeholder} />
      <Button className="auth-primary" type="submit" disabled={p.busy || !typed.trim()}>
        {p.busy ? "Checking…" : p.button}
      </Button>
    </form>
  );
}

// ---------- 26.11.24 /follow: members' phones (0020_member_room.sql) ----------
type Screen = {
  live?: boolean;
  black?: boolean;
  meeting?: string;
  frame?: string;
  prayer?: string;
  question?: { label: string; text: string };
  verse?: { ref: string; text: string };
};
type Notes = {
  title: string;
  date: number;
  presenter?: string;
  sections: { frame: string; script: string; verses: { ref: string; text: string }[]; questions: string[] }[];
};
type Room = { status: "open" | "closed" | "unknown"; rev?: number; team?: string; screen?: Screen; notes?: Notes | null; same?: boolean };

function NotesView({ notes }: Readonly<{ notes: Notes }>) {
  return (
    <article className="fl-notes">
      <p className="fd-kicker">Sermon notes</p>
      <h2 className="fl-notes-title">{notes.title}</h2>
      <p className="fl-notes-sub">
        {new Date(notes.date).toLocaleDateString(undefined, { dateStyle: "full" })}
        {notes.presenter ? ` · ${notes.presenter}` : ""}
      </p>
      {notes.sections.map((s, i) => (
        <section key={i} className="fl-sec">
          <h3>{s.frame}</h3>
          {s.script.split(/\n\s*\n/).map((para, j) => (para.trim() ? <p key={j}>{para.trim()}</p> : null))}
          {s.verses.map((v) => (
            <blockquote key={v.ref}>
              {v.text && <p>{v.text}</p>}
              <cite>{v.ref}</cite>
            </blockquote>
          ))}
          {s.questions.length > 0 && (
            <>
              <p className="fl-reflect">To reflect on</p>
              <ul>
                {s.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      ))}
      <Button className="auth-primary fl-print" type="button" onClick={() => window.print()}>
        Save as PDF or print
      </Button>
    </article>
  );
}

function ScreenView({ s }: Readonly<{ s: Screen }>) {
  if (!s.live) return <p className="fl-quiet">Nothing on screen yet. This page follows the meeting screen.</p>;
  if (s.black) return <p className="fl-quiet">The meeting screen is dark for a moment.</p>;
  return (
    <div className="fl-screen" aria-live="polite">
      <p className="fl-frame">{s.frame}</p>
      {s.verse && (
        <blockquote className="fl-verse">
          {s.verse.text && <p>{s.verse.text}</p>}
          <cite>{s.verse.ref}</cite>
        </blockquote>
      )}
      {s.question && (
        <div className="fl-q">
          <p className="fl-q-label">{s.question.label}</p>
          <p>{s.question.text}</p>
        </div>
      )}
    </div>
  );
}

/** 26.11.33 a quick response or poll the leader opened (0022_room_polls.sql): big answers to tap, the answer kept and
 * changeable while the question is open, and calm bars when the leader shows the results. */
function ResponseBox({ r, problem, onAnswer }: Readonly<{ r: RoomResponse; problem: string | null; onAnswer: (i: number) => void }>) {
  const pct = r.counts && percentages(r.counts);
  // a rating's stars are drawn by join.css (.fl-rating), so a screen reader hears the number and the note below
  return (
    <section className={`fl-resp fl-${r.kind}`}>
      <h2 className="fl-resp-q">{r.question}</h2>
      <div className="fl-resp-opts">
        {r.options.map((o, i) => (
          <button key={i} aria-pressed={r.mine === i} onClick={() => onAnswer(i)}>
            {o}
          </button>
        ))}
      </div>
      <p className="fl-resp-note" role="status">
        {r.mine !== null ? "Thanks, your answer is in. You can still change it." : r.kind === "rating" ? "1 is low, 5 is high." : "Nobody sees who answered what."}
      </p>
      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
      {pct && (
        <div className="fl-bars" aria-live="polite">
          {r.options.map((o, i) => (
            <div key={i} className="fl-bar">
              <span>{o}</span>
              <span>{pct[i]}%</span>
              <span className="fl-bar-track">
                <span style={{ width: `${pct[i]}%` }} />
              </span>
            </div>
          ))}
          <p className="fl-resp-note">Answers so far: {r.total}</p>
        </div>
      )}
    </section>
  );
}

/** 26.11.24 /follow: everyone in the meeting, on their own phone, with only the code: what is on the meeting screen as
 * it changes, a prayer request when the leader takes them, and the sermon notes once shared. Asks every 3 seconds while
 * the page is in view (a tiny answer when nothing changed); nothing is stored. */
export function FollowPanel() {
  const supabase = browserSupabase();
  const [code, setCode] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [tab, setTab] = useState<"screen" | "pray" | "notes">("screen");
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // 26.11.33 a quick response or poll: looked at again whenever the room changes (opening or closing one moves the
  // room's rev), and with each look while one is open (a tiny answer when nothing changed)
  const [resp, setResp] = useState<{ rev: number; r: RoomResponse | null }>({ rev: 0, r: null });
  const [answerProblem, setAnswerProblem] = useState<string | null>(null);
  const lookResponse = useCallback(
    async (c: string, after = 0) => {
      if (!supabase) return;
      const { data, error } = await supabase.rpc("room_response", { code: c, after, voter: voterId() });
      const d = (data ?? {}) as { status?: string; rev?: number; same?: boolean; response?: unknown };
      if (!error && !d.same) setResp({ rev: Number(d.rev) || 0, r: d.status === "open" ? tidyResponse(d.response) : null });
    },
    [supabase],
  );

  const look = useCallback(
    async (c: string, rev = 0) => {
      if (!supabase) return;
      if (!rev) setChecking(true);
      const { data, error } = await supabase.rpc("room_view", { code: c, after: rev });
      setChecking(false);
      if (error) {
        if (!rev) setProblem(codeProblem(error) === "too-many" ? TOO_MANY : userSafeError(error, CHECK_FAILED));
        return;
      }
      setProblem(null);
      setCode(c);
      const r = data as Room;
      setRoom((old) => (r.same && old ? old : r));
      if (!r.same) void lookResponse(c);
    },
    [supabase, lookResponse],
  );

  useEffect(() => {
    const c = takeHashCode(prayerCodeFromHash);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (c) void look(c);
  }, [look]);

  const rev = room?.status === "open" ? (room.rev ?? 0) : -1;
  const respRev = resp.r ? resp.rev : -1;
  useEffect(() => {
    if (!code || rev < 0) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void look(code, rev);
        if (respRev >= 0) void lookResponse(code, respRev);
      }
    }, 3000);
    return () => window.clearInterval(t);
  }, [code, rev, respRev, look, lookResponse]);

  async function answer(i: number) {
    if (!supabase || !code || !resp.r) return;
    // the look that follows brings this phone's answer back (or the next question, if the leader asked another)
    const { error } = await supabase.rpc("room_respond", { code, voter: voterId(), choice: i, response: resp.r.id });
    setAnswerProblem(error && userSafeError(error, "Couldn’t send your answer. Try again."));
    void lookResponse(code);
  }

  if (!supabase) return <p className="auth-message">Following the meeting is not available here right now.</p>;
  if (!room || room.status !== "open" || !code) {
    return (
      <>
        <h1 className="fd-auth-title">Follow the meeting</h1>
        {room && <p className="auth-message">{room.status === "closed" ? "This meeting page is closed. Thank you for joining." : "That code isn’t open. Check the code on the meeting screen."}</p>}
        <CodeBox
          prompt={room ? "Try another code" : "Type the code on the meeting screen"}
          button="Follow the meeting"
          placeholder="K7PM2X"
          busy={checking}
          read={(t) => (isPrayerCode(t) ? tidyPrayerCode(t) : null)}
          onCode={(c) => void look(c)}
          onBad={() => setProblem("Meeting codes have 6 letters and numbers, shown on the meeting screen.")}
        />
        {problem && (
          <p className="auth-error" role="alert">
            {problem}
          </p>
        )}
      </>
    );
  }
  const s = room.screen ?? {};
  const tabs: ["screen" | "pray" | "notes", string][] = [["screen", "On screen"]];
  if (s.prayer) tabs.push(["pray", "Prayer"]);
  if (room.notes) tabs.push(["notes", "Notes"]);
  const shown = tabs.some(([k]) => k === tab) ? tab : "screen";
  return (
    <div className="fl">
      <p className="fl-team">
        {s.live && <span className="fl-live">Live</span>}
        {s.meeting || room.team}
      </p>
      {tabs.length > 1 && (
        <div className="fl-tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={shown === k} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {shown === "screen" && <ScreenView s={s} />}
      {shown === "screen" && resp.r && <ResponseBox r={resp.r} problem={answerProblem} onAnswer={(i) => void answer(i)} />}
      {shown === "pray" && s.prayer && <PrayerForm code={s.prayer} />}
      {shown === "notes" && room.notes && <NotesView notes={room.notes} />}
    </div>
  );
}
