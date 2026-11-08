"""FrameDecks 26.11.12 - Simple by default. The Studio shows the essentials and keeps every other control one click
away (Advanced). Nothing is removed or renamed: Frame, Deck, Go Live and Next keep their names."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class SimpleMode(unittest.TestCase):
    def setUp(self):
        self.html = (ROOT / "app/dashboard.html").read_text(encoding="utf-8")
        self.css = (ROOT / "app/css/theme.css").read_text(encoding="utf-8")
        self.js = (ROOT / "app/js/simple-mode.js").read_text(encoding="utf-8")
        self.status = (ROOT / "app/js/stage-status.js").read_text(encoding="utf-8")
        self.server = (ROOT / "src/server.py").read_text(encoding="utf-8")

    def test_simple_is_the_default_and_is_kept_for_this_pc(self):
        self.assertIn('<script src="js/simple-mode.js"></script>', self.html)
        self.assertIn("lsGet() === 'advanced' ? 'advanced' : 'simple'", self.js)
        self.assertIn('"studioMode": "simple"', self.server)
        self.assertIn('"studioMode": ("simple", "advanced")', self.server)
        self.assertIn("studioMode: v", self.js)

    def test_the_switch_is_an_accessible_radio_group(self):
        self.assertIn("role', 'radiogroup'", self.js)
        self.assertIn("aria-checked", self.js)
        self.assertIn("'Simple'", self.js)
        self.assertIn("'Advanced'", self.js)

    def test_simple_hides_only_extras_never_the_essentials(self):
        for rule in ("body.simple .cmdbar .lb-tx", "body.simple #program-badge", "body.simple .s2-under",
                     "body.simple:not(.sm-design-open) #insp-body .cs-fold"):
            self.assertIn(rule, self.css)
        for essential in ("#cb-take", "#lb-next", "#lb-prev", "#lb-step"):
            self.assertNotIn("body.simple " + essential, self.css)
        self.assertIn("box-shadow:0 0 0 2px var(--live)", self.css)       # one clear on-screen signal

    def test_design_button_opens_the_editor_settings(self):
        self.assertIn("sm-design-open", self.js)
        self.assertIn("aria-expanded", self.js)

    def test_status_says_it_in_one_sentence(self):
        self.assertIn("function sentence(", self.status)
        self.assertIn("Press Go Live when the meeting starts.", self.status)
        self.assertIn('id="ss-sum"', self.html)


if __name__ == "__main__":
    unittest.main()
