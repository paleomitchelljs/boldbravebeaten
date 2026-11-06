# The Cinder Hall laid out after the goblin map (traced into clean.txt), with hand edits. Prints the rows.
import sys
rows = [list(r[4:]) for r in open(sys.argv[1]).read().split('\n')[2:] if r.strip()]
H, W = len(rows), len(rows[0])
def put(x, y, ch): rows[y][x] = ch
def rect(x0, y0, x1, y1, ch, only=None):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if only is None or rows[y][x] in only: rows[y][x] = ch
# -- cut the inferno half: the caves south of G-7a, the bar (G-14) and everything past the gate court
rect(17, 57, 38, 63, '#')
rect(39, 60, 77, 63, '#')
rect(56, 50, 77, 63, '#', only='.')
rect(66, 50, 74, 53, '.', only='#')          # G-10's south end stays
for (x, y) in [(66, 50), (66, 51), (66, 52), (66, 53), (67, 53), (74, 53)]: put(x, y, '#')
# -- G-1: the way in from the north-west, a stair down to a ledge round a pool of lava
put(1, 3, '<')
rect(2, 3, 4, 4, '/')
put(3, 4, 'A')
rect(5, 6, 6, 7, '$')
# the wall between G-1 and G-2, with the murder hole; the two meet at the top
rect(9, 6, 10, 9, '#'); rect(9, 7, 10, 8, "'")
rect(8, 9, 8, 9, '#')
# -- G-3: the hidden side duct from the west, to the duct between G-1 and G-11
rect(2, 38, 5, 39, '.'); put(1, 38, 'H')
# -- G-11: the mines' way on, west
put(4, 47, 'M'); put(4, 46, '#'); put(4, 48, '#')
# -- G-12: the baron's seat; a seam behind the throne
put(9, 62, 'S'); put(9, 63, 'Q'); rect(8, 62, 8, 62, '#'); rect(10, 62, 10, 62, '#')
# -- the river south of G-8, bridged where the way to the gate court crosses it
rect(44, 40, 50, 43, '$', only='.')
rect(46, 40, 47, 43, ')')
# -- G-13: the gate court and its portcullis, south
rect(48, 59, 51, 59, '.')
rect(49, 60, 50, 60, 'P'); rect(49, 61, 50, 62, '.'); put(49, 63, 'K')
# -- G-6 and G-10: the two bridge posts' ways out
put(74, 12, 'L'); rect(72, 12, 73, 12, '.')
rect(60, 49, 69, 54, '#', only='$')
rect(52, 55, 60, 59, '#', only='.')
put(71, 44, 'D')
rect(64, 47, 70, 48, '.', only='#'); rect(67, 49, 69, 49, '.', only='#')   # G-9 to G-10 along the river bank
put(4, 8, '.'); put(5, 44, '.')   # no squares that meet only at a corner
# -- who and what is where
for ch, x, y in [('g', 11, 7), ('h', 19, 6), ('n', 13, 5), ('w', 40, 6), ('a', 36, 4), ('b', 44, 8), ('u', 67, 12),
                 ('p', 21, 30), ('e', 17, 23), ('f', 16, 29), ('i', 25, 32), ('k', 38, 25), ('k', 43, 30), ('k', 40, 35),
                 ('k', 45, 27), ('r', 60, 35), ('v', 71, 49), ('x', 23, 50), ('y', 37, 49), ('m', 8, 50), ('o', 7, 46),
                 ('i', 8, 52), ('z', 10, 58), ('C', 11, 61), ('G', 49, 57), ('e', 41, 56)]:
    assert rows[y][x] == '.', (ch, x, y, rows[y][x])
    put(x, y, ch)
# every open square reachable from the way in
seen, todo = set(), [(2, 3)]
while todo:
    x, y = todo.pop()
    if (x, y) in seen or rows[y][x] == '#': continue
    seen.add((x, y))
    if rows[y][x] in "<HMLKQD'P$": continue
    todo += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
lost = [(x, y) for y in range(H) for x in range(W) if rows[y][x] not in "#$'" and (x, y) not in seen]
print('unreachable:', lost, file=sys.stderr)
print('\n'.join(''.join(r) for r in rows))
