"use client";

import "@/app/join.css";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { ConnectSteps, settle, type StepState } from "@/components/connect-steps";
import { SlidePicture, SlideViewer, useShownSlides, type ShownSlide } from "@/components/follow-slides";
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
  const [opened, setOpened] = useState<string | null>(null);

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
      return data as Peek;
    },
    [supabase],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(guessDeviceName());
    // 26.11.37 opened by the PC's "Open in this PC's browser" (#c=…&go=1): opens without a click
    const go = /(^|[#&])go=1(&|$)/.test(window.location.hash);
    const c = takeHashCode(codeFromHash);
    if (c)
      void look(c).then((p) => {
        if (go && p?.status === "self") window.setTimeout(() => document.getElementById("jc-join-go")?.click(), 60);
      });
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

  const openAs = async (organizationId?: string | null, team?: string | null) => {
    setOpened(team || (peek && "team" in peek ? peek.team : null) || "your workspace");
    await settle();                                  // 26.11.37 the last tick and the workspace light up first
    await finishDevice(supabase!, name.trim() || guessDeviceName(), (fresh || peek?.status === "self") && !shared, organizationId);
  };

  async function join(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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
      await openAs(done.organizationId);
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
    await openAs(answer.organizationId, teams?.find((t) => t.id === answer.organizationId)?.name);
  }

  // 26.11.37 the way in as a flowchart: the code, this device, the workspace opening
  const plan: string[] | null =
    peek?.status === "self"
      ? [peek.byPc ? "Your PC made a one-time code" : "A one-time code for you", `This browser opens as ${peek.who || "you"}`, `${peek.team} opens`]
      : peek?.status === "pc"
        ? [`${peek.pc} shows a code`, "This device joins as the owner", `${peek.pc} connects to your workspace`, "Your workspace opens"]
        : peek?.status === "invite"
          ? [`An invitation to ${peek.team}`, `This device joins as ${peek.role === "admin" ? "an Admin" : "a Helper"}`, `${peek.team} opens`]
          : null;
  const flow = plan && (
    <ConnectSteps
      label="Opening your workspace"
      team={opened}
      name={peek && "team" in peek ? peek.team : null}
      steps={plan.map((t, i): [string, StepState] => [t, opened || i === 0 || (busy && i === 1) ? "done" : i === (busy ? 2 : 1) ? "now" : "next"])}
    />
  );

  const title = !peek
    ? "Join a team"
    : peek.status === "self"
      ? `Open ${peek.team} here`
      : peek.status === "invite"
      ? `Join ${peek.team}`
      : peek.status === "pc"
        ? `Connect ${peek.pc}`
        : peek.status === "expired"
          ? "This code has run out"
          : "That code doesn’t match";

  return (
    <>
      <h1 className="fd-auth-title">{title}</h1>
      {flow}

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
          <Button id="jc-join-go" className="auth-primary" type="submit" disabled={busy || (needTerms && !agreed)}>
            {busy ? "Opening…" : peek?.status === "pc" ? "Connect and open my workspace" : peek?.status === "self" ? "Open my workspace" : "Join"}
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
      <p className="auth-message">Leave your name empty and the leader won’t see who sent it. The leader reads it first. It is held online only until the church PC takes it in, at most 24 hours (<Link href="/privacy">Privacy</Link>).</p>
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
  slide?: { n: number; of: number; page?: number; title?: string; text?: string; img?: string; off?: boolean };
};
type Notes = {
  title: string;
  date: number;
  presenter?: string;
  sections: { frame: string; script: string; verses: { ref: string; text: string }[]; questions: string[] }[];
  slides?: boolean; // 26.11.48 the leader shared the slides shown with the notes
};
type Pictures = (p: number) => Promise<string | null>;
type Room = { status: "open" | "closed" | "unknown"; rev?: number; team?: string; screen?: Screen; notes?: Notes | null; same?: boolean };

function NotesView({ notes, slides, picture }: Readonly<{ notes: Notes; slides: ShownSlide[] | null; picture: Pictures }>) {
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
      {notes.slides && slides && slides.length > 0 && (
        <section className="fl-sec fl-handout">
          <h3>Slides</h3>
          {slides.map((x) => (
            <figure key={x.page}>
              <SlidePicture page={x.page} label={x.title ? `Slide ${x.page + 1}: ${x.title}` : `Slide ${x.page + 1}`} picture={picture} />
              <figcaption>
                <b>
                  {x.page + 1}. {x.title}
                </b>
                {x.body && <span>{x.body}</span>}
              </figcaption>
            </figure>
          ))}
        </section>
      )}
      <Button className="auth-primary fl-print" type="button" onClick={() => window.print()}>
        Save as PDF or print
      </Button>
    </article>
  );
}

function ScreenView({ s, onSlide, earlier }: Readonly<{ s: Screen; onSlide: () => void; earlier: boolean }>) {
  if (!s.live) return <p className="fl-quiet">Nothing on screen yet. This page follows the meeting screen.</p>;
  if (s.black) return <p className="fl-quiet">The meeting screen is dark for a moment.</p>;
  return (
    <div className="fl-screen" aria-live="polite">
      <p className="fl-frame">{s.frame}</p>
      {s.slide?.off && <p className="fl-quiet">This slide is not shown on phones.</p>}
      {s.slide && !s.slide.off && (
        <figure className="fl-slide">
          {s.slide.img?.startsWith("data:image/jpeg;base64,") && (
            <button type="button" className="fl-slide-open" onClick={onSlide} aria-label={`Open slide ${s.slide.n} full screen to zoom in`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a small picture of the slide on the meeting screen */}
              <img src={s.slide.img} alt={s.slide.title ? `Slide: ${s.slide.title}` : `Slide ${s.slide.n}`} />
              <span className="fl-slide-zoom" aria-hidden="true">
                Tap to zoom
              </span>
            </button>
          )}
          {earlier && (
            <button type="button" className="fl-slide-back" onClick={onSlide}>
              ◀ Earlier slides
            </button>
          )}
          <figcaption>
            <span className="fl-slide-n">
              Slide {s.slide.n} of {s.slide.of}
            </span>
            {s.slide.title && <b>{s.slide.title}</b>}
            {s.slide.text && <span className="fl-slide-t">{s.slide.text}</span>}
          </figcaption>
        </figure>
      )}
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

/** 26.11.57 typed answers (0026_room_answers.sql): when the leader asks people to type a short answer, a box under the
 * screen. One answer per phone, changeable while the prompt is open; the leader reads them first and chooses what is
 * shown, never with a name. Looked at again whenever the room changes (opening or closing a prompt moves its rev). */
function AnswerBox({ code, roomRev }: Readonly<{ code: string; roomRev: number }>) {
  const supabase = browserSupabase();
  const [prompt, setPrompt] = useState<{ id: string; text: string; mine: string | null } | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void supabase.rpc("room_prompt", { code, voter: voterId() }).then(({ data }) => {
      const p = (data as { prompt?: { id?: string; text?: string; mine?: string | null } } | null)?.prompt;
      if (!gone) setPrompt(p?.id && p.text ? { id: p.id, text: p.text, mine: p.mine ?? null } : null);
    });
    return () => {
      gone = true;
    };
  }, [supabase, code, roomRev]);
  if (!prompt || !supabase) return null;
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !prompt || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("room_answer", { code, voter: voterId(), body: body.trim(), prompt: prompt.id });
    setBusy(false);
    const st = (data as { status?: string } | null)?.status;
    setProblem(error ? userSafeError(error, "Couldn’t send your answer. Try again.") : st === "in" ? null : "The leader has moved on.");
    if (st === "in") {
      setPrompt({ ...prompt, mine: body.trim() });
      setBody("");
    }
  }
  return (
    <form className="fl-resp fl-answer" onSubmit={send}>
      <h2 className="fl-resp-q">{prompt.text}</h2>
      {prompt.mine && <p className="fl-resp-note">Your answer: “{prompt.mine}”</p>}
      <label className="jc-field">
        {prompt.mine ? "Change your answer" : "Your answer"}
        <textarea value={body} maxLength={280} rows={3} onChange={(e) => setBody(e.target.value)} />
      </label>
      <Button className="auth-primary" type="submit" disabled={busy || !body.trim()}>
        {busy ? "Sending…" : "Send"}
      </Button>
      <p className="fl-resp-note" role="status">
        The leader reads answers first and shows some without names.
      </p>
      {problem && (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}
    </form>
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
  // 26.11.48 the slides shown so far (0025), looked at again when the slide on screen changes; the one open full screen
  const [viewing, setViewing] = useState<number | null>(null);
  const sl = room?.screen?.slide;
  const slides = useShownSlides(supabase, room?.status === "open" ? code : null, sl ? `${sl.page}:${sl.img?.length ?? 0}` : "", Number.isInteger(sl?.page) ? (sl?.page as number) : null);
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

  if (!supabase || !room || room.status !== "open" || !code) {
    return (
      <main className="fd-auth fd-auth-single fl-entry" id="main" tabIndex={-1}>
        <section className="fd-auth-card">
          <FollowBrand />
          <p className="fd-kicker">Members’ phones</p>
          <h1 className="fd-auth-title">Follow the meeting</h1>
          {supabase ? <FollowCode room={room} checking={checking} problem={problem} onCode={(c) => void look(c)} onBad={setProblem} /> : <p className="auth-message">Following the meeting is not available here right now.</p>}
        </section>
      </main>
    );
  }
  const s = room.screen ?? {};
  const tabs: ["screen" | "pray" | "notes", string][] = [["screen", "On screen"]];
  if (s.prayer) tabs.push(["pray", "Prayer"]);
  if (room.notes) tabs.push(["notes", "Notes"]);
  const shown = tabs.some(([k]) => k === tab) ? tab : "screen";
  const cur = s.live && s.slide && !s.slide.off && Number.isInteger(s.slide.page) ? (s.slide.page as number) : null;
  // the slides to look back at: those shown so far, and always the one on screen (it may not be in the list yet)
  const history: ShownSlide[] = (slides.list ?? []).slice();
  if (cur !== null && !history.some((x) => x.page === cur)) history.push({ page: cur, title: s.slide?.title ?? "", body: s.slide?.text ?? "" });
  history.sort((a, b) => a.page - b.page);
  return (
    <main className="fl-app" id="main" tabIndex={-1}>
      <header className="fl-head">
        <FollowBrand />
        <p className="fl-meeting">
          {s.live && <span className="fl-live">Live</span>}
          <span>{s.meeting || room.team}</span>
        </p>
      </header>
      <div className="fl-body">
        {shown === "screen" && <ScreenView s={s} onSlide={() => cur !== null && setViewing(cur)} earlier={history.length > 1} />}
        {shown === "screen" && resp.r && <ResponseBox r={resp.r} problem={answerProblem} onAnswer={(i) => void answer(i)} />}
        {shown === "screen" && <AnswerBox code={code} roomRev={rev} />}
        {shown === "pray" && s.prayer && <PrayerForm code={s.prayer} />}
        {shown === "notes" && room.notes && <NotesView notes={room.notes} slides={slides.list} picture={slides.picture} />}
      </div>
      {tabs.length > 1 && (
        <nav className="fl-tabs" role="tablist" aria-label="Follow the meeting">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={shown === k} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
      )}
      {viewing !== null && (
        <SlideViewer
          slides={history}
          start={viewing}
          current={cur ?? -1}
          picture={slides.picture}
          small={s.slide?.img?.startsWith("data:image/jpeg;base64,") ? s.slide.img : null}
          onClose={() => setViewing(null)}
        />
      )}
    </main>
  );
}

/** The FrameDecks emblem and name at the top of the members' page */
function FollowBrand() {
  return (
    <span className="fl-brand">
      {/* eslint-disable-next-line @next/next/no-img-element -- the small emblem; no image component for one icon */}
      <img src="/framedecks-emblem.webp" alt="" width={28} height={28} />
      <span>FrameDecks</span>
    </span>
  );
}

function FollowCode({
  room,
  checking,
  problem,
  onCode,
  onBad,
}: Readonly<{ room: Room | null; checking: boolean; problem: string | null; onCode: (c: string) => void; onBad: (m: string) => void }>) {
  return (
      <>
        {room && <p className="auth-message">{room.status === "closed" ? "This meeting page is closed. Thank you for joining." : "That code isn’t open. Check the code on the meeting screen."}</p>}
        <CodeBox
          prompt={room ? "Try another code" : "Type the code on the meeting screen"}
          button="Follow the meeting"
          placeholder="K7PM2X"
          busy={checking}
          read={(t) => (isPrayerCode(t) ? tidyPrayerCode(t) : null)}
          onCode={onCode}
          onBad={() => onBad("Meeting codes have 6 letters and numbers, shown on the meeting screen.")}
        />
        <p className="auth-message">No account needed. You see only what the leader shares, while the meeting page is open (<Link href="/privacy">Privacy</Link>).</p>
        {problem && (
          <p className="auth-error" role="alert">
            {problem}
          </p>
        )}
      </>
  );
}
