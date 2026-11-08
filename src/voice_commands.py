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
Nothing heard is recorded, kept or sent anywhere."""
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
    ("show-question", "Show the question", ("show question", "show the question", "question")),
    ("show-verse", "Show the scripture", ("show scripture", "show the scripture", "scripture", "show verse", "show the verse")),
    ("show-both", "Show both", ("show both", "both")),
    ("hide", "Hide all", ("hide all", "hide everything", "hide", "clear screen", "clear the screen", "clear")),
    ("black", "Black screen", ("black screen", "black", "go black", "blackout")),
    ("unblack", "Picture back", ("picture back", "screen back", "show picture", "show the picture", "back on")),
    ("freeze", "Freeze", ("freeze", "freeze picture", "freeze the picture", "hold picture")),
    ("unfreeze", "Unfreeze", ("unfreeze", "resume", "move again", "go on")),
    ("mute", "Mute / unmute", ("mute", "unmute", "mute me", "unmute me", "microphone")),
    ("camera", "Camera on / off", ("camera", "camera on", "camera off", "video on", "video off")),
)
NEVER = ("golive", "leave", "share", "emergency")                  # stay a press, never a voice command
SHOW_WORDS = {"show", "put", "display", "open", "read"}


def _words(text):
    return [w for w in str(text or "").lower().replace("-", " ").split() if w and w != "[unk]"]


def grammar_words():
    """Every word the command listener needs: the commands, "frame" numbers, and Bible references."""
    out = set(SHOW_WORDS) | {"frame", "go", "to", "number"}
    for _, _, phrases in COMMANDS:
        for p in phrases:
            out.update(p.split())
    out.update(scripture_speech.grammar_words())
    return sorted(out)


def _find(seq, sub):
    n = len(sub)
    return any(seq[i:i + n] == sub for i in range(len(seq) - n + 1))


def match(text):
    """What was said -> {"cmd", "label", ...} or None. A Bible reference wins ("show John three sixteen"), then
    "frame <n>" (go to that Frame), then the longest command phrase heard. A phrase counts only when it is nearly all
    that was said (two words more at most), so a sentence that merely contains "go back" is not a command."""
    words = _words(text)
    if not words:
        return None
    ref = scripture_speech.find(" ".join(words))
    if ref:
        return {"cmd": "verse", "label": "Show " + ref["label"], "ref": ref["ref"], "text": " ".join(words)}
    if "frame" in words:
        i = words.index("frame")
        num = scripture_speech.number(words, i + 1) if i + 1 < len(words) else None
        if num and num[0] <= 200:
            return {"cmd": "frame", "label": "Frame %d" % num[0], "frame": num[0]}
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
    if best:
        return {"cmd": best[1], "label": best[2]}
    return None


class VoiceCommands:
    def __init__(self, voice, settings, is_live, show_verse=None, key_down=None, clock=time.time):
        self.voice, self.settings, self.is_live, self.clock = voice, settings, is_live, clock
        self.show_verse = show_verse              # text -> True when a verse was asked to show (Listen for scripture)
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
        return bool(cfg.get("voiceCommands")) and bool(self.is_live())

    def tick(self):
        want = self._want()
        if want and not self.listening and not self.failed:
            self.listening = True
            self.last = self.voice.command_start(grammar_words(), self.heard) or {}
            if self.last.get("state") in ("unavailable", "memory", "error"):
                self.listening, self.failed = False, True
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
            if not self.is_live():
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
        m = match(text) if text else None
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
        if m and m["cmd"] == "verse":
            ok = False
            try:
                ok = bool(self.show_verse and self.show_verse(m["text"]))
            except Exception as e:
                print("Voice commands (verse):", e)
            self.done(item["n"], ok, "" if ok else "That verse could not be shown.")
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
                "key": key[1] if key and self.key_down else "", "holding": holding, "partial": partial, "last": last, "seq": seq,
                "commands": [{"cmd": c, "label": label, "say": phrases[0]} for c, label, phrases in COMMANDS]}
