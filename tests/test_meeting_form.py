"""meeting_form.py: the Meeting Form's layout agrees with app/js/meeting-book.js, and fill() writes a meeting into the
template correctly (python -m unittest discover -s tests -p "test_*.py")."""
import io
import json
import re
import sys
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import meeting_form as MF  # noqa: E402

TEMPLATE = (ROOT / "app" / "templates" / "FRAMEDECKS-Meeting-Workbook.xlsx").read_bytes()
JS = (ROOT / "app" / "js" / "meeting-book.js").read_text(encoding="utf-8")


def form_xml(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    return z.read(MF._sheet_path(z)).decode("utf-8")


def cell(xml, ref):
    m = re.search(r'<c r="' + ref + r'"[^>]*?(?:/>|>(.*?)</c>)', xml, re.S)
    assert m, ref
    inner = m.group(1) or ""
    t = re.search(r"<t[^>]*>(.*?)</t>", inner, re.S) or re.search(r"<v>(.*?)</v>", inner)
    return t.group(1) if t else ""


def row_attrs(xml, num):
    return re.search(r'<row r="' + str(num) + r'"([^>]*)>', xml).group(1)


class Layout(unittest.TestCase):
    def test_tables_match_the_app(self):
        js = {m[0]: json.loads("[" + m[1].replace("'", '"') + "]")
              for m in re.findall(r"\['(\w+)', '[^']+', \[([^\]]+)\]\]", JS[JS.index("var FORM_TABLES"):JS.index("];", JS.index("var FORM_TABLES"))])}
        self.assertEqual({k: cols for k, _t, _h, cols, _n in MF.TABLES}, js)

    def test_details_match_the_app(self):
        labels = dict(re.findall(r"\['(\w+)', '([^']+)', \[", JS[JS.index("var FIELDS"):JS.index("];", JS.index("var FIELDS"))]))
        mine = {key: label for _t, _h, items in MF.DETAILS + [MF.EXTRA] for key, label, _l in items}
        self.assertEqual(mine, labels)

    def test_template_matches_the_layout(self):
        xml = form_xml(TEMPLATE)
        for key, (head, _first, _last, cols) in MF.LAYOUT["tables"].items():
            self.assertEqual([cell(xml, f"{MF.COLUMNS[j]}{head}") for j in range(len(cols))], [c.replace("&", "&amp;") for c in cols], key)
        for key, row in MF.LAYOUT["fields"].items():
            self.assertTrue(cell(xml, f"A{row}"), key)


class Fill(unittest.TestCase):
    def test_details_and_tables(self):
        out = MF.fill(TEMPLATE, {"title": "Romans <8> & more", "date": "2026-11-02", "time": "18:30", "attendees": "40"},
                      {"frames": [[1, "Welcome", "", "Navy", "Fade", "Hi\nthere"], [2, "Talk"]], "content": [], "questions": [], "scriptures": []})
        xml = form_xml(out)
        f = MF.LAYOUT["fields"]
        self.assertEqual(cell(xml, f"B{f['title']}"), "Romans &lt;8&gt; &amp; more")
        self.assertEqual(cell(xml, f"B{f['date']}"), "46328")           # a real date: 2026-11-02
        self.assertEqual(cell(xml, f"B{f['time']}"), str(round(1110 / 1440, 10)))
        self.assertEqual(cell(xml, f"B{f['attendees']}"), "40")
        self.assertEqual(cell(xml, f"B{f['notes']}"), "")                # the template's example is cleared
        _h, first, last, _c = MF.LAYOUT["tables"]["frames"]
        self.assertEqual([cell(xml, f"B{first}"), cell(xml, f"B{first + 1}"), cell(xml, f"B{first + 2}")], ["Welcome", "Talk", ""])
        self.assertEqual(cell(xml, f"F{first}"), "Hi\nthere")
        self.assertNotIn("hidden", row_attrs(xml, first + 1 + MF.SHOW_BLANK))   # 2 rows + 3 open
        self.assertIn('hidden="1"', row_attrs(xml, first + 2 + MF.SHOW_BLANK))
        self.assertIn('outlineLevel="1"', row_attrs(xml, last))
        z = zipfile.ZipFile(io.BytesIO(out))
        self.assertIn("fullCalcOnLoad", z.read("xl/workbook.xml").decode())
        self.assertEqual(len(z.namelist()), len(zipfile.ZipFile(io.BytesIO(TEMPLATE)).namelist()))

    def test_too_many_rows(self):
        n = MF.TABLES[0][4]
        with self.assertRaises(ValueError):
            MF.fill(TEMPLATE, {}, {"frames": [[i + 1, "F"] for i in range(n + 1)]})

    def test_from_sheets(self):
        meeting, tables = MF.from_sheets({"meeting": [["Field", "Value"], ["Meeting name", "M"], ["Speaker contact", "c"], ["Odd", "x"]],
                                          "frames": [["Frame #"], [1, "A", None]]})
        self.assertEqual(meeting, {"title": "M", "contact": "c"})
        self.assertEqual(tables["frames"], [[1, "A", ""]])
        self.assertEqual(tables["content"], [])


if __name__ == "__main__":
    unittest.main()
