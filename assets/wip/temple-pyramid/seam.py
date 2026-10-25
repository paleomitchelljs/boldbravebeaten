# Makes the inputs for repainting the join between the stair and its tier: a render of the spot (render.py) with the
# cut-out stair (out-d.png inside pack.py's outline) laid in, and a mask of a band along the outline (white: repaint),
# for PixelLab's inpaint_image. One spot per face sheet: the top tier (its face sheet is shared by tiers 2-4) and the
# first tier (its own face, over grass). Writes seam-<k>.png and seam-<k>-mask.png here.
#   python3 assets/wip/temple-pyramid/seam.py "$PWD"
import subprocess, sys
from PIL import Image, ImageDraw

root = sys.argv[1]
here = root + '/assets/wip/temple-pyramid/'
sys.path.insert(0, here)
SPOTS = {'top': (17, 21, 20, 24), 'first': (7, 30, 10, 33)}  # squares x0 y0 x1 y1; the stair's squares at x 64, 128
BOX = (70, 112, 188, 220)
OUTLINE = [(112, 82, 174), (181, 71, 187), (220, 71, 187)]
BAND = 7  # px each side of the outline's edges


def edge(y):
    for (y0, l0, r0), (y1, l1, r1) in zip(OUTLINE, OUTLINE[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            return round(l0 + (l1 - l0) * t), round(r0 + (r1 - r0) * t)
    return None


stair = Image.open(here + 'out-d.png').convert('RGBA')
for k, sq in SPOTS.items():
    f = here + 'seam-%s.png' % k
    subprocess.run(['python3', root + '/assets/wip/temple-doors/render.py', root, 'temple_court2', *map(str, sq), f], check=True, capture_output=True)
    im = Image.open(f).convert('RGBA')
    px, sp = im.load(), stair.load()
    for y in range(BOX[1], BOX[3]):
        l, r = edge(y)
        for x in range(l, r + 1):
            px[x, y] = sp[x, y]
    im.save(f)
    mask = Image.new('L', im.size, 0)
    d = ImageDraw.Draw(mask)
    for y in range(BOX[1], BOX[3]):
        l, r = edge(y)
        d.line([(l - BAND, y), (l + BAND, y)], fill=255)
        d.line([(r - BAND, y), (r + BAND, y)], fill=255)
    # the head of the flight, where it meets the ledge and the terrace above, and its foot on the terrace below
    l, r = edge(BOX[1])
    d.rectangle([l - BAND, BOX[1] - BAND, r + BAND, BOX[1] + 2 * BAND], fill=255)
    l, r = edge(BOX[3] - 1)
    d.rectangle([l - BAND, BOX[3] - 2 * BAND, r + BAND, BOX[3] + BAND], fill=255)
    mask.save(here + 'seam-%s-mask.png' % k)
print('wrote seam-top, seam-first (+ masks)')
