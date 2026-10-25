# Cuts the pyramid's stair (one design, used on every tier: the user, "a single, well-matched set of north-south
# stairs") out of the render it was inpainted into, and packs a copy per tier, in two halves (one per square), with the
# altar into art/worldtiles/temple/pyramid-props.png. Prints each piece's rect and its offset from its square's
# top-left (the numbers for data/tilesets.yaml).
#   python3 assets/wip/temple-pyramid/pack.py "$PWD"
import sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/temple-pyramid/'
# The render the stair was painted into (ctx-d.png, squares 17 21 20 24 of temple_court2): its two squares sit at
# x 64 and 128, y 128, and the flight stands in the rectangle below.
BOX = (70, 112, 188, 220)
# Only the flight and its balustrades are kept; the rest is transparent so the tier's own face and terraces show
# around it. Its outline, (y, left, right) in the render, straight between these rows: narrower at the top, out to the
# newel posts at the foot.
OUTLINE = [(112, 82, 174), (181, 71, 187), (220, 71, 187)]
# It was painted onto the top tier (shade 1.05 then, build.py): each tier's copy is shaded for its own terraces.
SHADE = [0.86, 0.93, 1.0, 1.07]
PAINTED = 1.05

def edge(y):
    for (y0, l0, r0), (y1, l1, r1) in zip(OUTLINE, OUTLINE[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            return l0 + (l1 - l0) * t, r0 + (r1 - r0) * t
    return 0, -1


def stair(f):
    piece = Image.open(here + 'out-d.png').convert('RGBA').crop(BOX)
    px = piece.load()
    for y in range(piece.height):
        l, r = edge(BOX[1] + y)
        for x in range(piece.width):
            X = BOX[0] + x
            if X < round(l) or X > round(r):
                px[x, y] = (0, 0, 0, 0)
                continue
            c = px[x, y]
            px[x, y] = (min(255, round(c[0] * f)), min(255, round(c[1] * f)), min(255, round(c[2] * f)), c[3])
    return piece


cuts = [('altar', Image.open(here + 'altar.png').convert('RGBA'), None)]
mid = 128 - BOX[0]
for k in range(1, 5):
    st = stair(SHADE[k - 1] / PAINTED)
    cuts.append(('pyr_stair_l%d' % k, st.crop((0, 0, mid, st.height)), (BOX[0] - 64, BOX[1] - 128)))
    cuts.append(('pyr_stair_r%d' % k, st.crop((mid, 0, st.width, st.height)), (0, BOX[1] - 128)))
W = sum(c.width for _, c, _ in cuts) + 4 * (len(cuts) - 1)
sheet = Image.new('RGBA', (W, max(c.height for _, c, _ in cuts)), (0, 0, 0, 0))
x = 0
for name, c, off in cuts:
    sheet.paste(c, (x, 0))
    print(f'    {name}: [pyramid-props.png, {x}, 0, {c.width}, {c.height}' + (f', {off[0]}, {off[1]}]' if off else ']'))
    x += c.width + 4
sheet.save(root + '/art/worldtiles/temple/pyramid-props.png')
