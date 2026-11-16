"""FrameDecks 26.11.32 - Settings in the six groups a leader can name: Start here (Features, Running the meeting),
Meeting look, Content (Scripture, Birthdays, Chat Bubbles), How people see it (with vCam and Projector as its own pages,
Recording on the vCam page, and Listening), People & devices, This PC. Every old page id still opens."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Groups(unittest.TestCase):
    def setUp(self):
        self.html = read("app/dashboard.html")

    def test_the_tabs_in_order(self):
        tabs = re.findall(r'data-in="([a-z]+)" data-sec="([a-z]+)"', self.html)
        self.assertEqual(tabs, [("start", "features"), ("start", "general"), ("look", "meeting"), ("look", "transitions"),
                                ("content", "scripture"), ("content", "overlays"), ("content", "memory"),
                                ("screens", "output"), ("screens", "vcam"), ("screens", "display"), ("screens", "listening"),
                                ("people", "ipad"), ("people", "account"), ("people", "security"),
                                ("pc", "pc"), ("pc", "keys"), ("pc", "data"), ("pc", "diag"), ("pc", "about")])
        self.assertIn('class="st-tab st-sub" data-in="screens" data-sec="vcam"', self.html, "vCam belongs to How people see it")
        self.assertIn('class="st-tab st-sub" data-in="screens" data-sec="display"', self.html)

    def test_pages_moved_where_they_belong(self):
        self.assertNotIn('id="sec-recording"', self.html)
        vcam = self.html[self.html.index('id="sec-vcam"'):]
        vcam = vcam[:vcam.index('<section class="s-sec"')]
        self.assertIn('id="rec-host"', vcam, "Recording is on the vCam page")
        js = read("app/js/settings.js")
        self.assertIn("var ALIAS = {recording: 'vcam'};", js, "old links to Recording still open it")
        self.assertIn("$('sec-pc')", read("app/js/app-bridge.js"))
        self.assertNotIn("$('sec-general')", read("app/js/app-bridge.js"), "window and tray are in This PC")
        self.assertIn("var sec = $('sec-features');", read("app/js/features-panel.js"))
        for f in ("app/js/verse-listen.js", "app/js/voice-commands.js"):
            self.assertIn("$('listening-body')", read(f), f)
        self.assertIn("var host = document.getElementById('memory-body')", read("app/js/memory.js"))
        self.assertIn('data-feature="follow"', self.html[self.html.index('id="sec-listening"'):])

    def test_reset_keys_follow_the_pages(self):
        js = read("app/js/studio-feel.js")
        self.assertIn("general: ['smartNext', 'uiSounds', 'leaderCard', 'studioMode'],", js)
        self.assertIn("pc: ['minimizeTo', 'ccSize', 'ccPlace', 'lowGpu', 'customChrome'],", js)
        self.assertIn("listening: ['scriptureListen', 'scriptureAuto', 'scriptureMeeting', 'voiceCommands', 'voiceKey'],", js)

    def test_the_palette_knows_every_page(self):
        pal = read("app/js/palette.js")
        secs = re.findall(r'<section class="s-sec[^"]*" id="sec-([a-z]+)"', self.html)
        for s in secs:
            self.assertIn("['%s', '" % s, pal, s)


if __name__ == "__main__":
    unittest.main()
