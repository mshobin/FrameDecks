"""FrameDecks 26.11.50 - type in the preview, and the area below as Settings cards (owner, 15 November).

1. Type in the preview for every kind of Content: a click selects a card (gold outline and name tag).
2. A toolbar above the selected card: Edit, A-/A+, n of m with arrows, + Question / Scripture, Show/Hide, Delete.
3. The area below is Settings only, as cards, with a Show text fields switch for the typing boxes.
4. Double-click empty space to add Content there; drag to move; a corner to resize.
5. On a live Frame an edit is a draft until Update screen, with an Editing badge.
6. Keys in the preview: Tab / Shift+Tab, Enter, Esc, arrows, Delete."""
import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class ThePreviewTools(unittest.TestCase):
    def setUp(self):
        self.pt = read("app/js/preview-tools.js")

    def test_loaded_after_the_preview_editor_with_its_styles(self):
        dash = read("app/dashboard.html")
        self.assertLess(dash.index('src="js/preview-edit.js"'), dash.index('src="js/preview-tools.js"'))
        self.assertIn('href="css/edit-preview.css"', dash)
        self.assertIn('"edit-preview.css"', read("tools/css_tokens.py"), "the new stylesheet is checked for tokens")

    def test_selection_toolbar_and_badge(self):
        for need in ("cls: 'pv-sel'", "cls: 'pv-sel-tag'", "'nw', 'ne', 'sw', 'se'", "role: 'toolbar'", "cls: 'pv-editing'",
                     "'Larger'", "'Smaller'", "'Previous '", "'Next '", "'Add a '", "'Hide it'", "'Show it'", "'danger'"):
            self.assertIn(need, self.pt)
        self.assertIn("window.KCPreviewTools = {", self.pt)

    def test_double_click_on_empty_space_adds_there(self):
        pe = read("app/js/preview-edit.js")
        self.assertIn("new CustomEvent('kc-pv-empty'", pe)
        self.assertIn("window.getSelection().removeAllRanges()", pe, "a double-click never selects the picture")
        self.assertIn("document.addEventListener('kc-pv-empty'", self.pt)
        for label in ("'Question'", "'Scripture'", "'Text'", "'Name title'", "'Picture or video…'"):
            self.assertIn(label, self.pt)
        self.assertIn("function typeNew(s)", self.pt, "a new Text with no words opens its typing box where it will appear")

    def test_keys(self):
        for key in ("'Tab'", "'Enter'", "'Escape'", "'Delete'", "Arrow"):
            self.assertIn(key, self.pt)

    def test_moving_and_resizing_change_the_settings(self):
        for key in ("qBottom", "verseY", "qWidth", "verseWidth", "nearestPos("):
            self.assertIn(key, self.pt)

    def test_nearest_position(self):
        pos_at = re.search(r"var POS_AT = (\{.*?\});", self.pt).group(1)
        fn = re.search(r"function nearestPos\(fx, fy\)\{.*?return best; \}", self.pt).group(0)
        code = "var POS_AT = " + pos_at + ";\n" + fn + "\nconsole.log(JSON.stringify([nearestPos(0.1, 0.1), nearestPos(0.5, 0.5), nearestPos(0.9, 0.9), nearestPos(0.5, 0.95), nearestPos(0.85, 0.12)]));"
        try:
            res = subprocess.run(["node", "-e", code], capture_output=True, text=True, encoding="utf-8", timeout=60)
        except FileNotFoundError:
            self.skipTest("node is not installed")
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertEqual(json.loads(res.stdout), ["upper-left", "center", "lower-right", "bottom", "upper-right"])

    def test_live_frames_are_a_draft(self):
        pe = read("app/js/preview-edit.js")
        self.assertIn("saveText: 'Update screen'", pe)
        self.assertIn("Editing", self.pt)


class SettingsAsCards(unittest.TestCase):
    def test_cards_mode_and_the_text_fields_switch(self):
        ws = read("app/js/workspace.js")
        for need in ("function cardsMode(sc,l,kind)", "'sc-cards'", "'no-words'", "kc-text-fields", "role: 'switch'", "' Show text fields'",
                     "'Type in the preview'", "var CARD_IC = {"):
            self.assertIn(need, ws.replace("function cardsMode(sc, l, kind)", "function cardsMode(sc,l,kind)"))
        self.assertNotIn("mouse-pointer-click", ws, "only icons the app has")

    def test_styles_keep_simple_mode_and_the_tokens(self):
        css = read("app/css/edit-preview.css")
        for need in (".insp-body.sc-cards", ".sc-card", ".no-words", ".sc-tf-k", ".pv-bar", ".pv-sel", ".pv-add", "body.simple:not(.sm-design-open)"):
            self.assertIn(need, css)
        self.assertIsNone(re.search(r"#[0-9a-fA-F]{3,8}\b", css), "colours only through tokens")
        self.assertIn("prefers-reduced-motion", css)


if __name__ == "__main__":
    unittest.main()
