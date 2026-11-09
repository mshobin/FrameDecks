"""FrameDecks 26.11.25 - the leader's corner card: what needs you, while the Studio is behind Zoom or Teams.

During a meeting the Studio is usually minimised or behind the meeting window, so its own messages are not seen. When
something waits for the leader, a medium-sized card appears in the corner of the screen (app/alert-card.html, a window
made by src/desktop_app.py), on top of the meeting, without taking the keyboard, and left out of screen sharing:

  - a scripture that was heard (by the leader's microphone, or said by a member in the meeting): Show or Dismiss;
  - prayer requests waiting: the newest one to read, with Show, Show with the name, Done, or All requests.

It shows only while the Studio is not the window in front (the Studio shows these itself), and goes away by itself
when nothing waits. "Later" on prayer requests hides the card until another request arrives. Settings > General >
Corner card (on by default).
"""

import threading
import time

LOOK = 0.5               # seconds between looks (cheap: it reads two in-memory states)


class LeaderAlerts:
    def __init__(self, verse, prayer, windows, show, settings, clock=time.time):
        """verse(): the Listen for scripture body; prayer(): the prayer wall body; windows(): {"front": ...} from the
        desktop app (empty in a browser); show(on): shows or hides the card window (None: no desktop app);
        settings(): the app settings."""
        self.verse, self.prayer, self.windows, self.show, self.settings, self.clock = verse, prayer, windows, show, settings, clock
        self.lock = threading.Lock()
        self.rev = 0
        self.items, self.sig = [], None
        self.shown = False
        self.later = 0           # prayer requests waiting when the leader chose Later
        self._thread = None

    # ---------- what waits ----------
    def gather(self):
        out = []
        try:
            v = self.verse() or {}
        except Exception:
            v = {}
        p = v.get("pending")
        if p and p.get("status") == "waiting" and (not v.get("auto") or p.get("from") in ("meeting", "voice")):   # 26.11.27 voice: always asked
            out.append({"kind": "verse", "id": p.get("id"), "label": p.get("label") or p.get("ref"), "ref": p.get("ref"),
                        "from": p.get("from") or "leader", "planned": bool(p.get("planned")), "error": p.get("error") or ""})
        try:
            pr = self.prayer() or {}
        except Exception:
            pr = {}
        waiting = [i for i in pr.get("items") or [] if i.get("status") == "new"]
        if pr.get("open") and waiting and len(waiting) > self.later:
            first = waiting[0]
            out.append({"kind": "prayer", "waiting": len(waiting), "id": first["id"], "body": first["body"],
                        "name": first.get("name", ""), "at": first.get("at", 0)})
        elif not waiting:
            self.later = 0
        return out

    def wanted(self, items):
        if not items or not (self.settings() or {}).get("leaderCard", True):
            return False
        try:
            w = self.windows() or {}
        except Exception:
            w = {}
        return w.get("front") != "Studio"          # in front, the Studio shows these itself

    # ---------- one look ----------
    def step(self):
        items = self.gather()
        sig = repr(items)
        with self.lock:
            if sig != self.sig:
                self.sig, self.items = sig, items
                self.rev += 1
        want = self.wanted(items)
        if self.show and want != self.shown:
            self.shown = want
            try:
                self.show(want)
            except Exception as e:                  # never let the card stop the meeting
                print("Corner card:", e)
        return want

    def later_prayer(self):
        """Later: hide the prayer part until another request arrives."""
        items = [i for i in self.items if i["kind"] == "prayer"]
        self.later = items[0]["waiting"] if items else 0
        self.step()
        return self.body()

    def _loop(self):
        while True:
            try:
                self.step()
            except Exception as e:
                print("Corner card:", e)
            time.sleep(LOOK)

    def start(self):
        if not self._thread:
            self._thread = threading.Thread(target=self._loop, name="leader-alerts", daemon=True)
            self._thread.start()

    def body(self):
        with self.lock:
            return {"rev": self.rev, "items": [dict(i) for i in self.items], "shown": self.shown}
