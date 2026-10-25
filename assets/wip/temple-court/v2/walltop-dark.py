# The wall-top place's walls: its tops darkened, so the parapets and the guardhouse's walls don't read as more of the
# walk's paving (the user found the place hard to move in). From walltop-wall-light.png (the hand-jointed sheet, see
# README) to art/worldtiles/temple/walltop-wall.png. Quarter tiles are classed by walltop-cliff.metadata.json's
# pattern_4x4 as the sewer's build does; row 8 (the plain tops) is all top.
#   python3 assets/wip/temple-court/v2/walltop-dark.py "$PWD"
import json, sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/temple-court/v2/'
TOP = (0.78, 0.7)  # brightness, saturation kept

im = Image.open(here + 'walltop-wall-light.png').convert('RGBA')
px = im.load()
def dark(x0, y0, w, h):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            r, g, b, a = px[x, y]
            m = (r + g + b) / 3
            r, g, b = (m + (c - m) * TOP[1] for c in (r, g, b))
            px[x, y] = (round(r * TOP[0]), round(g * TOP[0]), round(b * TOP[0]), a)
for t in json.load(open(here + 'walltop-cliff.metadata.json'))['tileset_data']['tiles']:
    bb, p = t['bounding_box'], t['pattern_4x4']
    nw, ne, sw, se = p['row_1'][1], p['row_1'][2], p['row_2'][1], p['row_2'][2]
    top = [nw == 1, ne == 1, sw in (1, 2), se in (1, 2)]
    for q in range(4):
        if top[q]:
            dark(bb['x'] + (q % 2) * 32, bb['y'] + (q // 2) * 32, 32, 32)
dark(0, 512, im.width, 64)
im.save(root + '/art/worldtiles/temple/walltop-wall.png')
