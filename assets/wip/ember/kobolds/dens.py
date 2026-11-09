# The kobold dens laid out after the kobolds' map (traced into clean.txt), with hand edits. Prints the rows.
# python dens.py clean.txt > dens.txt   (reports unreachable squares on stderr)
import sys
rows = [list(r[4:]) for r in open(sys.argv[1]).read().split('\n')[2:] if r.strip()]
rows = [r[1:70] for r in rows[2:88]]            # trim the empty margin: x and y below are in the trimmed map
H, W = len(rows), len(rows[0])
def put(x, y, ch): rows[y][x] = ch
def rect(x0, y0, x1, y1, ch, only=None):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if only is None or rows[y][x] in only: rows[y][x] = ch
def near(x, y):
    # the open floor square nearest (x, y): placements follow the map's own coordinates, give or take a square
    best = None
    for yy in range(max(0, y - 3), min(H, y + 4)):
        for xx in range(max(0, x - 3), min(W, x + 4)):
            if rows[yy][xx] == '.':
                d = (xx - x) ** 2 + (yy - y) ** 2
                if best is None or d < best[0]: best = (d, xx, yy)
    assert best, (x, y)
    return best[1], best[2]
# Trace coordinates are (map x - 1, map y - 2) here: the source's columns and rows from the overlay.
T = lambda x, y: (x - 1, y - 2)
# -- the lava channel along the north, between the two tunnels to the bridges (B west, A east)
x0, y0 = T(31, 4); x1, y1 = T(58, 8)
rect(x0, y0, x1, y1, '$', only='.')
rect(*T(31, 4), *T(58, 4), '#')
# -- ways out: B and A north to the bridges and the goblins; D north-west, the lava duct to the gnomes; E, the
# tunnel down to the deep; the east tunnel and K-1's south tunnel out to the mountains
def exit_at(ch, x, y, run):
    # open a way out at (x, y) on the map's edge of a tunnel: `run` steps (dx, dy) to the tunnel's last floor
    dx, dy = run
    while rows[y][x] != '.':
        rows[y][x] = '.'; x += dx; y += dy
    return ch
for ch, (x, y), run in [('D', T(5, 9), (0, 1)),
                        ('M', T(69, 40), (-1, 0)), ('S', T(50, 86), (0, -1))]:
    xx, yy = x, y
    exit_at(ch, x, y, run)
    put(xx, yy, ch)
    put(xx + (1 if run[1] else 0), yy + (1 if run[0] else 0), ch)   # two squares wide
    if run[1]: rows[yy + run[1]][xx + 1] = '.'
    if run[0]: rows[yy + 1][xx + run[0]] = '.'
# B and A: two squares wide from the map's top edge down to the cave
rect(28, 0, 29, 3, '.'); put(28, 0, 'N'); put(29, 0, 'N')
rect(58, 0, 59, 3, '.'); put(58, 0, 'O'); put(59, 0, 'O')
# E: the old descending tunnel, a dead end at the top of the loop
ex, ey = T(33, 17)
rect(ex - 1, ey - 1, ex + 2, ey - 1, '#')
put(ex, ey, 'E')
# -- the fire pit before the king's throne (K-9): lava fifty feet down
px, py = T(44, 38)
rect(px, py, px + 1, py + 1, '$')
# -- who and what is where (source positions, snapped to the nearest floor)
PLACE = [
    ('a', 50, 81), ('a', 51, 83),                      # K-1 the first guard room
    ('b', 28, 71), ('f', 22, 72), ('f', 31, 76), ('f', 27, 68), ('t', 20, 75), ('j', 34, 74), ('w', 16, 71),
    ('c', 55, 71), ('f', 60, 70), ('f', 64, 67), ('i', 57, 69), ('w', 66, 63), ('X', 62, 72),   # K-3 hunters
    ('h', 38, 60), ('r', 39, 62), ('r', 40, 63), ('y', 36, 61), ('y', 42, 61),          # K-4 the pit and its hounds
    ('l', 51, 60), ('u', 49, 59), ('u', 53, 61),                                        # K-5 the den of lessons
    ('g', 61, 46),                                                                      # K-6 tunnel watchers
    ('v', 55, 22), ('f', 51, 21), ('f', 63, 20), ('f', 66, 25), ('m', 58, 25), ('s', 53, 24), ('Y', 64, 21),  # K-7
    ('p', 46, 47), ('P', 47, 46), ('Q', 49, 47),                                        # K-8 the most sacred pool
    ('k', 44, 35), ('T', 45, 33), ('z', 42, 37), ('z', 47, 37),                         # K-9 the fire pit hall
    ('q', 37, 31), ('Z', 38, 30),                                                       # K-10 the king's den
    ('H', 31, 44), ('W', 27, 48), ('z', 33, 47),                                        # K-11 the hall of howling
    ('K', 36, 38), ('z', 35, 37),                                                       # K-11a the keeper
    ('x', 24, 41), ('V', 21, 41),                                                       # K-12 the spirit's pool
    ('n', 13, 44), ('C', 9, 46), ('C', 15, 47), ('o', 16, 41),                          # K-13 the mines
    ('w', 9, 72), ('e', 7, 70),                                                         # K-13a
    ('d', 26, 60), ('B', 24, 58), ('B', 28, 62), ('L', 26, 63), ('R', 28, 58),          # K-14 the obsidian shapers
    ('U', 46, 14), ('G', 31, 11), ('G', 59, 12), ('F', 44, 13),                         # K-15 the cavern of the watch
]
for ch, x, y in PLACE:
    xx, yy = near(*T(x, y))
    put(xx, yy, ch)
# every open square reachable from the north-west tunnel
seen, todo = set(), [near(*T(29, 5))]
while todo:
    x, y = todo.pop()
    if (x, y) in seen or not (0 <= x < W and 0 <= y < H) or rows[y][x] in '#$': continue
    seen.add((x, y))
    if rows[y][x] in 'NODMSE': continue
    todo += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
lost = [(x, y) for y in range(H) for x in range(W) if rows[y][x] not in '#$' and (x, y) not in seen]
print('unreachable:', lost, file=sys.stderr)
print('\n'.join(''.join(r) for r in rows))
