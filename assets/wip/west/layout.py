# Lays out the lake country (north of the western grassland), the sarnak fortress's upper floor and the southern
# grassland with its clay canyon labyrinth (the user, 2026-11-10; README.md). Deterministic. Writes the three places
# into data/places.yaml between the "# >>> west" and "# <<< west" lines, with only the legend letters each map uses.
#   python3 assets/wip/west/layout.py
import math, os, random, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../orc'))
RINGS = '#(?▁▂▃▄'

def rings(rows):
    # ../orc/rings.py's rule: a ring a square by distance from open ground.
    H, W = len(rows), len(rows[0])
    rock = lambda x, y: not (0 <= x < W and 0 <= y < H) or rows[y][x] in RINGS
    out = [list(r) for r in rows]
    R = len(RINGS) + 1
    for y in range(H):
        for x in range(W):
            if rows[y][x] not in RINGS: continue
            d = min((math.hypot(dx, dy) for dy in range(-R, R + 1) for dx in range(-R, R + 1) if not rock(x + dx, y + dy)), default=R)
            out[y][x] = RINGS[max(0, min(len(RINGS) - 1, int(d) - 1))]
    return out

def scatter(g, rng, items, keep=lambda x, y: True):
    # items: [(letter, chance)] on plain grass with plain grass all round (so nothing blocks a road or a door).
    H, W = len(g), len(g[0])
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if g[y][x] != ',' or not keep(x, y): continue
            if any(g[y + dy][x + dx] not in ',GHJ' for dy in (-1, 0, 1) for dx in (-1, 0, 1)): continue
            r = rng.random()
            for letter, p in items:
                if r < p: g[y][x] = letter; break
                r -= p

# ---- The lake country ------------------------------------------------------------------------------------------
def lake():
    W, H = 56, 44
    rng = random.Random(11)
    g = [[','] * W for _ in range(H)]
    blobs = [((28, 8), (19, 11)), ((41, 13), (9, 7)), ((13, 6), (8, 5))]
    def water(x, y):
        wob = 0.08 * math.sin(x * 0.9) + 0.08 * math.cos(y * 1.1)
        return any(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + wob for (cx, cy), (rx, ry) in blobs)
    for y in range(H):
        for x in range(W):
            if water(x, y): g[y][x] = '~'
            if math.hypot(x - 38, y - 7) < 2.6: g[y][x] = ','          # an island with a ring of stones
    for x, y in ((37, 6), (39, 6), (38, 8)): g[y][x] = 'o'
    # The fortress on the south shore: a paved yard, two blocks of wall either side of the gate road.
    for y in range(20, 33):
        for x in range(13, 44): g[y][x] = '.'
    for y in range(21, 30):
        for x in list(range(15, 27)) + list(range(30, 42)): g[y][x] = '@'
    for y in range(33, 44):                                           # the road up to the yard (the gate passage is paved)
        for x in (27, 28): g[y][x] = '≡'
    for y in range(12, 20):                                           # the road runs out onto a jetty
        g[y][28] = '=' if g[y][28] == '~' or y < 19 else '.'
    for x in range(39, 50):                                           # a plank walk from the east shore to the island
        if g[7][x] == '~': g[7][x] = '='
        for x in (27, 29):
            if y >= 18: g[y][x] = '.'
    g[12][28] = 'X'
    g[29][20], g[29][36] = 'W', 'E'                                   # a door in each block's face
    g[30][26], g[30][30] = 'T', 'T'                                   # the towers flank the gate
    for x in (27, 28, 29): g[25][x] = 'B'                             # the rope bridge, overhead
    for x, y in ((22, 34), (34, 34), (17, 33), (39, 33), (24, 37), (32, 37)): g[y][x] = 'o'
    for x, y in ((25, 31), (31, 31)): g[y][x] = 'f'
    for x, y in ((18, 31), (38, 31)): g[y][x] = 'n'
    g[31][28] = 'g'
    g[15][28] = 'j'
    # A camp on the west shore, a patrol on the east.
    for (x, y), c in {(7, 24): 'c', (5, 23): 'n', (9, 23): 'f', (6, 26): 'e', (48, 26): 'p'}.items(): g[y][x] = c
    g[43][27] = g[43][28] = 'S'
    # Reeds along the shore, then grass, trees and boulders.
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if g[y][x] == ',' and any(g[y + dy][x + dx] == '~' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and rng.random() < 0.3: g[y][x] = 'r'
    scatter(g, rng, [('G', 0.03), ('H', 0.03), ('J', 0.02), ('O', 0.008), ('Y', 0.008), ('R', 0.006)])
    return g

LAKE_LEGEND = '''
    S: {kind: stairs, to: tarn_plains_west, at: N, sprite: none, label: "The road south, back to the grassland", on: "≡"}
    W: {kind: stairs, to: sarnak_fort, at: W, up: true, sprite: door, wall: true, label: "A low door in the western block"}
    E: {kind: stairs, to: sarnak_fort, at: E, up: true, sprite: door, wall: true, label: "A low door in the eastern block"}
    T: {kind: prop, sprite: tusk_tower, label: "A round tower, its roof ringed with tusks"}
    B: {kind: prop, sprite: ropebridge_over, solid: false, over: true, label: "A rope bridge, high overhead"}
    X: {kind: chest, label: "A sea chest at the jetty's end", loot: relic_cache, rolls: 1, tn: 9, on: "="}
    o: {kind: prop, sprite: standing_stone, label: "A standing stone cut with glyphs", on: ","}
    f: {kind: prop, sprite: brazier, label: "A brazier"}
    n: {kind: prop, sprite: tusk_standard, label: "A standard of tusks and hide"}
    e: {kind: prop, sprite: egg_nest, label: "A clutch of big leathery eggs", on: ","}
    g: {kind: monster, encounter: gate, label: "The gate guard"}
    j: {kind: monster, encounter: jetty, label: "A sarnak fishing off the jetty", on: "="}
    c: {kind: monster, encounter: camp, label: "Sarnaks at a shore camp", on: ","}
    p: {kind: monster, encounter: patrol, label: "A patrol on the shore", on: ","}
    r: {kind: prop, sprite: reeds, solid: false, label: "Reeds", on: ","}
    G: {kind: prop, sprite: tallgrass_gold, solid: false, label: "Tall grass", on: ","}
    H: {kind: prop, sprite: tallgrass_seed, solid: false, label: "Tall grass", on: ","}
    J: {kind: prop, sprite: tallgrass_flower, solid: false, label: "Tall grass and wildflowers", on: ","}
    O: {kind: prop, sprite: oak, label: "An oak", on: ","}
    Y: {kind: prop, sprite: birch, label: "A birch", on: ","}
    R: {kind: prop, sprite: boulder, label: "A boulder", on: ","}
'''
LAKE_HEAD = '''tarn_lake:
  name: The Lake Country
  kind: dungeon
  open: true
  blurb: Grassland round a broad lake; on its south shore a fortress of grey-green stone in two blocks, a rope bridge slung between them over the gate road.
  level: 3
  look: {wall: "#6a7466", floor: "#4f9a3c", ceiling: "#9ab8d6", fog: "#0c120a", torch: 0, tileset: lakeland, light: 28}
'''
LAKE_TAIL = '''  encounters:
    gate: {foes: [{monster: sarnak}, {monster: sarnak}], text: "Two sarnaks under the bridge lower their spears."}
    jetty: {foes: [{monster: sarnak}], text: "The sarnak drops its line and takes up a spear."}
    camp: {foes: [{monster: sarnak}, {monster: sarnak}], text: "Sarnaks rise from beside their clutch, hissing."}
    patrol: {foes: [{monster: sarnak}, {monster: sarnakKnight}], text: "A patrol turns off the shore toward you."}
  secrets: []
'''

# ---- The fortress, upstairs: two halls and the bridge between them ---------------------------------------------
def fort():
    W, H = 27, 9
    g = [['@'] * W for _ in range(H)]
    for y in range(1, H - 1):
        for x in list(range(1, 11)) + list(range(16, 26)): g[y][x] = '.'
    for y in range(H):
        for x in (12, 13, 14): g[y][x] = 'x'
    for x in (12, 13, 14): g[4][x] = 'b'
    g[4][11] = g[4][15] = '.'
    for x, y in ((2, 2), (3, 2), (2, 3), (3, 3), (22, 5), (23, 5), (22, 6), (23, 6)): g[y][x] = '@'   # a pier in each hall
    g[7][5], g[7][21] = 'W', 'E'
    for (x, y), c in {(6, 3): 'a', (8, 6): 'q', (1, 6): 'f', (10, 1): 'n', (9, 7): 'e',
                      (20, 3): 'k', (24, 1): 'X', (16, 1): 'n', (25, 7): 'f', (19, 6): 'e', (25, 2): 'i'}.items(): g[y][x] = c
    return g

FORT_LEGEND = '''
    W: {kind: stairs, to: tarn_lake, at: W, label: "Stairs down to the western door"}
    E: {kind: stairs, to: tarn_lake, at: E, label: "Stairs down to the eastern door"}
    x: {kind: prop, sprite: passage_below, label: "The gate passage, far below"}
    b: {kind: prop, sprite: ropebridge_span, solid: false, label: "The rope bridge"}
    X: {kind: chest, label: "The warden's coffer", loot: relic_cache, rolls: 2, tn: 11}
    f: {kind: prop, sprite: brazier, label: "A brazier"}
    n: {kind: prop, sprite: tusk_standard, label: "A standard of tusks and hide"}
    e: {kind: prop, sprite: egg_nest, label: "A clutch of big leathery eggs"}
    i: {kind: prop, sprite: standing_stone, label: "A stone cut with glyphs"}
    a: {kind: monster, encounter: hall, label: "Sarnaks in the western hall"}
    q: {kind: monster, encounter: brood, asleep: true, label: "A sarnak dozing by the eggs"}
    k: {kind: monster, encounter: warden, label: "The warden of the fortress"}
'''
FORT_HEAD = '''sarnak_fort:
  name: The Fortress on the Lake
  kind: dungeon
  blurb: The upper floor of the lake fortress: a hall in each block, and between them a rope bridge over the gate road.
  level: 3
  look: {wall: "#5a6458", floor: "#6f7868", ceiling: "#1a2224", fog: "#060a0a", torch: 1, tileset: lakeland, light: 18}
'''
FORT_TAIL = '''  encounters:
    hall: {foes: [{monster: sarnak}, {monster: sarnakKnight}], text: "Sarnaks snatch up spears from the wall."}
    brood: {foes: [{monster: sarnak}], text: "The brood-keeper uncoils and comes at you."}
    warden: {foes: [{monster: sarnakWarden}, {monster: sarnakKnight}], text: "The warden rises, a head taller than its guard, and levels its spear."}
  secrets: []
'''

# ---- The southern grassland and the clay canyon ----------------------------------------------------------------
def south():
    W, H = 64, 48
    rng = random.Random(23)
    g = [[','] * W for _ in range(H)]
    edge = lambda y: 30 + round(1.5 * math.sin(y * 0.5))
    for y in range(H):
        for x in range(edge(y), W): g[y][x] = '#'
    # The labyrinth: a maze of cells two squares wide, three squares of rock between them.
    NX, NY, X0, Y0, P = 6, 8, 33, 4, 5
    cell = lambda i, j: (X0 + P * i, Y0 + P * j)
    def dig(x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): g[y][x] = '.'
    def join(a, b):
        (ax, ay), (bx, by) = cell(*a), cell(*b)
        dig(min(ax, bx), min(ay, by), max(ax, bx) + 1, max(ay, by) + 1)
    seen, stack = {(0, 4)}, [(0, 4)]
    walls = set()
    while stack:
        i, j = stack[-1]
        nb = [(i + dx, j + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= i + dx < NX and 0 <= j + dy < NY and (i + dx, j + dy) not in seen]
        if not nb: stack.pop(); continue
        n = rng.choice(nb)
        join((i, j), n); seen.add(n); stack.append(n)
    for _ in range(7):                                                # a few loops, so it is a labyrinth with choices
        i, j = rng.randrange(NX - 1), rng.randrange(NY - 1)
        join((i, j), rng.choice([(i + 1, j), (i, j + 1)]))
    courts = {'boss': (4, 0), 'camp': (2, 3), 'herd': (4, 6)}
    for i, j in courts.values():
        x, y = cell(i, j); dig(x, y, x + P + 1, y + P + 1)
    mx, my = cell(0, 4)
    dig(27, my, mx, my + 1)                                           # the canyon's mouth
    for y in range(my - 3, my + 5):                                   # a fan of soil washed out onto the grass
        for x in range(22, 31):
            if g[y][x] == ',' and ((x - 29) / 7) ** 2 + ((y - my - 0.5) / 3.6) ** 2 < 1: g[y][x] = '.'
    # The road: north to south down the grass, past the canyon's wash.
    road = lambda y: 16 + round(3 * math.sin(y / 7))
    for y in range(H):
        for x in (road(y), road(y) + 1): g[y][x] = '≡'
    # (No branch to the canyon: a road sheet and the soil's each draw a grass edge where they meet. The wash is the way in.)
    g[0][road(0)] = g[0][road(0) + 1] = 'N'
    g[H - 1][road(H - 1)] = g[H - 1][road(H - 1) + 1] = 'S'
    # Who and what is in it.
    def put(c, i, j, dx=0, dy=0):
        x, y = cell(i, j); g[y + dy][x + dx] = c
    bx, by = cell(*courts['boss']); cx, cy = cell(*courts['camp']); hx, hy = cell(*courts['herd'])
    for (x, y), c in {(bx + 3, by + 3): 'K', (bx + 5, by + 1): 'X', (bx + 1, by + 1): 'u', (bx + 5, by + 5): 'n', (bx + 3, by + 1): 'c',
                      (cx + 3, cy + 2): 'm', (cx + 2, cy + 2): 'x', (cx + 4, cy + 2): 'x', (cx + 3, cy + 4): 'M', (cx + 1, cy + 5): 'n', (cx + 5, cy + 5): 's',
                      (hx + 3, hy + 3): 'P', (hx + 1, hy + 1): 'u', (hx + 5, hy + 2): 'n', (hx + 2, hy + 5): 's'}.items(): g[y][x] = c
    put('a', 1, 1); put('a', 3, 7, 1, 1); put('a', 5, 3); put('a', 1, 6, 1, 0); put('a', 0, 0, 1, 1)
    g[my][25] = 'a'
    for i, j, c in ((0, 2, 'n'), (2, 0, 'd'), (5, 5, 'n'), (3, 5, 'D'), (1, 4, 'D'), (2, 7, 'd'), (0, 7, 'D'), (5, 2, 'd')):
        x, y = cell(i, j)
        if g[y + 1][x + 1] == '.': g[y + 1][x + 1] = c
    for x, y in ((26, my - 2), (24, my + 3), (28, my + 3)): g[y][x] = 'D' if g[y][x] in ',.' else g[y][x]
    for x, y in ((23, my - 3), (27, my + 4)): g[y][x] = 'd'
    for y in range(H):                                                # soil at the mountains' foot (the slope stands on soil)
        for x in range(W):
            if g[y][x] == ',' and any(0 <= y + dy < H and 0 <= x + dx < W and g[y + dy][x + dx] == '#' for dy in (-1, 0, 1) for dx in (-1, 0, 1)): g[y][x] = ';'
    g = [[('.' if c == ';' else c) for c in r] for r in g]
    g = rings([''.join(r) for r in g])
    scatter(g, rng, [('G', 0.03), ('H', 0.03), ('J', 0.02), ('O', 0.008), ('Y', 0.006), ('R', 0.006)], keep=lambda x, y: x < 28)
    return g

SOUTH_LEGEND = '''
    N: {kind: stairs, to: tarn_plains_west, at: S, sprite: none, label: "The road north, to the grassland", on: "≡"}
    S: {kind: stairs, to: desert, at: N, sprite: none, label: "South, toward the desert", on: "≡"}
    K: {kind: monster, encounter: bull, label: "The lord of the labyrinth"}
    M: {kind: monster, encounter: camp, label: "Minotaurs at their yurt"}
    P: {kind: monster, encounter: herd, label: "Minotaurs about a totem"}
    a: {kind: monster, encounter: lone, label: "A minotaur in the passage"}
    X: {kind: chest, label: "A hide-bound chest", loot: troll_hoard, rolls: 1, tn: 10}
    m: {kind: prop, sprite: tent_minotaur, label: "A great hide yurt, bull horns over its door"}
    x: {kind: prop, sprite: none, label: "The yurt"}
    u: {kind: prop, sprite: horn_totem, label: "A post crowned with a horned skull"}
    n: {kind: prop, sprite: bone_heap, label: "A heap of gnawed bones and horned skulls"}
    c: {kind: prop, sprite: bonfire, label: "A bonfire"}
    s: {kind: prop, sprite: campfire_small, label: "A smoky fire"}
    d: {kind: prop, sprite: dead_tree, label: "A dead tree, bleached white"}
    D: {kind: prop, sprite: clay_boulder, label: "A boulder of red rock"}
    G: {kind: prop, sprite: tallgrass_gold, solid: false, label: "Tall grass", on: ","}
    H: {kind: prop, sprite: tallgrass_seed, solid: false, label: "Tall grass", on: ","}
    J: {kind: prop, sprite: tallgrass_flower, solid: false, label: "Tall grass and wildflowers", on: ","}
    O: {kind: prop, sprite: oak, label: "An oak", on: ","}
    Y: {kind: prop, sprite: birch, label: "A birch", on: ","}
    R: {kind: prop, sprite: boulder, label: "A boulder", on: ","}
'''
SOUTH_HEAD = '''tarn_plains_south:
  name: The Southern Grassland
  kind: dungeon
  open: true
  blurb: Prairie running south toward the desert; on its east the mountains open in a canyon of red clay and tan rock, a labyrinth where minotaurs live.
  level: 4
  look: {wall: "#a8502c", floor: "#c8a878", ceiling: "#9ab8d6", fog: "#0c120a", torch: 0, tileset: clay_canyon, light: 28}
'''
SOUTH_TAIL = '''  encounters:
    lone: {foes: [{monster: minotaur}], text: "A minotaur comes round the rock, snorting."}
    camp: {foes: [{monster: minotaur}, {monster: minotaur}], text: "Two minotaurs duck out of the yurt with axes in their fists."}
    herd: {foes: [{monster: minotaur}, {monster: minotaur}], text: "The minotaurs at the totem lower their horns."}
    bull: {foes: [{monster: minotaurLord}], text: "The lord of the labyrinth bellows, and the walls throw it back."}
  secrets: []
'''

def reach(g, start, walls):
    H, W = len(g), len(g[0])
    seen, todo = {start}, [start]
    while todo:
        x, y = todo.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and g[n[1]][n[0]] not in walls: seen.add(n); todo.append(n)
    return seen

def place(head, g, legend, tail):
    used = set(c for r in g for c in r)
    keep = [l for l in legend.strip('\n').split('\n') if l.strip()[0] in used]
    return head + '  map:\n' + ''.join('    - "' + ''.join(r) + '"\n' for r in g) + '  legend:\n' + '\n'.join(keep) + '\n' + tail

if __name__ == '__main__':
    L, F, S = lake(), fort(), south()
    for name, g, start, walls, solid in (('lake', L, (27, 42), '~@', 'TRYOofne'), ('south', S, (16, 1), RINGS, 'mxundDRYOXc s')):
        ok = reach(g, start, walls + solid)
        lost = [(x, y) for y in range(len(g)) for x in range(len(g[0])) if g[y][x] not in walls + solid and (x, y) not in ok]
        print(name, len(g[0]), 'x', len(g), 'unreachable:', len(lost), lost[:12], file=sys.stderr)
    text = '\n'.join([place(LAKE_HEAD, L, LAKE_LEGEND, LAKE_TAIL), place(FORT_HEAD, F, FORT_LEGEND, FORT_TAIL), place(SOUTH_HEAD, S, SOUTH_LEGEND, SOUTH_TAIL)])
    path = os.path.join(os.path.dirname(__file__), '../../../data/places.yaml')
    src = open(path).read()
    a, b = src.index('# >>> west'), src.index('# <<< west')
    a = src.index('\n', a) + 1
    open(path, 'w').write(src[:a] + text + '\n' + src[b:])
    if '--show' in sys.argv:
        for g in (L, F, S): print('\n'.join(''.join(r) for r in g) + '\n')
