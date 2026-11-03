"""FrameDecks 9.0 - Memory Cards: reading copied text (who wrote it, which app), the cards' rules (duplicates, pinned
cards kept after a restart, unpinned ones leaving after their seconds), the API, and the chat overlay on the FrameDecks vCam
picture in its three layouts (beside the video, below it, over it). Also the capture window's callback fix."""
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
import memory as audience  # noqa: E402  (the parsing rules kept their 8.8 names)
import capture  # noqa: E402
import memory  # noqa: E402
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
        self.assertEqual(audience.detect_source("chrome.exe", "https://chatgpt.com/c/123"), "chatgpt")
        self.assertEqual(audience.detect_source("msedge.exe", "https://claude.ai/chat/x"), "claude")
        self.assertEqual(audience.detect_source("msedge.exe", "https://copilot.microsoft.com/"), "copilot")
        self.assertEqual(audience.detect_source("slack.exe"), "slack")
        self.assertEqual(audience.detect_source("chrome.exe", "https://meet.google.com/abc"), "meet")

    def test_source_url_from_html_format(self):
        html = "Version:0.9\r\nStartHTML:000\r\nSourceURL:https://www.youtube.com/live_chat\r\n<html>"
        self.assertEqual(capture.source_url(html), "https://www.youtube.com/live_chat")
        self.assertEqual(capture.source_url(""), "")

    def test_the_watcher_does_nothing_off_windows(self):
        if capture.IS_WIN:
            self.skipTest("Windows")
        self.assertFalse(capture.ClipboardWatcher(lambda *a: None).start())


class Cards(unittest.TestCase):
    def setUp(self):
        self.now = 1000.0
        self.dir = tempfile.mkdtemp(prefix="kc-mem-")
        self.path = os.path.join(self.dir, "kc-memory.json")
        self.m = memory.Memory(self.path, clock=lambda: self.now)

    def test_a_copy_becomes_a_card_in_the_overlay(self):
        status, item = self.m.add("From Sarah to Everyone: How much does it cost?", exe="Zoom.exe")
        self.assertEqual(status, "added")
        self.assertEqual((item["title"], item["src"], item["pinned"]), ("Sarah", "zoom", False))
        cards, nxt = self.m.overlay(12)
        self.assertEqual([c["id"] for c in cards], [item["id"]])
        self.assertAlmostEqual(nxt, 12, delta=0.01)
        self.assertEqual(self.m.snapshot()["notice"]["kind"], "captured")

    def test_title_from_the_text_when_nobody_is_named(self):
        _, item = self.m.add("The rollout plan has three phases: pilot in Q1, regional in Q2 and national in Q3.", url="https://chatgpt.com/c/1")
        self.assertTrue(item["title"].startswith("The rollout plan"))
        self.assertEqual(item["src"], "chatgpt")

    def test_unpinned_cards_leave_after_their_seconds_pinned_stay(self):
        _, a = self.m.add("First message here")
        _, b = self.m.add("Second message here")
        self.m.pin(a["id"])
        self.now += 13
        cards, nxt = self.m.overlay(12)
        self.assertEqual([c["id"] for c in cards], [a["id"]], "the unpinned one left, the pinned one stayed")
        self.assertIsNone(nxt)
        self.m.show(b["id"])
        cards, _ = self.m.overlay(12)
        self.assertEqual(len(cards), 2, "Show puts it back")
        self.assertTrue(next(c for c in cards if c["id"] == b["id"])["full"], "with its full text")
        self.m.show(b["id"])
        self.assertFalse(next(c for c in self.m.overlay(12)[0] if c["id"] == b["id"])["full"], "Show again: just the start")

    def test_at_most_six_on_screen_pinned_first(self):
        ids = [self.m.add("Message number %d" % i)[1]["id"] for i in range(9)]
        self.m.pin(ids[0])
        cards, _ = self.m.overlay(12)
        self.assertEqual(len(cards), memory.MAX_VISIBLE)
        self.assertIn(ids[0], [c["id"] for c in cards], "the pinned one is always there")
        self.assertIn(ids[8], [c["id"] for c in cards], "and the newest")

    def test_on_screen_in_the_order_copied(self):
        a = self.m.add("First message here")[1]["id"]
        b = self.m.add("Second message here")[1]["id"]
        self.m.show(a)                                     # shown again later: it keeps its place
        self.assertEqual([c["id"] for c in self.m.overlay(12)[0]], [a, b])

    def test_show_many_puts_the_selected_cards_on_screen_together(self):
        ids = [self.m.add("Note %d for the group" % i, show=False)[1]["id"] for i in range(4)]
        self.assertEqual(self.m.overlay(12)[0], [])
        shown = self.m.show_many([ids[3], ids[1]])
        self.assertEqual([c["id"] for c in shown], [ids[1], ids[3]])
        cards = self.m.overlay(12)[0]
        self.assertEqual([c["id"] for c in cards], [ids[1], ids[3]], "in the order they were copied")
        self.assertTrue(all(c["full"] for c in cards))
        self.assertEqual(self.m.show_many(["nope"]), [])

    def test_a_copied_conversation_becomes_one_card_per_message(self):
        wa = "[10:32, 03/11/2026] Sarah Lee: How much is it?\n[10:33, 03/11/2026] Tom: Is it recorded?\nAnd shared?"
        status, first = self.m.add(wa, source="phone")
        self.assertEqual((status, self.m.added), ("added", 2))
        self.assertEqual(first["title"], "Sarah Lee")
        cards = self.m.overlay(12)[0]
        self.assertEqual([(c["title"], c["text"], c["src"]) for c in cards],
                         [("Sarah Lee", "How much is it?", "whatsapp"), ("Tom", "Is it recorded? And shared?", "whatsapp")])
        teams = "Ana Silva 10:32 AM\nCan we get the slides?\nBen Ode 10:33 AM\nYes please"
        self.m.add(teams)
        self.assertEqual([i["title"] for i in self.m.items[:2]], ["Ben Ode", "Ana Silva"])
        self.assertEqual(self.m.add("Note: plain text.\nAnother line.")[0], "added")
        self.assertEqual(self.m.added, 1, "plain text with a colon stays one card")
        self.assertEqual(self.m.add("Just a message from my phone", source="phone")[1]["src"], "phone")

    def test_pinned_cards_are_there_after_a_restart(self):
        _, a = self.m.add("Keep this one please")
        self.m.add("Not this one")
        self.m.pin(a["id"])
        again = memory.Memory(self.path, clock=lambda: self.now)
        self.assertEqual([i["text"] for i in again.items], ["Keep this one please"])
        self.assertEqual([c["id"] for c in again.overlay(12)[0]], [a["id"]], "and in the chat overlay")
        again.pin(a["id"], False)
        self.assertEqual(memory.Memory(self.path).items, [], "unpinned: gone next time")

    def test_hide_all_until_the_next_card(self):
        _, a = self.m.add("A pinned card")
        self.m.pin(a["id"])
        self.m.hide_all()
        self.assertEqual(self.m.overlay(12)[0], [])
        self.m.add("A new card")
        self.assertEqual(len(self.m.overlay(12)[0]), 2, "a new card brings the overlay back, pinned one included")

    def test_private_messages_and_show_off_wait_for_show(self):
        _, p = self.m.add("From Tom to Me (Direct Message): call me")
        self.assertTrue(p["private"])
        self.assertEqual(self.m.overlay(12)[0], [])
        _, q = self.m.add("A quiet card", show=False)
        self.assertEqual(self.m.overlay(12)[0], [])
        self.m.show(q["id"])
        self.assertEqual(len(self.m.overlay(12)[0]), 1)

    def test_rules_kept_from_8_8(self):
        self.assertEqual(self.m.add("   ")[0], "empty")
        self.assertEqual(self.m.add("x" * (memory.MAX_RAW + 1))[0], "too-long")
        self.m.add("How much does it cost?")
        self.assertEqual(self.m.add("how much does it cost")[0], "duplicate")

    def test_pin_limit_and_edit(self):
        ids = [self.m.add("Pinned card %d" % i)[1]["id"] for i in range(memory.MAX_PINNED + 1)]
        for i in ids[:-1]:
            self.m.pin(i)
        with self.assertRaises(ValueError):
            self.m.pin(ids[-1])
        out = self.m.edit(ids[0], title="T" * 80, text="  New   text ")
        self.assertEqual((len(out["title"]), out["text"]), (memory.MAX_NAME, "New text"))

    def test_wait_wakes_on_a_change(self):
        rev = self.m.snapshot()["rev"]
        threading.Timer(0.05, lambda: self.m.add("A card from the chat")).start()
        t = time.time()
        snap = self.m.wait(rev, 5)
        self.assertLess(time.time() - t, 2)
        self.assertNotEqual(snap["rev"], rev)


class CaptureCallback(unittest.TestCase):
    def test_one_callback_for_the_whole_program(self):
        """9.0 crash fix: a second start must not free the window procedure Windows still calls."""
        import inspect
        src = inspect.getsource(capture)
        self.assertIn("_PROC", src)
        self.assertNotIn("self._proc = WNDPROC", src, "no per-start callback that Python can free")


class Settings(unittest.TestCase):
    def test_validation(self):
        v = server._valid_setting
        self.assertTrue(v("memDur", 12))
        self.assertFalse(v("memDur", True))
        self.assertFalse(v("memDur", 2))
        for good in ("beside", "below", "over"):
            self.assertTrue(v("memLayout", good))
        self.assertFalse(v("memLayout", "top"))
        self.assertTrue(v("memSide", "left"))
        self.assertTrue(v("memAuto", False))
        self.assertEqual(server.APP_SETTINGS_DEFAULTS["memLayout"], "beside")


class Api(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        server.MEMORY.clear(pinned_too=True)
        server.memory_sync()
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def setUp(self):
        server.MEMORY.clear(pinned_too=True)
        server.MEMORY.hide_all()
        server.save_app_settings({"memDur": 12, "memShare": False, "memLayout": "beside", "memSide": "right", "memAuto": True})
        server.memory_sync()

    def call(self, method, path, body=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        headers = {"Host": f"127.0.0.1:{self.port}", "Content-Type": "application/json", "Origin": f"http://127.0.0.1:{self.port}"}
        c.request(method, path, body=json.dumps(body) if body is not None else None, headers=headers)
        r = c.getresponse()
        data = r.read()
        c.close()
        return r.status, json.loads(data) if data[:1] in (b"{", b"[") else data

    def live(self):
        return (server.state.get("live") or {}).get("memory")

    def test_add_show_pin_hide(self):
        st, res = self.call("POST", "/api/memory", {"action": "add", "text": "Sarah: How much does it cost?"})
        self.assertEqual((st, res["status"]), (200, "added"))
        cid = res["item"]["id"]
        self.assertEqual([c["id"] for c in self.live()["cards"]], [cid], "a new card is in the chat overlay")
        self.assertEqual(self.live()["layout"], "beside")
        self.call("POST", "/api/memory", {"action": "show", "id": cid})
        self.assertTrue(self.live()["cards"][0]["full"])
        self.call("POST", "/api/memory", {"action": "pin", "id": cid})
        self.assertTrue(self.live()["cards"][0]["pinned"])
        self.call("POST", "/api/memory", {"action": "hide", "id": cid})
        self.assertIsNone(self.live())

    def test_an_unpinned_card_leaves_by_itself(self):
        server.save_app_settings({"memDur": 3})
        self.call("POST", "/api/memory", {"action": "add", "text": "Will the slides be shared?"})
        self.assertIsNotNone(self.live())
        end = time.time() + 6
        while self.live() and time.time() < end:
            time.sleep(0.1)
        self.assertIsNone(self.live())

    def test_hide_all_from_the_studio_empties_the_overlay(self):
        self.call("POST", "/api/memory", {"action": "add", "text": "Esc clears me"})

        def change(st):
            st["live"].pop("memory", None)
            return st
        server.update_state(change)
        self.assertTrue(server.MEMORY.hidden)
        server.memory_sync()
        self.assertIsNone(self.live(), "stays empty")

    def test_settings(self):
        self.call("POST", "/api/memory", {"action": "add", "text": "Layout check"})
        st, res = self.call("POST", "/api/memory", {"action": "settings", "layout": "below", "side": "left", "dur": 500, "share": True})
        self.assertEqual((st, res["layout"], res["side"], res["dur"], res["share"]), (200, "below", "left", 120, True))
        self.assertEqual((self.live()["layout"], self.live()["share"]), ("below", True), "the overlay follows")
        self.assertEqual(self.call("POST", "/api/memory", {"action": "settings", "layout": "top"})[0], 400)
        self.assertEqual(self.call("POST", "/api/memory", {"action": "nope"})[0], 400)
        self.assertEqual(self.call("POST", "/api/memory", {"action": "show", "id": "missing"})[0], 400)

    def test_a_copy_from_a_chat_app(self):
        server._on_copy("From Ann to Everyone: Is it recorded?", "Zoom.exe", "")
        self.assertEqual(self.live()["cards"][-1]["title"], "Ann")
        server.save_app_settings({"memAuto": False})
        server._on_copy("Copied but not shown", "notepad.exe", "")
        self.assertEqual(len(self.live()["cards"]), 1, "Show as soon as it's copied off: it waits")

    def test_the_phone_may_load_every_file_the_remote_page_uses(self):
        """9.1.1: remote-memory.js was refused to other devices, so Capture Memory did nothing on a real phone."""
        import re
        page = (ROOT / "app" / "remote.html").read_text(encoding="utf-8")
        used = {"/" + u for u in re.findall(r'(?:src|href)="((?:js|css)/[^"]+)"', page)}
        self.assertTrue(used)
        self.assertEqual(sorted(used - server.REMOTE_PUBLIC), [], "the phone remote cannot load these")

    def test_phone_remote_capture_memory(self):
        self.assertIn("/api/remote/memory", server.REMOTE_SIGNED_IN)
        st, res = self.call("POST", "/api/remote/memory", {"action": "add", "text": "Grace: Can we get the slides afterwards?"})
        self.assertEqual((st, res["status"]), (200, "added"))
        cid = res["item"]["id"]
        self.assertEqual(res["items"][0]["src"], "phone")
        self.assertTrue(res["items"][0]["on"], "pasted on the phone: on screen at once")
        self.assertNotIn("layout", res, "the phone gets the cards, not the PC's settings")
        st, res = self.call("POST", "/api/remote/memory", {"action": "hide", "id": cid})
        self.assertFalse(res["items"][0]["on"])
        st, res = self.call("POST", "/api/remote/memory", {"action": "showmany", "ids": [cid]})
        self.assertEqual(res["shown"], 1)
        st, res = self.call("POST", "/api/remote/memory", {"action": "capture", "on": True})
        self.assertEqual(st, 400, "capture and settings stay on the PC")
        st, res = self.call("POST", "/api/remote/memory", {"action": "delete", "id": cid})
        self.assertEqual(res["items"], [])
        st, res = self.call("GET", "/api/remote/memory")
        self.assertEqual((st, res["items"]), (200, []))

    def test_long_poll_wakes(self):
        rev = self.call("GET", "/api/memory")[1]["rev"]
        threading.Timer(0.1, lambda: server.MEMORY.add("Long poll card")).start()
        t = time.time()
        st, res = self.call("GET", "/api/memory?since=%s&wait=5" % rev)
        self.assertLess(time.time() - t, 3)
        self.assertEqual(res["items"][0]["text"], "Long poll card")


class OnTheCamera(unittest.TestCase):
    """The chat overlay on FrameDecks vCam: beside / below the video (the picture shrinks so nothing overlaps) or over it."""
    CARDS = [{"id": "a", "title": "Sarah Lee", "text": "How much does it cost?", "src": "zoom", "pinned": True, "full": False},
             {"id": "b", "title": "ChatGPT", "text": "The plan has three phases: pilot, regional and national.", "src": "chatgpt",
              "pinned": False, "full": True}]

    def setUp(self):
        from vcam.program import ProgramFX
        self.st = {"live": {"scene": "", "seq": 0}}
        self.fx = ProgramFX(ROOT / "app" / "fonts", lambda: self.st)
        self.bg = np.zeros((360, 640, 3), np.uint8)
        self.bg[:] = (40, 200, 40)                            # a green picture (BGR): easy to find where it went

    def run_frames(self, n=60):
        out = None
        for _ in range(n):
            out = self.fx(self.bg.copy())
            time.sleep(0.015)
        return out

    @staticmethod
    def green(out):
        return (out[:, :, 1] > 150) & (out[:, :, 2] < 110) & (out[:, :, 0] < 110)

    def show(self, layout="beside", side="right", share=False, cards=None):
        self.st["live"]["memory"] = {"cards": cards or self.CARDS, "layout": layout, "side": side, "share": share}

    def test_beside_the_video_keeps_its_size_and_the_bubbles_go_on_top_at_the_right(self):
        self.fx.need_clean = True
        self.show("beside")
        out = self.run_frames()
        self.assertTrue(self.green(out[:, :int(640 * 0.70)]).all(), "the video is whole on the left: nothing shrunk")
        self.assertTrue(self.green(out[:12, :]).all() and self.green(out[-12:, :]).all(), "the video fills the picture")
        right = ~self.green(out[:, int(640 * 0.72):])
        self.assertGreater(int(right.sum()), 2000, "the bubbles are on top of the video, on the right")
        self.assertEqual(self.fx.overlay_area(640, 360), [0, 54, 448, 252], "the overlays go into the left 70 %")
        self.assertIsNotNone(self.fx.present_frame)
        self.assertTrue(self.green(self.fx.present_frame)[:, 600:].all(), "the Share Window keeps the picture without them")

    def test_below(self):
        self.show("below")
        out = self.run_frames()
        self.assertTrue(self.green(out[:int(360 * 0.70)]).all(), "the video is whole above the bubbles")
        self.assertFalse(self.green(out[int(360 * 0.75):]).all(), "the bubbles run along the bottom, over the video")
        self.assertEqual(self.fx.overlay_area(640, 360), [90, 0, 461, 259])

    def test_left_side(self):
        self.show("beside", side="left")
        out = self.run_frames()
        self.assertTrue(self.green(out[:, int(640 * 0.30):]).all(), "bubbles on the left, the video whole")
        self.assertFalse(self.green(out[:, :int(640 * 0.28)]).all())

    def test_the_overlays_are_laid_out_beside_the_bubbles(self):
        from vcam import chatcard
        self.assertIsNone(chatcard.overlay_rect("over", "right", 1280, 720), "over: nothing moves")
        self.show("over")
        self.run_frames(5)
        self.assertIsNone(self.fx.overlay_area(640, 360))
        self.st["live"]["blackout"] = True
        self.show("beside")
        self.assertIsNone(self.fx.overlay_area(640, 360), "black screen: nothing to move")

    def test_the_bubbles_beside_keep_clear_of_the_camera_inset(self):
        self.fx.avoid = [640 - 160 - 16, 360 - 90 - 16, 160, 90]
        self.show("beside")
        out = self.run_frames()
        ax, ay, aw, ah = self.fx.avoid
        self.assertTrue(self.green(out[ay:ay + ah, ax:ax + aw]).all(), "nothing over the inset")

    def test_over_keeps_the_whole_picture_and_clears_the_camera_inset(self):
        self.fx.avoid = [640 - 192 - 16, 360 - 144 - 16, 192, 144]
        self.show("over")
        out = self.run_frames()
        ax, ay, aw, ah = self.fx.avoid
        self.assertTrue(self.green(out[ay:ay + ah, ax:ax + aw]).all(), "nothing drawn over the inset (not even a shadow)")
        self.assertTrue(self.green(out[:, :200]).all(), "the picture is not shrunk")

    def test_shared_uses_the_camera_frame(self):
        self.fx.need_clean = True
        self.show(share=True)
        self.run_frames()
        self.assertIsNone(self.fx.present_frame)

    def test_hidden_and_blackout(self):
        self.show()
        self.run_frames()
        self.st["live"].pop("memory")
        out = self.run_frames(50)
        self.assertTrue(self.green(out).all(), "gone: the picture is whole again")
        self.show()
        self.st["live"]["blackout"] = True
        self.assertEqual(int(self.run_frames(40).max()), 0)

    def test_bubbles_only_and_they_fit_every_layout(self):
        from vcam import chatcard
        from vcam.cards import Fonts
        fonts = Fonts(ROOT / "app" / "fonts")
        many = [dict(self.CARDS[1], id=str(i), title="Card %d" % i, full=True) for i in range(5)] + [self.CARDS[0]]
        for layout in ("beside", "below", "over"):
            made = chatcard.draw(fonts, many, 1280, 720, layout)
            self.assertTrue(made, layout)
            self.assertIn("a", [b.id for b in made], "the pinned one is kept: " + layout)
            _, rect = chatcard.regions(layout, "right", 1280, 720)
            sizes = [(b.w, b.h) for b in made]
            spots = chatcard.stack(sizes, 1280, 720, layout, "right")
            for (x, y), (w, h) in zip(spots, sizes):
                self.assertGreaterEqual(y, -1, layout)
                self.assertLessEqual(y + h, 720 + 1, layout)
                self.assertLessEqual(x + w, 1280 + 1, layout)
            if layout != "over":
                self.assertLessEqual(max(h for _, h in sizes) if layout == "below" else sum(h for _, h in sizes), rect[3] + 1, layout)
            if layout == "beside":
                self.assertTrue(all(x >= rect[0] - 1 for x, _ in spots), "in the free column")
        one = chatcard.bubble(fonts, {"id": "x", "title": "Al", "text": "Hi"}, 1280, 720, 400)
        self.assertLess(one.w, 300, "a bubble is as narrow as its text: no window around it")
        self.assertEqual(chatcard.initials("Sarah Lee"), "SL")
        self.assertEqual(chatcard.avatar_colour("Sarah"), chatcard.avatar_colour(" sarah "))
        self.assertGreater(max(chatcard.pop(t / 20) for t in range(21)), 1.0, "the pop overshoots a little")
        self.assertEqual(round(chatcard.pop(1.0), 3), 1.0)
        self.assertEqual(chatcard.overlay_rect("beside", "right", 1280, 720), [0, 108, 896, 504])
        self.assertEqual(chatcard.overlay_rect("beside", "left", 1280, 720), [384, 108, 896, 504])

    def test_floating_bubbles_keep_clear_of_the_cards_on_screen(self):
        from vcam import chatcard
        card = [900, 200, 360, 300]                          # a question card on the right
        spots = chatcard.stack([(300, 120), (300, 120)], 1280, 720, "over", "right", [card])
        for x, y in spots:
            self.assertFalse(chatcard._overlaps(x, y, 300, 120, card), "a bubble over the card")
        everywhere = [[0, 0, 1280, 720]]
        self.assertEqual(len(chatcard.stack([(300, 120)], 1280, 720, "over", "right", everywhere)), 1, "still placed")

    def test_the_cards_from_the_overlay_layer_are_avoided(self):
        self.fx.others = lambda: [[640 - 260, 40, 250, 280]]
        self.show("over")
        out = self.run_frames()
        self.assertTrue(self.green(out[40:320, 640 - 260:630]).all(), "nothing drawn over the card")


if __name__ == "__main__":
    unittest.main()
