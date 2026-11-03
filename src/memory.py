"""FrameDecks 9.0 - Memory Cards (Capture Memory): what the presenter copies from a chat becomes a chat bubble on the
FrameDecks vCam picture.

The presenter turns Capture on, selects something in Teams, Zoom, Meet, Webex, Slack, Discord, ChatGPT, Claude, Copilot
or a browser and presses Ctrl+C (or pastes it into the phone remote: WhatsApp, SMS, any app). capture.py hands the
copied text here; this module turns it into Memory Cards (the sender's name and the message), one per message when a
copy holds several (9.1: a WhatsApp, Teams, Slack, Discord or Zoom conversation), works out the app it came from, drops
empty, oversized and repeated copies, and decides which cards are on screen:

  * a new card goes in at once (Settings: "Show as soon as it's copied"; never a private Zoom message);
  * on screen the cards keep the order they were copied in (9.1), oldest at the top;
  * an unpinned card leaves after the overlay's seconds; Show puts it back with its full text, and Show on several
    selected cards (show_many) puts them all on screen together;
  * a pinned card stays, and pinned cards are kept in kc-memory.json so they are there after a restart;
  * Hide all (Esc) empties the overlay until the next card or Show.

Unpinned cards live in memory only. Pure Python, no Windows calls: tested on every system (tests/test_memory.py).
"""
import json
import os
import re
import threading
import time
import uuid

SOURCES = ("zoom", "teams", "meet", "webex", "slack", "discord", "chatgpt", "claude", "copilot", "youtube", "twitch",
           "facebook", "whatsapp", "sms", "phone", "clipboard")
MAX_ITEMS = 100           # the oldest unpinned cards leave beyond this
MAX_VISIBLE = 6           # bubbles on screen at once (pinned first, then the newest; shown in the order copied)
MAX_SPLIT = 12            # messages taken from one copy of a conversation
MAX_PINNED = 12
MAX_RAW = 4000            # a longer copy is a document, not a chat conversation: ignored
MAX_TEXT = 500            # what a card keeps of a message
MAX_NAME = 40
DUPLICATE_SECONDS = 15    # the same text copied again within this time is the same capture

# the program a copy came from (the window in front when Ctrl+C was pressed)
_EXE = {"zoom.exe": "zoom", "zoomworkplace.exe": "zoom", "ms-teams.exe": "teams", "teams.exe": "teams",
        "discord.exe": "discord", "discordptb.exe": "discord", "discordcanary.exe": "discord", "slack.exe": "slack",
        "webex.exe": "webex", "ciscocollabhost.exe": "webex", "chatgpt.exe": "chatgpt", "claude.exe": "claude",
        "microsoft.copilot.exe": "copilot", "copilot.exe": "copilot", "whatsapp.exe": "whatsapp", "whatsapp.root.exe": "whatsapp"}
# the web page a browser copied from (its "HTML Format" carries SourceURL)
_URL = (("chatgpt.com", "chatgpt"), ("chat.openai.com", "chatgpt"), ("claude.ai", "claude"), ("copilot.microsoft.com", "copilot"),
        ("m365.cloud.microsoft", "copilot"), ("app.slack.com", "slack"), ("slack.com", "slack"), ("meet.google.com", "meet"),
        ("webex.com", "webex"), ("youtube.com", "youtube"), ("youtu.be", "youtube"), ("twitch.tv", "twitch"), ("facebook.com", "facebook"),
        ("fb.com", "facebook"), ("discord.com", "discord"), ("teams.microsoft.com", "teams"), ("teams.live.com", "teams"),
        ("zoom.us", "zoom"), ("zoom.com", "zoom"), ("web.whatsapp.com", "whatsapp"), ("whatsapp.com", "whatsapp"),
        ("messages.google.com", "sms"))

_INVISIBLE = re.compile("[​‌‍⁠﻿]")
_TIME = r"(?:(?:today|yesterday)\s+at\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?"
# Zoom's chat lines: "10:32:05 From Sarah to Everyone: How much does it cost?" (also without the time)
_ZOOM_LINE = re.compile(r"^(?:" + _TIME + r"\s+)?from\s+(?P<name>.+?)\s+to\s+(?P<to>[^:\n]+?)\s*:\s*(?P<msg>.+)$", re.I | re.S)
# a header line before the message: "Sarah 10:32 AM", "Sarah — Today at 10:32", "Sarah to Everyone 10:32"
_HEAD_TIME = re.compile(r"[\s,·•|\-–—]*" + _TIME + r"\s*$", re.I)
_HEAD_TO = re.compile(r"\s+to\s+(?P<to>everyone|me|you|host|hosts and panelists|.{1,40}?\((?:privately|direct message)\))\s*$", re.I)
_PRIVATE = re.compile(r"privately|direct message|\bto\s+(?:me|you)\b", re.I)
# WhatsApp: "[10:32, 03/11/2026] Sarah Lee: message" (copied from the app) or "03/11/2026, 10:32 - Sarah Lee: message"
# (an exported chat)
_DATE = r"\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}"
_WA_LINE = re.compile(r"^\[?\s*(?:" + _TIME + r"\s*,\s*" + _DATE + r"|" + _DATE + r"\s*,?\s*" + _TIME + r")\s*\]?\s*-?\s*"
                      r"(?P<name>[^:\n]{1,%d}?):\s+(?P<msg>.*)$" % 40, re.I)


def detect_source(exe="", url=""):
    """One of SOURCES: the chat or assistant a copy came from, or 'clipboard' (any other app)."""
    u = str(url or "").lower()
    for part, src in _URL:
        if part in u:
            return src
    name = str(exe or "").replace("\\", "/").rsplit("/", 1)[-1].lower()
    return _EXE.get(name, "clipboard")


_SPACES = re.compile(r"[ \t\u00a0\u2000-\u200a\u202f\u205f\u3000]+")
MAX_HEAD = 120            # 9.1.2 a line longer than this is a message, never a "Name 10:32" header


def _clean(text):
    """Line breaks unified, each line trimmed and its runs of spaces made one (9.1.2: long runs of spaces made the
    header patterns backtrack for seconds on a hostile copy)."""
    t = _INVISIBLE.sub("", str(text or "")).replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(_SPACES.sub(" ", line).strip() for line in t.split("\n")).strip()


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
    if len(lines) >= 2 and len(lines[0]) <= MAX_HEAD:
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


def _is_header(line):
    """A line that starts a message in a copied conversation: "Sarah Lee 10:32 AM", "Sarah — Today at 10:32"."""
    if len(line) > MAX_HEAD or not _HEAD_TIME.search(line) or re.fullmatch(_TIME, line.strip(), re.I):
        return False
    head = _HEAD_TIME.sub("", line).strip()
    to = _HEAD_TO.search(head)
    if to:
        head = head[:to.start()].strip()
    return _looks_like_name(head)


def split(text):
    """9.1 One copy -> its messages, each as text parse() reads, and the app it shows it came from ("whatsapp" or "").
    A copy of a conversation (several WhatsApp, Zoom, "Name: message" lines, or Teams / Slack / Discord blocks that
    each start with a name and a time) gives one chunk per message; anything else gives the copy itself."""
    t = _clean(text)
    lines = [line for line in t.split("\n") if line]
    if len(lines) < 2:
        return [t], ""

    def by(start, fmt=lambda line: line, join=" "):
        chunks = []
        for line in lines:
            if start(line):
                chunks.append([fmt(line)])
            elif chunks:
                chunks[-1].append(line)
            else:
                return None
        return [join.join(c) for c in chunks] if len(chunks) >= 2 else None

    wa = by(lambda line: bool(_WA_LINE.match(line)),
            lambda line: "%s: %s" % (_WA_LINE.match(line).group("name").strip(), _WA_LINE.match(line).group("msg")))
    if wa:
        return wa[:MAX_SPLIT], "whatsapp"
    zoom = by(lambda line: bool(_ZOOM_LINE.match(line)))
    if zoom:
        return zoom[:MAX_SPLIT], ""
    named = by(lambda line: bool(re.match(r"^[^:\n]{1,%d}:\s+\S" % MAX_NAME, line)) and _looks_like_name(line.split(":", 1)[0]))
    if named and all(":" in c.split("\n")[0] for c in named):
        return named[:MAX_SPLIT], ""
    blocks = by(_is_header, join="\n")
    if blocks and all("\n" in b for b in blocks):
        return blocks[:MAX_SPLIT], ""
    return [t], ""


def _key(text):
    return re.sub(r"\W+", " ", str(text or "").lower()).strip()


def title_of(card, src):
    """A card's title: who wrote it, else the start of the text, else the app it came from."""
    if card.get("name"):
        return card["name"][:MAX_NAME]
    words = card["text"].split()
    t = " ".join(words[:6])
    if len(t) > MAX_NAME:
        t = t[:MAX_NAME - 1].rstrip() + "\u2026"
    elif len(words) > 6:
        t += "\u2026"
    return t or APP_NAMES.get(src, "Chat")


APP_NAMES = {"zoom": "Zoom", "teams": "Teams", "meet": "Google Meet", "webex": "Webex", "slack": "Slack",
             "discord": "Discord", "chatgpt": "ChatGPT", "claude": "Claude", "copilot": "Copilot", "youtube": "YouTube",
             "twitch": "Twitch", "facebook": "Facebook", "whatsapp": "WhatsApp", "sms": "Messages", "phone": "Phone",
             "clipboard": "Chat"}
LAYOUTS = ("beside", "below", "over")     # the bubbles on FrameDecks vCam: beside the video, below it, or over it


class Memory:
    """The cards, newest first, and what the overlay shows. Thread-safe; wait() is a long-poll."""

    def __init__(self, path=None, clock=time.time):
        self.path, self.clock = path, clock
        self.items, self.capture, self.rev, self.hidden = [], False, 1, False
        self.added = 0
        self.notice = {"n": 0, "kind": "", "text": "", "id": ""}
        self._recent = {}
        self.cond = threading.Condition()
        self._load()

    # ---------- pinned cards on disk ----------
    def _load(self):
        if not self.path:
            return
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.loads(f.read())
        except (OSError, ValueError):
            return
        for c in (data.get("pinned") if isinstance(data, dict) else None) or []:
            if isinstance(c, dict) and str(c.get("text") or "").strip():
                self.items.append({"id": str(c.get("id") or "m" + uuid.uuid4().hex[:10])[:40],
                                   "title": str(c.get("title") or "")[:MAX_NAME], "text": _one_line(str(c["text"]))[:MAX_TEXT],
                                   "src": c.get("src") if c.get("src") in SOURCES else "clipboard", "private": False,
                                   "at": int(c.get("at") or 0), "pinned": True, "full": bool(c.get("full")), "shownAt": 0})
        del self.items[MAX_PINNED:]

    def _save(self):
        if not self.path:
            return
        keep = [{k: i[k] for k in ("id", "title", "text", "src", "at", "full")} for i in self.items if i["pinned"]]
        try:
            tmp = str(self.path) + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"pinned": keep}, f, ensure_ascii=False)
            os.replace(tmp, self.path)
        except OSError as e:
            print("Memory Cards: could not save the pinned cards:", e)

    # ---------- reading ----------
    def snapshot(self):
        with self.cond:
            return {"rev": self.rev, "capture": self.capture, "hidden": self.hidden,
                    "items": [dict(i) for i in self.items], "notice": dict(self.notice)}

    def wait(self, since, timeout):
        with self.cond:
            self.cond.wait_for(lambda: str(self.rev) != str(since), timeout=timeout)
        return self.snapshot()

    def get(self, item_id):
        with self.cond:
            return next((dict(i) for i in self.items if i["id"] == item_id), None)

    def overlay(self, seconds, now=None):
        """The cards on screen now, in the order they were copied (oldest first): pinned ones, then the newest shown ones.
        Returns (cards, seconds until the next one leaves or None)."""
        now = self.clock() if now is None else now
        ms, dur = now * 1000, max(3, min(120, int(seconds or 12))) * 1000
        with self.cond:
            if self.hidden:
                return [], None
            pinned = [i for i in self.items if i["pinned"]]
            timed = [i for i in self.items if not i["pinned"] and i["shownAt"] and ms < i["shownAt"] + dur]
            room = max(0, MAX_VISIBLE - len(pinned))
            timed = sorted(timed, key=lambda i: (i["shownAt"], i["at"]), reverse=True)[:room]
            order = {id(i): k for k, i in enumerate(self.items)}                   # newest first: ties keep copy order
            shown = sorted(pinned[:MAX_VISIBLE] + timed, key=lambda i: (i["at"], -order[id(i)]))   # 9.1 the order copied
            nxt = min([(i["shownAt"] + dur - ms) / 1000 for i in timed], default=None)
            cards = [{"id": i["id"], "title": i["title"], "text": i["text"], "src": i["src"], "pinned": i["pinned"],
                      "full": i["full"]} for i in shown]
            return cards, nxt

    # ---------- changing ----------
    def _changed(self, kind="", text="", item_id="", save=False):
        self.rev += 1
        if kind:
            self.notice = {"n": self.notice["n"] + 1, "kind": kind, "text": text, "id": item_id}
        if save:
            self._save()
        self.cond.notify_all()

    def touch(self):
        with self.cond:
            self._changed()

    def _find(self, item_id):
        return next((i for i in self.items if i["id"] == item_id), None)

    def set_capture(self, on):
        with self.cond:
            if self.capture != bool(on):
                self.capture = bool(on)
                self._changed()
            return self.capture

    def add(self, raw, exe="", url="", source=None, show=True):
        """A copy (or a typed or phone-pasted note). Returns (status, item): 'added', 'duplicate', 'empty' or
        'too-long'. A copy of a conversation becomes one card per message (9.1), in their order; item is the first new
        one and self.added the number made. show: put new cards on screen at once (never a private message)."""
        raw = str(raw or "")
        self.added = 0
        if len(raw) > MAX_RAW:
            with self.cond:
                self._changed("ignored", "Too long for a Memory Card (over %d characters)" % MAX_RAW)
            return "too-long", None
        chunks, seen_src = split(raw)
        src = source if source in SOURCES and source not in ("clipboard", "phone") else detect_source(exe, url)
        if src == "clipboard" and seen_src:
            src = seen_src
        elif src == "clipboard" and source == "phone":
            src = "phone"
        parsed = [parse(c, src) for c in chunks]
        parsed = [c for c in parsed if len(c["text"]) >= 2 and any(ch.isalnum() for ch in c["text"])]
        if not parsed:
            return "empty", None
        now = self.clock()
        with self.cond:
            self._recent = {k: t for k, t in self._recent.items() if now - t < DUPLICATE_SECONDS}
            made, dup = [], None
            for k, card in enumerate(parsed):
                key = _key(card["text"])
                old = next((i for i in self.items if _key(i["text"]) == key), None)
                if key in self._recent or old:
                    self._recent[key] = now
                    dup = dup or old
                    continue
                self._recent[key] = now
                private = bool(card["private"])
                at = int(now * 1000) + k                       # several from one copy keep their order
                item = {"id": "m" + uuid.uuid4().hex[:10], "title": title_of(card, src), "text": card["text"], "src": src,
                        "private": private, "at": at, "pinned": False, "full": False,
                        "shownAt": int(now * 1000) if show and not private else 0}
                if item["shownAt"]:
                    self.hidden = False
                self.items.insert(0, item)
                made.append(item)
            if not made:
                self._changed("duplicate", "Already a Memory Card", dup["id"] if dup else "")
                return "duplicate", dict(dup) if dup else None
            unpinned = [i for i in self.items if not i["pinned"]]
            for old in unpinned[MAX_ITEMS:]:
                self.items.remove(old)
            self.added = len(made)
            self._changed("captured", "Memory Card created" if len(made) == 1 else "%d Memory Cards created" % len(made),
                          made[0]["id"])
            return "added", dict(made[0])

    def edit(self, item_id, title=None, text=None):
        with self.cond:
            item = self._find(item_id)
            if not item:
                return None
            if title is not None:
                item["title"] = _one_line(str(title))[:MAX_NAME]
            if text is not None and _one_line(str(text)):
                item["text"] = _one_line(str(text))[:MAX_TEXT]
            self._changed(save=item["pinned"])
            return dict(item)

    def show(self, item_id, full=None):
        """Show: into the overlay (again) with its full text; called on a card in the overlay it toggles full text."""
        with self.cond:
            item = self._find(item_id)
            if not item:
                return None
            on_screen = not self.hidden and (item["pinned"] or item["shownAt"])
            item["full"] = (not item["full"] if on_screen else True) if full is None else bool(full)
            item["shownAt"] = int(self.clock() * 1000)
            self.hidden = False
            self._changed(save=item["pinned"])
            return dict(item)

    def show_many(self, ids):
        """9.1 Show on several selected cards: all of them on screen together, with their full text, in the order they
        were copied. Returns the cards found."""
        with self.cond:
            want = [i for i in self.items if i["id"] in set(str(x) for x in ids or [])]
            if not want:
                return []
            ms = int(self.clock() * 1000)
            for i in want:
                i["shownAt"], i["full"] = ms, True
            self.hidden = False
            self._changed(save=any(i["pinned"] for i in want))
            order = {id(i): k for k, i in enumerate(self.items)}
            return [dict(i) for i in sorted(want, key=lambda i: (i["at"], -order[id(i)]))]

    def pin(self, item_id, on=None):
        with self.cond:
            item = self._find(item_id)
            if not item:
                return None
            want = not item["pinned"] if on is None else bool(on)
            if want and not item["pinned"] and sum(1 for i in self.items if i["pinned"]) >= MAX_PINNED:
                raise ValueError("Up to %d cards can be pinned. Unpin one first." % MAX_PINNED)
            item["pinned"] = want
            item["shownAt"] = int(self.clock() * 1000)       # unpinned: it stays for the overlay's seconds, then goes
            if want:
                self.hidden = False
            self._changed(save=True)
            return dict(item)

    def hide(self, item_id):
        """Out of the overlay (unpinned too); the card stays in the list."""
        with self.cond:
            item = self._find(item_id)
            if not item:
                return None
            item["shownAt"], was = 0, item["pinned"]
            item["pinned"] = False
            self._changed(save=was)
            return dict(item)

    def hide_all(self):
        with self.cond:
            for i in self.items:
                i["shownAt"] = 0
            if not self.hidden:
                self.hidden = True
                self._changed()

    def delete(self, item_id):
        with self.cond:
            item = self._find(item_id)
            if not item:
                return False
            self.items.remove(item)
            self._changed(save=item["pinned"])
            return True

    def clear(self, pinned_too=False):
        with self.cond:
            had = any(i["pinned"] for i in self.items)
            self.items = [i for i in self.items if i["pinned"] and not pinned_too]
            self._recent = {}
            self._changed(save=had and pinned_too)
