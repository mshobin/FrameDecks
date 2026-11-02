"""FrameDecks 8.8 - the Audience Dock's window behaviour (docs/architecture/audience-dock.md).

The dock floats above Zoom or Teams. Normally clicks pass through it to the chat beneath (click-through) and it never
takes the keyboard. Holding Ctrl+Shift makes it usable (opaque, clickable) while the keys are held; the handle's pin
keeps it usable (needed to type in a card). See-through levels:

    usable (Ctrl+Shift held, or pinned)    100 %
    pointer over the dock                   20 %   (the chat beneath stays readable)
    otherwise                               85 %

A light poll (DockController.tick, about 30 times a second while the dock is open, 10 when nothing is near it) reads
the keys and the pointer: no keyboard or mouse hook. The handle (a small window that is never click-through) follows
the dock's top edge. The dock's place and size are saved a moment after they stop changing.

Windows calls are passed in (desktop_app.py gives desktop_win's), so this file is tested on every system.
"""
import time

OPAQUE, UNDER_POINTER, RESTING = 1.0, 0.2, 0.85
DEFAULT_SIZE = (340, 520)
HANDLE_SIZE = (184, 30)
MIN_SIZE = (240, 200)
SAVE_AFTER = 1.0                    # seconds without movement before the place is saved


def look(usable, pointer_over):
    """(click_through, opacity) for the dock now."""
    if usable:
        return False, OPAQUE
    return True, UNDER_POINTER if pointer_over else RESTING


def inside(rect, pt, pad=0):
    if not rect or not pt:
        return False
    x, y, w, h = rect
    return x - pad <= pt[0] < x + w + pad and y - pad <= pt[1] < y + h + pad


# Every rectangle here is in real screen pixels ([x, y, w, h], as Windows reports them). pywebview takes a window's
# position and size in its own unscaled units and multiplies them by the display scale (125 %, 150 %...), so the dock
# is placed by Windows after it appears (desktop_app.audience_dock); to_logical() is only its first guess. 8.8.0 gave
# pywebview screen pixels, which put the dock off the right edge of a scaled display.

def handle_rect(dock_rect, scale=1.0):
    """The handle sits on the dock's top edge, at its right (where the window buttons of other apps are not)."""
    x, y, w, _ = dock_rect
    hw, hh = int(round(HANDLE_SIZE[0] * scale)), int(round(HANDLE_SIZE[1] * scale))
    return [x + max(0, w - hw - int(8 * scale)), y - hh + int(4 * scale), hw, hh]


def start_rect(saved, work_area, fits=lambda r: True, scale=1.0):
    """Where the dock opens: its saved place when it is still on a screen, else the right of the work area."""
    if isinstance(saved, list) and len(saved) == 4 and fits(saved):
        return [int(v) for v in saved]
    wx, wy, ww, wh = work_area or (0, 0, 1920, 1080)
    w, h = int(round(DEFAULT_SIZE[0] * scale)), int(round(DEFAULT_SIZE[1] * scale))
    w, h = min(w, max(1, ww - 48)), min(h, max(1, wh - 96))
    return [wx + ww - w - int(24 * scale), wy + max(int(48 * scale), (wh - h) // 3), w, h]


def to_logical(rect, scale):
    """Screen pixels -> pywebview's units (it multiplies them by the display scale)."""
    s = scale if scale and scale > 0 else 1.0
    return [int(round(v / s)) for v in rect]


class DockController:
    """One tick reads the keys, the pointer and the dock's rectangle and applies what changed."""

    def __init__(self, win, on_mode=None, on_moved=None, clock=time.monotonic, scale=1.0):
        # win: rect() -> [x, y, w, h] | None, keys() -> bool (Ctrl+Shift held), cursor() -> (x, y) | None,
        #      set_look(click_through, alpha), place_handle(rect)
        self.win, self.on_mode, self.on_moved, self.clock, self.scale = win, on_mode, on_moved, clock, scale
        self.pinned = False
        self.applied = None          # (click_through, alpha)
        self.mode = None             # 'click' | 'live' | 'pinned'
        self.rect, self.moved_at, self.saved = None, None, None

    def set_pinned(self, on):
        self.pinned = bool(on)
        return self.tick()

    def tick(self):
        """Returns the seconds until the next tick (shorter while the pointer or the keys are near)."""
        rect = self.win.rect()
        if rect is None:
            return 0.1
        held = bool(self.win.keys())
        pt = self.win.cursor()
        over = inside(rect, pt)
        usable = held or self.pinned
        want = look(usable, over)
        if want != self.applied:
            self.win.set_look(*want)
            self.applied = want
        mode = "pinned" if self.pinned else "live" if held else "click"
        if mode != self.mode:
            self.mode = mode
            if self.on_mode:
                self.on_mode(mode)
        now = self.clock()
        if rect != self.rect:
            self.rect, self.moved_at = rect, now
            self.win.place_handle(handle_rect(rect, self.scale))
        elif self.moved_at is not None and now - self.moved_at >= SAVE_AFTER and rect != self.saved:
            self.saved, self.moved_at = list(rect), None
            if self.on_moved:
                self.on_moved(list(rect))
        near = over or held or inside(rect, pt, pad=120)
        return 1 / 30 if near or self.moved_at is not None else 0.1
