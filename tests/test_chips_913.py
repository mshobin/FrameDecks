"""FrameDecks 9.13: the five chips (Prepare, Engage, Control, Notes, More) are defined once (app/js/chips.js) and shown
the same way in the Command Center, the app's top bar (in place of "Live tools") and the phone remote's tabs. Each
action lives in exactly one chip. Notes on the phone: adding is on, reading is off unless the PC turns it on."""
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def chips():
    """chips.js evaluated by node (the real definition, not a copy)."""
    node = shutil.which("node")
    if not node:
        raise unittest.SkipTest("node is not installed")
    out = subprocess.run([node, "-e", "global.window = {}; require(process.argv[1]); console.log(JSON.stringify(window.KCChips))",
                          str(ROOT / "app/js/chips.js")], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


class OneDefinition(unittest.TestCase):
    def test_five_chips_and_each_action_in_one_chip(self):
        c = chips()
        self.assertEqual([x["id"] for x in c["list"]], ["prepare", "engage", "control", "notes", "more"])
        self.assertEqual([x["hue"] for x in c["list"]], ["gold", "violet", "blue", "teal", "slate"])
        ids = [a["id"] for a in c["all"]]
        self.assertEqual(len(ids), len(set(ids)), "an action is in two chips")
        chip_ids = {x["id"] for x in c["list"]}
        for a in c["all"]:
            self.assertIn(a["chip"], chip_ids)
            self.assertTrue(set(a["on"]) <= {"cc", "app", "phone"} and a["on"], a["id"])
        labels = [a["label"] for a in c["all"]]
        self.assertEqual(len(labels), len(set(labels)), "two actions have the same name")
        # what used to be "Live tools" now has one home each
        where = {a["id"]: a["chip"] for a in c["all"]}
        self.assertEqual((where["draw"], where["spot"], where["capture"]), ("engage", "engage", "engage"))
        self.assertEqual((where["black"], where["freeze"], where["emergency"], where["hidelayer"]), ("control",) * 4)
        self.assertEqual(where["prompter"], "prepare")
        # 26.11.7 the Teleprompter's own tile also sits in the Command Center's Engage (alsoIn), nowhere else
        also = {a["id"]: a["alsoIn"] for a in c["all"] if a.get("alsoIn")}
        self.assertEqual(also, {"prompter": {"engage": ["cc"]}})

    def test_every_icon_exists(self):
        icons = read("app/js/icons.js")
        for x in chips()["list"] + chips()["all"]:
            self.assertIn('"%s":' % x["icon"], icons, x["icon"])

    def test_all_three_surfaces_draw_from_it(self):
        self.assertIn("var GROUPS = CH.list.map(", read("app/js/command-center.js"))
        self.assertIn("CH.list.forEach(function(c){", read("app/js/chip-bar.js"))
        self.assertIn("var CHIPS = window.KCChips ? window.KCChips.list", read("app/js/remote.js"))
        for page, scripts in (("app/spotlight.html", ("chips.js", "notes-pad.js")), ("app/dashboard.html", ("chips.js", "notes-pad.js", "chip-bar.js")),
                              ("app/remote.html", ("icons.js", "chips.js", "notes-pad.js"))):
            html = read(page)
            for s in scripts:
                self.assertIn('<script src="js/%s"></script>' % s, html, page)
        # the Command Center makes only actions offered there; the top bar likewise
        c = chips()
        cc = set(re.findall(r"^  (\w+): function\(\)\{ return T\('", read("app/js/command-center.js"), re.M))
        offered = {a["id"] for a in c["all"] if "cc" in a["on"] and not a.get("pinned")} - {"content", "meetingapp", "black", "freeze", "listen", "notes"}   # the Control remote and the Notes pad
        self.assertEqual(cc, offered)


class TopBar(unittest.TestCase):
    def test_live_tools_is_gone_and_its_buttons_live_in_their_chip(self):
        html = read("app/dashboard.html")
        self.assertNotIn("Live tools ▾", html)
        self.assertNotIn('id="lb-prog"', html)
        for bid in ("lb-prompter", "lb-capture", "lb-blackout", "lb-freeze", "lb-emergency", "lb-hide-layer", "lb-annotate"):
            self.assertIn('id="%s"' % bid, html)                          # kept for their code
        js = read("app/js/chip-bar.js")
        self.assertIn("var EXISTING = {prompter: 'lb-prompter', capture: 'lb-capture', black: 'lb-blackout', freeze: 'lb-freeze',", js)
        self.assertIn("if (e.key === 'Escape' && open){", js)

    def test_draw_and_spotlight_open_the_share_window(self):
        js = read("app/js/chip-bar.js")
        self.assertIn("draw: function(){ share('draw'); },", js)
        self.assertIn("spot: function(){ share('spot'); },", js)
        self.assertIn("post('api/app/annotate', {op: 'mode', mode: shareMode === mode ? '' : mode})", js)


class PhoneRemote(unittest.TestCase):
    def test_the_tabs_are_the_chips_and_old_tabs_come_back_as_their_chip(self):
        js = read("app/js/remote.js")
        self.assertIn("var OLD_TABS = {show: 'control', plan: 'prepare', tools: 'engage', memory: 'engage', meeting: 'more'};", js)
        html = read("app/remote.html")
        for t in ("prepare", "engage", "control", "notes", "more"):
            self.assertIn('id="p-%s" role="tabpanel"' % t, html)
        self.assertIn('<nav class="tabs" id="tabs" role="tablist" aria-label="Remote"></nav>', html)

    def test_notes_add_on_read_off_and_never_kept_on_the_phone(self):
        import server
        self.assertTrue(server.APP_SETTINGS_DEFAULTS["remoteNotesAdd"])
        self.assertFalse(server.APP_SETTINGS_DEFAULTS["remoteNotesRead"])
        for path in ("/js/chips.js", "/js/icons.js", "/js/notes-pad.js", "/css/notes-pad.css"):
            self.assertIn(path, server.REMOTE_PUBLIC)
        self.assertIn("/api/remote/notes", server.REMOTE_SIGNED_IN)
        pad = read("app/js/notes-pad.js")
        for need in ("var READ_FOR = 60000;", "document.addEventListener('visibilitychange', function(){ if (document.hidden) hide(); });",
                     "(phone && !show ? '&peek=1' : '')"):
            self.assertIn(need, pad)
        self.assertNotIn("localStorage", pad)                          # nothing of the notes is kept on the device

    def test_the_server_respects_both_switches(self):
        import server
        old_notes, old_file = server.NOTES, server.APP_SETTINGS_FILE
        tmp = Path(tempfile.mkdtemp())
        try:
            server.NOTES = server.meeting_notes.Notes(str(tmp / "notes"))
            server.APP_SETTINGS_FILE = tmp / "settings.json"
            body = server.remote_notes_action({"action": "add", "meeting": "m1", "text": "From the phone"})
            self.assertEqual((body["count"], body["canRead"]), (1, False))
            self.assertNotIn("notes", server.remote_notes_body("m1", True))            # reading off: no notes
            with self.assertRaises(ValueError):
                server.remote_notes_action({"action": "delete", "meeting": "m1", "id": "x"})   # the phone never deletes
            server.save_app_settings({"remoteNotesRead": True})
            self.assertNotIn("notes", server.remote_notes_body("m1", False))           # a peek never carries them
            self.assertEqual(server.remote_notes_body("m1", True)["notes"][0]["text"], "From the phone")
            server.save_app_settings({"remoteNotesAdd": False})
            with self.assertRaises(ValueError):
                server.remote_notes_action({"action": "add", "meeting": "m1", "text": "x"})
        finally:
            server.NOTES, server.APP_SETTINGS_FILE = old_notes, old_file


if __name__ == "__main__":
    unittest.main()
