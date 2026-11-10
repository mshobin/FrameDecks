"""FrameDecks 26.11.20 - Voice commands, hold to talk: hold Right Ctrl (or the hold button in the Command Center or on
the phone remote), say "next frame", let go. Nothing said is acted on unless it is held, so speaking in the meeting
never moves anything.

How it fits together:
  * Settings (kc-app-settings.json): "voiceCommands" (off by default) and "voiceKey": "rctrl", "lctrl", "f8", "off"
    (no key: only the hold buttons) or 26.11.21 your own key or keys held together, "k:<vk>+<vk>" (Windows virtual-key
    codes, recorded in Settings: up to three, e.g. Ctrl+Space). A hold starts once the key has been held alone for
    HOLD_DELAY, and pressing any other key meanwhile lets it go without a word (Ctrl+C with Left Ctrl as the key
    never turns the microphone on, and never shows "Didn't catch that").
  * The command words are loaded into the listening process (src/voice_follow.py, src/voice_worker.py: the same
    offline Vosk model and microphone as Follow my voice and Listen for scripture) only while the setting is on and a
    Frame is live; the worker hears them only while held, and then nothing else hears (the Teleprompter's script and
    Listen for scripture rest while you talk to FrameDecks).
  * Holding: the key is read every 30 ms (only while on and live), or POST /api/voice-commands {op: "hold", on}.
  * What was heard is matched to one command (match()). It is never Go Live, Leave, Share screen or Emergency: those
    stay a press. "Show John three sixteen" puts a verse on screen through Listen for scripture's Show.
  * The Studio runs the command (app/js/voice-commands.js), with the same steps as the buttons, and says it is done.
    GET /api/voice-commands?after=<seq>&wait=<s> is the state every screen shows ("Listening…", "Heard: Next Frame").
26.11.27 (owner, 9 November: hands-free, but never a surprise):
  * A Frame or a Deck by its name: "go to Welcome", "open Bible Study", "Discussion" (a Scripture or Question Deck of
    the live Frame by its own name). The names' words join the listener's words while you are live (names()), and
    change with the plan.
  * A verse said ("show John three sixteen") is offered, never shown by itself: it comes up in the Studio and the
    corner card as "You asked for John 3:16" with Show, one press (or, still holding, "show it").
26.11.28 voice search: while the Command Center's search box has focus (POST {op: "search", on, words}), what is said
while held is typed into the box (cmd "search"), never run; the words it listens for are the ones the Command Center
can find (its Frames, Decks, Content, verses, commands and settings), so it stays accurate offline. It also works
when nothing is live.
26.11.41 (owner, 10 November: "let's see the verse", "let's go to day 2"):
  * Layer 1, the ways a name is said (spoken_forms()): "Day2" is also "day two" and "second day", "BibleStudy" is
    "bible study", "Wk3 Q&A" is "week three q and a", "Part II" is "part two". A Frame's "Also called" (scene.aka,
    set in the Frame editor on the PC and on framedecks.com) adds the names you use for it ("the opening").
  * Layer 2, what you mean, not the exact phrase (understand()): the words around a command are dropped ("let's",
    "can we", "please"), the verbs are read as one ("see", "bring up", "pull up" are show; "jump to", "switch to",
    "take us to" are go to), and pointing words are read from what is live: "the verse" is the live Frame's scripture
    (shown even where the Frame shows one thing at a time), "the question" its question, "the next day" the Frame
    whose name has the next number after the live one's ("Day 2" -> "Day 3"). Part of one Frame's name is enough
    when no other Frame has it ("go to day two" for "Day 2: Romans").
  * Still offline and small: the listener's words grow only by the names' forms and a few dozen joining words, and
    nothing is worked out while nobody holds the key (the forms are cached per plan).
Nothing heard is recorded, kept or sent anywhere."""
import functools
import re
import threading
import time

import scripture_speech

POLL = 2.0          # seconds between checks of the setting and the live Frame
KEY_POLL = 0.03     # how often the hold key is read while voice commands are on and a Frame is live
WAIT_MAX = 10.0
KEYS = {"rctrl": (0xA3, "Right Ctrl"), "lctrl": (0xA2, "Left Ctrl"), "f8": (0x77, "F8")}      # Windows virtual-key codes
HOLD_DELAY = 0.25   # 26.11.21 seconds the key is held alone before listening starts (a shortcut is not a hold)
KEY_NAMES = {0x08: "Backspace", 0x09: "Tab", 0x0D: "Enter", 0x13: "Pause", 0x14: "Caps Lock", 0x20: "Space",
             0x21: "Page Up", 0x22: "Page Down", 0x23: "End", 0x24: "Home", 0x2D: "Insert", 0x2E: "Delete",
             0x5B: "Windows", 0x5D: "Menu", 0x90: "Num Lock", 0x91: "Scroll Lock",
             0xA0: "Left Shift", 0xA1: "Right Shift", 0xA2: "Left Ctrl", 0xA3: "Right Ctrl", 0xA4: "Left Alt",
             0xA5: "Right Alt", 0xBA: ";", 0xBB: "=", 0xBC: ",", 0xBD: "-", 0xBE: ".", 0xBF: "/", 0xC0: "`",
             0xDB: "[", 0xDC: "\\", 0xDD: "]", 0xDE: "'"}
KEY_NAMES.update({c: chr(c) for c in range(0x30, 0x3A)})                   # 0-9
KEY_NAMES.update({c: chr(c) for c in range(0x41, 0x5B)})                   # A-Z
KEY_NAMES.update({0x70 + i: "F%d" % (i + 1) for i in range(24)})          # F1-F24
KEY_NAMES.update({0x60 + i: "Num %d" % i for i in range(10)})
# the keys that cancel a hold when pressed with it: letters, digits, F-keys, Space, Enter, Tab, Esc, the arrows
OTHER_KEYS = tuple(range(0x30, 0x3A)) + tuple(range(0x41, 0x5B)) + tuple(range(0x70, 0x88)) + (0x20, 0x0D, 0x09, 0x1B, 0x25, 0x26, 0x27, 0x28)


def parse_key(value):
    """A voiceKey setting -> ([vk, ...], "Name + Name") or None (no key). Never raises."""
    v = str(value or "")
    if v in KEYS:
        return [KEYS[v][0]], KEYS[v][1]
    if v.startswith("k:"):
        try:
            vks = [int(x) for x in v[2:].split("+") if x]
        except ValueError:
            return None
        if 1 <= len(vks) <= 3 and len(set(vks)) == len(vks) and all(k in KEY_NAMES for k in vks):
            return vks, " + ".join(KEY_NAMES[k] for k in vks)
    return None


def valid_key(value):
    """For the settings check: a preset, "off", or your own key (see parse_key)."""
    return value == "off" or parse_key(value) is not None
SEARCH_FOR = 90.0   # 26.11.28 seconds voice search stays on after the Command Center last said its box has focus
MAX_HOLD = 15.0     # a key held longer is let go (a stuck key never keeps the microphone on for these words)

# id, what the screens say, the ways to say it (whole phrases; the longest one heard wins)
COMMANDS = (
    ("next", "Next Frame", ("next frame", "next", "go next", "next one", "go forward", "forward")),
    ("prev", "Previous Frame", ("previous frame", "previous", "go back", "back", "last frame", "previous one")),
    ("next-question", "Next question", ("next question",)),
    ("prev-question", "Previous question", ("previous question", "last question")),
    ("next-verse", "Next scripture", ("next scripture", "next verse", "next passage")),
    ("prev-verse", "Previous scripture", ("previous scripture", "previous verse", "last scripture", "last verse")),
    ("next-slide", "Next slide", ("next slide",)),
    ("prev-slide", "Previous slide", ("previous slide", "last slide")),
    ("show-question", "Show the question", ("show question", "show the question", "question", "the question")),
    ("show-verse", "Show the scripture", ("show scripture", "show the scripture", "scripture", "show verse", "show the verse",
                                          "the verse", "the scripture", "show the passage", "show passage", "the passage",
                                          "show the bible verse", "the bible verse")),
    ("show-both", "Show both", ("show both", "both")),
    ("hide", "Hide all", ("hide all", "hide everything", "hide", "clear screen", "clear the screen", "clear")),
    ("black", "Black screen", ("black screen", "black", "go black", "blackout")),
    ("unblack", "Picture back", ("picture back", "screen back", "show picture", "show the picture", "back on")),
    ("freeze", "Freeze", ("freeze", "freeze picture", "freeze the picture", "hold picture")),
    ("unfreeze", "Unfreeze", ("unfreeze", "resume", "move again", "go on")),
    ("mute", "Mute / unmute", ("mute", "unmute", "mute me", "unmute me", "microphone")),
    ("camera", "Camera on / off", ("camera", "camera on", "camera off", "video on", "video off")),
)
NEVER = ("golive", "leave", "share", "emergency", "end", "delete")  # stay a press, never a voice command
SHOW_WORDS = {"show", "put", "display", "open", "read"}
CONFIRM = ("show it", "show that", "yes show it", "show the verse now", "yes")      # 26.11.27 the verse just offered
GO_WORDS = ("go to", "go", "open", "frame", "show", "the", "to")                    # may come before a name
DECK_CMD = {"scripture": ("show-verse", "the scripture"), "question": ("show-question", "the question")}


def _words(text):
    out = []
    for w in str(text or "").lower().replace("-", " ").split():
        if not w or w == "[unk]":
            continue
        if w.isdigit() and len(w) <= 3:
            out.extend(say_number(int(w)))               # 26.11.41 typed "day 2" is said "day two"
        else:
            out.append(w)
    return out


# ---------- 26.11.41 layer 1: the ways a name is said ----------
ONES = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
        "seventeen eighteen nineteen").split()
TENS_W = ("", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety")
ORDINAL = {1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth", 7: "seventh", 8: "eighth",
           9: "ninth", 10: "tenth", 11: "eleventh", 12: "twelfth"}
ORDINAL_N = {v: k for k, v in ORDINAL.items()}
ROMAN = {"ii": 2, "iii": 3, "iv": 4, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10, "xi": 11, "xii": 12}
ABBREV = {"wk": "week", "pt": "part", "ch": "chapter", "intro": "introduction", "qa": "q and a", "vs": "verse",
          "sess": "session", "les": "lesson", "mtg": "meeting", "bk": "book"}
FORMS_MAX = 8                                             # forms per Frame (its name, Also called and their variants)


def say_number(n):
    """0..999 as spoken words: 23 -> ["twenty", "three"], 105 -> ["one", "hundred", "five"]."""
    n = int(n)
    if n < 0 or n > 999:
        return [ONES[int(d)] for d in str(abs(n))]
    if n < 20:
        return [ONES[n]]
    if n < 100:
        return [TENS_W[n // 10]] + ([ONES[n % 10]] if n % 10 else [])
    rest = n % 100
    return [ONES[n // 100], "hundred"] + (say_number(rest) if rest else [])


def _tokens41(text):
    """A name as plain tokens: camelCase and letters/digits apart, "&" as "and", "1st" as "first"."""
    s = str(text or "")[:120].replace("&", " and ").replace("+", " plus ").replace("#", " number ")
    s = re.sub(r"\b(\d{1,2})(st|nd|rd|th)\b", lambda m: " " + ORDINAL.get(int(m.group(1)), m.group(1)) + " ", s, flags=re.I)
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", s)
    s = re.sub(r"([A-Za-z])(\d)", r"\1 \2", s)
    s = re.sub(r"(\d)([A-Za-z])", r"\1 \2", s)
    return re.findall(r"[a-z0-9']+", s.lower())


def _say(tokens, roman=False):
    out = []
    for i, t in enumerate(tokens):
        t = t.strip("'")
        if not t:
            continue
        if t.isdigit():
            out.extend(say_number(int(t)) if len(t) <= 3 else [ONES[int(d)] for d in t])
        elif roman and i and t in ROMAN:
            out.extend(say_number(ROMAN[t]))             # "Part II" -> "part two" (never "I" alone: it is a word)
        else:
            out.append(t)
    return out


def spoken_forms(name, aka=""):
    """Every way a Frame's name (and its "Also called") is said, as word lists, most likely first. Pure."""
    return [list(f) for f in _forms_cached(str(name or "")[:120], str(aka or "")[:200])]


@functools.lru_cache(maxsize=2048)
def _forms_cached(name, aka):
    """spoken_forms, worked out once per name (the listener asks again every few seconds while live)."""
    forms = []

    def add(words):
        words = [w for w in words if w][:8]
        if words and words not in forms and len(forms) < FORMS_MAX:
            forms.append(words)

    phrases = [str(name or "")] + [p for p in re.split(r"[,;/\n]+", str(aka or "")[:200]) if p.strip()][:5]
    for k, phrase in enumerate(phrases):
        toks = _tokens41(phrase)
        if not toks:
            continue
        base = _say(toks)
        add(base)
        if k == 0:
            rom = _say(toks, roman=True)
            add(rom)
            exp = []
            for w in rom:
                exp.extend(ABBREV.get(w, w).split())
            add(exp)
            if len(base) > 1 and base[0] == "the":
                add(base[1:])                             # "The Welcome" is also "welcome"
            if len(toks) == 2 and toks[1].isdigit() and 0 < int(toks[1]) <= 12 and not toks[0].isdigit():
                add([ORDINAL[int(toks[1])], ABBREV.get(toks[0], toks[0])])      # "Day 2" is also "second day"
    return tuple(tuple(f) for f in forms)


def _name_words(name):
    """A Frame or Deck name as the words it is said with ("Bible Study!" -> ["bible", "study"])."""
    forms = spoken_forms(name)
    return forms[0] if forms else []


def _forms_of(item):
    return spoken_forms(item.get("name"), item.get("aka", ""))


def _number_at(words, i):
    """A spoken number at words[i]: (value, next index) or None ("twenty three" -> 23)."""
    if i < len(words) and words[i] in ORDINAL_N:
        return ORDINAL_N[words[i]], i + 1
    return scripture_speech.number(words, i)


# ---------- 26.11.41 layer 2: what you mean, not the exact phrase ----------
LEAD = {"let's", "lets", "let", "us", "can", "could", "would", "will", "you", "we", "please", "okay", "ok", "so",
        "now", "alright", "right", "and", "then", "i", "i'd", "we'll", "want", "like", "shall", "just", "um", "uh",
        "hey", "to", "time", "need", "should"}
TRAIL = {"please", "now", "then", "thanks", "thank", "you"}
LEAD_MAX, TRAIL_MAX = 6, 2
# whole phrases read as one verb (longest first); the right side is what the matcher already knows
REWRITE = (
    ("move on to", "go to"), ("go on to", "go to"), ("go back to", "go to"), ("take us to", "go to"),
    ("take me to", "go to"), ("jump to", "go to"), ("switch to", "go to"), ("skip to", "go to"), ("move to", "go to"),
    ("head to", "go to"), ("turn to", "go to"), ("return to", "go to"), ("change to", "go to"), ("bring up", "show"),
    ("pull up", "show"), ("put up", "show"), ("look at", "show"), ("show me", "show"), ("show us", "show"),
    ("give me", "show"), ("put on", "show"), ("see", "show"), ("view", "show"), ("display", "show"), ("read", "show"),
    ("following", "next"), ("preceding", "previous"),
)
REWRITE_WORDS = sorted({w for a, b in REWRITE for w in (a + " " + b).split()})
RELATIVE = {"next": 1, "previous": -1, "last": -1}
NOT_UNITS = {"frame", "question", "verse", "scripture", "slide", "passage", "one", "thing", "part"}


def understand(words):
    """The words that carry the meaning: fillers off both ends, verbs read as one ("let's see the verse" ->
    ["show", "the", "verse"]). A sentence keeps its other words, so it still is not a command."""
    w = list(words)
    i = 0
    while i < len(w) and i < LEAD_MAX and w[i] in LEAD:
        i += 1
    if i < len(w):
        w = w[i:]
    n = 0
    while len(w) > 1 and n < TRAIL_MAX and w[-1] in TRAIL:
        w.pop()
        n += 1
    out, i = [], 0
    while i < len(w):
        for a, b in REWRITE:
            aw = a.split()
            if w[i:i + len(aw)] == aw:
                out.extend(b.split())
                i += len(aw)
                break
        else:
            out.append(w[i])
            i += 1
    return out


def _relative(words, names):
    """"the next day" / "previous week": the Frame whose name has the live one's number plus or minus one."""
    w = [x for x in words if x not in ("go", "to", "the", "show", "open")]
    if len(w) != 2 or w[0] not in RELATIVE or w[1] in NOT_UNITS:
        return None
    unit, step = w[1], RELATIVE[w[0]]
    frames = (names or {}).get("frames", [])
    live = next((f for f in frames if f.get("id") == (names or {}).get("live")), None)
    if not live:
        return None

    def num_of(item):
        for form in _forms_of(item):
            for j, x in enumerate(form):
                if x == unit:
                    got = _number_at(form, j + 1)
                    if got:
                        return got[0]
                    if j and form[j - 1] in ORDINAL_N:
                        return ORDINAL_N[form[j - 1]]
        return None

    have = num_of(live)
    if have is None:
        return None
    want = have + step
    ids = [f.get("id") for f in frames if f.get("id") != live.get("id") and num_of(f) == want]
    if not ids:
        return {"cmd": None}                              # no such day: nothing, never "Previous Frame" instead
    hit = next(f for f in frames if f.get("id") == ids[0])
    r = {"cmd": "goto", "label": "Go to " + str(hit.get("name"))[:60], "scene": str(ids[0])}
    if len(ids) > 1:
        r["scenes"] = [str(x) for x in ids[:20]]
    return r


def _name_words(name):
    """A Frame or Deck name as the words it is said with ("Bible Study!" -> ["bible", "study"])."""
    return [w for w in "".join(c if c.isalnum() or c == "'" else " " for c in str(name or "").lower()).split() if w][:8]


def grammar_words(names=None):
    """Every word the command listener needs: the commands, "frame" numbers, Bible references and (26.11.27) the
    names of the Frames and the live Frame's Decks."""
    out = set(SHOW_WORDS) | {"frame", "go", "to", "number", "the", "it", "that", "yes", "now"}
    for _, _, phrases in COMMANDS:
        for p in phrases:
            out.update(p.split())
    out.update(scripture_speech.grammar_words())
    out.update(LEAD | TRAIL | set(RELATIVE) | set(REWRITE_WORDS) | set(ORDINAL.values()))
    for item in (names or {}).get("frames", []) + (names or {}).get("decks", []):
        for form in _forms_of(item):
            out.update(form)
    return sorted(out)


def _by_name(words, names):
    """The Frame or Deck whose whole name (any of its spoken forms) was said, with only "go to (the)", "open" or
    "please" around it: (score, result) or None. The longest name wins; a Frame wins over a Deck of the same length.
    26.11.41 part of a name is enough when only one Frame has it (scored a little under a whole name)."""
    best = None
    go = set(" ".join(GO_WORDS).split()) | {"please"}
    frames = (names or {}).get("frames", [])
    for kind, items in (("frame", frames), ("deck", (names or {}).get("decks", []))):
        for it in items:
            for nw in _forms_of(it):
                i = next((i for i in range(len(words) - len(nw) + 1) if words[i:i + len(nw)] == nw), None)
                if i is None:
                    continue
                rest = words[:i] + words[i + len(nw):]
                if len(rest) > 3 or any(w not in go for w in rest):
                    continue
                if kind == "frame":
                    r = _goto(it, frames, nw)
                elif it.get("kind") in DECK_CMD:
                    r = {"cmd": DECK_CMD[it["kind"]][0], "label": "Show " + str(it.get("name"))[:60]}
                else:
                    continue
                if not best or len(nw) > best[0]:
                    best = (len(nw), r)
    if best:
        return best
    # part of one Frame's name: "go to day two" for "Day 2: Romans"
    k = 0
    while k < len(words) and words[k] in go:
        k += 1
    said, verb = words[k:], k > 0
    if not said or not (len(said) >= 2 or (verb and len(said[0]) >= 4)):
        return None
    hits = [it for it in frames if any(_find(f, said) for f in _forms_of(it))]
    names_hit = {str(it.get("name") or "").strip().lower() for it in hits}
    if len(names_hit) != 1:
        return None
    return (len(said) - 0.5, _goto(hits[0], frames, None))


def _goto(it, frames, form):
    """Go to this Frame; other Frames of the same name (other meetings) go along, and the Studio takes the first one
    that is in the meeting on screen."""
    same = [f for f in frames if str(f.get("name") or "").strip().lower() == str(it.get("name") or "").strip().lower()]
    r = {"cmd": "goto", "label": "Go to " + str(it.get("name"))[:60], "scene": str(it.get("id"))}
    if len(same) > 1:
        r["scenes"] = [str(f.get("id")) for f in same[:20]]
    return r


def _find(seq, sub):
    n = len(sub)
    return any(seq[i:i + n] == sub for i in range(len(seq) - n + 1))


def match(text, names=None):
    """What was said -> {"cmd", "label", ...} or None. A Bible reference wins ("show John three sixteen"), then "show
    it" (the verse just offered), then "frame <n>" (go to that Frame), then a Frame or Deck by its name or the longest
    command phrase heard (the longer of the two; a command on a tie). A phrase counts only when it is nearly all that
    was said (two words more at most), so a sentence that merely contains "go back" is not a command."""
    words = _words(text)
    if not words:
        return None
    raw = words
    words = understand(words) or words                     # 26.11.41 what you mean ("let's see the verse")
    if " ".join(words) in CONFIRM or " ".join(raw) in CONFIRM:
        return {"cmd": "show-offer", "label": "Show the verse"}
    ref = scripture_speech.find(" ".join(words))
    if ref:
        return {"cmd": "verse", "label": "Show " + ref["label"], "ref": ref["ref"], "text": " ".join(words)}
    if "frame" in words:
        i = words.index("frame")
        num = scripture_speech.number(words, i + 1) if i + 1 < len(words) else None
        if num and num[0] <= 200:
            return {"cmd": "frame", "label": "Frame %d" % num[0], "frame": num[0]}
    rel = _relative(words, names)                          # 26.11.41 "the next day"
    if rel:
        return rel if rel.get("cmd") else None
    named = _by_name(words, names)
    best = None
    for cid, label, phrases in COMMANDS:
        for p in phrases:
            pw = p.split()
            if not _find(words, pw):
                continue
            if len(words) - len(pw) > 2:             # inside a sentence it is not a command ("next frame please" is)
                continue
            if not best or len(pw) > best[0]:
                best = (len(pw), cid, label)
    if named and (not best or named[0] > best[0]):
        return named[1]
    if best:
        return {"cmd": best[1], "label": best[2]}
    return None


class VoiceCommands:
    def __init__(self, voice, settings, is_live, show_verse=None, key_down=None, clock=time.time, names=None, confirm=None):
        self.voice, self.settings, self.is_live, self.clock = voice, settings, is_live, clock
        self.show_verse = show_verse              # text -> a label when a verse was offered (Listen for scripture)
        self.names = names                        # 26.11.27 () -> {"frames": [{id, name}], "decks": [{kind, name}]}
        self.confirm = confirm                    # 26.11.27 () -> a label when the verse offered is now shown
        self._loaded = None                       # the words the listener has
        self._search_until, self._search_words = 0.0, []   # 26.11.28 voice search
        self.key_down = key_down                  # vk -> bool (Windows), or None
        self.cond = threading.Condition()
        self.seq, self.n = 0, 0
        self.listening, self.failed, self.last = False, False, {"state": "off"}
        self.holding, self.held_by, self.held_at, self.partial = False, "", 0.0, ""
        self.discard = False
        self._since, self._spoilt = None, False   # 26.11.21 the hold key: when it went down; another key came with it
        self.heard_last = None                    # {"n", "cmd", "label", "text", "at", "status": queued|done|failed|unknown, ...}
        self._threads = False

    # ---------- start / stop ----------
    def _want(self):
        cfg = self.settings() or {}
        return bool(cfg.get("voiceCommands")) and (bool(self.is_live()) or self.searching())

    # ---------- 26.11.28 voice search ----------
    def searching(self):
        return time.monotonic() < self._search_until

    def search(self, on, words=None):
        """The Command Center's search box has focus (on) or not; words: what it can find."""
        if on:
            seen, out = set(), []
            for w in words or []:
                for part in _words(w if isinstance(w, str) else ""):
                    part = "".join(c for c in part if c.isalnum() or c == "'")[:30]
                    if part and part not in seen and len(out) < 1200:
                        seen.add(part)
                        out.append(part)
            self._search_words, self._search_until = out, time.monotonic() + SEARCH_FOR
        else:
            self._search_until = 0.0
        self.tick()
        return self.body()

    def _grammar(self):
        words = grammar_words(self._names())
        if self.searching():
            words = sorted(set(words) | set(self._search_words))
        return words

    def tick(self):
        want = self._want()
        if want and not self.listening and not self.failed:
            self.listening = True
            self._loaded = self._grammar()
            self.last = self.voice.command_start(self._loaded, self.heard) or {}
            if self.last.get("state") in ("unavailable", "memory", "error"):
                self.listening, self.failed = False, True
        elif want and self.listening and self.voice.want_c and not self.holding:
            words = self._grammar()                       # 26.11.27 a Frame renamed or added (26.11.28 or a search): its words
            if words != self._loaded:
                self._loaded = words
                self.voice.command_start(words, self.heard)
        elif want and self.listening and not self.voice.want_c:
            self.listening, self.failed = False, True        # it stopped by itself: tried again when switched on again
            self.last = dict(self.voice.command_body() or {}, state="error")
        elif not want:
            if self.listening:
                self.voice.command_stop()
            if self.holding:
                self._hold(False, "")
            self.listening, self.failed = False, False
            if self.last.get("state") != "unavailable":
                self.last = {"state": "off"}
        self._bump()

    def _names(self):
        try:
            return (self.names() if self.names else None) or {}
        except Exception as e:                            # never stop listening over the plan
            print("Voice commands (names):", e)
            return {}

    def _bump(self):
        st = self.voice.command_body() if self.listening else self.last
        now = (self.listening, self.failed, st.get("state"), st.get("progress"), self._want())
        if now != getattr(self, "_was", None):
            self._was = now
            with self.cond:
                self.seq += 1
                self.cond.notify_all()

    def _loop(self):
        while True:
            try:
                self.tick()
            except Exception as e:                            # the watcher never dies
                print("Voice commands:", e)
            time.sleep(POLL)

    def _key_loop(self):
        while True:
            try:
                if not self.key_step():
                    time.sleep(0.4)
            except Exception as e:
                print("Voice commands (key):", e)
                time.sleep(1)
            time.sleep(KEY_POLL)

    def key_step(self, now=None):
        """One look at the hold key (every KEY_POLL while on and live). False when there is nothing to watch."""
        cfg = self.settings() or {}
        key = parse_key(cfg.get("voiceKey", "rctrl"))
        if not (key and self.listening and self.key_down):
            if self.holding and self.held_by == "key":
                self._hold(False, "key")
            self._since, self._spoilt = None, False
            return False
        vks = key[0]
        down = all(self.key_down(k) for k in vks)
        other = down and any(self.key_down(k) for k in OTHER_KEYS if k not in vks)
        now = time.monotonic() if now is None else now
        if not down:
            if self.holding and self.held_by == "key":
                self._hold(False, "key")                  # let go: say what was heard
            self._since, self._spoilt = None, False
        elif self._since is None:
            self._since, self._spoilt = now, other
        elif other and not self._spoilt:
            self._spoilt = True                           # a shortcut (Ctrl+C), not a hold: drop it quietly
            if self.holding and self.held_by == "key":
                self._hold(False, "key", discard=True)
        elif not self._spoilt and not self.holding and now - self._since >= HOLD_DELAY:
            self._hold(True, "key")
        elif self.holding and self.held_by == "key" and time.monotonic() - self.held_at > MAX_HOLD:
            self._hold(False, "key")
            self._spoilt = True                           # a stuck key never keeps listening
        return True

    def start(self):
        if not self._threads:
            self._threads = True
            threading.Thread(target=self._loop, name="voice-commands", daemon=True).start()
            if self.key_down:
                threading.Thread(target=self._key_loop, name="voice-commands-key", daemon=True).start()

    # ---------- holding ----------
    def _hold(self, on, by, discard=False):
        with self.cond:
            if bool(on) == self.holding:
                return False
            self.holding, self.held_by = bool(on), (by if on else "")
            self.held_at = time.monotonic()
            self.discard = bool(discard and not on)       # 26.11.21 what was heard is dropped, without a word
            if on:
                self.partial = ""
            self.seq += 1
            self.cond.notify_all()
        self.voice.command_hold(bool(on))
        return True

    def hold(self, on, by="button"):
        """A hold button (Command Center, phone) or the key. Refused when it cannot listen yet."""
        if on and not self.listening:
            if not (self.settings() or {}).get("voiceCommands"):
                raise ValueError("Voice commands are off. Switch them on in Settings → Voice commands.")
            if not self.is_live() and not self.searching():
                raise ValueError("Voice commands work while a Frame is live.")
            raise ValueError("Voice commands are getting ready. Try again in a moment.")
        self._hold(on, by)
        return self.body()

    # ---------- what was heard ----------
    def heard(self, text, final=True):
        text = " ".join(_words(text))
        if not final:
            with self.cond:
                if self.holding and text != self.partial:
                    self.partial = text
                    self.seq += 1
                    self.cond.notify_all()
            return None
        with self.cond:
            if self.discard:                              # 26.11.21 a cancelled hold (a shortcut): nothing happens
                self.discard, self.partial = False, ""
                self.seq += 1
                self.cond.notify_all()
                return None
        if text and self.searching():                     # 26.11.28 typed into the Command Center's search, never run
            with self.cond:
                self.n += 1
                self.partial = ""
                self.heard_last = {"n": self.n, "cmd": "search", "label": "Search: " + text, "text": text,
                                   "at": int(self.clock() * 1000), "status": "done"}
                self.seq += 1
                self.cond.notify_all()
                return dict(self.heard_last)
        m = match(text, self._names()) if text else None
        now = self.clock()
        with self.cond:
            self.n += 1
            self.partial = ""
            if not m:
                self.heard_last = {"n": self.n, "cmd": None, "label": "", "text": text, "at": int(now * 1000),
                                   "status": "unknown"}
            else:
                self.heard_last = dict(m, n=self.n, text=text, at=int(now * 1000), status="queued")
            self.seq += 1
            self.cond.notify_all()
            item = dict(self.heard_last)
        if m and m["cmd"] in ("verse", "show-offer"):    # 26.11.27 done here: offered, or the offer shown
            got = None
            try:
                fn = self.show_verse if m["cmd"] == "verse" else self.confirm
                got = fn(m["text"]) if fn and m["cmd"] == "verse" else (fn() if fn else None)
            except Exception as e:
                print("Voice commands (verse):", e)
            with self.cond:
                h = self.heard_last
                if got and h and h["n"] == item["n"]:
                    said = got if isinstance(got, str) else m["label"].replace("Show ", "", 1)
                    h["label"] = ("%s offered: press Show" % said) if m["cmd"] == "verse" else ("Show " + said)
            msg = "That verse could not be offered." if m["cmd"] == "verse" else "No verse is waiting to be shown."
            self.done(item["n"], bool(got), "" if got else msg)
            item = dict(self.heard_last)
        return item

    def done(self, n, ok=True, msg=""):
        """The Studio ran it (or could not)."""
        with self.cond:
            h = self.heard_last
            if h and h["n"] == n and h["status"] == "queued":
                h["status"] = "done" if ok else "failed"
                h["msg"] = str(msg or "")[:200]
                self.seq += 1
                self.cond.notify_all()
        return self.body()

    def body(self, after=None, wait=0.0):
        end = time.monotonic() + max(0.0, min(WAIT_MAX, float(wait or 0)))
        with self.cond:
            while after is not None and self.seq <= after:
                left = end - time.monotonic()
                if left <= 0:
                    break
                self.cond.wait(left)
            seq, holding, partial = self.seq, self.holding, self.partial
            last = dict(self.heard_last) if self.heard_last else None
        cfg = self.settings() or {}
        st = self.voice.command_body() if self.listening else dict(self.last)
        key = parse_key(cfg.get("voiceKey", "rctrl"))
        return {"enabled": bool(cfg.get("voiceCommands")), "live": bool(self.is_live()), "ready": self.listening and st.get("state") == "listening",
                "state": st.get("state", "off"), "message": st.get("message", ""), "progress": st.get("progress", 0),
                "key": key[1] if key and self.key_down else "", "holding": holding, "search": self.searching(), "partial": partial, "last": last, "seq": seq,
                "commands": [{"cmd": c, "label": label, "say": phrases[0]} for c, label, phrases in COMMANDS]}
