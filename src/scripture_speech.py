"""FrameDecks 26.11.14 - Listen for scripture: turns spoken words into a Bible reference.

Pure and small (no I/O): the listening process hears only the words in grammar_words() (the 66 books, number words and
a few joining words such as "chapter", "verse" and "to"), and find() reads what it heard:

    find("romans chapter eight verses thirty eight to thirty nine")
      -> {"book": "Romans", "chapter": 8, "verse": 38, "to": 39, "ref": "Romans 8:38-39", "label": "Romans 8:38–39"}

Safe by design: a reference needs a book, a chapter and a verse (a book with one chapter, such as Jude, needs only the
verse). A book alone ("as Paul says in Romans") or a book and a chapter ("Psalm twenty three") is not a reference, so
nothing is suggested. A word the listener did not know arrives as "[unk]" and breaks a reference in two, so unrelated
words either side of it are never joined into one. Book names are written as app/js/scripture.js writes them."""
import re

BREAK = "[unk]"

# (name, chapters) in Bible order; names as app/js/scripture.js BOOKS
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
MAX_VERSE = 176              # the longest chapter in the Bible (Psalm 119)
MAX_SPAN = 60                # "verses 1 to 60" is a passage; a longer "range" is more likely two unrelated numbers

# spoken names (lower case, words) -> book; numbered books are spoken with an ordinal (see ORDINALS)
SPOKEN = {"psalms": "Psalm", "song of songs": "Song of Solomon", "songs of solomon": "Song of Solomon",
          "revelations": "Revelation", "acts of the apostles": "Acts"}
for _name, _n in BOOKS:
    if not _name[0].isdigit():
        SPOKEN[_name.lower()] = _name
NUMBERED = {"samuel", "kings", "chronicles", "corinthians", "thessalonians", "timothy", "peter", "john"}
ORDINALS = {"first": 1, "1st": 1, "second": 2, "2nd": 2, "third": 3, "3rd": 3, "one": 1, "two": 2, "three": 3,
            "1": 1, "2": 2, "3": 3, "i": 1, "ii": 2, "iii": 3}

UNITS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9}
TEENS = {"ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
         "seventeen": 17, "eighteen": 18, "nineteen": 19}
TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
JOIN = ("chapter", "verse", "verses", "to", "through", "and", "colon", "a", "hundred", "first", "second", "third", "oh",
        "at", "from", "in", "the", "starting", "beginning", "book")
# 26.11.14 a few words people say between the numbers ("Romans eight, starting at verse thirty eight"): they are known
# words, so they never arrive as "[unk]", and up to GAP of them (or of "[unk]") may stand before the word "verse"
FILL = {"and", "at", "from", "in", "the", "starting", "beginning", BREAK}
GAP = 4
RANGE = {"to", "through", "and", "till", "until"}


def grammar_words():
    """Every word the listener needs to hear (a small, fixed grammar: far more accurate than open dictation)."""
    words = set(JOIN) | set(UNITS) | set(TEENS) | set(TENS)
    for spoken in list(SPOKEN) + sorted(NUMBERED):
        words.update(spoken.split())
    return sorted(words)


def _tokens(text):
    t = str(text or "").lower().replace("–", "-").replace("—", "-")
    t = re.sub(r"(\d)\s*:\s*(\d)", r"\1 colon \2", t)        # typed "3:16" (the test hook, a typed reference)
    t = re.sub(r"(\d)\s*-\s*(\d)", r"\1 to \2", t)
    t = t.replace("[unk]", " " + BREAK + " ")
    return [w for w in re.split(r"[^a-z0-9\[\]]+", t) if w]


def _small(tokens, i):
    """A number below 100 at tokens[i]: (value, next index) or None."""
    w = tokens[i] if i < len(tokens) else ""
    if w in TENS:
        if i + 1 < len(tokens) and tokens[i + 1] in UNITS:
            return TENS[w] + UNITS[tokens[i + 1]], i + 2
        return TENS[w], i + 1
    if w in TEENS:
        return TEENS[w], i + 1
    if w in UNITS:
        return UNITS[w], i + 1
    return None


def number(tokens, i):
    """A spoken number at tokens[i] (1..999): (value, next index) or None. Greedy: "twenty one" is 21, "one hundred
    and five" is 105, "a hundred nineteen" is 119; "three sixteen" is 3, then 16."""
    if i >= len(tokens):
        return None
    w = tokens[i]
    if w.isdigit():
        v = int(w)
        return (v, i + 1) if 0 < v < 1000 else None
    if w in UNITS and i + 2 < len(tokens) and tokens[i + 1] in ("oh", "zero") and tokens[i + 2] in UNITS:
        return UNITS[w] * 100 + UNITS[tokens[i + 2]], i + 3                     # "one oh five" is 105
    head = None
    if w == "a" and i + 1 < len(tokens) and tokens[i + 1] == "hundred":
        head = (1, i + 1)
    elif w == "hundred":
        head = (1, i)
    elif w in UNITS and i + 1 < len(tokens) and tokens[i + 1] == "hundred":
        head = (UNITS[w], i + 1)
    if head:
        value, j = head[0] * 100, head[1] + 1                  # j: after "hundred"
        k = j + 1 if j < len(tokens) and tokens[j] == "and" else j
        rest = _small(tokens, k)
        if rest:
            return value + rest[0], rest[1]
        return value, j
    return _small(tokens, i)


def _book_at(tokens, i):
    """The book named at tokens[i]: (book, next index) or None. Longest spoken name first."""
    if i < len(tokens) and tokens[i] in ORDINALS and i + 1 < len(tokens) and tokens[i + 1] in NUMBERED:
        name = "%d %s" % (ORDINALS[tokens[i]], tokens[i + 1].capitalize())
        if name in CHAPTERS:
            return name, i + 2
    for size in (4, 3, 2, 1):
        spoken = " ".join(tokens[i:i + size])
        if len(tokens) - i >= size and spoken in SPOKEN:
            return SPOKEN[spoken], i + size
    return None


def _skip(tokens, i, words):
    while i < len(tokens) and tokens[i] in words:
        i += 1
    return i


def _read(tokens, i, book):
    """The numbers after a book at tokens[i]: a reference dict or None."""
    one = CHAPTERS[book] == 1
    i = _ahead(tokens, i, ("chapter",))
    i = _skip(tokens, i, ("chapter",))
    if one and i < len(tokens) and tokens[i] in ("verse", "verses"):     # "Jude verse twenty four"
        hit = number(tokens, i + 1)
        if not hit:
            return None
        chapter, (verse, i) = 1, hit
    else:
        first = number(tokens, i)
        if not first:
            return None
        a, i = first
        if CHAPTERS[book] > 99 and a < 10 and i < len(tokens) and tokens[i] not in ("verse", "verses", "colon"):
            more = _small(tokens, i)                             # "Psalm one nineteen, verse one oh five"
            if more and more[0] >= 10 and a * 100 + more[0] <= CHAPTERS[book] and number(tokens, _skip(tokens, _ahead(tokens, more[1], ("verse", "verses")), ("verse", "verses", "colon"))):
                a, i = a * 100 + more[0], more[1]
        i = _ahead(tokens, i, ("verse", "verses"))
        said_verse = i < len(tokens) and tokens[i] in ("verse", "verses", "colon")
        second = number(tokens, _skip(tokens, i, ("verse", "verses", "colon")))
        if second:
            chapter, (verse, i) = a, second
        elif one and not said_verse:
            chapter, verse = 1, a                                # "Jude twenty four"
        else:
            return None                                          # a chapter alone ("Psalm twenty three") is not enough
    if not 1 <= chapter <= CHAPTERS[book] or not 1 <= verse <= MAX_VERSE:
        return None
    to = None
    if i < len(tokens) and tokens[i] in RANGE:
        end = number(tokens, _skip(tokens, i + 1, ("verse", "verses")))
        if end and verse < end[0] <= min(MAX_VERSE, verse + MAX_SPAN):
            to = end[0]
    ref = "%s %d:%d" % (book, chapter, verse) + ("-%d" % to if to else "")
    label = ("%s %d" % (book, verse) if one else "%s %d:%d" % (book, chapter, verse)) + ("\u2013%d" % to if to else "")
    return {"book": book, "chapter": chapter, "verse": verse, "to": to, "ref": ref, "label": label, "end": i if not to else _after(tokens, i)}


def _after(tokens, i):
    """Where a range's last number ends (the index after it)."""
    j = _skip(tokens, i + 1, ("verse", "verses"))
    end = number(tokens, j)
    return end[1] if end else i


def _ahead(tokens, i, words):
    """Skip a few filler words or "[unk]" when one of `words` follows them ("eight, starting at verse ...")."""
    j = i
    while j < len(tokens) and j - i < GAP and tokens[j] in FILL:
        j += 1
    return j if j > i and j < len(tokens) and tokens[j] in words else i


NUMBERISH = set(UNITS) | set(TEENS) | set(TENS) | RANGE | {"hundred", "oh", "zero", "verse", "verses", "colon", "a"}


def find_all(text, settled=True):
    """Every reference in what was heard, in the order said. settled=False (words still coming in, a partial result):
    only references with other words said after them, so "Romans eight thirty" is not taken for 8:30 while the
    speaker is still saying "thirty eight"."""
    tokens = _tokens(text)
    out, i = [], 0
    while i < len(tokens):
        hit = _book_at(tokens, i)
        if not hit:
            i += 1
            continue
        book, j = hit
        ref = _read(tokens, j, book)
        if ref and not settled:
            nxt = tokens[ref["end"]] if ref["end"] < len(tokens) else None
            if nxt is None or nxt in NUMBERISH:
                ref = None                                       # the numbers may not be finished yet
        if ref:
            ref.pop("end", None)
            out.append(ref)
        i = j
    return out


def find(text):
    """The first reference in what was heard, or None."""
    refs = find_all(text)
    return refs[0] if refs else None
