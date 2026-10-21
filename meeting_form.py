"""FrameDecks - the Meeting Form (6.9): where everything sits on the Meeting Workbook's form tab, and filling it in.

The Meeting Workbook has two tabs: Dashboard (formulas only) and Meeting Form (one guided page, top to bottom):

    1 · Meeting details     Meeting name · Date · Time · Location / link · Meeting notes      (label in A, value in B)
    2 · Speaker             Speaker name · Speaker contact
    3 · Attendees           Expected attendees · Attendee notes
    4 · Presentation        Presentation owner · Content notes
    5 · Frames              } tables: a header row ("Frame #" ...) and a fixed number of rows; the unused rows are
    6 · Content             } folded away (Excel's + button on the left opens them)
    7 · Discussion questions
    8 · Scripture readings
    9 · Additional notes

tools/make_meeting_workbook.py draws the template from this layout; fill() writes a meeting into that template for
"Export this meeting to Excel" (server.py, POST api/meeting/workbook), so the export looks exactly like the template.
app/js/meeting-book.js reads the form back (by its labels and header rows, so a hand-made form imports too).
Standard library only: the installed program has no Excel library.
"""
import datetime
import io
import re
import zipfile
from xml.sax.saxutils import escape

SHEET = "Meeting Form"
DASHBOARD = "Dashboard"
COLUMNS = "ABCDEFGHIJK"

# (section title, hint, [(key, label, height in lines)]) - the keys are those of the meeting in app/js/store.js
DETAILS = [
    ("Meeting details", "Who, when and where. The Dashboard tab fills itself in from these boxes.",
     [("title", "Meeting name", 1), ("date", "Date", 1), ("time", "Time", 1), ("location", "Location / link", 1),
      ("notes", "Meeting notes", 2)]),
    ("Speaker", "Who leads or teaches.", [("presenter", "Speaker name", 1), ("contact", "Speaker contact", 1)]),
    ("Attendees", "How many people you expect, and anything to prepare for them.",
     [("attendees", "Expected attendees", 1), ("attendeeNotes", "Attendee notes", 2)]),
    ("Presentation", "Who prepares the content, and what it needs.",
     [("owner", "Presentation owner", 1), ("contentNotes", "Content notes", 2)]),
]
# (key, title, hint, column names, rows) - the column names and their order match app/js/meeting-book.js FORM_TABLES
TABLES = [
    ("frames", "Frames", "One row per Frame: one screen, one step of the meeting. Number them 1, 2, 3…",
     ["Frame #", "Frame name", "Purpose / description", "Background", "Transition", "Presenter script"], 60),
    ("content", "Content", "What each Frame shows. Frame # says which Frame; Order is the order inside it; Deck groups a "
                "Frame's Content (one Deck on screen at a time; empty = the first Deck).",
     ["Frame #", "Order", "Content type", "Item name", "Main content / file", "On-screen label", "Duration (min)", "Animation",
      "PPT background", "Notes", "Deck"], 150),
    ("questions", "Discussion questions", "The questions of a Question item (same Frame # and item name), in order.",
     ["Frame #", "Content name", "Question #", "Label", "Question text", "Media", "Timer (min)", "Animation"], 150),
    ("scriptures", "Scripture readings", "The scriptures of a Scripture item. Leave the text empty to fetch it from the ESV.",
     ["Frame #", "Content name", "Scripture #", "Label", "Reference", "Scripture text", "Translation", "Animation"], 100),
]
EXTRA = ("Additional notes", "Anything else: equipment, follow-ups, prayer requests.", [("extra", "Additional notes", 3)])
SHOW_BLANK = 3            # empty table rows left open below the filled ones


def layout():
    """Row numbers of everything on the form: {"rows": [(row, kind, data)], "fields": {key: row},
    "tables": {key: (header row, first row, last row, columns)}}. kind: banner, intro, gap, heading, hint, field,
    header, data, footer."""
    rows, fields, tables = [], {}, {}
    r = 0

    def add(kind, data=None):
        nonlocal r
        r += 1
        rows.append((r, kind, data))
        return r

    add("banner")
    add("intro")
    add("gap")
    n = 0
    for title, hint, items in DETAILS:
        n += 1
        add("heading", f"{n} · {title}")
        add("hint", hint)
        for key, label, lines in items:
            fields[key] = add("field", (key, label, lines))
        add("gap")
    for key, title, hint, cols, count in TABLES:
        n += 1
        add("heading", f"{n} · {title}")
        add("hint", hint)
        head = add("header", (key, cols))
        first = r + 1
        for _ in range(count):
            add("data", key)
        tables[key] = (head, first, r, cols)
        add("gap")
    n += 1
    title, hint, items = EXTRA
    add("heading", f"{n} · {title}")
    add("hint", hint)
    for key, label, lines in items:
        fields[key] = add("field", (key, label, lines))
    add("gap")
    add("footer")
    return {"rows": rows, "fields": fields, "tables": tables}


LAYOUT = layout()


# ---------- filling the template ----------
def _cell_value(v):
    """Text from the app -> what Excel should hold: whole numbers as numbers, everything else as text."""
    s = "" if v is None else str(v)
    if re.fullmatch(r"\d{1,6}", s.strip()):
        return int(s.strip())
    return s


def _date_value(s):
    """2026-10-25 -> Excel's day number (the Date box is formatted as a date); other text stays text."""
    m = re.fullmatch(r"\s*(\d{4})-(\d{2})-(\d{2})\s*", s or "")
    if m:
        try:
            return (datetime.date(int(m[1]), int(m[2]), int(m[3])) - datetime.date(1899, 12, 30)).days
        except ValueError:
            pass
    return s or ""


def _time_value(s):
    """19:00 -> a fraction of a day (the Time box is formatted as a time); other text stays text."""
    m = re.fullmatch(r"\s*(\d{1,2}):(\d{2})\s*", s or "")
    if m and int(m[1]) < 24 and int(m[2]) < 60:
        return round((int(m[1]) * 60 + int(m[2])) / 1440, 10)
    return s or ""


_XML_BAD = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]")


def _cell_xml(ref, style, value):
    if value == "" or value is None:
        return f'<c r="{ref}"{style}/>'
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}"{style} t="n"><v>{value}</v></c>'
    text = escape(_XML_BAD.sub("", str(value))[:32000])
    return f'<c r="{ref}"{style} t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'


def _set_cells(xml, values):
    """values: {"B5": value}. Every cell to fill is in the template (styled), so it is replaced in place."""
    def one(m):
        ref = m.group(1)
        if ref not in values:
            return m.group(0)
        return _cell_xml(ref, m.group(2) or "", values.pop(ref))
    xml = re.sub(r'<c r="([A-Z]+\d+)"( s="\d+")?(?: t="\w+")?(?:/>|>.*?</c>)', one, xml, flags=re.S)
    missing = [k for k, v in values.items() if v not in ("", None)]
    if missing:
        raise ValueError("The template has no cell " + ", ".join(missing[:5]))
    return xml


def _set_rows(xml, show, hide):
    """Open (show) or fold away (hide) table rows: hidden + outline level 1, so Excel's + button opens them."""
    def one(m):
        num = int(m.group(1))
        attrs = re.sub(r'\s(hidden|outlineLevel|collapsed)="[^"]*"', "", m.group(2))
        if num in hide:
            attrs += ' hidden="1" outlineLevel="1"'
        elif num in show:
            pass
        else:
            return m.group(0)
        return f'<row r="{num}"{attrs}{m.group(3)}>'
    return re.sub(r'<row r="(\d+)"([^>]*?)(/?)>', one, xml)


def _sheet_path(z):
    """xl/worksheets/sheetN.xml of the Meeting Form tab (found by its name, through the workbook's relationships)."""
    wb = z.read("xl/workbook.xml").decode("utf-8")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    m = re.search(r'<sheet\b[^>]*name="' + re.escape(SHEET) + r'"[^>]*r:id="([^"]+)"', wb)
    if not m:
        raise ValueError("The template has no " + SHEET + " tab")
    t = re.search(r'<Relationship\b[^>]*Id="' + re.escape(m.group(1)) + r'"[^>]*Target="([^"]+)"', rels) or \
        re.search(r'<Relationship\b[^>]*Target="([^"]+)"[^>]*Id="' + re.escape(m.group(1)) + r'"', rels)
    target = t.group(1).lstrip("/")
    return target if target.startswith("xl/") else "xl/" + target


def fill(template, meeting, tables):
    """The template (bytes) with this meeting in it (bytes of a new .xlsx).
    meeting: {key: text} (DETAILS / EXTRA keys). tables: {"frames": [[cell, ...], ...], ...} without the header rows,
    columns in TABLES order. Raises ValueError when a table has more rows than the form."""
    values = {}
    for key, row in LAYOUT["fields"].items():
        v = str((meeting or {}).get(key) or "")
        values[f"B{row}"] = _date_value(v) if key == "date" else _time_value(v) if key == "time" else _cell_value(v)
    show, hide = set(), set()
    for key, (_head, first, last, cols) in LAYOUT["tables"].items():
        data = [r for r in (tables or {}).get(key) or [] if any(str(c or "").strip() for c in r)]
        if len(data) > last - first + 1:
            title = next(t[1] for t in TABLES if t[0] == key)
            raise ValueError(f"{title}: {len(data)} rows, the form has room for {last - first + 1}")
        for i in range(last - first + 1):
            row = data[i] if i < len(data) else []
            for j in range(len(cols)):
                values[f"{COLUMNS[j]}{first + i}"] = _cell_value(row[j]) if j < len(row) else ""
            (show if i < len(data) + SHOW_BLANK else hide).add(first + i)
    src = zipfile.ZipFile(io.BytesIO(template))
    path = _sheet_path(src)
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename == path:
                xml = _set_rows(_set_cells(data.decode("utf-8"), values), show, hide)
                data = xml.encode("utf-8")
            elif item.filename == "xl/workbook.xml":            # Excel works the Dashboard's formulas out on opening
                xml = data.decode("utf-8")
                if "fullCalcOnLoad" not in xml:
                    xml = re.sub(r"<calcPr\b", '<calcPr fullCalcOnLoad="1"', xml) if "<calcPr" in xml else \
                        xml.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>')
                data = xml.encode("utf-8")
            z.writestr(item, data)
    return out.getvalue()


def from_sheets(sheets):
    """app/js/meeting-book.js exportSheets() -> (meeting, tables) for fill(). sheets.meeting is [[label, value], ...]
    under a header row; the four tables are [[header...], [row...], ...]."""
    labels = {label: key for _t, _h, items in DETAILS + [EXTRA] for key, label, _l in items}
    meeting = {}
    for row in (sheets.get("meeting") or [])[1:]:
        if isinstance(row, list) and len(row) >= 2 and row[0] in labels:
            meeting[labels[row[0]]] = str(row[1] or "")
    tables = {}
    for key, *_ in TABLES:
        rows = sheets.get(key) or []
        tables[key] = [[("" if c is None else c) for c in r] for r in rows[1:] if isinstance(r, list)]
    return meeting, tables
