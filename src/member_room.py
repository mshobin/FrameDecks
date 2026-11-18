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


# 26.11.45 the slide on screen for phones: a function (state, budget) -> {n, of, page, title, text, img} or None, set by
# server.py. 26.11.48: it fits in `budget` characters, so the screen stays within the room's 16,000 bytes (0020).
SLIDE = None
# 26.11.48 the slide on screen as a sharp picture for phones to zoom into and look back at (0025_room_slides.sql):
# a function () -> {key, page, title, text, img} or None, set by server.py
SLIDE_FULL = None
SCREEN_MAX = 15500       # characters: under the room's 16,000-byte screen (0020), with room for JSON escaping


def song_of(st, sc, live):
    """26.11.63 the Song on screen with its chords, for musicians' phones: {title, credit, key, at, items} or None.
    Only a Song Content that is on screen and has at least one part with [G] chords."""
    on = live.get("on") if isinstance(live.get("on"), dict) else {}
    for l in (sc or {}).get("layers") or []:
        if not isinstance(l, dict) or l.get("kind") != "song" or not on.get(l.get("id")):
            continue
        c = l.get("c") if isinstance(l.get("c"), dict) else {}
        items = [x for x in c.get("items") or [] if isinstance(x, dict)]
        if not any("[" in str(x.get("chords") or "") for x in items):
            return None
        out = {"title": _s(c.get("song") or c.get("title") or l.get("name"), 120), "credit": _s(c.get("credit"), 200),
               "key": _s(c.get("key"), 12), "at": max(0, min(len(items) - 1, int(c.get("at") or 0))), "items": []}
        room = 9000
        for x in items[:40]:
            it = {"label": _s(x.get("label"), 40), "text": str(x.get("text") or "")[:1500]}
            if "[" in str(x.get("chords") or ""):
                it["chords"] = str(x.get("chords"))[:2500]
            room -= len(json.dumps(it))
            if room < 0:
                break
            out["items"].append(it)
        return out
    return None


def screen_of(st, prayer_code="", extra=None):
    """What phones show now: built only from what is visible on the meeting screen. extra (26.11.63): the meeting
    together switches {people, hands, quiz, takehome: True} and chords (musicians may see the Song's chords)."""
    live = st.get("live") if isinstance(st.get("live"), dict) else {}
    sid = str(live.get("scene") or "")
    out = {"v": 1, "live": bool(sid)}
    extra = extra if isinstance(extra, dict) else {}
    for k in ("people", "hands", "quiz", "takehome"):
        if extra.get(k):
            out[k] = True
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
    if extra.get("chords"):
        song = song_of(st, sc, live)
        if song:
            out["song"] = song
    q = st.get("question") if isinstance(st.get("question"), dict) else {}
    if q.get("visible") and _s(q.get("text"), TEXT_MAX):
        out["question"] = {"label": _s(q.get("label"), 60) or "Question", "text": _s(q.get("text"), TEXT_MAX)}
    v = st.get("verse") if isinstance(st.get("verse"), dict) else {}
    if v.get("visible") and (_s(v.get("text"), TEXT_MAX) or _s(v.get("ref"), 80)):
        out["verse"] = {"ref": _s(v.get("ref"), 80), "text": _s(v.get("text"), TEXT_MAX), "version": _s(v.get("version"), 12)}
    if SLIDE and isinstance(live.get("deck"), dict):  # last: the slide's picture takes the room the rest leaves
        try:
            sl = SLIDE(st, SCREEN_MAX - len(json.dumps(out)) - 40)
            if sl:
                out["slide"] = sl
        except Exception as e:                       # a slide that cannot be read never stops the phones
            print("Members' phones (slide):", e)
    return out


class MemberRoom:
    def __init__(self, team, state, prayer_code=lambda: "", clock=time.time, sleep=None, extra=lambda: {}, on_open=None, on_close=None):
        """team(): (api, site) for this PC, or raises when not linked. state(): the live state. prayer_code(): the
        open prayer wall's code, or "". extra(): 26.11.63 what else phones are told (screen_of). on_open() / on_close():
        called after a room opens (a new code) and before it closes (the attendance is kept then)."""
        self.team, self.state, self.prayer_code, self.clock = team, state, prayer_code, clock
        self.extra, self.on_open, self.on_close = extra, on_open, on_close
        self.lock = threading.Lock()
        self.wake = threading.Event()
        self.code, self.url, self.closes_at = "", "", 0.0
        self.notes = None             # the shared sermon notes, or None
        self.notes_dirty = False
        self.last = None              # what was published last (json text)
        self.error = ""
        self.rev = 0                  # the Studio rides on this with the prayer wall's (server RIDERS "pr")
        self.slides_ok = None         # 26.11.48 sharp slides (0025): None not asked yet, False not in this workspace
        self.slide_key = None         # the sharp slide sent last in this room
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
            self.slide_key = None
            self.rev += 1
        if self.on_open:
            self.on_open()
        self._start()
        self.poke()
        return self.body()

    def close(self):
        if self.on_close:
            try:
                self.on_close()
            except Exception as e:             # keeping the attendance never stops the room closing
                print("Members' phones (closing):", e)
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
        try:
            extra = self.extra() or {}
        except Exception:
            extra = {}
        screen = screen_of(self.state() or {}, self.prayer_code() or "", extra)
        text = json.dumps(screen, sort_keys=True)
        with self.lock:
            notes_dirty, notes = self.notes_dirty, self.notes
            if text == self.last and not notes_dirty:
                same = True
            else:
                same = False
        if same:
            if SLIDE_FULL and self.slides_ok is not False:
                try:
                    self.send_slide(self.team()[0])    # a sharp slide that could not go before
                except Exception as e:
                    print("Members' phones (sharp slide):", e)
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
        self.send_slide(api)
        return True

    def send_slide(self, api):
        """26.11.48 the slide on screen, sharp, for phones to zoom into and look back at (0025). Sent once per slide (and
        again after an animation); a workspace without 0025 yet is asked once, then the small picture is enough."""
        if not SLIDE_FULL or self.slides_ok is False:
            return False
        try:
            full = SLIDE_FULL()
        except Exception as e:
            print("Members' phones (sharp slide):", e)
            return False
        if not full or full.get("key") == self.slide_key:
            return False
        try:
            api.pc_room_slide(full["page"], full.get("title", ""), full.get("text", ""), full.get("img"))
        except Exception as e:
            if "pc_room_slide" in str(e) or "function" in str(e).lower() or "PGRST202" in str(e):
                self.slides_ok = False                 # 0025 is not in this workspace yet
                print("Members' phones: sharp slides need 0025_room_slides.sql in the workspace.")
            return False
        self.slides_ok, self.slide_key = True, full.get("key")
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
