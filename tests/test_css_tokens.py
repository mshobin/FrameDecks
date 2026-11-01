"""The program's and the website's CSS stay on the design system's scale (docs/development/design-system.md, tools/css_tokens.py)."""
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class CssTokens(unittest.TestCase):
    def test_every_size_weight_radius_and_shadow_is_on_the_scale(self):
        run = subprocess.run([sys.executable, str(ROOT / "tools/css_tokens.py")], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stdout)

    def test_the_four_elevations_exist_in_both_themes(self):
        theme = (ROOT / "app/css/theme.css").read_text(encoding="utf-8")
        self.assertEqual(theme.count("--el-1:"), 2)
        self.assertEqual(theme.count("--el-2:"), 2)
        self.assertIn("--el-3:var(--shadow-pop)", theme)
        self.assertIn("--el-4:var(--shadow-modal)", theme)

    def test_every_colour_is_already_in_the_palette(self):
        # rerunning tools/css_palette.py would change nothing: no file holds a colour that is not yet a palette token
        sys.path.insert(0, str(ROOT / "tools"))
        import css_palette
        pal = css_palette.Palette()
        known = (len(pal.solid), len(pal.channels))
        for name in css_palette.FILES:
            text = (css_palette.CSS / name).read_text(encoding="utf-8")
            self.assertEqual(css_palette.convert(text, pal), text, name)
        self.assertEqual((len(pal.solid), len(pal.channels)), known)

    def test_every_page_loads_the_palette_first(self):
        for page in ("dashboard.html", "speaker.html", "spotlight.html"):
            html = (ROOT / "app" / page).read_text(encoding="utf-8")
            first = html.index('rel="stylesheet"')
            self.assertIn('href="css/palette.css"', html[first:first + 60], page)


if __name__ == "__main__":
    unittest.main()
