# Lays out the country south of the village (the user, 2026-11-01): the Hollin Hills (forested rolling hills rising
# to grey mountains, a narrow pass at the far south), Tarnhold (the fortress where the pass comes down onto the valley
# road) and the two Tarnvales (twisting narrow valleys west and east of it, glades with inns and taverns, a fortified
# gate at each end where the road runs on).
#   python3 assets/wip/south/layout.py            print the maps
#   python3 assets/wip/south/layout.py --write    put them in data/places.yaml (each place's `map:` rows)
# Letters: # mountain (the tileset's wall), , grass, . road (dirt in the hills, cobbles in the vales), } forest,
# { a low hill, ` scree, @ fortress wall; tiers.py then raises the mountains in rings (( a ledge, ? the summit). Legend letters are placed here too; see each place's legend in places.yaml.
import math, random, re, sys, os

def grid(w, h, fill):
    return [[fill] * w for _ in range(h)]

def rect(g, x0, y0, x1, y1, ch):
    for y in range(max(0, y0), min(len(g) - 1, y1) + 1):
        for x in range(max(0, x0), min(len(g[0]) - 1, x1) + 1):
            g[y][x] = ch

def ellipse(g, cx, cy, rx, ry, ch, only=None):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if 0 <= y < len(g) and 0 <= x < len(g[0]) and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                if only is None or g[y][x] in only: g[y][x] = ch

def put(g, x, y, ch):
    g[y][x] = ch

def building(g, x, y, pic, w=3, d=2):
    # The picture square (its door) at (x, y); `x` squares (drawn as nothing) hold the rest of the footprint behind it.
    rect(g, x - w // 2, y - d + 1, x + (w - 1) // 2, y, 'x')
    put(g, x, y, pic)

def near(g, x, y, chars, r):
    return any(0 <= y + dy < len(g) and 0 <= x + dx < len(g[0]) and g[y + dy][x + dx] in chars
               for dy in range(-r, r + 1) for dx in range(-r, r + 1))

def scatter(g, rnd, n, letters, box, clear='.x', r=1, on=','):
    # n props from `letters` on open grass in box, none within r of the road, a footprint or a cliff (where
    # squarewalls may need to flip a square), none touching another.
    x0, y0, x1, y1 = box
    props = set(letters)
    for _ in range(n * 20):
        if n <= 0: break
        x, y = rnd.randint(x0, x1), rnd.randint(y0, y1)
        if g[y][x] != on or near(g, x, y, clear, r) or near(g, x, y, '#}@', 1) or near(g, x, y, props, 1): continue
        g[y][x] = rnd.choice(letters); n -= 1

def show(name, g):
    print(f'# {name}')
    for r in g: print(f'    - "{"".join(r)}"')

MAPS = {}

# ---- The Hollin Hills: forest round the edge and in groves, low hills, the road winding south; from about half way
# the grey mountains close in from both sides until only the pass is left, four squares wide, at the far south.
def hills():
    rnd = random.Random(11)
    W, H = 44, 60
    g = grid(W, H, ',')
    rect(g, 0, 0, W - 1, 1, '}'); rect(g, 0, 0, 1, H - 1, '}'); rect(g, W - 2, 0, W - 1, H - 1, '}')
    def amp(y): return 6 if y < 36 else max(0, 6 * (50 - y) / 14)
    road = [21 + round(amp(y) * math.sin(y / 7.5)) for y in range(H)]
    # The mountains: from each side, growing southward; the pass below row 50.
    for y in range(26, H):
        t = y - 26
        lw = 2 + int(t * 0.55 + 1.5 * math.sin(y / 3.1) + 1.5)
        rw = 2 + int(t * 0.5 + 1.5 * math.sin(y / 2.7 + 2) + 1.5)
        lw = min(lw, road[y] - 3); rw = min(rw, W - (road[y] + 2) - 3)
        if y >= 50: lw, rw = 20, W - 24
        rect(g, 0, y, lw - 1, y, '#'); rect(g, W - rw, y, W - 1, y, '#')
    # Spurs of rock out in the hills, scree at their feet and along the mountains' edge.
    for cx, cy, rx, ry in ((9, 33, 3, 2.5), (34, 30, 3.5, 2.5), (30, 41, 2.5, 2.5), (12, 42, 2.5, 2)):
        ellipse(g, cx, cy, rx, ry, '#')
    for cx, cy, rx, ry in ((10, 36, 4, 2), (34, 33, 4, 2), (29, 44, 3, 2), (14, 45, 3, 1.5), (8, 40, 3, 3),
                           (36, 38, 3, 3), (17, 48, 2.5, 2), (27, 48, 2.5, 2), (21, 52, 1.5, 1.5)):
        ellipse(g, cx, cy, rx, ry, '`', only=',')
    # Groves of forest (the north half most) and low hills.
    for cx, cy, rx, ry in ((7, 6, 4, 3), (35, 5, 4, 3), (12, 15, 3, 3), (33, 17, 4, 3.5), (7, 19, 3, 2.5),
                           (38, 23, 2.5, 2), (24, 27, 2.5, 2), (16, 30, 2.5, 2)):
        ellipse(g, cx, cy, rx, ry, '}')
    for cx, cy, rx, ry in ((14, 7, 4, 2.5), (29, 10, 4, 3), (6, 15, 3, 3), (22, 19, 3.5, 2.5), (37, 11, 3, 3),
                           (10, 26, 3, 2), (32, 24, 3, 2.5), (20, 36, 3, 2), (27, 34, 2.5, 2)):
        ellipse(g, cx, cy, rx, ry, '{', only=',')
    # Forest never meets mountain (no tile joins the two cliff sets): a grove the rock reaches becomes rock, and where
    # the forest round the edge gives way to the mountains two rows of grass part them.
    rect(g, 0, 24, 1, 25, ','); rect(g, W - 2, 24, W - 1, 25, ',')
    changed = True
    while changed:
        changed = False
        for y in range(24, H):
            for x in range(W):
                if g[y][x] == '}' and near(g, x, y, '#', 1): g[y][x] = '#'; changed = True
    # The road, two wide, joined up where it shifts a column; kept clear of hills and groves by a square.
    prev = road[0]
    for y in range(H):
        a, b = min(prev, road[y]), max(prev, road[y]) + 1
        for x in range(a - 1, b + 2):
            if g[y][x] in '{}`': g[y][x] = ','
        rect(g, a, y, b, y, '.'); prev = road[y]
    put(g, road[0], 0, 'N'); put(g, road[0] + 1, 0, 'N')
    put(g, 21, H - 1, 'S'); put(g, 22, H - 1, 'S')
    # Things in the hills: trees thick in the north, thinning as the rock comes in; boulders and rocks to the south.
    scatter(g, rnd, 46, 'PPFOOYt', (2, 2, W - 3, 28))
    scatter(g, rnd, 14, 'PFFt', (2, 28, W - 3, 46))
    scatter(g, rnd, 10, 'sl', (2, 2, W - 3, 40))
    scatter(g, rnd, 12, 'Rrr', (2, 30, W - 3, 50), r=0)
    scatter(g, rnd, 9, 'w', (2, 2, W - 3, 34), r=0)
    # Crags at the mountains' foot (a 3/4 view shows no face on a cliff that faces north, so from the hills the rock
    # would read as flat ground): two squares off the rock, clear of the road and of each other.
    n = 0
    for _ in range(4000):
        if n >= 14: break
        x, y = rnd.randint(2, W - 3), rnd.randint(27, 49)
        if g[y][x] == ',' and near(g, x, y, '#', 2) and not near(g, x, y, '#}@', 1) and not near(g, x, y, '.', 2) \
                and not near(g, x, y, 'X', 3):
            g[y][x] = 'X'; n += 1
    put(g, road[4] + 3, 4, 'p')              # a signpost: north to the village, south to the pass
    put(g, road[22] - 2, 22, 'M')            # milestones
    put(g, road[40] + 3, 40, 'M')
    put(g, 20, 50, 'C'); put(g, 23, 50, 'C')  # cairns either side of the way into the pass
    put(g, road[31] + 3, 31, 'K')            # an old campfire by the road
    return g

# ---- Tarnhold: the pass comes down from the north between the mountains onto the valley road, and the fortress is
# built across both: its north gate takes the pass, its west and east gates the road.
def tarnhold():
    rnd = random.Random(5)
    W, H = 60, 36
    g = grid(W, H, '#')
    for x in range(W):
        # Edges step two rows at a time: a cliff face can't step down by one.
        top = 18 + 2 * round(math.sin(x / 5.0)); bot = 30 + 2 * round(0.8 * math.sin(x / 4.0 + 1))
        rect(g, x, top, x, bot, ',')
    rect(g, 15, 10, 44, 33, ',')                 # the fortress's ground, cut level
    for y in range(0, 10):                       # the pass, four wide, jogging a square
        j = 1 if 3 <= y <= 6 else 0
        rect(g, 27 + j, y, 30 + j, y, ',')
    ellipse(g, 22, 33, 4, 2, '`', only=','); ellipse(g, 39, 11, 3, 1.5, '`', only=',')
    # The walls, two thick: x 18..41, y 13..31.
    X0, Y0, X1, Y1 = 18, 13, 41, 31
    rect(g, X0, Y0, X1, Y1, '@'); rect(g, X0 + 2, Y0 + 2, X1 - 2, Y1 - 2, ',')
    # The road through it west to east (rows 24-25), and the pass road down to it (columns 28-29).
    rect(g, 0, 24, W - 1, 25, '.')
    for y in range(0, 24):
        j = 1 if 3 <= y <= 6 else 0
        rect(g, 28 + j, y, 29 + j, y, '.')
    # Gate towers either side of each gate: the picture on one square of the wall, the other drawn as nothing.
    for (px, py), (ox, oy) in (((18, 23), (19, 23)), ((18, 26), (19, 26)),             # west gate
                               ((41, 23), (40, 23)), ((41, 26), (40, 26))):            # east gate
        put(g, px, py, 'G'); put(g, ox, oy, 'x')
    # The north gate is a gatehouse astride the pass road: its picture on the gap's south square, spanning both.
    rect(g, 27, 13, 27, 14, '@'); rect(g, 30, 13, 30, 14, '@'); put(g, 28, 14, 'A')
    # Inside: the keep, a stable, the well, a barracks yard; towers in the corners.
    building(g, 34, 20, 'k', w=5, d=4)
    building(g, 23, 20, 'b')
    put(g, 25, 28, 'W')
    for x, y in ((21, 16), (38, 16), (21, 29), (38, 29)): put(g, x, y, 'T')
    put(g, 26, 22, 'h'); put(g, 31, 27, 'h')
    put(g, 22, 27, 'B'); put(g, 23, 27, 'o'); put(g, 36, 27, 'B'); put(g, 37, 28, 'o')
    for x, y in ((27, 16), (31, 16), (20, 22), (20, 27), (39, 22), (39, 27)): put(g, x, y, 'f')   # banners by the gates
    put(g, 32, 23, 'f')
    # Outside: rocks and a few trees down the valley.
    scatter(g, rnd, 8, 'PFt', (0, 16, 16, 33))
    scatter(g, rnd, 8, 'PFt', (43, 16, W - 1, 33))
    scatter(g, rnd, 6, 'Rr', (0, 16, W - 1, 33), r=0)
    put(g, 0, 24, 'Q'); put(g, 0, 25, 'Q'); put(g, W - 1, 24, 'E'); put(g, W - 1, 25, 'E'); put(g, 28, 0, 'N'); put(g, 29, 0, 'N')
    put(g, 26, 10, 'p')
    return g

# ---- A Tarnvale: the road from Tarnhold winds through narrow valleys (each turn a dog-leg in the rock), opening into
# glades; at the far end a wall across the valley with a gate, the road running on through it off the map.
def vale(points, glades, gate_x, exit_x, seed, things, entry):
    rnd = random.Random(seed)
    W, H = 70, 40
    g = grid(W, H, '#')
    # The valley along the road: six squares wide.
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        for t in range(0, 101):
            x = round(ax + (bx - ax) * t / 100); y = round(ay + (by - ay) * t / 100)
            r = 3
            rect(g, x - r + 1, y - r + 1, x + r, y + r, ',')
    # Glades: rectangles (a rounder shape steps its cliff face down one row at a time, which no tile draws).
    for cx, cy, rx, ry in glades: rect(g, cx - rx, cy - ry, cx + rx, cy + ry, ',')
    # Scree at the foot of the rock here and there.
    for _ in range(10):
        x, y = rnd.randint(3, W - 4), rnd.randint(3, H - 4)
        if g[y][x] == ',' and near(g, x, y, '#', 1): ellipse(g, x, y, 1.6, 1.3, '`', only=',')
    ry = points[-1][1]
    # A yard at the gate, wider than the valley, so the wall runs four squares either side of the towers.
    rect(g, gate_x - 4, ry - 5, gate_x + 5, ry + 6, ',')
    # The road, two wide.
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        rect(g, min(ax, bx), min(ay, by), max(ax, bx) + 1, max(ay, by) + 1, '.')
    # The gate wall across the valley, two thick, from rock to rock; the road's gap; a tower each side.
    ry = points[-1][1]
    open_rows = [y for y in range(H) if g[y][gate_x] != '#' or g[y][gate_x + 1] != '#']
    y0, y1 = min(open_rows), max(open_rows)
    rect(g, gate_x, y0, gate_x + 1, y1, '@')
    rect(g, gate_x, ry, gate_x + 1, ry + 1, '.')
    for yy in (ry - 1, ry + 2):
        put(g, gate_x, yy, 'G' if exit_x < gate_x else 'x'); put(g, gate_x + 1, yy, 'x' if exit_x < gate_x else 'G')
    put(g, exit_x, ry, 'Z'); put(g, exit_x, ry + 1, 'Z')
    for (ch, x, y, kw) in things:
        if ch in 'IV': building(g, x, y, ch)
        elif ch == 'b': building(g, x, y, ch)
        else: put(g, x, y, ch)
    scatter(g, rnd, 34, 'PPFOYt', (1, 1, W - 2, H - 2))
    scatter(g, rnd, 10, 'Rrsl', (1, 1, W - 2, H - 2), r=0)
    scatter(g, rnd, 8, 'w', (1, 1, W - 2, H - 2), r=0)
    for ch in 'PFOYtRrslw':
        if not any(ch in row for row in g): scatter(g, rnd, 1, ch, (1, 1, W - 2, H - 2), r=0)
    ex, ech = entry; ey = points[0][1]
    put(g, ex, ey, ech); put(g, ex, ey + 1, ech)
    # Two rows of rock above and below the valleys are enough.
    used = [y for y in range(H) if any(c != '#' for c in g[y])]
    return g[max(0, used[0] - 2): used[-1] + 3]

def vale_west():
    # From Tarnhold (east) a dog-leg north, west along a glade with the inn, south down a narrow cut, west through
    # the tavern's glade, a last dog-leg north, and west out through the gate.
    pts = [(69, 18), (57, 18), (57, 8), (33, 8), (33, 24), (14, 24), (14, 16), (0, 16)]
    glades = [(45, 8, 7, 5), (24, 25, 7, 5)]
    things = [('I', 45, 6, 0), ('b', 41, 6, 0), ('B', 43, 6, 0), ('H', 48, 6, 0), ('o', 50, 6, 0), ('K', 44, 11, 0),
              ('K', 47, 11, 0), ('t', 40, 11, 0), ('t', 50, 11, 0),
              ('V', 24, 22, 0), ('H', 21, 22, 0), ('B', 26, 22, 0), ('o', 27, 22, 0), ('K', 22, 27, 0), ('K', 26, 27, 0),
              ('t', 20, 28, 0), ('t', 28, 28, 0),
              ('M', 62, 21, 0), ('M', 36, 16, 0), ('p', 64, 16, 0)]
    return vale(pts, glades, 6, 0, 3, things, (69, 'E'))

def vale_east():
    # From Tarnhold (west) a dog-leg south, east through the tavern's glade, north up a narrow cut, east along the
    # inn's glade, a dog-leg south, and east out through the gate.
    pts = [(0, 18), (12, 18), (12, 28), (36, 28), (36, 12), (54, 12), (54, 20), (69, 20)]
    glades = [(24, 28, 8, 5), (45, 12, 7, 5)]
    things = [('V', 24, 26, 0), ('H', 21, 26, 0), ('B', 26, 26, 0), ('o', 27, 26, 0), ('K', 22, 31, 0), ('K', 26, 31, 0),
              ('t', 20, 32, 0), ('t', 28, 32, 0),
              ('I', 45, 10, 0), ('b', 41, 10, 0), ('B', 43, 10, 0), ('H', 48, 10, 0), ('o', 50, 10, 0), ('K', 44, 15, 0),
              ('K', 47, 15, 0), ('t', 40, 15, 0), ('t', 50, 15, 0),
              ('M', 15, 23, 0), ('M', 58, 23, 0), ('p', 4, 16, 0)]
    return vale(pts, glades, 62, 69, 8, things, (0, 'Q'))

def no_pinches(g):
    # Where two open squares touch only at a corner (the rules let nobody squeeze through), open one of the two
    # blocking squares to grass.
    solid = set('#}@')
    for _ in range(3):
        for y in range(len(g) - 1):
            for x in range(len(g[0]) - 1):
                a, b, c, d = g[y][x], g[y][x + 1], g[y + 1][x], g[y + 1][x + 1]
                if a not in solid and d not in solid and b in solid and c in solid: g[y][x + 1] = ','
                elif b not in solid and c not in solid and a in solid and d in solid: g[y][x] = ','
    return g

def no_pockets(g, start):
    # Open squares no way in reaches (grass shut inside a grove or a ring of rock) become what shuts them in.
    solid, H, W = set('#}@'), len(g), len(g[0])
    seen, stack = {start}, [start]
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and g[q[1]][q[0]] not in solid:
                seen.add(q); stack.append(q)
    for y in range(H):
        for x in range(W):
            if g[y][x] not in solid and (x, y) not in seen:
                ns = [g[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H]
                g[y][x] = '}' if '}' in ns else '@' if '@' in ns else '#'
    return g

def entry(g, ch):
    return next((x, y) for y, row in enumerate(g) for x, c in enumerate(row) if c == ch)

# Tarnhold and the vales are laid out by assets/wip/tarn/layout.py now (the user, 2026-11-01); their old layouts stay
# here for reference.
for pid, make, way in (('south_hills', hills, 'N'),):
    g = no_pinches(make())
    MAPS[pid] = no_pockets(g, entry(g, way))

def write(path):
    text = open(path).read()
    for pid, g in MAPS.items():
        rows = ''.join(f'    - "{"".join(r)}"\n' for r in g)
        pat = re.compile(r'(^' + re.escape(pid) + r':\n(?:(?!^\S).*\n)*?  map:\n)((?:    - ".*"\n)*)', re.M)
        text, n = pat.subn(lambda m: m.group(1) + rows, text)
        if n != 1: sys.exit(f'{pid}: no map: in {path}')
    open(path, 'w').write(text)

if __name__ == '__main__':
    if '--write' in sys.argv:
        write(os.path.join(os.path.dirname(__file__), '../../../data/places.yaml'))
    else:
        for pid, g in MAPS.items(): show(pid, g)
