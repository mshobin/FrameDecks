"""FrameDecks 26.11.54 - Import a lesson: a study lesson (PDF, Word or plain text) becomes Frames.

Reads the lesson's own text on this PC (nothing is sent anywhere) and finds:
  - its parts: "Day 1", "First Day", "Lesson 3", "Week 2", "Part One", "Session 4" ... (one Frame each);
  - its numbered questions: "1.", "2)", "3a.", "Q4", and lettered parts under a number ("a.", "b)");
  - Bible references written the usual ways: "John 3:16", "Gen. 12:1-3; 15:6", "1 Cor 13:4-7, 13", "Ps 23",
    "Romans 8:28-9:2". A reference in a question belongs to that question; every reference in a part is offered as
    that part's scripture.

    plan = read(data, "Lesson 5.pdf")
      -> {"title": "Lesson 5", "pages": 6, "parts": [{"name": "Day 1", "questions": [{"label": "1", "text": ...,
          "refs": ["Genesis 12:1-3"]}], "refs": [{"ref": "Genesis 12:1-3", "whole": False}]}], "warnings": [...]}

Pure apart from reading the file: the dashboard (js/lesson-import.js) shows the plan, lets the leader tick what to
keep, and creates the Frames itself (one Undo). Book names are written as app/js/scripture.js writes them."""
import io
import re
import zipfile

MAX_BYTES = 40 * 1024 * 1024
MAX_PAGES = 200
MAX_PARTS = 60
MAX_QUESTIONS = 80              # per part
TEXT_MAX = 2000                 # a question item holds up to 2000 characters (store.js)

BOOKS = (
    ("Genesis", 50), ("Exodus", 40), ("Leviticus", 27), ("Numbers", 36), ("Deuteronomy", 34), ("Joshua", 24),
    ("Judges", 21), ("Ruth", 4), ("1 Samuel", 31), ("2 Samuel", 24), ("1 Kings", 22), ("2 Kings", 25),
    ("1 Chronicles", 29), ("2 Chronicles", 36), ("Ezra", 10), ("Nehemiah", 13), ("Esther", 10), ("Job", 42),
    ("Psalm", 150), ("Proverbs", 31), ("Ecclesiastes", 12), ("Song of Solomon", 8), ("Isaiah", 66), ("Jeremiah", 52),
    ("Lamentations", 5), ("Ezekiel", 48), ("Daniel", 12), ("Hosea", 14), ("Joel", 3), ("Amos", 9), ("Obadiah", 1),
    ("Jonah", 4), ("Micah", 7), ("Nahum", 3), ("Habakkuk", 3), ("Zephaniah", 3), ("Haggai", 2), ("Zechariah", 14),
    ("Malachi", 4), ("Matthew", 28), ("Mark", 16), ("Luke", 24), ("John", 21), ("Acts", 28), ("Romans", 16),
    ("1 Corinthians", 16), ("2 Corinthians", 13), ("Galatians", 6), ("Ephesians", 6), ("Philippians", 4),
    ("Colossians", 4), ("1 Thessalonians", 5), ("2 Thessalonians", 3), ("1 Timothy", 6), ("2 Timothy", 4),
    ("Titus", 3), ("Philemon", 1), ("Hebrews", 13), ("James", 5), ("1 Peter", 5), ("2 Peter", 3), ("1 John", 5),
    ("2 John", 1), ("3 John", 1), ("Jude", 1), ("Revelation", 22),
)
CHAPTERS = dict(BOOKS)

# written short forms (lower case, no dots) -> book; full names and "Psalms" are added below
ABBR = {
    "gen": "Genesis", "gn": "Genesis", "ex": "Exodus", "exod": "Exodus", "exo": "Exodus", "lev": "Leviticus",
    "lv": "Leviticus", "num": "Numbers", "nm": "Numbers", "deut": "Deuteronomy", "dt": "Deuteronomy",
    "josh": "Joshua", "jos": "Joshua", "judg": "Judges", "jdg": "Judges", "jgs": "Judges", "ru": "Ruth",
    "sam": "Samuel", "kgs": "Kings", "ki": "Kings", "chr": "Chronicles", "chron": "Chronicles", "neh": "Nehemiah",
    "esth": "Esther", "est": "Esther", "jb": "Job", "ps": "Psalm", "psa": "Psalm", "pss": "Psalm", "psalms": "Psalm",
    "prov": "Proverbs", "prv": "Proverbs", "pr": "Proverbs", "eccl": "Ecclesiastes", "eccles": "Ecclesiastes",
    "ecc": "Ecclesiastes", "qoh": "Ecclesiastes", "song": "Song of Solomon", "sos": "Song of Solomon",
    "song of songs": "Song of Solomon", "cant": "Song of Solomon", "isa": "Isaiah", "is": "Isaiah", "jer": "Jeremiah",
    "lam": "Lamentations", "ezek": "Ezekiel", "eze": "Ezekiel", "dan": "Daniel", "dn": "Daniel", "hos": "Hosea",
    "obad": "Obadiah", "ob": "Obadiah", "jon": "Jonah", "mic": "Micah", "nah": "Nahum", "hab": "Habakkuk",
    "zeph": "Zephaniah", "zep": "Zephaniah", "hag": "Haggai", "zech": "Zechariah", "zec": "Zechariah",
    "mal": "Malachi", "matt": "Matthew", "mt": "Matthew", "mat": "Matthew", "mk": "Mark", "mrk": "Mark",
    "lk": "Luke", "luk": "Luke", "jn": "John", "jhn": "John", "rom": "Romans", "rm": "Romans", "cor": "Corinthians",
    "gal": "Galatians", "eph": "Ephesians", "phil": "Philippians", "php": "Philippians", "col": "Colossians",
    "thess": "Thessalonians", "thes": "Thessalonians", "th": "Thessalonians", "tim": "Timothy", "tit": "Titus",
    "philem": "Philemon", "phlm": "Philemon", "phm": "Philemon", "heb": "Hebrews", "jas": "James", "jm": "James",
    "pet": "Peter", "pt": "Peter", "jud": "Jude", "rev": "Revelation", "revelations": "Revelation",
    "rv": "Revelation", "re": "Revelation",
}
for _name, _n in BOOKS:
    _base = _name.split(" ", 1)[1] if _name[0].isdigit() else _name
    ABBR.setdefault(_base.lower(), _base)
NUMBERED = {"Samuel", "Kings", "Chronicles", "Corinthians", "Thessalonians", "Timothy", "Peter", "John"}
ORD = {"1": 1, "2": 2, "3": 3, "i": 1, "ii": 2, "iii": 3, "first": 1, "second": 2, "third": 3, "1st": 1, "2nd": 2, "3rd": 3}
# short forms that are also everyday words: a reference with one of these needs "chapter:verse", never a bare chapter
WORDY = {"is", "re", "song", "job", "mark", "acts", "numbers", "judges", "ruth", "jud", "ex", "am", "amos", "pr", "ki"}

_names = sorted(ABBR, key=len, reverse=True)
_BOOK = r"(?:(?P<ord>[123]|i{1,3}|first|second|third|1st|2nd|3rd)\s*)?(?P<book>" + "|".join(re.escape(n) for n in _names) + r")\.?"
_NUMS = r"(?P<ch>\d{1,3})(?:\s*[:.]\s*(?P<vs>\d{1,3}[a-c]?(?:\s*[-–—]\s*\d{1,3}(?:\s*[:.]\s*\d{1,3})?[a-c]?)?(?:\s*,\s*\d{1,3}[a-c]?(?:\s*[-–—]\s*\d{1,3}[a-c]?)?)*))?(?:\s*[-–—]\s*(?P<ch2>\d{1,3})(?![:.\d]))?"
REF_RE = re.compile(r"(?<![\w])" + _BOOK + r"\s*" + _NUMS + r"(?![\d])", re.I)
# "; 15:6" or "; 15" straight after a reference: the same book
MORE_RE = re.compile(r"\s*;\s*(?:and\s+)?" + _NUMS.replace("?P<ch>", "?P<mch>").replace("?P<vs>", "?P<mvs>").replace("?P<ch2>", "?P<mch2>") + r"(?![\d])")

PART_RE = re.compile(r"^\s*(?:(?P<a>day|lesson|week|part|session|study|section|chapter)\s+(?P<n>\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b"
                     r"|(?P<o>first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?P<b>day|lesson|week|part|session|study|section))"
                     r"\s*(?P<rest>[:.\-–—|]?.*)$", re.I)
Q_RE = re.compile(r"^\s*(?:Q(?:uestion)?\s*)?(?P<n>\d{1,2})(?P<l>[a-h])?\s*[.)]\s*(?P<t>\S.*)$", re.I)
Q_NUMBER_ONLY = re.compile(r"^\s*(?:Q(?:uestion)?\s*)?(?P<n>\d{1,2})(?P<l>[a-h])?\s*[.)]?\s*$", re.I)
SUB_RE = re.compile(r"^\s*\(?(?P<l>[a-h])[.)]\s+(?P<t>\S.*)$")
BLANK_RE = re.compile(r"^[\s_.\-–—•·]*$")
PAGE_RE = re.compile(r"^\s*(?:page\s*)?\d{1,3}(?:\s*(?:of|/)\s*\d{1,3})?\s*$", re.I)
WORD_NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
            "ten": 10, "eleven": 11, "twelve": 12}
ORD_NUM = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "seventh": 7, "eighth": 8,
           "ninth": 9, "tenth": 10}


# ---------- reading the file ----------
def pages_of(data, name):
    """The text of each page (a PDF) or of the whole file (Word, plain text), as a list of strings."""
    low = str(name or "").lower()
    if data[:5] == b"%PDF-" or low.endswith(".pdf"):
        return _pdf_pages(data)
    if data[:2] == b"PK" or low.endswith(".docx"):
        return [_docx_text(data)]
    for enc in ("utf-8-sig", "utf-16", "cp1252"):
        try:
            return [data.decode(enc)]
        except UnicodeDecodeError:
            continue
    raise ValueError("This file could not be read as text.")


def _pdf_pages(data):
    import pypdfium2 as pdfium
    from slides import PDFIUM_LOCK                    # 26.11.52 PDFium is used by one thread at a time
    out = []
    with PDFIUM_LOCK:
        try:
            doc = pdfium.PdfDocument(data)
        except Exception as e:                        # pdfium raises its own error types for damaged files
            raise ValueError("This PDF could not be opened (" + str(e)[:80] + ").") from e
        try:
            for i in range(min(len(doc), MAX_PAGES)):
                page = doc[i]
                tp = page.get_textpage()
                try:
                    out.append(tp.get_text_range() or "")
                finally:
                    tp.close()
                    page.close()
        finally:
            doc.close()
    return out


def _docx_text(data):
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        info = z.getinfo("word/document.xml")
        if info.file_size > 20 * 1024 * 1024:
            raise ValueError("This Word file is too large.")
        xml = z.read(info).decode("utf-8", "replace")
    except (zipfile.BadZipFile, KeyError) as e:
        raise ValueError("This is not a Word (.docx) file.") from e
    paras = []
    for p in re.findall(r"<w:p[ >].*?</w:p>", xml, re.S):
        p = re.sub(r"<w:tab/>", "\t", p)
        p = re.sub(r"<w:br/>", "\n", p)
        text = "".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", p))
        num = re.search(r"<w:numPr>", p)
        paras.append(("• " if num and not re.match(r"\s*(\d|[a-h][.)])", text) else "") + _unxml(text))
    return "\n".join(paras)


def _unxml(s):
    return s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace("&amp;", "&")


# ---------- references ----------
def _book(ordinal, word):
    w = re.sub(r"\s+", " ", word.lower().rstrip("."))
    base = ABBR.get(w)
    if not base:
        return None
    if base in NUMBERED:
        n = ORD.get((ordinal or "").lower())
        if not n:
            return base if base == "John" else None     # "Corinthians 13" without 1 or 2 is not a reference
        name = "%d %s" % (n, base)
        return name if name in CHAPTERS else None
    if ordinal:
        return None
    return base


def _tidy(book, ch, vs, ch2):
    """'Genesis', '12', '1-3, 5' -> {'ref': 'Genesis 12:1-3, 5', 'whole': False}, or None when the numbers can't be."""
    ch = int(ch)
    one = CHAPTERS[book] == 1
    if one and not vs and not ch2 and 1 <= ch <= 60:   # "Jude 24", "Philemon 4": a verse of a one-chapter book
        return {"ref": "%s 1:%d" % (book, ch), "whole": False}
    if ch < 1 or ch > CHAPTERS[book]:
        return None
    if vs:
        v = re.sub(r"\s+", "", vs).replace("–", "-").replace("—", "-").replace(".", ":")
        v = re.sub(r"(\d)[a-c]", r"\1", v).replace(",", ", ")
        first = int(re.match(r"\d+", v).group(0))
        if first < 1 or first > 176:
            return None
        return {"ref": "%s %d:%s" % (book, ch, v), "whole": False}
    if ch2:
        c2 = int(ch2)
        if ch < c2 <= CHAPTERS[book]:
            return {"ref": "%s %d-%d" % (book, ch, c2), "whole": True}
    return {"ref": "%s %d" % (book, ch), "whole": True}


def find_refs(text):
    """Every Bible reference in a piece of text, in order, without repeats: [{'ref', 'whole'}]."""
    s = str(text or "").replace(" ", " ")
    out, seen, pos = [], set(), 0
    while True:
        m = REF_RE.search(s, pos)
        if not m:
            break
        pos = m.end()
        word = m.group("book")
        if word[0].islower() and len(word) <= 3:       # "is 4" in a sentence; written short forms start with a capital
            continue
        if word.lower().rstrip(".") in WORDY and not m.group("vs") and CHAPTERS.get(ABBR.get(word.lower().rstrip("."), ""), 2) != 1:
            continue
        book = _book(m.group("ord"), word)
        if not book:
            continue
        r = _tidy(book, m.group("ch"), m.group("vs"), m.group("ch2"))
        if not r:
            continue
        for r2 in [r] + _more(s, m.end(), book):
            if r2["ref"] not in seen:
                seen.add(r2["ref"])
                out.append(r2)
        while True:                                    # step past the "; 15:6" parts already read
            mm = MORE_RE.match(s, pos)
            if not mm:
                break
            pos = mm.end()
    return out


def _more(s, at, book):
    out = []
    while True:
        mm = MORE_RE.match(s, at)
        if not mm:
            return out
        at = mm.end()
        r = _tidy(book, mm.group("mch"), mm.group("mvs"), mm.group("mch2"))
        if r:
            out.append(r)


# ---------- the lesson ----------
def _lines(pages):
    """Clean lines of the whole lesson: page numbers and lines repeated on most pages (headers, footers) removed,
    words broken over two lines joined again."""
    split = [[ln.rstrip() for ln in re.split(r"\r\n|\r|\n", p)] for p in pages]
    repeat = set()
    if len(split) >= 3:
        count = {}
        for page in split:
            for ln in set(x.strip() for x in page if x.strip()):
                key = re.sub(r"\d+", "#", ln)
                count[key] = count.get(key, 0) + 1
        repeat = {k for k, v in count.items() if v >= max(3, len(split) * 0.6) and len(k) < 120}
    out = []
    for page in split:
        for ln in page:
            t = re.sub(r"[ \t\f\v]+", " ", ln.replace(" ", " ").replace(" ", " ")).strip()
            if not t or PAGE_RE.match(t) or re.sub(r"\d+", "#", t) in repeat:
                out.append("")
                continue
            if BLANK_RE.match(t):
                out.append("")
                continue
            t = re.sub(r"_{3,}.*$", "", t).strip()     # answer lines: "Why? ________"
            if out and out[-1].endswith("-") and t[:1].islower() and not out[-1].endswith(" -"):
                out[-1] = out[-1][:-1] + t
                continue
            out.append(t)
    return out


def _part_name(m):
    if m.group("a"):
        word, n = m.group("a").capitalize(), m.group("n").lower()
        n = WORD_NUM.get(n, n)
    else:
        word, n = m.group("b").capitalize(), ORD_NUM[m.group("o").lower()]
    rest = re.sub(r"^[:.\-–—|]\s*", "", (m.group("rest") or "").strip())
    return "%s %s" % (word, n), rest


def read(data, name="lesson"):
    """The plan for a lesson file (see the module text)."""
    if not data:
        raise ValueError("The file is empty.")
    if len(data) > MAX_BYTES:
        raise ValueError("The file is larger than 40 MB. A lesson is usually well under 5 MB: check it is the right file.")
    pages = pages_of(data, name)
    return parse(pages, name)


def parse(pages, name="lesson"):
    lines = _lines(pages)
    title = re.sub(r"\.(pdf|docx|txt)$", "", str(name or "").rsplit("/", 1)[-1].rsplit("\\", 1)[-1], flags=re.I).replace("_", " ").strip()[:80] or "Lesson"
    first = next((ln for ln in lines if ln), "")
    if first and not PART_RE.match(first) and not Q_RE.match(first) and len(first) <= 80:
        title = first
    parts, cur, warnings = [], None, []

    def new_part(nm, extra=""):
        p = {"name": nm[:60], "intro": extra, "questions": [], "text": [extra] if extra else []}
        parts.append(p)
        return p

    last_num = None
    for ln in lines:
        if not ln:                                     # a blank line ends a question's own lines
            if cur and cur["questions"]:
                cur["questions"][-1]["gap"] = True
            continue
        pm = PART_RE.match(ln)
        if pm and len(ln) <= 120:
            nm, rest = _part_name(pm)
            cur = new_part(nm, rest)
            last_num = None
            continue
        if cur is None:
            cur = new_part(title if title else "Lesson")
        qm = Q_RE.match(ln)
        sm = SUB_RE.match(ln)
        if qm and (last_num is None or 0 < int(qm.group("n")) <= (last_num or 0) + 3 or int(qm.group("n")) == 1):
            n = int(qm.group("n"))
            last_num = n
            label = "%d%s" % (n, (qm.group("l") or "").lower())
            cur["questions"].append({"label": label, "text": qm.group("t").strip()})
            continue
        if sm and last_num is not None and cur["questions"]:
            base = re.match(r"\d+", cur["questions"][-1]["label"]).group(0)      # "a." under 3 is 3a; 3 keeps its own words
            cur["questions"].append({"label": base + sm.group("l").lower(), "text": sm.group("t").strip()})
            continue
        if cur["questions"] and not cur["questions"][-1].get("gap"):
            cur["questions"][-1]["text"] += " " + ln          # the question goes on over the next line
        elif cur["questions"] and cur["questions"][-1].get("gap") and not ln[:1].isupper() and len(cur["questions"][-1]["text"]) < 400:
            cur["questions"][-1]["text"] += " " + ln
            cur["questions"][-1].pop("gap", None)
        else:
            cur["text"].append(ln)

    passage = []
    # "Lesson 5: God Calls Abram" above "Day 1", "Day 2": the lesson's own title, not a Frame of its own
    if len(parts) > 1 and not parts[0]["questions"] and parts[0]["name"].split(" ")[0] != parts[1]["name"].split(" ")[0]:
        top = parts.pop(0)
        title = (top["name"] + (": " + top["intro"] if top["intro"] else ""))[:80]
        passage = [r["ref"] for r in find_refs("\n".join(top["text"]))]
    out = []
    for p in parts[:MAX_PARTS]:
        qs = []
        for x in p["questions"][:MAX_QUESTIONS]:
            t = re.sub(r"\s+", " ", x["text"]).strip()
            t = re.sub(r"\s*_{2,}\s*", " ", t).strip()
            if not t:
                continue
            qs.append({"label": x["label"], "text": t[:TEXT_MAX], "refs": [r["ref"] for r in find_refs(t)]})
        refs = find_refs(p["intro"] + "\n" + "\n".join(p["text"]) + "\n" + "\n".join(q2["text"] for q2 in qs))
        if not qs and not refs:
            continue
        out.append({"name": p["name"], "intro": p["intro"][:200], "questions": qs, "refs": refs})
        if len(p["questions"]) > MAX_QUESTIONS:
            warnings.append("%s has more than %d questions; the first %d are offered." % (p["name"], MAX_QUESTIONS, MAX_QUESTIONS))
    if len(parts) > MAX_PARTS:
        warnings.append("The lesson has more than %d parts; the first %d are offered." % (MAX_PARTS, MAX_PARTS))
    if not any(lines):
        warnings.append("No text was found. A scanned lesson (pictures of pages) has no text to read: use the lesson's PDF from its website, or type the questions in.")
    elif not out:
        warnings.append("No numbered questions or Bible references were found in this file.")
    return {"title": title[:80], "passage": passage, "pages": len(pages), "parts": out, "warnings": warnings}
