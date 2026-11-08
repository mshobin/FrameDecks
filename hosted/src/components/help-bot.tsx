"use client";

// FrameDecks 26.11.4 - Ask Help: a small helper in the Help Center that answers from the Help Center itself (no AI,
// nothing sent anywhere). Tap a problem and it walks through it one question at a time (the same steps as the
// program's Check my connection and the Troubleshooting topic); type anything and it finds the best Help pages; type
// an error code (FD-NET-02) and it explains that code. Every answer ends with "Did that help?" and, if not, Contact.
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import codes from "../../content/help-codes.json";
import { searchHelp, type HelpEntry } from "@/lib/help-search";

type Code = { code: string; area: string; title: string; why: string; fix: string };
type Step = { say: ReactNode; options?: [string, string][]; answer?: boolean };

// One question at a time. Each answer is a fact from the guides; keep them in step with docs/guide/troubleshooting.md.
const STEPS: Record<string, Step> = {
  start: {
    say: "Hello. What do you need help with? Choose one, or type your question below.",
    options: [
      ["My phone won’t connect", "phone"],
      ["FrameDecks vCam isn’t in Zoom or Teams", "vcam"],
      ["Something wrong is on screen", "screen"],
      ["The website and the PC don’t match", "sync"],
      ["Windows asks before installing", "install"],
      ["I have an error code", "code"],
    ],
  },
  phone: {
    say: "Are the phone and the PC on the same Wi-Fi? (Not a guest Wi-Fi, and not mobile data.)",
    options: [
      ["Yes, the same Wi-Fi", "phone2"],
      ["No, or I’m not sure", "phoneWifi"],
    ],
  },
  phoneWifi: {
    say: "Put both on the same Wi-Fi first: the phone remote talks to the PC across your own network. Guest networks usually keep devices apart. Away from the building, use the website’s Live page instead.",
    answer: true,
  },
  phone2: {
    say: (
      <>
        On the PC, open <b>Settings → Phone &amp; iPad Remote</b> and choose <b>Check my connection</b>. It goes through every step and
        shows a code for the first one that needs fixing. What does it show?
      </>
    ),
    options: [
      ["A red step with a code", "code"],
      ["Everything green, but the phone still can’t open it", "phoneBlocked"],
      ["I can’t find it", "phoneFind"],
    ],
  },
  phoneBlocked: {
    say: "Then the PC is ready and something between them is blocking it (FD-NET-05): a guest Wi-Fi, the router keeping devices apart, or security software such as Norton or McAfee. Allow FrameDecks in that software, or try both devices on a phone hotspot to check.",
    answer: true,
  },
  phoneFind: {
    say: (
      <>
        In FrameDecks, choose the gear (Settings), then <b>Controls → Phone &amp; iPad Remote</b>. The button <b>Check my connection</b> is
        next to Remote status. The <Link href="/docs/remote-control">phone remote guide</Link> has pictures.
      </>
    ),
    answer: true,
  },
  vcam: {
    say: (
      <>
        In FrameDecks, choose <b>Settings → How people see it → FrameDecks vCam → Install</b>, then close and reopen Zoom or Teams. It
        appears in their camera list as FrameDecks vCam.
      </>
    ),
    answer: true,
  },
  screen: {
    say: (
      <>
        Press <kbd>Esc</kbd> in the Studio (or <kbd>Alt</kbd>+<kbd>H</kbd> in the Command Center): everything leaves the screen at once. For a
        black screen, press <kbd>K</kbd>; press it again to come back.
      </>
    ),
    answer: true,
  },
  sync: {
    say: (
      <>
        On the PC, choose the status button at the top right, then <b>Sync</b>, then <b>Sync now</b>. If the website says the PC is
        offline, open FrameDecks on that PC and check it has internet.
      </>
    ),
    answer: true,
  },
  install: {
    say: (
      <>
        The installer isn’t code-signed yet, so Windows asks first. Choose <b>More info → Run anyway</b>. Each release is checked with
        Microsoft Defender before it’s published.
      </>
    ),
    answer: true,
  },
  code: {
    say: "Type the code you see (it starts with FD-, like FD-NET-02) and I’ll explain it.",
  },
};

type Msg = { from: "bot" | "you"; body: ReactNode; options?: [string, string][]; ask?: boolean };

function codeAnswer(c: Code): ReactNode {
  return (
    <>
      <b>
        {c.code}: {c.title}.
      </b>{" "}
      {c.why}
      <br />
      <b>Fix:</b> {c.fix}
    </>
  );
}

export function HelpBot({ index }: Readonly<{ index: HelpEntry[] }>) {
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ from: "bot", body: STEPS.start.say, options: STEPS.start.options }]);
  const [text, setText] = useState("");
  const log = useRef<HTMLDivElement>(null);

  // follow the conversation inside its own box; the page itself never moves
  useEffect(() => {
    const l = log.current;
    if (l && msgs.length > 1) l.scrollTo({ top: l.scrollHeight });
  }, [msgs]);

  function bot(body: ReactNode, options?: [string, string][], ask = false) {
    setMsgs((m) => [...m, { from: "bot", body, options, ask }]);
  }

  function choose(label: string, next: string) {
    setMsgs((m) => [...m.map((x) => ({ ...x, options: undefined })), { from: "you", body: label }]);
    if (next === "yes") return bot("Good. If anything else comes up, I’m here.");
    if (next === "no")
      return bot(
        <>
          Sorry. Please write to us from <a href="#contact">Contact Support</a>, or in FrameDecks choose <b>Settings → Diagnostics → Send a report to
          support</b>: it adds what we need to help, and you see all of it first.
        </>,
      );
    if (next === "restart") return bot(STEPS.start.say, STEPS.start.options);
    const s = STEPS[next];
    bot(s.say, s.options, !!s.answer);
  }

  function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setText("");
    setMsgs((m) => [...m.map((x) => ({ ...x, options: undefined })), { from: "you", body: q }]);
    const c = (codes as Code[]).find((x) => x.code === q.toUpperCase().replace(/\s+/g, ""));
    if (c) return bot(codeAnswer(c), undefined, true);
    const found = searchHelp(index, q, 3);
    if (!found.length)
      return bot("I couldn’t find that in Help. Try other words, or choose a topic.", [["Show the topics again", "restart"], ["Contact Support", "no"]]);
    bot(
      <>
        This is what Help says:
        <ul className="hb-found">
          {found.map((f) => (
            <li key={f.href + f.title}>
              <a href={f.href}>
                <small>{f.kind}</small>
                <b>{f.title}</b>
                <span>{f.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </>,
      undefined,
      true,
    );
  }

  return (
    <div className="hb">
      <div className="hb-log" ref={log} role="log" aria-live="polite" aria-label="Ask Help">
        {msgs.map((m, i) => (
          <div key={i} className={`hb-msg hb-${m.from}`}>
            <div className="hb-bubble">{m.body}</div>
            {m.options && (
              <div className="hb-opts">
                {m.options.map(([label, next]) => (
                  <button key={next + label} type="button" onClick={() => choose(label, next)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {m.ask && i === msgs.length - 1 && (
              <div className="hb-opts">
                <span>Did that help?</span>
                <button type="button" onClick={() => choose("Yes", "yes")}>
                  Yes
                </button>
                <button type="button" onClick={() => choose("No", "no")}>
                  No
                </button>
                <button type="button" onClick={() => choose("Something else", "restart")}>
                  Something else
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <form className="hb-ask" onSubmit={ask}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question, or an error code like FD-NET-02" aria-label="Your question" />
        <button type="submit" className="fd-btn fd-btn-primary">
          Ask
        </button>
      </form>
      <p className="hb-note">Answers come from this Help Center. Nothing you type leaves this page.</p>
    </div>
  );
}
