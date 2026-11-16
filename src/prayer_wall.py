"""FrameDecks 26.11.23 - the prayer requests wall, on the church PC.

The leader opens the wall (Studio > Engage > Prayer requests). FrameDecks asks the workspace for a short code and shows
it with a QR to framedecks.com/pray#c=CODE. People in the meeting send requests from their phones with no account;
this PC takes them in every few seconds (the cloud forgets each one as it is taken: 0019_prayer_wall.sql).

Nothing goes on screen by itself. The leader reads each request and chooses: Show (anonymously, or with the first name
the person gave), or Done. "We're praying for…" puts the shown requests together on one card. On screen they are
Chat Bubbles, so they use the same overlay, layouts and Hide all as everything else.

The requests live in memory only: they are never written to disk, synced, or put in the diagnostics file, and they are
gone when the wall is closed or FrameDecks is closed.
"""

import threading
import time
import uuid

POLL_SECONDS = 4.0
MAX_ITEMS = 300
LIST_LINE = 70           # characters of each request on the "We're praying for" card


def short(text, n=LIST_LINE):
    t = " ".join(str(text or "").split())
    return t if len(t) <= n else t[:n - 1].rstrip() + "…"


class PrayerWall:
    def __init__(self, team, clock=time.time, on_received=None, poll=POLL_SECONDS):
        """team(): the workspace's API for this PC and the website address ((api, site)), or raises when not linked.
        on_received(n): told how many new requests came in (the meeting summary counts them)."""
        self.team, self.clock, self.on_received, self.poll = team, clock, on_received, poll
        self.lock = threading.Lock()
        self.code, self.url, self.closes_at = "", "", 0.0
        self.items = []          # newest last: {id, body, name, at, status: new | shown | done}
        self.error = ""
        self.rev = 0             # the Studio rides on this (server RIDERS "pr")
        self._stop = threading.Event()
        self._thread = None

    # ---------- open / close ----------
    def is_open(self):
        return bool(self.code) and self.clock() < self.closes_at

    def open(self, hours=4):
        api, site = self.team()
        answer = api.pc_prayer_open(int(hours)) or {}
        code = str(answer.get("code") or "").strip().upper()
        if not code:
            raise ValueError("No code came back. Try again.")
        with self.lock:
            self.code, self.url = code, "%s/pray#c=%s" % (site.rstrip("/"), code)
            self.closes_at = self.clock() + int(hours) * 3600
            self.error = ""
            self._bump()
        self._start()
        return self.body()

    def close(self):
        self._stop.set()
        try:
            api, _ = self.team()
            self._take(api)                    # what arrived at the last moment is not left in the cloud
            api.pc_prayer_close()
        except Exception as e:                 # offline: the wall closes by itself in the cloud after a few hours
            self.error = str(e)
        with self.lock:
            self.code, self.url, self.closes_at = "", "", 0.0
            self.items = []                    # forgotten: requests are never kept after the wall
            self._bump()
        return self.body()

    # ---------- taking requests in ----------
    def _start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="prayer-wall", daemon=True)
        self._thread.start()

    def _loop(self):
        while not self._stop.wait(self.poll):
            if not self.is_open():
                with self.lock:
                    self.code, self.url = "", ""
                    self._bump()
                return
            try:
                api, _ = self.team()
                self._take(api)
                if self.error:
                    with self.lock:
                        self.error = ""
                        self._bump()
            except Exception as e:
                with self.lock:
                    if self.error != str(e):
                        self.error = str(e)
                        self._bump()

    def _take(self, api):
        rows = api.pc_prayer_take() or []
        return self.receive(rows)

    def receive(self, rows):
        """Requests taken from the workspace -> the leader's list. Returns how many were new."""
        new = 0
        with self.lock:
            for r in rows:
                body = " ".join(str((r or {}).get("body") or "").split())[:500]
                if not body:
                    continue
                name = " ".join(str((r or {}).get("name") or "").split())[:40]
                self.items.append({"id": "p" + uuid.uuid4().hex[:10], "body": body, "name": name,
                                   "at": int(self.clock() * 1000), "status": "new"})
                new += 1
            if new:
                self.items = self.items[-MAX_ITEMS:]
                self._bump()
        if new and self.on_received:
            self.on_received(new)
        return new

    # ---------- the leader's choices ----------
    def _find(self, item_id):
        return next((i for i in self.items if i["id"] == item_id), None)

    def card(self, item_id, with_name=False):
        """What a Chat Bubble shows for one request: (title, text). The name only when asked and given."""
        with self.lock:
            it = self._find(item_id)
            if not it:
                raise ValueError("That request is no longer there.")
            title = "Prayer request" + (" · " + it["name"] if with_name and it["name"] else "")
            return title, it["body"]

    def mark(self, item_id, status):
        if status not in ("new", "shown", "done"):
            raise ValueError("Unknown status.")
        with self.lock:
            it = self._find(item_id)
            if not it:
                raise ValueError("That request is no longer there.")
            it["status"] = status
            self._bump()
            return dict(it)

    def praying_for(self):
        """The "We're praying for…" card: every request shown so far, short and without names. (title, text)"""
        with self.lock:
            lines = [short(i["body"]) for i in self.items if i["status"] == "shown"]
        if not lines:
            raise ValueError("Show a request first; this card gathers the ones shown.")
        return "We’re praying for", " · ".join(lines)

    def _bump(self):
        self.rev += 1

    def body(self):
        with self.lock:
            return {"open": self.is_open(), "code": self.code, "url": self.url,
                    "closesAt": int(self.closes_at * 1000) if self.code else 0, "error": self.error, "rev": self.rev,
                    "items": [dict(i) for i in self.items],
                    "waiting": sum(1 for i in self.items if i["status"] == "new")}
