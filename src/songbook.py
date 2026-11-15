"""FrameDecks 26.11.57 - the Song Library (app/js/songs.js).

Songs are kept once per church on this PC (<data>/kc-songs.json), not inside a meeting, so the same song is added to
any Frame in two clicks and next week's service reuses it. Each song keeps its words as sections (Verse 1, Chorus,
Bridge ...), an arrangement line that repeats sections without copying their words (V1 C V2 C B C), and the
details a church needs for its licence: author, CCLI song number and copyright. When a song goes on screen the
Studio says so (op "used"), and the usage report counts each song once per day for the month asked (for CCLI
reporting). Nothing here leaves the PC; the API is for this PC only (server.py, is_local).
"""

import json
import os
import re
import threading
import time
import uuid

MAX_SONGS = 3000
MAX_SECTIONS = 60
MAX_TEXT = 2000          # characters in one section
MAX_USES = 400           # days of use kept per song
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


def _s(v, limit):
    t = str(v if v is not None else "").replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    return t.strip()[:limit]


def clean_song(raw, keep_id=None):
    """A song as stored: only known fields, each trimmed to its size. Raises ValueError without a title or words."""
    if not isinstance(raw, dict):
        raise ValueError("That is not a song.")
    title = _s(raw.get("title"), 120)
    secs = []
    for x in raw.get("sections") if isinstance(raw.get("sections"), list) else []:
        if not isinstance(x, dict):
            continue
        text = _s(x.get("text"), MAX_TEXT)
        if not text:
            continue
        secs.append({"label": _s(x.get("label"), 40) or "Verse %d" % (len(secs) + 1), "text": text})
        if len(secs) >= MAX_SECTIONS:
            break
    if not title:
        raise ValueError("Give the song a title.")
    if not secs:
        raise ValueError("Add the words of the song.")
    sid = keep_id or _s(raw.get("id"), 40)
    if not SAFE_ID.match(sid or ""):
        sid = "s" + uuid.uuid4().hex[:10]
    order = [_s(o, 40) for o in (raw.get("order") if isinstance(raw.get("order"), list) else []) if _s(o, 40)][:80]
    return {"id": sid, "title": title, "author": _s(raw.get("author"), 160), "ccli": re.sub(r"[^0-9]", "", str(raw.get("ccli") or ""))[:12],
            "copyright": _s(raw.get("copyright"), 200), "key": _s(raw.get("key"), 12), "sections": secs, "order": order,
            "updated": int(time.time())}


class Songbook:
    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()

    def _read(self):
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            return {"v": 1, "songs": []}
        songs = data.get("songs") if isinstance(data, dict) else None
        return {"v": 1, "songs": [s for s in songs if isinstance(s, dict) and s.get("id")] if isinstance(songs, list) else []}

    def _write(self, data):
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        os.replace(tmp, self.path)

    def list(self, q=""):
        """Every song (newest change first), or those whose title, first line, author or CCLI number has q."""
        with self.lock:
            songs = self._read()["songs"]
        q = str(q or "").strip().lower()
        out = []
        for s in songs:
            first = (s.get("sections") or [{}])[0].get("text", "").split("\n")[0]
            hay = " ".join([s.get("title", ""), first, s.get("author", ""), s.get("ccli", "")]).lower()
            if q and q not in hay:
                continue
            out.append(dict(s, first=first[:120], uses=len(s.get("uses") or [])))
        out.sort(key=lambda s: -int(s.get("updated") or 0))
        return [{k: v for k, v in s.items() if k != "usedOn"} for s in out]

    def get(self, sid):
        with self.lock:
            for s in self._read()["songs"]:
                if s.get("id") == sid:
                    return s
        return None

    def save(self, raw):
        with self.lock:
            data = self._read()
            sid = _s((raw or {}).get("id"), 40) if isinstance(raw, dict) else ""
            old = next((s for s in data["songs"] if s.get("id") == sid), None) if sid else None
            song = clean_song(raw, keep_id=old["id"] if old else None)
            if old:
                song["uses"] = old.get("uses") or []
                data["songs"] = [song if s is old else s for s in data["songs"]]
            else:
                if len(data["songs"]) >= MAX_SONGS:
                    raise ValueError("The Song Library is full (%d songs). Delete some first." % MAX_SONGS)
                song["uses"] = []
                data["songs"].append(song)
            self._write(data)
            return song

    def delete(self, sid):
        with self.lock:
            data = self._read()
            n = len(data["songs"])
            data["songs"] = [s for s in data["songs"] if s.get("id") != sid]
            if len(data["songs"]) == n:
                return False
            self._write(data)
            return True

    def used(self, sid, when=None):
        """A song went on screen: counted once per day (a service), for the usage report."""
        day = time.strftime("%Y-%m-%d", time.localtime(when or time.time()))
        with self.lock:
            data = self._read()
            for s in data["songs"]:
                if s.get("id") == sid:
                    uses = [u for u in (s.get("uses") or []) if isinstance(u, str)]
                    if day in uses:
                        return False
                    s["uses"] = (uses + [day])[-MAX_USES:]
                    self._write(data)
                    return True
        return False

    def report(self, month):
        """The songs used in a month ("2026-11"): title, CCLI number, copyright and on how many days."""
        month = str(month or "")[:7]
        if not re.match(r"^\d{4}-\d{2}$", month):
            month = time.strftime("%Y-%m")
        with self.lock:
            songs = self._read()["songs"]
        rows = []
        for s in songs:
            n = sum(1 for u in (s.get("uses") or []) if isinstance(u, str) and u.startswith(month))
            if n:
                rows.append({"id": s["id"], "title": s.get("title", ""), "ccli": s.get("ccli", ""), "author": s.get("author", ""),
                             "copyright": s.get("copyright", ""), "times": n})
        rows.sort(key=lambda r: (-r["times"], r["title"].lower()))
        return {"month": month, "songs": rows}


def action(book, data):
    """POST /api/songs: {op: save | delete | used, ...}"""
    op = data.get("op")
    if op == "save":
        return {"ok": True, "song": book.save(data.get("song"))}
    if op == "delete":
        if not book.delete(_s(data.get("id"), 40)):
            raise ValueError("That song is not in the library.")
        return {"ok": True}
    if op == "used":
        return {"ok": True, "counted": book.used(_s(data.get("id"), 40))}
    if op == "import":
        made = []
        for raw in (data.get("songs") if isinstance(data.get("songs"), list) else [])[:200]:
            try:
                made.append(book.save(dict(raw, id="") if isinstance(raw, dict) else raw)["id"])
            except ValueError:
                continue
        return {"ok": True, "added": len(made), "ids": made}
    raise ValueError("Unknown action.")
