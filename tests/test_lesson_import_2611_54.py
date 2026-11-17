"""FrameDecks 26.11.54 - Import a lesson (owner, 15 November: "if i import a Pdf Lesson ... it will smartly extract the
question and scriptures and create the frames for us").

1. A lesson (PDF, Word or text) is read on this PC: its days or parts, numbered questions (3, 3a, 3b) and every Bible
   reference written the usual ways.
2. Headers, footers and page numbers repeated on every page are left out; a lesson title above the days is the title.
3. The dashboard shows each part with ticks and makes one Frame per part: a Scripture Content and a Question Content,
   with the order scripture -> questions. One Undo."""
import io
import sys
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import lesson_import as L  # noqa: E402


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def text_pdf(pages):
    """A small PDF whose pages carry real text (Helvetica), one string per line."""
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for lines in pages:
        def esc(t):
            return t.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        body = "BT /F1 11 Tf 14 TL 50 780 Td " + " ".join("(%s) Tj T*" % esc(t) for t in lines) + " ET"
        objs.append("<< /Length %d >>\nstream\n%s\nendstream" % (len(body.encode("latin-1")), body))
        objs.append("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>" % len(objs))
        kids.append(len(objs))
    objs[1] = "<< /Type /Pages /Kids [%s] /Count %d >>" % (" ".join("%d 0 R" % k for k in kids), len(kids))
    out, offs = b"%PDF-1.4\n", []
    for i, o in enumerate(objs):
        offs.append(len(out))
        out += ("%d 0 obj\n%s\nendobj\n" % (i + 1, o)).encode("latin-1")
    x = len(out)
    out += ("xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)).encode() + b"".join(("%010d 00000 n \n" % o).encode() for o in offs)
    out += ("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)).encode()
    return out


LESSON = """Lesson 5: God Calls Abram
Genesis 12-13

FIRST DAY: Review last week's lesson
1. What was the most meaningful thing you learned from last week's
lesson, and how did you apply it?
2. Read Genesis 11:27-32. What do you learn about Abram's family?

SECOND DAY: Read Genesis 12:1-9
3. What did God command Abram to do (Genesis 12:1)?
4. List the promises God made to Abram in Genesis 12:2-3.
a. Which promise affects you personally?
b. How is it fulfilled in Galatians 3:8, 16?
5. Challenge: Compare Hebrews 11:8-10 with Acts 7:2-4.
____________________________________________

Third Day: Genesis 12:10-20
6. Why did Abram go down to Egypt? What fears drove his decision?
7. How did God protect Sarai, even when Abram failed? (See also Ps 105:14-15.)
"""


class References(unittest.TestCase):
    def refs(self, t):
        return [r["ref"] for r in L.find_refs(t)]

    def test_the_usual_ways_of_writing_them(self):
        self.assertEqual(self.refs("Read John 3:16 and Gen. 12:1-3; 15:6."), ["John 3:16", "Genesis 12:1-3", "Genesis 15:6"])
        self.assertEqual(self.refs("See 1 Cor 13:4-7, 13 and Ps 23"), ["1 Corinthians 13:4-7, 13", "Psalm 23"])
        self.assertEqual(self.refs("Romans 8:28-9:2"), ["Romans 8:28-9:2"])
        self.assertEqual(self.refs("Mt 5:3-12; 6:9"), ["Matthew 5:3-12", "Matthew 6:9"])
        self.assertEqual(self.refs("II Kings 2:11 and first John 4:8"), ["2 Kings 2:11", "1 John 4:8"])
        self.assertEqual(self.refs("Jude 24; Philemon 4"), ["Jude 1:24", "Philemon 1:4"])

    def test_whole_chapters_are_marked(self):
        r = L.find_refs("Read Genesis 12-13, then Exodus 20")
        self.assertEqual([(x["ref"], x["whole"]) for x in r], [("Genesis 12-13", True), ("Exodus 20", True)])

    def test_everyday_words_are_not_references(self):
        self.assertEqual(self.refs("Is 4 the answer? Job is hard. Mark the 3 things. Acts of kindness 2 times."), [])
        self.assertEqual(self.refs("Corinthians 13 and Genesis 51:1"), [], "a numbered book needs its number; Genesis has 50 chapters")


class TheLesson(unittest.TestCase):
    def test_parts_questions_and_scriptures(self):
        plan = L.parse([LESSON], "Lesson 5.txt")
        self.assertEqual(plan["title"], "Lesson 5: God Calls Abram")
        self.assertEqual(plan["passage"], ["Genesis 12-13"])
        self.assertEqual([p["name"] for p in plan["parts"]], ["Day 1", "Day 2", "Day 3"])
        d2 = plan["parts"][1]
        self.assertEqual(d2["intro"], "Read Genesis 12:1-9")
        self.assertEqual([q["label"] for q in d2["questions"]], ["3", "4", "4a", "4b", "5"])
        self.assertEqual(d2["questions"][3]["refs"], ["Galatians 3:8, 16"])
        self.assertEqual(d2["refs"][0]["ref"], "Genesis 12:1-9", "the part's own passage first")
        d1 = plan["parts"][0]
        self.assertEqual(d1["questions"][0]["text"], "What was the most meaningful thing you learned from last week's lesson, and how did you apply it?",
                         "a question over two lines is one question")
        self.assertNotIn("____", " ".join(q["text"] for p in plan["parts"] for q in p["questions"]))

    def test_a_pdf_with_headers_footers_and_page_numbers(self):
        lines = LESSON.split("\n")
        pages = [lines[:12] + ["My Study Group - Lesson 5", "2"], lines[12:] + ["My Study Group - Lesson 5", "3"],
                 ["Fourth Day: Genesis 13", "8. What caused the strife in Genesis 13:5-7?", "My Study Group - Lesson 5", "4"]]
        plan = L.read(text_pdf(pages), "Lesson 5.pdf")
        self.assertEqual(plan["pages"], 3)
        self.assertEqual([p["name"] for p in plan["parts"]], ["Day 1", "Day 2", "Day 3", "Day 4"])
        every = " ".join(q["text"] for p in plan["parts"] for q in p["questions"])
        self.assertNotIn("My Study Group", every, "a line on every page is a header or footer")
        self.assertEqual([r["ref"] for r in plan["parts"][3]["refs"]], ["Genesis 13", "Genesis 13:5-7"])

    def test_a_word_file(self):
        paras = "".join("<w:p><w:r><w:t>%s</w:t></w:r></w:p>" % t.replace("&", "&amp;").replace("'", "&apos;") for t in LESSON.split("\n"))
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="x"><w:body>' + paras + "</w:body></w:document>")
        plan = L.read(buf.getvalue(), "Lesson 5.docx")
        self.assertEqual(len(plan["parts"]), 3)
        self.assertEqual(plan["parts"][2]["questions"][1]["refs"], ["Psalm 105:14-15"])

    def test_no_numbered_lesson_without_parts_is_one_frame(self):
        plan = L.parse(["Notes for Sunday\n1. Who is Jesus to you? (John 14:6)\n2. Pray together."], "notes.txt")
        self.assertEqual(len(plan["parts"]), 1)
        self.assertEqual(plan["parts"][0]["name"], "Notes for Sunday")
        self.assertEqual(len(plan["parts"][0]["questions"]), 2)

    def test_a_scan_or_an_empty_file_says_why(self):
        self.assertIn("scanned", L.parse(["", ""], "scan.pdf")["warnings"][0])
        with self.assertRaises(ValueError):
            L.read(b"", "x.pdf")
        with self.assertRaises(ValueError):
            L.read(b"%PDF-1.4 broken", "x.pdf")


class TheDashboard(unittest.TestCase):
    def test_wired_in_three_places_and_read_on_this_pc(self):
        js = read("app/js/lesson-import.js")
        dash = read("app/dashboard.html")
        lazy = read("app/js/store.js")          # 26.11.57 loaded the first time it is opened (KCLazy)
        self.assertIn("'lesson-import': {js: 'js/lesson-import.js', css: 'css/lesson-import.css'", lazy)
        self.assertIn('id="s-lesson-import"', dash)
        ws = read("app/js/workspace.js")
        self.assertIn("'A lesson (PDF or Word)…'", ws)      # 26.11.57 in the one Import menu
        self.assertIn("openImport($('mt-new'))", ws)   # 26.11.62 + New holds the meeting menu
        self.assertIn("api/lesson/read?name=", js)
        srv = read("src/server.py")
        self.assertIn('"/api/lesson/read"', srv)
        self.assertIn("def read_lesson(self):", srv)
        self.assertIn('"lesson_import"', read("packaging/framedecks.spec"))
        self.assertIn('"lesson-import.css"', read("tools/css_tokens.py"))

    def test_frames_with_scripture_then_questions_and_one_undo(self):
        js = read("app/js/lesson-import.js")
        for need in ("kind: 'scripture'", "kind: 'question'", "sc.flow = [[scr.id], [qs.id]]", "function undoImport()", "r.on = !r.whole",
                     "function freeName(n, base)", "SC.newGroup(n)"):
            self.assertIn(need, js)


if __name__ == "__main__":
    unittest.main()
