# Raises parts of Tarnhold's and the vales' open ground onto the walkable levels (the user, 2026-11-08: plateaus and
# passes that vary in height): the upland ({) and the high plateau (▓), each a sloped bank above the last. Run after
# assets/wip/tarn/rebuild.sh (which rewrites the maps).
#   python3 assets/wip/orc/heights.py
import re

# place -> [(x0, y0, x1, y1, level)]: open ground and road (, .) in the box goes up to that level, later boxes win.
ZONES = {
    # The pass comes down from the north: the high plateau at the top, the upland below it, the junction on the floor.
    'tarnhold': [(25, 0, 33, 5, '▓'), (25, 6, 33, 11, '{')],
    # The side canyon from the gate yard climbs to the orc valley.
    'tarnvale_east': [(64, 0, 67, 3, '▓'), (64, 4, 67, 7, '{')],
}
OPEN = ',.'
# Cut before the levels: the side canyon north from the East Tarnvale's gate yard to the orc valley (O, its way out),
# walled two squares either side, through the peaks (the layout predates it).
def carve_tarnvale_east(rows):
    for y in range(0, 10):
        for x in range(62, 70): rows[y][x] = '#'
        for x in (65, 66): rows[y][x] = ','
    rows[0][65] = rows[0][66] = 'O'
CARVE = {'tarnvale_east': carve_tarnvale_east}

path = 'data/places.yaml'
text = open(path).read()
for pid, zones in ZONES.items():
    pat = re.compile(r'(^' + re.escape(pid) + r':\n(?:(?!^\S).*\n)*?  map:\n)((?:    - ".*"\n)*)', re.M)
    m = pat.search(text)
    rows = [list(l[7:-1]) for l in m.group(2).splitlines()]
    if pid in CARVE: CARVE[pid](rows)
    for x0, y0, x1, y1, lv in zones:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if rows[y][x] in OPEN or rows[y][x] in '{▓': rows[y][x] = lv
    new = ''.join(f'    - "{"".join(r)}"\n' for r in rows)
    text = text[:m.start(2)] + new + text[m.end(2):]
open(path, 'w').write(text)
