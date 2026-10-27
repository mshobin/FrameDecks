"""FrameDecks - running a service from the companion (design: docs/architecture/remote-control.md).

Only while this PC is linked to a workspace (src/cloud_sync.py) and "Allow control from the companion" is on. The PC asks
the workspace for commands (remote_take, about once a second while a phone is active, every 15 seconds otherwise) and
hands each one to the program's own window, which runs it with exactly the code of the matching key (R1: app/js/
cloud-remote.js). The companion never connects to this PC, and the Wi-Fi phone remote is not involved.

    Bridge          commands waiting for the window, and the window's answers
    status_from     what the phone sees: the live Frame, what is visible, its script (text only)
    RemoteService   the background loop
"""
import threading
import time

import cloud_sync

ACTIVE_EVERY = 1.0          # seconds between asks while a phone has sent something in the last 10 minutes
IDLE_EVERY = 15.0           # otherwise (free plan: was 5 s; a third of the requests on the shared free database)
ACTIVE_FOR = 600
STATUS_EVERY_ACTIVE = 4.0   # the status is also a heartbeat: the phone shows the PC as online while it is fresh
STATUS_EVERY_IDLE = 30.0
WINDOW_WAIT = 3.0           # a command the window has not picked up by then is answered, not run late
MIN_GAP = 0.5               # saves can come many times a second (typing): at most two rounds a second
LABELS = {"next": "Next Frame", "previous": "Previous Frame", "go_live": "Go Live", "hide_all": "Hide all",
          "blackout": "Black screen", "question": "Question", "scripture": "Scripture"}


class Bridge:
    """Between the background loop and the program's window (the window asks with a long poll on this PC only)."""

    def __init__(self):
        self.cond = threading.Condition()
        self.waiting = []            # commands not yet handed to the window
        self.results = {}            # command id -> result text

    def offer(self, commands):
        with self.cond:
            now = time.monotonic()
            self.waiting.extend(dict(c, offeredAt=now) for c in commands)
            self.cond.notify_all()

    def for_window(self, wait=20.0):
        """The window's long poll: the commands to run now (each handed out once)."""
        with self.cond:
            self.cond.wait_for(lambda: self.waiting, timeout=wait)
            fresh = [c for c in self.waiting if time.monotonic() - c["offeredAt"] <= WINDOW_WAIT]
            for c in self.waiting:
                if c not in fresh:
                    self.results[c["id"]] = "not run: the FrameDecks window did not answer"
            self.waiting = []
            return [{k: v for k, v in c.items() if k != "offeredAt"} for c in fresh]

    def done(self, results):
        with self.cond:
            for r in results or []:
                if isinstance(r, dict) and "id" in r:
                    self.results[r["id"]] = str(r.get("result") or "done")[:200]
            self.cond.notify_all()

    def collect(self, ids, wait=None):
        """Answers for these commands; any still missing after `wait` are answered "not run". The window runs them
        half a second apart (as two key presses), so a longer batch gets longer."""
        deadline = time.monotonic() + (WINDOW_WAIT + 0.5 + 0.6 * len(ids) if wait is None else wait)
        with self.cond:
            self.cond.wait_for(lambda: all(i in self.results for i in ids), timeout=max(0.0, deadline - time.monotonic()))
            out = []
            for i in ids:
                out.append({"id": i, "result": self.results.pop(i, "not run: the FrameDecks window did not answer")})
            self.waiting = [c for c in self.waiting if c["id"] not in ids]
            return out


def status_from(plan):
    """What the phone sees, from the saved plan: text only, like sync (no picture, no media)."""
    plan = plan if isinstance(plan, dict) else {}
    live = plan.get("live") if isinstance(plan.get("live"), dict) else {}
    frames = [s for s in plan.get("scenes") or [] if isinstance(s, dict) and not s.get("tpl")]
    current = next((s for s in frames if s.get("id") == live.get("scene")), None)

    def card(kind, extra=()):
        c = plan.get(kind) if isinstance(plan.get(kind), dict) else {}
        visible = bool(c.get("visible"))
        out = {"visible": visible, "text": str(c.get("text") or "")[:2000] if visible else ""}
        for k in extra:
            out[k] = str(c.get(k) or "") if visible else ""
        return out

    return {
        "frame": ({"id": current.get("id"), "name": current.get("name") or "Frame",
                   "number": frames.index(current) + 1} if current else None),
        "count": len(frames),
        "frames": [{"id": s.get("id"), "name": str(s.get("name") or "Frame")[:80]} for s in frames][:300],
        "script": str(current.get("notes") or "")[:20000] if current else "",
        "question": card("question"),
        "scripture": card("verse", ("ref", "version")),
        "blackout": bool(live.get("blackout")),
        "freeze": bool(live.get("freeze")),
        "at": time.time(),
    }


class RemoteService:
    """credentials() -> (cloud config, organization id, computer key) while linked, else None. allowed() -> the
    Settings switch. read_plan() -> the saved plan. log(entry) records each command for Settings and a toast."""

    def __init__(self, credentials, allowed, read_plan, bridge, make_api=None, log=None):
        self.credentials, self.allowed, self.read_plan, self.bridge = credentials, allowed, read_plan, bridge
        self.make_api = make_api or (lambda cfg, org, key: cloud_sync.CloudApi(cfg["url"], cfg["anonKey"], org, key))
        self.log = log or (lambda entry: None)
        self.recent = []                 # the last ten commands, newest first, for Settings
        self.active_until = 0.0
        self.last_status = None
        self.last_status_at = 0.0
        self.last_round = 0.0
        self.error = None
        self.wake = threading.Event()
        self.thread = None
        self.stopping = False

    def info(self):
        on, linked = bool(self.allowed()), self.credentials() is not None
        return {"on": on, "linked": linked, "active": on and linked, "error": self.error if on else None,
                "recent": list(self.recent)}

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self.stopping = False
        self.thread = threading.Thread(target=self._loop, name="FrameDecks remote", daemon=True)
        self.thread.start()

    def stop(self):
        self.stopping = True
        self.wake.set()

    def poke(self):
        """The switch changed or the plan changed: look again now (and send a fresh status)."""
        self.last_status = None
        self.wake.set()

    def changed(self):
        """The plan was saved: the status goes up on the next round, which comes now (it is only sent if it changed)."""
        self.wake.set()

    def once(self):
        """One round: take commands, have the window run them, report, and publish the status when it changed or
        is due. Returns the commands taken (for the tests)."""
        creds = self.credentials()
        if not creds or not self.allowed():
            return []
        api = self.make_api(*creds)
        taken = api._rpc("remote_take", {}) or []
        if taken:
            self.active_until = time.monotonic() + ACTIVE_FOR
            self.bridge.offer(taken)
            results = self.bridge.collect([c["id"] for c in taken])
            by_id = {r["id"]: r["result"] for r in results}
            for c in taken:                           # kept on the PC first: they ran even if the report fails
                entry = {"op": c["op"], "label": LABELS.get(c["op"], c["op"]), "by": c.get("by") or "",
                         "result": by_id.get(c["id"], ""), "at": time.time()}
                self.recent = ([entry] + self.recent)[:10]
                self.log(entry)
            self.last_status = None                   # the screen probably changed: send it now
            api._rpc("remote_report", {"results": results})
        status = status_from(self.read_plan())
        comparable = {k: v for k, v in status.items() if k != "at"}
        every = STATUS_EVERY_ACTIVE if time.monotonic() < self.active_until else STATUS_EVERY_IDLE
        if comparable != self.last_status or time.monotonic() - self.last_status_at >= every:
            api._rpc("remote_publish", {"status": status})
            self.last_status, self.last_status_at = comparable, time.monotonic()
        return taken

    def _loop(self):
        backoff = 0.0
        while not self.stopping:
            if not self.allowed() or not self.credentials():
                self.error = None
                self.wake.wait(timeout=5.0)
                self.wake.clear()
                continue
            gap = MIN_GAP - (time.monotonic() - self.last_round)
            if gap > 0:
                time.sleep(gap)
            self.last_round = time.monotonic()
            try:
                self.once()
                self.error = None
                backoff = 0.0
            except cloud_sync.Offline as e:
                backoff = min(60.0, max(5.0, backoff * 2))
                self.error = f"Offline: {e}"
            except cloud_sync.Refused as e:
                backoff = 30.0
                self.error = "This PC is not allowed to take commands (unlinked?)." if e.code == "42501" else str(e)
            except Exception as e:                 # never let this stop the program
                backoff = 30.0
                self.error = f"Problem: {e}"
            pause = backoff or (ACTIVE_EVERY if time.monotonic() < self.active_until else IDLE_EVERY)
            self.wake.wait(timeout=pause)
            self.wake.clear()
