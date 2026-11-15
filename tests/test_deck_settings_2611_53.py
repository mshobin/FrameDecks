"""FrameDecks 26.11.53 - a slide deck's Settings as the same cards as every other Content (owner, 15 November).

1. Slides, pictures, video, camera, shapes and sound build their Settings as cards (Slides, Playback, Picture or Video,
   Position and size, Look, Sound), not loose lines across the area.
2. The cards fill each row: the columns are balanced and the last card of a short row takes the rest of it.
3. The cards of a row share its height.
4. In Simple, the main cards of slides, pictures and sound stay (Slides, Playback, Picture, Sound)."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class DeckSettingsAsCards(unittest.TestCase):
    def setUp(self):
        self.ws = read("app/js/workspace.js")
        self.css = read("app/css/edit-preview.css")

    def test_media_and_sound_forms_build_cards(self):
        self.assertIn("function mediaForm(card, sc, l)", self.ws)
        self.assertIn("function audioForm(card, sc, l)", self.ws)
        self.assertIn("function mcard(key, name, main)", self.ws)
        for need in ("'Slides'", "'Playback'", "'Position and size', !main", "card('style', 'Look'", "card('sound', 'Sound', 1)"):
            self.assertIn(need, self.ws)
        body = self.ws[self.ws.index("function mediaForm(card"):self.ws.index("/* \"Recommended layout\"")]
        self.assertNotIn("gen.appendChild(groupHead(", body, "no loose headings")
        for ic in ("slides: 'presentation'", "playback: 'play'", "sound: 'volume-2'"):
            self.assertIn(ic, self.ws)
        icons = read("app/js/icons.js")
        for name in ("presentation", "play", "image", "volume-2", "pencil"):
            self.assertIn('"%s":"<' % name, icons)

    def test_rows_are_filled(self):
        self.assertIn("function fitCards()", self.ws)
        self.assertIn("rows = Math.ceil(n / fit), cols = Math.ceil(n / rows)", self.ws)
        self.assertIn(":not(#ip-gen)", self.ws, "the generated forms' holder is not a card")
        self.assertIn("applyGroups(); foldValuesSoon(); fitCards();", self.ws)
        self.assertIn("repeat(var(--sc-cols,auto-fill),minmax(250px,1fr))", self.css)
        self.assertIn("align-items:stretch", self.css)

    def test_simple_keeps_the_main_cards(self):
        self.assertIn(":not(.sc-essential){display:none}", self.css)
        self.assertIn(".sc-essential > .cs-fold + .cs-sec{display:block}", self.css)
        self.assertIn("window.dispatchEvent(new Event('resize'));", read("app/js/simple-mode.js"))   # 26.11.57 Design opens Advanced; apply() refits

    def test_tokens_only(self):
        self.assertIsNone(re.search(r"#[0-9a-fA-F]{3,8}\b", self.css))


if __name__ == "__main__":
    unittest.main()
