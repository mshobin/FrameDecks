"""FrameDecks 26.11.33 - quick responses and polls from members' phones.

While members' phones are open (src/member_room.py), the leader can ask one thing at a time (Studio > Engage > Quick
responses): Yes / No, a poll (pick one of 2 to 6 answers the leader typed) or a rating from 1 to 5. Phones on
framedecks.com/follow show it under the screen and answer once each; they can change their answer while it is open.
The leader chooses whether phones see the live results, and can put the results on the meeting screen as a Chat
Bubble ("Yes 12 · No 3", with the question as its title), so they reach the camera and the overlays like any card.

The workspace counts (0022_room_polls.sql); this PC only asks it. Nothing is written to disk, and no phone is ever
named: the workspace keeps only a hash of each phone's own random id.
"""

import threading
import time

QUESTION_MAX = 200
OPTION_MAX = 60
KINDS = {"yesno": "yesno", "poll": "choice", "choice": "choice", "rating": "rating"}
REFRESH_GAP = 1.5        # seconds: the dialog asks every 2 s; two windows never double the calls


def _s(v, n):
    return " ".join(str(v or "").split())[:n]


def tidy(question, kind, options=None):
    """What the leader typed -> (question, kind, options), or ValueError in plain words. The workspace checks again."""
    q = _s(question, QUESTION_MAX)
    k = KINDS.get(str(kind or "").strip().lower())
    if not q:
        raise ValueError("Type the question first.")
    if not k:
        raise ValueError("Choose Yes / No, a poll or a rating.")
    if k == "yesno":
        return q, k, ["Yes", "No"]
    if k == "rating":
        return q, k, ["1", "2", "3", "4", "5"]
    opts = [_s(o, OPTION_MAX) for o in (options if isinstance(options, list) else [])]
    opts = [o for o in opts if o]
    if not 2 <= len(opts) <= 6:
        raise ValueError("A poll needs 2 to 6 answers.")
    return q, k, opts


def summary(kind, options, counts):
    """The results in one line, for the Chat Bubble: "Yes 12 · No 3", or the average of a rating."""
    counts = [int(c or 0) for c in (counts or [])] + [0] * max(0, len(options) - len(counts or []))
    total = sum(counts[:len(options)])
    if kind == "rating":
        if not total:
            return "No answers yet"
        avg = sum((i + 1) * c for i, c in enumerate(counts[:5])) / total
        return "Average %.1f out of 5 · %d %s" % (avg, total, "answer" if total == 1 else "answers")
    return " · ".join("%s %d" % (o, c) for o, c in zip(options, counts))


class RoomResponses:
    def __init__(self, team, room_open=lambda: True, clock=time.time):
        """team(): (api, site) for this PC, or raises when not linked. room_open(): members' phones are open."""
        self.team, self.room_open, self.clock = team, room_open, clock
        self.lock = threading.Lock()
        self.current = None       # the last question: {id, question, kind, options, showResults, open}
        self.counts, self.total = [], 0
        self.error = ""
        self.fetched = 0.0
        self.rev = 0

    # ---------- the leader's choices ----------
    def open(self, question, kind, options=None, show_results=False):
        if not self.room_open():
            raise ValueError("Open members’ phones first, so phones can answer.")
        q, k, opts = tidy(question, kind, options)
        api, _ = self.team()
        answer = api.pc_room_response_open(q, k, opts if k == "choice" else None, bool(show_results)) or {}
        with self.lock:
            self.current = {"id": str(answer.get("id") or ""), "question": str(answer.get("question") or q),
                            "kind": str(answer.get("kind") or k), "options": list(answer.get("options") or opts),
                            "showResults": bool(answer.get("showResults", show_results)), "open": True}
            self.counts, self.total = [0] * len(self.current["options"]), 0
            self.error, self.fetched = "", self.clock()
            self.rev += 1
        return self.body()

    def close(self):
        api, _ = self.team()
        api.pc_room_response_close()
        with self.lock:
            if self.current:
                self.current["open"] = False
            self.rev += 1
        self.refresh(force=True)
        return self.body()

    def card(self):
        """The results as a Chat Bubble: (title, text)."""
        self.refresh(force=True)
        with self.lock:
            c = self.current
            if not c:
                raise ValueError("Open a question first.")
            return c["question"], summary(c["kind"], c["options"], self.counts)

    # ---------- counting ----------
    def refresh(self, force=False):
        """Ask the workspace for the counts (at most every REFRESH_GAP seconds unless forced). An error is kept for the
        dialog to say; the last counts stay."""
        with self.lock:
            if not force and (self.clock() - self.fetched < REFRESH_GAP or not (self.current and self.current["open"])):
                return False
            self.fetched = self.clock()
        try:
            api, _ = self.team()
            res = api.pc_room_response_results()
        except Exception as e:                 # offline: the dialog says so and keeps the last counts
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
            opts = [str(o) for o in res.get("options") or []]
            self.current = {"id": str(res["id"]), "question": str(res.get("question") or ""),
                            "kind": str(res.get("kind") or "choice"), "options": opts,
                            "showResults": bool(res.get("showResults")), "open": bool(res.get("open"))}
            counts = [int(c or 0) for c in res.get("counts") or []]
            self.counts = (counts + [0] * len(opts))[:len(opts)]
            self.total = int(res.get("total") or sum(self.counts))

    def body(self):
        room = bool(self.room_open())
        with self.lock:
            c = dict(self.current) if self.current else None
            if c:
                c["open"] = bool(c["open"] and room)
            return {"room": room, "response": c, "counts": list(self.counts), "total": self.total,
                    "error": self.error, "rev": self.rev}

    # ---------- the local endpoints (src/server.py) ----------
    def action(self, data, show_card, count):
        """POST /api/room/response {op: open|close|show, question?, kind?, options?, showResults?}.
        show_card(title, text): puts a Chat Bubble on screen. count(what): the meeting summary's counter."""
        op = str((data or {}).get("op") or "")
        if op == "open":
            self.open(data.get("question"), data.get("kind"), data.get("options"), bool(data.get("showResults")))
            count("responses.opened")
        elif op == "close":
            self.close()
        elif op == "show":
            show_card(*self.card())
            count("responses.shown")
        else:
            raise ValueError("Unknown action.")
        return self.body()
