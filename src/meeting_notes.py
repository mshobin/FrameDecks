"""FrameDecks 9.12 - the leader's notes (the Command Center's Notes chip, app/js/cc-notes.js).

Private notes taken during a meeting or presentation, kept on this PC only: one small JSON file per meeting in
<data>/notes/. Each note is stamped when it is written with the time and the Frame that was on screen, so the notes
line up with the meeting afterwards. Nothing here is synced to the workspace, sent to the phone remote, or put in the
diagnostics file sent when asking for help; the API is for this PC only (server.py, is_local).
"""

import json
import os
import re
import threading
import time
import uuid

MAX_NOTES = 500          # per meeting
MAX_TEXT = 4000          # characters in one note
MAX_MEETINGS = 400       # files kept; the oldest go first
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
NO_MEETING = "no-meeting"


def safe_id(meeting):
    """The meeting's id as a file name, or the 'no meeting' notes when it is missing or odd."""
    m = str(meeting or "").strip()
    return m if SAFE_ID.match(m) else NO_MEETING


def _clean(text, limit):
    t = str(text or "").replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    return t.strip()[:limit]


class Notes:
    def __init__(self, folder):
        self.folder = folder
        self.lock = threading.Lock()

    def _path(self, meeting):
        return os.path.join(self.folder, safe_id(meeting) + ".json")

    def _read(self, meeting):
        try:
            with open(self._path(meeting), encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            return {"meeting": safe_id(meeting), "name": "", "notes": []}
        if not isinstance(data, dict) or not isinstance(data.get("notes"), list):
            return {"meeting": safe_id(meeting), "name": "", "notes": []}
        notes = [n for n in data["notes"] if isinstance(n, dict) and isinstance(n.get("text"), str) and isinstance(n.get("id"), str)]
        return {"meeting": safe_id(meeting), "name": str(data.get("name") or "")[:200], "notes": notes[-MAX_NOTES:]}

    def _write(self, data):
        os.makedirs(self.folder, exist_ok=True)
        path = self._path(data["meeting"])
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        os.replace(tmp, path)
        self._trim()

    def _trim(self):
        try:
            files = [os.path.join(self.folder, f) for f in os.listdir(self.folder) if f.endswith(".json")]
        except OSError:
            return
        if len(files) <= MAX_MEETINGS:
            return
        files.sort(key=lambda p: os.path.getmtime(p))
        for p in files[:len(files) - MAX_MEETINGS]:
            try:
                os.remove(p)
            except OSError:
                pass

    def get(self, meeting):
        with self.lock:
            return self._read(meeting)

    def add(self, meeting, text, name="", frame="", at=None):
        text = _clean(text, MAX_TEXT)
        if not text:
            raise ValueError("Write something first.")
        with self.lock:
            data = self._read(meeting)
            if name:
                data["name"] = _clean(name, 200)
            note = {"id": uuid.uuid4().hex[:12], "text": text, "at": float(at if isinstance(at, (int, float)) else time.time()),
                    "frame": _clean(frame, 200)}
            data["notes"] = (data["notes"] + [note])[-MAX_NOTES:]
            self._write(data)
            return note, data

    def edit(self, meeting, note_id, text):
        text = _clean(text, MAX_TEXT)
        with self.lock:
            data = self._read(meeting)
            for n in data["notes"]:
                if n["id"] == note_id:
                    if not text:                      # emptied: the note goes
                        data["notes"] = [x for x in data["notes"] if x["id"] != note_id]
                    else:
                        n["text"] = text
                    self._write(data)
                    return data
        raise ValueError("That note is no longer there.")

    def delete(self, meeting, note_id):
        with self.lock:
            data = self._read(meeting)
            keep = [n for n in data["notes"] if n["id"] != note_id]
            if len(keep) == len(data["notes"]):
                raise ValueError("That note is no longer there.")
            data["notes"] = keep
            self._write(data)
            return data

    def clear(self, meeting):
        with self.lock:
            data = self._read(meeting)
            data["notes"] = []
            self._write(data)
            return data


def as_text(data, fmt_time=None):
    """The notes as Markdown: a heading with the meeting, then one line per note with its time and Frame."""
    fmt_time = fmt_time or (lambda t: time.strftime("%d %b %Y %H:%M", time.localtime(t)))
    lines = ["# Notes: " + (data.get("name") or "Meeting"), ""]
    for n in data.get("notes", []):
        stamp = fmt_time(n.get("at") or 0) + (" · " + n["frame"] if n.get("frame") else "")
        body = n["text"].replace("\n", "\n  ")
        lines.append("- **" + stamp + "**: " + body)
    return "\n".join(lines) + "\n"
