# Lays out Tarnhold and the two Tarnvales again (the user, 2026-11-01, after a first look): closed-in mountain passes
# in the manner of the user's reference map (a canyon road winding between cliffs, a river with a waterfall, rope
# bridges, overlooks, side routes, buildings in nooks), roads narrow and mostly stone, gravel not meadow; the vales
# scarred by raids (barricades, palisades, burned carts); beyond each vale's gate the road runs on into grassland.
#   python3 assets/wip/tarn/layout.py            print the maps
#   python3 assets/wip/tarn/layout.py --write    put them in data/places.yaml (each place's `map:` rows)
# Letters: # mountain, , gravel, . road, ~ river, = rope bridge, @ fortress wall, ■ tower on a wall, [ overlook (a
# walkable rock shelf) inside a ring of ▲ (ledge, drawn as the shelf); in the grassland , grass, { a rise.
# Legend letters are placed here too; see each place's legend in data/places.yaml.
import math, random, re, sys, os

def grid(w, h, fill):
    return [[fill] * w for _ in range(h)]

def inside(g, x, y):
    return 0 <= y < len(g) and 0 <= x < len(g[0])

def rect(g, x0, y0, x1, y1, ch, only=None):
    for y in range(max(0, y0), min(len(g) - 1, y1) + 1):
        for x in range(max(0, x0), min(len(g[0]) - 1, x1) + 1):
            if only is None or g[y][x] in only: g[y][x] = ch

def ellipse(g, cx, cy, rx, ry, ch, only=None):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if inside(g, x, y) and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                if only is None or g[y][x] in only: g[y][x] = ch

def put(g, x, y, ch):
    if inside(g, x, y): g[y][x] = ch

def near(g, x, y, chars, r):
    return any(inside(g, x + dx, y + dy) and g[y + dy][x + dx] in chars for dy in range(-r, r + 1) for dx in range(-r, r + 1))

def segs(points):
    return list(zip(points, points[1:]))

def road(g, points, half=1):
    # A canyon road: two squares of road with `half` squares of gravel either side, cut through the rock. Segments run
    # along a row or a column; each turn is squared off.
    for (ax, ay), (bx, by) in segs(points):
        x0, x1, y0, y1 = min(ax, bx), max(ax, bx), min(ay, by), max(ay, by)
        rect(g, x0 - half, y0 - half, x1 + 1 + half, y1 + 1 + half, ',', only='#')
    for (ax, ay), (bx, by) in segs(points):
        rect(g, min(ax, bx), min(ay, by), max(ax, bx) + 1, max(ay, by) + 1, '.')

def trail(g, points, w=3):
    # A side path: gravel only, w wide.
    for (ax, ay), (bx, by) in segs(points):
        rect(g, min(ax, bx), min(ay, by), max(ax, bx) + w - 1, max(ay, by) + w - 1, ',', only='#')

def river(g, points, w=2):
    # Water w wide along the points (straight runs between them), a square of gravel bank each side; where it meets a
    # road the road becomes a rope bridge.
    cells = []
    for (ax, ay), (bx, by) in segs(points):
        n = max(abs(bx - ax), abs(by - ay))
        for t in range(n + 1):
            cells.append((round(ax + (bx - ax) * t / n), round(ay + (by - ay) * t / n)))
    for x, y in cells: rect(g, x - 1, y - 1, x + w, y + w, ',', only='#')
    for x, y in cells:
        for yy in range(y, y + w):
            for xx in range(x, x + w):
                if not inside(g, xx, yy): continue
                if g[yy][xx] == '.': g[yy][xx] = '='
                elif g[yy][xx] in ',#': g[yy][xx] = '~'

def overlook(g, x0, y0, x1, y1, stair_x):
    # A shelf of rock to stand on: a ring of ledge round the walkable top, steps up its south face at stair_x (two
    # squares wide, legend letters s t), and the ground before the steps cut clear.
    rect(g, x0, y0, x1, y1, '▲')
    rect(g, x0 + 1, y0 + 1, x1 - 1, y1 - 1, '[')
    put(g, stair_x, y1, 'S'); put(g, stair_x + 1, y1, 'T')
    rect(g, stair_x - 1, y1 + 1, stair_x + 2, y1 + 2, ',', only='#')

def tower(g, x0, y0):
    # A tower built on a wall: a 4x4 block of wall with the 2x2 tower top in its middle.
    rect(g, x0, y0, x0 + 3, y0 + 3, '@')
    rect(g, x0 + 1, y0 + 1, x0 + 2, y0 + 2, '■')

def gatewall(g, x, y_top, y_bot, gap_y):
    # A wall two thick across a valley (column x, rows y_top..y_bot), a gap two wide for the road at gap_y, gap_y+1, a
    # tower either side of the gap.
    rect(g, x, y_top, x + 1, y_bot, '@')
    rect(g, x, gap_y, x + 1, gap_y + 1, '.')
    tower(g, x - 1, gap_y - 4)
    tower(g, x - 1, gap_y + 2)

def building(g, x, y, pic, w=3, d=2):
    rect(g, x - w // 2, y - d + 1, x + (w - 1) // 2, y, 'x')
    put(g, x, y, pic)

def scatter(g, rnd, n, letters, box, r=1, on=','):
    # n props on open gravel in box, none within r of the road or a footprint, none next to a cliff, wall or water (so
    # squarewalls may flip squares there), none touching another.
    x0, y0, x1, y1 = box
    props = set(letters)
    for _ in range(n * 30):
        if n <= 0: break
        x, y = rnd.randint(x0, x1), rnd.randint(y0, y1)
        if not inside(g, x, y) or g[y][x] != on: continue
        if near(g, x, y, '.x=ST', r) or near(g, x, y, '#@■▲[~', 1) or near(g, x, y, props, 1): continue
        g[y][x] = rnd.choice(letters); n -= 1

def place(g, x, y, ch):
    # A prop at (x, y), or the nearest open gravel to it (within three squares) not beside the road or a cliff.
    for r in range(0, 4):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                xx, yy = x + dx, y + dy
                if max(abs(dx), abs(dy)) == r and inside(g, xx, yy) and g[yy][xx] == ',' and not near(g, xx, yy, '.=x#@■▲~ST', 1):
                    g[yy][xx] = ch; return

def trim(g):
    used = [y for y in range(len(g)) if any(c != '#' for c in g[y])]
    return g[max(0, used[0] - 2): used[-1] + 3]

MAPS = {}

# ---- Tarnhold: the pass comes down from the north to a junction; the road runs west and east from it. A river falls
# from the north-east mountains, runs south-west past the junction (a rope bridge on the east road) into a lake in the
# south-west. The fortress stands east of the river above the east road; an overlook west of the junction looks over
# the lake; a side road loops round a crag south of the junction; an inn and a stable in a nook by the junction.
def tarnhold():
    rnd = random.Random(21)
    W, H = 64, 46
    g = grid(W, H, '#')
    road(g, [(30, 0), (30, 5), (26, 5), (26, 12), (30, 12), (30, 21)])        # the pass
    road(g, [(30, 22), (22, 22), (22, 29), (10, 29), (10, 31), (0, 31)])      # west road
    road(g, [(31, 22), (39, 22), (39, 31), (52, 31), (52, 26), (63, 26)])     # east road
    road(g, [(30, 23), (30, 34), (22, 34), (22, 30)])                         # the loop round the crag
    rect(g, 13, 14, 23, 20, ',', only='#')                                    # the nook of the inn
    rect(g, 33, 33, 46, 40, ',', only='#')                                    # the camp below the fort
    river(g, [(42, 4), (42, 15), (36, 21), (36, 27), (34, 36), (24, 39), (18, 40)])
    ellipse(g, 13, 39, 6, 3.5, ',', only='#'); ellipse(g, 13, 39, 4.5, 2.4, '~')   # the lake
    rect(g, 8, 36, 9, 36, ',', only='#'); rect(g, 19, 38, 20, 38, ',', only='#')   # its shore squared (two-row steps)
    rect(g, 39, 0, 45, 3, '#')                                                # the cliff the falls come over
    put(g, 42, 4, 'A')                                                        # the waterfall, at the river's head
    # The fortress: walls round a court east of the river, towers at the corners and either side of its gate (south
    # wall, onto the east road), the keep a tall block in the court.
    X0, Y0, X1, Y1 = 48, 10, 59, 22
    rect(g, X0 - 3, Y0 - 3, X1 + 3, Y1 + 3, ',', only='#')                       # a margin of gravel round it
    rect(g, X0, Y0, X1, Y1, '@'); rect(g, X0 + 2, Y0 + 2, X1 - 2, Y1 - 2, '.')   # a flagged court
    for tx, ty in ((X0 - 2, Y0 - 2), (X1 - 1, Y0 - 2)): tower(g, tx, ty)        # towers on the north corners
    gx = 53
    rect(g, gx, Y1 - 1, gx + 1, Y1, '.'); rect(g, gx, Y1 + 1, gx + 1, 25, '.')
    tower(g, gx - 4, Y1 - 3); tower(g, gx + 2, Y1 - 3)
    rect(g, 51, 13, 56, 17, '@'); rect(g, 52, 14, 55, 16, '■')               # the keep
    # Overlook over the lake, steps from the west road.
    overlook(g, 4, 21, 12, 27, 7)
    rect(g, 3, 20, 13, 20, '#', only=',')
    # The inn's nook: the inn, a stable, a well; tables.
    building(g, 18, 17, 'I'); building(g, 15, 19, 'b')
    put(g, 21, 18, 'W'); put(g, 20, 20, 'k'); put(g, 16, 15, 'L')
    # The camp below the fort: tents, a brazier, racks, a watch platform.
    building(g, 36, 35, 'n', w=2, d=2); building(g, 41, 35, 'n', w=2, d=2); building(g, 44, 38, 'n', w=2, d=2)
    put(g, 38, 38, 'z'); put(g, 35, 39, 'r'); put(g, 40, 39, 'p'); put(g, 45, 34, 'v')
    # Banners at the fort gate, signposts at the junction.
    put(g, 51, 24, 'f'); put(g, 56, 24, 'f'); put(g, 28, 20, 'g')
    scatter(g, rnd, 10, 'PFt', (0, 0, W - 1, H - 1))
    scatter(g, rnd, 10, 'Rro', (0, 0, W - 1, H - 1), r=0)
    scatter(g, rnd, 5, 'l', (0, 0, W - 1, H - 1), r=0)
    put(g, 30, 0, 'N'); put(g, 31, 0, 'N'); put(g, 0, 31, 'Q'); put(g, 0, 32, 'Q'); put(g, 63, 26, 'E'); put(g, 63, 27, 'E')
    return g

# ---- A Tarnvale: the road winds from Tarnhold to the gate at the far end, through narrow canyon passages and two
# glades (an inn, a tavern); a river crosses it on a rope bridge; an upper road loops past an overlook; raid damage
# all along; at the gate wall, barricades and a camp; beyond it the road runs on to the grassland.
def vale(spec):
    rnd = random.Random(spec['seed'])
    W, H = 72, 40
    g = grid(W, H, '#')
    for pts in spec['roads']: road(g, pts)
    for pts in spec.get('trails', []): trail(g, pts)
    for box in spec['glades']: rect(g, *box, ',', only='#')
    gx, gy0, gy1, gap = spec['gate']
    rect(g, gx - 5, gy0, gx + 6, gy1, ',', only='#')                          # the gate yard
    for pts in spec['roads']: road(g, pts)                                    # the road again, over the yard
    river(g, spec['river'])
    gatewall(g, gx, gy0, gy1, gap)
    if 'falls' in spec:
        fx, fy = spec['falls']; rect(g, fx - 3, 0, fx + 3, fy - 1, '#'); put(g, fx, fy, 'A')
    overlook(g, *spec['overlook'])
    for box in spec.get('links', []): rect(g, *box, ',', only='#')       # a path from the overlook's steps
    for ch, x, y in spec['things']:
        if ch in 'IVb': building(g, x, y, ch)
        elif ch in 'nM': building(g, x, y, ch, w=2, d=2)
        else: place(g, x, y, ch)
    scatter(g, rnd, 22, 'PPFOYt', (0, 0, W - 1, H - 1))
    scatter(g, rnd, 14, 'Rrlo', (0, 0, W - 1, H - 1), r=0)
    scatter(g, rnd, 26, 'cdhjuyBCa', (0, 0, W - 1, H - 1), r=0)               # raid damage
    ex, ech = spec['entry']; ey = spec['roads'][0][0][1]
    put(g, ex, ey, ech); put(g, ex, ey + 1, ech)
    ox, oy = spec['out']; put(g, ox, oy, 'Z'); put(g, ox, oy + 1, 'Z')
    return g

def vale_west():
    return vale({
        'seed': 3,
        'roads': [[(71, 20), (62, 20), (62, 12), (50, 12), (50, 24), (34, 24), (34, 16), (22, 16), (22, 26), (0, 26)]],
        'trails': [[(48, 12), (40, 12), (40, 16)]],                                     # the upper road past the overlook
        'glades': [(47, 7, 60, 11), (24, 18, 31, 23)],
        'gate': (8, 20, 33, 26),
        'river': [(44, 2), (44, 9), (41, 14), (41, 30), (38, 38)],
        'falls': (44, 2),
        'overlook': (30, 4, 39, 9, 33),
        'links': [(33, 10, 42, 11)],
        'things': [('I', 56, 10), ('b', 53, 10), ('k', 58, 11), ('W', 60, 9),
                   ('V', 27, 21), ('k', 29, 22), ('L', 25, 22),
                   ('n', 13, 22), ('n', 13, 31), ('B', 4, 25), ('B', 4, 29), ('C', 16, 25), ('C', 16, 29), ('z', 15, 23),
                   ('p', 11, 24), ('v', 18, 31), ('f', 7, 23), ('f', 7, 30), ('a', 64, 22), ('g', 66, 22)],
        'entry': (71, 'E'), 'out': (0, 26),
    })

def vale_east():
    return vale({
        'seed': 8,
        'roads': [[(0, 18), (10, 18), (10, 28), (26, 28), (26, 12), (40, 12), (40, 24), (54, 24), (54, 16), (71, 16)]],
        'glades': [(14, 22, 22, 27), (42, 18, 50, 23)],
        'gate': (62, 10, 23, 16),
        'river': [(32, 0), (32, 8), (35, 14), (35, 39)],
        'falls': (32, 1),
        'overlook': (41, 4, 51, 9, 43),
        'things': [('V', 18, 25), ('k', 20, 26), ('L', 16, 26),
                   ('I', 46, 21), ('b', 49, 21), ('k', 44, 22), ('W', 43, 19),
                   ('n', 58, 12), ('n', 58, 21), ('B', 67, 15), ('B', 67, 19), ('C', 56, 15), ('C', 56, 19), ('z', 59, 14),
                   ('p', 60, 18), ('v', 57, 20), ('f', 64, 13), ('f', 64, 20), ('a', 5, 20), ('g', 4, 16)],
        'entry': (0, 'Q'), 'out': (71, 16),
    })

# ---- The grassland beyond a gate: rolling prairie, tall grass in the wind, the road running on to the far edge.
def plains(seed, west):
    rnd = random.Random(seed)
    W, H = 36, 26
    g = grid(W, H, ',')
    for cx, cy, rx, ry in ((8, 6, 5, 3), (27, 7, 6, 3.5), (12, 19, 6, 3), (28, 20, 5, 3), (19, 12, 3, 2)):
        ellipse(g, cx, cy, rx, ry, '{')
    yy = [13 + round(2 * math.sin(x / 6)) for x in range(W)]
    for x in range(W):
        for y in range(yy[x] - 1, yy[x] + 3):
            if g[y][x] == '{': g[y][x] = ','
        g[yy[x]][x] = '.'; g[yy[x] + 1][x] = '.'
        if x and abs(yy[x] - yy[x - 1]) == 1:
            lo, hi = min(yy[x], yy[x - 1]), max(yy[x], yy[x - 1]) + 1
            for y in range(lo, hi + 1): g[y][x] = '.'
    for _ in range(140):
        x, y = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
        if g[y][x] in ',{' and not near(g, x, y, '.', 1): g[y][x] = rnd.choice('GHJ')
    scatter(g, rnd, 8, 'OYR', (1, 1, W - 2, H - 2))
    ein = 0 if west else W - 1; eout = W - 1 if west else 0
    put(g, ein, yy[ein], 'E' if west else 'Q'); put(g, ein, yy[ein] + 1, 'E' if west else 'Q')
    put(g, eout, yy[eout], 'Z'); put(g, eout, yy[eout] + 1, 'Z')
    return g

def no_pinches(g):
    solid = set('#@■▲~')
    for _ in range(3):
        for y in range(len(g) - 1):
            for x in range(len(g[0]) - 1):
                a, b, c, d = g[y][x], g[y][x + 1], g[y + 1][x], g[y + 1][x + 1]
                # Open the blocking rock or water (never a wall or a tower) on one side of the corner.
                if a not in solid and d not in solid and b in solid and c in solid:
                    if b in '#~': g[y][x + 1] = ','
                    elif c in '#~': g[y + 1][x] = ','
                elif b not in solid and c not in solid and a in solid and d in solid:
                    if a in '#~': g[y][x] = ','
                    elif d in '#~': g[y + 1][x + 1] = ','
    return g

def no_pockets(g, start):
    solid, H, W = set('#@■▲~'), len(g), len(g[0])
    seen, stack = {start}, [start]
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and (g[q[1]][q[0]] not in solid or g[q[1]][q[0]] == '~'):
                seen.add(q); stack.append(q)
    for y in range(H):
        for x in range(W):
            if g[y][x] in ',' and (x, y) not in seen: g[y][x] = '#'
    return g

def entry(g, ch):
    return next((x, y) for y, row in enumerate(g) for x, c in enumerate(row) if c == ch)

for pid, make, way in (('tarnhold', tarnhold, 'N'), ('tarnvale_west', vale_west, 'E'), ('tarnvale_east', vale_east, 'Q')):
    g = no_pinches(make())
    MAPS[pid] = trim(no_pockets(g, entry(g, way)))
MAPS['tarn_plains_west'] = plains(4, False)
MAPS['tarn_plains_east'] = plains(9, True)

def write(path):
    text = open(path).read()
    for pid, g in MAPS.items():
        rows = ''.join(f'    - "{"".join(r)}"\n' for r in g)
        pat = re.compile(r'(^' + re.escape(pid) + r':\n(?:(?!^\S).*\n)*?  map:\n)((?:    - ".*"\n)*)', re.M)
        text, n = pat.subn(lambda m: m.group(1) + rows, text)
        if n != 1: sys.exit(f'{pid}: no map: in {path}')
        # Legend props the map doesn't use come out (the scatter differs from one layout to the next).
        used = set(''.join(''.join(r) for r in g))
        i = text.index(f'\n{pid}:\n'); j = text.index('  legend:\n', i); k = text.index('  encounters:', j)
        keep = [l for l in text[j:k].split('\n') if not re.match(r'    (\S): \{kind: prop', l) or l[4] in used]
        text = text[:j] + '\n'.join(keep) + text[k:]
    open(path, 'w').write(text)

if __name__ == '__main__':
    if '--write' in sys.argv:
        write(os.path.join(os.path.dirname(__file__), '../../../data/places.yaml'))
    else:
        for pid, g in MAPS.items():
            print(f'# {pid}')
            for r in g: print(f'    - "{"".join(r)}"')
