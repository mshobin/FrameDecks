"""FrameDecks 26.11.45 - PowerPoint slides you can see all at once, search, reorder and present from.

A .pptx added as Content becomes a PDF (made by the PowerPoint on this PC, vcam/powerpoint.py) that the camera draws a
page at a time. This module knows what is on each slide:

  * info(): every slide's title, text and speaker notes (read from the .pptx itself when it is the source, else the
    PDF's text), the Bible references on it (scripture_speech.find_all), cached beside the deck in Content/.slides
    and read again only when the file changes;
  * thumb(): a small JPEG of one slide for the overview, the Teleprompter's presenter view and members' phones,
    rendered once per size;
  * sequence() / step(): the run order of a deck in this meeting (slides hidden or moved for this meeting only,
    the file itself untouched) and moving through it.

Nothing here runs unless a deck is opened; it reads only files in the Content folder."""
import json
import re
import threading
import zipfile
from pathlib import PurePosixPath
from xml.etree import ElementTree as ET

META = ".slides"                 # Content/.slides: what each deck holds and its thumbnails
MAX_SLIDES = 400
TEXT_MAX, NOTES_MAX, TITLE_MAX = 1200, 4000, 120
THUMB_WIDTHS = (160, 320, 480, 960)
_LOCK = threading.Lock()

NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
NOTES_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"


def _clean(s, n):
    return re.sub(r"[ \t\r\f\v]+", " ", re.sub(r"\n\s*\n+", "\n", str(s or ""))).strip()[:n]


def _name_ok(name):
    from media_names import safe_name
    n = safe_name(name)
    return n if n and n == name else ""


# ---------- reading a .pptx (a zip of XML): slide order, text, titles, notes ----------
def _xml(z, name, limit=4 << 20):
    info = z.getinfo(name)
    if info.file_size > limit:                     # a slide's XML is small; anything this big is not a slide
        raise ValueError("Slide part too large")
    return ET.fromstring(z.read(name))


def _rels(z, part):
    """Relationship id -> target path (resolved against the part's folder) for one part of the package."""
    p = PurePosixPath(part)
    rel = str(p.parent / "_rels" / (p.name + ".rels"))
    if rel not in z.namelist():
        return {}
    out = {}
    for r in _xml(z, rel).findall("rel:Relationship", NS):
        target = r.get("Target") or ""
        full = str(PurePosixPath(*(list((p.parent / target).parts)))) if not target.startswith("/") else target.lstrip("/")
        parts = []
        for seg in PurePosixPath(full).parts:            # resolve "..": ppt/slides/../notesSlides -> ppt/notesSlides
            if seg == "..":
                if parts:
                    parts.pop()
            elif seg != ".":
                parts.append(seg)
        out[r.get("Id")] = ("/".join(parts), r.get("Type") or "")
    return out


def _shape_texts(root, skip_types=()):
    """[(placeholder type, text)] for each shape on a slide, paragraphs joined with new lines."""
    out = []
    for sp in root.iter("{%s}sp" % NS["p"]):
        ph = sp.find(".//p:nvPr/p:ph", NS)
        kind = (ph.get("type") or "body") if ph is not None else ""
        if kind in skip_types:
            continue
        paras = []
        for para in sp.iter("{%s}p" % NS["a"]):
            t = "".join(x.text or "" for x in para.iter("{%s}t" % NS["a"]))
            if t.strip():
                paras.append(t.strip())
        if paras:
            out.append((kind, "\n".join(paras)))
    return out


def animation_of(root):
    """26.11.46 the animations of one slide: {clicks, auto, transition}. clicks = the presses of Next that play
    an effect before the next slide (PowerPoint's main sequence: each "On click" effect); auto = effects that play by
    themselves (With / After previous on entry); transition = the slide has an entry transition. Triggered effects
    (start when a shape is clicked) are left out: a clicker never plays them."""
    clicks = auto = 0
    timing = root.find("p:timing", NS)
    if timing is not None:
        for seq in timing.iter("{%s}seq" % NS["p"]):
            ctn = seq.find("p:cTn", NS)
            if ctn is None or ctn.get("nodeType") != "mainSeq":
                continue
            for node in seq.iter("{%s}cTn" % NS["p"]):
                kind = node.get("nodeType")
                if kind == "clickEffect":
                    clicks += 1
                elif kind in ("withEffect", "afterEffect"):
                    auto += 1
    # p:transition, or one inside mc:AlternateContent (the newer effects such as Morph)
    transition = any(el.tag.endswith("}transition") for el in root.iter())
    return {"clicks": min(clicks, 200), "auto": min(auto, 500), "transition": bool(transition)}


def read_pptx(path, hidden=False):
    """[{title, text, notes, idx, clicks, auto, transition}] for the slides PowerPoint shows (hidden slides are left
    out, as in its PDF). idx is the slide's number in the file (1-based, hidden ones counted), which PowerPoint's
    slide show goes to; the animation fields come from animation_of."""
    out = []
    idx = 0
    with zipfile.ZipFile(str(path)) as z:
        pres = "ppt/presentation.xml"
        rels = _rels(z, pres)
        for sid in _xml(z, pres).findall("p:sldIdLst/p:sldId", NS):
            target = rels.get(sid.get("{%s}id" % NS["r"]), ("", ""))[0]
            if not target or target not in z.namelist():
                continue
            root = _xml(z, target)
            idx += 1
            if root.get("show") == "0" and not hidden:   # hidden in PowerPoint: not in the slides
                continue
            shapes = _shape_texts(root, skip_types=("sldNum", "dt", "ftr"))
            title = next((t for k, t in shapes if k in ("title", "ctrTitle")), "")
            body = [t for k, t in shapes if k not in ("title", "ctrTitle")]
            notes = ""
            for path_, kind in _rels(z, target).values():
                if kind == NOTES_REL and path_ in z.namelist():
                    notes = "\n".join(t for k, t in _shape_texts(_xml(z, path_), skip_types=("sldNum", "sldImg", "dt", "ftr", "hdr"))
                                      if k in ("body", ""))
                    break
            out.append({"title": _clean(title.replace("\n", " "), TITLE_MAX), "text": _clean("\n".join(body), TEXT_MAX),
                        "notes": _clean(notes, NOTES_MAX), "idx": idx, **animation_of(root)})
            if len(out) >= MAX_SLIDES:
                break
    return out


def read_pdf(path):
    """[{title, text, notes}] from a PDF's own text (no notes in a PDF; the first line is the title)."""
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(str(path))
    out = []
    try:
        for i in range(min(len(doc), MAX_SLIDES)):
            page = doc[i]
            tp = page.get_textpage()
            try:
                text = _clean(tp.get_text_range(), TEXT_MAX)
            finally:
                tp.close()
                page.close()
            lines = [ln for ln in text.split("\n") if ln.strip()]
            out.append({"title": _clean(lines[0], TITLE_MAX) if lines else "", "text": "\n".join(lines[1:])[:TEXT_MAX],
                        "notes": ""})
    finally:
        doc.close()
    return out


def page_count(path):
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(str(path))
    try:
        return len(doc)
    finally:
        doc.close()


# ---------- the cached description of a deck ----------
def record_source(folder, pdf_name, source_name):
    """Remember which .pptx a PDF was made from (the upload makes "Talk (2).pdf" from "Talk.pptx")."""
    meta = folder / META
    meta.mkdir(exist_ok=True)
    (meta / (pdf_name + ".source")).write_text(source_name, encoding="utf-8")


def _source(folder, pdf_name):
    f = folder / META / (pdf_name + ".source")
    try:
        name = _name_ok(f.read_text(encoding="utf-8").strip())
    except OSError:
        name = ""
    if not name:
        stem = pdf_name[:-4] if pdf_name.lower().endswith(".pdf") else pdf_name
        name = next((stem + e for e in (".pptx",) if (folder / (stem + e)).is_file()), "")
    return name if name and (folder / name).is_file() else ""


def _refs(slide):
    import scripture_speech
    seen, out = set(), []
    for r in scripture_speech.find_all(" ".join([slide.get("title", ""), slide.get("text", "")])):
        if r["ref"] not in seen and r.get("verse"):          # a chapter alone is too often a number on a slide
            seen.add(r["ref"])
            out.append(r["label"])
    return out[:4]


def info(folder, name):
    """{file, pages, source, slides: [{n, title, text, notes, refs}]} for a PDF deck in the Content folder."""
    name = _name_ok(name)
    path = folder / name if name else None
    if not path or not name.lower().endswith(".pdf") or not path.is_file():
        raise ValueError("That slide deck is not in the Content folder.")
    src = _source(folder, name)
    key = [2, path.stat().st_size, int(path.stat().st_mtime)]          # 2: 26.11.46 animations read too
    if src:
        key += [(folder / src).stat().st_size, int((folder / src).stat().st_mtime)]
    cache = folder / META / (name + ".json")
    with _LOCK:
        try:
            old = json.loads(cache.read_text(encoding="utf-8"))
            if old.get("key") == key:
                return old["info"]
        except (OSError, ValueError, KeyError):
            pass
    pages = page_count(path)
    slides = []
    if src:
        try:
            slides = read_pptx(folder / src)
        except (OSError, ValueError, KeyError, EOFError, zipfile.BadZipFile, ET.ParseError):   # being copied, or not a deck
            slides = []
    if len(slides) != pages:                           # no source, or it no longer matches the PDF: the PDF's text
        pdf_slides = read_pdf(path)
        notes = [s.get("notes", "") for s in slides] if len(slides) == pages else []
        slides = [dict(s, notes=notes[i] if i < len(notes) else "") for i, s in enumerate(pdf_slides)]
    animated = any(s.get("clicks") or s.get("auto") or s.get("transition") for s in slides[:pages])
    out = {"file": name, "pages": pages, "source": src, "animated": bool(animated),
           "slides": [dict(s, n=i + 1, refs=_refs(s)) for i, s in enumerate(slides[:pages])]}
    with _LOCK:
        try:
            (folder / META).mkdir(exist_ok=True)
            cache.write_text(json.dumps({"key": key, "info": out}), encoding="utf-8")
        except OSError:
            pass
    return out


def thumb(folder, name, n, width=320):
    """One slide (1-based) as JPEG bytes, width from THUMB_WIDTHS, cached in Content/.slides/<deck>/."""
    name = _name_ok(name)
    path = folder / name if name else None
    if not path or not name.lower().endswith(".pdf") or not path.is_file():
        raise ValueError("That slide deck is not in the Content folder.")
    width = min(THUMB_WIDTHS, key=lambda w: abs(w - int(width or 320)))
    n = int(n)
    out = folder / META / name / ("%d-%d-%d.jpg" % (n, width, int(path.stat().st_mtime)))
    try:
        return out.read_bytes()
    except OSError:
        pass
    import io

    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(str(path))
    try:
        if not 1 <= n <= len(doc):
            raise ValueError("No such slide.")
        page = doc[n - 1]
        w, _ = page.get_size()
        img = page.render(scale=width / max(1.0, w)).to_pil().convert("RGB")
        page.close()
    finally:
        doc.close()
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=78 if width <= 480 else 85, optimize=True)
    data = buf.getvalue()
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
    except OSError:
        pass
    return data


# ---------- the run order for this meeting ----------
def sequence(pages, order=None, skip=None):
    """The slides (0-based) in the order they are shown: order (a list of slide numbers, 0-based) when it is one,
    else the file's own order, without the skipped ones and without anything outside the deck. Never empty for a
    deck with slides: when everything is skipped, the first slide is kept."""
    pages = max(0, int(pages or 0))
    seen, seq = set(), []
    for p in (order if isinstance(order, list) else []) + list(range(pages)):
        if isinstance(p, int) and not isinstance(p, bool) and 0 <= p < pages and p not in seen:
            seen.add(p)
            seq.append(p)
    hide = {p for p in (skip if isinstance(skip, list) else []) if isinstance(p, int)}
    shown = [p for p in seq if p not in hide]
    return shown or seq[:1]


def step(seq, page, by):
    """The slide by steps away from page in the run order (stops at either end). A page that is not in the order
    (hidden after it was shown) moves to the nearest shown slide after it."""
    if not seq:
        return page
    if page in seq:
        i = seq.index(page)
    else:
        later = [k for k, p in enumerate(seq) if p > page]
        i = (later[0] - (1 if by > 0 else 0)) if later else len(seq) - 1
    return seq[max(0, min(len(seq) - 1, i + by))]


def search(slides, query, limit=20):
    """Slides whose title, text or notes hold every word of query (any order, any case), best first: title hits,
    then text, then notes."""
    words = [w for w in re.findall(r"\w+", str(query or "").lower()) if w]
    if not words:
        return []
    scored = []
    for s in slides:
        t, b, n = s.get("title", "").lower(), s.get("text", "").lower(), s.get("notes", "").lower()
        if all(w in t or w in b or w in n for w in words):
            scored.append((-(sum(w in t for w in words) * 3 + sum(w in b for w in words) * 2 + sum(w in n for w in words)), s["n"], s))
    return [s for _, _, s in sorted(scored, key=lambda x: (x[0], x[1]))][:limit]


STOP = {"the", "a", "an", "of", "and", "or", "to", "in", "on", "is", "it", "that", "this", "for", "with", "about", "slide",
        "one", "we", "you", "our", "your", "be", "are", "was", "as", "at", "by", "from", "his", "her", "my"}


def best(slides, query):
    """The one slide a spoken phrase means ("the slide about the good shepherd"): every word if one has them all,
    else the slide with most of the words (title words count most); None when nothing matches."""
    words = [w for w in re.findall(r"\w+", str(query or "").lower()) if w not in STOP]
    if not words:
        return None
    hits = search(slides, " ".join(words), 1)
    if hits:
        return hits[0]
    scored = []
    for s in slides:
        t, b, n = s.get("title", "").lower(), s.get("text", "").lower(), s.get("notes", "").lower()
        score = sum((w in t) * 3 + (w in b) * 2 + (w in n) for w in words)
        if score:
            scored.append((-score, s["n"], s))
    return sorted(scored, key=lambda x: (x[0], x[1]))[0][2] if scored else None


def words(slides, limit=400):
    """The words of a deck a listener should know: titles first, then the slides' text (not the notes)."""
    out, seen = [], set()
    for part in ("title", "text"):
        for s in slides:
            for w in re.findall(r"[a-z']+", str(s.get(part, "")).lower()):
                if len(w) > 2 and w not in STOP and w not in seen:
                    seen.add(w)
                    out.append(w)
                    if len(out) >= limit:
                        return out
    return out


def song_text(slides):
    """The text of these slides as lyrics for a Songs Deck: one verse per slide (KCScenes.parseLyrics splits at
    blank lines), the slide's title as the verse label when it looks like one (Verse 1, Chorus)."""
    parts = []
    for s in slides:
        body = s.get("text", "").strip()
        title = s.get("title", "").strip()
        if re.match(r"^\s*\[?(verse|chorus|refrain|bridge|pre-?chorus|tag|ending|intro|outro)\b", title, re.I):
            body = title + "\n" + body
        elif title and not body:
            body = title
        if body:
            parts.append(body)
    return "\n\n".join(parts)
