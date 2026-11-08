"""FrameDecks 26.11 - Follow my voice: the listening process.

Started by src/voice_follow.py only while the Teleprompter's "Follow my voice" is on, and ended when it is turned off,
so it costs nothing the rest of the time. It runs apart from the app (a problem here can never freeze the app or the
meeting) at below-normal priority.

It hears the microphone (Windows waveIn, built into Windows: no extra package) at 16 kHz, mono, and gives the sound to
the Vosk speech engine (libvosk, loaded with ctypes from the files downloaded on first use) with a grammar of only the
words in the script: far cheaper and more accurate than open dictation. Silence is not processed at all.

Talks over stdin / stdout, one JSON object per line.
  out: {"t": "ready", "known": n, "unknown": n}   {"t": "partial", "text": ...}   {"t": "final", "text": ...}
       {"t": "level", "v": 0..1}   {"t": "error", "msg": ...}
  in:  {"words": [...]} (a new script: the grammar is rebuilt)   {"sensitivity": 1..5}   {"quit": true}
26.11.14 Listen for scripture shares this one process (one microphone, one model in memory) with a second, small grammar:
  in:  {"scripture": [...]} (its words: src/scripture_speech.py)   {"scripture": null} (stop)   {"words": null} (the
       Teleprompter stopped; scripture listening goes on)
  out: {"t": "final" | "partial", "text": ..., "g": "scripture"} ("[unk]" kept, so unrelated words are never joined);
       "ready" too. 26.11.14 partials as well, so a reference is seen while the speaker carries on talking
26.11.20 Voice commands (hold to talk) share it too, with a third grammar that hears only while it is held:
  in:  {"command": [...]} (its words: src/voice_commands.py)   {"command": null} (stop)   {"hold": true | false}
  out: {"t": "partial", "text": ..., "g": "command"} while held, then one {"t": "final", "text": ..., "g": "command"}
       when it is let go (also empty: nothing was understood). While held the other grammars hear nothing: what is
       said to FrameDecks never moves the script or offers a verse.

    voice_worker.py --lib DIR --model DIR [--device N] [--sensitivity 3] [--wav FILE] [--words-file FILE]
--wav reads a 16 kHz mono WAV file instead of the microphone (tests, tools/voice_e2e.py); --words-file gives the first
script (otherwise it waits for one on stdin). Nothing is written to disk and nothing leaves the PC."""
import argparse
import array
import ctypes
import json
import math
import os
import sys
import threading
import time
import wave

RATE = 16000
CHUNK = 1600                 # 0.1 s of 16-bit samples
SILENCE_END = 0.7            # seconds of quiet that end a phrase
# the quiet level per sensitivity (1 = only a loud, close voice; 5 = a soft voice in a quiet room); RMS of int16
THRESHOLDS = {1: 1400, 2: 900, 3: 550, 4: 330, 5: 190}
CHILD_ENV = "FRAMEDECKS_VOICE_CHILD"     # set by src/voice_follow.py when it starts this process


def say(obj):
    try:
        sys.stdout.write(json.dumps(obj) + "\n")
        sys.stdout.flush()
    except (OSError, ValueError):
        os._exit(0)                             # the app has gone: so do we


def rms(data):
    a = array.array("h")
    a.frombytes(data[: len(data) - len(data) % 2])
    if not a:
        return 0.0
    if sys.byteorder != "little":
        a.byteswap()
    return math.sqrt(sum(x * x for x in a) / len(a))


# ---------- the speech engine (libvosk, ctypes) ----------
class Engine:
    def __init__(self, lib_dir, model_dir):
        if os.name == "nt":
            if hasattr(os, "add_dll_directory"):
                self._dll_dir = os.add_dll_directory(lib_dir)
            os.environ["PATH"] = lib_dir + os.pathsep + os.environ.get("PATH", "")
            name = "libvosk.dll"
        else:
            name = "libvosk.so" if sys.platform != "darwin" else "libvosk.dyld"
        lib = ctypes.CDLL(os.path.join(lib_dir, name))
        P = ctypes.c_void_p
        lib.vosk_set_log_level.argtypes = [ctypes.c_int]
        lib.vosk_model_new.restype = P
        lib.vosk_model_new.argtypes = [ctypes.c_char_p]
        lib.vosk_model_find_word.restype = ctypes.c_int
        lib.vosk_model_find_word.argtypes = [P, ctypes.c_char_p]
        lib.vosk_recognizer_new_grm.restype = P
        lib.vosk_recognizer_new_grm.argtypes = [P, ctypes.c_float, ctypes.c_char_p]
        lib.vosk_recognizer_accept_waveform.restype = ctypes.c_int
        lib.vosk_recognizer_accept_waveform.argtypes = [P, ctypes.c_char_p, ctypes.c_int]
        for f in ("vosk_recognizer_result", "vosk_recognizer_partial_result", "vosk_recognizer_final_result"):
            getattr(lib, f).restype = ctypes.c_char_p
            getattr(lib, f).argtypes = [P]
        lib.vosk_recognizer_free.argtypes = [P]
        lib.vosk_set_log_level(-1)
        self.lib = lib
        self.model = lib.vosk_model_new(model_dir.encode("utf-8"))
        if not self.model:
            raise RuntimeError("The voice model could not be loaded.")
        self.rec = None
        self.keep_unk = False

    def sibling(self):
        """26.11.14 a second recognizer on the same model (no second copy of the model in memory)."""
        twin = object.__new__(Engine)
        twin.lib, twin.model, twin.rec, twin.keep_unk = self.lib, self.model, None, True
        return twin

    def grammar(self, words):
        """Only the script's words (those the model knows) plus [unk] for everything else said."""
        known, unknown = [], 0
        for w in dict.fromkeys(str(x).lower() for x in words if x):
            if len(known) >= 4000:
                break
            if self.lib.vosk_model_find_word(self.model, w.encode("utf-8")) >= 0:
                known.append(w)
            else:
                unknown += 1
        if self.rec:
            self.lib.vosk_recognizer_free(self.rec)
        self.rec = self.lib.vosk_recognizer_new_grm(self.model, float(RATE), json.dumps(known + ["[unk]"]).encode("utf-8"))
        return len(known), unknown

    def feed(self, data):
        """→ ('final', text) | ('partial', text)"""
        if self.lib.vosk_recognizer_accept_waveform(self.rec, data, len(data)):
            return "final", self._text(self.lib.vosk_recognizer_result(self.rec), "text", self.keep_unk)
        return "partial", self._text(self.lib.vosk_recognizer_partial_result(self.rec), "partial", self.keep_unk)

    def finish(self):
        return self._text(self.lib.vosk_recognizer_final_result(self.rec), "text", self.keep_unk)

    @staticmethod
    def _text(raw, key, keep_unk=False):
        try:
            t = json.loads((raw or b"{}").decode("utf-8", "replace")).get(key, "")
        except ValueError:
            return ""
        words = [w for w in t.split() if keep_unk or w != "[unk]"]
        return "" if all(w == "[unk]" for w in words) else " ".join(words)


# ---------- the microphone (Windows waveIn) ----------
class WAVEFORMATEX(ctypes.Structure):
    _fields_ = [("wFormatTag", ctypes.c_ushort), ("nChannels", ctypes.c_ushort), ("nSamplesPerSec", ctypes.c_uint32),
                ("nAvgBytesPerSec", ctypes.c_uint32), ("nBlockAlign", ctypes.c_ushort), ("wBitsPerSample", ctypes.c_ushort),
                ("cbSize", ctypes.c_ushort)]


class WAVEHDR(ctypes.Structure):
    pass


WAVEHDR._fields_ = [("lpData", ctypes.c_void_p), ("dwBufferLength", ctypes.c_uint32), ("dwBytesRecorded", ctypes.c_uint32),
                    ("dwUser", ctypes.c_size_t), ("dwFlags", ctypes.c_uint32), ("dwLoops", ctypes.c_uint32),
                    ("lpNext", ctypes.POINTER(WAVEHDR)), ("reserved", ctypes.c_size_t)]


class WAVEINCAPSW(ctypes.Structure):
    _fields_ = [("wMid", ctypes.c_ushort), ("wPid", ctypes.c_ushort), ("vDriverVersion", ctypes.c_uint32),
                ("szPname", ctypes.c_wchar * 32), ("dwFormats", ctypes.c_uint32), ("wChannels", ctypes.c_ushort),
                ("wReserved1", ctypes.c_ushort)]


WAVE_MAPPER = 0xFFFFFFFF
WHDR_DONE = 1
CALLBACK_EVENT = 0x00050000


def microphones():
    """[{id, name}] of the PC's microphones (Windows only); id -1 is the Windows default."""
    if os.name != "nt":
        return []
    out = [{"id": -1, "name": "Windows default microphone"}]
    try:
        winmm = ctypes.WinDLL("winmm")
        for i in range(min(32, winmm.waveInGetNumDevs())):
            caps = WAVEINCAPSW()
            if winmm.waveInGetDevCapsW(i, ctypes.byref(caps), ctypes.sizeof(caps)) == 0:
                out.append({"id": i, "name": caps.szPname or "Microphone %d" % (i + 1)})
    except OSError:
        pass
    return out


class Microphone:
    def __init__(self, device=-1, buffers=4):
        self.winmm = ctypes.WinDLL("winmm")
        k32 = ctypes.WinDLL("kernel32")
        k32.CreateEventW.restype = ctypes.c_void_p
        k32.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
        self.k32, self.event = k32, k32.CreateEventW(None, False, False, None)
        fmt = WAVEFORMATEX(1, 1, RATE, RATE * 2, 2, 16, 0)
        self.h = ctypes.c_void_p()
        dev = WAVE_MAPPER if device is None or int(device) < 0 else int(device)
        err = self.winmm.waveInOpen(ctypes.byref(self.h), ctypes.c_uint(dev), ctypes.byref(fmt), ctypes.c_size_t(self.event or 0),
                                    ctypes.c_size_t(0), ctypes.c_uint32(CALLBACK_EVENT))
        if err:
            raise RuntimeError("The microphone could not be opened (code %d)." % err)
        self.bufs, self.hdrs = [], []
        for _ in range(buffers):
            b = ctypes.create_string_buffer(CHUNK * 2)
            hd = WAVEHDR()
            hd.lpData, hd.dwBufferLength = ctypes.cast(b, ctypes.c_void_p), CHUNK * 2
            self.winmm.waveInPrepareHeader(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
            self.winmm.waveInAddBuffer(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
            self.bufs.append(b)
            self.hdrs.append(hd)
        self.next = 0
        self.winmm.waveInStart(self.h)

    def read(self):
        """The next 0.1 s of sound (waits for it), or None after 2 s without any."""
        hd, b = self.hdrs[self.next], self.bufs[self.next]
        waited = 0
        while not hd.dwFlags & WHDR_DONE:
            self.k32.WaitForSingleObject(self.event, 200)
            waited += 1
            if waited > 10:
                return None
        data = b.raw[: hd.dwBytesRecorded]
        hd.dwFlags &= ~WHDR_DONE
        self.winmm.waveInAddBuffer(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
        self.next = (self.next + 1) % len(self.hdrs)
        return data

    def close(self):
        try:
            self.winmm.waveInStop(self.h)
            self.winmm.waveInReset(self.h)
            for hd in self.hdrs:
                self.winmm.waveInUnprepareHeader(self.h, ctypes.byref(hd), ctypes.sizeof(hd))
            self.winmm.waveInClose(self.h)
        except OSError:
            pass


class WavFile:
    """A 16 kHz mono 16-bit WAV file as if it were a microphone (tests); fast=True does not wait in real time."""
    def __init__(self, path, fast=True):
        self.w, self.fast = wave.open(path, "rb"), fast
        if (self.w.getframerate(), self.w.getnchannels(), self.w.getsampwidth()) != (RATE, 1, 2):
            raise RuntimeError("The test audio must be 16 kHz, mono, 16-bit.")
        self.tail = 15                          # then 1.5 s of silence, so the last phrase ends

    def read(self):
        data = self.w.readframes(CHUNK)
        if not data:
            if self.tail <= 0:
                return b""
            self.tail -= 1
            data = b"\0" * (CHUNK * 2)
        if not self.fast:
            time.sleep(0.1)
        return data

    def close(self):
        self.w.close()


# ---------- the loop ----------
class Listener:
    def __init__(self, engine, source, sensitivity=3):
        self.engine, self.source, self.lock = engine, source, threading.Lock()
        self.threshold = THRESHOLDS.get(int(sensitivity), THRESHOLDS[3])
        self.quit = False
        self.script_on = False
        self.scripture = None                     # 26.11.14 the second recognizer (Listen for scripture), when on
        self.cmd, self.cmd_words, self.cmd_hold = None, [], False    # 26.11.20 voice commands: heard only while held
        self.cmd_said = []                        # what was settled while still held (a pause in the middle)

    @property
    def has_words(self):
        return self.script_on or self.scripture is not None

    def command(self, msg):
        if msg.get("quit"):
            self.quit = True
        if isinstance(msg.get("sensitivity"), int):
            self.threshold = THRESHOLDS.get(msg["sensitivity"], self.threshold)
        if isinstance(msg.get("words"), list):
            with self.lock:
                known, unknown = self.engine.grammar(msg["words"])
                self.script_on = True
            say({"t": "ready", "known": known, "unknown": unknown})
        elif "words" in msg and msg["words"] is None:
            with self.lock:
                self.script_on = False
        if isinstance(msg.get("scripture"), list):
            with self.lock:
                twin = self.scripture or self.engine.sibling()
                known, unknown = twin.grammar(msg["scripture"])
                self.scripture = twin
            say({"t": "ready", "known": known, "unknown": unknown, "g": "scripture"})
        elif "scripture" in msg and msg["scripture"] is None:
            with self.lock:
                self.scripture = None
        if isinstance(msg.get("command"), list):
            with self.lock:
                twin = self.cmd or self.engine.sibling()
                known, unknown = twin.grammar(msg["command"])
                self.cmd, self.cmd_words = twin, list(msg["command"])
            say({"t": "ready", "known": known, "unknown": unknown, "g": "command"})
        elif "command" in msg and msg["command"] is None:
            with self.lock:
                self.cmd, self.cmd_hold = None, False
        if msg.get("hold") is True:
            with self.lock:
                if self.cmd is not None:
                    self.cmd.grammar(self.cmd_words)          # a fresh start: nothing of the last saying is left
                    self.cmd_said, self.cmd_hold = [], True
        elif msg.get("hold") is False:
            text = None
            with self.lock:
                if self.cmd is not None and self.cmd_hold:
                    self.cmd_hold = False
                    text = " ".join(t for t in self.cmd_said + [self.cmd.finish()] if t).strip()
            if text is not None:
                self._say("final", text, "command")

    def _feed(self, data):
        """Give the sound to every grammar that is on: [(kind, text, g)]."""
        out = []
        if self.script_on:
            out.append(self.engine.feed(data) + (None,))
        if self.scripture is not None:
            out.append(self.scripture.feed(data) + ("scripture",))
        return out

    def _finish(self):
        out = []
        if self.script_on:
            out.append(("final", self.engine.finish(), None))
        if self.scripture is not None:
            out.append(("final", self.scripture.finish(), "scripture"))
        return out

    @staticmethod
    def _say(kind, text, g):
        ev = {"t": kind, "text": text}
        if g:
            ev["g"] = g
        say(ev)

    def run(self):
        quiet, talking, last_partial, last_level, before = 0.0, False, "", 0.0, None
        last_sp = ""                              # 26.11.14 the scripture listener's last partial (sent only when it changes)
        last_cmd = ""                             # 26.11.20 the command listener's last partial
        while not self.quit:
            data = self.source.read()
            if data is None:
                say({"t": "error", "msg": "The microphone stopped sending sound."})
                return
            if not data:
                return                            # the test file is over
            level = rms(data)
            now = time.monotonic()
            if now - last_level >= 0.25:
                say({"t": "level", "v": round(min(1.0, level / 3000.0), 2)})
                last_level = now
            if self.cmd_hold:                     # 26.11.20 held: every sound goes to the commands, and only there
                text = None
                with self.lock:
                    if self.cmd_hold and self.cmd is not None:
                        kind, text = self.cmd.feed(data)
                        if kind == "final" and text:
                            self.cmd_said.append(text)
                            text = ""
                        text = " ".join(t for t in self.cmd_said + [text] if t)
                if text and text != last_cmd:
                    self._say("partial", text, "command")
                    last_cmd = text
                talking, quiet, last_partial, last_sp = False, 0.0, "", ""
                continue
            last_cmd = ""
            if not self.has_words:
                continue
            if level < self.threshold:
                quiet += 0.1
                if not talking:
                    before = data                 # keep the last quiet moment: words start just before they are loud
                    continue                      # silence: nothing to process
                if quiet >= SILENCE_END:          # the phrase is over
                    with self.lock:
                        self._feed(data)
                        ends = self._finish()
                    for kind, text, g in ends:
                        if text:
                            self._say("final", text, g)
                    talking, last_partial, last_sp = False, "", ""
                    continue
            else:
                quiet = 0.0
                if not talking:
                    talking = True
                    if before:
                        with self.lock:
                            self._feed(before)
            with self.lock:
                heard = self._feed(data)
            for kind, text, g in heard:
                if kind == "final":
                    if text:
                        self._say("final", text, g)
                    if not g:
                        last_partial = ""
                    else:
                        last_sp = ""
                elif not g and text and text != last_partial:
                    say({"t": "partial", "text": text})
                    last_partial = text
                elif g and text and text != last_sp:      # 26.11.14 scripture reads partials too: it need not wait for a pause
                    self._say("partial", text, g)
                    last_sp = text


def _below_normal():
    if os.name == "nt":
        try:
            k32 = ctypes.WinDLL("kernel32")
            k32.SetPriorityClass(k32.GetCurrentProcess(), 0x00004000)     # BELOW_NORMAL_PRIORITY_CLASS
        except OSError:
            pass


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--lib", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--device", type=int, default=-1)
    ap.add_argument("--sensitivity", type=int, default=3)
    ap.add_argument("--wav")
    ap.add_argument("--words-file")
    ap.add_argument("--scripture", action="store_true", help="also listen for scripture references (tests)")
    a, _ = ap.parse_known_args(argv)
    if os.environ.get(CHILD_ENV) != "1":
        say({"t": "error", "msg": "Follow my voice starts only from the FrameDecks Teleprompter."})
        return 2                                  # never from a link or by hand: only the app sets this
    _below_normal()
    try:
        engine = Engine(a.lib, a.model)
        source = WavFile(a.wav) if a.wav else Microphone(a.device)
    except (OSError, RuntimeError) as e:
        say({"t": "error", "msg": str(e) or "The voice engine could not start."})
        return 1
    lis = Listener(engine, source, a.sensitivity)
    if a.words_file:
        with open(a.words_file, encoding="utf-8") as f:
            lis.command({"words": json.load(f)})
    if a.scripture:
        from scripture_speech import grammar_words
        lis.command({"scripture": grammar_words()})

    def commands():
        for line in sys.stdin:
            try:
                msg = json.loads(line)
            except ValueError:
                continue
            if isinstance(msg, dict):
                lis.command(msg)
        lis.quit = True                           # stdin closed: the app has gone
    if not a.wav:
        threading.Thread(target=commands, daemon=True).start()
    try:
        lis.run()
    finally:
        source.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
