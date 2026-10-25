# Cuts the inpainted stairs out of their renders and packs them, with the altar, into
# art/worldtiles/temple/pyramid-props.png. Prints each piece's rect and its offset from its square's top-left (the
# numbers for data/tilesets.yaml). Each piece's stair square sits at the given pixels in its render.
# The tiers' shading (build.py) may have changed since a piece was painted: each piece is corrected by the ratio of a
# fresh render of its spot to the render it was painted into (ctx-<k>.png), so it still meets the tiles around it.
#   python3 assets/wip/temple-pyramid/pack.py "$PWD"
import subprocess, sys, tempfile
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/temple-pyramid/'
# The renders: squares x0 y0 x1 y1 of temple_court2.
CTX = {'a': (3, 6, 6, 9), 'b': (25, 27, 28, 30), 'c': (9, 12, 12, 15), 'd': (17, 21, 20, 24)}
# name: (render, mask rect x, y, w, h, the stair square's top-left in the render)
PIECES = {
    'pyr_steps_w1': ('a', (28, 130, 168, 58), (128, 128)),
    'pyr_steps_w3': ('c', (28, 130, 168, 58), (128, 128)),
    'pyr_steps_s': ('b', (60, 112, 136, 108), (128, 128)),
    'pyr_stair_l': ('d', (60, 112, 68, 108), (64, 128)),
    'pyr_stair_r': ('d', (128, 112, 68, 108), (128, 128)),
}
now, tmp = {}, tempfile.mkdtemp()
for k, (x0, y0, x1, y1) in CTX.items():
    f = '%s/now-%s.png' % (tmp, k)
    subprocess.run(['python3', root + '/assets/wip/temple-doors/render.py', root, 'temple_court2', str(x0), str(y0), str(x1), str(y1), f], check=True, capture_output=True)
    now[k] = Image.open(f).convert('RGBA')


def corrected(k, box):
    piece = Image.open(here + 'out-%s.png' % k).convert('RGBA').crop(box)
    old, new = Image.open(here + 'ctx-%s.png' % k).convert('RGBA').crop(box).load(), now[k].crop(box).load()
    px = piece.load()
    for y in range(piece.height):
        for x in range(piece.width):
            r, g, b, a = px[x, y]
            o, n = old[x, y], new[x, y]
            f = [n[i] / o[i] if o[i] else 1 for i in range(3)]
            px[x, y] = (min(255, round(r * f[0])), min(255, round(g * f[1])), min(255, round(b * f[2])), a)
    return piece


cuts = [('altar', Image.open(here + 'altar.png').convert('RGBA'), None)]
for name, (k, (x, y, w, h), (sx, sy)) in PIECES.items():
    cuts.append((name, corrected(k, (x, y, x + w, y + h)), (x - sx, y - sy)))
W = sum(c.width for _, c, _ in cuts) + 4 * (len(cuts) - 1)
sheet = Image.new('RGBA', (W, max(c.height for _, c, _ in cuts)), (0, 0, 0, 0))
x = 0
for name, c, off in cuts:
    sheet.paste(c, (x, 0))
    print(f'    {name}: [pyramid-props.png, {x}, 0, {c.width}, {c.height}' + (f', {off[0]}, {off[1]}]' if off else ']'))
    x += c.width + 4
sheet.save(root + '/art/worldtiles/temple/pyramid-props.png')
