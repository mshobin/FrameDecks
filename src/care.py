"""FrameDecks 26.11.63 - care and attendance, gently done: who joined each meeting, who is new, and who has missed twice.

When members' phones close (or the leader presses Save attendance), the first names people typed on their phones
(src/meeting_together.py) are kept here with the date, on this PC only and encrypted to the Windows account like the
member list (src/dpapi_file.py). Nobody has to give a name; a meeting can also be counted with no names at all.
It is a reminder for the leader to reach out, never a register: the Members tab shows "New this week" and "Missed the
last 2 meetings", and the leader can remove any meeting or name.
"""

import json
import os
import threading
import time

import dpapi_file

MAX_MEETINGS = 104          # about two years of weekly meetings


def _s(v, n):
    return " ".join(str(v or "").split())[:n]


def _key(name):
    return _s(name, 40).lower()


class Care:
    def __init__(self, path, clock=time.time):
        self.path, self.clock = path, clock
        self.lock = threading.Lock()
        self.meetings = []        # [{date, meeting, names: [str], count}], oldest first
        self.rev = 0
        self.load()

    def load(self):
        try:
            data = json.loads(dpapi_file.read_text(self.path))
        except FileNotFoundError:
            return
        except (OSError, ValueError, dpapi_file.Unreadable) as e:
            print("Care and attendance could not be read:", e)
            return
        out = []
        for m in data.get("meetings") if isinstance(data, dict) else []:
            if isinstance(m, dict) and _s(m.get("date"), 10):
                out.append({"date": _s(m.get("date"), 10), "meeting": _s(m.get("meeting"), 120),
                            "names": sorted({_s(n, 40) for n in m.get("names") or [] if _s(n, 40)}, key=str.lower)[:300],
                            "count": max(0, int(m.get("count") or 0))})
        with self.lock:
            self.meetings = sorted(out, key=lambda m: m["date"])[-MAX_MEETINGS:]

    def save(self):
        with self.lock:
            text = json.dumps({"v": 1, "meetings": self.meetings}, ensure_ascii=False)
        tmp = self.path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(dpapi_file.encode(text))
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, self.path)

    def record(self, names, count, meeting="", day=None):
        """Keep one meeting: the names given (any order, duplicates dropped) and how many joined. Same day and meeting
        again: the names are added to that day's."""
        day = day or time.strftime("%Y-%m-%d", time.localtime(self.clock()))
        names = sorted({_s(n, 40) for n in names or [] if _s(n, 40)}, key=str.lower)
        if not names and not count:
            return None
        with self.lock:
            m = next((x for x in self.meetings if x["date"] == day and x["meeting"] == _s(meeting, 120)), None)
            if m:
                m["names"] = sorted({*m["names"], *names}, key=str.lower)[:300]
                m["count"] = max(m["count"], int(count or 0), len(m["names"]))
            else:
                m = {"date": day, "meeting": _s(meeting, 120), "names": names[:300], "count": max(int(count or 0), len(names))}
                self.meetings.append(m)
                self.meetings = sorted(self.meetings, key=lambda x: x["date"])[-MAX_MEETINGS:]
            self.rev += 1
            out = dict(m)
        self.save()
        return out

    def forget(self, day=None, name=None):
        """Remove one meeting (day), or one name from every meeting."""
        with self.lock:
            if day:
                self.meetings = [m for m in self.meetings if m["date"] != day]
            if name:
                for m in self.meetings:
                    m["names"] = [n for n in m["names"] if _key(n) != _key(name)]
            self.rev += 1
        self.save()

    def summary(self, members=()):
        """For the Members tab: the last meeting, who is new, who missed the last two (seen at least twice before)."""
        with self.lock:
            ms = [dict(m) for m in self.meetings]
        if not ms:
            return {"meetings": 0, "last": None, "new": [], "missed": [], "average": 0, "history": []}
        last = ms[-1]
        earlier = ms[:-1]
        before = {_key(n) for m in earlier for n in m["names"]}
        new = [n for n in last["names"] if _key(n) not in before]
        missed = []
        if len(ms) >= 3:
            recent = {_key(n) for m in ms[-2:] for n in m["names"]}
            counts = {}
            for m in ms[:-2]:
                for n in m["names"]:
                    counts.setdefault(_key(n), [n, 0])[1] += 1
            missed = sorted([v[0] for k, v in counts.items() if v[1] >= 2 and k not in recent], key=str.lower)
        recent_counts = [m["count"] for m in ms[-6:]]
        return {"meetings": len(ms), "last": last, "new": new, "missed": missed[:40],
                "average": round(sum(recent_counts) / len(recent_counts)) if recent_counts else 0,
                "history": [{"date": m["date"], "count": m["count"], "named": len(m["names"])} for m in ms[-12:]]}

    def body(self, members=()):
        return dict(self.summary(members), rev=self.rev)
