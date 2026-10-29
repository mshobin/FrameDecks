"""7.1 workspace looks in the camera picture (src/vcam/cards.py): the look's surface replaces the navy of a card, and
with no look (or a broken one) the card is exactly as before. The output pages use the same values
(KCScenes.lookSurface, app/css/overlay.css --surf-a/--surf-b)."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from vcam import cards  # noqa: E402

OCEAN = {"id": "deep-ocean", "name": "Deep Ocean", "a": "#0d3349", "b": "#06202f", "font": "sans", "base": "dark"}
QUESTION = {"text": "What does this passage say about hope?", "label": "Discussion", "showLabel": True}


def inside(card):
    """The colour in the middle of the card's left padding (panel only, no text), as 0-255 RGB."""
    base = card.base
    y = int(card.margin + card.h / 2)
    x = int(card.margin + max(4, card.w * 0.012))
    px = base[y, x]
    a = max(float(px[3]), 1e-6)
    return tuple(int(round(float(px[c]) / a * 255)) for c in range(3))


class Surface(unittest.TestCase):
    def test_a_look_gives_its_colours_and_font(self):
        a, b, font = cards.surface_of(OCEAN)
        self.assertEqual((a, b, font), ((13, 51, 73), (6, 32, 47), "sans"))
        self.assertEqual(cards.surface_of(None), (cards.NAVY_A, cards.NAVY_B, "serif"))
        self.assertEqual(cards.surface_of({"a": "blue", "b": "#000000"}), (cards.NAVY_A, cards.NAVY_B, "serif"))

    def test_the_camera_card_takes_the_look_and_goes_back_after(self):
        drawer = cards.CardDrawer(ROOT / "app" / "fonts")
        layout = {"qScale": 1, "qWidth": 84, "panel": 100}
        navy = inside(drawer.draw("question", QUESTION, dict(layout), 1280, 720))
        ocean = inside(drawer.draw("question", QUESTION, dict(layout, look=OCEAN), 1280, 720))
        again = inside(drawer.draw("question", QUESTION, dict(layout), 1280, 720))
        self.assertNotEqual(navy, ocean)
        self.assertEqual(navy, again, "the look is per draw; the next card without one is navy again")
        for got, top, bottom in ((navy, cards.NAVY_A, cards.NAVY_B), (ocean, (13, 51, 73), (6, 32, 47))):
            for c in range(3):
                self.assertTrue(min(top[c], bottom[c]) - 2 <= got[c] <= max(top[c], bottom[c]) + 2, (got, top, bottom))


if __name__ == "__main__":
    unittest.main()
