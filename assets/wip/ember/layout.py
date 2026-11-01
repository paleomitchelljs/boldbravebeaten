# The fire-goblin mine's maps (assets/ideas/ember-mine.md), painted with rectangles and lines so the rows stay
# rectangular and the walls two squares thick. `python3 layout.py` prints each map's rows as YAML; `--png DIR` also
# draws a coloured preview of each. The maps stay data: paste the rows into data/places.yaml and hand-edit there.
# Letters: # wall, . floor, $ lava, ) stone bridge, / stair steps, ' murder hole, ; rubble, + door; the rest are legend.
import sys, random

class Map:
    def __init__(self, w, h, fill='#'):
        self.w, self.h = w, h
        self.g = [[fill] * w for _ in range(h)]
    def put(self, x, y, ch):
        assert 0 <= x < self.w and 0 <= y < self.h, (x, y, ch)
        self.g[y][x] = ch
    def rect(self, x0, y0, x1, y1, ch='.'):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.put(x, y, ch)
    def rows(self): return [''.join(r) for r in self.g]
    def at(self, x, y): return self.g[y][x]
    def ellipse(self, cx, cy, rx, ry, ch='.'):
        for y in range(self.h):
            for x in range(self.w):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1: self.put(x, y, ch)
    def path(self, pts, width=2, ch='.'):
        # straight runs between points (each step axis-aligned), `width` squares wide (grown right and down)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            if x0 == x1:
                for y in range(min(y0, y1), max(y0, y1) + width): self.rect(x0, y, x0 + width - 1, y, ch)
            else:
                assert y0 == y1, (x0, y0, x1, y1)
                for x in range(min(x0, x1), max(x0, x1) + width): self.rect(x, y0, x, y0 + width - 1, ch)

# ---- 1. The hall: the winding stair, the gallery over the lava, the great cavern and its three ways on --------------
def hall():
    m = Map(68, 54)
    # The winding stair, two squares wide: up from the south, west, north, then east to the gallery.
    m.path([(29, 42), (29, 50)], ch='/')          # leg A, entered from the south
    m.path([(11, 40), (30, 40)], ch='/')          # leg B, west: the murder hole is in its north wall
    m.path([(11, 21), (11, 41)], ch='/')          # leg C, north
    m.path([(11, 21), (27, 21)], ch='/')          # leg D, east, to the gallery
    m.put(29, 52, '<')
    # The swinging blade: the stair narrows to one square through a slot in the rock.
    m.put(20, 21, '#'); m.put(20, 22, 'A')
    # The gallery: a stone shelf round a hole onto the lava far below. The way in is from the stair's top (north-east),
    # the way on a narrow ledge down its east side; the goblins keep the south side, by the murder hole.
    m.rect(15, 25, 28, 37, '.')
    m.rect(19, 27, 27, 32, '$')
    m.rect(19, 33, 25, 33, '$')
    m.rect(26, 23, 27, 24, '.')                    # the stair's top, down into the gallery
    m.put(18, 38, "'"); m.put(19, 38, "'"); m.put(18, 39, "'"); m.put(19, 39, "'")   # the murder hole
    m.put(17, 36, 'g')                             # the goblins at the hole
    m.rect(29, 35, 32, 36, '.')                    # the way out east, to the great cavern
    # The great cavern: wide and open, broken by columns of rock and two pools of lava.
    m.rect(33, 16, 58, 40, '.')
    for (x, y) in [(38, 21), (52, 21), (38, 34), (52, 34), (45, 27)]: m.rect(x, y, x + 1, y + 1, '#')
    m.ellipse(55, 37, 3, 2, '$'); m.ellipse(36, 18, 2.2, 1.6, '$')
    for (x, y) in [(41, 30), (42, 30), (48, 24), (49, 25), (56, 30)]: m.put(x, y, ';')
    m.put(46, 32, 'h'); m.put(55, 24, 'p')        # goblin groups in the cavern
    # North: the gate court, the portcullis and the gatehouse passage to the castle.
    m.rect(42, 9, 49, 15, '.')
    m.put(42, 9, '#'); m.put(49, 9, '#')
    m.rect(44, 3, 45, 7, '.'); m.put(44, 7, 'P'); m.put(45, 7, 'P')
    m.put(44, 2, 'K')
    m.put(45, 11, 'G')                             # the gate guards
    # East: the tunnel down towards the deep lair (not built yet).
    m.path([(59, 28), (64, 28)], ch='.'); m.path([(64, 28), (64, 33)], ch='/')
    m.put(64, 35, 'D'); m.put(65, 35, '#')
    # West: the small tunnel. A seam in its north wall (the secret way to the castle), then the bridge north over the
    # lava to the mines, then a small chamber with the way down to the lava lake.
    m.path([(4, 17), (32, 17)], ch='.')
    m.put(26, 16, 'S'); m.rect(26, 5, 26, 15, '.'); m.put(26, 4, 'Q')
    m.rect(13, 8, 24, 13, '$'); m.rect(20, 8, 21, 13, ')'); m.rect(20, 14, 21, 16, '.'); m.rect(20, 3, 21, 7, '.')
    m.put(20, 2, 'M'); m.put(21, 2, '#')
    m.rect(2, 12, 8, 20, '.'); m.put(2, 12, '#'); m.put(8, 20, '#'); m.put(1, 16, 'L')
    m.put(5, 13, 'w')                              # something in the small chamber
    return m

OPEN = set(".;/)'")
def dist(m, sx, sy):
    from collections import deque
    d = {(sx, sy): 0}; q = deque([(sx, sy)])
    while q:
        x, y = q.popleft()
        for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            n = (x + dx, y + dy)
            if 0 <= n[0] < m.w and 0 <= n[1] < m.h and n not in d and m.at(*n) in OPEN: d[n] = d[(x, y)] + 1; q.append(n)
    return d

def secrets(m, n):
    # Two-thick walls between passages that are far apart on foot: a seam there is a real short cut. Returns the
    # seam square and the square behind it (floor once found).
    best = []
    for y in range(3, m.h - 3):
        for x in range(3, 50):
            for (dx, dy) in [(1, 0), (0, 1)]:
                a, w1, w2, b = (x - dx, y - dy), (x, y), (x + dx, y + dy), (x + 2 * dx, y + 2 * dy)
                if m.at(*w1) == '#' and m.at(*w2) == '#' and m.at(*a) == '.' and m.at(*b) == '.':
                    best.append((dist(m, *a).get(b, 999), w1, w2))
    best.sort(reverse=True); out = []
    for d, w1, w2 in best:
        if all(abs(w1[0] - o[0][0]) + abs(w1[1] - o[0][1]) > 14 for o in out): out.append((w1, w2))
        if len(out) == n: break
    return out

def pitspot(m):
    # A square of a straight two-wide corridor in the north-east, on the way to the barracks.
    for y in range(2, 20):
        for x in range(36, 52):
            if m.at(x, y) != '.': continue
            if m.at(x - 1, y) == '.' and m.at(x + 1, y) == '.' and m.at(x, y - 1) == '#' and m.at(x, y + 1) == '.' and m.at(x, y + 2) == '#': return (x, y)
            if m.at(x, y - 1) == '.' and m.at(x, y + 1) == '.' and m.at(x - 1, y) == '#' and m.at(x + 1, y) == '.' and m.at(x + 2, y) == '#': return (x, y)
    raise Exception('no pit spot')

# ---- 2. The warrens: the goblins' working mine ------------------------------------------------------------------
def warrens():
    # Winding two-square passages (a depth-first maze with loops), then the set pieces cut in by hand.
    rnd = random.Random(11)
    COLS, ROWS = 13, 10
    W, H = COLS * 4 + 2 + 14, ROWS * 4 + 2
    m = Map(W, H)
    opened = {}
    seen = {(6, ROWS - 1)}; stack = [(6, ROWS - 1)]
    D = [(0, -1), (1, 0), (0, 1), (-1, 0)]
    def cell(i, j): m.rect(2 + 4 * i, 2 + 4 * j, 3 + 4 * i, 3 + 4 * j, '.')
    def link(i, j, d):
        dx, dy = D[d]; x, y = 2 + 4 * i, 2 + 4 * j
        if dx: m.rect(x + (2 if dx > 0 else -2), y, x + (3 if dx > 0 else -1), y + 1, '.')
        else: m.rect(x, y + (2 if dy > 0 else -2), x + 1, y + (3 if dy > 0 else -1), '.')
    cell(6, ROWS - 1)
    while stack:
        i, j = stack[-1]
        nb = [(d, i + D[d][0], j + D[d][1]) for d in range(4) if 0 <= i + D[d][0] < COLS and 0 <= j + D[d][1] < ROWS and (i + D[d][0], j + D[d][1]) not in seen]
        if not nb: stack.pop(); continue
        d, ni, nj = rnd.choice(nb)
        link(i, j, d); cell(ni, nj); seen.add((ni, nj)); stack.append((ni, nj))
    for _ in range(int(COLS * ROWS * 0.22)):           # loops: the mine is worked from many sides
        i, j = rnd.randrange(COLS - 1), rnd.randrange(ROWS - 1)
        link(i, j, rnd.choice([1, 2]))
    # Mined-out galleries: a few wider chambers.
    for (x0, y0, x1, y1) in [(22, 14, 31, 21), (6, 26, 13, 31), (38, 6, 45, 11), (34, 30, 43, 35)]: m.rect(x0, y0, x1, y1, '.')
    for (x, y) in [(24, 16), (29, 19), (8, 28), (40, 8), (37, 32), (41, 33)]: m.put(x, y, ';')
    # The way in, from the bridge in the hall (south).
    m.rect(26, H - 2, 27, H - 2, '.'); m.put(26, H - 1, 'm'); m.put(27, H - 1, '#')
    # The barracks gate (far north).
    m.rect(26, 1, 27, 1, '.'); m.put(26, 0, 'B'); m.put(27, 0, '#')
    # The pit trap (hidden) on the main run north-east, and the secret way back up from the pit behind a seam.
    m.put(*pitspot(m), 'T')
    m.put(52, 6, 'Z'); m.rect(53, 6, 55, 7, '.'); m.put(56, 6, 'U')
    # Ways down to the lava lake.
    m.put(1, 26, 'J')
    m.put(14, H - 1, 'Y'); m.rect(14, H - 3, 15, H - 2, '.')
    # Secret passages between galleries that the maze kept apart.
    for (w1, w2) in secrets(m, 3): m.put(*w1, 'z'); m.put(*w2, '.')
    # East: a passage to the edge of a lava chasm and the bridge to the gnomes' gate.
    m.rect(52, 18, 56, 19, '.')
    m.rect(57, 11, W - 3, 30, '$')
    m.rect(57, 18, W - 6, 19, ')')
    m.rect(W - 5, 16, W - 3, 21, '.'); m.put(W - 2, 18, 'N'); m.put(W - 2, 19, '#')
    # Who works here.
    for (x, y, c) in [(23, 15, '1'), (8, 29, '2'), (42, 7, '3'), (38, 33, '4'), (14, 6, '5'), (30, 26, 'd'), (W - 4, 20, 'n')]: m.put(x, y, c)
    m.put(4, 4, 'C'); m.put(46, 38, 'c')
    return m

# ---- 3. The lava lake: one great chamber, crossed only on stones ----------------------------------------------------
def lake():
    m = Map(44, 32)
    m.ellipse(22, 16, 19.5, 13.5, '$')
    # Shores: the west shore (the stair from the hall) and the north shore (the two ways down from the warrens).
    m.rect(2, 12, 6, 19, '.'); m.put(1, 15, 'l')
    m.rect(10, 2, 33, 4, '.'); m.put(12, 1, 'j'); m.put(31, 1, 'y')
    m.rect(9, 3, 9, 4, '.'); m.rect(34, 3, 34, 4, '.')
    # The stones: one square each, a winding way from the west shore to an island and on to the north shore.
    stones = [(7, 15), (8, 15), (9, 16), (10, 16), (11, 17), (12, 17), (13, 17), (14, 18), (15, 18), (16, 19), (17, 19), (18, 19)]
    # (stones step diagonally on the grid; each diagonal pair gets a corner stone so the party can walk it)
    walk = []
    for a, b in zip(stones, stones[1:]):
        walk.append(a)
        if a[0] != b[0] and a[1] != b[1]: walk.append((b[0], a[1]))
    walk.append(stones[-1])
    for (x, y) in walk: m.put(x, y, '.')
    m.rect(19, 17, 26, 22, '.'); m.rect(20, 23, 24, 23, '.')         # the island
    m.put(23, 19, 'X'); m.put(21, 21, 'e')                           # a chest and its keepers
    north = [(24, 16), (24, 15), (25, 14), (25, 13), (26, 12), (26, 11), (27, 10), (27, 9), (28, 8), (28, 7), (28, 6), (28, 5)]
    for (x, y) in north: m.put(x, y, '.')
    for (x, y) in [(25, 15), (26, 13), (27, 11), (28, 9)]: m.put(x, y, '.')
    return m

# ---- 4. The pit: the floor gives way, and something lives at the bottom ------------------------------------------------
def pit():
    m = Map(22, 20)
    m.ellipse(11, 10, 8.5, 7.5, '.')
    m.ellipse(11, 7, 3, 1.5, '$'); m.ellipse(6, 13, 1.6, 1.2, '$'); m.ellipse(16, 13, 1.6, 1.2, '$')   # lava welling up
    m.put(11, 11, 't'); m.put(11, 9, 'E')
    m.put(19, 14, 'z'); m.put(20, 14, '.'); m.put(21, 14, 'u')
    return m

# ---- 5. The barracks: goblin masonry at the north end of the mine ---------------------------------------------------
def barracks():
    m = Map(36, 26)
    m.rect(15, 18, 20, 23, '.'); m.put(17, 24, 'b'); m.put(18, 24, '#')     # the gate hall (in from the mine)
    m.rect(4, 3, 31, 6, '.')                                               # the long drill hall
    m.rect(16, 7, 19, 17, '.')                                             # the spine
    m.rect(4, 9, 12, 16, '.'); m.rect(13, 12, 15, 12, '.')                  # bunks (west)
    m.rect(23, 9, 31, 16, '.'); m.rect(20, 12, 22, 12, '.')                 # mess (east)
    m.rect(4, 19, 10, 22, '.'); m.rect(8, 17, 8, 18, '.')                   # armory
    m.rect(25, 19, 31, 22, '.'); m.rect(28, 17, 28, 18, '.')                # the captain's room
    for (x, y, c) in [(8, 12, '1'), (27, 12, '2'), (17, 4, '3'), (28, 20, '4')]: m.put(x, y, c)
    m.put(28, 22, 'C'); m.put(5, 20, 'r')
    m.put(12, 12, '+'); m.put(23, 12, '+'); m.put(8, 17, '+'); m.put(28, 17, '+')
    return m

# ---- 6. The gnome fort: dark mottled stone, across the chasm -------------------------------------------------------
def gnomes():
    m = Map(34, 28)
    m.rect(1, 12, 4, 15, '.'); m.put(0, 13, 'n'); m.put(0, 14, '#')      # the bridgehead (in from the warrens)
    m.rect(5, 13, 6, 14, '.'); m.put(7, 13, 'P'); m.put(7, 14, 'P')       # their gate (they open it to friends)
    m.rect(8, 8, 23, 19, '.')                                            # the yard
    for (x, y) in [(11, 10), (20, 10), (11, 16), (20, 16)]: m.put(x, y, '#')
    m.rect(26, 6, 31, 21, '.'); m.rect(24, 13, 25, 14, '.')               # the keep
    m.rect(10, 2, 21, 5, '.'); m.rect(15, 6, 16, 7, '.')                  # the workshop (north)
    m.rect(10, 22, 21, 25, '.'); m.rect(15, 20, 16, 21, '.')              # the stores (south)
    m.put(15, 15, 'k'); m.put(28, 12, 'K'); m.put(14, 3, 'w'); m.put(18, 24, 'C'); m.put(29, 18, 'h')
    return m

# ---- 7. The castle: grey goblin masonry, a loop round the throne ----------------------------------------------------
# West from the entrance: the living wing (bar, sleeping rooms, study, map room) up a long hall and round by the north
# passage to the throne room's west door. East: the champions' front room. From it a short passage looks like a dead
# end; a seam at its end opens into the king's rooms behind the throne. Missing it, the way on is north, along to the
# throne room's east door: the front of the throne. Across that passage, east, the high shaman's chambers. North of the
# throne, the stair down to the jail.
def castle():
    m = Map(50, 38)
    m.rect(19, 30, 30, 34, '.'); m.put(24, 35, 'S'); m.put(25, 35, '#')    # entrance hall (in from the gatehouse)
    m.put(28, 33, 'w'); m.put(22, 31, 'g')                                  # the portcullis winch; the hall guards
    # West wing.
    m.rect(8, 31, 18, 32, '.'); m.rect(5, 3, 7, 32, '.')
    m.put(14, 33, 'Q')                                                     # the secret way in, off the west passage
    for (y0, y1, door) in [(25, 28, 26), (18, 22, 20), (12, 15, 13), (7, 9, 8)]:
        m.rect(10, y0, 16, y1, '.'); m.put(8, door, '+'); m.put(9, door, '.')
    m.rect(1, 18, 3, 23, '.'); m.put(4, 20, '+')                            # a cramped bunk room
    m.rect(5, 3, 19, 4, '.')                                                # north passage to the throne room
    for (x, y, c) in [(12, 26, 'b'), (12, 20, 'r'), (12, 13, 'y'), (13, 8, 'm'), (2, 20, 'v')]: m.put(x, y, c)
    # The throne room; the throne on a dais at its south end; the stair down north of it.
    m.rect(20, 3, 31, 12, '.')
    for x in range(23, 29): m.put(x, 11, '|')
    m.put(25, 12, 'T'); m.put(26, 12, '|'); m.put(25, 8, 'k'); m.put(25, 2, 'J')
    # The king's rooms behind the throne, reached only by the seam.
    m.rect(20, 15, 31, 24, '.'); m.put(32, 19, '.'); m.put(33, 19, 'Z')
    m.put(28, 21, 'C'); m.put(23, 17, 'q'); m.put(22, 22, 'e')
    # East wing: the front room, the dead-end stub, and the way north.
    m.rect(31, 31, 35, 32, '.'); m.rect(36, 24, 45, 31, '.'); m.put(40, 27, 'c')
    m.rect(36, 19, 37, 23, '.'); m.rect(34, 19, 35, 20, '.')
    m.rect(43, 10, 44, 23, '.'); m.rect(32, 10, 44, 11, '.')
    # The high shaman's chambers, across the passage from the throne room.
    m.rect(36, 2, 46, 7, '.'); m.put(40, 8, '+'); m.put(40, 9, '.'); m.put(42, 4, 'x')
    return m

# ---- 8. The jail: cells and the question rooms under the throne ------------------------------------------------------
def jail():
    m = Map(32, 24)
    m.rect(14, 18, 17, 21, '.'); m.put(15, 22, 'j'); m.put(16, 22, '#')
    m.rect(3, 9, 28, 11, '.'); m.rect(15, 12, 16, 17, '.')
    for i, x in enumerate(range(3, 27, 5)):
        m.rect(x, 4, x + 2, 6, '.'); m.put(x + 1, 7, 'L'); m.put(x + 1, 8, '.')
    m.rect(3, 14, 10, 20, '.'); m.rect(11, 16, 14, 16, '.')               # the question room (west)
    m.rect(21, 14, 28, 20, '.'); m.rect(17, 16, 20, 16, '.')              # the second (east), and the way down
    m.put(28, 22, 'D'); m.rect(27, 21, 28, 21, '/')
    m.put(6, 17, 't'); m.put(24, 17, 'g'); m.put(4, 5, 'p'); m.put(19, 5, 'o')
    return m

MAPS = {'ember_hall': hall, 'ember_warrens': warrens, 'ember_lake': lake, 'ember_pit': pit, 'ember_barracks': barracks,
        'ember_gnomes': gnomes, 'ember_castle': castle, 'ember_jail': jail}

if __name__ == '__main__':
    png = sys.argv[sys.argv.index('--png') + 1] if '--png' in sys.argv else None
    only = [a for a in sys.argv[1:] if a in MAPS]
    for name, f in MAPS.items():
        if only and name not in only: continue
        m = f()
        print(f'{name}:  # {m.w}x{m.h}')
        for r in m.rows(): print(f'    - "{r}"')
        if png:
            from PIL import Image, ImageDraw
            C = {'#': (40, 36, 34), '.': (120, 110, 100), '$': (220, 80, 20), ')': (90, 80, 70), '/': (150, 140, 120), "'": (60, 40, 120), ';': (100, 90, 80), '+': (140, 90, 40), '|': (180, 160, 90)}
            S = 10
            im = Image.new('RGB', (m.w * S, m.h * S)); d = ImageDraw.Draw(im)
            for y, r in enumerate(m.rows()):
                for x, ch in enumerate(r):
                    d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], fill=C.get(ch, (60, 200, 90)))
                    if ch not in C: d.text((x * S + 2, y * S - 1), ch, fill=(0, 0, 0))
            im.save(f'{png}/{name}.png')
