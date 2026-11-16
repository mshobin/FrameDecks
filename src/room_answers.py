"""FrameDecks 26.11.57 - typed answers from members' phones, for a discussion question.

While members' phones are open (src/member_room.py), the leader asks people to type a short answer ("What stood out
to you?"), from the Typed answers dialog or the Ask phones button on a question. Phones on framedecks.com/follow show
a box under the screen; each sends one answer (up to 280 characters) and can change it while the prompt is open.
Nothing reaches the screen by itself: the leader reads the answers here and shows the ones they choose, one at a time,
as a Chat Bubble with the prompt as its title and never a name.

The workspace keeps the answers (0026_room_answers.sql); this PC only asks it. Nothing is written to disk.
"""

import threading
import time

PROMPT_MAX = 200
REFRESH_GAP = 1.5        # seconds: the dialog asks every 2 s; two windows never double the calls


def _s(v, n):
    return " ".join(str(v or "").split())[:n]


class RoomAnswers:
    def __init__(self, team, room_open=lambda: True, clock=time.time):
        """team(): (api, site) for this PC, or raises when not linked. room_open(): members' phones are open."""
        self.team, self.room_open, self.clock = team, room_open, clock
        self.lock = threading.Lock()
        self.current = None       # {id, prompt, open}
        self.answers = []         # [{id, body, at}], newest first
        self.error = ""
        self.fetched = 0.0
        self.shown = []           # [(prompt, answer)] put on screen this session: shared with the study notes

    def open(self, prompt):
        if not self.room_open():
            raise ValueError("Open members’ phones first, so phones can answer.")
        p = _s(prompt, PROMPT_MAX)
        if not p:
            raise ValueError("Type what people should answer.")
        api, _ = self.team()
        res = api.pc_room_answers_open(p) or {}
        with self.lock:
            self.current = {"id": str(res.get("id") or ""), "prompt": str(res.get("prompt") or p), "open": True}
            self.answers, self.error, self.fetched = [], "", self.clock()
        return self.body()

    def close(self):
        api, _ = self.team()
        api.pc_room_answers_close()
        with self.lock:
            if self.current:
                self.current["open"] = False
        self.refresh(force=True)
        return self.body()

    def card(self, aid):
        """One answer as a Chat Bubble: (title, text)."""
        self.refresh(force=True)
        with self.lock:
            for a in self.answers:
                if a["id"] == str(aid or ""):
                    title = (self.current or {}).get("prompt") or "An answer"
                    if (title, a["body"]) not in self.shown:
                        self.shown = (self.shown + [(title, a["body"])])[-40:]
                    return title, a["body"]
        raise ValueError("That answer is not there any more.")

    def refresh(self, force=False):
        with self.lock:
            if not force and (self.clock() - self.fetched < REFRESH_GAP or not (self.current and self.current["open"])):
                return False
            self.fetched = self.clock()
        try:
            api, _ = self.team()
            res = api.pc_room_answers_list()
        except Exception as e:                 # offline: the dialog says so and keeps the last answers
            with self.lock:
                self.error = str(e)
            return False
        self.receive(res)
        return True

    def receive(self, res):
        with self.lock:
            self.error = ""
            if not isinstance(res, dict) or not res.get("id"):
                if self.current:
                    self.current["open"] = False
                return
            self.current = {"id": str(res["id"]), "prompt": str(res.get("prompt") or ""), "open": bool(res.get("open"))}
            self.answers = [{"id": str(a.get("id") or ""), "body": _s(a.get("body"), 280), "at": str(a.get("at") or "")}
                            for a in (res.get("answers") or []) if isinstance(a, dict) and a.get("body")][:300]

    def notes_section(self):
        """The answers shown on screen, as one more section of the notes shared with members' phones, or None."""
        with self.lock:
            shown = list(self.shown)
        if not shown:
            return None
        lines = []
        for prompt, answer in shown:
            lines.append("%s\n“%s”" % (prompt, answer))
        return {"frame": "What we shared", "script": "\n\n".join(lines)[:6000], "verses": [], "questions": []}

    def body(self):
        room = bool(self.room_open())
        with self.lock:
            c = dict(self.current) if self.current else None
            if c:
                c["open"] = bool(c["open"] and room)
            return {"room": room, "prompt": c, "answers": [dict(a) for a in self.answers], "error": self.error}

    def action(self, data, show_card, count):
        """POST /api/room/answers {op: open|close|show, prompt?, id?}. show_card(title, text) puts a Chat Bubble on
        screen; count(what) is the meeting summary's counter."""
        op = str((data or {}).get("op") or "")
        if op == "open":
            self.open(data.get("prompt"))
            count("responses.opened")      # the meeting summary counts it with the polls
        elif op == "close":
            self.close()
        elif op == "show":
            show_card(*self.card(data.get("id")))
            count("responses.shown")
        else:
            raise ValueError("Unknown action.")
        return self.body()
