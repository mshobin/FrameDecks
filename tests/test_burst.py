"""8.2 Burst transition (src/vcam/burst.py): the old picture leaves as dust along the sweep and uncovers the new one."""
import os
import sys
import time
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from vcam.burst import Burst  # noqa: E402
from vcam import program  # noqa: E402


class BurstTransition(unittest.TestCase):
    def setUp(self):
        self.a = np.full((270, 480, 3), 200, np.uint8)
        self.b = np.zeros((270, 480, 3), np.uint8)

    def test_starts_as_the_old_picture_and_ends_as_the_new_one(self):
        bu = Burst(self.a, {"density": "medium", "dir": "right"}, seed=1)
        self.assertTrue((bu.render(0.0, self.b) == self.a).all())
        self.assertTrue((bu.render(0.999, self.b) == self.b).all())

    def test_the_sweep_follows_the_direction(self):
        for d, first, last in (("right", (slice(None), slice(0, 60)), (slice(None), slice(-60, None))),
                               ("left", (slice(None), slice(-60, None)), (slice(None), slice(0, 60))),
                               ("up", (slice(-40, None), slice(None)), (slice(0, 40), slice(None)))):
            out = Burst(self.a, {"dir": d, "intensity": 10}, seed=2).render(0.35, self.b)
            self.assertLess(out[first].mean(), out[last].mean(), d)     # the side it starts from is gone first

    def test_every_setting_is_accepted_and_bad_ones_fall_back(self):
        for o in ({"density": "high", "dir": "out", "tint": "#ff0000", "intensity": 100}, {"density": "?", "dir": 5, "tint": "x"}, None):
            out = Burst(self.a, o, seed=3).render(0.5, self.b)
            self.assertEqual(out.shape, self.a.shape)

    def test_fast_enough_for_the_camera(self):
        a = np.full((1080, 1920, 3), 120, np.uint8)
        b = np.zeros_like(a)
        bu = Burst(a, {"density": "medium"}, seed=4)
        bu.render(0.3, b)
        t = time.perf_counter()
        for e in (0.2, 0.4, 0.6):
            bu.render(e, b)
        self.assertLess((time.perf_counter() - t) / 3, 0.08)              # generous for slow CI runners

    def test_retired_transitions_play_as_their_replacement(self):
        self.assertEqual(program.TX_ALIAS, {"dissolve": "fade", "cinema": "fade", "church": "fade",
                                            "slide-right": "slide-left", "soft-scale": "zoom-fade"})


if __name__ == "__main__":
    unittest.main()
