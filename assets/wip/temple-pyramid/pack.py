# Cuts the pyramid's stair (one design, used on every tier: the user, "a single, well-matched set of north-south
# stairs") out of the renders it was inpainted into, and packs a copy per tier, in two halves (one per square), with the
# altar into art/worldtiles/temple/pyramid-props.png. Prints each piece's rect and its offset from its square's
# top-left (the numbers for data/tilesets.yaml).
#   python3 assets/wip/temple-pyramid/pack.py "$PWD"
import sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/temple-pyramid/'
# The stair with its join to the tier repainted (seam.py, then inpaint_image on a band along its outline):
# out-seam-top.png on the top tier's face (the face sheet of tiers 2-4), out-seam-first.png on the first tier's (over
# grass). Each piece keeps the stair and the repainted band; everything else is transparent, so the tier's own tiles
# show round it. The two squares sit at x 64 and 128, y 128 of the render.
OUTLINE = [(112, 82, 174), (181, 71, 187), (220, 71, 187)]
BOX = (64, 104, 195, 228)
# The top-tier copy was painted between the third terrace (shade 1.0) and the top (1.07): tiers 2 and 3 take it
# darkened to their lower terrace's shade (build.py's SHADE).
SHADE = [0.86, 0.93, 1.0, 1.07]


def inside(x, y):
    for (y0, l0, r0), (y1, l1, r1) in zip(OUTLINE, OUTLINE[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            return l0 + (l1 - l0) * t - 0.5 <= x <= r0 + (r1 - r0) * t + 0.5
    return False


def piece(k, f):
    im = Image.open(here + 'out-seam-%s.png' % k).convert('RGBA')
    mask = Image.open(here + 'seam-%s-mask.png' % k).convert('L').load()
    px = im.load()
    out = Image.new('RGBA', (BOX[2] - BOX[0], BOX[3] - BOX[1]), (0, 0, 0, 0))
    po = out.load()
    for y in range(BOX[1], BOX[3]):
        for x in range(BOX[0], BOX[2]):
            if mask[x, y] or inside(x, y):
                c = px[x, y]
                po[x - BOX[0], y - BOX[1]] = (min(255, round(c[0] * f)), min(255, round(c[1] * f)), min(255, round(c[2] * f)), 255)
    return out


cuts = [('altar', Image.open(here + 'altar.png').convert('RGBA'), None)]
mid = 128 - BOX[0]
for k in range(1, 5):
    st = piece('first', 1) if k == 1 else piece('top', SHADE[k - 2] / SHADE[2])
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
