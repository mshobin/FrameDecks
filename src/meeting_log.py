"""FrameDecks 26.11.23 - the meeting log behind the meeting summary.

While a Frame is live, every Frame, question and scripture that goes on screen is written down with the time, whichever
screen pressed it (the Studio, the Command Center, the phone, a voice command, a key). When the meeting goes off live
the run is closed, and the Studio offers a one-page summary to print, save as PDF, copy or email.

One small JSON file per run in <data>/meetings-log/, this PC only (never synced, never in the diagnostics file).
Prayer requests are counted, never written here (their words stay with the prayer wall, which forgets them).
"""

import json
import os
import re
import threading
import time

MAX_RUNS = 200            # files kept; the oldest go first
MAX_EVENTS = 2000         # per run
SAFE = re.compile(r"^[0-9]{10,16}$")
WRITE_DELAY = 1.5         # seconds: presses in a row become one write


def _s(v, n):
    return str(v or "").replace("\x00", "").strip()[:n]


def _scene(st, sid):
    return next((x for x in st.get("scenes") or [] if isinstance(x, dict) and x.get("id") == sid), None)


def _meeting_name(st):
    m = st.get("meeting") if isinstance(st.get("meeting"), dict) else {}
    b = st.get("brand") if isinstance(st.get("brand"), dict) else {}
    return _s(m.get("title") or b.get("meeting"), 120)


class MeetingLog:
    def __init__(self, folder, clock=time.time):
        self.folder, self.clock = folder, clock
        self.lock = threading.Lock()
        self.run = None              # the run being written (a dict) while a Frame is live
        self.timer = None
        self.last = {}               # what was on screen at the last look: {scene, q, v}

    # ---------- files ----------
    def _path(self, rid):
        return os.path.join(self.folder, rid + ".json")

    def _write(self, run):
        try:
            os.makedirs(self.folder, exist_ok=True)
            tmp = self._path(run["id"]) + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(run, f, ensure_ascii=False)
            os.replace(tmp, self._path(run["id"]))
        except OSError:
            pass

    def _later(self):
        with self.lock:
            self.timer = None
            run = json.loads(json.dumps(self.run)) if self.run else None
        if run:
            self._write(run)

    def _dirty(self):
        if self.timer is None:
            self.timer = threading.Timer(WRITE_DELAY, self._later)
            self.timer.daemon = True
            self.timer.start()

    def flush(self):
        with self.lock:
            if self.timer:
                self.timer.cancel()
                self.timer = None
            run = json.loads(json.dumps(self.run)) if self.run else None
        if run:
            self._write(run)

    def _trim(self):
        try:
            names = sorted(n for n in os.listdir(self.folder) if n.endswith(".json"))
        except OSError:
            return
        for n in names[:-MAX_RUNS]:
            try:
                os.remove(os.path.join(self.folder, n))
            except OSError:
                pass

    # ---------- watching the state (server.save_state calls this after every save) ----------
    def _add(self, kind, label, text="", now=None, sid=""):
        r = self.run
        if r is None or len(r["events"]) >= MAX_EVENTS:
            return
        ev = {"t": int((now or self.clock()) * 1000), "kind": kind, "label": _s(label, 120), "text": _s(text, 2000)}
        if sid:
            ev["id"] = sid                       # 26.11.24 the Frame, for its Teleprompter script in the sermon notes
        r["events"].append(ev)

    def observe(self, st):
        """Look at the state as saved: a Frame went live, changed, or the meeting ended; a question or scripture shown."""
        live = st.get("live") if isinstance(st.get("live"), dict) else {}
        sid = _s(live.get("scene"), 40)
        q = st.get("question") if isinstance(st.get("question"), dict) else {}
        v = st.get("verse") if isinstance(st.get("verse"), dict) else {}
        qk = (q.get("itemId"), q.get("seq")) if q.get("visible") and _s(q.get("text"), 600) else None
        vk = (v.get("itemId"), v.get("ref"), v.get("seq")) if v.get("visible") and _s(v.get("text") or v.get("ref"), 600) else None
        now = self.clock()
        ended = None
        with self.lock:
            last, self.last = self.last, {"scene": sid, "q": qk, "v": vk}
            if sid and self.run is None:                        # going live: a new run
                self.run = {"id": str(int(now * 1000)), "meeting": _meeting_name(st), "started": int(now * 1000),
                            "ended": 0, "events": [], "memory": 0, "prayer": {"received": 0, "shown": 0}}
                last = {}
            if self.run is None:
                return None
            if not sid:                                         # off live: the run is finished
                self.run["ended"] = int(now * 1000)
                ended, self.run = self.run, None
                if self.timer:
                    self.timer.cancel()
                    self.timer = None
            else:
                changed = False
                if sid != last.get("scene"):
                    sc = _scene(st, sid) or {}
                    self._add("frame", sc.get("name") or "Frame", now=now, sid=sid)
                    changed = True
                if qk and qk != last.get("q"):
                    self._add("question", q.get("label") or "Question", q.get("text"), now=now)
                    changed = True
                if vk and vk != last.get("v"):
                    self._add("verse", v.get("ref") or "Scripture", v.get("text"), now=now)
                    changed = True
                if changed:
                    self._dirty()
        if ended:
            self._write(ended)
            self._trim()
            return ended["id"]
        return None

    def count(self, what, n=1):
        """Engagement counted for the run in progress: 'memory' (a Memory Card shown), 'prayer.received', 'prayer.shown',
        26.11.33 'responses.opened' and 'responses.shown' (quick responses and polls)."""
        with self.lock:
            r = self.run
            if r is None:
                return
            if what == "memory":
                r["memory"] += n
            elif what.startswith("prayer."):
                k = what.split(".", 1)[1]
                if k in r["prayer"]:
                    r["prayer"][k] += n
            elif what in ("responses.opened", "responses.shown"):
                k = what.split(".", 1)[1]
                got = r.setdefault("responses", {"opened": 0, "shown": 0})
                got[k] = got.get(k, 0) + n
            self._dirty()

    # ---------- reading ----------
    def runs(self, limit=30):
        try:
            names = sorted((n[:-5] for n in os.listdir(self.folder) if n.endswith(".json") and SAFE.match(n[:-5])), reverse=True)
        except OSError:
            names = []
        out = []
        for rid in names[:limit]:
            r = self.get(rid)
            if r:
                out.append({"id": rid, "meeting": r.get("meeting", ""), "started": r.get("started", 0), "ended": r.get("ended", 0),
                            "frames": sum(1 for e in r.get("events", []) if e.get("kind") == "frame")})
        return out

    def get(self, rid):
        if rid == "latest":
            with self.lock:
                if self.run:
                    return json.loads(json.dumps(self.run))
            rs = self.runs(1)
            return self.get(rs[0]["id"]) if rs else None
        if not SAFE.match(str(rid or "")):
            return None
        with self.lock:
            if self.run and self.run["id"] == rid:
                return json.loads(json.dumps(self.run))
        try:
            with open(self._path(rid), encoding="utf-8") as f:
                r = json.load(f)
            return r if isinstance(r, dict) and isinstance(r.get("events"), list) else None
        except (OSError, ValueError):
            return None


def summary(run, plan=None):
    """The one-page summary of a run: how long, each Frame and how long it was on, the questions asked and the
    scriptures read (in order, each once), and what people sent. plan: {Frame name: minutes planned} (optional)."""
    if not run:
        return None
    ev = sorted(run.get("events") or [], key=lambda e: e.get("t", 0))
    end = run.get("ended") or (ev[-1]["t"] if ev else run.get("started", 0))
    frames, cur = [], None
    for e in ev:
        if e["kind"] == "frame":
            if cur:
                cur["ms"] = e["t"] - cur["at"]
            cur = {"name": e["label"], "id": e.get("id", ""), "at": e["t"], "ms": 0, "questions": [], "verses": []}
            frames.append(cur)
        elif cur is not None:
            key = "questions" if e["kind"] == "question" else "verses" if e["kind"] == "verse" else None
            if key and not any(x["label"] == e["label"] and x["text"] == e["text"] for x in cur[key]):
                cur[key].append({"label": e["label"], "text": e["text"], "at": e["t"]})
    if cur:
        cur["ms"] = max(0, end - cur["at"])
    for f in frames:
        p = (plan or {}).get(f["name"])
        if p:
            f["planMin"] = p
    seen_q, seen_v = set(), set()
    for f in frames:
        for x in f["questions"]:
            seen_q.add(x["text"])
        for x in f["verses"]:
            seen_v.add(x["label"])
    return {"id": run.get("id"), "meeting": run.get("meeting") or "Meeting", "started": run.get("started", 0), "ended": run.get("ended", 0),
            "ms": max(0, end - run.get("started", 0)), "frames": frames, "questionCount": len(seen_q), "verseCount": len(seen_v),
            "memory": run.get("memory", 0), "prayer": run.get("prayer") or {"received": 0, "shown": 0},
            "responses": run.get("responses") or {"opened": 0, "shown": 0}}


def as_text(s):
    """The summary as plain text (Copy, and the body of the email)."""
    if not s:
        return ""

    def hm(ms):
        m = int(ms // 60000)
        return "%d h %02d min" % (m // 60, m % 60) if m >= 60 else "%d min" % m
    lines = [s["meeting"], time.strftime("%A %d %B %Y, %H:%M", time.localtime(s["started"] / 1000)) + " · " + hm(s["ms"]), ""]
    for i, f in enumerate(s["frames"], 1):
        lines.append("%d. %s (%s%s)" % (i, f["name"], hm(f["ms"]), " of %d planned" % f["planMin"] if f.get("planMin") else ""))
        for q in f["questions"]:
            lines.append("   Q: " + q["text"])
        for v in f["verses"]:
            lines.append("   " + v["label"] + (": " + v["text"] if v["text"] and v["text"] != v["label"] else ""))
    lines.append("")
    lines.append("%d questions · %d scriptures · %d Memory Cards shown · %d prayer requests" % (
        s["questionCount"], s["verseCount"], s["memory"], s["prayer"].get("received", 0)))
    return "\n".join(lines)


# ---------- 26.11.24 the sermon notes: a page for members, made from what was presented ----------
def sermon_notes(s, state, with_script=True):
    """The summary of a run -> the sermon notes: for each Frame shown (once, in order), what the leader planned to say
    there (its Teleprompter script, when with_script), the scriptures read in full and the questions to reflect on.
    Nothing to fill in. Frames with nothing to say are left out."""
    if not s:
        return None
    scenes = [x for x in (state or {}).get("scenes") or [] if isinstance(x, dict)]
    by_id = {x.get("id"): x for x in scenes}
    by_name = {}
    for x in scenes:
        by_name.setdefault(x.get("name"), x)
    meeting = (state or {}).get("meeting") if isinstance((state or {}).get("meeting"), dict) else {}
    sections, seen = [], {}
    for f in s["frames"]:
        key = f.get("id") or f["name"]
        if key in seen:                          # a Frame shown twice is one section
            sec = seen[key]
        else:
            sc = by_id.get(f.get("id")) or by_name.get(f["name"]) or {}
            script = str(sc.get("notes") or "").replace("\r\n", "\n").strip() if with_script else ""
            sec = {"frame": f["name"], "script": script[:6000], "verses": [], "questions": []}
            seen[key] = sec
            sections.append(sec)
        for v in f["verses"]:
            if v["label"] not in [x["ref"] for x in sec["verses"]]:
                sec["verses"].append({"ref": v["label"], "text": v["text"] if v["text"] != v["label"] else ""})
        for q in f["questions"]:
            if q["text"] not in sec["questions"]:
                sec["questions"].append(q["text"])
    sections = [x for x in sections if x["script"] or x["verses"] or x["questions"]]
    return {"v": 1, "title": s["meeting"], "date": s["started"], "presenter": _s(meeting.get("presenter"), 80),
            "sections": sections}


def notes_text(n):
    """The sermon notes as plain text (Copy and Email)."""
    if not n:
        return ""
    lines = [n["title"], time.strftime("%A %d %B %Y", time.localtime(n["date"] / 1000))
             + (" \u00b7 " + n["presenter"] if n.get("presenter") else ""), ""]
    for sec in n["sections"]:
        lines += [sec["frame"].upper(), ""]
        if sec["script"]:
            lines += [sec["script"], ""]
        for v in sec["verses"]:
            lines += [v["ref"] + (": " + v["text"] if v["text"] else ""), ""]
        if sec["questions"]:
            lines.append("To reflect on:")
            lines += ["- " + q for q in sec["questions"]]
            lines.append("")
    return "\n".join(lines).strip() + "\n"
