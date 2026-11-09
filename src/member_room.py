"""FrameDecks 26.11.24 - members' phones: follow along, prayer requests and the sermon notes, behind one code.

The leader opens it (Studio > Engage > Members' phones). FrameDecks asks the workspace for a short code and shows it
with a QR to framedecks.com/follow#c=CODE. Phones there show what is on the meeting screen as it changes: the Frame's
name, the question, the scripture, or that the screen is black (not birthday greetings: they name a member). Only what everyone can already see
on the meeting screen is published: never the Teleprompter, notes, the plan, or anything not shown.

When the prayer wall is open its code rides along, so the same page takes prayer requests. After the meeting the leader
can share the sermon notes there (src/meeting_log.py sermon_notes); they go when the room closes.

Publishing happens on its own thread, at most once a second, and only when what phones would show has changed
(0020_member_room.sql: pc_room_publish). Nothing is written to disk.
"""

import json
import threading
import time

MIN_GAP = 1.0            # seconds between two publishes
RETRY = 5.0              # after an error
TEXT_MAX = 1200          # characters of a question or a scripture on a phone


def _s(v, n):
    return " ".join(str(v or "").split())[:n]


def screen_of(st, prayer_code=""):
    """What phones show now: built only from what is visible on the meeting screen."""
    live = st.get("live") if isinstance(st.get("live"), dict) else {}
    sid = str(live.get("scene") or "")
    out = {"v": 1, "live": bool(sid)}
    meeting = st.get("meeting") if isinstance(st.get("meeting"), dict) else {}
    if _s(meeting.get("title"), 120):
        out["meeting"] = _s(meeting.get("title"), 120)
    if prayer_code:
        out["prayer"] = prayer_code
    if not sid:
        return out
    if live.get("blackout") or live.get("emergency"):
        out["black"] = True
        return out
    sc = next((x for x in st.get("scenes") or [] if isinstance(x, dict) and x.get("id") == sid), None) or {}
    out["frame"] = _s(sc.get("name"), 120) or "Frame"
    q = st.get("question") if isinstance(st.get("question"), dict) else {}
    if q.get("visible") and _s(q.get("text"), TEXT_MAX):
        out["question"] = {"label": _s(q.get("label"), 60) or "Question", "text": _s(q.get("text"), TEXT_MAX)}
    v = st.get("verse") if isinstance(st.get("verse"), dict) else {}
    if v.get("visible") and (_s(v.get("text"), TEXT_MAX) or _s(v.get("ref"), 80)):
        out["verse"] = {"ref": _s(v.get("ref"), 80), "text": _s(v.get("text"), TEXT_MAX), "version": _s(v.get("version"), 12)}
    return out


class MemberRoom:
    def __init__(self, team, state, prayer_code=lambda: "", clock=time.time, sleep=None):
        """team(): (api, site) for this PC, or raises when not linked. state(): the live state. prayer_code(): the
        open prayer wall's code, or ""."""
        self.team, self.state, self.prayer_code, self.clock = team, state, prayer_code, clock
        self.lock = threading.Lock()
        self.wake = threading.Event()
        self.code, self.url, self.closes_at = "", "", 0.0
        self.notes = None             # the shared sermon notes, or None
        self.notes_dirty = False
        self.last = None              # what was published last (json text)
        self.error = ""
        self.rev = 0                  # the Studio rides on this with the prayer wall's (server RIDERS "pr")
        self._stop = threading.Event()
        self._thread = None

    def is_open(self):
        return bool(self.code) and self.clock() < self.closes_at

    # ---------- open / close ----------
    def open(self, hours=6):
        api, site = self.team()
        answer = api.pc_room_open(int(hours)) or {}
        code = str(answer.get("code") or "").strip().upper()
        if not code:
            raise ValueError("No code came back. Try again.")
        with self.lock:
            self.code, self.url = code, "%s/follow#c=%s" % (site.rstrip("/"), code)
            self.closes_at = self.clock() + int(hours) * 3600
            self.notes, self.notes_dirty, self.last, self.error = None, False, None, ""
            self.rev += 1
        self._start()
        self.poke()
        return self.body()

    def close(self):
        self._stop.set()
        self.wake.set()
        try:
            api, _ = self.team()
            api.pc_room_close()
        except Exception as e:                 # offline: the room closes by itself in a few hours
            self.error = str(e)
        with self.lock:
            self.code, self.url, self.closes_at, self.notes, self.last = "", "", 0.0, None, None
            self.rev += 1
        return self.body()

    # ---------- the sermon notes ----------
    def share_notes(self, notes):
        if not self.is_open():
            raise ValueError("Open Members' phones first.")
        if len(json.dumps(notes)) > 110000:
            raise ValueError("These notes are too long to share. Shorten the scripts and try again.")
        with self.lock:
            self.notes, self.notes_dirty = notes, True
            self.rev += 1
        self.poke()
        return self.body()

    def unshare_notes(self):
        with self.lock:
            self.notes, self.notes_dirty = None, True
            self.rev += 1
        self.poke()
        return self.body()

    # ---------- publishing ----------
    def poke(self):
        """Something may have changed on screen (server.save_state): look soon."""
        if self.code:
            self.wake.set()

    def _start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="member-room", daemon=True)
        self._thread.start()

    def step(self):
        """One look: publish when what phones show (or the notes) changed. Returns True when it published."""
        if not self.is_open():
            return False
        screen = screen_of(self.state() or {}, self.prayer_code() or "")
        text = json.dumps(screen, sort_keys=True)
        with self.lock:
            notes_dirty, notes = self.notes_dirty, self.notes
            if text == self.last and not notes_dirty:
                return False
        api, _ = self.team()
        if notes_dirty:
            api.pc_room_publish(screen, notes, True)
        else:
            api.pc_room_publish(screen)
        with self.lock:
            self.last = text
            if self.notes is notes:
                self.notes_dirty = False
            if self.error:
                self.error = ""
                self.rev += 1
        return True

    def _loop(self):
        while not self._stop.is_set():
            self.wake.wait(30.0)            # also a look every 30 s, in case a change was missed
            self.wake.clear()
            if self._stop.is_set():
                return
            if not self.is_open():
                with self.lock:
                    self.code, self.url = "", ""
                    self.rev += 1
                return
            try:
                self.step()
                self._stop.wait(MIN_GAP)
            except Exception as e:
                with self.lock:
                    if self.error != str(e):
                        self.error = str(e)
                        self.rev += 1
                self.last = None
                self._stop.wait(RETRY)
                self.wake.set()

    def body(self):
        with self.lock:
            return {"open": self.is_open(), "code": self.code, "url": self.url,
                    "closesAt": int(self.closes_at * 1000) if self.code else 0, "error": self.error,
                    "notesShared": self.notes is not None, "notesTitle": (self.notes or {}).get("title", "")}
