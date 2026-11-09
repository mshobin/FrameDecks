"""FrameDecks 26.11.28 - the ready check, before you go live: one card that looks at everything at once.

    Camera        the webcam works (FrameDecks vCam)
    Light & framing  your face is lit and in the middle (src/vcam/hints.py), as gentle suggestions
    Microphone    there is one
    Meeting app   Zoom, Teams or Meet is open (src/meeting_keys.py)
    Scriptures    every scripture in this meeting has its words
    Media         every picture, video and slide is on this PC (server.media_check)
    This PC       plugged in, battery saver off, enough free memory (src/meeting_guard.py)

Each line is ok, warn (worth a look), fail (fix it first) or off (cannot be checked here), with one plain sentence and,
where there is one, the one button that fixes it. Nothing is changed by itself and Go Live is never blocked. build() takes
what was read, so it is the same on every PC and in the tests; GET /api/app/ready reads it (src/server.py)."""

LOW_MEMORY_MB = 800        # free memory below this is worth a word


def meeting_scenes(state):
    """The Frames of the meeting this PC shows (as KCScenes.order): live.meeting, else the meeting details' name,
    else the first; a Frame belongs to the meeting its group names, else to the first."""
    st = state if isinstance(state, dict) else {}
    mt = st.get("meeting") if isinstance(st.get("meeting"), dict) else {}
    meetings = [m for m in mt.get("meetings") or [] if isinstance(m, dict) and m.get("name")]
    scenes = [s for s in st.get("scenes") or [] if isinstance(s, dict) and not s.get("tpl")]
    if len(meetings) < 2:
        return scenes
    want = (st.get("live") or {}).get("meeting") if isinstance(st.get("live"), dict) else None
    title = str(mt.get("title") or "").strip().lower()
    cur = next((m for m in meetings if m.get("id") == want), None) or next(
        (m for m in meetings if str(m["name"]).lower() == title), None) or meetings[0]
    names = {str(m["name"]).lower() for m in meetings}

    def of(sc):
        g = str(sc.get("group") or "").strip().lower()
        return g if g in names else str(meetings[0]["name"]).lower()
    return [s for s in scenes if of(s) == str(cur["name"]).lower()]


def verses_without_words(scenes):
    """The scripture references in these Frames whose words are not there yet, in plan order, each once."""
    out = []
    for sc in scenes:
        for layer in sc.get("layers") or []:
            if not isinstance(layer, dict) or layer.get("kind") != "scripture":
                continue
            for it in ((layer.get("c") or {}).get("items") or []):
                ref = str((it or {}).get("ref") or "").strip()
                if ref and not str((it or {}).get("text") or "").strip() and ref not in out:
                    out.append(ref)
    return out


def _names(items, n=3):
    return ", ".join(items[:n]) + (" and %d more" % (len(items) - n) if len(items) > n else "")


def build(vcam=None, hints=None, mics=None, meeting=None, scenes=None, missing=None, guard=None, memory=None):
    """What was read -> {"ready": no fail, "warn": count, "items": [...]}.
    vcam: {"available", "reason", "status": {...}} · hints: src/vcam/hints.look() · mics: [{id, name}] or None (not
    Windows) · meeting: meeting_keys.status() · scenes: this meeting's Frames · missing: server.media_check() ·
    guard: {"cameras": [...], "power": {...}} · memory: {"freeMB", ...}."""
    items = []

    def add(i, label, state, text, action=None, more=None):
        items.append({k: v for k, v in (("id", i), ("label", label), ("state", state), ("text", text),
                                         ("action", action), ("more", more)) if v is not None})

    # the camera
    v = vcam or {}
    st = v.get("status") or {}
    closable = [c for c in (guard or {}).get("cameras") or [] if c.get("closable")]
    if not v.get("available"):
        add("camera", "Camera", "off", v.get("reason") or "FrameDecks vCam is not running on this PC.")
    elif st.get("state") == "error":
        add("camera", "Camera", "fail", st.get("message") or "The webcam is not sending pictures. Check it is connected.")
    elif closable:
        add("camera", "Camera", "warn", "The Windows Camera app is using your webcam. Close it so your meeting has it.", "close-camera")
    elif st.get("state") == "starting":
        add("camera", "Camera", "warn", "Starting the webcam…")
    else:
        fps = st.get("fps") or 0
        add("camera", "Camera", "ok", "The camera works" + (" (%d frames a second)" % round(fps) if fps else "") + ".")

    # light and framing
    if v.get("available") and st.get("state") != "error":
        if not hints:
            add("look", "Light & framing", "off", "Looking at the camera picture…")
        elif hints.get("tips"):
            add("look", "Light & framing", "warn", hints["tips"][0], more=hints["tips"][1:] or None)
        else:
            add("look", "Light & framing", "ok", "Good light, and you're in the middle of the picture.")

    # the microphone
    if mics is None:
        add("mic", "Microphone", "off", "Checked in the FrameDecks app on Windows.")
    else:
        real = [m for m in mics if m.get("id", -1) != -1]
        if not real:
            add("mic", "Microphone", "fail", "No microphone found. Plug one in, or check Windows sound settings.")
        else:
            add("mic", "Microphone", "ok", real[0].get("name", "A microphone") + (" and %d more" % (len(real) - 1) if len(real) > 1 else "") + ".")

    # the meeting app
    m = meeting or {}
    if not m.get("available"):
        add("meeting", "Meeting app", "off", "Checked in the FrameDecks app on Windows.")
    elif m.get("app"):
        add("meeting", "Meeting app", "ok", (m.get("name") or "Your meeting app") + " is open.")
    else:
        add("meeting", "Meeting app", "warn", "Open Zoom, Teams or Meet before you go live.")

    # scriptures and media in this meeting
    sc = scenes or []
    empty = verses_without_words(sc)
    if empty:
        add("verses", "Scriptures", "warn", "%d without words yet: %s." % (len(empty), _names(empty)), "fetch-verses")
    else:
        add("verses", "Scriptures", "ok", "Every scripture has its words." if any(
            l.get("kind") == "scripture" for s in sc for l in s.get("layers") or [] if isinstance(l, dict)) else "No scriptures in this meeting.")
    ids = {s.get("id") for s in sc}
    gone = [f for x in (missing or []) if x.get("frame") in ids for f in x.get("files") or []]
    if gone:
        add("media", "Media", "fail", "%d missing on this PC: %s." % (len(gone), _names(gone)), "media")
    else:
        add("media", "Media", "ok", "Every picture, video and slide is here.")

    # this PC
    p = (guard or {}).get("power") or {}
    free = (memory or {}).get("freeMB")
    if p.get("saver"):
        add("pc", "This PC", "warn", "Battery saver is on, which slows the picture. Plug in, or turn it off.", "power")
    elif p.get("onBattery"):
        add("pc", "This PC", "warn", "Running on battery. Plug in for the whole meeting.")
    elif free is not None and free < LOW_MEMORY_MB:
        add("pc", "This PC", "warn", "Short of free memory (%d MB). Close programs you don't need." % free)
    else:
        add("pc", "This PC", "ok", "Plugged in, with room to spare." if p else "Room to spare.")

    return {"ready": not any(i["state"] == "fail" for i in items), "warn": sum(i["state"] == "warn" for i in items),
            "items": items}
