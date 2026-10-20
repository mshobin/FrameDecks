"""Finding and opening the webcam, and explaining clearly when Windows won't let us.

- Webcams are listed (and remembered) by name, through Windows Media Foundation and DirectShow.
- KingdomConnect itself is always skipped, so the engine can never capture its own picture.
- If a webcam won't open, Windows' own records are read (read-only) to say why: privacy settings,
  or which program is currently using the webcam.
"""
import os
import re
import time

import cv2

OWN_NAMES = ("kingdomconnect", "bcc vcam")   # the camera's name, and its name before 6.4
IR_HINT = re.compile(r"\b(ir|infrared)\b|hello", re.I)   # Windows Hello face sign-in cameras


def _backends():
    out = []
    if os.name == "nt":
        out = [("msmf", cv2.CAP_MSMF), ("dshow", cv2.CAP_DSHOW)]
    return out


def list_cameras():
    """[{name, backend, index, ir}] for every webcam, KingdomConnect excluded. Never turns a webcam on."""
    try:
        from cv2_enumerate_cameras import enumerate_cameras
    except Exception:
        return []
    found = []
    for label, api in _backends():
        try:
            items = enumerate_cameras(api)
        except Exception:
            continue
        for c in items:
            name = (c.name or "").strip() or "Camera"
            if any(n in name.lower() for n in OWN_NAMES):
                continue
            found.append({"name": name, "backend": label, "index": c.index, "ir": bool(IR_HINT.search(name))})
    return found


def camera_names(cams):
    """Unique names for the Settings list, usable cameras first."""
    names = []
    for c in sorted(cams, key=lambda c: c["ir"]):
        if c["name"] not in names:
            names.append(c["name"])
    return names


def default_name(cams):
    for c in cams:
        if not c["ir"]:
            return c["name"]
    return cams[0]["name"] if cams else ""


# ---------- Why can't the webcam be opened? (read-only look at Windows' records) ----------
CONSENT = r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam"
FRIENDLY = {"zoom.exe": "Zoom", "ms-teams.exe": "Microsoft Teams", "teams.exe": "Microsoft Teams",
            "camo studio.exe": "Camo Studio", "camo.exe": "Camo", "obs64.exe": "OBS Studio", "obs32.exe": "OBS Studio",
            "webex.exe": "Webex", "skype.exe": "Skype", "discord.exe": "Discord", "chrome.exe": "Google Chrome",
            "msedge.exe": "Microsoft Edge", "firefox.exe": "Firefox"}


def _friendly(key_name):
    if "#" in key_name or "\\" in key_name:                       # desktop app: C:#Program Files#Zoom#bin#Zoom.exe
        exe = key_name.replace("#", "\\").split("\\")[-1]
        return FRIENDLY.get(exe.lower(), exe)
    if "windowscamera" in key_name.lower():
        return "the Windows Camera app"
    if "msteams" in key_name.lower():
        return "Microsoft Teams"
    return key_name.split("_")[0].split(".")[-1]                  # store app: Microsoft.WindowsCamera_8wekyb...


def camera_blockers(winreg=None):
    """{'deviceOff', 'appsOff', 'desktopAppsOff', 'inUseBy': [names]} from the Windows registry (read-only)."""
    res = {"deviceOff": False, "appsOff": False, "desktopAppsOff": False, "inUseBy": []}
    if winreg is None:
        if os.name != "nt":
            return res
        import winreg as wr
        winreg = wr

    def value(hive, path, name):
        try:
            with winreg.OpenKey(hive, path) as k:
                return winreg.QueryValueEx(k, name)[0]
        except OSError:
            return None
    res["deviceOff"] = value(winreg.HKEY_LOCAL_MACHINE, CONSENT, "Value") == "Deny"
    res["appsOff"] = value(winreg.HKEY_CURRENT_USER, CONSENT, "Value") == "Deny"
    res["desktopAppsOff"] = value(winreg.HKEY_CURRENT_USER, CONSENT + r"\NonPackaged", "Value") == "Deny"
    me = os.path.basename(getattr(__import__("sys"), "executable", "")).lower()
    for path in (CONSENT + r"\NonPackaged", CONSENT):
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, path) as k:
                i = 0
                while True:
                    try:
                        sub = winreg.EnumKey(k, i)
                    except OSError:
                        break
                    i += 1
                    if sub == "NonPackaged":
                        continue
                    start = value(winreg.HKEY_CURRENT_USER, path + "\\" + sub, "LastUsedTimeStart") or 0
                    stop = value(winreg.HKEY_CURRENT_USER, path + "\\" + sub, "LastUsedTimeStop")
                    if start and stop == 0:                         # started and not yet stopped = using it now
                        who = _friendly(sub)
                        if who.lower() != me and "kingdom connect" not in sub.lower() and who not in res["inUseBy"]:
                            res["inUseBy"].append(who)
        except OSError:
            pass
    return res


def explain(blockers):
    """A plain-English reason and fix, or '' if Windows' records show nothing."""
    if blockers["deviceOff"] or blockers["appsOff"]:
        return ("Windows privacy settings are blocking the camera. Open Settings → Privacy & security → Camera, "
                "turn on “Camera access”, and also “Let desktop apps access your camera”.")
    if blockers["desktopAppsOff"]:
        return ("Windows privacy settings are blocking desktop apps from the camera. Open Settings → Privacy & security → "
                "Camera and turn on “Let desktop apps access your camera”.")
    if blockers["inUseBy"]:
        who = " and ".join(blockers["inUseBy"])
        tip = ""
        if any(w in ("Zoom", "Microsoft Teams") for w in blockers["inUseBy"]):
            tip = " In Zoom or Teams, choose “KingdomConnect” as the camera instead of your webcam."
        return f"Your webcam is being used by {who}, and only one app can use it at a time.{tip} Or close {who}."
    return ""


class CameraUnavailable(RuntimeError):
    pass


class Camera:
    """Opens the chosen webcam: Media Foundation first, DirectShow as a second try (never KingdomConnect).
    Only counts as open once a real picture has arrived."""
    def __init__(self, name, width, height, cams=None, fps=30, pixel_format="auto"):
        cams = list_cameras() if cams is None else cams
        tries = [(c["backend"], c["index"]) for c in cams if c["name"] == name] if name else []
        if not tries and os.name == "nt":
            tries = [("msmf", 0)]                     # nothing listed: try the first webcam
        if os.name != "nt":
            tries = [("any", 0)]
        last = None
        self.info = ""
        self.controls, self._applied = {}, None
        # Webcam mode to ask for: "auto" = MJPG first, then the webcam's default mode (see below)
        fourccs = {"auto": ("MJPG", None), "mjpg": ("MJPG", None), "yuy2": ("YUY2", None), "nv12": ("NV12", None)}
        modes = fourccs.get(pixel_format, fourccs["auto"])
        for backend, index in tries:
            api = {"msmf": cv2.CAP_MSMF, "dshow": cv2.CAP_DSHOW}.get(backend, cv2.CAP_ANY)
            best = None                                   # (pixels, cap, description)
            # Quality: ask for the webcam's compressed MJPG mode first - most webcams only deliver full
            # resolution at a steady 30 fps that way (the uncompressed mode often drops to a lower size or a
            # low frame rate, which looks soft and hazy). If the picture comes back smaller than asked,
            # also try the webcam's default mode and keep whichever gives the larger picture.
            for fourcc in modes:
                cap = cv2.VideoCapture(index, api)
                if not cap.isOpened():
                    last = "could not be opened"
                    cap.release()
                    break
                if fourcc:
                    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*fourcc))
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
                cap.set(cv2.CAP_PROP_FPS, fps)
                deadline = time.time() + 4.0
                ok, frame = False, None
                while time.time() < deadline:
                    ok, frame = cap.read()
                    if ok and frame is not None:
                        break
                    time.sleep(0.05)
                if not ok:
                    last = "opened but sent no picture"
                    cap.release()
                    continue
                px = frame.shape[0] * frame.shape[1]
                got = cap.get(cv2.CAP_PROP_FPS) or 0
                desc = f"{frame.shape[1]}×{frame.shape[0]}{' ' + fourcc if fourcc else ''}{f' at {got:.0f} fps' if got else ''} via {backend.upper()}"
                if best is None or px > best[0]:
                    if best:
                        best[1].release()
                    best = (px, cap, desc)
                else:
                    cap.release()
                if frame.shape[1] >= width * 0.95:        # full size: no need to try the other mode
                    break
            if best:
                self.cap, self.backend, self.info = best[1], backend, best[2]
                return
        reason = explain(camera_blockers())
        if not reason:
            label = f"“{name}”" if name else "The webcam"
            reason = (f"{label} {last or 'could not be opened'}. Close other apps that may be using it (Zoom or Teams set to "
                      "your webcam, Camo, OBS, the Camera app), or choose another webcam above.")
        raise CameraUnavailable(reason)

    def read(self):
        ok, frame = self.cap.read()
        return frame if ok else None

    def apply_controls(self, settings):
        """Exposure / white balance / backlight from the picture settings (best effort; see picture.py)."""
        from .picture import apply_controls
        self.controls = apply_controls(self.cap, settings, self._applied)
        self._applied = dict(settings)
        return self.controls

    def close(self):
        self.cap.release()
