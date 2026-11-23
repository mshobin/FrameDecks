"""26.11.66: everything on a card in the preview is edited by double-clicking it, the title included. Once a card is
selected, its outline (js/preview-tools.js) lies over it and caught the double-click, and it always opened the words:
a question's or scripture's title, an announcement's title and a scripture's reference could only be edited in the
area below. The outline now passes where you clicked, so the part under the pointer is edited."""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class DoubleClickEditsThePartUnderThePointer(unittest.TestCase):
    def test_the_selection_outline_passes_where_you_clicked(self):
        tools = read("app/js/preview-tools.js")
        self.assertIn("box.addEventListener('dblclick', function(e){ e.preventDefault(); e.stopPropagation(); var c = cardEl(sel); "
                      "if (c) PE.editAt(c, e.clientX, e.clientY); });", tools)
        self.assertNotIn("box.addEventListener('dblclick', function(e){ e.preventDefault(); e.stopPropagation(); editSel(); });", tools)

    def test_the_editor_finds_the_title_the_words_or_the_reference(self):
        pe = read("app/js/preview-edit.js")
        self.assertIn("function editAt(card, cx, cy){", pe)
        self.assertIn("editAt: editAt", pe)
        self.assertIn("onLabel = lbl && lbl.offsetParent !== null && within(lbl.getBoundingClientRect(), x, y)", pe)
        self.assertIn("onRef = !onLabel && refEl && refEl.offsetParent !== null && within(refEl.getBoundingClientRect(), x, y)", pe)
        self.assertIn("focus: onRef ? 'first' : ''", pe)
        self.assertIn("var first = o.focus === 'first' && extras.length ? extras[0].el : f.el;", read("app/js/editable.js"))


if __name__ == "__main__":
    unittest.main()
