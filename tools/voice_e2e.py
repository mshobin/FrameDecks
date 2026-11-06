"""26.11 Follow my voice, end to end (run by .github/workflows/voice-files.yml on Linux).

Speaks a short Teleprompter script with espeak-ng, gives the sound to src/voice_worker.py with the real speech engine
and model, and checks that (1) the worker hears the script's words and (2) the Teleprompter's matcher
(app/js/voice-follow.js, in node) follows the reader to the end of the script, and stays put while off-script words
are spoken.

    python tools/voice_e2e.py --model DIR [--lib DIR]      (--lib: the vosk package folder, found when installed)"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ("Good evening everyone, and welcome to our study tonight. "
          "We are going to read together from the gospel of John, chapter three. "
          "Take a moment to open your Bible and find the passage. "
          "When you are ready, we will begin with a short prayer.")
OFF_SCRIPT = "the weather outside is cold and the traffic was terrible"


def tokens(text):
    out = subprocess.run(["node", "-e", "global.window={};require(process.argv[1]);"
                          "console.log(JSON.stringify(window.KCVoiceFollow.tokens(process.argv[2])))",
                          str(ROOT / "app/js/voice-follow.js"), text], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def speak(text, wav):
    raw = wav + ".raw.wav"
    subprocess.run(["espeak-ng", "-s", "150", "-w", raw, text], check=True)
    subprocess.run(["sox", raw, "-r", "16000", "-c", "1", "-b", "16", wav], check=True)


def hear(lib, model, wav, words):
    wf = wav + ".words.json"
    Path(wf).write_text(json.dumps(words), encoding="utf-8")
    p = subprocess.run([sys.executable, str(ROOT / "src/voice_worker.py"), "--lib", lib, "--model", model, "--wav", wav,
                        "--words-file", wf], capture_output=True, text=True, timeout=120,
                       env=dict(os.environ, FRAMEDECKS_VOICE_CHILD="1"))
    events = [json.loads(line) for line in p.stdout.splitlines() if line.startswith("{")]
    errors = [e for e in events if e["t"] == "error"]
    if errors or p.returncode:
        sys.exit("worker failed: %s %s" % (errors, p.stderr[-2000:]))
    return events


def follow(words, events):
    """Feed the events to the real matcher; → the position after each final."""
    js = ("global.window={};require(process.argv[1]);var V=window.KCVoiceFollow;"
          "var m=V.matcher(JSON.parse(process.argv[2]));var ev=JSON.parse(process.argv[3]);var out=[];"
          "ev.forEach(function(e){ if(e.t==='partial'||e.t==='final'){ m.hear(e.text, e.t==='final'); out.push(m.pos()); } });"
          "console.log(JSON.stringify(out))")
    out = subprocess.run(["node", "-e", js, str(ROOT / "app/js/voice-follow.js"), json.dumps(words), json.dumps(events)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--lib")
    a = ap.parse_args()
    lib = a.lib
    if not lib:
        import vosk                                     # noqa: F401  (only to find its folder)
        lib = os.path.dirname(vosk.__file__)
    words = tokens(SCRIPT)
    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, "script.wav")
    speak(SCRIPT, wav)
    events = hear(lib, a.model, wav, words)
    ready = [e for e in events if e["t"] == "ready"]
    heard = " ".join(e["text"] for e in events if e["t"] == "final").split()
    print("ready:", ready[0] if ready else None)
    print("heard:", " ".join(heard))
    got = len([w for w in heard if w in set(words)])
    if got < len(words) * 0.6:
        sys.exit("heard only %d of %d script words" % (got, len(words)))
    pos = follow(words, events)
    print("positions:", pos)
    if not pos or pos[-1] < len(words) - 4:
        sys.exit("the matcher stopped at word %s of %d" % (pos[-1] if pos else None, len(words)))
    # off-script talk: whatever is heard of it must not move the reader
    off = os.path.join(tmp, "off.wav")
    speak(OFF_SCRIPT, off)
    off_events = hear(lib, a.model, off, words)
    moved = follow(words, off_events)
    print("off-script positions:", moved)
    if moved and max(moved) > 6:
        sys.exit("off-script talk moved the reader to word %d" % max(moved))
    print("Follow my voice: end to end OK (%d of %d words heard)" % (got, len(words)))


if __name__ == "__main__":
    main()
