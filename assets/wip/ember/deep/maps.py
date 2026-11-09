# The deep mine below the goblins (the user, 2026-11-08): the black-glass duct down, the fire giants' basalt citadel
# round the dragon's lair, and the lair. The citadel is traced by eye from the map on page 82 of *Solusek's Eye*
# (Chapter Six, F-1 to F-18; the PDF is local only), three squares to the book's 40-ft square. Prints the three
# `map:` blocks for data/places.yaml; after that the YAML is the source.
#   python3 assets/wip/ember/deep/maps.py

def grid(w, h, ch='#'):
    return [[ch] * w for _ in range(h)]

def rect(g, x0, y0, x1, y1, ch='.'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = ch

def house(g, x0, y0, x1, y1, door, inner='.'):
    """A building: a wall of `@` round a floor, two squares thick north and south (the cliff set has no tile for a
    wall one square thick that way); door = (x, y) on the wall, a plain gap through it."""
    rect(g, x0, y0, x1, y1, '@')
    rect(g, x0 + 1, y0 + 2, x1 - 1, y1 - 2, inner)
    dx, dy = door
    if dy == y0: g[y0][dx] = g[y0 + 1][dx] = inner
    elif dy == y1: g[y1][dx] = g[y1 - 1][dx] = inner
    else: g[dy][dx] = inner

def put(g, x, y, ch):
    g[y][x] = ch

def reach(g, start):
    """Squares that can't be walked to from `start` (walls, rock and lava aside; doors and legend squares count)."""
    H, W = len(g), len(g[0]); seen = {start}; todo = [start]
    while todo:
        x, y = todo.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and g[ny][nx] not in '#@$':
                seen.add((nx, ny)); todo.append((nx, ny))
    return [(x, y) for y in range(H) for x in range(W) if g[y][x] not in '#@$' and (x, y) not in seen]

def show(name, g):
    print(f'# {name} ({len(g[0])} x {len(g)})')
    for r in g:
        print(f'    - "{"".join(r)}"')

# ---- The citadel (60 x 76) -------------------------------------------------------------------------------------------
def citadel():
    W, H = 60, 76
    g = grid(W, H)
    # The cavern: open under the whole city; its east side narrows below the palace (the book's rock spur).
    rect(g, 1, 2, 58, 34)
    rect(g, 1, 35, 44, 73)
    g[0][50] = 'N'; g[1][50] = '.'                                   # F-9a: the north passage to the chasm
    rect(g, 1, 13, 6, 22)                                           # F-8: the mines, a pocket in the west wall

    # F-2, common quarters.
    house(g, 11, 2, 16, 9, (15, 9)); house(g, 16, 2, 22, 9, (19, 9)); house(g, 22, 2, 27, 9, (24, 9))
    house(g, 49, 8, 58, 14, (49, 11))
    house(g, 17, 12, 27, 18, (22, 18)); rect(g, 22, 14, 22, 16, '@')
    g[16][22] = '@'; g[17][22] = '@'; g[18][22] = '@'; g[17][19] = g[18][19] = '.'; g[17][25] = g[18][25] = '.'
    house(g, 19, 20, 25, 26, (22, 26))
    house(g, 4, 26, 10, 32, (10, 29)); house(g, 12, 28, 18, 34, (18, 31))
    house(g, 1, 34, 7, 40, (7, 37)); house(g, 1, 41, 7, 47, (7, 44))
    house(g, 1, 56, 6, 62, (3, 56)); house(g, 1, 63, 6, 69, (3, 69))
    house(g, 26, 58, 31, 64, (26, 61)); house(g, 29, 66, 35, 72, (32, 66))
    # F-10 temple, F-11 jeweller's forge and kiln, F-7 the giant forge (open to the street).
    house(g, 29, 2, 36, 11, (32, 11)); house(g, 38, 2, 44, 7, (41, 7)); house(g, 6, 10, 14, 17, (14, 13))
    g[14][14] = '.'
    # F-13 hall of wizardry: a front room and four cells behind.
    house(g, 40, 12, 46, 23, (43, 23))
    rect(g, 41, 16, 45, 17, '@'); g[16][42] = g[17][42] = '.'; g[16][44] = g[17][44] = '.'
    rect(g, 43, 14, 43, 15, '@')
    # F-12 the magus's abode and 12a his study.
    house(g, 47, 17, 54, 23, (50, 23)); house(g, 54, 17, 58, 23, (54, 20))
    # F-16 the king's palace (door north, onto the courtyard): a guard hall and the throne room.
    house(g, 27, 24, 38, 35, (32, 24))
    rect(g, 28, 29, 37, 30, '@'); g[29][32] = g[30][32] = '.'
    # F-14 the mausoleum.
    house(g, 44, 26, 58, 33, (44, 29))
    # The black column south-east of the palace.
    rect(g, 37, 37, 41, 39, '#')
    # F-5 the arena: a ring of seating round the pit; the ramp in on the north wall.
    house(g, 11, 37, 33, 57, (22, 37))
    rect(g, 13, 40, 31, 54, '/'); rect(g, 15, 42, 29, 52, '.'); rect(g, 22, 40, 22, 41, '.')
    # F-6 the warlord's manse.
    house(g, 1, 48, 7, 54, (7, 51))
    # F-1 the gates: a gatehouse in the south-west, the ramp down out of the city.
    house(g, 6, 59, 12, 66, (9, 59)); g[65][9] = g[66][9] = g[65][10] = g[66][10] = '.'
    for y in (72, 73):
        for x in range(W):
            if g[y][x] == '.': g[y][x] = '#'                        # the cavern's south wall, thick enough to draw
    rect(g, 1, 70, 1, 71, 'G'); rect(g, 0, 70, 0, 71, 'D')         # the gates in the cavern's west wall; the duct beyond
    # F-3 the grand hall (open in front) and F-4 the cookhouse behind it.
    house(g, 14, 59, 22, 73, (18, 59)); g[59][19] = g[60][19] = '.'
    house(g, 22, 66, 27, 73, (22, 69))
    # F-15 the torture pit and the guest rooms: a hall, a room north, three cells.
    house(g, 36, 57, 43, 72, (36, 65))
    rect(g, 37, 61, 42, 62, '@'); g[61][39] = g[62][39] = '.'
    rect(g, 40, 63, 40, 70, '@'); g[66][40] = '.'
    # F-17 the vestibule, and the tunnel east to the lair.
    house(g, 39, 47, 44, 54, (39, 50)); g[50][44] = '.'
    rect(g, 45, 49, 52, 51); rect(g, 51, 41, 52, 51); rect(g, 51, 41, 58, 42); g[41][59] = 'L'
    return g

# ---- The duct (36 x 40): three ways in at the top, down through black glass to the citadel's ramp -------------------
def duct():
    W, H = 36, 40
    g = grid(W, H)
    rect(g, 3, 2, 7, 6); g[4][0] = 'h'; rect(g, 1, 4, 2, 4)                     # from the hall's east tunnel
    rect(g, 15, 1, 20, 5); g[2][17] = 'p'                                       # under the castle's harvester pit
    rect(g, 28, 2, 32, 6); g[0][30] = 'j'; rect(g, 30, 1, 30, 1, '/')          # the jail's stair comes down
    rect(g, 7, 4, 15, 5); rect(g, 20, 4, 28, 5)                                 # the three join
    # The duct winds down: a stair at each bend.
    rect(g, 17, 6, 18, 12, '/'); rect(g, 9, 12, 18, 13); rect(g, 9, 14, 10, 19, '/')
    rect(g, 9, 19, 26, 20); rect(g, 25, 21, 26, 25, '/'); rect(g, 12, 25, 26, 26)
    # The ledge over the magma pool, and the ramp down to the gates.
    rect(g, 10, 27, 30, 35, '$'); rect(g, 10, 26, 13, 27); rect(g, 10, 28, 11, 35); rect(g, 10, 36, 25, 37)
    rect(g, 23, 36, 25, 37, '/'); g[38][24] = '/'; g[39][24] = 'C'; g[39][25] = '#'
    for x, y in [(30, 27), (30, 35), (29, 35), (14, 35), (13, 35), (12, 35)]: g[y][x] = '#'
    rect(g, 12, 28, 13, 34, '$'); rect(g, 10, 25, 11, 25); g[27][30] = '$'
    return g

# ---- The lair (34 x 30): a domed cavern, a moat of lava round the island, one bridge of natural stone --------------
def lair():
    W, H = 34, 30
    g = grid(W, H)
    cx, cy = 18, 15
    for y in range(H):
        for x in range(W):
            d = ((x - cx) ** 2 + ((y - cy) * 1.15) ** 2) ** 0.5
            if d <= 13.5: g[y][x] = '$' if d > 7.5 else '.'
            if 7.5 < d <= 9 and False: g[y][x] = '$'
    for y in range(H):
        for x in range(W):
            d = ((x - cx) ** 2 + ((y - cy) * 1.15) ** 2) ** 0.5
            if 11.2 < d <= 13.5: g[y][x] = '.'                     # the ledge round the dome's foot
    rect(g, 12, 4, 24, 4); rect(g, 12, 25, 24, 25)                  # the dome's top and foot squared off
    rect(g, 0, 14, 5, 15)                                          # the tunnel in from the vestibule
    g[14][0] = 'V'; g[15][0] = '#'
    rect(g, 5, 14, 11, 15, ')')                                    # the bridge of natural stone
    return g

# What stands where (x, y): each must land on open floor.
CITADEL = {
    'g': [(9, 62)], 'q': [(50, 3)],
    's': [(13, 5), (19, 5), (53, 11), (20, 15), (23, 22), (3, 37)],
    'n': [(25, 5), (3, 44), (3, 59), (3, 66), (15, 31), (24, 15)],
    'c': [(24, 4)],
    'e': [(18, 66)], 'T': [(16, 63), (20, 63)], 'C': [(18, 70)], 'k': [(24, 70)], 'u': [(25, 68)],
    'a': [(22, 47)], 'W': [(4, 51)], 'H': [(2, 50)],
    'f': [(9, 13)], 'F': [(8, 12)], 'A': [(11, 12)], 'R': [(12, 15)], 'm': [(3, 17)],
    'b': [(12, 22), (30, 20), (39, 9), (45, 25), (15, 35), (35, 56)], 'B': [(34, 14), (36, 18), (16, 21)],
    'S': [(32, 5)], 'O': [(32, 8)], 'j': [(41, 4)], 'J': [(43, 5)],
    'M': [(51, 20)], 'X': [(48, 19), (53, 19)], 'Y': [(56, 20)],
    'w': [(41, 14), (45, 14), (43, 20)],
    'P': [(54, 30)], 'o': [(49, 28), (51, 28), (53, 28), (49, 31), (51, 31), (53, 31)], 'E': [(56, 29)],
    'i': [(41, 59)], 'r': [(38, 68)],
    'h': [(32, 27)], 'K': [(32, 32)], 'U': [(32, 33)], 'l': [(36, 31)], 'z': [(28, 32)],
    'v': [(42, 51)], 'y': [(40, 49)], 'x': [(43, 49)],
}
DUCT = {'e': [(14, 20)], 'f': [(13, 12)], 'i': [(11, 30)], 'o': [(12, 26)], 'b': [(5, 3)]}
LAIR = {'d': [(19, 15)], 'H': [(22, 12)], 'o': [(8, 9)]}

def place(g, what):
    for ch, spots in what.items():
        for x, y in spots:
            assert g[y][x] == '.', (ch, x, y, g[y][x])
            g[y][x] = ch
    return g

if __name__ == '__main__':
    for name, g, start in (('ember_citadel', place(citadel(), CITADEL), (0, 70)), ('ember_duct', place(duct(), DUCT), (24, 39)), ('ember_lair', place(lair(), LAIR), (0, 14))):
        show(name, g)
        cut = reach(g, start)
        if cut: print('# unreachable:', cut)
