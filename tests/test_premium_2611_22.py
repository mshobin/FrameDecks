"""FrameDecks 26.11.22 - feels, looks and acts like a premium app.

Feel: presses show at once (the change is drawn before the PC answers, and put back if it says no), one motion
language, a press you can feel and optional soft sounds, nothing blank while loading, calm while live.
Look: elevation, colours with meaning (Hide all is not red while nothing is live), tabular numbers, FrameDecks icons,
light mode. Act: Undo for 5 seconds, Smart Next, the live Frame comes back after a crash, Settings search finds a
setting inside its page, and "Reset this section"."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class Settings(unittest.TestCase):
    def test_off_by_default(self):
        import server
        self.assertFalse(server.APP_SETTINGS_DEFAULTS["smartNext"])
        self.assertFalse(server.APP_SETTINGS_DEFAULTS["uiSounds"])
        self.assertTrue(server._valid_setting("smartNext", True))
        self.assertFalse(server._valid_setting("uiSounds", "loud"))

    def test_reset_never_touches_progress(self):
        import server
        self.assertIn("guide", server.SETTINGS_NEVER_RESET)
        src = read("src/server.py")
        self.assertIn('if action == "settings-reset":', src)
        self.assertIn("k in APP_SETTINGS_DEFAULTS and k not in SETTINGS_NEVER_RESET", src)
        feel = read("app/js/studio-feel.js")
        for k in ("smartNext", "uiSounds", "voiceKey", "peopleSee", "memDur"):
            self.assertIn("'%s'" % k, feel)
        import re
        keys = re.findall(r"'([A-Za-z]+)'", feel[feel.index("var SECTION_KEYS"):feel.index("var NAMES")])
        for k in keys:
            if k not in ("general", "scripture", "ipad", "output", "cards"):
                self.assertIn(k, server.APP_SETTINGS_DEFAULTS, k)


class Recovered(unittest.TestCase):
    def test_a_crash_brings_the_live_frame_back(self):
        import server
        old_flag, old_state = server.RUNNING_FLAG, dict(server.state)
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            server.RUNNING_FLAG = Path(d) / "kc-running.flag"
            try:
                server.state["scenes"] = [{"id": "sc_a", "name": "Opening"}]
                server.state["live"] = {"scene": "sc_a"}
                server.RECOVERED = None
                server.mark_running()                       # a normal start: nothing to say
                self.assertIsNone(server.RECOVERED)
                server.mark_running()                       # the flag was left behind: it crashed
                self.assertEqual(server.RECOVERED["frame"], "Opening")
                server.clear_running()
                self.assertFalse(server.RUNNING_FLAG.exists())
            finally:
                server.RUNNING_FLAG, server.RECOVERED = old_flag, None
                server.state.clear()
                server.state.update(old_state)
        self.assertIn('"recovered": RECOVERED', read("src/server.py"))
        self.assertIn("Recovered: “", read("app/js/studio-feel.js"))


class Acts(unittest.TestCase):
    def test_instant_and_undo(self):
        store = read("app/js/store.js")
        self.assertIn("Store.optimistic !== false && tries === 0", store)
        self.assertIn("undoable: function(fn){", store)
        self.assertIn("snapshot: function(){", store)
        self.assertIn("smartNext: function(st){", store)
        self.assertIn("st.live.smart =", store)
        cc = read("app/js/spotlight-remote.js")
        self.assertIn("spr-undo", cc)
        self.assertIn("Store.undoable", cc)
        self.assertIn("toastAction('Everything hidden', 'Undo'", read("app/js/dashboard.js"))
        self.assertIn("offerUndo(", read("app/js/workspace.js"))

    def test_smart_next_everywhere(self):
        for f in ("app/js/workspace.js", "app/js/spotlight-remote.js", "app/js/voice-commands.js", "app/js/remote.js"):
            self.assertIn("smart", read(f), f)
        self.assertIn("smartNext=bool(app_settings().get(\"smartNext\"))", read("src/server.py"))


class Looks(unittest.TestCase):
    def test_pages_load_the_new_parts(self):
        dash = read("app/dashboard.html")
        for s in ("js/ui-sound.js", "js/studio-feel.js"):
            self.assertIn('<script src="%s"></script>' % s, dash)
        self.assertLess(dash.index("js/store.js"), dash.index("js/ui-sound.js"))
        self.assertLess(dash.index("js/settings.js"), dash.index("js/studio-feel.js"))
        self.assertIn('<script src="js/ui-sound.js"></script>', read("app/spotlight.html"))
        self.assertIn('data-icon="fd-golive"', dash)

    def test_sounds_only_when_on(self):
        js = read("app/js/ui-sound.js")
        self.assertIn("if (!on() || !SOUNDS[kind]) return;", js)

    def test_motion_elevation_numbers(self):
        css = read("app/css/theme.css")
        for t in ("--m-quick", "--m-gentle", "--elev-1", "--elev-2", "--elev-3", "tabular-nums", "kc-skel", "kc-found"):
            self.assertIn(t, css)
        self.assertIn("body.kc-live .ws-right.inspector", css)
        self.assertIn("--m-quick", read("app/css/spotlight.css"))
        self.assertIn("tabular-nums", read("app/css/remote.css"))

    def test_own_icons(self):
        icons = read("app/js/icons.js")
        for n in ("fd-frame", "fd-deck", "fd-golive"):
            self.assertIn("P['%s']" % n, icons)


if __name__ == "__main__":
    unittest.main()
