"""FrameDecks 26.11.63 - meeting together on members' phones: who is here, raised hands, a Bible quiz and the take-home page.

While members' phones are open (src/member_room.py), the leader can switch on:
  - "Who is here": phones may type a first name (optional). The leader sees who joined (the Discussion panel) and the
    names are kept on this PC for Care and attendance (src/care.py) when the meeting ends.
  - "I'd like to share": phones raise a hand; the leader sees the queue, ticks who has shared, and sees who has not
    shared yet (only the leader sees this; nothing about it reaches the screen).
  - A Bible quiz built from the meeting's own scriptures and questions: phones answer A-D, the fastest right answers
    score most, the question, the answer and the leaderboard go on screen as Chat Bubbles (so the camera and the
    overlay pages show them with no new screen).
  - The take-home page: after the meeting, phones (and anyone with the room's code, for up to 8 days) see the verses,
    questions, songs, notes, shared prayer requests and next time's agenda.

The workspace keeps the names, hands and quiz answers only while the room is open (0030_meeting_together.sql); the
take-home page for up to 14 days. This PC asks it; the Discussion ticks are kept in memory for this meeting only.
"""

import random
import re
import threading
import time

REFRESH_GAP = 1.5          # seconds between two asks for the people list (the panel polls every 2 s)
QUIZ_POINTS = 1000         # a right answer at once; less the longer it takes (never under half)


def _s(v, n):
    return " ".join(str(v or "").split())[:n]


# ---------- the quiz: questions from the meeting's own scriptures and questions ----------
WORD = re.compile(r"[A-Za-z][A-Za-z'’-]{3,}")
SMALL = {"that", "this", "with", "from", "they", "them", "their", "there", "have", "were", "what", "when", "which",
         "will", "shall", "unto", "your", "into", "upon", "also", "then", "than", "been", "said", "even", "because",
         "these", "those", "would", "could", "should", "every", "about", "through"}


def _verses(st):
    """The scriptures of the meeting shown on this PC (each once): [(ref, text)]."""
    out, seen = [], set()
    for sc in st.get("scenes") or []:
        for l in (sc or {}).get("layers") or []:
            if (l or {}).get("kind") != "scripture":
                continue
            c = l.get("c") or {}
            for it in c.get("items") or []:
                ref, text = _s((it or {}).get("ref"), 80), _s((it or {}).get("text"), 600)
                if ref and text and ref not in seen:
                    seen.add(ref)
                    out.append((ref, text))
    lib = (st.get("library") or {}).get("verses") or []
    for it in lib:
        ref, text = _s((it or {}).get("ref"), 80), _s((it or {}).get("text"), 600)
        if ref and text and ref not in seen and len(out) < 40:
            seen.add(ref)
            out.append((ref, text))
    return out


def build_quiz(st, n=5, rnd=None):
    """Up to n quiz questions: "Which word completes ...?" and "Where is this written?". Each
    {question, options[2..4], correct}. The leader can change any of them before it starts."""
    rnd = rnd or random.Random()
    verses = _verses(st)
    qs = []
    refs = [r for r, _ in verses]
    for ref, text in verses:
        words = [w for w in WORD.findall(text) if w.lower().strip("'’") not in SMALL]
        if len(words) >= 4:
            answer = max(words, key=len) if rnd.random() < 0.5 else rnd.choice(words)
            pool = list({w for w in WORD.findall(" ".join(t for _, t in verses)) if w.lower() != answer.lower()
                         and w.lower() not in SMALL and abs(len(w) - len(answer)) <= 4})
            rnd.shuffle(pool)
            if len(pool) >= 3:
                blanked = re.sub(r"\b%s\b" % re.escape(answer), "_____", text, count=1)
                opts = [answer] + pool[:3]
                rnd.shuffle(opts)
                qs.append({"question": _s("%s — which word fills the gap? “%s”" % (ref, blanked), 200),
                           "options": [_s(o, 80) for o in opts], "correct": opts.index(answer)})
        if len(refs) >= 3:
            others = [r for r in refs if r != ref]
            rnd.shuffle(others)
            opts = [ref] + others[:3]
            rnd.shuffle(opts)
            qs.append({"question": _s("Where is this written? “%s”" % text, 200),
                       "options": [_s(o, 80) for o in opts], "correct": opts.index(ref)})
    rnd.shuffle(qs)
    return qs[:max(1, int(n))]


def clean_question(q):
    """A question as the leader typed or changed it: {question, options (2..4), correct} or ValueError."""
    q = q if isinstance(q, dict) else {}
    text = _s(q.get("question"), 200)
    opts = [_s(o, 80) for o in (q.get("options") or []) if _s(o, 80)][:4]
    if not text:
        raise ValueError("Type the question.")
    if len(opts) < 2:
        raise ValueError("Give at least two answers to choose from.")
    try:
        correct = int(q.get("correct"))
    except (TypeError, ValueError):
        raise ValueError("Choose the right answer.")
    if not 0 <= correct < len(opts):
        raise ValueError("Choose the right answer.")
    return {"question": text, "options": opts, "correct": correct}


def points(ms, seconds):
    """A right answer's points: 1000 at once, down to 500 at the last moment."""
    span = max(1, int(seconds) * 1000)
    return int(round(QUIZ_POINTS * (1 - 0.5 * min(1.0, max(0, int(ms)) / span))))


class Together:
    def __init__(self, team, room_open=lambda: True, clock=time.time, poke=lambda: None):
        """team(): (api, site) for this PC, or raises when not linked. room_open(): members' phones are open.
        poke(): what phones see changed (the room publishes again)."""
        self.team, self.room_open, self.clock, self.poke = team, room_open, clock, poke
        self.lock = threading.Lock()
        self.people_on = False          # phones show "Your first name (optional)"
        self.hands_on = False           # phones show "I'd like to share"
        self.people = []                # [{id, name, joined, hand}]
        self.shared = set()             # ids the leader ticked "shared" (this meeting only)
        self.seen = {}                  # id -> name, everyone who joined this meeting (for attendance)
        self.error = ""
        self.fetched = 0.0
        self.quiz_on = False
        self.quiz = None                # {id, question, options, correct, seconds, revealed}
        self.answers = []               # [{id, choice, ms}]
        self.scores = {}                # id -> points over the quiz
        self.scored = set()             # quiz ids already added to the scores
        self.takehome_on = False
        self.takehome_until = 0
        self.rev = 0

    # ---------- what phones are told (member_room screen) ----------
    def flags(self):
        with self.lock:
            out = {}
            if self.people_on:
                out["people"] = True
            if self.hands_on:
                out["hands"] = True
            if self.quiz_on and self.quiz:
                out["quiz"] = True
            if self.takehome_on:
                out["takehome"] = True
            return out

    def new_room(self):
        """A new room (new code): this meeting's lists start again."""
        with self.lock:
            self.people, self.shared, self.seen, self.answers = [], set(), {}, []
            self.quiz, self.quiz_on, self.scores, self.scored = None, False, {}, set()
            self.takehome_on = False
            self.rev += 1

    # ---------- who is here, hands ----------
    def set_flag(self, name, on):
        if name not in ("people", "hands"):
            raise ValueError("Unknown switch.")
        if on and not self.room_open():
            raise ValueError("Open members’ phones first.")
        with self.lock:
            setattr(self, name + "_on", bool(on))
            if name == "hands" and on:
                self.people_on = True          # hands need a name to be useful (the name stays optional)
            self.rev += 1
        self.poke()

    def refresh(self, force=False):
        with self.lock:
            if not force and self.clock() - self.fetched < REFRESH_GAP:
                return False
            self.fetched = self.clock()
        if not self.room_open():
            return False
        try:
            api, _ = self.team()
            rows = api.pc_room_people() or []
        except Exception as e:                 # offline or 0030 not yet in this workspace: the panel says so
            with self.lock:
                self.error = str(e)
            return False
        self.receive(rows)
        return True

    def receive(self, rows):
        with self.lock:
            self.error = ""
            out = []
            for r in rows if isinstance(rows, list) else []:
                if not isinstance(r, dict) or not r.get("id"):
                    continue
                pid, name = str(r["id"])[:12], _s(r.get("name"), 40)
                out.append({"id": pid, "name": name, "joined": str(r.get("joined") or ""), "hand": str(r.get("hand") or "")})
                if name or pid not in self.seen:
                    self.seen[pid] = name or self.seen.get(pid, "")
            self.people = out[:300]

    def hand_down(self, pid=None, shared=False):
        """Lower one hand (or all); shared=True also ticks that person as having shared."""
        api, _ = self.team()
        api.pc_room_hand_down(str(pid)[:12] if pid else None)
        with self.lock:
            if pid and shared:
                self.shared.add(str(pid)[:12])
            for p in self.people:
                if not pid or p["id"] == str(pid)[:12]:
                    p["hand"] = ""
            self.rev += 1

    def tick(self, pid, on=True):
        with self.lock:
            (self.shared.add if on else self.shared.discard)(str(pid)[:12])
            self.rev += 1

    def names_today(self):
        """Everyone who gave a name this meeting (for Care and attendance), and how many joined in all."""
        with self.lock:
            names = sorted({n for n in self.seen.values() if n}, key=str.lower)
            return names, len(self.seen)

    # ---------- the quiz ----------
    def quiz_open(self, q, seconds=20):
        if not self.room_open():
            raise ValueError("Open members’ phones first, so phones can answer.")
        q = clean_question(q)
        seconds = max(5, min(120, int(seconds or 20)))
        api, _ = self.team()
        res = api.pc_room_quiz_open(q["question"], q["options"], q["correct"], seconds) or {}
        with self.lock:
            self.quiz = dict(q, id=str(res.get("id") or ""), seconds=seconds, revealed=False)
            self.quiz_on, self.answers = True, []
            self.rev += 1
        self.poke()
        return self.quiz_body()

    def quiz_refresh(self):
        if not self.quiz:
            return False
        try:
            api, _ = self.team()
            res = api.pc_room_quiz_results()
        except Exception as e:
            with self.lock:
                self.error = str(e)
            return False
        with self.lock:
            if not isinstance(res, dict) or not res.get("id"):
                return False
            self.answers = [{"id": str(a.get("id") or "")[:12], "choice": int(a.get("choice", -1)), "ms": int(a.get("ms") or 0)}
                            for a in res.get("answers") or [] if isinstance(a, dict)][:300]
            if self.quiz:
                self.quiz["revealed"] = bool(res.get("revealed"))
        return True

    def quiz_reveal(self):
        api, _ = self.team()
        api.pc_room_quiz_reveal()
        self.quiz_refresh()
        with self.lock:
            q = self.quiz
            if q:
                q["revealed"] = True
                if q["id"] not in self.scored:
                    self.scored.add(q["id"])
                    for a in self.answers:
                        if a["choice"] == q["correct"]:
                            self.scores[a["id"]] = self.scores.get(a["id"], 0) + points(a["ms"], q["seconds"])
            self.rev += 1
        self.poke()
        return self.quiz_body()

    def quiz_close(self):
        try:
            api, _ = self.team()
            api.pc_room_quiz_close()
        finally:
            with self.lock:
                self.quiz, self.quiz_on, self.answers = None, False, []
                self.rev += 1
            self.poke()
        return self.quiz_body()

    def name_of(self, pid):
        return self.seen.get(pid) or "Player %s" % pid[:3].upper()

    def leaderboard(self, top=5):
        with self.lock:
            rows = sorted(self.scores.items(), key=lambda kv: -kv[1])[:top]
            return [{"id": k, "name": self.name_of(k), "points": v} for k, v in rows]

    def question_card(self):
        """The question on screen as a Chat Bubble: (title, text)."""
        with self.lock:
            q = self.quiz
            if not q:
                raise ValueError("Start a question first.")
            letters = "ABCD"
            return "Quiz", q["question"] + "\n" + "\n".join("%s  %s" % (letters[i], o) for i, o in enumerate(q["options"]))

    def answer_card(self):
        with self.lock:
            q = self.quiz
            if not q:
                raise ValueError("Start a question first.")
            right = sum(1 for a in self.answers if a["choice"] == q["correct"])
            return "The answer", "%s  %s · %d of %d right" % ("ABCD"[q["correct"]], q["options"][q["correct"]], right, len(self.answers))

    def board_card(self):
        rows = self.leaderboard()
        if not rows:
            raise ValueError("Nobody has scored yet.")
        medals = ["1.", "2.", "3.", "4.", "5."]
        return "Leaderboard", "\n".join("%s %s · %d" % (medals[i], r["name"], r["points"]) for i, r in enumerate(rows))

    def quiz_body(self):
        with self.lock:
            q = dict(self.quiz) if self.quiz else None
            counts = [0, 0, 0, 0]
            for a in self.answers:
                if 0 <= a["choice"] < 4:
                    counts[a["choice"]] += 1
            return {"quiz": q, "answered": len(self.answers), "counts": counts[:len(q["options"])] if q else [],
                    "board": [{"name": self.name_of(k), "points": v} for k, v in sorted(self.scores.items(), key=lambda kv: -kv[1])[:10]]}

    # ---------- the take-home page ----------
    def takehome_publish(self, body, days=8):
        api, _ = self.team()
        res = api.pc_takehome_publish(body, max(1, min(14, int(days or 8)))) or {}
        with self.lock:
            self.takehome_on, self.takehome_until = True, str(res.get("expiresAt") or "")
            self.rev += 1
        self.poke()
        return {"published": True, "expiresAt": self.takehome_until}

    def takehome_remove(self):
        api, _ = self.team()
        api.pc_takehome_remove()
        with self.lock:
            self.takehome_on, self.takehome_until = False, ""
            self.rev += 1
        self.poke()
        return {"published": False}

    # ---------- the Discussion panel ----------
    def body(self):
        room = bool(self.room_open())
        with self.lock:
            people = [dict(p, shared=p["id"] in self.shared) for p in self.people]
            hands = sorted([p for p in people if p["hand"]], key=lambda p: p["hand"])
            not_yet = [p for p in people if p["name"] and not p["shared"]]
            return {"room": room, "people": self.people_on, "hands": self.hands_on, "error": self.error,
                    "joined": len(people), "named": sum(1 for p in people if p["name"]),
                    "queue": hands, "notYet": not_yet, "list": people,
                    "takehome": {"on": self.takehome_on, "until": self.takehome_until}, "rev": self.rev}


# ---------- the take-home body (0030 room_takehome): built from the meeting that just happened ----------
def takehome_body(st, summary, prayers=None, next_meeting=None, note="", notes_text="", songs=None, day=None):
    """summary: meeting_log.summary(run) or None. prayers: {"shared": [text], "answered": [text], "status": {id: s}}.
    next_meeting: {name, date, time, read, questions, join} or None. Returns the JSON the phones show."""
    b = st.get("brand") if isinstance(st.get("brand"), dict) else {}
    m = st.get("meeting") if isinstance(st.get("meeting"), dict) else {}
    out = {"v": 1, "meeting": _s(m.get("title") or b.get("meeting"), 120) or "Our meeting",
           "date": day or time.strftime("%Y-%m-%d")}
    if _s(b.get("org"), 80):
        out["org"] = _s(b.get("org"), 80)
    if re.match(r"^#[0-9a-fA-F]{6}$", str(b.get("color") or "")):
        out["color"] = b["color"].lower()
    if _s(note, 600):
        out["note"] = _s(note, 600)
    verses, questions = [], []
    lib = {_s(v.get("ref"), 80): v for v in (st.get("library") or {}).get("verses") or [] if isinstance(v, dict)}
    for f in (summary or {}).get("frames") or []:
        for v in f.get("verses") or []:
            ref = _s(v.get("label"), 80)
            if ref and not any(x["ref"] == ref for x in verses):
                text = _s(v.get("text") or (lib.get(ref) or {}).get("text"), 1200)
                verses.append({"ref": ref, "text": text, "version": _s((lib.get(ref) or {}).get("version"), 12)})
        for q in f.get("questions") or []:
            t = _s(q.get("text"), 400)
            if t and t not in questions:
                questions.append(t)
    out["verses"], out["questions"] = verses[:20], questions[:20]
    out["songs"] = [{"title": _s(x.get("title"), 120), "credit": _s(x.get("credit"), 200)} for x in (songs or []) if _s(x.get("title"), 120)][:12]
    if str(notes_text or "").strip():
        out["notes"] = str(notes_text).strip()[:12000]
    p = prayers or {}
    out["prayers"] = [_s(x, 300) for x in p.get("shared") or [] if _s(x, 300)][:20]
    out["answered"] = [_s(x, 300) for x in p.get("answered") or [] if _s(x, 300)][:20]
    status = {str(k)[:40]: v for k, v in (p.get("status") or {}).items() if v in ("praying", "answered")}
    if status:
        out["status"] = dict(list(status.items())[:200])
    if isinstance(next_meeting, dict) and _s(next_meeting.get("name"), 120):
        n = {"name": _s(next_meeting.get("name"), 120)}
        for k in ("date", "time", "join"):
            if _s(next_meeting.get(k), 200):
                n[k] = _s(next_meeting.get(k), 200)
        n["read"] = [_s(x, 80) for x in next_meeting.get("read") or [] if _s(x, 80)][:10]
        n["questions"] = [_s(x, 300) for x in next_meeting.get("questions") or [] if _s(x, 300)][:10]
        out["next"] = n
    return out


def next_meeting_of(st, current_id=""):
    """The meeting after the one shown (8.5 meetings): its name, date, the scriptures to read and its questions."""
    mt = st.get("meeting") if isinstance(st.get("meeting"), dict) else {}
    lst = [x for x in mt.get("meetings") or [] if isinstance(x, dict)]
    if not lst:
        return None
    cur = current_id or str((st.get("live") or {}).get("meeting") or "")
    ids = [x.get("id") for x in lst]
    i = ids.index(cur) if cur in ids else -1
    later = sorted([x for x in lst if str(x.get("date") or "") > str((lst[i] if i >= 0 else {}).get("date") or "")],
                   key=lambda x: str(x.get("date") or ""))
    nxt = later[0] if later else (lst[i + 1] if 0 <= i < len(lst) - 1 else None)
    if not nxt:
        return None
    read, questions = [], []
    first = lst[0]
    for sc in st.get("scenes") or []:
        if not isinstance(sc, dict) or sc.get("tpl"):
            continue
        g = str(sc.get("group") or "").strip().lower()       # a Frame's group names its meeting (store.js meetingOfScene)
        mine = next((x for x in lst if str(x.get("name") or "").lower() == g), first)
        if mine.get("id") != nxt.get("id"):
            continue
        for l in sc.get("layers") or []:
            c = (l or {}).get("c") or {}
            if l.get("kind") == "scripture":
                read += [_s(it.get("ref"), 80) for it in c.get("items") or [] if _s(it.get("ref"), 80)]
            if l.get("kind") == "question":
                questions += [_s(it.get("text"), 300) for it in c.get("items") or [] if _s(it.get("text"), 300)]
    return {"name": _s(nxt.get("name"), 120), "date": _s(nxt.get("date"), 40),
            "read": list(dict.fromkeys(read))[:10], "questions": list(dict.fromkeys(questions))[:10]}
