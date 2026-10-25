"""Writes the FRAMEDECKS Meeting Workbook template (6.9): two tabs, Dashboard and Meeting Form.

    python3 tools/make_meeting_workbook.py

Meeting Form: one guided page, top to bottom (the layout is in meeting_form.py, which also fills the form for "Export
this meeting to Excel"). Dashboard: a summary of the form made only by formulas: this meeting, KPI tiles, readiness,
quick links into the form, the content mix and a log of recent meetings. Nothing on the Dashboard is imported.

Output: app/templates/FRAMEDECKS-Meeting-Workbook.xlsx (downloaded from the app: Meeting → Download the Excel
template) and a copy in docs/templates/. The column names and allowed values must match app/js/meeting-book.js;
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
sys.path.insert(0, str(ROOT))
import meeting_form as MF  # noqa: E402

CONTENT_TYPES = ["Question", "Scripture", "Text", "Image", "Video", "Timer", "PowerPoint", "Free Content",
                 "Announcement", "Prayer Point", "Lower Third", "Birthday", "Branding", "Camera", "Screen"]
BACKGROUNDS = ["None", "Navy", "Black", "White", "Brand"]
TRANSITIONS = ["Frame default", "Cut", "Fade", "Cross Dissolve", "Dip to Black", "Dip to White", "Slide Left", "Slide Right", "Push",
               "Zoom Fade", "Soft Scale", "Cinema Fade"]
ANIMATIONS = ["Content default", "Fade", "Gentle Rise", "Word by Word", "Typewriter", "Burst", "Cut"]
PPT_BG = ["Show", "Hide"]

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
    "title": "Romans · Week 5", "date": datetime.date(2026, 10, 25), "time": datetime.time(19, 0),
    "location": "Fellowship Hall, or paste the Zoom / Teams link", "notes": "Anything the team should know about this meeting.",
    "presenter": "Your name", "contact": "name@example.com · 555 0100", "attendees": 24,
    "attendeeNotes": "Two newcomers expected: welcome them by name.", "owner": "Your name",
    "contentNotes": "Slides from the Romans series; the countdown starts five minutes before.", "extra": "",
}
SAMPLE_TABLES = {
    "frames": [
        [1, "Welcome", "People arrive and settle in", "Navy", "Fade", "Greet people by name as they join."],
        [2, "Worship", "Opening song", "None", "Frame default", "Song lyrics are on the shared screen."],
        [3, "Scripture Reading", "Romans 8:1-4", "None", "Cross Dissolve", "Ask a volunteer to read."],
        [4, "Questions", "Small-group discussion", "None", "Fade", "Allow 10 minutes per question."],
        [5, "Lesson Slides", "This week's teaching slides", "None", "Fade", "Open the PowerPoint first."],
        [6, "Closing", "Prayer and goodbye", "Navy", "Dip to Black", "Thank everyone for coming."]],
    "content": [
        [1, 1, "Text", "Welcome message", "Welcome! We begin in just a moment.", "Welcome", "", "Fade", "", ""],
        [1, 2, "Timer", "Countdown", "", "Starting in", 5, "", "", "Five-minute countdown"],
        [2, 1, "Free Content", "Song", "Announcement: Please join in the opening song.", "Worship", "", "Gentle Rise", "", ""],
        [3, 1, "Scripture", "Reading", "", "Focus Verse", "", "Gentle Rise", "", "The scriptures are in Scripture readings below."],
        [4, 1, "Question", "Discussion", "", "Discussion Question", "", "Fade", "", "The questions are in Discussion questions below."],
        [5, 1, "PowerPoint", "Lesson", "Romans Week 5.pptx", "", "", "", "Show", "Choose the file in the app after the import."],
        [6, 1, "Prayer Point", "Closing prayer", "Let’s close our time together in prayer.", "Closing Prayer", "", "Fade", "", ""],
        [6, 2, "Lower Third", "Goodbye", "See you next week", "Thank you for joining!", "", "Gentle Rise", "", ""]],
    "questions": [
        [4, "Discussion", 1, "Question 1", "What does “no condemnation” mean for you this week?", "", 3, "Fade"],
        [4, "Discussion", 2, "Question 2", "How does the Spirit help us live differently?", "", 3, "Word by Word"],
        [4, "Discussion", 3, "Question 3", "What is one step you will take before we meet again?", "", "", "Fade"]],
    "scriptures": [
        [3, "Reading", 1, "Focus Verse", "Romans 8:1", "There is therefore now no condemnation for those who are in Christ Jesus.", "ESV", "Gentle Rise"],
        [3, "Reading", 2, "Read together", "Romans 8:2", "For the law of the Spirit of life has set you free in Christ Jesus from the law of sin and death.", "ESV", ""]],
}
FORM_WIDTHS = [22, 14, 18, 22, 44, 26, 14, 16, 15, 30]
LONG = {"frames": {2, 5}, "content": {4, 9}, "questions": {4}, "scriptures": {5}}   # columns that wrap long text
NUMBERS = {"frames": {0}, "content": {0, 1, 6}, "questions": {0, 2, 6}, "scriptures": {0, 2}}   # centred number columns
VALUE_SPAN = "F"             # a detail's box: B..F


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
            a.value = "FRAMEDECKS   ·   Meeting Form"
            a.font, a.alignment = font(18, "FFFFFF", bold=True), Alignment(vertical="center", indent=1)
        elif kind == "intro":
            band(ws, row, H_INTRO, CARD)
            ws.merge_cells(f"A{row}:{last_col}{row}")
            a.value = ("Work down the page and fill in the cream boxes (Tab moves to the next one). Each table opens more rows "
                       "with the + button on the left. Then, in FRAMEDECKS: Meeting → Import meeting from Excel…")
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
            sample = SAMPLE_TABLES[data]
            for j in range(len(cols)):
                c = ws[f"{MF.COLUMNS[j]}{row}"]
                c.fill = fill(PAPER if i % 2 == 0 else CARD)
                c.border, c.font = BOX, font(10)
                c.alignment = (TOP if j in LONG[data] else Alignment(horizontal="center", vertical="top") if j in NUMBERS[data]
                               else Alignment(vertical="top", indent=1))
                if i < len(sample) and sample[i][j] != "":
                    c.value = sample[i][j]
            if i >= len(sample) + MF.SHOW_BLANK:                      # folded away: + opens them
                ws.row_dimensions[row].hidden = True
                ws.row_dimensions[row].outlineLevel = 1
        elif kind == "footer":
            band(ws, row, H_INTRO, CARD)
            ws.merge_cells(f"A{row}:{last_col}{row}")
            a.value = ("Done? Save this file, then in FRAMEDECKS choose Meeting → Import meeting from Excel… "
                       "You see a preview first; nothing changes until you select Import.")
            a.font, a.alignment = font(10, NAVY, bold=True), LEFT
    ws.sheet_format.outlineLevelRow = 1
    ws.sheet_properties.outlinePr.summaryBelow = True

    def col_range(key, letter):
        _h, first, last, _c = tables[key]
        return f"{letter}{first}:{letter}{last}"
    for key in tables:
        whole_rule(ws, col_range(key, "A"), "The Frame number from the Frames table: 1, 2, 3…")
    list_rule(ws, BACKGROUNDS, col_range("frames", "D"), "None, Navy, Black, White or Brand (or type a colour like #1F3A6D).", strict=False)
    list_rule(ws, TRANSITIONS, col_range("frames", "E"), "How the screen changes to this Frame.")
    whole_rule(ws, col_range("content", "B"), "1 = first in the Frame.")
    list_rule(ws, CONTENT_TYPES, col_range("content", "C"), "The kind of Content.")
    list_rule(ws, ANIMATIONS, f"{col_range('content', 'H')} {col_range('questions', 'H')} {col_range('scriptures', 'H')}", "How it appears.")
    list_rule(ws, PPT_BG, col_range("content", "I"), "Show = the whole slide. Hide = only the slide's objects.")
    whole_rule(ws, f"{col_range('questions', 'C')} {col_range('scriptures', 'C')}", "1 = first.")
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
    logo = ROOT / "assets" / "brand" / "kc-mark.png"
    if logo.is_file():
        mark = PILImage.open(logo).convert("RGBA")
        mark.thumbnail((112, 112), PILImage.LANCZOS)        # 2x the 56 px it is shown at: sharp, and a few kilobytes
        buf = io.BytesIO()
        mark.save(buf, "PNG", optimize=True)
        img = Image(buf)
        img.width, img.height = mark.width // 2, mark.height // 2
        ws.add_image(img, "B2")
    ws.merge_cells("C2:H2")
    ws["C2"] = "FRAMEDECKS"
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
    tiles(13, [("Frames", f'=COUNTIF({rng("frames", "B")},"?*")'),
               ("Content items", f'=COUNTIF({rng("content", "C")},"?*")'),
               ("Questions", f'=COUNTIF({rng("questions", "E")},"?*")'),
               ("Scriptures", f'=COUNTIF({rng("scriptures", "E")},"?*")'),
               ("Expected attendees", f'=IF({att}="","–",{att})')])

    # the meeting log (rows 40 on) feeds the meeting tiles
    LOG_HEAD, LOG_FIRST, LOG_LAST = 40, 41, 52
    dates, names = f"$B${LOG_FIRST}:$B${LOG_LAST}", f"$C${LOG_FIRST}:$C${LOG_LAST}"
    label("B16", "MEETINGS")
    tiles(17, [("Total meetings", f'=COUNTIF({names},"?*")'),
               ("Upcoming", f'=COUNTIFS({dates},">="&TODAY())'),
               ("Recent (last 30 days)", f'=COUNTIFS({dates},"<"&TODAY(),{dates},">="&TODAY()-30)'),
               ("Ready", '=COUNTIF($C$22:$C$27,"✓")&" / 6"'),
               ("Files to choose", f'=SUM(COUNTIF({rng("content", "C")},{{"Image","Video","PowerPoint"}}))')])

    # readiness + quick actions
    label("B21", "READINESS")
    label("H21", "QUICK ACTIONS")
    fr, ct = tb["frames"], tb["content"]
    frame_nums, content_frames = rng("frames", "A"), rng("content", "A")
    checks = [
        ("Meeting name", f'{fld["title"]}<>""'),
        ("Date set", f"ISNUMBER({d})"),
        ("Speaker named", f'{fld["presenter"]}<>""'),
        ("At least one Frame", f'COUNTIF({rng("frames", "B")},"?*")>0'),
        ("Every Frame has content", f'AND(COUNT({frame_nums})>0,SUMPRODUCT(({frame_nums}<>"")*(COUNTIF({content_frames},{frame_nums})=0))=0)'),
        ("Presenter script for every Frame", f'AND(COUNTIF({rng("frames", "B")},"?*")>0,COUNTIF({rng("frames", "F")},"?*")>=COUNTIF({rng("frames", "B")},"?*"))'),
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
               ("Plan the Frames →", f"'{MF.SHEET}'!B{fr[1]}"),
               ("Add the content →", f"'{MF.SHEET}'!C{ct[1]}"),
               ("Questions and scriptures →", f"'{MF.SHEET}'!E{tb['questions'][1]}"),
               ("Log a meeting below →", f"'{MF.DASHBOARD}'!B{LOG_FIRST + 1}")]
    for i, (text, target) in enumerate(actions):
        r = 22 + i
        ws.merge_cells(f"H{r}:K{r}")
        link(f"H{r}", text, target)
        card(f"H{r}:K{r}", PAPER)
        ws[f"H{r}"].border = Border(left=Side(style="thick", color=GOLD))

    # content mix: a small table and its chart
    label("B29", "CONTENT MIX")
    types = rng("content", "C")
    mix = [("Questions", f'=COUNTIF({types},"Question")'), ("Scriptures", f'=COUNTIF({types},"Scripture")'),
           ("Text and notices", f'=SUM(COUNTIF({types},{{"Text","Free Content","Announcement","Prayer Point","Lower Third"}}))'),
           ("Timers", f'=COUNTIF({types},"Timer")'), ("Media", f'=SUM(COUNTIF({types},{{"Image","Video","PowerPoint","Camera","Screen"}}))')]
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
    ws[f"B{r}"] = ("How it works: plan everything on the Meeting Form tab, save, then in FRAMEDECKS choose "
                   "Meeting → Import meeting from Excel…   This Dashboard is never imported.")
    ws[f"B{r}"].font, ws[f"B{r}"].alignment = font(9, MUTED), LEFT
    card(f"B{r}:K{r}")
    ws.page_setup.orientation = "portrait"
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    return ws


def main():
    wb = Workbook()
    wb.properties.creator = wb.properties.lastModifiedBy = "FRAMEDECKS"
    wb.properties.title = "FRAMEDECKS Meeting Workbook"
    dashboard(wb)
    meeting_form(wb)
    wb.active = 1                    # opens on the Meeting Form: that is where the work happens
    wb[MF.DASHBOARD].sheet_view.tabSelected = False
    wb.calculation.fullCalcOnLoad = True
    out = ROOT / "app" / "templates" / "FRAMEDECKS-Meeting-Workbook.xlsx"
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    docs = ROOT / "docs" / "templates" / out.name
    docs.parent.mkdir(parents=True, exist_ok=True)
    docs.write_bytes(out.read_bytes())
    print("Wrote", out, "and", docs)


if __name__ == "__main__":
    main()
