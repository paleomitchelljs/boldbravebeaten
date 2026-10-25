# Builds the sewer's art in art/worldtiles/temple/ from the PixelLab sheets and pieces here:
#   sewer-wall.png   the wall cliff set, its lower ground made transparent (the quarter tiles the 4x4 pattern marks as
#                    lower), so a wall stands on whatever is under it: walkway or water; its tops darkened and greyed.
#   sewer-water.png  the walkway over the water (a 16-tile corner set, the default layout); copied as it is.
#   sewer-shallows.png  the plain water tile, lightened: the shallow pools under the shafts.
#   sewer-decor.png  the pieces in a row; prints their rects for data/tilesets.yaml.
#   sewer-deck.png   the plank deck over the water (bridges), its water transparent.
#   sewer-props.png  the shaft up to the gatehouse and the drain.
#   python3 assets/wip/temple-sewer/build.py "$PWD"
import json, sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/temple-sewer/'
out = root + '/art/worldtiles/temple/'
TOP = (0.68, 0.45)  # the wall tops: brightness, saturation kept

wall = Image.open(here + 'sewer-wall.png').convert('RGBA')
px = wall.load()
for t in json.load(open(here + 'sewer-wall.meta.json'))['tileset_data']['tiles']:
    b, p = t['bounding_box'], t['pattern_4x4']
    nw, ne, sw, se = p['row_1'][1], p['row_1'][2], p['row_2'][1], p['row_2'][2]
    # A quarter is lower ground when its square is lower and no face hangs over it (the face row is just north).
    lower = [nw == 0, ne == 0, sw == 0 and nw != 2, se == 0 and ne != 2]
    # The top: the wall's upper squares, and the top half of its face row (the south quarters of a face-row square).
    top = [nw == 1, ne == 1, sw in (1, 2), se in (1, 2)]
    for q in range(4):
        x0, y0 = b['x'] + (q % 2) * 32, b['y'] + (q // 2) * 32
        for y in range(y0, y0 + 32):
            for x in range(x0, x0 + 32):
                if lower[q]:
                    px[x, y] = (0, 0, 0, 0)
                elif not top[q]:
                    # Faces: the brick came out reddish at the ends; grey the reddish pixels, keep the slime green.
                    r, g, bl, a = px[x, y]
                    if r > g + 6:
                        m = (r + g + bl) / 3
                        px[x, y] = tuple(round(m + (c - m) * 0.35) for c in (r, g, bl)) + (a,)
                elif top[q]:
                    # The tops came out light and mottled pink: darker and greyer, so they recede as in the references.
                    r, g, bl, a = px[x, y]
                    m = (r + g + bl) / 3
                    r, g, bl = (m + (c - m) * TOP[1] for c in (r, g, bl))
                    px[x, y] = (round(r * TOP[0]), round(g * TOP[0]), round(bl * TOP[0]), a)
wall.save(out + 'sewer-wall.png')

water = Image.open(here + 'sewer-water.png').convert('RGBA')
water.save(out + 'sewer-water.png')
plain = water.crop((2 * 64, 1 * 64, 3 * 64, 2 * 64))  # LLLL: plain water
sh = plain.copy()
sp = sh.load()
for y in range(64):
    for x in range(64):
        r, g, b, a = sp[x, y]
        sp[x, y] = (min(255, round(r * 1.35 + 10)), min(255, round(g * 1.3 + 14)), min(255, round(b * 1.2 + 6)), a)
sh.save(out + 'sewer-shallows.png')

# The plank deck (bridges and the ring round the drain): its water made transparent wherever it is exactly the plain
# water tile, so the posts and the deck's shadow stay and the walkway shows where a bridge ends on it.
deck = Image.open(here + 'sewer-deck.png').convert('RGBA')
dp, dw = deck.load(), deck.crop((2 * 64, 1 * 64, 3 * 64, 2 * 64)).load()
for y in range(deck.height):
    for x in range(deck.width):
        if dp[x, y] == dw[x % 64, y % 64]:
            dp[x, y] = (0, 0, 0, 0)
deck.save(out + 'sewer-deck.png')

PIECES = ['d-scum', 'd-debris', 'd-post', 'd-grime', 'd-grate', 'f-slime', 'f-pipe']
ims = [Image.open(here + n + '.png').convert('RGBA') for n in PIECES]
# The scum is a flat blob: laid at half strength it reads as a film on the water.
sc = ims[0].load()
for y in range(ims[0].height):
    for x in range(ims[0].width):
        r, g, b, a = sc[x, y]
        sc[x, y] = (r, g, b, a // 2)
sheet = Image.new('RGBA', (64 * len(ims), 64), (0, 0, 0, 0))
for i, (n, im) in enumerate(zip(PIECES, ims)):
    bb = im.getbbox()
    im = im.crop(bb)
    sheet.paste(im, (i * 64, 0))
    print(f'    {n}: [sewer-decor.png, {i * 64}, 0, {im.width}, {im.height}]')
sheet.save(out + 'sewer-decor.png')

props = Image.new('RGBA', (132, 64), (0, 0, 0, 0))
props.paste(Image.open(here + 'p-shaft.png').convert('RGBA'), (0, 0))
props.paste(Image.open(here + 'p-drain.png').convert('RGBA'), (68, 0))
props.save(out + 'sewer-props.png')
print('    shaft: [sewer-props.png, 0, 0, 64, 64]\n    drain: [sewer-props.png, 68, 0, 64, 64]')
