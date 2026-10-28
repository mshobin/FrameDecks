"""FrameDecks - the service as a PowerPoint file (M-D4 in docs/project/history/migration-plan.md).

build(plan, media_folder) -> bytes of a .pptx: a title slide, then one slide per Frame in plan order (templates
left out), in the FrameDecks navy and gold:
  - the Frame's name as the slide title;
  - its words: scripture (reference and text), questions, announcement / prayer / text Content;
  - its pictures from this PC's media folder; videos and PDFs by name;
  - the Teleprompter script as the speaker notes.
Everything stays editable in PowerPoint. Made on this PC; nothing is uploaded. Uses python-pptx (MIT), loaded only
when someone exports.
"""
import io
import re
from datetime import date
from pathlib import Path

NAVY, GOLD, WHITE, SOFT = "0C1426", "E3B75A", "EAEEF6", "AAB5CA"
WIDTH_IN, HEIGHT_IN = 13.333, 7.5
PICTURE_KINDS = (".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp")


def _clean(text, limit=4000):
    return re.sub(r"[ \t]+", " ", re.sub(r"[\u0000-\u0008\u000B\u000C\u000E-\u001F]", "", str(text or ""))).strip()[:limit]


def frame_parts(frame):
    """What a Frame says, in Content order: [("verse", ref, text) | ("question", text) | ("text", title, text) |
    ("picture", file) | ("media", kind, file)]."""
    out = []
    for layer in frame.get("layers") or []:
        if not isinstance(layer, dict):
            continue
        kind, c = layer.get("kind"), layer.get("c") if isinstance(layer.get("c"), dict) else {}
        items = [i for i in c.get("items") or [] if isinstance(i, dict)]
        if kind == "scripture":
            for it in items:
                ref = _clean(" ".join(x for x in (it.get("ref"), it.get("version")) if x), 120)
                if ref or _clean(it.get("text")):
                    out.append(("verse", ref, _clean(it.get("text"))))
        elif kind == "question":
            out += [("question", _clean(it.get("text"), 600)) for it in items if _clean(it.get("text"))]
        elif kind == "image" and c.get("file"):
            out.append(("picture", str(c["file"])))
        elif kind in ("video", "pdf", "audio") and c.get("file"):
            out.append(("media", kind, str(c["file"])))
        elif kind == "text":
            t = _clean((c.get("props") or {}).get("text"))
            if t:
                out.append(("text", "", t))
        elif isinstance(c.get("text"), str) or isinstance(c.get("title"), str):
            title, text = _clean(c.get("title"), 120), _clean(c.get("text"))
            if text:
                out.append(("text", title, text))
    return out


def build(plan, media_folder, today=None):
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.util import Inches, Pt

    def rgb(hex_):
        return RGBColor.from_string(hex_)

    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(WIDTH_IN), Inches(HEIGHT_IN)
    blank = prs.slide_layouts[6]
    media_folder = Path(media_folder)

    def slide():
        s = prs.slides.add_slide(blank)
        s.background.fill.solid()
        s.background.fill.fore_color.rgb = rgb(NAVY)
        return s

    def box(s, x, y, w, h):
        tf = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)).text_frame
        tf.word_wrap = True
        return tf

    def para(tf, text, size, colour, bold=False, first=False, space=6):
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        p.space_after = Pt(space)
        r = p.add_run()
        r.text = text
        r.font.size, r.font.bold, r.font.color.rgb = Pt(size), bold, rgb(colour)
        return p

    meeting = plan.get("meeting") if isinstance(plan.get("meeting"), dict) else {}
    brand = plan.get("brand") if isinstance(plan.get("brand"), dict) else {}
    title = _clean(meeting.get("title") or brand.get("meeting") or "Service", 120)
    when = _clean(meeting.get("date"), 40) or (today or date.today()).isoformat()
    s = slide()
    tf = box(s, 0.9, 2.4, WIDTH_IN - 1.8, 2.6)
    para(tf, title, 44, GOLD, True, first=True)
    para(tf, " · ".join(x for x in (when, _clean(meeting.get("presenter"), 80)) if x), 20, SOFT)

    frames = [f for f in plan.get("scenes") or [] if isinstance(f, dict) and not f.get("tpl")]
    for n, frame in enumerate(frames, 1):
        s = slide()
        head = box(s, 0.7, 0.4, WIDTH_IN - 1.4, 1.0)
        para(head, _clean(frame.get("name"), 120) or f"Frame {n}", 32, GOLD, True, first=True)
        parts = frame_parts(frame)
        pictures = [p[1] for p in parts if p[0] == "picture" and (media_folder / p[1]).suffix.lower() in PICTURE_KINDS
                    and (media_folder / p[1]).is_file()]
        text_w = WIDTH_IN - 1.4 if not pictures else 6.6
        body = box(s, 0.7, 1.5, text_w, HEIGHT_IN - 2.0)
        first = True
        for p in parts:
            if p[0] == "verse":
                if p[1]:
                    para(body, p[1], 16, GOLD, True, first=first, space=2)
                    first = False
                if p[2]:
                    para(body, p[2], 20, WHITE, first=first, space=14)
            elif p[0] == "question":
                para(body, "• " + p[1], 20, WHITE, first=first, space=10)
            elif p[0] == "text":
                if p[1]:
                    para(body, p[1], 16, GOLD, True, first=first, space=2)
                    first = False
                para(body, p[2], 20, WHITE, first=first, space=12)
            elif p[0] == "media" or (p[0] == "picture" and p[1] not in pictures):
                label = {"video": "Video", "pdf": "PDF", "audio": "Audio", "picture": "Picture"}[p[1] if p[0] == "media" else "picture"]
                para(body, f"{label}: {p[-1]} (on the service PC)", 14, SOFT, first=first, space=8)
            else:
                continue
            first = False
        alone = first                                 # no words: the picture gets the whole slide
        for i, file in enumerate(pictures[:1] if alone else pictures[:2]):
            try:
                if alone:
                    from PIL import Image
                    with Image.open(media_folder / file) as im:
                        w, h = im.size
                    k = min((WIDTH_IN - 1.4) / w, (HEIGHT_IN - 2.0) / h)
                    s.shapes.add_picture(str(media_folder / file), Inches((WIDTH_IN - w * k) / 2), Inches(1.5),
                                         Inches(w * k), Inches(h * k))
                else:
                    s.shapes.add_picture(str(media_folder / file), Inches(7.6), Inches(1.5 + i * 2.9), width=Inches(5.0))
            except Exception:                         # an unreadable picture never stops the export
                para(body, f"Picture: {file} (could not be read)", 14, SOFT, first=first)
                first = False
        notes = _clean(frame.get("notes"), 20000)
        if notes:
            s.notes_slide.notes_text_frame.text = notes
    out = io.BytesIO()
    prs.save(out)
    return out.getvalue(), len(frames)


def file_name(plan):
    meeting = plan.get("meeting") if isinstance(plan.get("meeting"), dict) else {}
    brand = plan.get("brand") if isinstance(plan.get("brand"), dict) else {}
    name = re.sub(r"[^\w\- ]+", "", str(meeting.get("title") or brand.get("meeting") or "Service")).strip() or "Service"
    return f"{name} - {date.today().isoformat()}.pptx"
