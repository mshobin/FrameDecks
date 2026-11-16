"""FrameDecks 26.11.44 - the members' phones QR code, the same on every screen.

The link people scan (framedecks.com/follow#c=CODE while members' phones is open) as a QR code: an SVG for the overlay
pages and the Studio (server.py /api/join-qr.svg) and a picture for the FrameDecks vCam (vcam/chatcard.py on the code's
Chat Bubble, vcam/program.py on the Branding badge). Dark modules on a white tile with a quiet zone, medium error
correction (src/qr_encode.py), so a phone reads it through Zoom or Teams. Encoded once per link."""
from functools import lru_cache

import qr_encode

QUIET = 4                      # modules of white around the code (a white tile, so the picture behind never touches it)
INK = (11, 22, 48)             # dark navy modules, the colour of the cards' plates


def valid(url):
    """A link worth encoding: https, printable, short (a members' phones link is about 40 characters)."""
    return isinstance(url, str) and url.startswith("https://") and 12 <= len(url) <= 200 and all(32 < ord(ch) < 127 for ch in url)


@lru_cache(maxsize=8)
def modules(url):
    """The code's rows of dark (True) and light modules, without the quiet zone."""
    return qr_encode.encode(url)


@lru_cache(maxsize=8)
def svg(url):
    """The code as a small SVG (one path), white tile included."""
    rows = modules(url)
    n = len(rows) + 2 * QUIET
    d = "".join("M%d %dh1v1h-1z" % (x + QUIET, y + QUIET) for y, row in enumerate(rows) for x, on in enumerate(row) if on)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges">'
            '<rect width="%d" height="%d" rx="1.2" fill="#fff"/><path d="%s" fill="#%02x%02x%02x"/></svg>'
            % ((n, n, n, n, d) + INK))


def image(url, side):
    """The code as a PIL RGBA picture about side pixels square: whole pixels per module (crisp, the nearest to side), at least
    2 per module."""
    from PIL import Image
    rows = modules(url)
    n = len(rows) + 2 * QUIET
    m = max(2, int(round(side / n)))
    img = Image.new("RGBA", (n, n), (255, 255, 255, 255))
    px = img.load()
    for y, row in enumerate(rows):
        for x, on in enumerate(row):
            if on:
                px[x + QUIET, y + QUIET] = INK + (255,)
    return img.resize((n * m, n * m), Image.NEAREST)
