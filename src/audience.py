"""FrameDecks 8.8 - the Live Audience Capture Dock's queue (docs/architecture/audience-dock.md).

The presenter selects a message in any chat (Zoom, Teams, YouTube, Twitch, Facebook Live, Discord, a browser) and presses
Ctrl+C; capture.py hands the copied text here. This module turns it into an Audience Card: it guesses the app it came
from, separates the sender from the message where the copy says who wrote it, drops empty, oversized and repeated
copies, and keeps the queue the dock shows.

The queue lives in memory only: nothing is written to disk or sent anywhere, and it is gone when FrameDecks closes.
The card on screen is live.audience in the state (server.py), cleared by Hide all, by its timer or by Hide.
Pure Python, no Windows calls, so every rule here is tested on every system (tests/test_audience.py).
"""
import re
import threading
import time
import uuid

SOURCES = ("zoom", "teams", "youtube", "twitch", "facebook", "discord", "clipboard")
MAX_ITEMS = 100           # the oldest cards leave the queue beyond this
MAX_RAW = 2000            # a longer copy is a document, not a chat message: ignored
MAX_TEXT = 500            # what a card keeps of a message
MAX_NAME = 40
DUPLICATE_SECONDS = 15    # the same text copied again within this time is the same capture

# the program a copy came from (the window in front when Ctrl+C was pressed)
_EXE = {"zoom.exe": "zoom", "zoomworkplace.exe": "zoom", "ms-teams.exe": "teams", "teams.exe": "teams",
        "discord.exe": "discord", "discordptb.exe": "discord", "discordcanary.exe": "discord"}
# the web page a browser copied from (its "HTML Format" carries SourceURL)
_URL = (("youtube.com", "youtube"), ("youtu.be", "youtube"), ("twitch.tv", "twitch"), ("facebook.com", "facebook"),
        ("fb.com", "facebook"), ("discord.com", "discord"), ("teams.microsoft.com", "teams"), ("teams.live.com", "teams"),
        ("zoom.us", "zoom"), ("zoom.com", "zoom"))

_INVISIBLE = re.compile("[​‌‍⁠﻿]")
_TIME = r"(?:(?:today|yesterday)\s+at\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?"
# Zoom's chat lines: "10:32:05 From Sarah to Everyone: How much does it cost?" (also without the time)
_ZOOM_LINE = re.compile(r"^(?:" + _TIME + r"\s+)?from\s+(?P<name>.+?)\s+to\s+(?P<to>[^:\n]+?)\s*:\s*(?P<msg>.+)$", re.I | re.S)
# a header line before the message: "Sarah 10:32 AM", "Sarah — Today at 10:32", "Sarah to Everyone 10:32"
_HEAD_TIME = re.compile(r"[\s,·•|\-–—]*" + _TIME + r"\s*$", re.I)
_HEAD_TO = re.compile(r"\s+to\s+(?P<to>everyone|me|you|host|hosts and panelists|.{1,40}?\((?:privately|direct message)\))\s*$", re.I)
_PRIVATE = re.compile(r"privately|direct message|\bto\s+(?:me|you)\b", re.I)


def detect_source(exe="", url=""):
    """'zoom', 'teams', 'youtube', 'twitch', 'facebook', 'discord' or 'clipboard' (any other app)."""
    u = str(url or "").lower()
    for part, src in _URL:
        if part in u:
            return src
    name = str(exe or "").replace("\\", "/").rsplit("/", 1)[-1].lower()
    return _EXE.get(name, "clipboard")


def _clean(text):
    t = _INVISIBLE.sub("", str(text or "")).replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(line.strip() for line in t.split("\n")).strip()


def _one_line(text):
    return re.sub(r"\s+", " ", text).strip()


def _looks_like_name(s):
    s = s.strip()
    if not s or len(s) > MAX_NAME or "://" in s or "www." in s.lower():
        return False
    if s[-1] in ".?!," or len(s.split()) > 5:              # a sentence, not a name
        return False
    return any(ch.isalpha() for ch in s)


def parse(text, source="clipboard"):
    """The copied text -> {name, text, private}. The name is '' when the copy does not say who wrote it."""
    t = _clean(text)
    m = _ZOOM_LINE.match(t)
    if m and _looks_like_name(m.group("name")):
        to = m.group("to").strip()
        return {"name": m.group("name").strip(), "text": _one_line(m.group("msg"))[:MAX_TEXT],
                "private": not to.lower().startswith("everyone") or bool(_PRIVATE.search(to))}
    lines = [line for line in t.split("\n") if line]
    if len(lines) >= 2:
        head, private = lines[0], False
        head = _HEAD_TIME.sub("", head).strip()
        to = _HEAD_TO.search(head)
        if to:
            private = bool(_PRIVATE.search(to.group("to"))) or not to.group("to").lower().startswith(("everyone", "host"))
            head = head[:to.start()].strip()
        head = _HEAD_TIME.sub("", head).strip()
        if _looks_like_name(head):
            rest = [line for line in lines[1:] if not re.fullmatch(_TIME, line, re.I)]   # a time on its own line
            if rest:
                return {"name": head, "text": _one_line(" ".join(rest))[:MAX_TEXT], "private": private}
    m = re.match(r"^(?P<name>[^:\n]{1,%d}):\s+(?P<msg>\S.*)$" % MAX_NAME, t, re.S)
    if m and _looks_like_name(m.group("name")) and not re.fullmatch(r"\d{1,2}", m.group("name").strip()):
        return {"name": m.group("name").strip(), "text": _one_line(m.group("msg"))[:MAX_TEXT], "private": False}
    return {"name": "", "text": _one_line(t)[:MAX_TEXT], "private": False}


def _key(text):
    return re.sub(r"\W+", " ", str(text or "").lower()).strip()


class Audience:
    """The queue of captured messages, newest first, and whether Capture is on. Thread-safe; wait() is a long-poll."""

    def __init__(self, clock=time.time):
        self.clock = clock
        self.items, self.capture, self.rev = [], False, 1
        self.notice = {"n": 0, "kind": "", "text": "", "id": ""}
        self._recent = {}                               # message key -> when it was last copied
        self.cond = threading.Condition()

    # ---------- reading ----------
    def snapshot(self):
        with self.cond:
            return {"rev": self.rev, "capture": self.capture, "items": [dict(i) for i in self.items], "notice": dict(self.notice)}

    def wait(self, since, timeout):
        with self.cond:
            self.cond.wait_for(lambda: str(self.rev) != str(since), timeout=timeout)
        return self.snapshot()

    def get(self, item_id):
        with self.cond:
            return next((dict(i) for i in self.items if i["id"] == item_id), None)

    # ---------- changing ----------
    def _changed(self, kind="", text="", item_id=""):
        self.rev += 1
        if kind:
            self.notice = {"n": self.notice["n"] + 1, "kind": kind, "text": text, "id": item_id}
        self.cond.notify_all()

    def touch(self):
        """Something the dock shows changed outside the queue (the card on screen, a setting): wake its long-poll."""
        with self.cond:
            self._changed()

    def set_capture(self, on):
        with self.cond:
            if self.capture != bool(on):
                self.capture = bool(on)
                self._changed()
            return self.capture

    def add(self, raw, exe="", url="", source=None):
        """A copy (or a typed question). Returns (status, item): 'added', 'duplicate', 'empty' or 'too-long'."""
        raw = str(raw or "")
        if len(raw) > MAX_RAW:
            with self.cond:
                self._changed("ignored", "Too long for an audience question (over %d characters)" % MAX_RAW)
            return "too-long", None
        src = source if source in SOURCES else detect_source(exe, url)
        card = parse(raw, src)
        if len(card["text"]) < 2 or not any(ch.isalnum() for ch in card["text"]):
            return "empty", None
        key, now = _key(card["text"]), self.clock()
        with self.cond:
            self._recent = {k: t for k, t in self._recent.items() if now - t < DUPLICATE_SECONDS}
            dup = next((i for i in self.items if _key(i["text"]) == key), None)
            if key in self._recent or dup:
                self._recent[key] = now
                self._changed("duplicate", "Already in the queue", dup["id"] if dup else "")
                return "duplicate", dict(dup) if dup else None
            self._recent[key] = now
            item = {"id": "a" + uuid.uuid4().hex[:10], "name": card["name"][:MAX_NAME], "text": card["text"], "src": src,
                    "private": bool(card["private"]), "at": int(now * 1000), "shown": False}
            self.items.insert(0, item)
            del self.items[MAX_ITEMS:]
            self._changed("captured", "Audience Question Captured", item["id"])
            return "added", dict(item)

    def edit(self, item_id, name=None, text=None):
        with self.cond:
            item = next((i for i in self.items if i["id"] == item_id), None)
            if not item:
                return None
            if name is not None:
                item["name"] = _one_line(str(name))[:MAX_NAME]
            if text is not None:
                t = _one_line(str(text))[:MAX_TEXT]
                if t:
                    item["text"] = t
            self._changed()
            return dict(item)

    def mark_shown(self, item_id):
        with self.cond:
            item = next((i for i in self.items if i["id"] == item_id), None)
            if item and not item["shown"]:
                item["shown"] = True
                self._changed()

    def delete(self, item_id):
        with self.cond:
            n = len(self.items)
            self.items = [i for i in self.items if i["id"] != item_id]
            if len(self.items) != n:
                self._changed()
            return len(self.items) != n

    def clear(self):
        with self.cond:
            self.items, self._recent = [], {}
            self._changed()


def live_card(item, pin=False, seconds=12, share=False, now=None):
    """What live.audience holds while a card is on screen (store.js cleanAudience keeps the same fields)."""
    now = time.time() if now is None else now
    return {"id": str(item["id"]), "name": str(item.get("name") or "")[:MAX_NAME], "text": str(item.get("text") or "")[:MAX_TEXT],
            "src": item.get("src") if item.get("src") in SOURCES else "clipboard", "at": int(now * 1000),
            "dur": 0 if pin else max(3, min(120, int(seconds or 12))), "share": bool(share)}


def visible(card, now=None):
    """Is this live.audience still on screen? (Pinned: until hidden; timed: until its seconds are up.)"""
    if not isinstance(card, dict) or not card.get("id") or not str(card.get("text") or "").strip():
        return False
    dur = card.get("dur") or 0
    if not dur:
        return True
    now = time.time() if now is None else now
    return now * 1000 < float(card.get("at") or 0) + float(dur) * 1000
