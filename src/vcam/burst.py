"""8.2 Burst: the old picture breaks into dust that drifts away and uncovers the new one (the "snap" transition).

The old picture is cut into a grid of grains (one per `step` pixels; density low / medium / high). A sweep crosses the
picture in the chosen direction; each grain leaves when the sweep reaches it (plus a little randomness), flies off
in that direction with some scatter and a gentle rise, shrinks into the air and fades. Until a grain leaves, its part
of the old picture stays solid; behind the grains the new picture shows. All of it is numpy on a grid of grains
(about 58 000 at medium on 1080p), a few milliseconds a frame, and only while the transition plays.

Settings (st.fx.burst, store.js cleanBurst): density low/medium/high, dir right/left/up/down/out, tint "#rrggbb" or "",
intensity 10-100 (how far and wide the dust flies).
"""
import cv2
import numpy as np

STEP = {"low": 10, "medium": 6, "high": 5}
LIFE = 0.32            # each grain takes this share of the transition to fly off and fade
SWEEP = 0.62           # the sweep crosses the picture in this share of the transition


def _tint(hexcol):
    try:
        h = str(hexcol or "").lstrip("#")
        if len(h) != 6:
            return None
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return np.array([b, g, r], np.float32)            # the picture is BGR
    except ValueError:
        return None


class Burst:
    def __init__(self, a, opts=None, seed=None):
        o = opts or {}
        self.a = a
        H, W = a.shape[:2]
        s = STEP.get(o.get("density"), 6)
        self.s, self.H, self.W = s, H, W
        gh, gw = max(1, H // s), max(1, W // s)
        rng = np.random.default_rng(seed)
        col = cv2.resize(a, (gw, gh), interpolation=cv2.INTER_AREA).astype(np.float32)
        intensity = max(0.1, min(1.0, float(o.get("intensity", 60)) / 100.0))
        tint = _tint(o.get("tint"))
        if tint is not None:                               # the dust takes on the colour, the picture keeps its own
            col = col * (1 - 0.55) + tint * 0.55
        self.col = col.reshape(-1, 3)
        ys, xs = np.mgrid[0:gh, 0:gw].astype(np.float32)
        nx, ny = (xs + 0.5) / gw, (ys + 0.5) / gh
        d = o.get("dir", "right")
        if d == "left":
            pos, vx, vy = 1 - nx, -1.0, 0.0
        elif d == "up":
            pos, vx, vy = 1 - ny, 0.0, -1.0
        elif d == "down":
            pos, vx, vy = ny, 0.0, 1.0
        elif d == "out":
            cx, cy = nx - 0.5, ny - 0.5
            r = np.sqrt(cx * cx + cy * cy) + 1e-6
            pos, vx, vy = r / r.max(), cx / r, cy / r
        else:
            pos, vx, vy = nx, 1.0, 0.0
        n = gh * gw
        self.delay = (pos * SWEEP + rng.random((gh, gw), np.float32) * 0.12).reshape(-1)
        speed = (0.18 + 0.32 * rng.random(n, np.float32)) * intensity * max(W, H)
        scatter = (rng.random(n, np.float32) - 0.5) * 0.9 * intensity * max(W, H)
        vxa = np.broadcast_to(np.asarray(vx, np.float32), (gh, gw)).reshape(-1)
        vya = np.broadcast_to(np.asarray(vy, np.float32), (gh, gw)).reshape(-1)
        # along the direction, plus scatter across it, plus a soft rise (dust floats up)
        self.dx = vxa * speed - vya * scatter
        self.dy = vya * speed + vxa * scatter - 0.12 * intensity * H * rng.random(n, np.float32)
        self.x0 = ((xs + 0.5) * s).reshape(-1)
        self.y0 = ((ys + 0.5) * s).reshape(-1)
        self.grid = (gh, gw)

    def render(self, e, b):
        """e: 0..1 through the transition; b: the new picture. Returns the blended picture."""
        H, W, s = self.H, self.W, self.s
        t = np.clip((e - self.delay) / LIFE, 0.0, 1.0)
        out = b.copy()
        solid = (t <= 0).reshape(self.grid)
        if solid.any():                                    # the part the sweep has not reached: still the old picture
            m = cv2.resize(solid.astype(np.uint8), (self.grid[1] * s, self.grid[0] * s), interpolation=cv2.INTER_NEAREST)
            mm = np.zeros((H, W), np.uint8)
            mm[:min(H, m.shape[0]), :min(W, m.shape[1])] = m[:H, :W]
            cv2.copyTo(self.a, mm, out)                    # (np.copyto with a mask is ~30x slower)
        moving = np.nonzero((t > 0) & (t < 1))[0]
        if moving.size:
            tm = t[moving]
            ease = 1 - (1 - tm) ** 2                        # fast off the picture, then drifting
            px = (self.x0[moving] + self.dx[moving] * ease).astype(np.int32)
            py = (self.y0[moving] + self.dy[moving] * ease).astype(np.int32)
            alpha = ((1 - tm) ** 1.3).astype(np.float32)
            col = self.col[moving]
            size = 2 if s <= 6 else 3                       # small grains: dust, not tiles
            offs = [(ox, oy) for oy in range(size) for ox in range(size)]
            xx = np.concatenate([px + ox for ox, _ in offs])
            yy = np.concatenate([py + oy for _, oy in offs])
            aa = np.tile(alpha, len(offs))
            cc = np.tile(col, (len(offs), 1))
            ok = (xx >= 0) & (xx < W) & (yy >= 0) & (yy < H)
            xx, yy, aa, cc = xx[ok], yy[ok], aa[ok][:, None], cc[ok]
            under = out[yy, xx].astype(np.float32)
            out[yy, xx] = (under * (1 - aa) + cc * aa).astype(np.uint8)
        return out
