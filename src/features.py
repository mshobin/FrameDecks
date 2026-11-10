"""FrameDecks 26.11.31 - features you switch on or off (Settings > Start here > Features, the Command Center's More chip,
and the Welcome's three ready-made sets).

The core is never a switch: the Studio, Frames, Decks, Go Live / Off air, Hide all, Black screen, the Emergency screen
and scripture and question cards. Everything below can be switched off; a feature that is off disappears from every
surface (its chips, the palette, voice, the phone remote) and its background work stops, so FrameDecks is lighter on
an older PC. Switches are kept in kc-app-settings.json ("features": {id: bool}); a PC that never chose has everything
on, so an update takes nothing away. They can only change while nothing is on air.

The same list is in app/js/features.js (tests/test_features_2611_31.py keeps the two equal)."""

# id, group, what the switch is called
FEATURES = (
    ("vcam", "screen", "FrameDecks vCam and Looks"),
    ("memory", "screen", "Memory Cards and Capture copies"),
    ("birthdays", "screen", "Birthdays"),
    ("seasons", "screen", "Seasons"),
    ("listen", "listening", "Listen for scripture"),
    ("voice", "listening", "Voice commands"),
    ("follow", "listening", "Teleprompter: Follow my voice"),
    ("remote", "people", "Phone remote"),
    ("team", "people", "Prayer wall, members’ phones and Sync"),
    ("summary", "after", "Meeting summary, sermon notes and Moment"),
    ("ready", "helpers", "Ready check and light hints"),
    ("guard", "helpers", "Lighter during meetings"),
    # 26.11.33
    ("songs", "screen", "Songs and lyrics"),
    ("nametags", "screen", "Speaker name tags"),
    ("responses", "people", "Polls and responses from members’ phones"),
    ("timing", "helpers", "Timing plan"),
)
IDS = tuple(f[0] for f in FEATURES)

# The camera's switch is "How people see it" itself (Share a window = no camera): one truth, never two.
DERIVED = ("vcam",)

# the Welcome's ready-made sets (the camera follows How people see it, chosen on the same page)
PRESETS = {
    "simple": {"memory": False, "birthdays": False, "seasons": False, "listen": False, "voice": False, "follow": False,
               "remote": False, "team": False, "summary": False, "ready": True, "guard": True,
               "songs": False, "nametags": False, "responses": False, "timing": True},
    "study": {"memory": True, "birthdays": True, "seasons": True, "listen": True, "voice": False, "follow": False,
              "remote": True, "team": False, "summary": True, "ready": True, "guard": True,
              "songs": True, "nametags": True, "responses": True, "timing": True},
    "full": {i: True for i in IDS if i not in DERIVED},
}

# settings a feature that is off holds off (its background work stops; switching it back on leaves them as they are,
# so nothing starts listening by itself)
HOLDS_OFF = {
    "listen": {"scriptureListen": False, "scriptureAuto": False, "scriptureMeeting": False},
    "voice": {"voiceCommands": False},
    "remote": {"remoteAutostart": False},
}


def valid(v):
    """The saved switches: {id: bool} for known, stored ids only."""
    return isinstance(v, dict) and all(k in IDS and k not in DERIVED and isinstance(b, bool) for k, b in v.items())


def effective(saved, people_see="both"):
    """Every feature's state: what was chosen, everything else on; the camera from How people see it."""
    saved = saved if valid(saved) else {}
    out = {i: bool(saved.get(i, True)) for i in IDS}
    out["vcam"] = people_see != "window"
    return out


def preset_of(eff):
    """The ready-made set these switches match, or "" (chosen one by one)."""
    for name, p in PRESETS.items():
        if all(eff.get(k) == v for k, v in p.items()):
            return name
    return ""


def held(eff):
    """The settings that must stay off while these features are off."""
    out = {}
    for fid, keys in HOLDS_OFF.items():
        if not eff.get(fid, True):
            out.update(keys)
    return out


def change(saved, people_see, body):
    """A request -> (new saved switches, new How people see it). body: {"preset": name} or {"set": {id: bool}}.
    Raises ValueError for anything else."""
    new = dict(saved) if valid(saved) else {}
    see = people_see
    if not isinstance(body, dict):
        raise ValueError("Send {preset} or {set}.")
    if "preset" in body:
        p = PRESETS.get(body.get("preset"))
        if p is None:
            raise ValueError("Choose simple, study or full.")
        new = dict(p)
    sets = body.get("set") or {}
    if not isinstance(sets, dict) or not all(k in IDS and isinstance(v, bool) for k, v in sets.items()):
        raise ValueError("Unknown feature.")
    if "preset" not in body and not sets:
        raise ValueError("Send {preset} or {set}.")
    for k, v in sets.items():
        if k == "vcam":
            see = ("both" if people_see == "window" else people_see) if v else "window"
        else:
            new[k] = v
    return new, see
