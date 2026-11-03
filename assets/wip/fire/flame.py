# Looping flames drawn by code, to lay over campfire bases (build.py). flames(w, h, frames, seed) -> list of RGBA
# images: a tongue of fire that licks and sways, its core pale, its edge dark red, a few sparks rising off it.
import math
import numpy as np
from PIL import Image

PAL = [(122, 34, 18), (196, 58, 22), (236, 110, 28), (252, 168, 44), (255, 214, 96), (255, 244, 186)]

def _lat(p, seed):
    return np.random.default_rng(seed).random((p, p))

def _vn(x, y, g):
    p = g.shape[0]
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    q = lambda i, j: g[j % p, i % p]
    a = q(x0, y0) + (q(x0 + 1, y0) - q(x0, y0)) * sx
    b = q(x0, y0 + 1) + (q(x0 + 1, y0 + 1) - q(x0, y0 + 1)) * sx
    return a + (b - a) * sy

def flames(w, h, frames=8, seed=1, sparks=4):
    Y, X = np.mgrid[0:h, 0:w].astype(float)
    g1, g2 = _lat(16, seed), _lat(16, seed + 9)
    u = (X - (w - 1) / 2) / (w / 2)          # -1..1 across
    v = (h - 1 - Y) / h                      # 0 at the foot, 1 at the top
    rng = np.random.default_rng(seed + 3)
    sp = [(rng.uniform(-0.5, 0.5), rng.uniform(0, 1), rng.uniform(0.6, 1.0)) for _ in range(sparks)]
    out = []
    for f in range(frames):
        s = f / frames
        th = 2 * math.pi * s
        # Noise rising through the flame: two layers half a loop apart, cross-faded, so the loop closes.
        def layer(fr):
            return _vn(X / (w / 5) + 3, (Y + fr * h) / (h / 6), g1) * 0.65 + _vn(X / (w / 9), (Y + fr * h * 2) / (h / 11), g2) * 0.35
        a, b = s, (s + 0.5) % 1
        wa = 1 - abs(2 * a - 1)
        n = wa * layer(a) + (1 - wa) * layer(b)
        # The body: three tongues side by side, the middle one tallest, each licking up and down and swaying on its own
        # phase, so the top of the fire never holds still; the noise eats ragged gaps up into them.
        shape = np.full((h, w), -9.0)
        for cx, top, ph in ((-0.42, 0.62, 0.0), (0.0, 1.0, 0.37), (0.4, 0.7, 0.71)):
            tt = top * (0.82 + 0.18 * math.sin(th + ph * 6.28))
            vv = v / tt
            sway = 0.16 * math.sin(th + ph * 6.28) * vv ** 1.4
            half = np.clip(1 - vv, 0, 1) ** 0.7 * 0.62 * (1.15 if cx == 0 else 0.85)
            shape = np.maximum(shape, 1 - np.abs(u - cx - sway) / np.maximum(half, 1e-3))
        # Rounded at the foot, where the logs sit.
        shape = shape - np.clip(0.12 - v, 0, 1) * 4 * np.abs(u)
        heat = shape * 1.05 + (1 - v) * 0.35 - n * 0.75 - v * 0.2
        img = np.zeros((h, w, 4), np.uint8)
        cuts = [0.05, 0.22, 0.38, 0.55, 0.72, 0.9]
        for k, c in enumerate(cuts):
            img[heat > c] = PAL[k] + (255,)
        # Sparks: rising and fading, each on its own phase.
        for x0, ph, sz in sp:
            t = (s + ph) % 1
            yy = int(round((h - 1) * (1 - (0.4 + 0.6 * t)) - t * h * 0.15))
            xx = int(round((w - 1) / 2 + x0 * w * 0.6 + math.sin((t + ph) * 6) * 2))
            if 0 <= yy < h and 0 <= xx < w and t < 0.85:
                img[yy, xx] = PAL[5 if t < 0.4 else 3] + (255,)
        out.append(Image.fromarray(img))
    return out

if __name__ == '__main__':
    import sys
    fr = flames(int(sys.argv[1]), int(sys.argv[2]), 8, 1)
    W, H = fr[0].size
    sheet = Image.new('RGBA', (W * len(fr), H), (40, 40, 40, 255))
    for i, im in enumerate(fr): sheet.alpha_composite(im, (i * W, 0))
    sheet.resize((sheet.width * 4, sheet.height * 4), 0).save(sys.argv[3])
