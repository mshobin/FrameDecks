"""8.2 Spotlight on the camera picture (src/vcam/spotlight.py): plays once per id, from when it is first seen."""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from vcam.spotlight import Spotlight  # noqa: E402

SPOT = {"id": "s1", "x": 0.5, "y": 0.5, "w": 0.1, "h": 0.05, "c": "#ff0000", "size": 1, "dur": 2, "k": 80}


class SpotlightOnThePicture(unittest.TestCase):
    def frame(self):
        return np.zeros((270, 480, 3), np.uint8)

    def test_grows_in_stays_and_is_gone_after_its_length(self):
        sp = Spotlight()
        sp.draw(self.frame(), None, 0.0)                            # nothing there when the program starts
        sp.draw(self.frame(), SPOT, 10.0)                           # first seen at 10 s
        mid = sp.draw(self.frame(), SPOT, 11.0)
        self.assertGreater(int(mid[..., 2].max()), 200)             # red light while it stays
        self.assertEqual(int(mid[..., 0].max()), 0)                 # and nothing but red
        gone = sp.draw(self.frame(), SPOT, 10.0 + 2 + 1.0)
        self.assertEqual(int(gone.max()), 0)

    def test_one_already_there_at_start_is_not_replayed(self):
        sp = Spotlight()
        self.assertEqual(int(sp.draw(self.frame(), SPOT, 5.0).max()), 0)
        self.assertEqual(int(sp.draw(self.frame(), SPOT, 6.0).max()), 0)

    def test_a_new_id_plays_again(self):
        sp = Spotlight()
        sp.draw(self.frame(), None, 0.0)
        sp.draw(self.frame(), SPOT, 1.0)
        sp.draw(self.frame(), SPOT, 9.0)                            # over
        again = dict(SPOT, id="s2")
        sp.draw(self.frame(), again, 9.1)
        self.assertGreater(int(sp.draw(self.frame(), again, 10.0).max()), 0)

    def test_the_gold_ring_still_plays(self):
        sp = Spotlight()
        sp.draw(self.frame(), None, 0.0)
        ring = dict(SPOT, id="r1", style="ring")
        sp.draw(self.frame(), ring, 1.0)
        self.assertGreater(int(sp.draw(self.frame(), ring, 2.0)[..., 2].max()), 200)
        self.assertEqual(int(sp.draw(self.frame(), ring, 1.0 + 2 + 1.0).max()), 0)

    def test_the_soft_disc_is_see_through_with_a_brighter_rim(self):
        """8.6 the default style: the middle lets the picture through, the rim is brighter, and it closes within 0.6 s"""
        sp = Spotlight()
        sp.draw(self.frame(), None, 0.0)
        sp.draw(self.frame(), SPOT, 1.0)
        f = sp.draw(self.frame(), SPOT, 2.0)
        mid = int(f[135, 240, 2])
        self.assertTrue(30 < mid < 160, mid)                        # see-through in the middle
        self.assertGreater(int(f[..., 2].max()), mid + 40)          # a brighter rim
        self.assertEqual(int(f[..., 0].max()), 0)
        self.assertEqual(int(sp.draw(self.frame(), SPOT, 1.0 + 2 + 0.6).max()), 0)

    def test_near_the_edge_never_fails(self):
        sp = Spotlight()
        sp.draw(self.frame(), None, 0.0)
        for x, y in ((0, 0), (1, 1), (0.99, 0.01)):
            for style in ("disc", "ring"):
                s = dict(SPOT, id="e%s%s%s" % (x, y, style), x=x, y=y, size=3, style=style)
                sp.draw(self.frame(), s, 1.0)
                self.assertEqual(sp.draw(self.frame(), s, 2.0).shape, (270, 480, 3))


if __name__ == "__main__":
    unittest.main()
