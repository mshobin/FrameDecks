"""FrameDecks - the camera picture shows the media Content of the live Deck only (server.scene_media).

python -m unittest discover -s tests -p "test_*.py"
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import server  # noqa: E402


def frame(decks=None, layers=()):
    sc = {"id": "sc_1", "name": "Study", "layers": list(layers)}
    if decks is not None:
        sc["decks"] = decks
    return sc


CAM = {"id": "C1", "kind": "camera", "c": {"x": .5, "y": .5, "w": 1, "h": 1}}
BG = {"id": "B1", "kind": "background", "deck": "d2", "c": {"props": {"color": "#000000"}}}


class SceneMedia(unittest.TestCase):
    def test_older_frame_shows_all_its_media(self):
        st = {"scenes": [frame(None, [CAM])], "live": {"scene": "sc_1"}}
        self.assertEqual([l["id"] for l in server.scene_media(st)], ["C1"])

    def test_only_the_live_deck(self):
        decks = [{"id": "d1", "name": "Deck 1"}, {"id": "d2", "name": "Deck 2"}]
        st = {"scenes": [frame(decks, [BG, dict(CAM, deck="d1")])], "live": {"scene": "sc_1", "deck": "d1"}}
        self.assertEqual([l["id"] for l in server.scene_media(st)], ["C1"])
        st["live"]["deck"] = "d2"
        self.assertEqual([l["id"] for l in server.scene_media(st)], ["B1"])

    def test_unknown_deck_is_the_first(self):
        decks = [{"id": "d1", "name": "Deck 1"}, {"id": "d2", "name": "Deck 2"}]
        st = {"scenes": [frame(decks, [dict(CAM, deck="gone"), BG])], "live": {"scene": "sc_1", "deck": "nope"}}
        self.assertEqual([l["id"] for l in server.scene_media(st)], ["C1"])


if __name__ == "__main__":
    unittest.main()
