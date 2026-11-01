# Lays out the three outdoor maps (the village, the swamp before the temple, the rock before the mine) and prints
# each as the `map:` rows for data/places.yaml.   python3 assets/wip/outside/layout.py
# Letters: # the bounding edge (jungle, or basalt), , grass, . path (the village's and the swamp's floor; the mine's
# rock), ~ deep water, $ lava, ) a stone bridge, ; old paving. Legend letters are placed by hand below; a building's
# picture stands on one square (its door) and `x` squares (props drawn as nothing) hold the rest of its footprint.

def grid(w, h, fill):
    return [[fill] * w for _ in range(h)]

def rect(g, x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = ch

def put(g, x, y, ch):
    g[y][x] = ch

def dot(g, x, y, ch):
    # Scenery only on open grass (never over a footprint, a path or water).
    if g[y][x] == ',': g[y][x] = ch

def building(g, x, y, door):
    # Door (or picture) square at (x, y); the footprint is the three squares across and the row behind.
    rect(g, x - 1, y - 1, x + 1, y, 'x')
    put(g, x, y, door)

def show(name, g):
    print(f'# {name}')
    for r in g:
        print(f'    - "{"".join(r)}"')

# ---- The village: a green with a well, the inn north of it, paths north (the mine) and east (the temple) ----------
W, H = 34, 26
v = grid(W, H, '#')
rect(v, 2, 2, W - 3, H - 3, ',')
rect(v, 16, 0, 17, 14, '.')          # the road north, out through the trees
rect(v, 8, 13, W - 1, 14, '.')       # the road east
rect(v, 8, 15, 9, 19, '.')           # a lane to the cottages
rect(v, 8, 19, 22, 19, '.')
rect(v, 13, 9, 20, 12, '.')          # the green before the inn
put(v, 16, 0, 'N'); put(v, 17, 0, 'N')
put(v, W - 1, 13, 'E'); put(v, W - 1, 14, '#')
building(v, 14, 8, 'I')              # the inn: its door leads into the town
building(v, 21, 8, 'k')              # the smithy
building(v, 24, 12, 'h')             # the shop
building(v, 12, 18, 'c')             # cottages
building(v, 18, 18, 'c')
building(v, 5, 11, 'c')
put(v, 18, 11, 'w')                  # the well
put(v, 19, 15, 's'); put(v, 21, 15, 's')     # market stalls
put(v, 15, 15, 'p')                  # signpost at the crossroads
put(v, 26, 18, 'g'); put(v, 27, 18, 'g'); put(v, 26, 20, 'r')   # garden and scarecrow
put(v, 24, 16, 'b'); put(v, 25, 16, 'o')     # barrels, crates by the shop
put(v, 23, 9, 'd'); put(v, 19, 7, 'y')       # woodpile and trough at the smithy, haystack
put(v, 7, 21, 'y'); put(v, 21, 21, 'a')      # haystack, handcart
for x, y in ((4, 4), (9, 3), (27, 4), (29, 8), (4, 17), (29, 21), (11, 22), (5, 22)):
    dot(v, x, y, 't')                # trees
for x, y in ((6, 6), (24, 4), (29, 16), (16, 22), (3, 14)):
    dot(v, x, y, 'u')                # bushes
for x in range(4, 8):
    put(v, x, 15, 'f')               # a fence by the west cottage
put(v, 11, 12, 'l'); put(v, 21, 12, 'l')     # lamp posts
put(v, 12, 15, 'n')                  # bench
show('village', v)

# ---- Before the temple: the temple's outer wall across the north (# here: the court's own wall tiles), its gate
# in the face; two small stepped pyramids of the court's tiers either side of the causeway up to it; swamp and
# jungle (]) round the rest. The court's gate is in its west wall; from outside the wall is drawn facing the way you
# come, so the gate shows as a door in a tall face.
def pyramid(g, x0, y0):
    # 12 x 11: a first riser (^) round a terrace (-) two wide, a second riser round a top (:), a stair up the south
    # face of each tier (i j, m n: the court's stair props, on the riser).
    rect(g, x0, y0, x0 + 11, y0 + 10, '^')
    rect(g, x0 + 1, y0 + 1, x0 + 10, y0 + 9, '-')
    rect(g, x0 + 3, y0 + 3, x0 + 8, y0 + 7, '^')
    rect(g, x0 + 4, y0 + 4, x0 + 7, y0 + 6, ':')
    put(g, x0 + 5, y0 + 10, 'i'); put(g, x0 + 6, y0 + 10, 'j')
    put(g, x0 + 5, y0 + 7, 'm'); put(g, x0 + 6, y0 + 7, 'n')

W, H = 40, 30
s = grid(W, H, ']')
rect(s, 0, 0, W - 1, 5, '#')         # the temple wall, four squares thick under two of jungle-free top
rect(s, 2, 6, W - 3, H - 3, ',')
put(s, 20, 5, 'G')                   # the gate, in the wall's face
rect(s, 19, 6, 21, 20, ';')          # the causeway: up to the gate...
rect(s, 0, 19, 21, 20, ';')          # ...from the west road
put(s, 0, 19, 'W'); put(s, 0, 20, ']'); put(s, 1, 20, ']')
put(s, 1, 19, ';')
pyramid(s, 5, 7)
pyramid(s, 24, 7)
for (x0, y0, x1, y1) in ((3, 23, 9, 26), (13, 22, 18, 26), (24, 21, 30, 26), (32, 19, 36, 24), (2, 7, 3, 12)):
    rect(s, x0, y0, x1, y1, '~')     # pools
for (x, y) in ((3, 23), (9, 26), (13, 22), (18, 26), (24, 21), (30, 26), (32, 19), (36, 24)):
    put(s, x, y, ',')                # break the pools' corners
for x, y in ((4, 18), (17, 21), (11, 21), (23, 18), (36, 8), (37, 14), (22, 27), (4, 21), (28, 19), (10, 27)):
    dot(s, x, y, 'F')
for x, y in ((18, 8), (22, 12), (2, 16), (33, 27), (15, 19), (37, 18), (8, 20), (26, 27)):
    dot(s, x, y, 'f')
show('temple approach', s)

# ---- Before the mine: black basalt, a lava channel crossed by a stone bridge, the mine mouth in the north cliff ------
W, H = 30, 24
m = grid(W, H, '#')
rect(m, 2, 3, W - 3, H - 3, '.')
rect(m, 2, 10, W - 3, 12, '$')       # the lava channel, east to west
for x in (2, 3, 26, 27): rect(m, x, 9, x, 9, '$')
rect(m, 14, 10, 15, 12, ')')         # the bridge
rect(m, 15, H - 3, 16, H - 1, '.')   # the road in from the south
put(m, 15, H - 1, '#'); put(m, 16, H - 1, 'S')
for (x0, y0, x1, y1) in ((2, 3, 5, 5), (23, 3, 27, 6), (2, 17, 4, 21), (24, 16, 27, 21), (9, 15, 11, 16), (19, 5, 20, 6)):
    rect(m, x0, y0, x1, y1, '#')     # outcrops
for (x0, y0, x1, y1) in ((5, 18, 6, 19), (20, 15, 21, 16)):
    rect(m, x0, y0, x1, y1, '$')     # lava seeps
put(m, 15, 3, 'M')                   # the mine mouth, in the cliff
rect(m, 14, 2, 16, 2, '#')
put(m, 12, 5, 'T')                   # a goblin totem
show('mine approach', m)
