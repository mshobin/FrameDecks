"""FrameDecks - running a service from the companion (src/cloud_remote.py), against a stand-in cloud that follows the
rules of 0004_remote.sql: each command is taken once, oldest first; results and the status are kept per command and
per PC. The program's window is played by a thread on the Bridge. Design: docs/architecture/remote-control-design.md."""
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import cloud_remote as R  # noqa: E402
import cloud_sync as C  # noqa: E402

PLAN = {"scenes": [{"id": "s1", "name": "Welcome", "notes": "Good morning"},
                   {"id": "t1", "name": "Template", "tpl": True},
                   {"id": "s2", "name": "Prayer", "notes": "Let us pray"}],
        "live": {"scene": "s2", "blackout": True, "freeze": False},
        "question": {"visible": True, "text": "Who is your neighbour?"},
        "verse": {"visible": False, "text": "secret until shown", "ref": "John 3:16", "version": "NIV"}}


class Cloud:
    def __init__(self):
        self.waiting, self.results, self.status, self.calls, self.fail = [], {}, None, [], None
        self.next_id = 0

    def send(self, op, args=None, by="Shobin"):
        self.next_id += 1
        self.waiting.append({"id": self.next_id, "op": op, "args": args or {}, "by": by, "at": "now"})
        return self.next_id

    def rpc(self, name, args):
        self.calls.append(name)
        if self.fail:
            raise self.fail
        if name == "remote_take":
            taken, self.waiting = self.waiting, []
            return taken
        if name == "remote_report":
            for r in args["results"]:
                self.results[r["id"]] = r["result"]
            return None
        if name == "remote_publish":
            self.status = args["status"]
            return None
        raise AssertionError(name)


class Api:
    def __init__(self, cloud):
        self.cloud = cloud

    def _rpc(self, name, args):
        return self.cloud.rpc(name, args)


class Window:
    """The program's window: long-polls the bridge and answers like app/js/cloud-remote.js."""

    def __init__(self, bridge, answer=lambda c: "done"):
        self.bridge, self.answer, self.ran, self.stopping = bridge, answer, [], False
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        while not self.stopping:
            cmds = self.bridge.for_window(0.2)
            self.ran.extend(cmds)
            if cmds:
                self.bridge.done([{"id": c["id"], "result": self.answer(c)} for c in cmds])

    def stop(self):
        self.stopping = True
        self.thread.join(1)


def service(cloud, on=True, linked=True, plan=PLAN, bridge=None):
    flags = {"on": on, "linked": linked}
    bridge = bridge or R.Bridge()
    svc = R.RemoteService(lambda: ({"url": "u", "anonKey": "k"}, "org", "key") if flags["linked"] else None,
                          lambda: flags["on"], lambda: plan, bridge, make_api=lambda cfg, org, key: Api(cloud))
    return svc, bridge, flags


class StatusTest(unittest.TestCase):
    def test_with_several_meetings_the_phone_sees_the_meeting_this_pc_shows(self):
        plan = {"meeting": {"title": "Sunday", "meetings": [{"id": "m1", "name": "Tuesday"}, {"id": "m2", "name": "Sunday"}]},
                "scenes": [{"id": "a", "name": "A", "group": "Tuesday"}, {"id": "b", "name": "B", "group": "Sunday"},
                           {"id": "c", "name": "C", "group": ""}], "live": {}}
        self.assertEqual([f["id"] for f in R.status_from(plan)["frames"]], ["b"])
        plan["live"]["meeting"] = "m1"
        self.assertEqual([f["id"] for f in R.status_from(plan)["frames"]], ["a", "c"])
        del plan["meeting"]["meetings"]
        self.assertEqual(len(R.status_from(plan)["frames"]), 3, "one meeting: every Frame, as before")

    def test_what_the_phone_sees(self):
        s = R.status_from(PLAN)
        self.assertEqual(s["frame"], {"id": "s2", "name": "Prayer", "number": 2})
        self.assertEqual(s["count"], 2)                                   # templates are not Frames
        self.assertEqual([f["id"] for f in s["frames"]], ["s1", "s2"])
        self.assertEqual(s["script"], "Let us pray")
        self.assertEqual(s["question"], {"visible": True, "text": "Who is your neighbour?"})
        self.assertEqual(s["scripture"], {"visible": False, "text": "", "ref": "", "version": ""})  # hidden: not sent
        self.assertTrue(s["blackout"])
        self.assertFalse(s["freeze"])

    def test_empty_or_broken_plans(self):
        for plan in (None, {}, {"scenes": "x", "live": 3}, {"scenes": [None, {"id": "a"}], "live": {"scene": "zz"}}):
            s = R.status_from(plan)
            self.assertIsNone(s["frame"])
            self.assertEqual(s["script"], "")

    def test_size_limits(self):
        plan = {"scenes": [{"id": str(i), "name": "N" * 500} for i in range(400)], "live": {"scene": "0"}}
        plan["scenes"][0]["notes"] = "x" * 50000
        s = R.status_from(plan)
        self.assertEqual(len(s["frames"]), 300)
        self.assertEqual(len(s["frames"][0]["name"]), 80)
        self.assertEqual(len(s["script"]), 20000)


    def test_matches_what_the_live_page_reads(self):
        """hosted/src/lib/live-view.ts LiveStatus names the same fields (the companion reads them as sent)."""
        import re
        ts = (ROOT / "hosted" / "src" / "lib" / "live-view.ts").read_text(encoding="utf-8")
        block = re.search(r"export type LiveStatus = \{(.*?)\n\};", ts, re.S).group(1)
        fields = set(re.findall(r"^  (\w+):", block, re.M))
        self.assertEqual(fields, set(R.status_from(PLAN)) - {"at"})


class BridgeTest(unittest.TestCase):
    def test_each_command_goes_to_the_window_once(self):
        b = R.Bridge()
        b.offer([{"id": 1, "op": "next"}])
        self.assertEqual(b.for_window(0), [{"id": 1, "op": "next"}])
        self.assertEqual(b.for_window(0), [])

    def test_a_command_the_window_did_not_pick_up_in_time_is_not_run_late(self):
        b = R.Bridge()
        b.offer([{"id": 1, "op": "next"}])
        b.waiting[0]["offeredAt"] -= R.WINDOW_WAIT + 1
        self.assertEqual(b.for_window(0), [])
        self.assertEqual(b.collect([1], wait=0), [{"id": 1, "result": "not run: the FrameDecks window did not answer"}])

    def test_no_window(self):
        b = R.Bridge()
        b.offer([{"id": 7, "op": "next"}])
        t = time.monotonic()
        self.assertEqual(b.collect([7], wait=0.2)[0]["result"], "not run: the FrameDecks window did not answer")
        self.assertLess(time.monotonic() - t, 1)
        self.assertEqual(b.for_window(0), [])                              # dropped, never run afterwards

    def test_answers_are_kept_short(self):
        b = R.Bridge()
        b.done([{"id": 1, "result": "x" * 500}, "junk", {"no": "id"}])
        self.assertEqual(len(b.collect([1], wait=0)[0]["result"]), 200)


class ServiceTest(unittest.TestCase):
    def setUp(self):
        self.cloud = Cloud()
        self.svc, self.bridge, self.flags = service(self.cloud)
        self.window = Window(self.bridge, lambda c: "not run: that Frame is not on this PC" if c["op"] == "go_live" else "done")
        self.addCleanup(self.window.stop)

    def test_commands_run_in_the_window_and_are_reported(self):
        a = self.cloud.send("next")
        b = self.cloud.send("go_live", {"frame": "gone"}, by="Ann")
        taken = self.svc.once()
        self.assertEqual([c["id"] for c in taken], [a, b])
        self.assertEqual([c["op"] for c in self.window.ran], ["next", "go_live"])
        self.assertEqual(self.cloud.results, {a: "done", b: "not run: that Frame is not on this PC"})
        self.assertEqual([e["label"] for e in self.svc.recent], ["Go Live", "Next Frame"])   # newest first
        self.assertEqual(self.svc.recent[0]["by"], "Ann")
        self.assertEqual(self.cloud.status["frame"]["name"], "Prayer")

    def test_last_ten(self):
        for _ in range(12):
            self.cloud.send("next")
        self.svc.once()
        self.assertEqual(len(self.svc.recent), 10)

    def test_status_is_sent_when_it_changes_or_is_due(self):
        self.svc.once()
        self.assertEqual(self.cloud.calls.count("remote_publish"), 1)
        self.svc.once()
        self.assertEqual(self.cloud.calls.count("remote_publish"), 1)       # unchanged and not due
        self.svc.last_status_at -= R.STATUS_EVERY_IDLE + 1
        self.svc.once()
        self.assertEqual(self.cloud.calls.count("remote_publish"), 2)       # the heartbeat that says "online"
        self.svc.poke()
        self.svc.once()
        self.assertEqual(self.cloud.calls.count("remote_publish"), 3)

    def test_switch_off_or_unlinked_does_nothing(self):
        self.cloud.send("next")
        self.flags["on"] = False
        self.assertEqual(self.svc.once(), [])
        self.assertEqual(self.svc.info(), {"on": False, "linked": True, "active": False, "error": None, "recent": []})
        self.flags["on"], self.flags["linked"] = True, False
        self.assertEqual(self.svc.once(), [])
        self.assertEqual(self.cloud.calls, [])
        self.assertEqual(self.window.ran, [])

    def test_the_loop_follows_the_switch_and_survives_going_offline(self):
        self.flags["on"] = False
        self.svc.start()
        self.addCleanup(self.svc.stop)
        time.sleep(0.3)
        self.assertEqual(self.cloud.calls, [])
        self.cloud.send("next")
        self.flags["on"] = True
        self.svc.poke()
        deadline = time.time() + 5
        while not self.cloud.results and time.time() < deadline:
            time.sleep(0.05)
        self.assertEqual(list(self.cloud.results.values()), ["done"])
        self.cloud.fail = C.Offline("no internet")
        self.svc.poke()
        deadline = time.time() + 3
        while not self.svc.error and time.time() < deadline:
            time.sleep(0.05)
        self.assertEqual(self.svc.info()["error"], "Offline: no internet")
        self.assertTrue(self.svc.thread.is_alive())


class ServerTest(unittest.TestCase):
    """The switch is an app setting, off by default; the window's endpoints answer only this PC."""

    def test_off_by_default_and_wired(self):
        import server
        self.assertIs(server.APP_SETTINGS_DEFAULTS["cloudRemote"], False)
        self.assertIs(server.app_settings()["cloudRemote"], False)
        self.assertFalse(server.CLOUD_REMOTE.info()["active"])
        self.assertIsNone(server._remote_credentials())                   # not linked
        self.assertTrue(server._valid_setting("cloudRemote", True))
        self.assertFalse(server._valid_setting("cloudRemote", "yes"))


if __name__ == "__main__":
    unittest.main()
