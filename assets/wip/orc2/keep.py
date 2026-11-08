# The second pass's props, chosen from props/ (PixelLab create_map_object; ids.txt), made ready for the strip that
# ../orc/build.py packs: trimmed, the chest and the war table halved (they came out the size of a bed), the cabin's
# bright green roof toned down to moss.
#   python3 assets/wip/orc2/keep.py
import os
from collections import Counter
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
KEEP = {'gate': 'gate_front', 'throne': 'throne', 'longhut': 'longhut', 'cabin': 'cabin', 'cage': 'cage2',
        'gibbet': 'gibbet', 'feast': 'feast', 'bed': 'bed3', 'chest': 'chest', 'maptable': 'maptable', 'rack': 'rack2',
        'bench': 'bench', 'altar': 'altar', 'barrels': 'barrels2'}
HALF = {'chest', 'maptable'}

def half(im):
    # each 2x2 block to its commonest opaque colour (clear if most of it is clear)
    out = Image.new('RGBA', (im.width // 2, im.height // 2)); p, o = im.load(), out.load()
    for y in range(out.height):
        for x in range(out.width):
            q = [p[2 * x + i, 2 * y + j] for i in (0, 1) for j in (0, 1)]
            op = [c for c in q if c[3] > 128]
            o[x, y] = Counter(op).most_common(1)[0][0] if len(op) >= 2 else (0, 0, 0, 0)
    return out

def moss(im):
    p = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = p[x, y]
            if a and g > r + 18 and g > b + 18:
                m = (r + g + b) / 3
                p[x, y] = tuple(int((m + (c - m) * 0.45) * 0.62) for c in (r, g, b)) + (a,)
    return im

os.makedirs(here + '/keep', exist_ok=True)
for name, src in KEEP.items():
    im = Image.open(f'{here}/props/{src}.png').convert('RGBA')
    im = im.crop(im.getbbox())
    if name in HALF: im = half(im); im = im.crop(im.getbbox())
    if name == 'cabin': im = moss(im)
    im.save(f'{here}/keep/{name}.png')
    print(name, im.size)
