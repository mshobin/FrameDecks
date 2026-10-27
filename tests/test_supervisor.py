"""FrameDecks - the watchdog that restarts the program after a crash (supervisor.py; architecture audit C2)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import supervisor as S  # noqa: E402

ACCESS_VIOLATION = 0xC0000005
STACK_OVERRUN = 0xC0000409


class WatchdogTest(unittest.TestCase):
    def run_with(self, codes, times=None):
        codes, calls, slept = list(codes), [], []
        clock = iter(times or [i * 10.0 for i in range(100)])

        def spawn(argv, env):
            calls.append(env.get(S.CHILD_ENV))
            return codes.pop(0)

        result = S.run(["FRAMEDECKS.exe"], spawn=spawn, clock=lambda: next(clock), sleep=slept.append)
        return result, len(calls), calls, slept

    def test_a_normal_quit_ends_the_watchdog(self):
        self.assertEqual(self.run_with([0])[:2], (0, 1))

    def test_task_manager_or_the_uninstaller_is_respected(self):
        self.assertEqual(self.run_with([1])[:2], (1, 1))        # taskkill /F and End task: code 1, no restart

    def test_a_crash_restarts_the_program(self):
        result, runs, envs, slept = self.run_with([ACCESS_VIOLATION, 0])
        self.assertEqual((result, runs), (0, 2))
        self.assertEqual(envs, ["1", "1"], "the program knows it is supervised (no watchdog inside the watchdog)")
        self.assertEqual(slept, [S.WAIT_BEFORE_RESTART])

    def test_at_most_three_restarts_in_five_minutes(self):
        result, runs, _, _ = self.run_with([ACCESS_VIOLATION] * 10)
        self.assertEqual(runs, 4)                                 # the first run and 3 restarts
        self.assertEqual(result, 0)

    def test_crashes_far_apart_keep_being_restarted(self):
        result, runs, _, _ = self.run_with([STACK_OVERRUN] * 5 + [0], times=[i * 400.0 for i in range(20)])
        self.assertEqual(runs, 6)

    def test_crash_codes(self):
        self.assertTrue(S.is_crash(ACCESS_VIOLATION))
        self.assertTrue(S.is_crash(-1073741819))                  # the same code, signed
        for code in (0, 1, 2, None, 0x40010004):
            self.assertFalse(S.is_crash(code))

    def test_when_it_runs(self):
        self.assertFalse(S.wanted({S.CHILD_ENV: "1"}, frozen=True))
        if sys.platform == "win32":
            self.assertTrue(S.wanted({}, frozen=True))
            self.assertFalse(S.wanted({}, frozen=False))
            self.assertTrue(S.wanted({S.SWITCH_ENV: "1"}, frozen=False))
            self.assertFalse(S.wanted({S.SWITCH_ENV: "0"}, frozen=True))
        else:
            self.assertFalse(S.wanted({}, frozen=True))           # Windows only


if __name__ == "__main__":
    unittest.main()
