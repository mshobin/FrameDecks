"""FrameDecks 26.11.14 - Listen for scripture: when the leader (or whoever is near the PC's microphone) says a Bible
reference during the meeting, FrameDecks offers to put it on screen.

    "Romans chapter eight, verses thirty-eight to thirty-nine"  ->  the Studio shows  "Romans 8:38–39 · Show?"

How it fits together:
  * Settings (kc-app-settings.json, src/server.py APP_SETTINGS_DEFAULTS): "scriptureListen" (off by default) and
    "scriptureAuto" (off by default: a reference is suggested first; on: it goes on screen at once).
  * The microphone is used only while the setting is on AND a Frame is live (on screen). A watcher here checks both
    every POLL seconds and starts or stops the listening. Nothing else ever starts it.
  * Listening shares the Teleprompter's listening process (src/voice_follow.py, src/voice_worker.py: Vosk, offline,
    on this PC) with a small grammar of its own (src/scripture_speech.py.grammar_words). Nothing heard is recorded,
    kept or sent anywhere: a phrase is read for a reference and then forgotten.
  * What was heard becomes one pending suggestion, served by GET /api/verse-listen (this PC only):
        {"enabled", "auto", "live", "state", "message", "progress", "level", "seq",
         "pending": {"id", "ref", "label", "book", "chapter", "verse", "to", "at", "status"} | null}
    status is "waiting" (nobody has chosen yet) or "show" (another screen asked to show it; the Studio does the
    showing, so the scripture goes through the same Deck and the same tested steps as a typed one).
    ?after=<seq>&wait=<s> waits up to 10 s for a change.
  * POST /api/verse-listen {op, id?, text?}:
        "dismiss" (id)  not now: the suggestion goes away (the same reference is not offered again for REPEAT s)
        "show" (id)     another screen (the Command Center, the phone remote) asks the Studio to show it
        "shown" (id)    the Studio has put it on screen
        "hear" (text)   as if these words had been heard (tests, and a typed reference from this PC)
  Meeting sound (what the PC plays, e.g. a participant in Zoom) is not listened to yet: only the microphone."""
import threading
import time

import scripture_speech

POLL = 2.0          # seconds between checks of the setting and the live Frame
REPEAT = 45.0       # the same reference is not suggested again within this many seconds
WAIT_MAX = 10.0


class ScriptureListen:
    def __init__(self, voice, settings, is_live, clock=time.time):
        self.voice, self.settings, self.is_live, self.clock = voice, settings, is_live, clock
        self.cond = threading.Condition()
        self.pending, self.seq, self.recent = None, 0, {}
        self.listening, self.failed, self.last = False, False, {"state": "off"}
        self._n = 0
        self._thread = None

    # ---------- start / stop the microphone ----------
    def _want(self):
        cfg = self.settings() or {}
        return bool(cfg.get("scriptureListen")) and bool(self.is_live())

    def tick(self):
        """Listen exactly while it is wanted (the setting is on and a Frame is live). A change of what the screens
        show (listening or not, an error) wakes those waiting on body()."""
        self._tick()
        cfg = self.settings() or {}
        st = self.voice.scripture_body() if self.listening else self.last
        now = (self.listening, self.failed, st.get("state"), st.get("progress"), bool(cfg.get("scriptureListen")),
               bool(cfg.get("scriptureAuto")), bool(self.is_live()))
        if now != getattr(self, "_was", None):
            self._was = now
            with self.cond:
                self.seq += 1
                self.cond.notify_all()

    def _tick(self):
        want = self._want()
        if want and not self.listening and not self.failed:
            self.listening = True
            self.last = self.voice.scripture_start(scripture_speech.grammar_words(), self.heard) or {}
            if self.last.get("state") in ("unavailable", "memory", "error"):
                self.listening, self.failed = False, True
        elif want and self.listening and not self.voice.want_s:
            self.listening, self.failed = False, True        # it stopped by itself (an error): wait for a fresh start
            self.last = self.voice.scripture_body()
        elif not want:
            if self.listening:
                self.voice.scripture_stop()
            self.listening, self.failed = False, False
            if self.last.get("state") != "unavailable":
                self.last = {"state": "off"}
            if self.pending and not self.is_live():
                self._set(None)                               # nothing is live: nowhere to show it

    def _loop(self):
        while True:
            try:
                self.tick()
            except Exception as e:                            # the watcher never dies
                print("Listen for scripture:", e)
            time.sleep(POLL)

    def start(self):
        if not self._thread:
            self._thread = threading.Thread(target=self._loop, name="scripture-listen", daemon=True)
            self._thread.start()

    # ---------- what was heard ----------
    def heard(self, text):
        """A phrase from the listener (or the 'hear' test hook): a reference in it becomes the suggestion."""
        ref = scripture_speech.find(text)
        if not ref:
            return None
        now = self.clock()
        with self.cond:
            self.recent = {k: t for k, t in self.recent.items() if now - t < REPEAT}
            if (self.pending and self.pending["ref"] == ref["ref"]) or ref["ref"] in self.recent:
                return ref
            self._n += 1
            self._set(dict(ref, id="s%d-%d" % (int(now), self._n), at=int(now * 1000), status="waiting"))
        return ref

    def _set(self, pending):
        with self.cond:
            self.pending = pending
            self.seq += 1
            self.cond.notify_all()

    def act(self, op, pid=None, text=None):
        if op == "hear":
            ref = self.heard(str(text or "")[:500])
            return dict(self.body(), heard=ref)
        if op not in ("dismiss", "show", "shown"):
            raise ValueError("Unknown action.")
        with self.cond:
            p = self.pending
            if p and (pid is None or pid == p["id"]):
                if op == "show":
                    self._set(dict(p, status="show"))
                else:
                    self.recent[p["ref"]] = self.clock()
                    self._set(None)
        return self.body()

    def body(self, after=None, wait=0.0):
        end = time.monotonic() + max(0.0, min(WAIT_MAX, float(wait or 0)))
        with self.cond:
            while after is not None and self.seq <= after:
                left = end - time.monotonic()
                if left <= 0:
                    break
                self.cond.wait(left)
            pending, seq = (dict(self.pending) if self.pending else None), self.seq
        cfg = self.settings() or {}
        st = self.voice.scripture_body() if self.listening else dict(self.last)
        return {"enabled": bool(cfg.get("scriptureListen")), "auto": bool(cfg.get("scriptureAuto")), "live": bool(self.is_live()),
                "state": st.get("state", "off"), "message": st.get("message", ""), "progress": st.get("progress", 0),
                "level": st.get("level", 0), "seq": seq, "pending": pending}
