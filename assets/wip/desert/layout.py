# The desert south of the western grassland (the user, 2026-11-08): a broad coastal desert; Tarnhold's mountains on
# the east; a stream down from them into a great oasis lake in the middle; a river out of the lake west to the sea;
# a ruined tower on an island in the lake. Prints the map rows (deterministic). python3 layout.py > map.txt
import math, random, sys
W, H = 80, 52
R = random.Random(7)
g = [['.'] * W for _ in range(H)]
def noise1(seed, n, amp, step):
    # a smooth wobble: random values every `step`, cosine-blended between
    r = random.Random(seed); pts = [r.uniform(-amp, amp) for _ in range(n // step + 3)]
    out = []
    for i in range(n):
        k, f = divmod(i, step); t = (1 - math.cos(math.pi * f / step)) / 2
        out.append(pts[k] * (1 - t) + pts[k + 1] * t)
    return out
# -- the sea along the west edge, a beach before it
sea = noise1(1, H, 1.6, 7)
for y in range(H):
    for x in range(0, int(4 + sea[y])): g[y][x] = '~'
# -- the mountains on the east (Tarnhold's): a mask, a spur west where the stream comes down, and a notch cut into
# the spur for the stream's head; each square's ring is how far it lies inside the mountain (one ring a square)
RINGS = '#(?▁▂▃▄'
foot = noise1(2, H, 2.2, 6)
mount = [[False] * W for _ in range(H)]
for y in range(H):
    fx = int(round(64 + foot[y // 3 * 3]))   # steps every third row: a slope set has no tile for a one-row step
    for x in range(fx, W): mount[y][x] = True
for y in range(3, 11):                        # the spur
    for x in range(56, W): mount[y][x] = True
NOTCH = [(x, y) for x in (60, 61) for y in range(8, 11)]
for x, y in NOTCH: mount[y][x] = False
def depth(x, y):
    for r in range(0, 8):
        for yy in range(y - r - 1, y + r + 2):
            for xx in range(x - r - 1, x + r + 2):
                if 0 <= yy < H and 0 <= xx < W and not mount[yy][xx]: return r
    return 7
for y in range(H):
    for x in range(W):
        if mount[y][x]: g[y][x] = RINGS[min(depth(x, y), len(RINGS) - 1)]
for x, y in NOTCH: g[y][x] = '~'
# the gravel foot: a ragged band below the mountain
for y in range(H):
    for x in range(W):
        if g[y][x] == '.':
            near = min((abs(xx - x) + abs(yy - y) for yy in range(max(0, y - 5), min(H, y + 6)) for xx in range(max(0, x - 5), min(W, x + 6)) if mount[yy][xx]), default=99)
            if near <= 3 + (R.random() < 0.4): g[y][x] = '`'
# -- the lake in the middle: an ellipse with a wobbling shore
CX, CY, RX, RY = 38, 24, 11.5, 7.5
wob = noise1(3, 64, 0.12, 8)
def inlake(x, y, grow=0.0):
    a = math.atan2((y - CY) / RY, (x - CX) / RX); d = math.hypot((x - CX) / RX, (y - CY) / RY)
    return d < 1 + grow + wob[int((a + math.pi) / (2 * math.pi) * 63)]
for y in range(H):
    for x in range(W):
        if g[y][x] == '.' and inlake(x, y): g[y][x] = '~'
# -- rivers: a list of points, drawn two squares wide, banked with grass
def path(pts):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) * 2
        for i in range(n): out.append((x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n))
    return out
STREAM = [(60, 10), (59, 13), (55, 15), (52, 18), (49, 20)]                           # down from the mountains east
RIVER = [(27, 25), (23, 27), (19, 26), (15, 29), (11, 31), (7, 32), (2, 33)]        # out of the lake, west to the sea
water = set()
for px, py in path(STREAM) + path(RIVER):
    for dx in (0, 1):
        for dy in (0, 1):
            water.add((int(px) + dx, int(py) + dy))
for x, y in water:
    if g[y][x] in '.`': g[y][x] = '~'
# -- the island and its tower in the lake, and a ford out to it from the south shore
for y in range(H):
    for x in range(W):
        d = math.hypot((x - CX) / 3.2, (y - CY) / 2.6)
        if d < 1: g[y][x] = ','
        elif d < 1.35 and g[y][x] == '~': g[y][x] = '.'
y = CY + 1
while g[y][CX] != '~': y += 1          # past the island's own ground
while g[y][CX] == '~' or g[y][CX + 1] == '~':
    for x in (CX, CX + 1):
        if g[y][x] == '~': g[y][x] = '_'
    y += 1
# a ford across the river, and one across the stream
for xs, ys in [((10, 11), range(26, 36)), ((52, 53), range(12, 22))]:
    for x in xs:
        for y in ys:
            if g[y][x] == '~': g[y][x] = '_'
# -- grass: the oasis ring round the lake, narrow banks along the stream and the river
def near_water(x, y, r):
    for yy in range(max(0, y - r), min(H, y + r + 1)):
        for xx in range(max(0, x - r), min(W, x + r + 1)):
            if g[yy][xx] in '~_' and (xx - x) ** 2 + (yy - y) ** 2 <= r * r and not (xx < 6 and g[yy][xx] == '~' and sea[yy] + 4 > xx):
                return True
    return False
grass = []
for y in range(H):
    for x in range(W):
        if g[y][x] != '.': continue
        if inlake(x, y, 0.42) and not inlake(x, y): grass.append((x, y))
        elif near_water(x, y, 1) and x > 8 and R.random() < 0.85: grass.append((x, y))
for x, y in grass: g[y][x] = ','
# -- sandstone outcrops and rocky ground out in the desert, away from the water
def free(x, y, r):
    return all(0 <= xx < W and 0 <= yy < H and g[yy][xx] == '.' for yy in range(y - r, y + r + 1) for xx in range(x - r, x + r + 1))
OUT = [(14, 8, 3.2, 2.2), (22, 43, 3.5, 2.4), (52, 40, 3, 2.2), (9, 18, 2.4, 1.8), (46, 6, 2.6, 1.8), (33, 44, 2, 1.5),
       (58, 30, 2.2, 1.8), (26, 12, 2, 1.6), (12, 44, 2.2, 1.6)]
for ox, oy, rx, ry in OUT:
    for y in range(oy - 4, oy + 5):
        for x in range(ox - 5, ox + 6):
            if 0 <= x < W and 0 <= y < H and g[y][x] == '.' and math.hypot((x - ox) / rx, (y - oy) / ry) < 1 + R.uniform(-0.12, 0.12):
                g[y][x] = '▩'
for k in range(16):
    x, y = R.randrange(6, 60), R.randrange(2, H - 2)
    for yy in range(y - 1, y + 2):
        for xx in range(x - 2, x + 3):
            if 0 <= xx < W and 0 <= yy < H and g[yy][xx] == '.' and R.random() < 0.6: g[yy][xx] = ';'
# every walkable square reachable from the road north
seen, todo = set(), [(30, 0)]
while todo:
    x, y = todo.pop()
    if (x, y) in seen or not (0 <= x < W and 0 <= y < H) or g[y][x] in '~▩' + RINGS: continue
    seen.add((x, y)); todo += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
lost = [(x, y) for y in range(H) for x in range(W) if g[y][x] not in '~▩' + RINGS and (x, y) not in seen]
print('unreachable:', len(lost), lost[:12], file=sys.stderr)
for x, y in lost: g[y][x] = '~'         # pockets the water and rock cut off become pool
# -- what stands where (legend letters; each prop on its own square, none touching another)
def nb(x, y, chars, r=1):
    return any(0 <= yy < H and 0 <= xx < W and g[yy][xx] in chars for yy in range(y - r, y + r + 1) for xx in range(x - r, x + r + 1))
PROPCH = 'PQYDrybutagdokcwnmTsXAN'
def place(ch, x, y):
    if g[y][x] in '.,`;' and not nb(x, y, PROPCH): g[y][x] = ch; return True
    return False
# the tower in the middle of the island, its guards, and what is left inside
place('T', CX, CY); g[CY][CX - 1] = g[CY][CX + 1] = 'x'
for x, y in [(CX - 3, CY), (CX + 3, CY - 1)]: g[y][x] = 's'
g[CY + 1][CX] = 'X'
# the waterfall at the stream's head, the road north, the desert running on south and along the coast
g[NOTCH[0][1]][NOTCH[0][0]] = 'A'
g[0][30] = g[0][31] = 'N'
g[H - 1][30] = g[H - 1][31] = 'S'
for k in range(3000):
    x, y = R.randrange(1, W - 1), R.randrange(1, H - 1)
    c = g[y][x]
    if c == ',':
        if nb(x, y, '~_') and R.random() < 0.5: place(R.choice('rry'), x, y)
        elif R.random() < 0.6: place(R.choice('PPQYYD' if inlake(x, y, 0.45) else 'PYbu'), x, y)
        elif R.random() < 0.2: place(R.choice('bu'), x, y)
    elif c == '.' and R.random() < 0.04:
        if nb(x, y, '▩', 2): place(R.choice('oocwm'), x, y)
        else: place(R.choice('tagkdtgn'), x, y)
    elif c in ';`' and R.random() < 0.03: place(R.choice('oom'), x, y)
print('\n'.join(''.join(r) for r in g))
