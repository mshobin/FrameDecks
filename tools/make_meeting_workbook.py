"""Writes the Kingdom Connect Meeting Workbook template (five sheets, sample rows, drop-down lists and checks).

    python3 tools/make_meeting_workbook.py

Output: app/templates/Kingdom-Connect-Meeting-Workbook.xlsx (downloaded from the app: Meeting → Download the Excel
template) and a copy in docs/templates/. The column names and allowed values must match app/js/meeting-book.js;
tests/meeting-workbook.test.js checks that the template imports without errors.
"""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
CONTENT_TYPES = ["Question", "Scripture", "Text", "Image", "Video", "Audio", "Timer", "PowerPoint", "Web Page", "Free Content",
                 "Announcement", "Prayer Point", "Lower Third", "Birthday", "Branding", "Camera", "Screen"]
BACKGROUNDS = ["None", "Navy", "Black", "White", "Brand"]
TRANSITIONS = ["Frame default", "Cut", "Fade", "Cross Dissolve", "Dip to Black", "Dip to White", "Slide Left", "Slide Right", "Push",
               "Zoom Fade", "Soft Scale", "Cinema Fade"]
ANIMATIONS = ["Content default", "Fade", "Gentle Rise", "Word by Word", "Typewriter", "Burst", "Cut"]
PPT_BG = ["Show", "Hide"]

NAVY, GOLD = "0F1F3D", "E3B75A"
HEAD = Font(bold=True, color="FFFFFF")
HEAD_FILL = PatternFill("solid", fgColor=NAVY)
WRAP = Alignment(wrap_text=True, vertical="top")

SHEETS = {
    "Meeting Overview": (["Field", "Value"], [18, 70], [
        ["Meeting Title", "Romans · Week 5"], ["Date", "2026-10-25"], ["Presenter", "Your name"],
        ["Notes", "Anything the team should know about this meeting."]]),
    "Frames": (["Frame Number", "Frame Name", "Description", "Background", "Transition", "Teleprompter Script"], [14, 26, 40, 14, 16, 50], [
        [1, "Welcome", "People arrive and settle in", "Navy", "Fade", "Greet people by name as they join."],
        [2, "Worship", "Opening song", "None", "Frame default", "Song lyrics are on the shared screen."],
        [3, "Scripture Reading", "Romans 8:1-4", "None", "Cross Dissolve", "Ask a volunteer to read."],
        [4, "Questions", "Small-group discussion", "None", "Fade", "Allow 10 minutes per question."],
        [5, "Lesson Slides", "This week's teaching slides", "None", "Fade", "Open the PowerPoint first."],
        [6, "Closing", "Prayer and goodbye", "Navy", "Dip to Black", "Thank everyone for coming."]]),
    "Content": (["Frame Number", "Content Order", "Content Type", "Content Name", "Main Content", "Label", "Duration", "Animation",
                 "PowerPoint Background Visibility", "Notes"], [14, 14, 16, 22, 50, 24, 10, 16, 24, 36], [
        [1, 1, "Text", "Welcome message", "Welcome! We begin in just a moment.", "Welcome", "", "Fade", "", ""],
        [1, 2, "Timer", "Countdown", "", "Starting in", 5, "", "", "Five-minute countdown"],
        [2, 1, "Free Content", "Song", "Announcement: Please join in the opening song.", "Worship", "", "Gentle Rise", "", ""],
        [3, 1, "Scripture", "Reading", "", "Focus Verse", "", "Gentle Rise", "", "The scriptures are on the Scriptures sheet."],
        [4, 1, "Question", "Discussion", "", "Discussion Question", "", "Fade", "", "The questions are on the Questions sheet."],
        [5, 1, "PowerPoint", "Lesson", "Romans Week 5.pptx", "", "", "", "Show", "Choose the file in the app after the import."],
        [6, 1, "Prayer Point", "Closing prayer", "Let’s close our time together in prayer.", "Closing Prayer", "", "Fade", "", ""],
        [6, 2, "Lower Third", "Goodbye", "See you next week", "Thank you for joining!", "", "Gentle Rise", "", ""]]),
    "Questions": (["Frame Number", "Content Name", "Question Number", "Label", "Question Text", "Media", "Timer", "Animation"],
                  [14, 20, 16, 22, 70, 16, 8, 16], [
        [4, "Discussion", 1, "Question 1", "What does “no condemnation” mean for you this week?", "", 3, "Fade"],
        [4, "Discussion", 2, "Question 2", "How does the Spirit help us live differently?", "", 3, "Word by Word"],
        [4, "Discussion", 3, "Question 3", "What is one step you will take before we meet again?", "", "", "Fade"]]),
    "Scriptures": (["Frame Number", "Content Name", "Scripture Number", "Label", "Reference", "Text", "Translation", "Animation"],
                   [14, 20, 16, 22, 20, 70, 12, 16], [
        [3, "Reading", 1, "Focus Verse", "Romans 8:1", "There is therefore now no condemnation for those who are in Christ Jesus.", "ESV", "Gentle Rise"],
        [3, "Reading", 2, "Read together", "Romans 8:2", "For the law of the Spirit of life has set you free in Christ Jesus from the law of sin and death.", "ESV", ""]]),
}
READ_ME = [
    "Kingdom Connect · Meeting Workbook",
    "",
    "Excel is optional: you can build a whole meeting in Kingdom Connect without it. Use this workbook to plan a meeting, review it with others,",
    "hand it over to another leader, or edit many Frames at once. After you import it, Kingdom Connect is the source of truth.",
    "",
    "1. Meeting Overview: the meeting title, date, presenter and notes.",
    "2. Frames: one row per Frame (one screen or one step of your meeting), numbered 1, 2, 3…",
    "   Teleprompter Script: what the presenter says during this Frame. Only the presenter sees it (Teleprompter); it is never on screen.",
    "3. Content: one row per piece of Content inside a Frame. Frame Number says which Frame; Content Order says the order inside it.",
    "   Content Types: Question, Scripture, Text, Image, Video, Timer, PowerPoint, Free Content (Audio and Web Page are planned, not yet available).",
    "   Free Content: write its kind first in Main Content, e.g. “Announcement: …”, or use the kind as the Content Type (Prayer Point, Lower Third…).",
    "   Timer: Duration in minutes (5) or a time of day (10:30). PowerPoint: Main Content is the file name; choose the file in the app after the import.",
    "   PowerPoint Background Visibility: Hide shows only the objects of the slide (a plain-colour slide background becomes see-through).",
    "4. Questions: the questions of a Question Content (same Frame Number and Content Name), in Question Number order. Labels are per question.",
    "5. Scriptures: the scriptures of a Scripture Content. Leave Text empty to fetch it from the ESV (needs an ESV key in Settings → Scripture).",
    "",
    "Import: Kingdom Connect → Meeting → Import meeting from Excel… You see a preview with every problem and its sheet and row first;",
    "nothing changes until you select Import, and Undo is offered afterwards.",
    "Export: Meeting → Export this meeting to Excel gives you the same workbook, filled in, to share or edit.",
    "Allowed values have drop-down lists; they are also on the Lists sheet.",
]


def head(ws, names, widths):
    ws.append(names)
    for i, c in enumerate(ws[1]):
        c.font, c.fill = HEAD, HEAD_FILL
        ws.column_dimensions[c.column_letter].width = widths[i]
    ws.freeze_panes = "A2"


def dropdown(ws, col, source, prompt):
    dv = DataValidation(type="list", formula1=source, allow_blank=True, showErrorMessage=True,
                        errorTitle="Choose from the list", error=prompt, promptTitle="Allowed values", prompt=prompt)
    ws.add_data_validation(dv)
    dv.add(f"{col}2:{col}1000")


def whole(ws, col, prompt):
    dv = DataValidation(type="whole", operator="between", formula1="1", formula2="9999", allow_blank=True, showErrorMessage=True,
                        errorTitle="Whole number", error=prompt)
    ws.add_data_validation(dv)
    dv.add(f"{col}2:{col}1000")


def main():
    wb = Workbook()
    rm = wb.active
    rm.title = "Read Me"
    for line in READ_ME:
        rm.append([line])
    rm["A1"].font = Font(bold=True, size=14, color=NAVY)
    rm.column_dimensions["A"].width = 140
    for name, (cols, widths, rows) in SHEETS.items():
        ws = wb.create_sheet(name)
        head(ws, cols, widths)
        for r in rows:
            ws.append(r)
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.alignment = WRAP
    lists = wb.create_sheet("Lists")
    columns = [("Content Type", CONTENT_TYPES), ("Background", BACKGROUNDS), ("Transition", TRANSITIONS), ("Animation", ANIMATIONS),
               ("PowerPoint Background", PPT_BG)]
    head(lists, [c[0] for c in columns], [18, 14, 18, 18, 22])
    for i in range(max(len(c[1]) for c in columns)):
        lists.append([c[1][i] if i < len(c[1]) else None for c in columns])
    ref = {name: f"Lists!${chr(65 + i)}$2:${chr(65 + i)}${len(vals) + 1}" for i, (name, vals) in enumerate(columns)}
    f, c, q, s = wb["Frames"], wb["Content"], wb["Questions"], wb["Scriptures"]
    whole(f, "A", "Number the Frames 1, 2, 3…")
    dropdown(f, "D", ref["Background"], "None, Navy, Black, White or Brand (or type a colour like #1F3A6D).")
    dropdown(f, "E", ref["Transition"], "How the screen changes to this Frame.")
    whole(c, "A", "The Frame Number from the Frames sheet.")
    whole(c, "B", "1 = first in the Frame.")
    dropdown(c, "C", ref["Content Type"], "The kind of Content.")
    dropdown(c, "H", ref["Animation"], "How the Content appears.")
    dropdown(c, "I", ref["PowerPoint Background"], "Show = the whole slide. Hide = only the slide's objects.")
    for ws in (q, s):
        whole(ws, "A", "The Frame Number from the Frames sheet.")
        whole(ws, "C", "1 = first.")
    dropdown(q, "H", ref["Animation"], "How the question appears.")
    dropdown(s, "H", ref["Animation"], "How the scripture appears.")
    # Frames' background accepts colours too: show the list but allow other values
    for dv in f.data_validations.dataValidation:
        if dv.sqref and "D2" in str(dv.sqref):
            dv.showErrorMessage = False
    out = ROOT / "app" / "templates" / "Kingdom-Connect-Meeting-Workbook.xlsx"
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    docs = ROOT / "docs" / "templates" / out.name
    docs.parent.mkdir(parents=True, exist_ok=True)
    docs.write_bytes(out.read_bytes())
    print("Wrote", out, "and", docs)


if __name__ == "__main__":
    main()
