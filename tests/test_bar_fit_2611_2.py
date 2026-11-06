"""26.11.2: the top bars fit their window at every size, Follow my voice listens while the Teleprompter is in front,
and the Command Center opens without an empty box first."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


class BarFit(unittest.TestCase):
    def test_the_fitter_measures_and_never_loops_on_its_own_change(self):
        js = read("app/js/bar-fit.js")
        for need in ("el.setAttribute('data-fit', '0');",
                     "while (level < max && !fits(el)){ level++; el.setAttribute('data-fit', String(level)); }",
                     "if (!queued){ queued = true; requestAnimationFrame(run); }",
                     "attributeFilter: ['hidden', 'disabled', 'aria-hidden']",
                     "if (d === 'contents') items(k, out); else out.push(k);",
                     "document.querySelectorAll('[data-bar-fit]')"):
            self.assertIn(need, js)
        self.assertNotIn("'data-fit'", js.split("attributeFilter")[1].split("]")[0])   # its own attribute is not watched
        self.assertNotIn("setInterval", js)

    def test_the_main_bar_uses_it_instead_of_window_widths(self):
        html = read("app/dashboard.html")
        self.assertIn('<header class="top console-top cmdbar" data-win-drag data-bar-fit="6">', html)
        self.assertIn('<script src="js/bar-fit.js"></script>', html)
        css = read("app/css/theme.css")
        for lvl in range(1, 7):
            self.assertIn('.cmdbar[data-fit="%d"]' % lvl, css)
        self.assertIn(".cmdbar{flex-wrap:nowrap}", css)
        self.assertIn('.cmdbar[data-fit="6"]{flex-wrap:wrap;row-gap:6px}', css)
        # the old fixed-width rules for the bar are gone: nothing in a max-width block hides or wraps the bar
        for block in re.findall(r"@media \(max-width:\d+px\)\{(.*?)\}\s*\}", css, re.S):
            self.assertNotIn(".cmdbar", block)

    def test_the_teleprompter_bar_uses_it(self):
        html = read("app/speaker.html")
        self.assertIn('<div class="sp-row sp-row1" data-bar-fit="4">', html)
        self.assertIn('data-no-drag data-bar-fit="3">', html)
        self.assertIn('<script src="js/bar-fit.js"></script>\n<script src="js/speaker.js"></script>', html)
        for label in ('aria-label="Next Frame"', 'aria-label="Follow my voice"', 'aria-label="Write Script"', 'aria-label="Upload"'):
            self.assertIn(label, html)                     # the name stays when only the icon shows
        css = read("app/css/speaker.css")
        self.assertIn('.sp-row1[data-fit="4"]>[data-win-controls]{order:3}', css)
        self.assertIn('.sp-row1[data-fit="4"]::after{content:"";order:4;flex:0 0 100%;height:0}', css)


class VoiceInFront(unittest.TestCase):
    def test_listens_while_pinned_or_in_front(self):
        js = read("app/js/speaker.js")
        self.assertIn("function inFront(){ return desk.onTop || document.hasFocus() ? '' : 'front'; }", js)
        self.assertIn("frontT = setTimeout(", js)          # a short wait: a click on the title bar does not restart it
        self.assertNotIn("'pin'", js)
        self.assertIn("front: 'Bring the Teleprompter to the front, or pin it, to follow your voice'", read("app/js/voice-follow.js"))
        self.assertIn('.sp-voice-st[data-state="front"]', read("app/css/speaker.css"))
        self.assertIn("Only while it is in front.", read("docs/guide/presentations.md"))


class CommandCenterOpens(unittest.TestCase):
    def test_no_empty_box_before_the_bar(self):
        main = read("src/desktop_app.py")
        self.assertIn('url + "spotlight.html?glass=1", width=820, height=SPOT_H,\n                                          x=-32000, y=-32000,', main)
        html = read("app/spotlight.html")
        self.assertIn("if (/[?&]glass=1/.test(location.search)) d.classList.add('kc-glass');", html)
        self.assertIn("html.kc-glass body.spotlight{background:transparent}", read("app/css/spotlight.css"))


if __name__ == "__main__":
    unittest.main()


class NothingForAntivirusToMistake(unittest.TestCase):
    """26.11.2 until the installer is signed: the installed app downloads no program code and starts nothing hidden,
    and the release stops if Microsoft Defender flags the build."""

    def test_the_speech_engine_comes_with_the_installer(self):
        import sys
        import tempfile
        from unittest import mock
        sys.path.insert(0, str(ROOT / "src"))
        import voice_follow
        tmp = Path(tempfile.mkdtemp())
        rt = tmp / "voice_runtime"
        rt.mkdir()
        (rt / "libvosk.dll").write_bytes(b"x")
        with mock.patch.object(voice_follow, "BUNDLED", rt):
            installed = voice_follow.VoiceFollow(tmp, frozen=True, available=True)
            self.assertTrue(installed.bundled)
            self.assertEqual(installed.runtime_dir, rt)                       # not in the data folder
            source = voice_follow.VoiceFollow(tmp, frozen=False, available=True)
            self.assertFalse(source.bundled)                                  # from source it is still fetched
            self.assertNotEqual(source.runtime_dir, rt)
        vf = read("src/voice_follow.py")
        self.assertIn('keys = ("model",) if self.bundled else ("runtime", "model")', vf)
        self.assertIn("creationflags=(_LOW if self.frozen else _NO_WINDOW)", vf)

    def test_the_build_puts_it_in_and_scans_with_defender(self):
        spec = read("packaging/framedecks.spec")
        self.assertIn('voice_data = [(str(voice_rt), "voice_runtime")] if (voice_rt / "libvosk.dll").exists() else []', spec)
        wf = read(".github/workflows/build-windows.yml")
        for need in ("- name: Put the speech engine in (Follow my voice)",
                     "if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $rt.sha256)",
                     'if (-not (Test-Path "dist/FRAMEDECKS/_internal/voice_runtime/libvosk.dll"))',
                     "- name: Scan with Microsoft Defender (the release stops if anything is flagged)",
                     "-Scan -ScanType 3 -File $t -DisableRemediation",
                     "if ($code -eq 2) { $flagged += $t }"):
            self.assertIn(need, wf)
        # the scan runs before anything is published or uploaded
        self.assertLess(wf.index("Scan with Microsoft Defender"), wf.index("Publish on the Releases page"))
        self.assertLess(wf.index("Put the speech engine in"), wf.index("Build the app (PyInstaller)"))
        self.assertIn("src/voice_runtime/", read(".gitignore"))
