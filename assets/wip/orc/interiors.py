# Lays out the orc castle and the slaver caves (the user, 2026-11-08: their map key; screenshots of the castle's outside,
# its throne room, and the quarried hills). Prints the maps, or with --write seeds them into data/places.yaml.
#   python3 assets/wip/orc/interiors.py [--write]
import sys

def grid(w, h): return [['#'] * w for _ in range(h)]

def room(g, x0, y0, x1, y1, ch='.'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = ch

def put(g, pts, ch):
    for x, y in pts: g[y][x] = ch

# ---- The castle (key 2): the gate hall from the valley; a cross passage; the throne room north of it; the warlord's
# rooms and the emissaries' to either side; the prophet's shrine, the mess and the barracks south.
C = grid(34, 28)
room(C, 11, 2, 22, 11)            # the throne room
room(C, 2, 2, 8, 7)               # the emissaries' chambers
room(C, 25, 2, 31, 7)             # the warlord's quarters
room(C, 2, 10, 8, 11)             # the prophet's shrine
room(C, 25, 10, 31, 11)           # the armoury
room(C, 3, 14, 30, 14)            # the cross passage
room(C, 14, 17, 19, 24)           # the gate hall
room(C, 2, 17, 11, 24)            # the mess and kitchen
room(C, 22, 17, 31, 24)           # the barracks
# Doorways through the two-square walls.
room(C, 9, 4, 10, 4); room(C, 23, 4, 24, 4)       # the side rooms onto the throne room
room(C, 5, 8, 5, 9); room(C, 28, 8, 28, 9)        # the side rooms down to the shrine and the armoury
room(C, 5, 12, 5, 13); room(C, 28, 12, 28, 13)    # the shrine and the armoury onto the passage
room(C, 16, 12, 17, 13)                           # the throne room's doors
room(C, 7, 15, 7, 16); room(C, 16, 15, 17, 16); room(C, 26, 15, 26, 16)   # the passage to the rooms south
put(C, [(16, 24), (17, 24)], 'S')                 # out through the gate
put(C, [(15, 3), (16, 3), (17, 3), (18, 3), (15, 4), (16, 4), (17, 4), (18, 4)], '|')   # the dais
put(C, [(16, 3)], 'T')                            # the throne
put(C, [(17, 5)], 'E')                            # the emperor
put(C, [(13, 5), (20, 5), (13, 8), (20, 8)], 'o')  # green marble pillars
put(C, [(14, 3), (19, 3)], 'z')                   # braziers by the throne
put(C, [(14, 7), (19, 7)], 'g')                   # the throne guard
put(C, [(28, 4)], 'L'); put(C, [(30, 3)], 'e'); put(C, [(26, 6)], 'm'); put(C, [(30, 6)], 'H')     # the warlord
put(C, [(4, 4)], 'Y'); put(C, [(3, 3), (7, 3)], 'e'); put(C, [(6, 6)], 'k')                      # the emissaries
put(C, [(3, 10)], 'a'); put(C, [(7, 11)], 'P')                                                   # the prophet
put(C, [(26, 10), (30, 10)], 'w'); put(C, [(30, 11)], 'u')                                       # the armoury
put(C, [(4, 19), (8, 19)], 't'); put(C, [(3, 23)], 'c'); put(C, [(10, 22)], 'b'); put(C, [(6, 21)], 'M')  # the mess
put(C, [(23, 18), (25, 18), (27, 18), (29, 18), (23, 23), (25, 23), (27, 23)], 'p'); put(C, [(30, 23)], 'x')
put(C, [(26, 21)], 'B')                                                                          # the barracks
put(C, [(15, 18), (18, 18)], 'z'); put(C, [(16, 20)], 'G')                                       # the gate hall
put(C, [(21, 14), (10, 14)], 'r')                                                                # passage patrols

# ---- The slaver caves (key 4): a mouth in the quarried hill's south face; galleries hacked out of the grey stone, the
# slaves' pens, the overseers' room, the ore store, and a worked-out shaft going on down.
M = grid(36, 28)
room(M, 16, 22, 19, 26)           # the mouth tunnel
room(M, 10, 18, 25, 21)           # the first gallery
room(M, 4, 12, 9, 22)             # the west working
room(M, 26, 12, 31, 20)           # the east working
room(M, 13, 8, 22, 15)            # the great cut
room(M, 3, 3, 10, 8)              # the slave pens
room(M, 24, 3, 32, 8)             # the overseers' room
room(M, 15, 2, 20, 5)             # the ore store
room(M, 9, 9, 12, 10); room(M, 23, 9, 25, 10)     # cuts joining the great cut to the pens and the overseers
room(M, 8, 10, 8, 11); room(M, 26, 9, 26, 11)
room(M, 17, 6, 18, 7)                              # the great cut up to the ore store
room(M, 10, 20, 10, 20); room(M, 25, 18, 26, 19)   # the gallery to the workings
room(M, 7, 8, 8, 8); room(M, 9, 8, 12, 8)
room(M, 17, 16, 18, 17)                            # the gallery up into the great cut
put(M, [(17, 26), (18, 26)], 'S')
put(M, [(33, 15)], 'D'); room(M, 32, 15, 32, 15)                  # the old shaft
put(M, [(5, 4), (8, 4), (5, 7)], 'z'); put(M, [(7, 6)], 'G'); put(M, [(4, 6)], 'q')                  # the pens
put(M, [(28, 5)], 'o'); put(M, [(25, 4)], 't'); put(M, [(31, 7)], 'H'); put(M, [(30, 4)], 'b')      # the overseers
put(M, [(16, 3), (19, 3)], 'c'); put(M, [(18, 4)], 'k')                                             # the ore store
put(M, [(15, 10), (20, 12)], 'm'); put(M, [(14, 13)], 'n'); put(M, [(17, 11)], 'w')                 # the great cut
put(M, [(6, 14), (7, 19)], 'm'); put(M, [(5, 17)], 'v'); put(M, [(28, 14), (29, 18)], 'm'); put(M, [(28, 16)], 'v')
put(M, [(12, 19), (23, 20)], 'x'); put(M, [(20, 19)], 'g')

out = {'orc_castle': C, 'orc_mines': M}
if '--write' in sys.argv:
    p = 'data/places.yaml'; s = open(p).read()
    for pid, g in out.items():
        i = s.index(f'\n{pid}:\n'); j = s.index('  map:\n', i) + len('  map:\n'); k = s.index('  legend:', j)
        s = s[:j] + ''.join(f'    - "{"".join(r)}"\n' for r in g) + s[k:]
    open(p, 'w').write(s)
else:
    for pid, g in out.items():
        print(pid)
        for y, r in enumerate(g): print(f'{y:02d} ' + ''.join(r))
