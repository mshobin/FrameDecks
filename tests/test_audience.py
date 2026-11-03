"""FrameDecks 8.8 - the Live Audience Capture Dock: reading copied chat messages, the queue's rules, and the card on
screen (live.audience) shown, pinned, timed out and hidden through the program's own API."""
import http.client
import json
import os
import sys
import tempfile
import threading
import time
import unittest

import numpy as np
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import audience  # noqa: E402
import capture  # noqa: E402
import server  # noqa: E402


class Parsing(unittest.TestCase):
    def test_zoom_chat_line(self):
        p = audience.parse("10:32:05 From Sarah Lee to Everyone: How much does it cost?")
        self.assertEqual((p["name"], p["text"], p["private"]), ("Sarah Lee", "How much does it cost?", False))

    def test_zoom_private_message_is_marked(self):
        self.assertTrue(audience.parse("From Tom to Me (Direct Message): can you call me")["private"])
        self.assertTrue(audience.parse("From Tom to You (privately): hello there")["private"])

    def test_name_line_then_message(self):
        p = audience.parse("Sarah 10:32 AM\nHow much does it cost?")
        self.assertEqual((p["name"], p["text"]), ("Sarah", "How much does it cost?"))
        p = audience.parse("Mark — Today at 9:05 PM\nWhere is the recording?")
        self.assertEqual((p["name"], p["text"]), ("Mark", "Where is the recording?"))

    def test_name_colon_message(self):
        p = audience.parse("Grace: Will the slides be shared?")
        self.assertEqual((p["name"], p["text"]), ("Grace", "Will the slides be shared?"))

    def test_plain_text_has_no_name(self):
        p = audience.parse("  How much does it cost?  ")
        self.assertEqual((p["name"], p["text"]), ("", "How much does it cost?"))

    def test_a_sentence_is_not_taken_for_a_name(self):
        p = audience.parse("I have a question about the plan.\nWhen does it start?")
        self.assertEqual(p["name"], "")
        self.assertIn("When does it start?", p["text"])

    def test_times_are_not_names(self):
        self.assertEqual(audience.parse("10: thanks everyone")["name"], "")

    def test_sources(self):
        self.assertEqual(audience.detect_source(r"C:\Users\a\AppData\Roaming\Zoom\bin\Zoom.exe"), "zoom")
        self.assertEqual(audience.detect_source("ms-teams.exe"), "teams")
        self.assertEqual(audience.detect_source("chrome.exe", "https://www.youtube.com/live_chat?v=x"), "youtube")
        self.assertEqual(audience.detect_source("msedge.exe", "https://www.twitch.tv/popout/x/chat"), "twitch")
        self.assertEqual(audience.detect_source("chrome.exe", "https://www.facebook.com/live"), "facebook")
        self.assertEqual(audience.detect_source("Discord.exe"), "discord")
        self.assertEqual(audience.detect_source("notepad.exe"), "clipboard")

    def test_source_url_from_html_format(self):
        html = "Version:0.9\r\nStartHTML:000\r\nSourceURL:https://www.youtube.com/live_chat\r\n<html>"
        self.assertEqual(capture.source_url(html), "https://www.youtube.com/live_chat")
        self.assertEqual(capture.source_url(""), "")

    def test_the_watcher_does_nothing_off_windows(self):
        if capture.IS_WIN:
            self.skipTest("Windows")
        self.assertFalse(capture.ClipboardWatcher(lambda *a: None).start())


class Queue(unittest.TestCase):
    def setUp(self):
        self.now = 1000.0
        self.q = audience.Audience(clock=lambda: self.now)

    def test_a_copy_becomes_a_card_with_a_notice(self):
        status, item = self.q.add("From Sarah to Everyone: How much does it cost?", exe="Zoom.exe")
        self.assertEqual(status, "added")
        self.assertEqual((item["name"], item["src"], item["shown"]), ("Sarah", "zoom", False))
        snap = self.q.snapshot()
        self.assertEqual(snap["notice"]["text"], "Audience Question Captured")
        self.assertEqual(snap["items"][0]["id"], item["id"])

    def test_empty_and_too_long_are_ignored(self):
        self.assertEqual(self.q.add("   ")[0], "empty")
        self.assertEqual(self.q.add("?!")[0], "empty")
        self.assertEqual(self.q.add("x" * (audience.MAX_RAW + 1))[0], "too-long")
        self.assertEqual(self.q.snapshot()["items"], [])

    def test_duplicates(self):
        self.q.add("How much does it cost?")
        self.assertEqual(self.q.add("how much does it cost")[0], "duplicate")
        self.now += 60
        self.assertEqual(self.q.add("How much does it cost?")[0], "duplicate", "still in the queue")
        only = self.q.snapshot()["items"][0]["id"]
        self.q.delete(only)
        self.now += 60
        self.assertEqual(self.q.add("How much does it cost?")[0], "added", "deleted and copied again later")

    def test_a_deleted_card_copied_again_at_once_is_still_a_duplicate(self):
        _, item = self.q.add("Is there a recording?")
        self.q.delete(item["id"])
        self.assertEqual(self.q.add("Is there a recording?")[0], "duplicate")

    def test_newest_first_and_capped(self):
        for i in range(audience.MAX_ITEMS + 5):
            self.q.add("Question number %d" % i)
        items = self.q.snapshot()["items"]
        self.assertEqual(len(items), audience.MAX_ITEMS)
        self.assertEqual(items[0]["text"], "Question number %d" % (audience.MAX_ITEMS + 4))

    def test_edit_keeps_limits(self):
        _, item = self.q.add("Hello there")
        out = self.q.edit(item["id"], name="N" * 80, text="  New   text ")
        self.assertEqual((len(out["name"]), out["text"]), (audience.MAX_NAME, "New text"))
        self.assertEqual(self.q.edit(item["id"], text="   ")["text"], "New text", "an empty message keeps the old one")
        self.assertIsNone(self.q.edit("nope", name="x"))

    def test_wait_wakes_on_a_change(self):
        rev = self.q.snapshot()["rev"]
        threading.Timer(0.05, lambda: self.q.add("A question from the chat")).start()
        t = time.time()
        snap = self.q.wait(rev, 5)
        self.assertLess(time.time() - t, 2)
        self.assertNotEqual(snap["rev"], rev)

    def test_live_card_and_visible(self):
        item = {"id": "a1", "name": "Sarah", "text": "Hi", "src": "zoom"}
        card = audience.live_card(item, seconds=12, now=100)
        self.assertEqual((card["dur"], card["at"], card["share"], card["pos"]), (12, 100000, False, "right"))
        self.assertEqual(audience.live_card(item, pos="left", now=0)["pos"], "left")
        self.assertEqual(audience.live_card(item, pos="middle", now=0)["pos"], "right")
        self.assertTrue(audience.visible(card, now=111))
        self.assertFalse(audience.visible(card, now=112.5))
        pinned = audience.live_card(item, pin=True, now=100)
        self.assertEqual(pinned["dur"], 0)
        self.assertTrue(audience.visible(pinned, now=10 ** 9))
        self.assertEqual(audience.live_card(item, seconds=999, now=0)["dur"], 120)
        self.assertEqual(audience.live_card(dict(item, src="evil"), now=0)["src"], "clipboard")
        self.assertFalse(audience.visible(None))


class AutoShow(unittest.TestCase):
    def test_only_new_chat_messages(self):
        zoom = {"src": "zoom", "private": False}
        self.assertTrue(audience.auto_show("added", zoom))
        self.assertFalse(audience.auto_show("added", zoom, enabled=False))
        self.assertFalse(audience.auto_show("duplicate", zoom))
        self.assertFalse(audience.auto_show("added", {"src": "clipboard", "private": False}), "another program: waits")
        self.assertFalse(audience.auto_show("added", {"src": "zoom", "private": True}), "private: waits")

    def test_a_copy_from_zoom_goes_on_screen(self):
        server.AUDIENCE.clear()
        server.audience_hide()
        server.save_app_settings({"audienceAuto": True})
        server._on_copy("From Ann to Everyone: Is it recorded?", "Zoom.exe", "")
        self.assertEqual((server.state["live"].get("audience") or {}).get("name"), "Ann")
        server.audience_hide()
        server._on_copy("Copied from a document", "WINWORD.EXE", "")
        self.assertFalse(server.state["live"].get("audience"), "not from a chat app: waits for Show")
        server.save_app_settings({"audienceAuto": False})
        server._on_copy("From Bo to Everyone: A question", "Zoom.exe", "")
        self.assertFalse(server.state["live"].get("audience"))
        server.AUDIENCE.clear()


class Settings(unittest.TestCase):
    def test_validation(self):
        v = server._valid_setting
        self.assertTrue(v("audienceDur", 12))
        self.assertFalse(v("audienceDur", True))
        self.assertFalse(v("audienceDur", 2))
        self.assertFalse(v("audienceDur", "12"))
        self.assertTrue(v("audienceShare", True))
        self.assertTrue(v("audiencePos", "left"))
        self.assertFalse(v("audiencePos", "top"))
        self.assertTrue(v("dockRect", []))
        self.assertTrue(v("dockRect", [100, 80, 340, 520]))
        self.assertFalse(v("dockRect", [100, 80, 20, 20]))
        self.assertFalse(v("dockRect", [1, 2, 3]))
        self.assertFalse(v("dockRect", [1.5, 2, 340, 520]))


class Api(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        server.audience_hide()
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def setUp(self):
        server.AUDIENCE.clear()
        server.audience_hide()
        server.save_app_settings({"audienceDur": 12, "audienceShare": False, "audiencePos": "right"})

    def call(self, method, path, body=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        headers = {"Host": f"127.0.0.1:{self.port}", "Content-Type": "application/json",
                   "Origin": f"http://127.0.0.1:{self.port}"}
        c.request(method, path, body=json.dumps(body) if body is not None else None, headers=headers)
        r = c.getresponse()
        data = r.read()
        c.close()
        return r.status, json.loads(data) if data[:1] in (b"{", b"[") else data

    def live(self):
        return (server.state.get("live") or {}).get("audience")

    def test_typed_question_show_pin_hide(self):
        st, res = self.call("POST", "/api/audience", {"action": "add", "text": "Sarah: How much does it cost?"})
        self.assertEqual((st, res["status"]), (200, "added"))
        item = res["item"]
        st, res = self.call("POST", "/api/audience", {"action": "show", "id": item["id"]})
        self.assertEqual(st, 200)
        self.assertEqual((self.live()["name"], self.live()["dur"]), ("Sarah", 12))
        self.assertTrue(res["items"][0]["shown"])
        self.call("POST", "/api/audience", {"action": "pin", "id": item["id"]})
        self.assertEqual(self.live()["dur"], 0)
        self.call("POST", "/api/audience", {"action": "hide"})
        self.assertIsNone(self.live())

    def test_a_timed_card_goes_by_itself(self):
        server.save_app_settings({"audienceDur": 3})
        _, res = self.call("POST", "/api/audience", {"action": "add", "text": "Will the slides be shared?"})
        self.call("POST", "/api/audience", {"action": "show", "id": res["item"]["id"]})
        self.assertIsNotNone(self.live())
        end = time.time() + 6
        while self.live() and time.time() < end:
            time.sleep(0.1)
        self.assertIsNone(self.live())

    def test_a_new_card_replaces_the_one_on_screen(self):
        a = self.call("POST", "/api/audience", {"action": "add", "text": "First question here"})[1]["item"]
        b = self.call("POST", "/api/audience", {"action": "add", "text": "Second question here"})[1]["item"]
        self.call("POST", "/api/audience", {"action": "show", "id": a["id"]})
        self.call("POST", "/api/audience", {"action": "show", "id": b["id"]})
        self.assertEqual(self.live()["id"], b["id"])

    def test_edit_follows_on_screen_and_delete_hides(self):
        a = self.call("POST", "/api/audience", {"action": "add", "text": "Typo questoin"})[1]["item"]
        self.call("POST", "/api/audience", {"action": "pin", "id": a["id"]})
        self.call("POST", "/api/audience", {"action": "edit", "id": a["id"], "name": "Ann", "text": "Typo question"})
        self.assertEqual((self.live()["name"], self.live()["text"]), ("Ann", "Typo question"))
        self.call("POST", "/api/audience", {"action": "delete", "id": a["id"]})
        self.assertIsNone(self.live())
        self.assertEqual(self.call("GET", "/api/audience")[1]["items"], [])

    def test_settings_and_share(self):
        a = self.call("POST", "/api/audience", {"action": "add", "text": "Shared question"})[1]["item"]
        self.call("POST", "/api/audience", {"action": "pin", "id": a["id"]})
        st, res = self.call("POST", "/api/audience", {"action": "settings", "dur": 500, "share": True})
        self.assertEqual((st, res["dur"], res["share"]), (200, 120, True))
        self.assertTrue(self.live()["share"])
        self.assertEqual(self.call("POST", "/api/audience", {"action": "settings", "dur": "x"})[0], 400)
        st, res = self.call("POST", "/api/audience", {"action": "settings", "pos": "left"})
        self.assertEqual((res["pos"], self.live()["pos"]), ("left", "left"), "the window on screen moves")
        self.assertEqual(self.call("POST", "/api/audience", {"action": "settings", "pos": "up"})[0], 400)
        self.call("POST", "/api/audience", {"action": "settings", "pos": "right"})

    def test_unknown_and_missing(self):
        self.assertEqual(self.call("POST", "/api/audience", {"action": "nope"})[0], 400)
        self.assertEqual(self.call("POST", "/api/audience", {"action": "show", "id": "missing"})[0], 400)

    def test_long_poll_wakes_when_the_card_on_screen_changes(self):
        a = self.call("POST", "/api/audience", {"action": "add", "text": "Question for the poll"})[1]["item"]
        rev = self.call("GET", "/api/audience")[1]["rev"]
        threading.Timer(0.1, lambda: server.audience_show(a["id"])).start()
        t = time.time()
        st, res = self.call("GET", "/api/audience?since=%s&wait=5" % rev)
        self.assertLess(time.time() - t, 3)
        self.assertEqual(res["live"]["id"], a["id"])

    def test_hide_all_from_the_state_clears_it(self):
        a = self.call("POST", "/api/audience", {"action": "add", "text": "Esc clears me"})[1]["item"]
        server.audience_show(a["id"], pin=True)

        def change(st):
            st["live"]["audience"] = None
            return st
        server.update_state(change)
        self.assertIsNone(self.call("GET", "/api/audience")[1]["live"])


class OnTheCamera(unittest.TestCase):
    """The card is drawn on the FrameRelay picture, fades out when its time is up, and the Share Window gets the
    picture without it unless "Also show on Share Window" is on."""
    def setUp(self):
        from vcam.program import ProgramFX
        self.np = np
        self.st = {"live": {"scene": "", "seq": 0}}
        self.fx = ProgramFX(ROOT / "app" / "fonts", lambda: self.st)

    def run_frames(self, n=40):
        out = None
        for _ in range(n):
            out = self.fx(self.np.zeros((360, 640, 3), self.np.uint8))
            time.sleep(0.02)
        return out

    def card(self, **kw):
        c = {"id": "a1", "name": "Sarah", "text": "How much does it cost?", "src": "zoom", "at": int(time.time() * 1000), "dur": 12,
             "share": False}
        c.update(kw)
        self.st["live"]["audience"] = c

    def test_drawn_and_left_out_of_the_share_window(self):
        self.fx.need_clean = True
        self.card()
        out = self.run_frames(80)
        self.assertGreater(int(out.max()), 100, "the chat window is on the picture")
        cols = np.nonzero(out.max(axis=(0, 2)) > 60)[0]
        rows = np.nonzero(out.max(axis=(1, 2)) > 60)[0]
        self.assertGreater(cols.min(), 640 * 0.55, "at the right edge")
        self.assertGreaterEqual(rows.min(), 360 * 0.10)
        self.assertLessEqual(rows.max(), 360 * 0.64, "clear of the bottom cards and a camera inset")
        self.assertIsNotNone(self.fx.present_frame)
        self.assertEqual(int(self.fx.present_frame.max()), 0, "the Share Window's picture has no card")

    def test_left_edge(self):
        self.card(pos="left")
        out = self.run_frames(60)
        cols = np.nonzero(out.max(axis=(0, 2)) > 60)[0]
        self.assertLess(cols.max(), 640 * 0.45)

    def test_opens_with_typing_dots_then_the_message(self):
        from vcam import chatcard
        self.assertEqual(chatcard.frame(0.5)["msg"], 0.0, "typing dots first")
        self.assertLess(chatcard.frame(0.1)["unfold"], 0.8, "it unfolds")
        self.assertEqual(chatcard.frame(2.0), {"unfold": 1.0, "alpha": 1.0, "msg": 1.0, "slide": 0.0})
        self.assertEqual(chatcard.initials("Sarah Lee"), "SL")
        self.assertEqual(chatcard.initials(""), "?")
        self.assertEqual(chatcard.avatar_colour("Sarah"), chatcard.avatar_colour(" sarah "))

    def test_keeps_clear_of_the_camera_inset(self):
        """8.9: a large camera inset in the bottom-right corner pushes the window up; side by side, it moves left."""
        from vcam import chatcard

        class C:
            w, h = 410, 200
        W, H = 1280, 720
        plain = chatcard.place(C, W, H, "right")
        big = [W - 512 - 32, H - 288 - 32, 512, 288]
        x, y = chatcard.place(C, W, H, "right", big)
        self.assertEqual(x, plain[0])
        self.assertLessEqual(y + C.h, big[1], "above the inset")
        side = [845, 0, 435, 720]
        x, _ = chatcard.place(C, W, H, "right", side)
        self.assertLess(x + C.w, side[0], "the other edge")
        self.assertEqual(chatcard.place(C, W, H, "right", [20, 20, 200, 112]), plain, "an inset elsewhere changes nothing")
        # through the camera program: the compositor sets avoid, the window keeps clear of it
        self.fx.avoid = [640 - 192 - 16, 360 - 144 - 16, 192, 144]          # a large inset at 640 x 360
        self.card(dur=0)
        out = self.run_frames(80)
        ax, ay, aw, ah = self.fx.avoid
        self.assertEqual(int(out[ay + 4:ay + ah - 4, ax + 4:ax + aw - 4].max()), 0, "nothing drawn over the inset")
        self.assertGreater(int(out.max()), 100)

    def test_shared_card_uses_the_camera_frame(self):
        self.fx.need_clean = True
        self.card(share=True)
        self.run_frames()
        self.assertIsNone(self.fx.present_frame)

    def test_expired_and_hidden_cards_fade_out(self):
        self.card(at=int(time.time() * 1000) - 20000)
        out = self.run_frames(30)
        self.assertEqual(int(out.max()), 0, "past its seconds: nothing on the picture")
        self.card(dur=0)
        self.assertGreater(int(self.run_frames().max()), 100, "pinned: shown")
        self.st["live"]["audience"] = None
        self.assertEqual(int(self.run_frames(30).max()), 0, "hidden")

    def test_blackout_hides_it(self):
        self.card(dur=0)
        self.st["live"]["blackout"] = True
        self.assertEqual(int(self.run_frames(40).max()), 0)


class DockWindow(unittest.TestCase):
    """The dock's behaviour (src/dock.py) with a pretend window: click-through and 85 % by default, 20 % under the
    pointer, usable and opaque while Ctrl+Shift is held or pinned, the handle follows, the place is saved."""
    class Win:
        def __init__(self):
            self.r, self.held, self.pt, self.looks, self.handles = [100, 100, 340, 520], False, (0, 0), [], []

        def rect(self):
            return list(self.r)

        def keys(self):
            return self.held

        def cursor(self):
            return self.pt

        def set_look(self, through, alpha):
            self.looks.append((through, alpha))

        def place_handle(self, r):
            self.handles.append(r)

    def setUp(self):
        import dock
        self.dock, self.now, self.modes, self.saved = dock, 0.0, [], []
        self.w = self.Win()
        self.c = dock.DockController(self.w, on_mode=self.modes.append, on_moved=self.saved.append, clock=lambda: self.now)

    def test_looks(self):
        self.c.tick()
        self.assertEqual(self.w.looks[-1], (True, 0.85))
        self.w.pt = (150, 300)
        self.c.tick()
        self.assertEqual(self.w.looks[-1], (True, 0.2), "pointer over the dock: see-through")
        self.w.held = True
        self.c.tick()
        self.assertEqual(self.w.looks[-1], (False, 1.0), "Ctrl+Shift: usable and opaque")
        self.w.held = False
        self.c.tick()
        self.assertEqual(self.w.looks[-1], (True, 0.2), "released: clicks pass through again")
        self.c.set_pinned(True)
        self.assertEqual(self.w.looks[-1], (False, 1.0))
        self.assertEqual(self.modes, ["click", "live", "click", "pinned"])
        n = len(self.w.looks)
        self.c.tick()
        self.assertEqual(len(self.w.looks), n, "nothing changed: nothing applied")

    def test_handle_follows_and_place_is_saved_once_still(self):
        self.c.tick()
        self.assertEqual(self.w.handles[-1], self.dock.handle_rect([100, 100, 340, 520]))
        self.w.r = [300, 200, 360, 500]
        self.now = 0.1
        self.c.tick()
        self.assertEqual(self.w.handles[-1][1], 200 - self.dock.HANDLE_SIZE[1] + 4)
        self.assertEqual(self.saved, [])
        self.now = 1.5
        self.c.tick()
        self.assertEqual(self.saved, [[300, 200, 360, 500]])
        self.now = 3
        self.c.tick()
        self.assertEqual(len(self.saved), 1)

    def test_polls_slower_when_nothing_is_near(self):
        self.c.tick()
        self.now = 5
        self.c.tick()
        self.w.pt = (5000, 5000)
        self.assertEqual(self.c.tick(), 0.1)
        self.w.pt = (150, 300)
        self.assertLess(self.c.tick(), 0.05)

    def test_scaled_display_stays_on_screen(self):
        """8.8.1: on a 150 % display the dock opened off the right edge (pywebview scales the position it is given)."""
        work = [0, 0, 1920, 1032]                                   # screen pixels of a 150 % laptop screen
        r = self.dock.start_rect(None, work, scale=1.5)
        self.assertEqual(r[2:], [510, 780])
        self.assertLessEqual(r[0] + r[2], 1920)
        self.assertLessEqual(r[1] + r[3], 1032)
        lx, ly, lw, lh = self.dock.to_logical(r, 1.5)
        self.assertEqual([round(lx * 1.5), round(lw * 1.5)], [r[0], r[2]], "pywebview's scaling lands it back on the same spot")
        hr = self.dock.handle_rect(r, 1.5)
        self.assertEqual(hr[2:], [276, 45])
        self.assertLessEqual(hr[0] + hr[2], 1920)
        small = self.dock.start_rect(None, [0, 0, 1280, 680], scale=1.5)
        self.assertLessEqual(small[1] + small[3], 680, "a small screen: the dock is made shorter")

    def test_start_place(self):
        self.assertEqual(self.dock.start_rect([10, 20, 300, 400], [0, 0, 1920, 1040]), [10, 20, 300, 400])
        r = self.dock.start_rect([10, 20, 300, 400], [0, 0, 1920, 1040], fits=lambda r: False)
        self.assertEqual(r[:1], [1920 - 340 - 24], "a place on a screen that is gone: the right of the main screen")
        self.assertEqual(self.dock.start_rect([], None)[2:], list(self.dock.DEFAULT_SIZE))


if __name__ == "__main__":
    unittest.main()
