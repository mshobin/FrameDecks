"""FrameDecks 26.11.63 - the prayer journey: prayer requests kept over the weeks, "Still praying" and "Answered".

Every request that comes in through the prayer wall (src/prayer_wall.py) is kept here, on this PC only, encrypted to
the Windows account like the member list (src/dpapi_file.py). The leader marks each one Still praying or Answered
(with an optional note), and chooses OK to share. Private by default: only requests marked OK to share reach the
take-home page and the Answered prayers card on screen, and never with a name. The person who asked sees how their
own request is going on the take-home page by its id only (no words leave this PC for that).
"""

import json
import os
import threading
import time

import dpapi_file

MAX_ITEMS = 500
STATUSES = ("praying", "answered")


def _s(v, n):
    return " ".join(str(v or "").split())[:n]


class PrayerJourney:
    def __init__(self, path, clock=time.time):
        self.path, self.clock = path, clock
        self.lock = threading.Lock()
        self.items = []          # [{id, sid, body, name, at, status, share, answeredAt, note}], newest first
        self.rev = 0
        self.load()

    # ---------- the file ----------
    def load(self):
        try:
            data = json.loads(dpapi_file.read_text(self.path))
        except FileNotFoundError:
            return
        except (OSError, ValueError, dpapi_file.Unreadable) as e:
            print("Prayer journey could not be read:", e)
            return
        out = []
        for it in data.get("items") if isinstance(data, dict) else []:
            if isinstance(it, dict) and _s(it.get("body"), 500):
                out.append(self._clean(it))
        with self.lock:
            self.items = out[:MAX_ITEMS]

    def _clean(self, it):
        return {"id": _s(it.get("id"), 20) or "j" + os.urandom(5).hex(), "sid": _s(it.get("sid"), 40),
                "body": _s(it.get("body"), 500), "name": _s(it.get("name"), 40), "at": int(it.get("at") or 0),
                "status": it.get("status") if it.get("status") in STATUSES else "praying",
                "share": bool(it.get("share")), "answeredAt": int(it.get("answeredAt") or 0), "note": _s(it.get("note"), 300)}

    def save(self):
        with self.lock:
            text = json.dumps({"v": 1, "items": self.items}, ensure_ascii=False)
        tmp = self.path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(dpapi_file.encode(text))
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, self.path)                    # a power cut never leaves half a file

    # ---------- requests in ----------
    def add(self, body, name="", sid=""):
        body = _s(body, 500)
        if not body:
            return None
        with self.lock:
            if sid and any(i["sid"] == sid for i in self.items):
                return None
            it = self._clean({"sid": sid, "body": body, "name": name, "at": int(self.clock() * 1000)})
            self.items.insert(0, it)
            self.items = self.items[:MAX_ITEMS]
            self.rev += 1
        self.save()
        return dict(it)

    # ---------- the leader's choices ----------
    def update(self, item_id, status=None, share=None, note=None):
        with self.lock:
            it = next((i for i in self.items if i["id"] == item_id), None)
            if not it:
                raise ValueError("That request is no longer there.")
            if status is not None:
                if status not in STATUSES:
                    raise ValueError("Unknown status.")
                if status == "answered" and it["status"] != "answered":
                    it["answeredAt"] = int(self.clock() * 1000)
                it["status"] = status
            if share is not None:
                it["share"] = bool(share)
            if note is not None:
                it["note"] = _s(note, 300)
            self.rev += 1
            out = dict(it)
        self.save()
        return out

    def remove(self, item_id):
        with self.lock:
            n = len(self.items)
            self.items = [i for i in self.items if i["id"] != item_id]
            if len(self.items) == n:
                raise ValueError("That request is no longer there.")
            self.rev += 1
        self.save()

    # ---------- what leaves this PC ----------
    def answered_card(self, days=30):
        """The Answered prayers card (shared ones only, no names): (title, text)."""
        since = int((self.clock() - days * 86400) * 1000)
        with self.lock:
            lines = [i["body"] + (" — " + i["note"] if i["note"] else "") for i in self.items
                     if i["status"] == "answered" and i["share"] and i["answeredAt"] >= since]
        if not lines:
            raise ValueError("Mark an answered prayer as OK to share first.")
        return "Answered prayers", "\n".join("• " + x for x in lines[:8])

    def for_takehome(self, days=30):
        """{shared: [text], answered: [text], status: {sid: status}} for the take-home page."""
        since = int((self.clock() - days * 86400) * 1000)
        with self.lock:
            shared = [i["body"] for i in self.items if i["share"] and i["status"] == "praying"]
            answered = [i["body"] + (" — " + i["note"] if i["note"] else "") for i in self.items
                        if i["share"] and i["status"] == "answered" and i["answeredAt"] >= since]
            status = {i["sid"]: i["status"] for i in self.items if i["sid"]}
        return {"shared": shared[:20], "answered": answered[:20], "status": status}

    def body(self):
        with self.lock:
            return {"items": [dict(i) for i in self.items], "rev": self.rev,
                    "praying": sum(1 for i in self.items if i["status"] == "praying"),
                    "answered": sum(1 for i in self.items if i["status"] == "answered")}
