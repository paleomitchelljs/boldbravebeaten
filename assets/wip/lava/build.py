# Animated lava for the fire-goblin mine (the user, 2026-11-02: lava should move: bubbling, roiling, now and then a
# spurt). Drawn here by code, not PixelLab, so the loop tiles and repeats exactly:
#   python3 assets/wip/lava/build.py "$PWD"
# Writes to art/worldtiles/ember/:
#   lava-anim.png  FRAMES frames of one seamless SIZE x SIZE lava surface (SIZE/64 squares a side), COLS frames to a
#                  row. Each square draws the part of it under its position, so neighbours join and no two of the
#                  64 squares in a block look alike (at 4 squares a side the repeat showed across a pool). Molten flow drifting (two scrolling layers cross-faded, so the
#                  loop closes), dark crust plates that open and close as it roils, bubbles that swell and pop.
#   lava-spurt.png SPURT_FRAMES frames of a jet thrown up out of the lava and falling back in drops, side by side.
#   lava-cut.png   the mine's lava corner sheet (lava.png) with its lava cut away, so the moving lava drawn under the
#                  map shows through, and only the rock and its glowing lip are drawn over it.
# The palette is lava.png's own.
import sys, math
import numpy as np
from PIL import Image

root = sys.argv[1]
out = root + '/art/worldtiles/ember/'
SIZE, FRAMES, COLS = 512, 24, 4
SPURT_FRAMES, SW, SH = 16, 48, 96
rng = np.random.default_rng(7)

# lava.png's colours, dark to light: crust, then the molten ramp.
CRUST = [(29, 25, 24), (45, 40, 38), (58, 26, 18), (90, 36, 20)]
MOLTEN = [(122, 48, 24), (160, 64, 28), (200, 80, 26), (224, 106, 20), (240, 138, 28), (248, 170, 48), (255, 204, 80), (255, 232, 136)]

def lattice(period, seed):
    return np.random.default_rng(seed).random((period, period))

def vnoise(x, y, grid):
    # Value noise on a wrapped lattice: x, y in lattice units, so the field tiles every len(grid) units.
    p = grid.shape[0]
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    g = lambda i, j: grid[j % p, i % p]
    a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx
    b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx
    return a + (b - a) * sy

def fbm(x, y, base, octaves, seed):
    # x, y in pixels; base: pixels per lattice cell at the coarsest octave (divides SIZE, so it tiles).
    v, amp, tot = 0, 1, 0
    for o in range(octaves):
        cell = base / 2 ** o
        v = v + amp * vnoise(x / cell, y / cell, lattice(int(SIZE / cell), seed + o))
        tot += amp; amp *= 0.5
    return v / tot

Y, X = np.mgrid[0:SIZE, 0:SIZE].astype(float)
# A slow warp that turns the flow into swirls.
WX = (fbm(X, Y, 64, 3, 11) - 0.5) * 36
WY = (fbm(X, Y, 64, 3, 23) - 0.5) * 36

def surface(f):
    s = f / FRAMES
    th = 2 * math.pi * s
    # Two copies of the flow, each sliding 64 px (a whole lattice cell, so it tiles) along the drift and starting
    # over, half a loop apart; each fades out as it jumps back, so the loop has no seam.
    def layer(frac):
        d = frac * 64
        u, v = X + WX + d * 0.8, Y + WY + d * 0.35
        # Ripples across the drift (the streaks in lava.png), broken up by the noise.
        rip = np.sin((u * 12 - v * 28) * 2 * math.pi / SIZE + fbm(u, v, 32, 2, 77) * 6)   # whole waves across SIZE: it tiles
        return fbm(u, v, 64, 5, 101) + 0.06 * rip
    a, b = s, (s + 0.5) % 1
    wa = 1 - abs(2 * a - 1)
    flow = wa * layer(a) + (1 - wa) * layer(b)
    # The crust: a coarse field that breathes in a circle (roiling), so plates close over and break open.
    crust = fbm(X + 12 * math.cos(th), Y + 12 * math.sin(th), 64, 3, 303)
    crust = crust + 0.06 * math.sin(th * 2) * (fbm(X, Y, 32, 2, 404) - 0.5)
    return flow, crust

# The share of the molten surface in each colour of the ramp, darkest first, as in lava.png (mostly deep orange, the
# yellows only in veins).
SHARE = [0.03, 0.06, 0.10, 0.36, 0.27, 0.11, 0.05, 0.02]

def colour(flow, crust):
    img = np.zeros((SIZE, SIZE, 3), np.uint8)
    # Molten: the flow mapped onto the ramp by rank, so each colour covers its share whatever the noise does.
    cuts = np.quantile(flow, np.cumsum(SHARE)[:-1])
    idx = np.searchsorted(cuts, flow)
    img[:] = np.array(MOLTEN, np.uint8)[idx]
    # Crust where the coarse field is high: small plates with a dull red rim, a glowing crack through the bigger ones.
    hard = crust > 0.71
    edge = (crust > 0.68) & ~hard
    img[edge] = MOLTEN[0]
    shade = np.clip(((crust - 0.71) / 0.1 * 3).astype(int), 0, 2)
    cp = np.array([CRUST[3], CRUST[2], CRUST[1]], np.uint8)
    img[hard] = cp[shade[hard]]
    crack = hard & (np.abs(flow - np.median(flow)) < 0.01)
    img[crack] = MOLTEN[3]
    return img

# Bubbles: each swells over 5 frames (a dome with a dark rim and a highlight), pops (a ring of bright spatter), and
# leaves a dark dimple that fills in. Placed by a jittered grid so each square gets a couple, timed at random.
BUB_LIFE = 9
bubbles = []
for gy in range(0, SIZE, 32):
    for gx in range(0, SIZE, 32):
        if rng.random() < 0.55:
            bubbles.append((gx + rng.integers(6, 26), gy + rng.integers(6, 26), int(rng.integers(0, FRAMES)), int(rng.integers(2, 5))))

def put(img, x, y, c):
    img[y % SIZE, x % SIZE] = c

def disc(img, cx, cy, r, c, ring=None):
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            d = dx * dx + dy * dy * 1.6   # a little flattened: seen from above at a slant
            if d <= r * r + r * 0.6:
                put(img, cx + dx, cy + dy, ring if ring and d > (r - 1) ** 2 + 0.5 else c)

def bubble(img, f):
    for bx, by, start, rmax in bubbles:
        age = (f - start) % FRAMES
        if age >= BUB_LIFE:
            continue
        if age < 5:
            r = max(1, round(rmax * (age + 1) / 5))
            disc(img, bx, by, r, MOLTEN[5], ring=MOLTEN[1])
            put(img, bx - r // 2, by - max(1, r // 2), MOLTEN[7])
        elif age == 5:
            # Pop: spatter in a ring, a dark hole in the middle.
            disc(img, bx, by, max(1, rmax - 1), CRUST[3])
            for k in range(8):
                a = k * math.pi / 4 + start
                put(img, bx + round(math.cos(a) * (rmax + 2)), by + round(math.sin(a) * (rmax + 1)), MOLTEN[7 if k % 2 else 6])
        elif age == 6:
            disc(img, bx, by, max(1, rmax - 1), MOLTEN[0])
            for k in range(8):
                a = k * math.pi / 4 + start + 0.3
                put(img, bx + round(math.cos(a) * (rmax + 3)), by + round(math.sin(a) * (rmax + 2)), MOLTEN[5])
        else:
            disc(img, bx, by, max(1, rmax - 2), MOLTEN[1])

def anim():
    rows = math.ceil(FRAMES / COLS)
    sheet = Image.new('RGB', (COLS * SIZE, rows * SIZE))
    for f in range(FRAMES):
        img = colour(*surface(f))
        bubble(img, f)
        sheet.paste(Image.fromarray(img), ((f % COLS) * SIZE, (f // COLS) * SIZE))
    sheet.quantize(colors=len(CRUST) + len(MOLTEN), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out + 'lava-anim.png', optimize=True)

def spurt():
    # A jet of molten rock: a dome heaves up, a column is thrown up, it breaks into drops that fall back under gravity
    # and splash. Frames side by side, each SW x SH, the lava's surface at y = SH - 8 in the middle.
    r = np.random.default_rng(3)
    base = SH - 8
    cx = SW // 2
    drops = [(r.uniform(-2.2, 2.2), r.uniform(-4.5, -1.0), 0) for _ in range(10)]
    sheet = Image.new('RGBA', (SW * SPURT_FRAMES, SH))
    px = sheet.load()
    def dot(f, x, y, c, s=1):
        for dy in range(s):
            for dx in range(s):
                xx, yy = int(round(x)) + dx, int(round(y)) + dy
                if 0 <= xx < SW and 0 <= yy < SH:
                    px[f * SW + xx, yy] = c + (255,)
    for f in range(SPURT_FRAMES):
        if f < 3:
            # The surface swells.
            w = 3 + f * 2
            for dx in range(-w, w + 1):
                h = int((1 - (dx / (w + 1)) ** 2) * (2 + f * 2))
                for dy in range(h):
                    dot(f, cx + dx, base - dy, MOLTEN[7 - min(3, dy)] if dy < h - 1 else MOLTEN[1])
            continue
        t = f - 3
        # The column: tallest at t = 2, then it falls apart.
        if t < 5:
            h = [16, 30, 40, 30, 14][t]
            w = [4, 4, 3, 2, 1][t]
            for dy in range(h):
                ww = w + (1 if dy < 3 else 0)
                for dx in range(-ww, ww + 1):
                    c = MOLTEN[7] if abs(dx) < ww - 1 else MOLTEN[5] if abs(dx) < ww else MOLTEN[3]
                    dot(f, cx + dx, base - dy, c)
        # Drops: thrown off the column's top as it peaks, falling back under gravity, a splash where each lands.
        if t >= 2:
            for vx, vy, life in drops:
                tt = t - 2
                x = cx + vx * tt
                y = base - 40 + vy * tt + 0.9 * tt * tt
                if y < base:
                    dot(f, x, y, MOLTEN[6] if tt < 4 else MOLTEN[4], 2 if tt < 4 else 1)
                elif y < base + 12:
                    dot(f, x - 1, base - 1, MOLTEN[6]); dot(f, x + 1, base - 1, MOLTEN[5])
        # A ring of ripples where it came out.
        if t >= 3:
            rr = 4 + (t - 3) * 2
            if rr < 16:
                for k in range(16):
                    a = k * math.pi / 8
                    dot(f, cx + math.cos(a) * rr, base + math.sin(a) * rr * 0.45, MOLTEN[6 if t < 7 else 3])
    sheet.save(out + 'lava-spurt.png', optimize=True)

def cut():
    # lava.png with its molten pixels made transparent. The flecks of crust floating in its lava (small dark islands
    # inside a tile) go too, so nothing stands still on moving lava.
    im = Image.open(out + 'lava.png').convert('RGBA')
    a = np.array(im)
    lum = a[..., 0].astype(int) + a[..., 1]
    molten = (a[..., 0] >= 200) & (lum >= 280)
    keep = ~molten
    H, W = keep.shape
    seen = np.zeros_like(keep)
    for ty in range(0, H, 64):
        for tx in range(0, W, 64):
            for y in range(ty, ty + 64):
                for x in range(tx, tx + 64):
                    if not keep[y, x] or seen[y, x]:
                        continue
                    stack, comp, border = [(x, y)], [], False
                    seen[y, x] = True
                    while stack:
                        cx, cy = stack.pop(); comp.append((cx, cy))
                        if cx in (tx, tx + 63) or cy in (ty, ty + 63):
                            border = True
                        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                            if tx <= nx < tx + 64 and ty <= ny < ty + 64 and keep[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True; stack.append((nx, ny))
                    if not border and len(comp) < 200:
                        for cx, cy in comp:
                            keep[cy, cx] = False
    a[..., 3] = np.where(keep, 255, 0)
    Image.fromarray(a).save(out + 'lava-cut.png', optimize=True)

anim()
spurt()
cut()
print('lava-anim.png', SIZE, FRAMES, COLS, '| lava-spurt.png', SW, SH, SPURT_FRAMES)
