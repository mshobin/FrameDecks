"""Writes the FrameDecks Meeting Workbook template (6.9; 9.4 the Meeting plan): two tabs, Dashboard and Meeting Form.

    python3 tools/make_meeting_workbook.py

Meeting Form: one guided page, top to bottom (the layout is in src/meeting_form.py, which also fills the form for "Export
this meeting to Excel"). Dashboard: a summary of the form made only by formulas: this meeting, KPI tiles, readiness,
quick links into the form, the content mix and a log of recent meetings. Nothing on the Dashboard is imported.

Output: app/templates/FRAMEDECKS-Meeting-Workbook.xlsx (downloaded from the app: Meeting → Download the Excel
template). The column names and allowed values must match app/js/meeting-book.js;
tests/meeting-workbook.test.js checks that the template imports without errors.
"""
import datetime
import io
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.drawing.image import Image
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.hyperlink import Hyperlink
from PIL import Image as PILImage

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import meeting_form as MF  # noqa: E402

LEVELS = ["Frame", "Deck", "Content"]
DECK_TYPES = ["Question", "Scripture", "Text", "Announcement", "Prayer Point", "Lower Third", "Timer", "Image", "Video", "PowerPoint",
              "Birthday", "Branding", "Camera", "Screen", "Background"]
BACKGROUNDS = ["None", "Navy", "Black", "White", "Brand"]
TRANSITIONS = ["Frame default", "Cut", "Fade", "Cross Dissolve", "Dip to Black", "Dip to White", "Slide Left", "Slide Right", "Push",
               "Zoom Fade", "Soft Scale", "Cinema Fade"]
ANIMATIONS = ["Content default", "Fade", "Gentle Rise", "Word by Word", "Typewriter", "Burst", "Cut"]
EFFECTS = TRANSITIONS + [a for a in ["Content default", "Fade", "Gentle Rise", "Word by Word", "Typewriter", "Burst", "Cut"] if a not in TRANSITIONS]

# the app's colours; every height is a multiple of 6 pt (8 px)
NAVY, GOLD, INK, MUTED, LINE, PAPER, CARD, INPUT = "0F1F3D", "E3B75A", "1B2333", "6B7385", "D5DCE8", "FFFFFF", "F4F6FA", "FFFBEF"
FONT = "Segoe UI"
H_BANNER, H_INTRO, H_HEAD, H_HINT, H_LINE, H_GAP = 48, 30, 30, 18, 24, 12


def fill(c):
    return PatternFill("solid", fgColor=c)


def font(size=11, color=INK, bold=False, italic=False, underline=None):
    return Font(name=FONT, size=size, color=color, bold=bold, italic=italic, underline=underline)


THIN = Side(style="thin", color=LINE)
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
GOLD_RULE = Border(bottom=Side(style="medium", color=GOLD))
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True, indent=1)
TOP = Alignment(horizontal="left", vertical="top", wrap_text=True, indent=1)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)

SAMPLE_MEETING = {
    "title": "Evening Bible Study", "date": datetime.date(2026, 10, 25), "time": datetime.time(19, 0),
    "location": "Fellowship Hall, or paste the Zoom / Teams link", "notes": "Anything the team should know about this meeting.",
    "presenter": "Your name", "contact": "name@example.com · 555 0100", "attendees": 24,
    "attendeeNotes": "Two newcomers expected: welcome them by name.", "owner": "Your name",
    "contentNotes": "Slides are in the shared folder; the countdown starts five minutes before.", "extra": "",
}
# 9.4 the Meeting plan: Frame > Deck(s) > Content(s). No. (column A) is a formula, so the sample starts at Level.
#           Level      Type            Name               Text                                              Bible reference  On-screen label          Effect           Notes / script
SAMPLE_PLAN = [
    ["Frame", "", "Welcome", "", "", "", "Fade", "Greet people by name as they join."],
    ["Deck", "Text", "Welcome message", "Welcome! We begin in just a moment.", "", "Welcome", "Fade", ""],
    ["Deck", "Timer", "Countdown", 5, "", "Starting in", "", "Five-minute countdown."],
    ["Frame", "", "Scripture Reading", "", "", "", "Cross Dissolve", "Ask a volunteer to read."],
    ["Deck", "Scripture", "Reading", "", "", "Scripture", "Gentle Rise", ""],
    ["Content", "", "", "There is therefore now no condemnation for those who are in Christ Jesus.", "Romans 8:1 (ESV)", "", "", ""],
    ["Content", "", "", "For the law of the Spirit of life has set you free in Christ Jesus from the law of sin and death.", "Romans 8:2 (ESV)",
     "Read together", "", "With an ESV key (Settings → Scripture), leave Text empty and FrameDecks fills it in."],
    ["Frame", "", "Discussion", "", "", "", "Fade", "Allow 10 minutes per question."],
    ["Deck", "Question", "Questions", "", "", "Question", "Fade", ""],
    ["Content", "", "", "What does “no condemnation” mean for you?", "", "Question 1", "", ""],
    ["Content", "", "", "How does the Spirit help us live differently?", "", "Question 2", "Word by Word", ""],
    ["Content", "", "", "What is one step you will take this week?", "", "Question 3", "", ""],
    ["Deck", "Lower Third", "Group time", "Discuss in groups of three", "", "Small groups", "Gentle Rise", ""],
    ["Frame", "", "Teaching", "", "", "", "Fade", "Open the slides in the app after the import."],
    ["Deck", "PowerPoint", "Slides", "Teaching slides.pptx", "", "", "", "Choose the file in the app after the import."],
    ["Frame", "", "Closing", "", "", "", "Dip to Black", "Thank everyone for coming."],
    ["Deck", "Prayer Point", "Closing prayer", "Let’s close our time together in prayer.", "", "Closing Prayer", "Fade", ""],
    ["Deck", "Lower Third", "Goodbye", "See you next time", "", "Thank you for joining!", "Gentle Rise", ""],
]
FORM_WIDTHS = [20, 11, 15, 22, 46, 20, 22, 16, 32, 14]
PLAN_LONG = {4, 8}                  # columns that wrap long text (Text, Notes)
LEVEL_FILL = {"Frame": "E8EEF9", "Deck": "FFFFFF", "Content": "FFFFFF"}
VALUE_SPAN = "F"             # a detail's box: B..F


def no_formula(first, n):
    """No. for row n: Frame 1 · Deck 1.1 · Content 1.1.1, worked out from the Level column (B) above it."""
    rng = f"B${first}:B{n}"
    last = lambda what: f'INDEX(B:B,LOOKUP(2,1/({rng}="{what}"),ROW({rng})))'      # noqa: E731 - the row of the last Frame / Deck
    frames = f'COUNTIF({rng},"Frame")'
    decks = f'COUNTIF({last("Frame")}:B{n},"Deck")'
    contents = f'COUNTIF({last("Deck")}:B{n},"Content")'
    return (f'=IFERROR(IF(B{n}="","",IF(B{n}="Frame",{frames},IF(B{n}="Deck",{frames}&"."&{decks},'
            f'{frames}&"."&{decks}&"."&{contents}))),"?")')


def deck_type_formula(first, n):
    """Column J (hidden): the Deck type of a row (its own for a Deck, its Deck's for a Content), for the Dashboard."""
    rng = f"B${first}:B{n}"
    return (f'=IFERROR(IF(B{n}="Deck",C{n},IF(B{n}="Content",LOOKUP(2,1/({rng}="Deck"),C${first}:C{n}),"")),"")')


def list_rule(ws, values, cells, prompt, strict=True):
    dv = DataValidation(type="list", formula1='"' + ",".join(values) + '"', allow_blank=True, showErrorMessage=strict,
                        errorTitle="Choose from the list", error=prompt, promptTitle="Choose", prompt=prompt, showInputMessage=True)
    ws.add_data_validation(dv)
    for part in cells.split():
        dv.add(part)


def whole_rule(ws, cells, prompt, top=9999):
    dv = DataValidation(type="whole", operator="between", formula1="0", formula2=str(top), allow_blank=True, showErrorMessage=True,
                        errorTitle="A whole number", error=prompt)
    ws.add_data_validation(dv)
    for part in cells.split():
        dv.add(part)


def band(ws, row, height, color=None):
    ws.row_dimensions[row].height = height
    if color:
        for col in MF.COLUMNS:
            ws[f"{col}{row}"].fill = fill(color)


# ---------- Meeting Form ----------
def meeting_form(wb):
    ws = wb.create_sheet(MF.SHEET)
    ws.sheet_properties.tabColor = NAVY
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 110
    for i, w in enumerate(FORM_WIDTHS):
        ws.column_dimensions[MF.COLUMNS[i]].width = w
    last_col = MF.COLUMNS[-1]
    tables = MF.LAYOUT["tables"]
    for row, kind, data in MF.LAYOUT["rows"]:
        a = ws[f"A{row}"]
        if kind == "banner":
            band(ws, row, H_BANNER, NAVY)
            ws.merge_cells(f"A{row}:{last_col}{row}")
            a.value = "FrameDecks   ·   Meeting Form"
            a.font, a.alignment = font(18, "FFFFFF", bold=True), Alignment(vertical="center", indent=1)
        elif kind == "intro":
            band(ws, row, H_INTRO, CARD)
            ws.merge_cells(f"A{row}:{last_col}{row}")
            a.value = ("Fill in the cream boxes, then plan the meeting in section 5: a Frame row for each screen, Deck rows for "
                       "what it shows, Content rows for each question or verse. More rows: the + button on the left. "
                       "Then, in FrameDecks: Quick Start or Settings → Import from Excel.")
            a.font, a.alignment = font(10, MUTED), LEFT
        elif kind == "gap":
            band(ws, row, H_GAP)
        elif kind == "heading":
            band(ws, row, H_HEAD)
            ws.merge_cells(f"A{row}:{last_col}{row}")
            a.value = data
            a.font, a.alignment = font(13, NAVY, bold=True), Alignment(vertical="bottom")
            for col in MF.COLUMNS:
                ws[f"{col}{row}"].border = GOLD_RULE
        elif kind == "hint":
            band(ws, row, H_HINT)
            ws.merge_cells(f"A{row}:{last_col}{row}")
            a.value = data
            a.font, a.alignment = font(9, MUTED, italic=True), Alignment(vertical="center")
        elif kind == "field":
            key, label, lines = data
            band(ws, row, H_LINE * lines)
            a.value = label
            a.font, a.alignment = font(10, MUTED, bold=True), Alignment(vertical="top" if lines > 1 else "center", indent=1)
            ws.merge_cells(f"B{row}:{VALUE_SPAN}{row}")
            for col in "BCDEF":
                c = ws[f"{col}{row}"]
                c.fill, c.border = fill(INPUT), BOX
            b = ws[f"B{row}"]
            b.font, b.alignment = font(11), TOP if lines > 1 else LEFT
            value = SAMPLE_MEETING.get(key, "")
            b.value = value if value != "" else None
            if key == "date":
                b.number_format = "yyyy-mm-dd"
                ws[f"G{row}"].value = "e.g. 2026-10-25"
            elif key == "time":
                b.number_format = "hh:mm"
                ws[f"G{row}"].value = "e.g. 19:00"
            elif key == "attendees":
                b.number_format = "0"
                whole_rule(ws, f"B{row}", "The number of people you expect, e.g. 24.", 100000)
            ws[f"G{row}"].font = font(9, MUTED, italic=True)
        elif kind == "header":
            key, cols = data
            band(ws, row, H_LINE)
            for j, name in enumerate(cols):
                c = ws[f"{MF.COLUMNS[j]}{row}"]
                c.value, c.font, c.fill, c.alignment, c.border = name, font(10, "FFFFFF", bold=True), fill(NAVY), LEFT, BOX
        elif kind == "data":
            head, first, last, cols = tables[data]
            i = row - first
            sample = SAMPLE_PLAN[i] if i < len(SAMPLE_PLAN) else None
            level = sample[0] if sample else ""
            shade = LEVEL_FILL.get(level, PAPER)
            for j in range(len(cols)):
                c = ws[f"{MF.COLUMNS[j]}{row}"]
                c.fill = fill(INPUT if j and not sample else shade) if j else fill(CARD)
                c.border = BOX
                c.font = font(10, NAVY if level == "Frame" else INK, bold=(level == "Frame" and j in (0, 1, 3)))
                c.alignment = (TOP if j in PLAN_LONG else Alignment(horizontal="center", vertical="top") if j == 0
                               else Alignment(vertical="top", indent=1 if j != 3 or level != "Content" else 2))
                if j == 0:
                    c.value = no_formula(first, row)
                elif sample and sample[j - 1] != "":
                    c.value = sample[j - 1]
            h = ws[f"J{row}"]                                     # hidden helper: the Deck type (Dashboard counts)
            h.value = deck_type_formula(first, row)
            if i >= len(SAMPLE_PLAN) + MF.SHOW_BLANK:              # folded away: + opens them
                ws.row_dimensions[row].hidden = True
                ws.row_dimensions[row].outlineLevel = 1
        elif kind == "footer":
            band(ws, row, H_INTRO, CARD)
            ws.merge_cells(f"A{row}:{last_col}{row}")
            a.value = ("Done? Save this file, then in FrameDecks choose Import from Excel (Quick Start, or Settings). "
                       "You see a preview first; nothing changes until you select Import.")
            a.font, a.alignment = font(10, NAVY, bold=True), LEFT
    ws.sheet_format.outlineLevelRow = 1
    ws.sheet_properties.outlinePr.summaryBelow = True

    def col_range(key, letter):
        _h, first, last, _c = tables[key]
        return f"{letter}{first}:{letter}{last}"
    list_rule(ws, LEVELS, col_range("plan", "B"), "Frame (a screen), Deck (a block in it: questions, a verse, text…) or Content (an item in the Deck above).")
    list_rule(ws, DECK_TYPES, col_range("plan", "C"), "For a Deck: what kind of block it is. Leave it empty for a Frame or a Content.")
    list_rule(ws, EFFECTS, col_range("plan", "H"), "Frame: how the screen changes to it. Deck or Content: how it appears.", strict=False)
    ws.column_dimensions["J"].hidden = True
    ws[f"J{tables['plan'][0]}"] = "Deck type (auto)"
    ws[f"J{tables['plan'][0]}"].font = font(9, MUTED)
    ws.freeze_panes = None
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = "1:1"
    first_field = MF.LAYOUT["fields"]["title"]
    ws.sheet_view.selection[0].activeCell = f"B{first_field}"
    ws.sheet_view.selection[0].sqref = f"B{first_field}"
    return ws


# ---------- Dashboard ----------
def dashboard(wb):
    ws = wb.active
    ws.title = MF.DASHBOARD
    ws.sheet_properties.tabColor = GOLD
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 3
    for col in "BCDEFGHIJK":
        ws.column_dimensions[col].width = 13
    ws.column_dimensions["L"].width = 3
    F = "'" + MF.SHEET + "'!"
    fld = {k: f"{F}$B${r}" for k, r in MF.LAYOUT["fields"].items()}
    tb = MF.LAYOUT["tables"]

    def rng(key, letter):
        _h, first, last, _c = tb[key]
        return f"{F}${letter}${first}:${letter}${last}"

    def card(cells, color=CARD):
        for row in ws[cells]:
            for c in row:
                c.fill = fill(color)

    def label(cell, text):
        ws[cell] = text
        ws[cell].font = font(9, GOLD, bold=True)
        ws[cell].alignment = Alignment(vertical="bottom")

    def link(cell, text, target):
        c = ws[cell]
        c.value = text
        c.hyperlink = Hyperlink(ref=cell, location=target, display=text)
        c.font = font(10, NAVY, bold=True, underline="single")
        c.alignment = Alignment(vertical="center", indent=1)

    heights = {1: 12, 2: 30, 3: 24, 4: 12, 5: 12, 6: 18, 7: 30, 8: 24, 9: 24, 10: 24, 11: 18, 12: 18, 13: 36, 14: 18, 15: 18,
               16: 18, 17: 36, 18: 18, 19: 18, 20: 18}
    for r, h in heights.items():
        ws.row_dimensions[r].height = h

    # header: logo, name, status
    logo = ROOT / "assets" / "brand" / "framedecks-logo-icon.png"
    if logo.is_file():
        mark = PILImage.open(logo).convert("RGBA")
        mark.thumbnail((112, 112), PILImage.LANCZOS)        # 2x the 56 px it is shown at: sharp, and a few kilobytes
        buf = io.BytesIO()
        mark.save(buf, "PNG", optimize=True)
        img = Image(buf)
        img.width, img.height = mark.width // 2, mark.height // 2
        ws.add_image(img, "B2")
    ws.merge_cells("C2:H2")
    ws["C2"] = "FrameDecks"
    ws["C2"].font = font(20, NAVY, bold=True)
    ws["C2"].alignment = Alignment(vertical="bottom", indent=1)
    ws.merge_cells("C3:H3")
    ws["C3"] = "Meeting dashboard  ·  fills itself in from the Meeting Form tab"
    ws["C3"].font = font(10, MUTED)
    ws["C3"].alignment = Alignment(vertical="top", indent=1)
    ws.merge_cells("I2:K3")
    d = fld["date"]
    ws["I2"] = (f'=IF(NOT(ISNUMBER({d})),"Add the date",IF(INT({d})>TODAY(),"In "&(INT({d})-TODAY())&" days",'
                f'IF(INT({d})=TODAY(),"Today","Held")))')
    ws["I2"].font, ws["I2"].alignment = font(12, NAVY, bold=True), CENTER
    card("I2:K3", "FFF4D6")
    for col in "BCDEFGHIJK":
        ws[f"{col}4"].border = GOLD_RULE

    # this meeting
    label("B6", "THIS MEETING")
    card("B7:K10")
    ws.merge_cells("B7:H7")
    ws["B7"] = f'=IF({fld["title"]}="","Add the meeting name in the Meeting Form →",{fld["title"]})'
    ws["B7"].font, ws["B7"].alignment = font(16, NAVY, bold=True), Alignment(vertical="center", indent=1)
    ws.merge_cells("B8:E8")
    ws["B8"] = f'=IF(ISNUMBER({d}),{d},IF({d}="","Date not set",{d}))'
    ws["B8"].number_format = "dddd, d mmmm yyyy"
    ws["B8"].font, ws["B8"].alignment = font(11), Alignment(horizontal="left", vertical="center", indent=1)
    ws.merge_cells("F8:H8")
    t = fld["time"]
    ws["F8"] = f'=IF({t}="","",{t})'
    ws["F8"].number_format = "h:mm AM/PM"
    ws["F8"].font, ws["F8"].alignment = font(11), Alignment(horizontal="left", vertical="center")
    ws.merge_cells("B9:H9")
    ws["B9"] = f'=IF({fld["location"]}="","Location not set","📍 "&{fld["location"]})'
    ws.merge_cells("B10:H10")
    ws["B10"] = f'=IF({fld["presenter"]}="","Speaker not set","Speaker: "&{fld["presenter"]}&IF({fld["owner"]}="","","   ·   Presentation: "&{fld["owner"]}))'
    for c in ("B9", "B10"):
        ws[c].font, ws[c].alignment = font(10, MUTED), Alignment(vertical="center", indent=1)
    ws.merge_cells("I7:K9")
    ws["I7"] = f'=IF(ISNUMBER({d}),MAX(0,INT({d})-TODAY()),"–")'
    ws["I7"].font, ws["I7"].alignment = font(28, NAVY, bold=True), CENTER
    ws.merge_cells("I10:K10")
    ws["I10"] = "days to go"
    ws["I10"].font, ws["I10"].alignment = font(9, MUTED), CENTER

    def tiles(row, items):
        for i, (title, formula) in enumerate(items):
            c1, c2 = "BDFHJ"[i], "CEGIK"[i]
            ws.merge_cells(f"{c1}{row}:{c2}{row}")
            ws.merge_cells(f"{c1}{row + 1}:{c2}{row + 1}")
            ws[f"{c1}{row}"] = formula
            ws[f"{c1}{row}"].font, ws[f"{c1}{row}"].alignment = font(22, NAVY, bold=True), CENTER
            ws[f"{c1}{row + 1}"] = title
            ws[f"{c1}{row + 1}"].font, ws[f"{c1}{row + 1}"].alignment = font(9, MUTED), CENTER
            card(f"{c1}{row}:{c2}{row + 1}", PAPER)
            for r in (row, row + 1):
                ws[f"{c1}{r}"].border = Border(left=Side(style="thick", color=GOLD))

    label("B12", "AT A GLANCE")
    att = fld["attendees"]
    lv, ty, kinds = rng("plan", "B"), rng("plan", "C"), rng("plan", "J")
    tiles(13, [("Frames", f'=COUNTIF({lv},"Frame")'),
               ("Decks", f'=COUNTIF({lv},"Deck")'),
               ("Questions", f'=COUNTIFS({lv},"Content",{kinds},"Question")'),
               ("Scriptures", f'=COUNTIFS({lv},"Content",{kinds},"Scripture")'),
               ("Expected attendees", f'=IF({att}="","–",{att})')])

    # the meeting log (rows 40 on) feeds the meeting tiles
    LOG_HEAD, LOG_FIRST, LOG_LAST = 40, 41, 52
    dates, names = f"$B${LOG_FIRST}:$B${LOG_LAST}", f"$C${LOG_FIRST}:$C${LOG_LAST}"
    label("B16", "MEETINGS")
    tiles(17, [("Total meetings", f'=COUNTIF({names},"?*")'),
               ("Upcoming", f'=COUNTIFS({dates},">="&TODAY())'),
               ("Recent (last 30 days)", f'=COUNTIFS({dates},"<"&TODAY(),{dates},">="&TODAY()-30)'),
               ("Ready", '=COUNTIF($C$22:$C$27,"✓")&" / 6"'),
               ("Files to choose", f'=SUM(COUNTIFS({lv},"Deck",{ty},{{"Image","Video","PowerPoint"}}))')])

    # readiness + quick actions
    label("B21", "READINESS")
    label("H21", "QUICK ACTIONS")
    pl = tb["plan"]
    checks = [
        ("Meeting name", f'{fld["title"]}<>""'),
        ("Date set", f"ISNUMBER({d})"),
        ("Speaker named", f'{fld["presenter"]}<>""'),
        ("At least one Frame", f'COUNTIF({lv},"Frame")>0'),
        ("Every Deck has a Type", f'AND(COUNTIF({lv},"Deck")>0,COUNTIFS({lv},"Deck",{ty},"")=0)'),
        ("Presenter script for every Frame", f'AND(COUNTIF({lv},"Frame")>0,COUNTIFS({lv},"Frame",{rng("plan", "I")},"")=0)'),
    ]
    for i, (text, test) in enumerate(checks):
        r = 22 + i
        ws.row_dimensions[r].height = 24
        ws[f"C{r}"] = f'=IF({test},"✓","○")'
        ws[f"C{r}"].font, ws[f"C{r}"].alignment = font(12, "2E7D4F", bold=True), CENTER
        ws.merge_cells(f"D{r}:F{r}")
        ws[f"D{r}"] = text
        ws[f"D{r}"].font, ws[f"D{r}"].alignment = font(10), Alignment(vertical="center")
        card(f"B{r}:F{r}")
    first = MF.LAYOUT["fields"]
    actions = [("Fill in the meeting details →", f"'{MF.SHEET}'!B{first['title']}"),
               ("Speaker and attendees →", f"'{MF.SHEET}'!B{first['presenter']}"),
               ("Plan the Frames →", f"'{MF.SHEET}'!B{pl[1]}"),
               ("Add Decks and Contents →", f"'{MF.SHEET}'!C{pl[1] + 1}"),
               ("Questions and scriptures →", f"'{MF.SHEET}'!E{pl[1] + 8}"),
               ("Log a meeting below →", f"'{MF.DASHBOARD}'!B{LOG_FIRST + 1}")]
    for i, (text, target) in enumerate(actions):
        r = 22 + i
        ws.merge_cells(f"H{r}:K{r}")
        link(f"H{r}", text, target)
        card(f"H{r}:K{r}", PAPER)
        ws[f"H{r}"].border = Border(left=Side(style="thick", color=GOLD))

    # content mix: a small table and its chart
    label("B29", "CONTENT MIX")
    mix = [("Questions", f'=COUNTIFS({lv},"Content",{kinds},"Question")'), ("Scriptures", f'=COUNTIFS({lv},"Content",{kinds},"Scripture")'),
           ("Text and notices", f'=SUM(COUNTIFS({lv},"Deck",{ty},{{"Text","Announcement","Prayer Point","Lower Third"}}))'),
           ("Timers", f'=COUNTIFS({lv},"Deck",{ty},"Timer")'), ("Media", f'=SUM(COUNTIFS({lv},"Deck",{ty},{{"Image","Video","PowerPoint","Camera","Screen"}}))')]
    for i, (name, formula) in enumerate(mix):
        r = 30 + i
        ws.row_dimensions[r].height = 18
        ws.merge_cells(f"I{r}:J{r}")
        ws[f"I{r}"], ws[f"K{r}"] = name, formula
        ws[f"I{r}"].font, ws[f"K{r}"].font = font(10), font(10, NAVY, bold=True)
        ws[f"K{r}"].alignment = CENTER
        card(f"I{r}:K{r}", PAPER if i % 2 else CARD)
    chart = BarChart()
    chart.type, chart.style = "bar", 2
    chart.legend = None
    chart.add_data(Reference(ws, min_col=11, min_row=30, max_row=34), titles_from_data=False)
    chart.set_categories(Reference(ws, min_col=9, min_row=30, max_row=34))
    chart.series[0].graphicalProperties.solidFill = GOLD
    chart.series[0].graphicalProperties.line.solidFill = GOLD
    chart.y_axis.majorGridlines = None
    chart.y_axis.delete = True
    chart.x_axis.delete = False
    chart.height, chart.width = 4.6, 14.5
    ws.add_chart(chart, "B30")

    # recent meetings: this one first, then a row per earlier meeting
    label(f"B{LOG_HEAD - 1}", "RECENT MEETINGS")
    ws.row_dimensions[LOG_HEAD - 1].height = 18
    ws.merge_cells(f"E{LOG_HEAD - 1}:K{LOG_HEAD - 1}")
    ws[f"E{LOG_HEAD - 1}"] = "Add a row after each meeting: the Meetings tiles count them."
    ws[f"E{LOG_HEAD - 1}"].font = font(9, MUTED, italic=True)
    ws[f"E{LOG_HEAD - 1}"].alignment = Alignment(horizontal="right", vertical="bottom")
    heads = [("B", "B", "Date"), ("C", "E", "Meeting"), ("F", "G", "Speaker"), ("H", "H", "Attendees"), ("I", "K", "Notes")]
    for r in range(LOG_HEAD, LOG_LAST + 1):
        ws.row_dimensions[r].height = 24
        for c1, c2, name in heads:
            if c1 != c2:
                ws.merge_cells(f"{c1}{r}:{c2}{r}")
            c = ws[f"{c1}{r}"]
            for col in "BCDEFGHIJK"[("BCDEFGHIJK".index(c1)):("BCDEFGHIJK".index(c2) + 1)]:
                ws[f"{col}{r}"].border = BOX
                ws[f"{col}{r}"].fill = fill(NAVY if r == LOG_HEAD else (PAPER if r % 2 else CARD))
            if r == LOG_HEAD:
                c.value, c.font = name, font(10, "FFFFFF", bold=True)
            else:
                c.font = font(10)
            c.alignment = Alignment(vertical="center", indent=1)
        ws[f"B{r}"].number_format = "yyyy-mm-dd"
        ws[f"B{r}"].alignment = CENTER
    ws[f"B{LOG_FIRST}"] = f'=IF(ISNUMBER({d}),{d},"")'
    ws[f"C{LOG_FIRST}"] = f'=IF({fld["title"]}="","",{fld["title"]})'
    ws[f"F{LOG_FIRST}"] = f'=IF({fld["presenter"]}="","",{fld["presenter"]})'
    ws[f"H{LOG_FIRST}"] = f'=IF({att}="","",{att})'
    ws[f"I{LOG_FIRST}"] = "This meeting (from the Meeting Form)"
    ws[f"I{LOG_FIRST}"].font = font(9, MUTED, italic=True)

    r = LOG_LAST + 2
    ws.row_dimensions[r].height = 30
    ws.merge_cells(f"B{r}:K{r}")
    ws[f"B{r}"] = ("How it works: plan everything on the Meeting Form tab, save, then in FrameDecks choose "
                   "Import from Excel (Quick Start, or Settings).   This Dashboard is never imported.")
    ws[f"B{r}"].font, ws[f"B{r}"].alignment = font(9, MUTED), LEFT
    card(f"B{r}:K{r}")
    ws.page_setup.orientation = "portrait"
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    return ws


def main():
    wb = Workbook()
    wb.properties.creator = wb.properties.lastModifiedBy = "FrameDecks"
    wb.properties.title = "FrameDecks Meeting Workbook"
    dashboard(wb)
    meeting_form(wb)
    wb.active = 1                    # opens on the Meeting Form: that is where the work happens
    wb[MF.DASHBOARD].sheet_view.tabSelected = False
    wb.calculation.fullCalcOnLoad = True
    out = ROOT / "app" / "templates" / "FRAMEDECKS-Meeting-Workbook.xlsx"
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    print("Wrote", out)


if __name__ == "__main__":
    main()
