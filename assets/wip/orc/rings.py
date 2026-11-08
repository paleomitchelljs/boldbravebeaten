# Raises the slope mountains of Tarnhold, the vales and the orc valley in rings one square apart (the user,
# 2026-11-08: "the rings should be closer on walls where we don't need a ledge to walk — and there should be more of
# them to imply greater height to the ridges"). Every square of mountain (# and the ring letters) takes the ring of its
# distance, centre to centre, from the nearest square that isn't mountain: under 2 the rock itself (#), then ( ? ▁ ▂ ▃
# ▄, one ring a square, up to six. Off the map counts as mountain. Replaces ../south/tiers.py for these places (the
# south hills' cliff rings keep it); run after the maps are laid out.
#   python3 assets/wip/orc/rings.py [place ...]
import math, os, re, sys

RINGS = '#(?▁▂▃▄'
PLACES = sys.argv[1:] or ['tarnhold', 'tarnvale_west', 'tarnvale_east', 'orc_valley']
path = os.path.join(os.path.dirname(__file__), '../../../data/places.yaml')

def rings(rows):
    H, W = len(rows), len(rows[0])
    rock = lambda x, y: not (0 <= x < W and 0 <= y < H) or rows[y][x] in RINGS
    out = [list(r) for r in rows]
    R = len(RINGS) + 1
    for y in range(H):
        for x in range(W):
            if rows[y][x] not in RINGS: continue
            d = min((math.hypot(dx, dy) for dy in range(-R, R + 1) for dx in range(-R, R + 1) if not rock(x + dx, y + dy)), default=R)
            out[y][x] = RINGS[max(0, min(len(RINGS) - 1, int(d) - 1))]
    return [''.join(r) for r in out]

text = open(path).read()
for pid in PLACES:
    pat = re.compile(r'(^' + re.escape(pid) + r':\n(?:(?!^\S).*\n)*?  map:\n)((?:    - ".*"\n)*)', re.M)
    m = pat.search(text)
    rows = [l[7:-1] for l in m.group(2).splitlines()]
    new = ''.join(f'    - "{r}"\n' for r in rings(rows))
    text = text[:m.start(2)] + new + text[m.end(2):]
open(path, 'w').write(text)
