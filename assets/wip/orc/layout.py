# Lays out the orc valley (the user, 2026-11-08: their hand-drawn map of the classic orc valley and its key), off the
# East Tarnvale. Prints the map rows, or with --write seeds them into data/places.yaml (orc_valley's map).
#   python3 assets/wip/orc/layout.py [--write]
# The key: 1 the legionnaires' camps (north, east of the lake); 2 the castle (north-east); 3 the slave cabin (west, over
# the west channel); 4 the slaver caves, a quarried hill with slaves working outside (west, middle); 5 the slave pits
# (east, a gnome among the slaves); 6 the trainer hill (the middle). The user's correction: a strip of land runs along
# the back (north) wall from the camps to behind the castle and on to the pits, so no channel reaches the north wall:
# the water comes from a fall into the lake (north-west), runs south down the west channel, east along the south, north
# up the middle channel, east along the castle's front and south down the east channel to a sink under the mountains.
import math, re, sys

W, H = 60, 54
g = [['#'] * W for _ in range(H)]

def put(x, y, ch):
    if 0 <= x < W and 0 <= y < H: g[y][x] = ch

def inside(px, py, poly):
    c = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1: c = not c
    return c

# The valley's outline, the mountains outside it.
VALLEY = [(4, 4), (10, 2), (22, 2), (36, 1), (50, 2), (55, 4), (57, 10), (57, 22), (56, 32), (54, 40), (49, 45),
          (40, 47), (37, 47), (37, 50), (31, 50), (31, 47), (24, 48), (14, 48), (6, 45), (3, 38), (2, 26), (2, 12)]
for y in range(H):
    for x in range(W):
        if inside(x + 0.5, y + 0.5, VALLEY): g[y][x] = ','
# The way in from the south: a gap in the mountains down to the East Tarnvale.
for y in range(46, H):
    for x in range(32, 36): g[y][x] = ','

def blob(cx, cy, rx, ry, ch, only=None):
    for y in range(H):
        for x in range(W):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 and (only is None or g[y][x] in only): g[y][x] = ch

def rect(x0, y0, x1, y1, ch, only=None):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H and (only is None or g[y][x] in only): g[y][x] = ch

def channel(pts, ch='~', w=2):
    # a run of water w squares wide along straight legs between the points
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
            for dy in range(w):
                for dx in range(w): put(x + dx, y + dy, ch)

rect(0, 0, W - 1, 2, '#')   # the north wall runs straight (a one-row step can't be drawn)
# The lake under the north-west falls, and the water's one long run from it.
blob(11, 7.5, 5.5, 5, '~', ',#')
channel([(9, 12), (9, 20), (8, 30), (8, 38), (10, 42), (14, 44), (22, 44), (27, 43), (28, 38), (28, 26), (28, 15)])
channel([(12, 12), (14, 13), (20, 14), (28, 14), (36, 14), (45, 14), (47, 15), (47, 24), (46, 32), (47, 39), (49, 41)])
blob(50, 41.5, 2.2, 1.8, '~', ',~')

# 4: the slaver caves, a quarried hill of grey stone (wall) with a mine mouth in its south face.
blob(19.5, 22, 7, 6.5, '▤', ',')
# 6: the trainer hill, a broad grassy rise in the middle (walkable), its top worn bare.
blob(38, 29, 7.5, 9.5, '{', ',')
# 2: the castle, a squat block of the orcs' grey-blue stone on the north strip, its gate in the south face.
rect(33, 4, 44, 11, '@', ',')
rect(31, 5, 32, 9, '@', ',')
rect(45, 6, 46, 9, '@', ',')
# 5: the slave pits: two long trenches walled by rock spines, mud floors.
rect(50, 6, 50, 36, '#', ',')
rect(53, 8, 54, 34, ';', ',')
rect(51, 8, 52, 34, ';', ',')
for y in (14, 15, 25, 26):
    rect(51, y, 54, y, ',')
# Paths of trodden dirt (.): the way in, up to the hill, on to each bridge.
def path(pts):
    # a path crossing the water is a bridge
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
            for dy in range(2):
                for dx in range(2):
                    if 0 <= x + dx < W and 0 <= y + dy < H: g[y + dy][x + dx] = '=' if g[y + dy][x + dx] in '~=' else '.'
path([(33, 51), (33, 44), (36, 40), (37, 38)])
path([(33, 44), (31, 41), (31, 39), (22, 39), (19, 35), (19, 29)])
path([(30, 31), (30, 20), (30, 16), (38, 16), (38, 12)])
path([(38, 16), (44, 16), (44, 20), (51, 20)])
path([(22, 12), (22, 16), (20, 18)])
path([(22, 12), (22, 4), (30, 3), (48, 3), (51, 5)])
path([(5, 22), (12, 22), (14, 24)])
# Bridges (=) where the paths cross the water.
# The castle gate (G) and the mine mouth (M); the way out (S).
put(38, 12, 'G')
put(19, 28, 'M')
for x in range(32, 36): put(x, H - 1, 'S')

# Props, by square (each on open grass or path).
PROPS = {
    # 1: the legionnaires' camps
    'h': [(16, 4), (19, 6), (25, 5), (17, 9), (24, 9)], 'n': [(21, 7), (27, 8)], 'c': [(20, 9), (26, 6)],
    'k': [(18, 8), (28, 10)], 'u': [(23, 10)], 'w': [(18, 3), (28, 4)], 'y': [(25, 11)],
    # 2: the castle front
    'b': [(36, 12), (41, 12)], 't': [(35, 12), (42, 12)], 'p': [(31, 12), (46, 11)],
    # 3: the slave cabin and its yard, on the strip over the west channel
    'C': [(4, 20)], 'x': [(5, 25), (4, 16)], 'j': [(6, 18)], 'l': [(5, 29)],
    # 4: slaves and orcs working outside the caves
    'm': [(16, 29), (24, 29)], 'q': [(14, 27), (25, 27), (22, 31)], 'r': [(13, 24), (17, 31), (26, 23)], 'f': [(23, 33)],
    'd': [(15, 31)], 'e': [(12, 29)],
    # 5: the pits
    # (the cages in the trenches' middle columns, clear of the rock spine; the gnome's beside his note; two gibbets)
    'z': [(52, 10), (53, 17), (53, 23), (52, 30)], 'Q': [(53, 12), (52, 33)], 'K': [(52, 28)], 'a': [(55, 15), (55, 26)],
    # 6: the trainer hill
    'v': [(36, 27), (40, 30), (38, 33)], 'i': [(38, 29)],
    # the south: trees, rocks and the camp's watch on the way in
    'P': [(4, 6), (4, 9), (52, 4), (55, 9), (44, 44), (25, 46), (5, 40), (16, 46), (55, 30), (40, 45)],
    'R': [(29, 46), (42, 42), (12, 37), (24, 42), (45, 36)], 'o': [(36, 45), (30, 44)],
    # who is about: legionnaires and a centurion in the camps, the gate guard, a slaver and his slaves at the caves,
    # slaves in the cabin, a gnome in the pits, the drill on the trainer hill
    'L': [(20, 5), (23, 7)], 'U': [(18, 10)], 'g': [(36, 13)], 's': [(21, 30)], 'N': [(18, 30)], 'Y': [(6, 21)],
    'Z': [(52, 23)], 'T': [(37, 31)],
}
for ch, sq in PROPS.items():
    for x, y in sq:
        if g[y][x] not in ",.{;": print("BAD", ch, x, y, g[y][x], file=sys.stderr); continue
        g[y][x] = ch
put(13, 3, 'A')   # the falls, at the lake's edge (beside the shore, so it can be reached)
# The big buildings (two squares wide) are solid either side of their square.
for y in range(H):
    for x in range(W):
        if g[y][x] in 'nCi':
            for dx in (-1, 1):
                if g[y][x + dx] == ',': g[y][x + dx] = 'X'  # the falls into the lake (on the water's north edge)

rows = [''.join(r) for r in g]
if '--write' in sys.argv:
    p = 'data/places.yaml'; s = open(p).read()
    i = s.index('\norc_valley:\n'); j = s.index('  map:\n', i) + len('  map:\n'); k = s.index('  legend:', j)
    s = s[:j] + ''.join(f'    - "{r}"\n' for r in rows) + s[k:]
    open(p, 'w').write(s)
else:
    print('\n'.join(rows))
