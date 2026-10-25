# Builds art/worldtiles/temple/pyramid-tier1..4.png from the two PixelLab sheets here:
#   tier-cliff.png  grass -> terrace (the first tier)
#   tier-step.png   terrace -> terrace (the tiers above); its upper terrace came out one flat cream colour, so those
#                   pixels are filled with its own plain terrace tile first.
# Each tier's terrace is shaded a step lighter than the one below it (SHADE), so the height reads from above: in a
# sheet the lower terrace takes the tier below's shade, the upper its own. Which pixels are upper, lower or face is
# read per quarter tile from the metadata's 4x4 pattern (0 lower, 1 upper, 2 the face row): a face-row square's
# bottom half is face, its top half is top, and the face hangs over the top half of the square in front of it.
# A lower quarter with the upper tier (or its face) just west of it gets a cast shadow along that edge.
#   python3 assets/wip/temple-pyramid/build.py "$PWD"
import json, sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/temple-pyramid/'
out = root + '/art/worldtiles/temple/'
SHADE = [0.86, 0.93, 1.0, 1.07]
CAST = (0.74, 9, 18)  # the shadow a tier casts on the terrace east of it (light from the upper left): darkest, where it
# starts past the edge (the edge's own rim is about 8 px), width, in px
CREAM = (216, 210, 172, 255)


def patterns(meta):
    tiles = json.load(open(meta))['tileset_data']['tiles']
    res = {}
    for t in tiles:
        b, p = t['bounding_box'], t['pattern_4x4']
        res[(b['x'] // 64, b['y'] // 64)] = (p['row_1'][1], p['row_1'][2], p['row_2'][1], p['row_2'][2])
    return res


def kinds(pat):
    # The kind of each quarter: NW, NE (bottom halves of the north squares), SW, SE (top halves of the south ones).
    nw, ne, sw, se = pat
    top = lambda v: 'upper' if v == 1 else 'face' if v == 2 else 'lower'
    bottom = lambda v, above: 'upper' if v in (1, 2) else 'face' if above == 2 else 'lower'
    return [top(nw), top(ne), bottom(sw, nw), bottom(se, ne)]


def fill_cream(im):
    # Flood the flat cream areas (40 px and up) with the sheet's plain terrace tile, at the same place in the tile.
    px, (W, H) = im.load(), im.size
    lo = im.crop((2 * 64, 2 * 64, 3 * 64, 3 * 64)).load()
    seen = set()
    for y0 in range(H):
        for x0 in range(W):
            if (x0, y0) in seen or px[x0, y0] != CREAM:
                continue
            comp, st = [], [(x0, y0)]
            seen.add((x0, y0))
            while st:
                x, y = st.pop()
                comp.append((x, y))
                for a, b in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= a < W and 0 <= b < H and (a, b) not in seen and px[a, b] == CREAM:
                        seen.add((a, b))
                        st.append((a, b))
            if len(comp) >= 40:
                for x, y in comp:
                    px[x, y] = lo[x % 64, y % 64]


def shade(im, pats, lower, upper):
    px = im.load()
    for (cx, cy), pat in pats.items():
        for q, kind in enumerate(kinds(pat)):
            f = upper if kind == 'upper' else lower if kind == 'lower' else None
            if f is None or f == 1:
                continue
            x0, y0 = cx * 64 + (q % 2) * 32, cy * 64 + (q // 2) * 32
            for y in range(y0, y0 + 32):
                for x in range(x0, x0 + 32):
                    r, g, b, a = px[x, y]
                    px[x, y] = (min(255, round(r * f)), min(255, round(g * f)), min(255, round(b * f)), a)
        ks = kinds(pat)
        for q in (1, 3):  # NE and SE: is the quarter to their west (NW, SW) higher?
            if ks[q] == 'lower' and ks[q - 1] != 'lower':
                x0, y0 = cx * 64 + 32, cy * 64 + (q // 2) * 32
                for i in range(CAST[2]):
                    f = CAST[0] + (1 - CAST[0]) * i / CAST[2]
                    for y in range(y0, y0 + 32):
                        r, g, b, a = px[x0 + CAST[1] + i, y]
                        px[x0 + CAST[1] + i, y] = (round(r * f), round(g * f), round(b * f), a)


a = Image.open(here + 'tier-cliff.png').convert('RGBA')
shade(a, patterns(here + 'tier-cliff.meta.json'), 1, SHADE[0])  # the grass below stays as it is
a.save(out + 'pyramid-tier1.png')
step = Image.open(here + 'tier-step.png').convert('RGBA')
fill_cream(step)
pats = patterns(here + 'tier-step.meta.json')
for k in (1, 2, 3):
    im = step.copy()
    shade(im, pats, SHADE[k - 1], SHADE[k])
    im.save(out + 'pyramid-tier%d.png' % (k + 1))
print('built', out + 'pyramid-tier1..4.png')
