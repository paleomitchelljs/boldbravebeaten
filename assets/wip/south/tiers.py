# Raises the southern places' mountains in rings (the user, 2026-11-01: one cliff with flat ground on top read as a
# small step; rings read as a slope climbing to the peaks). Rock three or more squares from open ground becomes the
# ledge tier ((), six or more the summit (?); off the map counts as rock. Run by rebuild.sh after the first squaring.
#   python3 assets/wip/south/tiers.py
import os, re, sys

PLACES = sys.argv[1:] or ['south_hills', 'tarnhold', 'tarnvale_west', 'tarnvale_east']
path = os.path.join(os.path.dirname(__file__), '../../../data/places.yaml')

def tiers(rows):
    g = [list(r) for r in rows]
    H, W = len(g), len(g[0])
    rock = lambda x, y: not (0 <= x < W and 0 <= y < H) or g[y][x] == '#'
    out = [r[:] for r in g]
    for y in range(H):
        for x in range(W):
            if g[y][x] != '#': continue
            d = 1
            while d < 7 and all(rock(x + dx, y + dy) for dy in range(-d, d + 1) for dx in range(-d, d + 1)): d += 1
            # d: the Chebyshev distance to the nearest square that isn't rock
            if d >= 6: out[y][x] = '?'
            elif d >= 3: out[y][x] = '('
    # The edge rows and columns take their inner neighbour's tier (squarewalls never touches the edge, so a step there
    # would stay one square deep).
    T = '#(?'
    for x in range(W):
        for y, n in ((0, 1), (H - 1, H - 2)):
            if out[y][x] in T and out[n][x] in T: out[y][x] = out[n][x]
    for y in range(H):
        for x, n in ((0, 1), (W - 1, W - 2)):
            if out[y][x] in T and out[y][n] in T: out[y][x] = out[y][n]
    return [''.join(r) for r in out]

text = open(path).read()
for pid in PLACES:
    pat = re.compile(r'(^' + re.escape(pid) + r':\n(?:(?!^\S).*\n)*?  map:\n)((?:    - ".*"\n)*)', re.M)
    m = pat.search(text)
    rows = [l[7:-1] for l in m.group(2).splitlines()]
    new = ''.join(f'    - "{r}"\n' for r in tiers(rows))
    text = text[:m.start(2)] + new + text[m.end(2):]
open(path, 'w').write(text)
