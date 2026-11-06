# The goblin castle laid out after the inferno goblins' half of the goblin map: the west caves (G-15, G-16, G-17,
# G-20, G-23, G-24) and the forge (G-18) from the trace (stA_clean.txt), the rest drawn here. Prints the rows.
import sys
src = [list(r[4:]) for r in open(sys.argv[1]).read().split('\n')[2:] if r.strip()]
H, W = len(src), len(src[0])
rows = [['#'] * W for _ in range(H)]
def put(x, y, ch): rows[y][x] = ch
def rect(x0, y0, x1, y1, ch='.', only=None):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if only is None or rows[y][x] in only: rows[y][x] = ch
def keep(x0, y0, x1, y1):                     # copy the trace in this box
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): rows[y][x] = '.' if src[y][x] != '#' else '#'
def ellipse(cx, cy, rx, ry, ch='.'):
    for y in range(H):
        for x in range(W):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1: put(x, y, ch)
def path(pts, width=2, ch='.'):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        rect(min(x0, x1), min(y0, y1), max(x0, x1) + width - 1, max(y0, y1) + width - 1, ch)
# -- from the trace: G-15 and G-17 (the warrens), G-16 (the prison pits), G-20 (the harvester pit), the way down to
#    G-23 (the audience chamber) and G-24 (the king's rooms), G-18 (the forge)
keep(16, 8, 41, 43); keep(8, 13, 16, 21); keep(42, 17, 49, 29); keep(35, 43, 41, 49); keep(25, 44, 30, 49)
keep(65, 14, 71, 30)
rect(40, 8, 41, 13, '#')                      # the flame side's caves above the corridor stay out
path([(15, 18), (21, 18), (21, 21), (25, 21)])                 # G-16 to G-15
path([(30, 48), (35, 48)])                                     # G-24 to G-23
# -- G-13, the inside of the gate: a court, the way in from the portcullis (S) and the secret door (Q)
rect(48, 10, 54, 13)
put(51, 9, 'S'); put(47, 12, 'Q')
path([(50, 13), (50, 15), (37, 15)])                           # south-west to G-15
path([(55, 11), (56, 11), (56, 5), (59, 5)])                   # north-east, past the winch, to the bar
# -- G-14, the bar
rect(60, 3, 71, 9); rect(59, 5, 59, 7)
# -- the long corridor south past the forge (G-18) and the wizards' hall (G-19) to the guard post (G-21)
path([(56, 11), (56, 15), (63, 15), (63, 31)])
rect(65, 17, 66, 18)                                           # the forge's door
rect(72, 14, 73, 29, '$')                                      # the lava flow under the forge
# -- G-19, the wizards' hall: an octagon, a door each side
rect(54, 21, 60, 27); rect(53, 22, 61, 26)
path([(49, 24), (52, 24)]); path([(61, 24), (63, 24)])
# -- G-21, the guard post: a great uneven cave; its south-east tunnel (C) runs on to the gnomes
ellipse(63, 39, 7, 7); rect(60, 30, 66, 34); ellipse(57, 37, 3, 2); ellipse(58, 44, 3, 3); rect(66, 37, 71, 40)
path([(67, 41), (67, 46), (69, 46), (69, 51)])
# -- G-22, the champions' cave, off the way down to the king, and through to G-21
path([(41, 31), (44, 31), (44, 36), (47, 36), (47, 39)])
ellipse(49, 43, 4, 4)
path([(52, 42), (55, 42)])
# -- the seam from G-17 into the king's rooms (G-24)
rect(25, 39, 26, 41); rect(25, 43, 26, 43)
rect(31, 35, 32, 36)                                           # G-17's south-east lobe
# -- who and what is where
rect(69, 52, 70, 52, '#'); put(25, 42, 'Z'); put(12, 13, 'J'); put(69, 52, 'N')
for ch, x, y in [('g', 51, 11), ('w', 56, 8), ('b', 65, 6), ('B', 66, 3), ('t', 62, 7), ('t', 69, 7), ('F', 70, 19),
                 ('f', 70, 24), ('r', 33, 16), ('v', 24, 31), ('V', 18, 36), ('p', 10, 16), ('p', 13, 16), ('p', 10, 19),
                 ('D', 45, 21), ('x', 57, 24), ('y', 55, 22), ('m', 59, 26), ('u', 63, 38), ('c', 49, 43), ('k', 38, 46),
                 ('T', 38, 49), ('e', 26, 46), ('H', 28, 49), ('q', 27, 47)]:
    assert rows[y][x] == '.', (ch, x, y, rows[y][x])
    put(x, y, ch)
seen, todo = set(), [(51, 10)]
while todo:
    x, y = todo.pop()
    if (x, y) in seen or rows[y][x] == '#': continue
    seen.add((x, y))
    if rows[y][x] in "SQJNZ$": continue
    todo += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
lost = [(x, y) for y in range(H) for x in range(W) if rows[y][x] not in "#$" and (x, y) not in seen]
print('unreachable:', lost, file=sys.stderr)
print('\n'.join(''.join(r) for r in rows))
